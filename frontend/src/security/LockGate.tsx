import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { loadSettings } from "@/src/store/settings";
import { hasPin } from "@/src/utils/auth";

interface LockCtx {
  unlocked: boolean;
  lockRequired: boolean;
  markUnlocked: () => void;
  requestLock: () => void;
}

const Ctx = createContext<LockCtx | null>(null);

/**
 * Global app-lock gate:
 *   • Checks whether an app-lock PIN is enabled at startup.
 *   • Redirects any deep-link/route to /lock while locked (prevents SEC-001).
 *   • Re-locks when the app returns to the foreground.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [lockRequired, setLockRequired] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  const refreshLockStatus = async () => {
    const [s, pinExists] = await Promise.all([loadSettings(), hasPin()]);
    const required = !!(s.appLockEnabled && pinExists);
    setLockRequired(required);
    if (!required) {
      setUnlocked(true);
    }
    setReady(true);
  };

  useEffect(() => {
    refreshLockStatus();
  }, []);

  // Re-lock on foreground resume (background → active).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if ((prev === "background" || prev === "inactive") && next === "active") {
        refreshLockStatus().then(() => {
          if (lockRequired) setUnlocked(false);
        });
      }
    });
    return () => sub.remove();
  }, [lockRequired]);

  // Redirect any unlocked-required route to /lock while locked.
  useEffect(() => {
    if (!ready) return;
    if (lockRequired && !unlocked && pathname !== "/lock") {
      router.replace("/lock");
    }
  }, [ready, lockRequired, unlocked, pathname, router]);

  const value: LockCtx = {
    unlocked,
    lockRequired,
    markUnlocked: () => setUnlocked(true),
    requestLock: () => setUnlocked(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLockGate() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLockGate must be used inside LockGate");
  return ctx;
}
