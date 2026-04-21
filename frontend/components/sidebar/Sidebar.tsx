/**
 * Sidebar.tsx — Left-side navigation and controls panel.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { ModelInfo, SessionSummary } from "@/lib/types";
import { getModels, listSessions, listUsers } from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";

import UserSelector from "./UserSelector";
import ModelSelector from "./ModelSelector";
import PersonalityToggle from "./PersonalityToggle";
import SessionList from "./SessionList";
import StatsPanel from "./StatsPanel";

const LINKS = [
  { href: "/", label: "Chat" },
  { href: "/profile", label: "Profile" },
  { href: "/meal-plan", label: "Meal Plan" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const settings = useAppSettings();
  const { stats } = settings;
  const pathname = usePathname();

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, m] = await Promise.all([listUsers(), getModels()]);
        if (cancelled) return;
        setUsers(u);
        setModels(m);
        if (!settings.userId && u.length > 0) {
          settings.setUserId(u[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load recent sessions for the active user. Refetch when the user switches
  // or when the message count ticks (so a freshly-started chat appears).
  useEffect(() => {
    if (!settings.userId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    listSessions(settings.userId)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {
        // Non-fatal: the sidebar keeps working without the list.
      });
    return () => {
      cancelled = true;
    };
  }, [settings.userId, settings.sessionId, stats.messageCount]);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col gap-4 border-r border-neutral-200 bg-neutral-50 p-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Recipe Agent</h1>
        <p className="text-xs text-neutral-500">Your AI chef</p>
      </div>

      <UserSelector
        users={users}
        selectedUserId={settings.userId}
        onChange={(id) => {
          settings.setUserId(id);
          settings.newSession();
        }}
      />

      <ModelSelector
        models={models}
        selectedModel={settings.model}
        onChange={settings.setModel}
      />

      <PersonalityToggle
        value={settings.personality}
        onChange={settings.setPersonality}
      />

      <nav className="flex flex-col gap-1 border-t border-neutral-200 pt-3">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded px-2 py-1 text-sm ${
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <SessionList
        sessions={sessions}
        activeSessionId={settings.sessionId}
        onSelect={(id) => {
          if (id === settings.sessionId) return;
          settings.setSessionId(id);
          settings.resetStats();
        }}
        onNew={() => settings.newSession()}
      />

      <div className="flex flex-col gap-2">
        {loadError && (
          <div className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">
            {loadError}
          </div>
        )}
        <StatsPanel
          totalTokens={stats.totalTokens}
          messageCount={stats.messageCount}
          likeCount={stats.likeCount}
          dislikeCount={stats.dislikeCount}
        />
      </div>
    </aside>
  );
}
