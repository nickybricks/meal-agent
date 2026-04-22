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
      ? { text: "Checking…", cls: "bg-surface-container text-on-surface-variant" }
      : healthy
        ? { text: "Backend reachable", cls: "bg-primary-container text-on-surface" }
        : { text: "Backend unreachable", cls: "bg-error-container text-brand-error" };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-0.5 text-xs ${badge.cls}`}>
          {badge.text}
        </span>
        <span className="text-xs text-on-surface-variant">Project: {project}</span>
      </div>
      <a
        href="https://smith.langchain.com/projects"
        target="_blank"
        rel="noreferrer"
        className="text-xs text-tertiary hover:underline"
      >
        Open LangSmith dashboard
      </a>
      <p className="text-[11px] text-on-surface-variant">
        Tracing is controlled by <code>LANGCHAIN_TRACING_V2</code> in the backend
        <code>.env</code>.
      </p>
    </div>
  );
}
