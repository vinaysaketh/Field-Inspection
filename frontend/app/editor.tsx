import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
import { captureRef } from "react-native-view-shot";

import { useToast } from "@/src/components/Toast";
import { addObservation, nextObservationNumber } from "@/src/store/observations";
import { loadSettings } from "@/src/store/settings";
import { AppSettings, LocationData, Observation } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { annotationPalette, radius, spacing } from "@/src/theme/tokens";
import { formatLocationStamp, getCurrentLocation, queueForGeocoding } from "@/src/utils/location";

type Tool = "select" | "text" | "circle" | "arrow" | "rectangle" | "freedraw" | "marker";
type ColorName = keyof typeof annotationPalette;
type Size = "S" | "M" | "L";

type TextEl = { id: string; type: "text"; x: number; y: number; text: string; color: string; size: Size };
type CircleEl = { id: string; type: "circle"; cx: number; cy: number; r: number; color: string };
type ArrowEl = { id: string; type: "arrow"; x1: number; y1: number; x2: number; y2: number; color: string };
type RectEl = { id: string; type: "rectangle"; x: number; y: number; w: number; h: number; color: string };
type FreeEl = { id: string; type: "freedraw"; d: string; color: string; strokeWidth: number };
type MarkerEl = { id: string; type: "marker"; x: number; y: number; n: number; color: string };
type Element = TextEl | CircleEl | ArrowEl | RectEl | FreeEl | MarkerEl;

const TOOL_LIST: { tool: Tool; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { tool: "select", icon: "hand-left-outline", label: "Move" },
  { tool: "text", icon: "text", label: "Text" },
  { tool: "circle", icon: "ellipse-outline", label: "Circle" },
  { tool: "arrow", icon: "arrow-forward", label: "Arrow" },
  { tool: "rectangle", icon: "square-outline", label: "Rect" },
  { tool: "freedraw", icon: "brush", label: "Draw" },
  { tool: "marker", icon: "location", label: "Marker" },
];

const SIZE_PX: Record<Size, number> = { S: 18, M: 26, L: 36 };
const COLOR_ORDER: ColorName[] = ["red", "yellow", "white", "green", "blue"];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// Hit-testing for select tool
function hitTest(elements: Element[], px: number, py: number): Element | null {
  // iterate top-to-bottom (last drawn first)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === "text") {
      const fs = SIZE_PX[el.size];
      const w = (el.text.length * fs) * 0.6;
      if (px >= el.x - 4 && px <= el.x + w + 4 && py >= el.y - fs && py <= el.y + 4) return el;
    } else if (el.type === "circle") {
      const d = Math.hypot(px - el.cx, py - el.cy);
      if (Math.abs(d - el.r) <= 14 || d <= 18) return el;
    } else if (el.type === "arrow") {
      // distance from segment
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - el.x1) * dx + (py - el.y1) * dy) / len2));
      const cx = el.x1 + t * dx, cy = el.y1 + t * dy;
      if (Math.hypot(px - cx, py - cy) <= 16) return el;
    } else if (el.type === "rectangle") {
      if (px >= el.x - 8 && px <= el.x + el.w + 8 && py >= el.y - 8 && py <= el.y + el.h + 8) return el;
    } else if (el.type === "marker") {
      if (Math.hypot(px - el.x, py - el.y) <= 18) return el;
    } else if (el.type === "freedraw") {
      // sample first/last points crudely
      const m = /M([\d.]+) ([\d.]+)/.exec(el.d);
      if (m && Math.hypot(px - parseFloat(m[1]), py - parseFloat(m[2])) <= 18) return el;
    }
  }
  return null;
}

function moveElement(el: Element, dx: number, dy: number): Element {
  switch (el.type) {
    case "text":
    case "marker":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "circle":
      return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case "arrow":
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "rectangle":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "freedraw":
      // shift all coords in path string
      const shifted = el.d.replace(/([ML])([\d.]+) ([\d.]+)/g, (_m, cmd, sx, sy) => {
        const nx = (parseFloat(sx) + dx).toFixed(1);
        const ny = (parseFloat(sy) + dy).toFixed(1);
        return `${cmd}${nx} ${ny}`;
      });
      return { ...el, d: shifted };
  }
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

  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<ColorName>("yellow");
  const [size, setSize] = useState<Size>("M");
  const [strokeWidth, setStrokeWidth] = useState(4);

  // History
  const [history, setHistory] = useState<Element[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const elements = history[historyIdx];

  const [draft, setDraft] = useState<Element | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markerCounterRef = useRef(0);

  // Modal state
  const [textModal, setTextModal] = useState<{ x: number; y: number; value: string; editingId?: string } | null>(null);

  // Location & save
  const [loc, setLoc] = useState<LocationData | null>(null);
  const [obsNumber, setObsNumber] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Container sizing → letterboxed image rect
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const displayed = useMemo(() => {
    const cw = containerSize.w, ch = containerSize.h;
    const iw = imageDims.w || 1, ih = imageDims.h || 1;
    const scaleFit = Math.min(cw / iw, ch / ih);
    const w = iw * scaleFit, h = ih * scaleFit;
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h, scaleFit };
  }, [containerSize, imageDims]);

  // Zoom transform (shared values)
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Convert outer (container-relative) touch coords → logical canvas coords
  // (logical = unscaled coordinate inside the displayed image rect)
  // Reverses: screen = center + s*(content - center) + (tx, ty)
  const toLogicalJS = (sx: number, sy: number) => {
    const cx = displayed.x + displayed.w / 2;
    const cy = displayed.y + displayed.h / 2;
    const lx = (sx - tx.value - cx) / scale.value + cx;
    const ly = (sy - ty.value - cy) / scale.value + cy;
    return { x: lx, y: ly };
  };

  // -------- Gestures --------
  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = Math.max(1, Math.min(5, savedScale.value * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan2 = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  // ----- Drawing / selection gesture (1 finger) -----
  const draftStart = useRef<{ x: number; y: number; id?: string } | null>(null);
  const moveStartRef = useRef<{ x: number; y: number; el: Element } | null>(null);

  const beginDraw = (sx: number, sy: number) => {
    const p = toLogicalJS(sx, sy);
    if (p.x < displayed.x || p.x > displayed.x + displayed.w || p.y < displayed.y || p.y > displayed.y + displayed.h) {
      return;
    }
    if (tool === "select") {
      const hit = hitTest(elements, p.x, p.y);
      if (hit) {
        setSelectedId(hit.id);
        moveStartRef.current = { x: p.x, y: p.y, el: hit };
      } else {
        setSelectedId(null);
        moveStartRef.current = null;
      }
      return;
    }
    // For non-select tools, tap on an existing text element re-opens edit modal
    if (tool === "text") {
      const hit = hitTest(elements, p.x, p.y);
      if (hit && hit.type === "text") {
        setTextModal({ x: hit.x, y: hit.y, value: hit.text, editingId: hit.id });
        setSelectedId(hit.id);
        return;
      }
      setTextModal({ x: p.x, y: p.y, value: "" });
      return;
    }
    if (tool === "marker") {
      markerCounterRef.current += 1;
      const el: MarkerEl = {
        id: genId(),
        type: "marker",
        x: p.x,
        y: p.y,
        n: markerCounterRef.current,
        color: annotationPalette[color],
      };
      pushHistory([...elements, el]);
      return;
    }
    draftStart.current = { x: p.x, y: p.y };
    if (tool === "freedraw") {
      setDraft({
        id: genId(),
        type: "freedraw",
        d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
        color: annotationPalette[color],
        strokeWidth,
      });
    } else if (tool === "circle") {
      setDraft({ id: genId(), type: "circle", cx: p.x, cy: p.y, r: 0, color: annotationPalette[color] });
    } else if (tool === "arrow") {
      setDraft({ id: genId(), type: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: annotationPalette[color] });
    } else if (tool === "rectangle") {
      setDraft({ id: genId(), type: "rectangle", x: p.x, y: p.y, w: 0, h: 0, color: annotationPalette[color] });
    }
  };

  const updateDraw = (sx: number, sy: number) => {
    const p = toLogicalJS(sx, sy);
    if (tool === "select" && moveStartRef.current && selectedId) {
      const start = moveStartRef.current;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      // optimistic in-place update on the current history slot
      const moved = moveElement(start.el, dx, dy);
      const next = elements.map((e) => (e.id === selectedId ? moved : e));
      // replace current slot to avoid history thrash
      const trimmed = history.slice(0, historyIdx + 1);
      trimmed[historyIdx] = next;
      setHistory(trimmed);
      return;
    }
    setDraft((d) => {
      if (!d) return d;
      if (d.type === "freedraw") return { ...d, d: d.d + ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}` };
      if (d.type === "circle") return { ...d, r: Math.hypot(p.x - d.cx, p.y - d.cy) };
      if (d.type === "arrow") return { ...d, x2: p.x, y2: p.y };
      if (d.type === "rectangle") return { ...d, w: p.x - d.x, h: p.y - d.y };
      return d;
    });
  };

  const endDraw = () => {
    if (tool === "select" && moveStartRef.current) {
      // Commit moved state as a new history step
      moveStartRef.current = null;
      const next = elements.slice();
      const trimmed2 = history.slice(0, historyIdx + 1);
      trimmed2.push(next);
      setHistory(trimmed2);
      setHistoryIdx(trimmed2.length - 1);
      return;
    }
    setDraft((d) => {
      if (d) {
        let final = d;
        if (d.type === "rectangle") {
          final = {
            ...d,
            x: Math.min(d.x, d.x + d.w),
            y: Math.min(d.y, d.y + d.h),
            w: Math.abs(d.w),
            h: Math.abs(d.h),
          };
        }
        if (d.type === "circle" && d.r < 6) return null;
        if (d.type === "arrow" && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 8) return null;
        if (d.type === "rectangle" && (Math.abs(d.w) < 8 || Math.abs(d.h) < 8)) return null;
        pushHistory([...elements, final]);
      }
      return null;
    });
    draftStart.current = null;
  };

  const drawGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(beginDraw)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(updateDraw)(e.x, e.y);
    })
    .onEnd(() => {
      runOnJS(endDraw)();
    });

  const composed = Gesture.Race(Gesture.Simultaneous(pinch, pan2), drawGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // -------- History helpers --------
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

  // -------- Load location & obs number --------
  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const num = await nextObservationNumber();
      setObsNumber(num);
      setTitle(num);
      if (s.gpsEnabled) {
        const l = await getCurrentLocation();
        setLoc(l);
      }
    })();
  }, []);

  // -------- Text modal commit --------
  const commitTextModal = () => {
    if (!textModal) return;
    const v = textModal.value.trim();
    if (textModal.editingId) {
      if (!v) {
        // empty = delete
        pushHistory(elements.filter((e) => e.id !== textModal.editingId));
      } else {
        const next = elements.map((e) =>
          e.id === textModal.editingId && e.type === "text"
            ? { ...e, text: v, color: annotationPalette[color], size }
            : e,
        );
        pushHistory(next);
      }
    } else if (v) {
      const el: TextEl = {
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

  // -------- Save --------
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
    // Reset zoom & clear selection BEFORE capture; iOS refuses to snapshot a
    // view with an active transform (`drawViewHierarchyInRect` fails). Give
    // RN a couple of frames to commit the layout before we capture.
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 80));
    try {
      const captured = await captureRef(shotRef as any, {
        format: "jpg",
        quality: 0.95,
        result: "tmpfile",
      });
      const dir = `${FileSystem.documentDirectory}observations/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const dest = `${dir}${obsNumber}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: captured, to: dest });

      const obs: Observation = {
        id: genId(),
        number: obsNumber,
        title: title.trim() || obsNumber,
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
      // Best-effort: also save annotated image to the device Photos library.
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.granted) {
          await MediaLibrary.saveToLibraryAsync(dest);
        }
      } catch (e) {
        console.warn("MediaLibrary save failed", e);
      }
      toast.show(`${obs.title} saved`, { kind: "success" });
      router.replace({ pathname: "/observation", params: { id: obs.id } });
    } catch (e: any) {
      toast.show("Save failed: " + (e?.message ?? "unknown"), { kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Reset zoom helper
  const resetZoom = () => {
    scale.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
  };

  // Selected element delete (FAB)
  const deleteSelected = () => {
    if (!selectedId) return;
    pushHistory(elements.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  };

  // Edit selected text shortcut
  const editSelectedText = () => {
    const el = elements.find((e) => e.id === selectedId);
    if (el && el.type === "text") {
      setColor((Object.keys(annotationPalette) as ColorName[]).find((k) => annotationPalette[k] === el.color) ?? "yellow");
      setSize(el.size);
      setTextModal({ x: el.x, y: el.y, value: el.text, editingId: el.id });
    }
  };

  if (!imageUri) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.onSurface, padding: spacing.lg }}>No image provided.</Text>
      </View>
    );
  }

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable testID="editor-close-button" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Pressable
            testID="editor-title-button"
            onPress={() => setShowTitleModal(true)}
            style={styles.titleBtn}
          >
            <Text style={styles.headerNum} numberOfLines={1}>
              {title || obsNumber}
            </Text>
            <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable testID="editor-zoom-reset" onPress={resetZoom} style={styles.iconBtn}>
              <Ionicons name="contract-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable testID="editor-undo-button" onPress={undo} disabled={!canUndo} style={[styles.iconBtn, !canUndo && { opacity: 0.35 }]}>
              <Ionicons name="arrow-undo" size={22} color="#fff" />
            </Pressable>
            <Pressable testID="editor-redo-button" onPress={redo} disabled={!canRedo} style={[styles.iconBtn, !canRedo && { opacity: 0.35 }]}>
              <Ionicons name="arrow-redo" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <GestureDetector gesture={composed}>
          <View
            style={styles.canvasWrap}
            onLayout={(e) => setContainerSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            collapsable={false}
          >
            <Animated.View
              style={[
                { position: "absolute", left: displayed.x, top: displayed.y, width: displayed.w, height: displayed.h },
                animatedStyle,
              ]}
              collapsable={false}
            >
              <View
                ref={shotRef as any}
                style={[styles.shotArea, { width: displayed.w, height: displayed.h }]}
                collapsable={false}
              >
                <ExpoImage
                  source={{ uri: imageUri }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  onLoad={(e) => {
                    const src = e?.source;
                    if (src?.width && src?.height && (imageDims.w === 1080 || imageDims.h === 1440)) {
                      setImageDims({ w: src.width, h: src.height });
                    }
                  }}
                />
                <Svg
                  width={displayed.w}
                  height={displayed.h}
                  style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
                >
                  <G transform={`translate(${-displayed.x} ${-displayed.y})`}>
                    {[...elements, ...(draft ? [draft] : [])].map((el) =>
                      renderElement(el, el.id === selectedId),
                    )}
                  </G>
                </Svg>

                {stampText ? (
                  <View
                    style={[styles.stamp, { left: 8, bottom: 8 }]}
                    pointerEvents="none"
                    testID="gps-stamp-overlay"
                  >
                    <Text style={styles.stampText}>{stampText}</Text>
                  </View>
                ) : null}

                {watermarkLines.length > 0 ? (
                  <View style={styles.watermark} pointerEvents="none" testID="watermark-overlay">
                    {watermarkLines.map((line, i) => (
                      <Text key={i} style={styles.watermarkText}>{line}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Selected element quick actions */}
        {selectedEl ? (
          <View style={styles.selectionBar} testID="selection-toolbar">
            <Text style={styles.selectionLabel}>
              {selectedEl.type.toUpperCase()} selected
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {selectedEl.type === "text" ? (
                <Pressable testID="edit-text-button" onPress={editSelectedText} style={styles.selBtn}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.selBtnText}>Edit</Text>
                </Pressable>
              ) : null}
              <Pressable testID="delete-selected-button" onPress={deleteSelected} style={[styles.selBtn, { backgroundColor: "rgba(255,80,80,0.25)" }]}>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.selBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
                onPress={() => {
                  setTool(t.tool);
                  if (t.tool !== "select") setSelectedId(null);
                }}
                style={[
                  styles.toolBtn,
                  {
                    borderColor: tool === t.tool ? annotationPalette[color] : "rgba(255,255,255,0.15)",
                    backgroundColor: tool === t.tool ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.35)",
                  },
                ]}
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
                    style={[styles.sizeBtn, size === s && { backgroundColor: "rgba(255,255,255,0.25)" }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{s}</Text>
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
                    style={[styles.sizeBtn, strokeWidth === w && { backgroundColor: "rgba(255,255,255,0.25)" }]}
                  >
                    <View style={{ width: 14, height: w, backgroundColor: "#fff", borderRadius: w / 2 }} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.hintRow}>
            <Ionicons name="information-circle-outline" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.hintText}>
              {tool === "select"
                ? "Tap to select • Drag to move"
                : tool === "text"
                ? "Tap to add • Tap existing text to edit"
                : "Pinch with 2 fingers to zoom"}
            </Text>
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

      {/* Title rename modal */}
      <Modal visible={showTitleModal} transparent animationType="fade" onRequestClose={() => setShowTitleModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Rename observation</Text>
            <TextInput
              testID="title-input-field"
              autoFocus
              value={title}
              onChangeText={setTitle}
              placeholder={obsNumber}
              placeholderTextColor={colors.onSurfaceMuted}
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.outline }]}
            />
            <Text style={{ color: colors.onSurfaceMuted, fontSize: 12 }}>
              The observation number ({obsNumber}) stays the same; this is just a display name.
            </Text>
            <View style={styles.modalActions}>
              <Pressable testID="title-reset-button" onPress={() => setTitle(obsNumber)} style={styles.modalBtn}>
                <Text style={{ color: colors.onSurfaceMuted, fontWeight: "600" }}>Reset</Text>
              </Pressable>
              <Pressable testID="title-done-button" onPress={() => setShowTitleModal(false)} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Text input modal */}
      <Modal visible={!!textModal} transparent animationType="fade" onRequestClose={() => setTextModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
              {textModal?.editingId ? "Edit Text" : "Add Text"}
            </Text>
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
            <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
              {(["S", "M", "L"] as Size[]).map((s) => (
                <Pressable
                  key={s}
                  testID={`modal-size-${s}`}
                  onPress={() => setSize(s)}
                  style={[styles.modalSizeBtn, { borderColor: size === s ? colors.primary : colors.outline }]}
                >
                  <Text style={{ color: size === s ? colors.primary : colors.onSurface, fontWeight: "700" }}>{s}</Text>
                </Pressable>
              ))}
              <View style={{ flex: 1 }} />
              {COLOR_ORDER.map((c) => (
                <Pressable
                  key={c}
                  testID={`modal-color-${c}`}
                  onPress={() => setColor(c)}
                  style={[
                    styles.modalColorDot,
                    { backgroundColor: annotationPalette[c], borderColor: color === c ? colors.onSurface : colors.outline },
                  ]}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable testID="text-cancel-button" onPress={() => setTextModal(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.onSurfaceMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable testID="text-add-button" onPress={commitTextModal} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>
                  {textModal?.editingId ? "Update" : "Add"}
                </Text>
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

// Hint to silence "Image is unused" if linter complains

function renderElement(el: Element, selected: boolean) {
  const halo = selected ? <SelectionHalo el={el} /> : null;
  switch (el.type) {
    case "text":
      return (
        <G key={el.id}>
          {halo}
          <SvgText
            x={el.x}
            y={el.y}
            fill={el.color}
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={el.size === "L" ? 1 : 0.6}
            fontSize={SIZE_PX[el.size]}
            fontWeight="700"
          >
            {el.text}
          </SvgText>
        </G>
      );
    case "circle":
      return (
        <G key={el.id}>
          {halo}
          <Circle cx={el.cx} cy={el.cy} r={el.r} stroke={el.color} strokeWidth={3} fill="none" />
        </G>
      );
    case "arrow": {
      const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const headLen = 16;
      const a = angle - Math.PI / 7;
      const b = angle + Math.PI / 7;
      const hx1 = el.x2 - headLen * Math.cos(a);
      const hy1 = el.y2 - headLen * Math.sin(a);
      const hx2 = el.x2 - headLen * Math.cos(b);
      const hy2 = el.y2 - headLen * Math.sin(b);
      return (
        <G key={el.id}>
          {halo}
          <Line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.color} strokeWidth={3.5} strokeLinecap="round" />
          <Polygon points={`${el.x2},${el.y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={el.color} />
        </G>
      );
    }
    case "rectangle":
      return (
        <G key={el.id}>
          {halo}
          <Rect x={el.x} y={el.y} width={el.w} height={el.h} stroke={el.color} strokeWidth={3} fill="none" />
        </G>
      );
    case "freedraw":
      return (
        <G key={el.id}>
          {halo}
          <Path d={el.d} stroke={el.color} strokeWidth={el.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case "marker":
      return (
        <G key={el.id}>
          {halo}
          <Circle cx={el.x} cy={el.y} r={16} fill={el.color} stroke="rgba(0,0,0,0.6)" strokeWidth={1.5} />
          <SvgText x={el.x} y={el.y + 6} fontSize={16} fontWeight="700" fill="#000" textAnchor="middle">
            {el.n}
          </SvgText>
        </G>
      );
  }
}

function SelectionHalo({ el }: { el: Element }) {
  // Lightweight highlight ring around an element so the user knows it's selected
  const stroke = "rgba(140, 200, 255, 0.9)";
  if (el.type === "text") {
    const fs = SIZE_PX[el.size];
    const w = el.text.length * fs * 0.6 + 8;
    return (
      <Rect x={el.x - 4} y={el.y - fs} width={w} height={fs + 8} stroke={stroke} strokeDasharray="4 3" strokeWidth={1.5} fill="none" />
    );
  }
  if (el.type === "circle") {
    return <Circle cx={el.cx} cy={el.cy} r={el.r + 8} stroke={stroke} strokeDasharray="4 3" strokeWidth={1.5} fill="none" />;
  }
  if (el.type === "rectangle") {
    return <Rect x={el.x - 6} y={el.y - 6} width={el.w + 12} height={el.h + 12} stroke={stroke} strokeDasharray="4 3" strokeWidth={1.5} fill="none" />;
  }
  if (el.type === "arrow") {
    const minX = Math.min(el.x1, el.x2) - 10;
    const maxX = Math.max(el.x1, el.x2) + 10;
    const minY = Math.min(el.y1, el.y2) - 10;
    const maxY = Math.max(el.y1, el.y2) + 10;
    return <Rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} stroke={stroke} strokeDasharray="4 3" strokeWidth={1.5} fill="none" />;
  }
  if (el.type === "marker") {
    return <Circle cx={el.x} cy={el.y} r={22} stroke={stroke} strokeDasharray="4 3" strokeWidth={1.5} fill="none" />;
  }
  return null;
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
  titleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    maxWidth: 200,
  },
  canvasWrap: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  shotArea: { backgroundColor: "#000", overflow: "hidden" },
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
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "600",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(140,200,255,0.18)",
    borderTopWidth: 1,
    borderTopColor: "rgba(140,200,255,0.35)",
  },
  selectionLabel: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  selBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  selBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  toolbarWrap: { backgroundColor: "rgba(0,0,0,0.6)", paddingTop: spacing.sm, paddingBottom: spacing.sm },
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
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
  },
  hintText: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
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
  modalSizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  modalColorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
});
