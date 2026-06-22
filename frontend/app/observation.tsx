import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useToast } from "@/src/components/Toast";
import {
  deleteObservation,
  getObservation,
  markSharePrompted,
  shouldShowSharePrompt,
  updateObservation,
} from "@/src/store/observations";
import { Observation } from "@/src/store/types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import { formatLocationStamp } from "@/src/utils/location";

export default function ObservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const [obs, setObs] = useState<Observation | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showLikePrompt, setShowLikePrompt] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        getObservation(id).then(setObs);
      }
      shouldShowSharePrompt().then((show) => {
        if (show) {
          setShowLikePrompt(true);
          markSharePrompted();
        }
      });
    }, [id]),
  );

  const stamp = obs ? formatLocationStamp(obs.location, obs.template, "", new Date(obs.timestamp)) : "";

  // Tap the header share icon → open system share dialog directly (no in-between modal,
  // because iOS UIActivityViewController fails to present over an RN <Modal>).
  const onShare = async () => {
    if (!obs) return;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        toast.show("Sharing not available", { kind: "error" });
        return;
      }
      await Sharing.shareAsync(obs.imageUri, {
        mimeType: "image/jpeg",
        UTI: "public.jpeg",
        dialogTitle: obs.title || obs.number,
      });
    } catch (e: any) {
      toast.show("Share failed: " + (e?.message ?? "unknown"), { kind: "error" });
    }
  };

  const onDelete = async () => {
    if (!obs) return;
    await deleteObservation(obs.id);
    toast.show("Deleted", { kind: "success" });
    router.back();
  };

  const openRename = () => {
    if (!obs) return;
    setTitleDraft(obs.title || obs.number);
    setRenameModal(true);
  };

  const saveRename = async () => {
    if (!obs) return;
    const v = titleDraft.trim() || obs.number;
    await updateObservation(obs.id, { title: v });
    setObs({ ...obs, title: v });
    setRenameModal(false);
    toast.show("Renamed", { kind: "success" });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top","left","right","bottom"]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable testID="obs-back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable
          testID="obs-rename-button"
          onPress={openRename}
          disabled={!obs}
          style={styles.titleBtn}
        >
          <Text style={[styles.title, { color: colors.onSurface }]} testID="obs-number-label" numberOfLines={1}>
            {obs?.title || obs?.number || ""}
          </Text>
          <Ionicons name="pencil" size={14} color={colors.onSurfaceMuted} />
        </Pressable>
        <Pressable
          testID="obs-export-button"
          onPress={onShare}
          disabled={!obs}
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: !obs ? 0.6 : 1 }]}
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
        ) : (
          <View style={[styles.empty, { borderColor: colors.outline }]} testID="observation-empty-state">
            <Ionicons name="alert-circle-outline" size={36} color={colors.onSurfaceMuted} />
            <Text style={{ color: colors.onSurfaceMuted, textAlign: "center" }}>
              No observation found.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={renameModal} transparent animationType="fade" onRequestClose={() => setRenameModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Rename observation</Text>
            <TextInput
              testID="rename-input-field"
              autoFocus
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder={obs?.number || ""}
              placeholderTextColor={colors.onSurfaceMuted}
              style={[styles.modalInput, { color: colors.onSurface, borderColor: colors.outline }]}
            />
            <View style={styles.modalActions}>
              <Pressable testID="rename-cancel-button" onPress={() => setRenameModal(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.onSurfaceMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable testID="rename-save-button" onPress={saveRename} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLikePrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLikePrompt(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, maxWidth: 360 }]} testID="like-prompt">
            <View style={{ alignItems: "center", gap: 6 }}>
              <Ionicons name="heart" size={36} color={colors.primary} />
              <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>You{`'`}re on a roll!</Text>
              <Text style={{ color: colors.onSurfaceMuted, textAlign: "center", fontSize: 13 }}>
                You{`'`}ve annotated 5 photos. If FieldSnap Pro is helping your work, please share it with a teammate.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                testID="like-dismiss-button"
                onPress={() => setShowLikePrompt(false)}
                style={styles.modalBtn}
              >
                <Text style={{ color: colors.onSurfaceMuted, fontWeight: "600" }}>Maybe later</Text>
              </Pressable>
              <Pressable
                testID="like-share-button"
                onPress={async () => {
                  setShowLikePrompt(false);
                  // Wait for the prompt's fade-out so iOS can present share UI
                  await new Promise((r) => setTimeout(r, 350));
                  await onShare();
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Share now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  titleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
  },
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
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(120,120,120,0.4)",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetLabel: { fontSize: 15, fontWeight: "600" },
  sheetSub: { fontSize: 12, marginTop: 2 },
});
