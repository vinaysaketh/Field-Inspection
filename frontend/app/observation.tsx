import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import { deleteObservation, getObservation } from "@/src/store/observations";
import { Observation } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import { formatLocationStamp } from "@/src/utils/location";
import { exportObservationsPdf } from "@/src/utils/pdf";

export default function ObservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [obs, setObs] = useState<Observation | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) getObservation(id).then(setObs);
    }, [id]),
  );

  const stamp = obs ? formatLocationStamp(obs.location, obs.template, "", new Date(obs.timestamp)) : "";

  const onExport = async () => {
    if (!obs) return;
    setExporting(true);
    try {
      await exportObservationsPdf([obs], obs.number);
      toast.show("PDF generated", { kind: "success" });
    } catch (e: any) {
      toast.show("Export failed: " + (e?.message ?? "unknown"), { kind: "error" });
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    if (!obs) return;
    await deleteObservation(obs.id);
    toast.show("Deleted", { kind: "success" });
    router.back();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right","bottom"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="obs-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]} testID="obs-number-label">{obs?.number ?? ""}</Text>
        <Pressable
          testID="obs-export-button"
          onPress={onExport}
          disabled={exporting || !obs}
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: !obs || exporting ? 0.6 : 1 }]}
        >
          <Ionicons name="share-outline" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {obs ? (
          <>
            <Image source={{ uri: obs.imageUri }} style={[styles.image, { backgroundColor: "#000" }]} resizeMode="contain" />

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
              <Row label="Date" value={new Date(obs.timestamp).toLocaleString()} colors={colors} />
              {obs.project ? <Row label="Project" value={obs.project} colors={colors} /> : null}
              {obs.company ? <Row label="Company" value={obs.company} colors={colors} /> : null}
              {obs.auditor ? <Row label="Auditor" value={obs.auditor} colors={colors} /> : null}
            </View>

            {obs.notes ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
                <Text style={[styles.cardLabel, { color: colors.onSurfaceMuted }]}>NOTES</Text>
                <Text style={[styles.cardBody, { color: colors.onSurface }]} testID="obs-notes-text">{obs.notes}</Text>
              </View>
            ) : null}

            {stamp ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
                <Text style={[styles.cardLabel, { color: colors.onSurfaceMuted }]}>LOCATION</Text>
                <Text style={[styles.mono, { color: colors.onSurface }]} testID="obs-location-text">{stamp}</Text>
                {obs.location && !obs.location.resolved ? (
                  <Text style={{ color: colors.onSurfaceMuted, fontSize: 12, marginTop: 4 }}>
                    Address will resolve automatically when online.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              testID="obs-delete-button"
              onPress={onDelete}
              style={[styles.deleteBtn, { borderColor: colors.error }]}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: "600" }}>Delete Observation</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.onSurfaceMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.onSurface }]} numberOfLines={2}>{value}</Text>
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
  title: { ...typography.h2, letterSpacing: 1 },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.full, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, gap: 6 },
  cardLabel: { ...typography.label },
  cardBody: { fontSize: 14, lineHeight: 20 },
  mono: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 4 },
  rowLabel: { fontSize: 12, fontWeight: "600", width: 80 },
  rowValue: { flex: 1, textAlign: "right", fontSize: 14 },
  deleteBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    paddingVertical: spacing.md, borderRadius: radius.full, borderWidth: 1,
  },
});
