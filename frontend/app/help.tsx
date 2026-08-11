import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";

const FAQ: { q: string; a: string }[] = [
  { q: "How do I add a photo?", a: "From the home screen, tap Pick Photo to choose any photograph from your device gallery." },
  { q: "How do I add a Marker?", a: "In the editor, tap the Marker tool then tap on the image to drop numbered markers (1, 2, 3…)." },
  { q: "How do I add Text?", a: "Tap the Text tool then tap the image to place a rounded label. Choose S/M/L size and Normal or Invert style. Tap an existing text to edit or move it." },
  { q: "How do I add Notes?", a: "Tap the Notes button in the toolbar (next to Text). A dialog opens where you can type a written observation. Notes are stored with the observation but are not drawn on the image." },
  { q: "How do I save an observation?", a: "Tap the Save icon at the top-right of the editor. The annotated image is stored inside the app and copied to your device Gallery." },
  { q: "Where are my saved observations?", a: "From the home screen, tap My Gallery to browse all saved observations. Tap any thumbnail to open its detail view." },
  { q: "How do I delete an observation?", a: "Open the observation detail view and tap Delete. The image is removed from local storage." },
  { q: "How do I share an inspection image?", a: "Open the observation detail, tap the share icon on the header, and pick an app from your device share sheet." },
  { q: "How do I share FieldSnap Pro?", a: "Settings → Share FieldSnap Pro. This opens your device share sheet with a message and the Play Store link. It does NOT share your inspection photos." },
  { q: "How do I rate FieldSnap Pro?", a: "Settings → Rate FieldSnap Pro. This opens the Play Store listing where you can leave a rating." },
  { q: "How can I contact support?", a: "Settings → Send Feedback. This opens your email app pre-filled with subject and version info — you review and send it manually." },
  { q: "Does FieldSnap Pro collect my personal information?", a: "No. All photos, annotations, notes and GPS metadata stay on your device. Nothing is uploaded to the developer. See the Privacy Policy for full details." },
];

export default function Help() {
  const { colors, scheme } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right","bottom"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="help-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Help & FAQ</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {FAQ.map((f, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
            <Text style={[styles.q, { color: colors.onSurface }]}>{f.q}</Text>
            <Text style={[styles.a, { color: colors.onSurfaceMuted }]}>{f.a}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h2 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, gap: 6 },
  q: { fontSize: 15, fontWeight: "700" },
  a: { fontSize: 13, lineHeight: 20 },
});
