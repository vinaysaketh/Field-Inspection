import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { APP_DESCRIPTION, APP_NAME, APP_VERSION, PACKAGE_ID, SUPPORT_EMAIL } from "@/src/constants";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";

export default function About() {
  const { colors, scheme } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right","bottom"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="about-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>About</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, alignItems: "center" }}>
        <View style={[styles.iconLarge, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons name="camera" size={44} color={colors.primary} />
        </View>
        <Text style={[styles.appName, { color: colors.onSurface }]}>{APP_NAME}</Text>
        <Text style={[styles.version, { color: colors.onSurfaceMuted }]}>Version {APP_VERSION}</Text>
        <Text style={[styles.desc, { color: colors.onSurfaceMuted }]}>{APP_DESCRIPTION}</Text>

        <View style={{ height: spacing.md }} />

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Text style={[styles.label, { color: colors.onSurfaceMuted }]}>DEVELOPER</Text>
          <Text style={[styles.value, { color: colors.onSurface }]}>Nidamarthi Vinay Saketh</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Text style={[styles.label, { color: colors.onSurfaceMuted }]}>SUPPORT</Text>
          <Text style={[styles.value, { color: colors.onSurface }]}>{SUPPORT_EMAIL}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Text style={[styles.label, { color: colors.onSurfaceMuted }]}>PACKAGE</Text>
          <Text style={[styles.value, { color: colors.onSurface }]}>{PACKAGE_ID}</Text>
        </View>

        <Pressable
          testID="about-open-privacy"
          onPress={() => router.push("/privacy")}
          style={[styles.linkRow, { borderColor: colors.outline }]}
        >
          <Text style={[styles.value, { color: colors.onSurface }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h2 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  iconLarge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  appName: { ...typography.h2 },
  version: { fontSize: 13 },
  desc: { textAlign: "center", fontSize: 13, lineHeight: 20, paddingHorizontal: spacing.md },
  card: { width: "100%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  label: { ...typography.label, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: "500" },
  linkRow: { width: "100%", padding: spacing.md, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
