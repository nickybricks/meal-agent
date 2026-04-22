/**
 * app-context.tsx — Global app settings shared by sidebar, pages, and settings.
 *
 * Persists values to localStorage on every update so they survive reloads.
 * Provider is mounted in app/layout.tsx so every page can call useAppSettings().
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { STORAGE_KEYS, readJSON, writeJSON } from "./storage";

export interface SessionStats {
  totalTokens: number;
  messageCount: number;
  likeCount: number;
  dislikeCount: number;
}

export interface AppSettings {
  homeId: string;
  sessionId: string;
}

export interface AppSettingsContextValue extends AppSettings {
  setHomeId: (id: string) => void;
  setSessionId: (id: string) => void;
  newSession: () => void;
  stats: SessionStats;
  updateStats: (patch: Partial<SessionStats>) => void;
  resetStats: () => void;
}

const defaults: AppSettings = {
  homeId: "",
  sessionId: "",
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const zeroStats: SessionStats = {
  totalTokens: 0,
  messageCount: 0,
  likeCount: 0,
  dislikeCount: 0,
};

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AppSettings>(defaults);
  const [stats, setStats] = useState<SessionStats>(zeroStats);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrated: AppSettings = {
      homeId: readJSON(STORAGE_KEYS.homeId, ""),
      sessionId: readJSON(STORAGE_KEYS.sessionId, "") || randomId(),
    };
    writeJSON(STORAGE_KEYS.sessionId, hydrated.sessionId);
    setState(hydrated);
    setHydrated(true);
  }, []);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K], storageKey: string) => {
      setState((prev) => ({ ...prev, [key]: value }));
      writeJSON(storageKey, value);
    },
    [],
  );

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...state,
      setHomeId: (v) => update("homeId", v, STORAGE_KEYS.homeId),
      setSessionId: (v) => update("sessionId", v, STORAGE_KEYS.sessionId),
      newSession: () => {
        const id = randomId();
        update("sessionId", id, STORAGE_KEYS.sessionId);
        setStats(zeroStats);
      },
      stats,
      updateStats: (patch) => setStats((prev) => ({ ...prev, ...patch })),
      resetStats: () => setStats(zeroStats),
    }),
    [state, update, stats],
  );

  if (!hydrated) {
    return null;
  }

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used inside <AppSettingsProvider>");
  }
  return ctx;
}
