"use client";

import { useCallback, useEffect, useState } from "react";
import { getModels } from "@/lib/api";
import type { ModelInfo } from "@/lib/types";

export default function OllamaStatus() {
  const [ollama, setOllama] = useState<ModelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getModels();
      setOllama(all.filter((m) => m.provider === "ollama"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connected = ollama.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block rounded-full px-3 py-0.5 text-xs ${
            connected
              ? "bg-primary-container text-on-surface"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {loading ? "Checking…" : connected ? "Connected" : "Not connected"}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface hover:bg-surface-container-high"
        >
          Refresh
        </button>
      </div>
      {error && <div className="text-xs text-brand-error">{error}</div>}
      {connected && (
        <ul className="list-disc pl-4 text-xs text-on-surface-variant">
          {ollama.map((m) => (
            <li key={m.id}>{m.display}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
