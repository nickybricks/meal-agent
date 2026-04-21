/**
 * PersonalityToggle.tsx — Three-way toggle for agent personality.
 */

"use client";

import type { Personality } from "@/lib/types";

interface Props {
  value: Personality;
  onChange: (p: Personality) => void;
}

const OPTIONS: { key: Personality; label: string }[] = [
  { key: "friendly", label: "Friendly" },
  { key: "professional", label: "Pro" },
  { key: "concise", label: "Concise" },
];

export default function PersonalityToggle({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1 text-xs text-neutral-500">
      Personality
      <div className="inline-flex overflow-hidden rounded border border-neutral-300">
        {OPTIONS.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className={`flex-1 px-2 py-1 text-xs transition ${
                active
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
