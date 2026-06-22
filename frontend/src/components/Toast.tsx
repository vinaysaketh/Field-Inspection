import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeProvider";

interface ToastCtx {
  show: (msg: string, opts?: { kind?: "info" | "error" | "success"; duration?: number }) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string>("");
  const [kind, setKind] = useState<"info" | "error" | "success">("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string, opts?: { kind?: "info" | "error" | "success"; duration?: number }) => {
      setMsg(m);
      setKind(opts?.kind ?? "info");
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      }, opts?.duration ?? 2200);
    },
    [opacity],
  );

  const bg =
    kind === "error" ? colors.error : kind === "success" ? colors.success : colors.primary;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wrap,
          { bottom: insets.bottom + 24, opacity },
        ]}
        testID="toast-container"
      >
        <View style={[styles.pill, { backgroundColor: bg }]}>
          <Text style={styles.text} testID="toast-message">{msg}</Text>
        </View>
      </Animated.View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    maxWidth: "90%",
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "500", textAlign: "center" },
});
