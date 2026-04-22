"use client";

import { useEffect, useState } from "react";

import { BASE_URL } from "@/lib/api";
import {
  listPending,
  onQueueChange,
  shiftPending,
  unshiftPending,
  type PendingRequest,
} from "@/lib/offline-queue";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const POLL_INTERVAL_MS = 30_000;

async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function replay(req: PendingRequest): Promise<"ok" | "drop" | "retry"> {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${req.endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });
    if (res.ok) return "ok";
    if (res.status >= 400 && res.status < 500) return "drop";
    return "retry";
  } catch {
    return "retry";
  }
}

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [queueLen, setQueueLen] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let lastOnline = true;
    let isFlushing = false;

    const refreshCount = () => {
      if (!cancelled) setQueueLen(listPending().length);
    };

    const flushQueue = async () => {
      if (isFlushing) return;
      if (listPending().length === 0) {
        refreshCount();
        return;
      }
      isFlushing = true;
      if (!cancelled) setFlushing(true);
      try {
        while (!cancelled) {
          const req = shiftPending();
          if (!req) break;
          const result = await replay(req);
          if (result === "retry") {
            unshiftPending(req);
            break;
          }
        }
      } finally {
        isFlushing = false;
        if (!cancelled) {
          setFlushing(false);
          refreshCount();
        }
      }
    };

    const check = async () => {
      if (cancelled) return;
      const navOnline =
        typeof navigator === "undefined" ? true : navigator.onLine;
      const healthy = navOnline ? await pingHealth() : false;
      if (cancelled) return;
      setOnline(healthy);
      if (healthy && !lastOnline) {
        void flushQueue();
      }
      lastOnline = healthy;
      timer = window.setTimeout(check, POLL_INTERVAL_MS);
    };

    const onOnline = () => { void check(); };
    const onOffline = () => {
      lastOnline = false;
      setOnline(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsubscribe = onQueueChange(refreshCount);

    refreshCount();
    void check();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsubscribe();
    };
  }, []);

  if (online && queueLen === 0 && !flushing) return null;

  const bg = !online
    ? "bg-error-container text-brand-error"
    : flushing
      ? "bg-secondary-container text-on-secondary-container"
      : "bg-surface-container-high text-on-surface";

  let message: string;
  if (!online) {
    message =
      queueLen > 0
        ? `Offline — ${queueLen} message${queueLen === 1 ? "" : "s"} queued for retry.`
        : "Offline — new messages will be queued until the backend is reachable.";
  } else if (flushing) {
    message = `Reconnected — syncing ${queueLen} queued message${queueLen === 1 ? "" : "s"}…`;
  } else {
    message = `${queueLen} queued message${queueLen === 1 ? "" : "s"} pending.`;
  }

  return (
    <div
      role="status"
      className={`${bg} px-4 py-2 text-center text-sm`}
    >
      {message}
    </div>
  );
}
