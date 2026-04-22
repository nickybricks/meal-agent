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
      <label className="w-24 text-sm text-on-surface">{label}</label>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`${label} key`}
        className="flex-1 rounded-[1rem] bg-surface-container-highest px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="rounded-full bg-surface-container px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high"
      >
        {show ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        onClick={save}
        className="rounded-full bg-primary px-3 py-1.5 text-xs text-on-primary"
      >
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={clear}
        className="rounded-full bg-surface-container px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high"
      >
        Clear
      </button>
    </div>
  );
}

export default function ApiKeyManager() {
  return (
    <div className="flex flex-col gap-3">
      {KEYS.map((k) => (
        <Row key={k.storageKey} {...k} />
      ))}
      <p className="text-[11px] text-on-surface-variant">
        Keys are stored in your browser. The backend currently reads provider
        keys from its own .env; frontend forwarding is not wired yet.
      </p>
    </div>
  );
}
