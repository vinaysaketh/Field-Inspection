import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot";

import { useToast } from "@/src/components/Toast";
import { addObservation, nextObservationNumber } from "@/src/store/observations";
import { loadSettings } from "@/src/store/settings";
import { LocationData, Observation } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { annotationPalette, radius, spacing } from "@/src/theme/tokens";
import { formatLocationStamp, getCurrentLocation, queueForGeocoding } from "@/src/utils/location";

type Tool = "text" | "circle" | "arrow" | "rectangle" | "freedraw" | "marker";
type ColorName = keyof typeof annotationPalette;
type Size = "S" | "M" | "L";

type Element =
  | { id: string; type: "text"; x: number; y: number; text: string; color: string; size: Size }
  | { id: string; type: "circle"; cx: number; cy: number; r: number; color: string }
  | { id: string; type: "arrow"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { id: string; type: "rectangle"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; type: "freedraw"; d: string; color: string; strokeWidth: number }
  | { id: string; type: "marker"; x: number; y: number; n: number; color: string };

const TOOL_LIST: { tool: Tool; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { tool: "text", icon: "text", label: "Text" },
  { tool: "circle", icon: "ellipse-outline", label: "Circle" },
  { tool: "arrow", icon: "arrow-forward", label: "Arrow" },
  { tool: "rectangle", icon: "square-outline", label: "Rect" },
  { tool: "freedraw", icon: "brush", label: "Draw" },
  { tool: "marker", icon: "location", label: "Marker" },
];

const SIZE_PX: Record<Size, number> = { S: 16, M: 22, L: 30 };
const COLOR_ORDER: ColorName[] = ["red", "yellow", "white", "green", "blue"];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Editor() {
  const params = useLocalSearchParams<{ uri?: string; width?: string; height?: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const shotRef = useRef<View | null>(null);

  const [imageUri] = useState<string>(params.uri ?? "");
  const [imageDims, setImageDims] = useState<{ w: number; h: number }>({
    w: parseInt(params.width || "0", 10) || 1080,
    h: parseInt(params.height || "0", 10) || 1440,
  });
  const [tool, setTool] = useState<Tool>("text");
  const [color, setColor] = useState<ColorName>("yellow");
  const [size, setSize] = useState<Size>("M");
  const [strokeWidth, setStrokeWidth] = useState(4);

  // History stack
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const elements = history[historyIdx];

  // Draft (in-progress) element being drawn
  const [draft, setDraft] = useState<Element | null>(null);
  const markerCounterRef = useRef(0);

  // Text input modal
  const [textModal, setTextModal] = useState<{ x: number; y: number; value: string } | null>(null);

  // Location
  const [loc, setLoc] = useState<LocationData | null>(null);
  const [obsNumber, setObsNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadSettings>> | null>(null);

  // Container layout (so we can map touch coords to image coords)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const displayed = useMemo(() => {
    // Letterbox the image inside container, returns rect.
    const cw = containerSize.w;
    const ch = containerSize.h;
    const iw = imageDims.w || 1;
    const ih = imageDims.h || 1;
    const scale = Math.min(cw / iw, ch / ih);
    const w = iw * scale;
    const h = ih * scale;
    const x = (cw - w) / 2;
    const y = (ch - h) / 2;
    return { x, y, w, h, scale };
  }, [containerSize, imageDims]);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const num = await nextObservationNumber();
      setObsNumber(num);
      if (s.gpsEnabled) {
        const l = await getCurrentLocation();
        setLoc(l);
      }
    })();
  }, []);

  const pushHistory = (next: Element[]) => {
    const trimmed = history.slice(0, historyIdx + 1);
    trimmed.push(next);
    setHistory(trimmed);
    setHistoryIdx(trimmed.length - 1);
  };

  const undo = () => historyIdx > 0 && setHistoryIdx(historyIdx - 1);
  const redo = () => historyIdx < history.length - 1 && setHistoryIdx(historyIdx + 1);

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  // Convert touch coords (relative to container) to displayed image coords.
  // We store coords in container space; they remain consistent for rendering.
  const insideImage = (px: number, py: number) =>
    px >= displayed.x && px <= displayed.x + displayed.w && py >= displayed.y && py <= displayed.y + displayed.h;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !textModal,
        onMoveShouldSetPanResponder: () => !textModal,
        onPanResponderGrant: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          if (!insideImage(x, y)) return;
          if (tool === "text") {
            setTextModal({ x, y, value: "" });
            return;
          }
          if (tool === "marker") {
            markerCounterRef.current += 1;
            const el: Element = {
              id: genId(),
              type: "marker",
              x,
              y,
              n: markerCounterRef.current,
              color: annotationPalette[color],
            };
            pushHistory([...elements, el]);
            return;
          }
          if (tool === "freedraw") {
            setDraft({
              id: genId(),
              type: "freedraw",
              d: `M${x.toFixed(1)} ${y.toFixed(1)}`,
              color: annotationPalette[color],
              strokeWidth,
            });
            return;
          }
          // shape tools: circle / arrow / rectangle
          if (tool === "circle") {
            setDraft({ id: genId(), type: "circle", cx: x, cy: y, r: 0, color: annotationPalette[color] });
          } else if (tool === "arrow") {
            setDraft({ id: genId(), type: "arrow", x1: x, y1: y, x2: x, y2: y, color: annotationPalette[color] });
          } else if (tool === "rectangle") {
            setDraft({ id: genId(), type: "rectangle", x, y, w: 0, h: 0, color: annotationPalette[color] });
          }
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          setDraft((d) => {
            if (!d) return d;
            if (d.type === "freedraw") {
              return { ...d, d: d.d + ` L${x.toFixed(1)} ${y.toFixed(1)}` };
            }
            if (d.type === "circle") {
              const r = Math.hypot(x - d.cx, y - d.cy);
              return { ...d, r };
            }
            if (d.type === "arrow") {
              return { ...d, x2: x, y2: y };
            }
            if (d.type === "rectangle") {
              return { ...d, w: x - d.x, h: y - d.y };
            }
            return d;
          });
        },
        onPanResponderRelease: () => {
          setDraft((d) => {
            if (d) {
              // Normalize rectangle (negative w/h)
              let final = d;
              if (d.type === "rectangle") {
                const nx = Math.min(d.x, d.x + d.w);
                const ny = Math.min(d.y, d.y + d.h);
                final = { ...d, x: nx, y: ny, w: Math.abs(d.w), h: Math.abs(d.h) };
              }
              if (d.type === "circle" && d.r < 4) return null;
              if (d.type === "arrow" && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 6) return null;
              if (d.type === "rectangle" && (Math.abs(d.w) < 6 || Math.abs(d.h) < 6)) return null;
              pushHistory([...elements, final]);
            }
            return null;
          });
        },
        onPanResponderTerminate: () => setDraft(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, strokeWidth, elements, textModal, displayed.x, displayed.y, displayed.w, displayed.h],
  );

  const commitTextModal = () => {
    if (!textModal) return;
    const v = textModal.value.trim();
    if (v) {
      const el: Element = {
        id: genId(),
        type: "text",
        x: textModal.x,
        y: textModal.y,
        text: v,
        color: annotationPalette[color],
        size,
      };
      pushHistory([...elements, el]);
    }
    setTextModal(null);
  };

  const stampText = useMemo(() => {
    if (!settings?.gpsEnabled || !loc) return "";
    return formatLocationStamp(loc, settings.stampTemplate, settings.customTemplate, new Date());
  }, [settings, loc]);

  const watermarkLines = useMemo(() => {
    if (!settings) return [] as string[];
    const out: string[] = [];
    if (settings.watermarkCompany && settings.company) out.push(settings.company);
    if (settings.watermarkObsNumber && obsNumber) out.push(obsNumber);
    if (settings.watermarkAuditor && settings.auditor) out.push(`Auditor: ${settings.auditor}`);
    if (settings.watermarkDateTime) out.push(new Date().toLocaleString());
    return out;
  }, [settings, obsNumber]);

  const save = async () => {
    if (!imageUri || saving) return;
    setSaving(true);
    try {
      // Capture annotated view into a flat image
      const captured = await captureRef(shotRef as any, {
        format: "jpg",
        quality: 0.92,
        result: "tmpfile",
      });
      // Move to a stable docs path
      const dir = `${FileSystem.documentDirectory}observations/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const dest = `${dir}${obsNumber}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: captured, to: dest });

      const obs: Observation = {
        id: genId(),
        number: obsNumber,
        imageUri: dest,
        location: loc,
        timestamp: Date.now(),
        project: settings?.project ?? "",
        company: settings?.company ?? "",
        auditor: settings?.auditor ?? "",
        notes,
        template: settings?.stampTemplate ?? "A",
      };
      await addObservation(obs);
      if (loc && !loc.resolved) {
        await queueForGeocoding(obs.id);
      }
      toast.show(`${obsNumber} saved`, { kind: "success" });
      router.replace({ pathname: "/observation", params: { id: obs.id } });
    } catch (e: any) {
      toast.show("Save failed: " + (e?.message ?? "unknown"), { kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!imageUri) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.onSurface, padding: spacing.lg }}>No image provided.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable testID="editor-close-button" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerNum} testID="editor-obs-number">{obsNumber}</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable testID="editor-undo-button" onPress={undo} disabled={!canUndo} style={[styles.iconBtn, !canUndo && { opacity: 0.35 }]}>
              <Ionicons name="arrow-undo" size={22} color="#fff" />
            </Pressable>
            <Pressable testID="editor-redo-button" onPress={redo} disabled={!canRedo} style={[styles.iconBtn, !canRedo && { opacity: 0.35 }]}>
              <Ionicons name="arrow-redo" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.canvasWrap}
          onLayout={(e) => setContainerSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          {...pan.panHandlers}
        >
          <ViewShot
            ref={shotRef as any}
            style={[
              styles.shotArea,
              { left: displayed.x, top: displayed.y, width: displayed.w, height: displayed.h },
            ]}
            options={{ format: "jpg", quality: 0.92 }}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              onLoad={(e) => {
                const src = e.nativeEvent.source;
                if (src && src.width && src.height && (!imageDims.w || imageDims.w === 1080)) {
                  setImageDims({ w: src.width, h: src.height });
                }
              }}
              resizeMode="cover"
            />
            <Svg
              width={displayed.w}
              height={displayed.h}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <G transform={`translate(${-displayed.x} ${-displayed.y})`}>
                {[...elements, ...(draft ? [draft] : [])].map((el) => renderElement(el))}
              </G>
            </Svg>

            {/* GPS stamp overlay (inside captured area) */}
            {stampText ? (
              <View
                style={[styles.stamp, { left: 8, bottom: 8 }]}
                pointerEvents="none"
                testID="gps-stamp-overlay"
              >
                <Text style={styles.stampText}>{stampText}</Text>
              </View>
            ) : null}

            {/* Watermark overlay */}
            {watermarkLines.length > 0 ? (
              <View style={[styles.watermark]} pointerEvents="none" testID="watermark-overlay">
                {watermarkLines.map((line, i) => (
                  <Text key={i} style={styles.watermarkText}>{line}</Text>
                ))}
              </View>
            ) : null}
          </ViewShot>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" }}
          >
            {TOOL_LIST.map((t) => (
              <Pressable
                key={t.tool}
                testID={`tool-${t.tool}`}
                onPress={() => setTool(t.tool)}
                style={[styles.toolBtn, { borderColor: tool === t.tool ? annotationPalette[color] : "rgba(255,255,255,0.15)", backgroundColor: tool === t.tool ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.35)" }]}
              >
                <Ionicons name={t.icon} size={20} color="#fff" />
                <Text style={styles.toolLabel}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.colorRow}>
            {COLOR_ORDER.map((c) => (
              <Pressable
                key={c}
                testID={`color-${c}`}
                onPress={() => setColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: annotationPalette[c], borderColor: color === c ? "#fff" : "rgba(255,255,255,0.2)" },
                ]}
              />
            ))}

            <View style={{ flex: 1 }} />

            {tool === "text" ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["S", "M", "L"] as Size[]).map((s) => (
                  <Pressable
                    key={s}
                    testID={`text-size-${s}`}
                    onPress={() => setSize(s)}
                    style={[styles.sizeBtn, size === s && { backgroundColor: "rgba(255,255,255,0.2)" }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {tool === "freedraw" ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[2, 4, 8].map((w) => (
                  <Pressable
                    key={w}
                    testID={`stroke-${w}`}
                    onPress={() => setStrokeWidth(w)}
                    style={[styles.sizeBtn, strokeWidth === w && { backgroundColor: "rgba(255,255,255,0.2)" }]}
                  >
                    <View style={{ width: 14, height: w, backgroundColor: "#fff", borderRadius: w / 2 }} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              testID="editor-notes-button"
              onPress={() => setShowNotes(true)}
              style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>Notes{notes ? " •" : ""}</Text>
            </Pressable>
            <Pressable
              testID="editor-save-button"
              onPress={save}
              disabled={saving}
              style={[styles.actionBtn, styles.actionPrimary, saving && { opacity: 0.6 }]}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.actionText}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Text input modal */}
      <Modal visible={!!textModal} transparent animationType="fade" onRequestClose={() => setTextModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Add Text</Text>
            <TextInput
              testID="text-input-field"
              autoFocus
              value={textModal?.value ?? ""}
              onChangeText={(v) => setTextModal((s) => (s ? { ...s, value: v } : s))}
              placeholder="Enter text"
              placeholderTextColor={colors.onSurfaceMuted}
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.outline }]}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable testID="text-cancel-button" onPress={() => setTextModal(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.onSurfaceMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable testID="text-add-button" onPress={commitTextModal} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notes modal */}
      <Modal visible={showNotes} transparent animationType="slide" onRequestClose={() => setShowNotes(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, minHeight: 240 }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Observation Notes</Text>
            <TextInput
              testID="observation-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="Describe the observation..."
              placeholderTextColor={colors.onSurfaceMuted}
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.outline, minHeight: 120 }]}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable testID="notes-done-button" onPress={() => setShowNotes(false)} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function renderElement(el: Element) {
  switch (el.type) {
    case "text":
      return (
        <SvgText
          key={el.id}
          x={el.x}
          y={el.y}
          fill={el.color}
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={el.size === "L" ? 0.8 : 0.5}
          fontSize={SIZE_PX[el.size]}
          fontWeight="700"
        >
          {el.text}
        </SvgText>
      );
    case "circle":
      return (
        <Circle key={el.id} cx={el.cx} cy={el.cy} r={el.r} stroke={el.color} strokeWidth={3} fill="none" />
      );
    case "arrow": {
      const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const headLen = 14;
      const a = angle - Math.PI / 7;
      const b = angle + Math.PI / 7;
      const hx1 = el.x2 - headLen * Math.cos(a);
      const hy1 = el.y2 - headLen * Math.sin(a);
      const hx2 = el.x2 - headLen * Math.cos(b);
      const hy2 = el.y2 - headLen * Math.sin(b);
      return (
        <G key={el.id}>
          <Line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.color} strokeWidth={3} strokeLinecap="round" />
          <Polygon points={`${el.x2},${el.y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={el.color} />
        </G>
      );
    }
    case "rectangle":
      return (
        <Rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} stroke={el.color} strokeWidth={3} fill="none" />
      );
    case "freedraw":
      return (
        <Path key={el.id} d={el.d} stroke={el.color} strokeWidth={el.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      );
    case "marker":
      return (
        <G key={el.id}>
          <Circle cx={el.x} cy={el.y} r={14} fill={el.color} stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} />
          <SvgText x={el.x} y={el.y + 5} fontSize={14} fontWeight="700" fill="#000" textAnchor="middle">
            {el.n}
          </SvgText>
        </G>
      );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    marginHorizontal: 2,
  },
  headerNum: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  canvasWrap: { flex: 1, backgroundColor: "#000" },
  shotArea: { position: "absolute", backgroundColor: "#000", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  stamp: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    maxWidth: "70%",
  },
  stampText: { color: "#fff", fontSize: 10, fontFamily: "monospace" },
  watermark: { position: "absolute", top: 8, right: 8, alignItems: "flex-end" },
  watermarkText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  toolbarWrap: { backgroundColor: "rgba(0,0,0,0.55)", paddingTop: spacing.sm, paddingBottom: spacing.sm },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  toolLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  sizeBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: radius.full,
  },
  actionPrimary: { backgroundColor: "#0A2463" },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
