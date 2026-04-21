/**
 * ModelSelector.tsx — Dropdown to choose the active LLM model.
 */

"use client";

import type { ModelInfo } from "@/lib/types";

interface Props {
  models: ModelInfo[];
  selectedModel: string;
  onChange: (modelId: string) => void;
}

const PROVIDER_LABEL: Record<ModelInfo["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Local (Ollama)",
};

export default function ModelSelector({
  models,
  selectedModel,
  onChange,
}: Props) {
  const grouped = new Map<ModelInfo["provider"], ModelInfo[]>();
  for (const m of models) {
    const arr = grouped.get(m.provider) ?? [];
    arr.push(m);
    grouped.set(m.provider, arr);
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      Model
      <select
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        value={selectedModel}
        onChange={(e) => onChange(e.target.value)}
      >
        {models.length === 0 && <option value="">Loading…</option>}
        {Array.from(grouped.entries()).map(([provider, list]) => (
          <optgroup key={provider} label={PROVIDER_LABEL[provider]}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
