import { storage } from "@/src/utils/storage";
import { AppSettings, DEFAULT_SETTINGS } from "./types";

const KEY = "fsp.settings";

export async function loadSettings(): Promise<AppSettings> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(settings));
}
