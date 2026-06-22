// Lock state helpers: PIN stored via SecureStore (hashed via simple checksum).
// This is NOT bank-grade security; it's a convenience lock for field workers.
import * as LocalAuthentication from "expo-local-authentication";

import { storage } from "@/src/utils/storage";

const PIN_KEY = "fsp.pinHash";

function hash(pin: string): string {
  // tiny deterministic hash — sufficient as the value is stored in keychain.
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = (h * 33) ^ pin.charCodeAt(i);
  }
  return String(h >>> 0);
}

export async function hasPin(): Promise<boolean> {
  const v = await storage.secureGet<string>(PIN_KEY, "");
  return !!v;
}

export async function setPin(pin: string): Promise<void> {
  await storage.secureSet(PIN_KEY, hash(pin));
}

export async function clearPin(): Promise<void> {
  await storage.secureRemove(PIN_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await storage.secureGet<string>(PIN_KEY, "");
  return stored === hash(pin);
}

export async function canUseBiometric(): Promise<boolean> {
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock FieldSnap Pro",
      fallbackLabel: "Use PIN",
    });
    return result.success;
  } catch {
    return false;
  }
}
