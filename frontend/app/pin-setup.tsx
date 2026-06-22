import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import { loadSettings, saveSettings } from "@/src/store/settings";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import { setPin } from "@/src/utils/auth";

export default function PinSetup() {
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");

  useEffect(() => {
    // ensure focus consistent
  }, []);

  const submit = async () => {
    if (step === 1) {
      if (pin1.length < 4) {
        toast.show("PIN must be at least 4 digits", { kind: "error" });
        return;
      }
      setStep(2);
      return;
    }
    if (pin1 !== pin2) {
      toast.show("PINs do not match", { kind: "error" });
      setPin2("");
      return;
    }
    await setPin(pin1);
    const s = await loadSettings();
    await saveSettings({ ...s, appLockEnabled: true });
    toast.show("App lock enabled", { kind: "success" });
    router.back();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right","bottom"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="pin-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Set PIN</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.primary} />
        <Text style={[styles.heading, { color: colors.onSurface }]}>
          {step === 1 ? "Choose a PIN" : "Confirm PIN"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceMuted }]}>
          {step === 1
            ? "Enter at least 4 digits. This unlocks the app."
            : "Re-enter the same PIN to confirm."}
        </Text>
        <TextInput
          testID={step === 1 ? "pin-input-1" : "pin-input-2"}
          value={step === 1 ? pin1 : pin2}
          onChangeText={step === 1 ? setPin1 : setPin2}
          placeholder="••••"
          placeholderTextColor={colors.onSurfaceMuted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          style={[styles.pinInput, { borderColor: colors.outline, color: colors.onSurface }]}
        />
        <Pressable
          testID="pin-submit-button"
          onPress={submit}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>
            {step === 1 ? "Next" : "Save PIN"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, padding: spacing.xl, alignItems: "center", gap: spacing.md, justifyContent: "center" },
  heading: { ...typography.h2 },
  subtitle: { textAlign: "center", fontSize: 14 },
  pinInput: {
    width: "100%",
    maxWidth: 280,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 12,
  },
  primaryBtn: { width: "100%", maxWidth: 280, paddingVertical: 14, borderRadius: radius.full, alignItems: "center" },
});
