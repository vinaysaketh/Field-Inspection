import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing, typography } from "@/src/theme/tokens";
import {
  WALKTHROUGH_STEPS,
  isWalkthroughDone,
  markWalkthroughDone,
} from "./walkthrough";

interface Props {
  /** Force-show flag, e.g. when user chooses "Replay Tutorial" in Settings */
  forceOpen?: boolean;
  onDone?: () => void;
}

export function Walkthrough({ forceOpen, onDone }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setVisible(true);
      return;
    }
    isWalkthroughDone().then((done) => {
      if (!done) {
        setStep(0);
        setVisible(true);
      }
    });
  }, [forceOpen]);

  const close = async () => {
    setVisible(false);
    await markWalkthroughDone();
    onDone?.();
  };

  const s = WALKTHROUGH_STEPS[step];
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop} testID="walkthrough-modal">
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Pressable testID="walkthrough-skip" onPress={close} style={styles.skipBtn}>
            <Text style={{ color: colors.onSurfaceMuted, fontSize: 13, fontWeight: "600" }}>
              Skip
            </Text>
          </Pressable>

          <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name={s.icon as any} size={44} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.onSurface }]}>{s.title}</Text>
          <Text style={[styles.body, { color: colors.onSurfaceMuted }]}>{s.body}</Text>

          <View style={styles.dots}>
            {WALKTHROUGH_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === step ? colors.primary : colors.outline,
                    width: i === step ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.count, { color: colors.onSurfaceMuted }]}>
            {step + 1} of {WALKTHROUGH_STEPS.length}
          </Text>

          <View style={styles.nav}>
            <Pressable
              testID="walkthrough-back"
              onPress={() => setStep((v) => Math.max(0, v - 1))}
              disabled={step === 0}
              style={[styles.navBtn, { borderColor: colors.outline, opacity: step === 0 ? 0.4 : 1 }]}
            >
              <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Back</Text>
            </Pressable>
            <Pressable
              testID="walkthrough-next"
              onPress={() => (isLast ? close() : setStep((v) => v + 1))}
              style={[styles.navBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>
                {isLast ? "Get Started" : "Next"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  skipBtn: { position: "absolute", top: 10, right: 12, padding: 8 },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h2, textAlign: "center" },
  body: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  dots: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  dot: { height: 6, borderRadius: 3 },
  count: { fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  nav: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, width: "100%" },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: "center",
  },
});
