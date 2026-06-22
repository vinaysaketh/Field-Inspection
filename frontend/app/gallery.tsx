import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import { loadObservations } from "@/src/store/observations";
import { Observation } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import { exportObservationsPdf } from "@/src/utils/pdf";

export default function Gallery() {
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<Observation[]>([]);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadObservations().then(setItems);
    }, []),
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.number.toLowerCase().includes(q) ||
        (i.title?.toLowerCase().includes(q) ?? false) ||
        i.project.toLowerCase().includes(q) ||
        new Date(i.timestamp).toLocaleDateString().toLowerCase().includes(q),
    );
  }, [items, query]);

  const onExport = async () => {
    if (filtered.length === 0) {
      toast.show("No observations to export", { kind: "error" });
      return;
    }
    setExporting(true);
    try {
      await exportObservationsPdf(filtered);
      toast.show("PDF generated", { kind: "success" });
    } catch (e: any) {
      toast.show("Export failed: " + (e?.message ?? "unknown"), { kind: "error" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="gallery-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Gallery</Text>
        <Pressable
          testID="export-pdf-button"
          onPress={onExport}
          disabled={exporting}
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: exporting ? 0.6 : 1 }]}
        >
          <Ionicons name="document-text-outline" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
        <Ionicons name="search" size={18} color={colors.onSurfaceMuted} />
        <TextInput
          testID="gallery-search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by number, project, date..."
          placeholderTextColor={colors.onSurfaceMuted}
          style={[styles.search, { color: colors.onSurface }]}
        />
      </View>

      <FlatList
        testID="gallery-grid"
        data={filtered}
        keyExtractor={(it) => it.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 4 }}
        contentContainerStyle={{ padding: 4, gap: 4 }}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.outline }]}>
            <Ionicons name="images-outline" size={36} color={colors.onSurfaceMuted} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceMuted }]}>
              {query ? "No matches" : "No observations yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`thumb-${item.number}`}
            onPress={() => router.push({ pathname: "/observation", params: { id: item.id } })}
            style={styles.thumbWrap}
          >
            <Image source={{ uri: item.imageUri }} style={styles.thumb} />
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText} numberOfLines={1}>{item.title || item.number}</Text>
            </View>
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
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  search: { flex: 1, height: 40, fontSize: 14 },
  thumbWrap: { flex: 1, aspectRatio: 1, backgroundColor: "#000" },
  thumb: { width: "100%", height: "100%" },
  thumbBadge: {
    position: "absolute",
    left: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thumbBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  empty: {
    flex: 1,
    marginTop: 80,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: spacing.xl,
    borderRadius: radius.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { fontSize: 13 },
});
