import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/tokens";

type Flash = "off" | "on" | "auto";
type Facing = "back" | "front";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function CameraScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<Facing>("back");
  const [flash, setFlash] = useState<Flash>("off");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(0); // 0..1 for expo-camera
  const zoomSV = useSharedValue(0); // live, worklet-side value
  const savedZoom = useSharedValue(0);

  // Bridge shared value → React state at most ~10×/sec to avoid
  // thrashing the native CameraView (which crashes on rapid prop updates).
  const lastBridgedRef = useRef(0);
  const bridgeZoom = (v: number) => {
    const now = Date.now();
    if (now - lastBridgedRef.current < 100) return;
    lastBridgedRef.current = now;
    setZoom(v);
  };
  useAnimatedReaction(
    () => zoomSV.value,
    (v, prev) => {
      if (prev !== null && Math.abs(v - (prev ?? 0)) < 0.01) return;
      runOnJS(bridgeZoom)(v);
    },
  );

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedZoom.value = zoomSV.value;
    })
    .onUpdate((e) => {
      const next = clamp(savedZoom.value + (e.scale - 1) * 0.25, 0, 1);
      zoomSV.value = next;
    })
    .onEnd(() => {
      runOnJS(setZoom)(zoomSV.value);
    });

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={["top","bottom","left","right"]}>
        <Ionicons name="camera-outline" size={48} color={colors.onSurfaceMuted} />
        <Text style={{ color: colors.onSurface, fontSize: 16, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.xl }}>
          We need camera access to capture field observations.
        </Text>
        <Pressable
          testID="grant-camera-permission-button"
          onPress={requestPermission}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: spacing.lg }]}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Grant Camera Access</Text>
        </Pressable>
        <Pressable testID="camera-back-button" onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.onSurfaceMuted }}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, skipProcessing: false });
      if (photo?.uri) {
        router.replace({ pathname: "/editor", params: { uri: photo.uri, width: String(photo.width ?? 0), height: String(photo.height ?? 0) } });
      } else {
        toast.show("Capture failed", { kind: "error" });
      }
    } catch (e: any) {
      toast.show("Capture error: " + (e?.message ?? "unknown"), { kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const cycleFlash = () => {
    setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"));
  };

  const pickFromGallery = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require so the screen still works if module evaluation fails
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show("Photos permission denied", { kind: "error" });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions
          ? ImagePicker.MediaTypeOptions.Images
          : "images",
        quality: 1,
        exif: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        router.replace({
          pathname: "/editor",
          params: { uri: a.uri, width: String(a.width ?? 0), height: String(a.height ?? 0) },
        });
      }
    } catch (e: any) {
      toast.show("Picker error: " + (e?.message ?? "unknown"), { kind: "error" });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <GestureDetector gesture={pinch}>
        <Animated.View style={StyleSheet.absoluteFill} collapsable={false}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            flash={flash}
            zoom={zoom}
            testID="camera-view"
          />
        </Animated.View>
      </GestureDetector>
      <SafeAreaView style={styles.overlay} edges={["top","bottom","left","right"]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable testID="close-camera-button" onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <View style={styles.zoomPill} pointerEvents="none">
            <Text style={styles.zoomText}>{(1 + zoom * 9).toFixed(1)}x</Text>
          </View>
          <Pressable testID="toggle-flash-button" onPress={cycleFlash} style={styles.topBtn}>
            <Ionicons
              name={flash === "off" ? "flash-off" : flash === "on" ? "flash" : "flash-outline"}
              size={22}
              color="#fff"
            />
            <Text style={styles.topLabel}>{flash.toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Zoom slider buttons for users who can't pinch easily */}
        <View style={styles.zoomBar} pointerEvents="box-none">
          {[0, 0.25, 0.5, 0.75, 1].map((z) => (
            <Pressable
              key={z}
              testID={`zoom-${Math.round((1 + z * 9))}x`}
              onPress={() => {
                setZoom(z);
                zoomSV.value = z;
                savedZoom.value = z;
              }}
              style={[
                styles.zoomChip,
                Math.abs(zoom - z) < 0.05 && { backgroundColor: "rgba(255,255,255,0.25)", borderColor: "#fff" },
              ]}
            >
              <Text style={styles.zoomChipText}>{Math.round(1 + z * 9)}x</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.bottomBar}>
          <Pressable testID="pick-from-gallery-button" onPress={pickFromGallery} style={styles.sideBtn}>
            <Ionicons name="images-outline" size={26} color="#fff" />
          </Pressable>
          <Pressable
            testID="shutter-button"
            onPress={takePhoto}
            disabled={busy}
            style={[styles.shutter, busy && { opacity: 0.6 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable testID="flip-camera-button" onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} style={styles.sideBtn}>
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  primaryBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    minWidth: 56,
    height: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.full,
  },
  topLabel: { color: "#fff", fontSize: 11, fontWeight: "600" },
  zoomPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  zoomText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  zoomBar: {
    position: "absolute",
    bottom: 130,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  zoomChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  zoomChipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sideBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: "rgba(0,0,0,0.4)" },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
});
