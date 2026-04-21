/**
 * ApiKeyManager.tsx — API key input fields for cloud providers.
 *
 * Keys are stored in localStorage only. Per Phase 2 notes, end-to-end
 * forwarding to ChatRequest.api_key is not wired yet; the backend currently
 * reads provider keys from its own env. The UI is in place for when it is.
 */

"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS, readJSON, writeJSON, removeKey } from "@/lib/storage";

interface KeyRow {
  label: string;
  storageKey: string;
}

const KEYS: KeyRow[] = [
  { label: "OpenAI", storageKey: STORAGE_KEYS.apiKeyOpenAI },
  { label: "Anthropic", storageKey: STORAGE_KEYS.apiKeyAnthropic },
  { label: "Google", storageKey: STORAGE_KEYS.apiKeyGoogle },
  { label: "LangSmith", storageKey: STORAGE_KEYS.apiKeyLangSmith },
];

function Row({ label, storageKey }: KeyRow) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(readJSON<string>(storageKey, ""));
  }, [storageKey]);

  const save = () => {
    writeJSON(storageKey, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clear = () => {
    removeKey(storageKey);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2">
      <label className="w-24 text-sm text-neutral-700">{label}</label>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`${label} key`}
        className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
      >
        {show ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        onClick={save}
        className="rounded bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-700"
      >
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={clear}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
      >
        Clear
      </button>
    </div>
  );
}

export default function ApiKeyManager() {
  return (
    <div className="flex flex-col gap-2">
      {KEYS.map((k) => (
        <Row key={k.storageKey} {...k} />
      ))}
      <p className="text-[11px] text-neutral-500">
        Keys are stored in your browser. The backend currently reads provider
        keys from its own .env; frontend forwarding is not wired yet.
      </p>
    </div>
  );
}
