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
