/**
 * ApiKeyManager.tsx — API key input fields for cloud providers.
 *
 * Manages keys for: OpenAI, Anthropic, Google, LangSmith.
 * Keys are stored in localStorage under predictable keys (e.g. "openai_api_key").
 * They are never sent to the backend as env vars; instead, the frontend
 * includes them in ChatRequest headers so the backend can forward them to the LLM SDK.
 *
 * Features:
 * - Masked input (type="password") with a show/hide toggle
 * - "Save" button per key with a brief success indicator
 * - "Clear" button to remove a key from localStorage
 */

// TODO: implement in Phase 3
export default function ApiKeyManager() {
  return null;
}
