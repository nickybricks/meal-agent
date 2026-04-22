"use client";

import Link from "next/link";
import type { Home } from "@/lib/types";

interface Props {
  homes: Home[];
  selectedHomeId: string;
  onChange: (homeId: string) => void;
}

export default function HomeSwitcher({ homes, selectedHomeId, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
      Home
      <div className="flex items-center gap-1">
        <select
          className="flex-1 rounded-full bg-surface-container-highest px-3 py-1.5 text-sm text-on-surface outline-none"
          value={selectedHomeId}
          onChange={(e) => onChange(e.target.value)}
        >
          {homes.length === 0 && <option value="">No homes</option>}
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <Link
          href="/home"
          title="Manage home"
          className="rounded-full bg-surface-container px-2.5 py-1.5 text-xs text-on-surface hover:bg-surface-container-high"
        >
          ⚙
        </Link>
      </div>
    </label>
  );
}
