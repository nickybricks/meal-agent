"use client";

import type { SessionSummary } from "@/lib/types";

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export default function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          Recent chats
        </span>
        <button
          type="button"
          onClick={onNew}
          className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant transition hover:bg-surface-container-high"
          title="Start a new chat"
        >
          + New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-2 py-1 text-xs text-on-surface-variant">No chats yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => {
              const active = s.sessionId === activeSessionId;
              const label = s.title ? truncate(s.title, 32) : "(empty)";
              return (
                <li key={s.sessionId}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.sessionId)}
                    className={`w-full truncate rounded-full px-3 py-1 text-left text-xs transition ${
                      active
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                    title={s.title || s.sessionId}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
