"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppSettings } from "@/lib/app-context";
import { createHome } from "@/lib/api";
import type { Home } from "@/lib/types";

interface Props {
  homes: Home[];
  onHomeCreated: (home: Home) => void;
}

export default function ProfileMenu({ homes, onHomeCreated }: Props) {
  const { me, signOut } = useAuth();
  const { homeId, setHomeId, newSession } = useAppSettings();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newHomeName, setNewHomeName] = useState("");
  const [creatingLoading, setCreatingLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function handleCreateHome() {
    if (!newHomeName.trim()) return;
    setCreatingLoading(true);
    try {
      const home = await createHome(newHomeName.trim());
      onHomeCreated(home);
      setHomeId(home.id);
      newSession();
      setCreating(false);
      setNewHomeName("");
    } finally {
      setCreatingLoading(false);
    }
  }

  const initial = me?.name?.[0]?.toUpperCase() ?? "?";
  const displayName = me?.name ?? me?.email ?? "User";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-on-surface transition hover:bg-surface-container-high"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
          {initial}
        </span>
        <span className="flex-1 truncate text-left">{displayName}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full rounded-2xl bg-white/90 p-2 shadow-xl backdrop-blur-xl">
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-on-surface-variant">
            Switch Home
          </p>

          {homes.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                if (h.id !== homeId) {
                  setHomeId(h.id);
                  newSession();
                }
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm text-on-surface transition hover:bg-surface-container-high"
            >
              <span className="flex-1 truncate text-left">{h.name}</span>
              {h.id === homeId && (
                <svg
                  className="h-4 w-4 shrink-0 text-primary"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}

          {creating ? (
            <div className="flex gap-1 px-1 py-1">
              <input
                autoFocus
                value={newHomeName}
                onChange={(e) => setNewHomeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateHome();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewHomeName("");
                  }
                }}
                placeholder="Home name…"
                className="flex-1 rounded-full bg-surface-container px-3 py-1.5 text-sm text-on-surface outline-none"
              />
              <button
                onClick={handleCreateHome}
                disabled={creatingLoading || !newHomeName.trim()}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-on-primary disabled:opacity-50"
              >
                {creatingLoading ? "…" : "Create"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm text-on-surface-variant transition hover:bg-surface-container-high"
            >
              <span className="text-base leading-none">+</span>
              Create new home
            </button>
          )}

          <div className="my-1.5" />

          <button
            onClick={() => {
              router.push("/settings");
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm text-on-surface transition hover:bg-surface-container-high"
          >
            <svg
              className="h-4 w-4 shrink-0 text-on-surface-variant"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
            Settings
          </button>

          <button
            onClick={() => {
              signOut();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm text-on-surface transition hover:bg-surface-container-high"
          >
            <svg
              className="h-4 w-4 shrink-0 text-on-surface-variant"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z"
                clipRule="evenodd"
              />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
