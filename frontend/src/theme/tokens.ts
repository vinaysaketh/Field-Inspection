// Design tokens for FieldSnap Pro (from /app/design_guidelines.json).
export const palette = {
  light: {
    primary: "#0A2463",
    primaryContainer: "#DCE1FF",
    onPrimary: "#FFFFFF",
    background: "#F8F9FA",
    surface: "#FFFFFF",
    surfaceVariant: "#EEF0F4",
    onSurface: "#1E1E24",
    onSurfaceMuted: "#5A5D66",
    outline: "#C5C8D0",
    outlineStrong: "#74777F",
    error: "#BA1A1A",
    success: "#138A36",
    gpsStampBg: "rgba(10, 36, 99, 0.85)",
    overlay: "rgba(0,0,0,0.5)",
  },
  dark: {
    primary: "#8CB8FF",
    primaryContainer: "#0A2463",
    onPrimary: "#002F68",
    background: "#0E0F12",
    surface: "#1A1B1F",
    surfaceVariant: "#23252B",
    onSurface: "#E2E2E6",
    onSurfaceMuted: "#9CA0AA",
    outline: "#33363E",
    outlineStrong: "#8E9099",
    error: "#FFB4AB",
    success: "#5BD68A",
    gpsStampBg: "rgba(0, 0, 0, 0.85)",
    overlay: "rgba(0,0,0,0.6)",
  },
};

export const annotationPalette = {
  red: "#FF3B30",
  yellow: "#FFCC00",
  green: "#34C759",
  blue: "#007AFF",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  touch: 48,
};

export const radius = {
  sm: 4,
  md: 12,
  lg: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: "700" as const },
  h2: { fontSize: 24, fontWeight: "600" as const },
  h3: { fontSize: 20, fontWeight: "600" as const },
  bodyLarge: { fontSize: 16, fontWeight: "400" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 1 },
};

export type ThemeColors = typeof palette.light;
