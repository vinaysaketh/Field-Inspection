import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/tokens";
import { useToast } from "@/src/components/Toast";

type Flash = "off" | "on" | "auto";
type Facing = "back" | "front";

export default function CameraScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<Facing>("back");
  const [flash, setFlash] = useState<Flash>("off");
  const [busy, setBusy] = useState(false);

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

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        flash={flash}
        testID="camera-view"
      />
      <SafeAreaView style={styles.overlay} edges={["top","bottom","left","right"]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable testID="close-camera-button" onPress={() => router.back()} style={styles.topBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable testID="toggle-flash-button" onPress={cycleFlash} style={styles.topBtn}>
            <Ionicons
              name={flash === "off" ? "flash-off" : flash === "on" ? "flash" : "flash-outline"}
              size={22}
              color="#fff"
            />
            <Text style={styles.topLabel}>{flash.toUpperCase()}</Text>
          </Pressable>
        </View>

        <View style={styles.bottomBar}>
          <Pressable testID="flip-camera-button" onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} style={styles.sideBtn}>
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </Pressable>
          <Pressable
            testID="shutter-button"
            onPress={takePhoto}
            disabled={busy}
            style={[styles.shutter, busy && { opacity: 0.6 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.sideBtn} />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    width: 56,
    height: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.full,
  },
  topLabel: { color: "#fff", fontSize: 11, fontWeight: "600" },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sideBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
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
