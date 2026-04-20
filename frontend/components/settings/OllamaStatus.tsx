/**
 * OllamaStatus.tsx — Shows Ollama connection health and installed models.
 *
 * On mount, calls GET /models and inspects the "ollama" provider entries.
 * If none found, shows a "Not connected" badge; otherwise lists detected models.
 *
 * Also shows the OLLAMA_HOST value (read from the /models response metadata)
 * and a "Refresh" button to re-poll.
 */

// TODO: implement in Phase 3
export default function OllamaStatus() {
  return null;
}
