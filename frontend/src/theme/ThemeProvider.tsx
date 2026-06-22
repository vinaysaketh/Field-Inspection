import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import { palette, ThemeColors } from "./tokens";

type Scheme = "light" | "dark";
type ModePref = "system" | "light" | "dark";

interface ThemeContextValue {
  scheme: Scheme;
  colors: ThemeColors;
  mode: ModePref;
  setMode: (m: ModePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "fsp.themeMode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ModePref>("system");

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(STORAGE_KEY, "system");
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
    })();
  }, []);

  const scheme: Scheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const colors = palette[scheme];

  const setMode = (m: ModePref) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m);
  };

  const value = useMemo(() => ({ scheme, colors, mode, setMode }), [scheme, colors, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
