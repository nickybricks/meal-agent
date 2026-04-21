/**
 * LangSmithStatus.tsx — Shows LangSmith tracing configuration status.
 *
 * No dedicated backend endpoint yet; we assume tracing is enabled if the
 * /health endpoint responds, and surface the project name via env var.
 */

"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export default function LangSmithStatus() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const project = process.env.NEXT_PUBLIC_LANGCHAIN_PROJECT ?? "recipe-agent";

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => {
        if (!cancelled) setHealthy(true);
      })
      .catch(() => {
        if (!cancelled) setHealthy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const badge =
    healthy === null
      ? { text: "Checking…", cls: "bg-neutral-200 text-neutral-600" }
      : healthy
        ? { text: "Backend reachable", cls: "bg-green-100 text-green-800" }
        : { text: "Backend unreachable", cls: "bg-red-100 text-red-700" };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs ${badge.cls}`}>
          {badge.text}
        </span>
        <span className="text-xs text-neutral-500">Project: {project}</span>
      </div>
      <a
        href={`https://smith.langchain.com/projects`}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Open LangSmith dashboard
      </a>
      <p className="text-[11px] text-neutral-500">
        Tracing is controlled by <code>LANGCHAIN_TRACING_V2</code> in the backend
        <code>.env</code>.
      </p>
    </div>
  );
}
