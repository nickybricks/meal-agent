/**
 * OllamaStatus.tsx — Shows Ollama connection health and installed models.
 */

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs ${
            connected
              ? "bg-green-100 text-green-800"
              : "bg-neutral-200 text-neutral-600"
          }`}
        >
          {loading ? "Checking…" : connected ? "Connected" : "Not connected"}
        </span>
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      {connected && (
        <ul className="list-disc pl-4 text-xs text-neutral-700">
          {ollama.map((m) => (
            <li key={m.id}>{m.display}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
