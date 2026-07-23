import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import { SUPPORT_EMAIL, APP_NAME } from "@/src/constants";
import { loadSettings, saveSettings } from "@/src/store/settings";
import { resetObservationCounter } from "@/src/store/observations";
import { AppSettings, DEFAULT_SETTINGS, StampTemplate } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import { canUseBiometric, clearPin, hasPin } from "@/src/utils/auth";

const TEMPLATES: { value: StampTemplate; label: string; desc: string }[] = [
  { value: "A", label: "Template A", desc: "Full address + coordinates" },
  { value: "B", label: "Template B", desc: "Village + PIN code" },
  { value: "C", label: "Template C", desc: "Coordinates only" },
  { value: "D", label: "Template D", desc: "Custom (use {date}, {village}, {lat}, {lon}, {pin}, etc.)" },
];

export default function Settings() {
  const { colors, scheme, mode, setMode } = useTheme();
  const toast = useToast();
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [pinExists, setPinExists] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);

  useEffect(() => {
    (async () => {
      const cur = await loadSettings();
      setS(cur);
      setPinExists(await hasPin());
      setBioAvail(await canUseBiometric());
    })();
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveSettings(next);
  };

  const onResetCounter = async () => {
    await resetObservationCounter();
    toast.show("Counter reset to 0", { kind: "success" });
  };

  const onTogglePinSetup = async (val: boolean) => {
    if (val) {
      router.push("/pin-setup");
    } else {
      await clearPin();
      setPinExists(false);
      await update({ appLockEnabled: false, biometricEnabled: false });
      toast.show("App lock disabled", { kind: "info" });
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="settings-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        <Section title="LOCATION" colors={colors}>
          <Row colors={colors}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>GPS Stamp</Text>
              <Text style={[styles.rowDesc, { color: colors.onSurfaceMuted }]}>Embed location on captured images</Text>
            </View>
            <Switch
              testID="settings-gps-toggle"
              value={s.gpsEnabled}
              onValueChange={(v) => update({ gpsEnabled: v })}
              trackColor={{ true: colors.primary, false: colors.outline }}
            />
          </Row>

          {s.gpsEnabled ? (
            <>
              {TEMPLATES.map((t) => (
                <Pressable
                  key={t.value}
                  testID={`template-${t.value}`}
                  onPress={() => update({ stampTemplate: t.value })}
                  style={[styles.tplRow, { borderColor: s.stampTemplate === t.value ? colors.primary : colors.outline }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.onSurface }]}>{t.label}</Text>
                    <Text style={[styles.rowDesc, { color: colors.onSurfaceMuted }]}>{t.desc}</Text>
                  </View>
                  {s.stampTemplate === t.value ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <View style={[styles.radio, { borderColor: colors.outline }]} />
                  )}
                </Pressable>
              ))}
              {s.stampTemplate === "D" ? (
                <TextInput
                  testID="custom-template-input"
                  value={s.customTemplate}
                  onChangeText={(v) => update({ customTemplate: v })}
                  multiline
                  style={[styles.input, { borderColor: colors.outline, color: colors.onSurface, minHeight: 80, textAlignVertical: "top" }]}
                />
              ) : null}
            </>
          ) : null}
        </Section>

        <Section title="COMPANY INFO" colors={colors}>
          <Field testID="company-name-input" label="Company Name" value={s.company} onChange={(v) => update({ company: v })} colors={colors} />
          <Field testID="project-name-input" label="Project Name" value={s.project} onChange={(v) => update({ project: v })} colors={colors} />
          <Field testID="auditor-name-input" label="Auditor Name" value={s.auditor} onChange={(v) => update({ auditor: v })} colors={colors} />
        </Section>

        <Section title="WATERMARK" colors={colors}>
          <ToggleRow testID="wm-company-toggle" label="Company Name" value={s.watermarkCompany} onChange={(v) => update({ watermarkCompany: v })} colors={colors} />
          <ToggleRow testID="wm-auditor-toggle" label="Auditor Name" value={s.watermarkAuditor} onChange={(v) => update({ watermarkAuditor: v })} colors={colors} />
          <ToggleRow testID="wm-obs-toggle" label="Observation Number" value={s.watermarkObsNumber} onChange={(v) => update({ watermarkObsNumber: v })} colors={colors} />
          <ToggleRow testID="wm-date-toggle" label="Date & Time" value={s.watermarkDateTime} onChange={(v) => update({ watermarkDateTime: v })} colors={colors} />
        </Section>

        <Section title="APPEARANCE" colors={colors}>
          <View style={[styles.tplRow, { borderColor: colors.outline, flexDirection: "column", gap: spacing.sm, alignItems: "stretch" }]}>
            <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Theme</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(["system","light","dark"] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`theme-${m}`}
                  onPress={() => setMode(m)}
                  style={[styles.modeBtn, { borderColor: mode === m ? colors.primary : colors.outline, backgroundColor: mode === m ? colors.primaryContainer : "transparent" }]}
                >
                  <Text style={{ color: mode === m ? colors.primary : colors.onSurface, fontWeight: "600" }}>
                    {m === "system" ? "System" : m === "light" ? "Light" : "Dark"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>

        <Section title="SECURITY" colors={colors}>
          <Row colors={colors}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>PIN Lock</Text>
              <Text style={[styles.rowDesc, { color: colors.onSurfaceMuted }]}>
                {pinExists ? "PIN is set — disable to remove" : "Tap to set a 4-digit PIN"}
              </Text>
            </View>
            <Switch
              testID="settings-pin-toggle"
              value={pinExists && s.appLockEnabled}
              onValueChange={(v) => onTogglePinSetup(v)}
              trackColor={{ true: colors.primary, false: colors.outline }}
            />
          </Row>
          {pinExists && s.appLockEnabled ? (
            <ToggleRow
              testID="biometric-toggle"
              label={bioAvail ? "Use Biometric (Face/Fingerprint)" : "Biometric unavailable on this device"}
              value={s.biometricEnabled && bioAvail}
              onChange={(v) => update({ biometricEnabled: v && bioAvail })}
              colors={colors}
              disabled={!bioAvail}
            />
          ) : null}
        </Section>

        <Section title="OBSERVATIONS" colors={colors}>
          <Pressable testID="reset-counter-button" onPress={onResetCounter} style={[styles.tplRow, { borderColor: colors.outline }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Reset Observation Counter</Text>
              <Text style={[styles.rowDesc, { color: colors.onSurfaceMuted }]}>Next observation will start from OBS-0001</Text>
            </View>
            <Ionicons name="refresh" size={20} color={colors.onSurfaceMuted} />
          </Pressable>
        </Section>

        <Section title="ABOUT" colors={colors}>
          <Pressable
            testID="open-privacy-policy"
            onPress={() => router.push("/privacy")}
            style={[styles.tplRow, { borderColor: colors.outline }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Privacy Policy</Text>
              <Text style={[styles.rowDesc, { color: colors.onSurfaceMuted }]}>
                How your data is handled on this device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceMuted} />
          </Pressable>

          <Pressable
            testID="contact-support-button"
            onPress={async () => {
              const subject = encodeURIComponent(`${APP_NAME} Feedback`);
              const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
              try {
                const supported = await Linking.canOpenURL(url);
                if (!supported) {
                  toast.show("No email app configured", { kind: "error" });
                  return;
                }
                await Linking.openURL(url);
              } catch (e: any) {
                toast.show("Couldn't open email: " + (e?.message ?? "unknown"), { kind: "error" });
              }
            }}
            style={[styles.tplRow, { borderColor: colors.outline }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>
                Contact Support / Send Suggestions
              </Text>
              <Text style={[styles.rowDesc, { color: colors.onSurfaceMuted }]}>
                Opens your email app. Report bugs, request features or share ideas.
              </Text>
            </View>
            <Ionicons name="mail-outline" size={20} color={colors.onSurfaceMuted} />
          </Pressable>
        </Section>

        <Text style={{ color: colors.onSurfaceMuted, textAlign: "center", fontSize: 12, marginTop: spacing.md }}>
          FieldSnap Pro • v1.1
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceMuted }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
        {children}
      </View>
    </View>
  );
}

function Row({ colors, children }: { colors: any; children: React.ReactNode }) {
  return <View style={[styles.row, { borderColor: colors.outline }]}>{children}</View>;
}

function ToggleRow({ testID, label, value, onChange, colors, disabled }: any) {
  return (
    <View style={[styles.row, { borderColor: colors.outline, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.rowLabel, { color: colors.onSurface, flex: 1 }]}>{label}</Text>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.outline }}
      />
    </View>
  );
}

function Field({ testID, label, value, onChange, colors }: any) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text style={[styles.rowLabel, { color: colors.onSurfaceMuted, fontSize: 12, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.onSurfaceMuted}
        style={[styles.input, { borderColor: colors.outline, color: colors.onSurface }]}
      />
    </View>
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
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.full, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { ...typography.label, marginBottom: 8, marginLeft: spacing.xs },
  sectionCard: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowDesc: { fontSize: 12, marginTop: 2 },
  tplRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: "center",
  },
});
