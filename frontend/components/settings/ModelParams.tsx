/**
 * ModelParams.tsx — Sliders for LLM generation parameters.
 *
 * Props / controlled state (lifted to settings page):
 *   temperature: number    0.0 – 2.0   (step 0.1, default 0.7)
 *   topP: number           0.0 – 1.0   (step 0.05, default 1.0)
 *   maxTokens: number      256 – 4096  (step 64, default 1024)
 *   onChange: (params: { temperature, topP, maxTokens }) => void
 *
 * Each slider shows its current value next to the label.
 * Values are persisted in localStorage and read on app load.
 */

// TODO: implement in Phase 3
export default function ModelParams() {
  return null;
}
