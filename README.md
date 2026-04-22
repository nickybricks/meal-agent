# Melagent — Your Personal AI Chef Assistant

Melagent is a conversational AI agent that helps households plan meals, discover recipes, and remember everyone's food preferences. It acts as a personal chef that learns what you like (and don't like) over time, powered by GPT-4o Mini via a LangGraph agent pipeline.

## What It Does

- **Chat-based recipe discovery** — Ask for dinner ideas in natural language. The agent considers your dietary restrictions, allergies, disliked ingredients, and favourite cuisines before suggesting anything.
- **Learns from feedback** — Thumbs-up or thumbs-down any recipe. The agent remembers liked and disliked recipes and adjusts future suggestions accordingly.
- **Avoids repetition** — Recently saved recipes are injected into the system prompt so the agent doesn't suggest the same dish twice.
- **Ingredient substitution** — Ask "what can I use instead of butter?" and get 3 alternatives with rationale and quantity adjustments.
- **Meal planning** — Generate a multi-day meal plan tailored to your preferences, viewable on a weekly calendar.
- **Recipe library** — Save recipes from chat to a persistent library with ingredients, steps, and photos.
- **Multi-user households** — Create a "Home", invite family members, and share preferences and meal plans.
- **Conversation history** — Switch between past chat sessions; edit any previous message to rewind and get a new response.
- **Personality modes** — Toggle between Friendly, Professional, and Concise response styles.

## What It Can't Do (Yet)

- **No real-time data** — It doesn't check grocery prices, store availability, or current food trends.
- **No image recognition** — You can't snap a photo of your fridge and ask "what can I make?"
- **No nutritional calculations** — Macro/calorie estimates are LLM-generated, not from a verified database.
- **Single LLM at a time** — The backend supports multiple providers (OpenAI, Anthropic, Google, Ollama) but the app currently defaults to GPT-4o Mini without a user-facing model switcher.
- **In-memory checkpoints** — LangGraph state lives in process memory; a server restart loses thread context (chat history in Supabase survives, but the agent can't resume mid-conversation).
- **No offline mode** — Requires an internet connection for both the LLM API and Supabase.

## Tech Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Frontend      | Next.js 14, TypeScript, Tailwind CSS    |
| Backend       | FastAPI, Python, Pydantic               |
| Agent         | LangGraph + LangChain                   |
| Database      | Supabase (Postgres)                     |
| Auth          | Supabase Auth (JWT)                     |
| Observability | LangSmith                               |

## Future Plans

- [ ] **AI recipe image generation** — Let users generate AI-created images for any recipe (saved or agent-suggested) so the recipe library feels visual and appetising
- [ ] **1–5 star ratings** — Upgrade the current binary thumbs up/down to a granular 1–5 star system, giving the agent finer-grained signal about what the user enjoys
- [ ] **Auto-save every suggestion** — Persist every recipe the agent suggests (not just ones the user explicitly saves), so the agent has a complete history and never re-suggests a dish unless asked
- [ ] User-facing model selector (the multi-provider router already exists in the backend)
- [ ] Photo-based ingredient detection ("what's in my fridge?")
- [ ] Verified nutritional data via an external API
- [ ] Persistent LangGraph checkpoints (survive server restarts)
- [ ] Shopping list generation from meal plans
- [ ] Recipe sharing / export (PDF, share link)
- [ ] Mobile-optimised PWA
- [ ] Smarter feedback loop — fine-tune or use RAG over the user's recipe history

## License

MIT
