import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import { loadSettings } from "@/src/store/settings";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import { authenticateBiometric, canUseBiometric, verifyPin } from "@/src/utils/auth";

export default function Lock() {
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [pin, setPin] = useState("");
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      const can = await canUseBiometric();
      setBiometricEnabled(s.biometricEnabled && can);
      if (s.biometricEnabled && can) {
        const ok = await authenticateBiometric();
        if (ok) router.replace("/");
      }
    })();
  }, []);

  const submit = async () => {
    const ok = await verifyPin(pin);
    if (ok) {
      router.replace("/");
    } else {
      toast.show("Incorrect PIN", { kind: "error" });
      setPin("");
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right","bottom"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.body}>
        <Ionicons name="lock-closed" size={56} color={colors.primary} />
        <Text style={[styles.title, { color: colors.onSurface }]}>FieldSnap Pro</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceMuted }]}>Enter your PIN to continue</Text>
        <TextInput
          testID="lock-pin-input"
          value={pin}
          onChangeText={setPin}
          placeholder="••••"
          placeholderTextColor={colors.onSurfaceMuted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          autoFocus
          style={[styles.pinInput, { borderColor: colors.outline, color: colors.onSurface }]}
        />
        <Pressable
          testID="lock-submit-button"
          onPress={submit}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Unlock</Text>
        </Pressable>

        {biometricEnabled ? (
          <Pressable
            testID="lock-biometric-button"
            onPress={async () => {
              const ok = await authenticateBiometric();
              if (ok) router.replace("/");
            }}
            style={[styles.bioBtn, { borderColor: colors.outline }]}
          >
            <Ionicons name="finger-print" size={22} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Use Biometric</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: spacing.xl, alignItems: "center", gap: spacing.md, justifyContent: "center" },
  title: { ...typography.h2 },
  subtitle: { fontSize: 14 },
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
  bioBtn: {
    flexDirection: "row", gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.xl,
    borderRadius: radius.full, borderWidth: 1,
  },
});
