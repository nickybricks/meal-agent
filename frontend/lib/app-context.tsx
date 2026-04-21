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
import type { Personality } from "./types";
import { STORAGE_KEYS, readJSON, writeJSON } from "./storage";

const DEFAULT_TOOLS = [
  "search_recipes",
  "get_user_profile",
  "save_preference",
  "substitute_ingredient",
  "generate_meal_plan",
];

export interface SessionStats {
  totalTokens: number;
  messageCount: number;
  likeCount: number;
  dislikeCount: number;
}

export interface AppSettings {
  userId: string;
  sessionId: string;
  model: string;
  personality: Personality;
  temperature: number;
  topP: number;
  maxTokens: number;
  enabledTools: string[];
}

export interface AppSettingsContextValue extends AppSettings {
  setUserId: (id: string) => void;
  setSessionId: (id: string) => void;
  setModel: (m: string) => void;
  setPersonality: (p: Personality) => void;
  setTemperature: (t: number) => void;
  setTopP: (t: number) => void;
  setMaxTokens: (t: number) => void;
  setEnabledTools: (tools: string[]) => void;
  newSession: () => void;
  stats: SessionStats;
  updateStats: (patch: Partial<SessionStats>) => void;
  resetStats: () => void;
}

const defaults: AppSettings = {
  userId: "",
  sessionId: "",
  model: "gpt-4o-mini",
  personality: "friendly",
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 1024,
  enabledTools: DEFAULT_TOOLS,
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
      userId: readJSON(STORAGE_KEYS.userId, ""),
      sessionId: readJSON(STORAGE_KEYS.sessionId, "") || randomId(),
      model: readJSON(STORAGE_KEYS.model, defaults.model),
      personality: readJSON(STORAGE_KEYS.personality, defaults.personality),
      temperature: readJSON(STORAGE_KEYS.temperature, defaults.temperature),
      topP: readJSON(STORAGE_KEYS.topP, defaults.topP),
      maxTokens: readJSON(STORAGE_KEYS.maxTokens, defaults.maxTokens),
      enabledTools: readJSON(STORAGE_KEYS.enabledTools, defaults.enabledTools),
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
      setUserId: (v) => update("userId", v, STORAGE_KEYS.userId),
      setSessionId: (v) => update("sessionId", v, STORAGE_KEYS.sessionId),
      setModel: (v) => update("model", v, STORAGE_KEYS.model),
      setPersonality: (v) => update("personality", v, STORAGE_KEYS.personality),
      setTemperature: (v) => update("temperature", v, STORAGE_KEYS.temperature),
      setTopP: (v) => update("topP", v, STORAGE_KEYS.topP),
      setMaxTokens: (v) => update("maxTokens", v, STORAGE_KEYS.maxTokens),
      setEnabledTools: (v) => update("enabledTools", v, STORAGE_KEYS.enabledTools),
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
