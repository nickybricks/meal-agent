/**
 * ModelSelector.tsx — Dropdown to choose the active LLM model.
 *
 * Props:
 *   models: ModelInfo[]         — fetched from GET /models on app load
 *   selectedModel: string
 *   onChange: (modelId: string) => void
 *
 * Groups models by provider (OpenAI, Anthropic, Google, Ollama).
 * Ollama models are only shown if the backend detected them as running.
 */

// TODO: implement in Phase 3
export default function ModelSelector() {
  return null;
}
