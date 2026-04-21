/**
 * storage.ts — Small typed wrappers around localStorage plus a React hook.
 *
 * Used to persist user-facing settings (selected user/model, personality,
 * model params, API keys, tool toggles) across page reloads.
 */

"use client";

import { useEffect, useState } from "react";

export const STORAGE_KEYS = {
  userId: "recipe_agent.user_id",
  sessionId: "recipe_agent.session_id",
  model: "recipe_agent.model",
  personality: "recipe_agent.personality",
  temperature: "recipe_agent.temperature",
  topP: "recipe_agent.top_p",
  maxTokens: "recipe_agent.max_tokens",
  enabledTools: "recipe_agent.enabled_tools",
  apiKeyOpenAI: "recipe_agent.api_key.openai",
  apiKeyAnthropic: "recipe_agent.api_key.anthropic",
  apiKeyGoogle: "recipe_agent.api_key.google",
  apiKeyLangSmith: "recipe_agent.api_key.langsmith",
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readJSON<T>(key, initial));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (next: T) => {
    setValue(next);
    writeJSON(key, next);
  };

  return [hydrated ? value : initial, update];
}
