import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { loadObservations, pruneOrphanedObservations } from "@/src/store/observations";
import { loadSettings } from "@/src/store/settings";
import { Observation, AppSettings } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { spacing, radius, typography } from "@/src/theme/tokens";
import { processGeocodeQueue } from "@/src/utils/location";
import { useToast } from "@/src/components/Toast";

export default function Home() {
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [recent, setRecent] = useState<Observation[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // Prune observations whose local file or Gallery asset has been deleted.
        await pruneOrphanedObservations().catch(() => 0);
        const [obs, s] = await Promise.all([loadObservations(), loadSettings()]);
        setRecent(obs.slice(0, 5));
        setSettings(s);
        processGeocodeQueue().catch(() => {});
      })();
    }, []),
  );

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
        router.push({
          pathname: "/editor",
          params: { uri: a.uri, width: String(a.width ?? 0), height: String(a.height ?? 0) },
        });
      }
    } catch (e: any) {
      toast.show("Picker error: " + (e?.message ?? "unknown"), { kind: "error" });
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.onSurface }]}>FieldSnap Pro</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceMuted }]}>
            {settings?.company || "Field Documentation"}
          </Text>
        </View>
        <Pressable
          testID="open-settings-button"
          accessibilityLabel="Open settings"
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.surface, borderColor: colors.outline, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          testID="pick-photo-button"
          onPress={pickFromGallery}
          style={({ pressed }) => [
            styles.primaryCard,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="image" size={40} color={colors.onPrimary} />
          <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>Pick Photo</Text>
          <Text style={[styles.primarySub, { color: colors.onPrimary }]}>
            Choose any photo to annotate
          </Text>
        </Pressable>

        <Pressable
          testID="open-gallery-button"
          onPress={() => router.push("/gallery")}
          style={({ pressed }) => [
            styles.secondaryCard,
            { backgroundColor: colors.surface, borderColor: colors.outline, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="images-outline" size={28} color={colors.primary} />
          <Text style={[styles.secondaryLabel, { color: colors.onSurface }]}>My Gallery</Text>
          <Text style={[styles.secondarySub, { color: colors.onSurfaceMuted }]}>
            {recent.length === 0 ? "Empty" : `${recent.length} recent`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceMuted }]}>RECENT OBSERVATIONS</Text>
      </View>

      <FlatList
        testID="recent-observations-list"
        data={recent}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.outline }]}>
            <Ionicons name="document-outline" size={32} color={colors.onSurfaceMuted} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceMuted }]}>
              No observations yet. Tap Pick Photo to start.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.onSurfaceMuted }]} testID="home-footer">
              Made by Nidamarthi Vinay Saketh
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`recent-item-${item.number}`}
            onPress={() => router.push({ pathname: "/observation", params: { id: item.id } })}
            style={({ pressed }) => [
              styles.recentRow,
              { backgroundColor: colors.surface, borderColor: colors.outline, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Image source={{ uri: item.imageUri }} style={styles.recentThumb} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recentNumber, { color: colors.onSurface }]}>{item.title || item.number}</Text>
              <Text style={[styles.recentMeta, { color: colors.onSurfaceMuted }]} numberOfLines={1}>
                {item.project || item.number}
              </Text>
              <Text style={[styles.recentMeta, { color: colors.onSurfaceMuted }]}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        )}
      />
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
    paddingBottom: spacing.lg,
  },
  title: { ...typography.h2 },
  subtitle: { ...typography.body, marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  primaryCard: {
    borderRadius: radius.md,
    padding: spacing.xl,
    minHeight: 200,
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  primaryLabel: { ...typography.h1, marginTop: spacing.md },
  primarySub: { fontSize: 14, opacity: 0.9 },
  smallCard: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    justifyContent: "space-between",
    minHeight: 64,
    gap: 2,
  },
  smallLabel: { fontSize: 15, fontWeight: "600" },
  smallSub: { fontSize: 11 },
  secondaryCard: {
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 72,
  },
  secondaryLabel: { ...typography.h3 },
  secondarySub: { fontSize: 13, marginLeft: "auto" },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...typography.label },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  recentThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: "#000" },
  recentNumber: { ...typography.bodyLarge, fontWeight: "600" },
  recentMeta: { fontSize: 12, marginTop: 2 },
  empty: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});
