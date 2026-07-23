import { storage } from "@/src/utils/storage";
import { Observation } from "./types";

const LIST_KEY = "fsp.observations";
const COUNTER_KEY = "fsp.obsCounter";

export async function loadObservations(): Promise<Observation[]> {
  const raw = await storage.getItem<string>(LIST_KEY, "");
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveObservations(items: Observation[]): Promise<void> {
  await storage.setItem(LIST_KEY, JSON.stringify(items));
}

export async function addObservation(obs: Observation): Promise<void> {
  const list = await loadObservations();
  list.unshift(obs);
  await saveObservations(list);
}

export async function updateObservation(id: string, patch: Partial<Observation>): Promise<void> {
  const list = await loadObservations();
  const idx = list.findIndex((o) => o.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    await saveObservations(list);
  }
}

export async function deleteObservation(id: string): Promise<void> {
  const list = await loadObservations();
  await saveObservations(list.filter((o) => o.id !== id));
}

export async function nextObservationNumber(): Promise<string> {
  const current = (await storage.getItem<number>(COUNTER_KEY, 0)) ?? 0;
  const next = (current as number) + 1;
  await storage.setItem(COUNTER_KEY, next);
  return `OBS-${String(next).padStart(4, "0")}`;
}

export async function resetObservationCounter(): Promise<void> {
  await storage.setItem(COUNTER_KEY, 0);
}

export async function getObservation(id: string): Promise<Observation | null> {
  const list = await loadObservations();
  return list.find((o) => o.id === id) ?? null;
}

const ANNOTATION_COUNTER_KEY = "fsp.annotationCount";
const LAST_PROMPT_COUNT_KEY = "fsp.lastShareAppPromptCount";

export async function incrementAnnotationCount(): Promise<number> {
  const current = (await storage.getItem<number>(ANNOTATION_COUNTER_KEY, 0)) ?? 0;
  const next = (current as number) + 1;
  await storage.setItem(ANNOTATION_COUNTER_KEY, next);
  return next;
}

export async function getAnnotationCount(): Promise<number> {
  return ((await storage.getItem<number>(ANNOTATION_COUNTER_KEY, 0)) ?? 0) as number;
}

/**
 * Returns true if the share-app modal should be shown after this save.
 * Triggers on every 5th successful save (5, 10, 15, 20…) and remembers the
 * last-prompted count so we never re-prompt for the same milestone twice.
 */
export async function shouldShowSharePrompt(): Promise<boolean> {
  const count = await getAnnotationCount();
  if (count === 0 || count % 5 !== 0) return false;
  const last = ((await storage.getItem<number>(LAST_PROMPT_COUNT_KEY, 0)) ?? 0) as number;
  return count > last;
}

export async function markSharePrompted(): Promise<void> {
  const count = await getAnnotationCount();
  await storage.setItem(LAST_PROMPT_COUNT_KEY, count);
}
