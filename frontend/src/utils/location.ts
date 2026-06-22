import * as Location from "expo-location";

import { storage } from "@/src/utils/storage";
import { LocationData } from "@/src/store/types";
import { updateObservation } from "@/src/store/observations";

const QUEUE_KEY = "fsp.geocodeQueue";

export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const base: LocationData = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      resolved: false,
    };
    const resolved = await reverseGeocode(base.latitude, base.longitude);
    return resolved ?? base;
  } catch (e) {
    console.warn("getCurrentLocation failed", e);
    return null;
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<LocationData | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!results || results.length === 0) {
      return { latitude: lat, longitude: lon, resolved: false };
    }
    const r = results[0];
    return {
      latitude: lat,
      longitude: lon,
      village: r.subregion ?? r.city ?? r.district ?? undefined,
      mandal: r.district ?? r.subregion ?? undefined,
      district: r.city ?? r.region ?? undefined,
      state: r.region ?? undefined,
      country: r.country ?? undefined,
      pin: r.postalCode ?? undefined,
      resolved: true,
    };
  } catch (e) {
    console.warn("reverseGeocode failed", e);
    return { latitude: lat, longitude: lon, resolved: false };
  }
}

// Offline queue: when an observation is saved without resolved location,
// we add its id to a queue and try resolving later.
export async function queueForGeocoding(obsId: string): Promise<void> {
  const raw = (await storage.getItem<string>(QUEUE_KEY, "")) ?? "";
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(obsId)) {
    ids.push(obsId);
    await storage.setItem(QUEUE_KEY, JSON.stringify(ids));
  }
}

export async function processGeocodeQueue(): Promise<void> {
  const raw = (await storage.getItem<string>(QUEUE_KEY, "")) ?? "";
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (ids.length === 0) return;
  const { loadObservations } = await import("@/src/store/observations");
  const list = await loadObservations();
  const remaining: string[] = [];
  for (const id of ids) {
    const obs = list.find((o) => o.id === id);
    if (!obs || !obs.location) continue;
    if (obs.location.resolved) continue;
    const resolved = await reverseGeocode(obs.location.latitude, obs.location.longitude);
    if (resolved && resolved.resolved) {
      await updateObservation(id, { location: resolved });
    } else {
      remaining.push(id);
    }
  }
  await storage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

export function formatLocationStamp(
  loc: LocationData | null,
  template: "A" | "B" | "C" | "D",
  custom: string,
  date: Date,
): string {
  if (!loc) return "";
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
  };
  const lat = loc.latitude.toFixed(4);
  const lon = loc.longitude.toFixed(4);
  const dateStr = fmt(date);
  if (template === "C") {
    return `${dateStr}\nLat: ${lat}  Lon: ${lon}`;
  }
  if (template === "B") {
    const parts: string[] = [dateStr];
    if (loc.village) parts.push(loc.village);
    if (loc.pin) parts.push(`PIN: ${loc.pin}`);
    return parts.join("\n");
  }
  if (template === "D") {
    return custom
      .replace(/\{date\}/g, dateStr)
      .replace(/\{village\}/g, loc.village ?? "")
      .replace(/\{mandal\}/g, loc.mandal ?? "")
      .replace(/\{district\}/g, loc.district ?? "")
      .replace(/\{state\}/g, loc.state ?? "")
      .replace(/\{pin\}/g, loc.pin ?? "")
      .replace(/\{lat\}/g, lat)
      .replace(/\{lon\}/g, lon);
  }
  // Template A — full
  const lines = [`Date: ${dateStr}`];
  if (loc.village) lines.push(`Village: ${loc.village}`);
  if (loc.mandal) lines.push(`Mandal: ${loc.mandal}`);
  if (loc.district) lines.push(`District: ${loc.district}`);
  if (loc.state) lines.push(`State: ${loc.state}`);
  if (loc.pin) lines.push(`PIN: ${loc.pin}`);
  lines.push(`Lat: ${lat}  Lon: ${lon}`);
  if (!loc.resolved) lines.push("(Address pending — will resolve online)");
  return lines.join("\n");
}
