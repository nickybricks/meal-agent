/**
 * LangSmithStatus.tsx — Shows LangSmith tracing configuration status.
 *
 * Reads LANGCHAIN_TRACING_V2 status from a GET /health (or dedicated) endpoint.
 * Shows:
 * - Green badge "Tracing enabled" or grey badge "Tracing disabled"
 * - The project name (LANGCHAIN_PROJECT)
 * - A link to smith.langchain.com/projects for the configured project
 *
 * No interactive controls — tracing is configured server-side via env vars.
 */

// TODO: implement in Phase 3
export default function LangSmithStatus() {
  return null;
}
