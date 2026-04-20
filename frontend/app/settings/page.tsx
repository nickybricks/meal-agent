/**
 * settings/page.tsx — Settings page (route: /settings).
 *
 * Sections:
 * 1. API Keys — masked text inputs for OPENAI_API_KEY, ANTHROPIC_API_KEY,
 *    GOOGLE_API_KEY, LANGCHAIN_API_KEY. Saved to localStorage (never sent to
 *    backend directly; injected into chat requests as headers or body fields).
 *
 * 2. Model Parameters — sliders for temperature (0–2), top-p (0–1),
 *    max tokens (256–4096). Persisted in localStorage.
 *
 * 3. Tool Toggles — one toggle per agent tool (search_recipes, get_user_profile,
 *    save_preference, substitute_ingredient, generate_meal_plan).
 *    Saved in localStorage; sent in ChatRequest.enabled_tools.
 *
 * 4. Ollama Status — shows connection status to OLLAMA_HOST and lists
 *    installed models. Polls GET /models on load.
 *
 * 5. LangSmith Status — shows whether LANGCHAIN_TRACING_V2 is enabled.
 *    Links to the LangSmith project dashboard.
 *
 * 6. Memory Controls — button to clear feedback history for the current user
 *    (calls Supabase delete directly via supabase.ts).
 */

export default function SettingsPage() {
  // TODO: implement in Phase 3
  return <main>Settings — coming soon</main>;
}
