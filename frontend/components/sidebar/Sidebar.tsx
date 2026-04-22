"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, BookOpen, CalendarDays } from "lucide-react";

import type { Home, SessionSummary } from "@/lib/types";
import { listHomes, listSessions } from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";
import { useAuth } from "@/components/auth/AuthProvider";

import SessionList from "./SessionList";
import ProfileMenu from "./ProfileMenu";

const LINKS = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/meal-plan", label: "Meal Plan", icon: CalendarDays },
];

export default function Sidebar() {
  const settings = useAppSettings();
  const { stats } = settings;
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, me } = useAuth();

  const [homes, setHomes] = useState<Home[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    if (!authUser) {
      setHomes([]);
      return;
    }
    let cancelled = false;
    listHomes()
      .then((rows) => {
        if (cancelled) return;
        setHomes(rows);
        if (rows.length > 0 && !rows.some((h) => h.id === settings.homeId)) {
          settings.setHomeId(rows[0].id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  useEffect(() => {
    if (!me || !settings.homeId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    listSessions(me.id, settings.homeId)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me?.id, settings.homeId, settings.sessionId, stats.messageCount]);

  const isOnChatPage = pathname === "/";

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col gap-4 bg-surface-container-low p-4">
      <div>
        <h1 className="text-lg font-semibold text-on-surface">Melagent</h1>
        <p className="text-xs text-on-surface-variant">Your AI chef</p>
      </div>

      <nav className="flex flex-col gap-1">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition ${
                active
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <l.icon size={16} className="shrink-0" />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <SessionList
        sessions={sessions}
        activeSessionId={isOnChatPage ? settings.sessionId : ""}
        onSelect={(id) => {
          router.push("/");
          if (id === settings.sessionId) return;
          settings.setSessionId(id);
          settings.resetStats();
        }}
        onNew={() => { settings.newSession(); router.push("/"); }}
      />

      {authUser && (
        <ProfileMenu
          homes={homes}
          onHomeCreated={(home) => setHomes((prev) => [...prev, home])}
        />
      )}
    </aside>
  );
}
