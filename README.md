# Meal Agent

A conversational AI agent that acts as a personal chef assistant for daily meal planning. It suggests recipes based on available ingredients, remembers user preferences, learns from feedback, and supports multiple LLM providers (cloud and local).

## Features

- **Conversational chat** — natural-language recipe and meal planning assistant
- **Multi-provider LLMs** — OpenAI, Anthropic, Google, and local Ollama models
- **Stateful agent** — LangGraph graph with checkpoints; edit any past prompt to rewind and rerun
- **Feedback loop** — thumbs up/down on recipes; preferences are stored and injected into future runs
- **Multi-user** — per-user preferences, feedback, and chat history
- **Session list** — sidebar shows recent chat sessions; switch or start new sessions
- **Persistent settings** — model, personality, and tool toggles survive page reloads via localStorage
- **Personality toggle** — Friendly / Professional / Concise
- **Recipe lookups** — TheMealDB integration (free, no key required)
- **Tracing** — every run traced through LangSmith

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python), Pydantic
- **Agent:** LangGraph + LangChain
- **Database:** Supabase (Postgres)
- **Observability:** LangSmith
- **Recipes:** TheMealDB API

## Agent Tools

1. `search_recipes` — TheMealDB lookup
2. `get_user_profile` — load preferences from Supabase
3. `save_preference` — persist feedback to Supabase
4. `substitute_ingredient` — LLM-powered ingredient swaps
5. `generate_meal_plan` — weekly plan via LLM + TheMealDB

Each tool is independently toggleable in settings.

## Supported Models

**Cloud:** `gpt-4o-mini`, `gpt-4o`, `claude-3-5-haiku`, `claude-3-5-sonnet`, `gemini-2.0-flash`, `gemini-1.5-pro`

**Local (Ollama):** `llama3.2:3b`, `llama3.2:8b`, `mistral:7b`, `gemma3:4b`, `phi4:14b`, `deepseek-r1:8b`, `qwen2.5:7b`

## Project Layout

```
meal-agent/
├── frontend/        # Next.js 14 app
│   ├── app/         # routes: chat, profile, settings, meal-plan
│   ├── components/  # chat, sidebar, settings
│   └── lib/         # api client, supabase client, types
├── backend/
│   ├── main.py         # FastAPI routes
│   ├── agent.py        # LangGraph graph
│   ├── model_router.py # model factory
│   ├── tools.py        # agent tools
│   ├── memory.py       # memory system
│   ├── database.py     # Supabase queries
│   ├── config.py       # model configs
│   └── schemas.py      # Pydantic models
└── docs/
    └── plan.md
```

## Setup

### 1. Clone

```bash
git clone https://github.com/nickybricks/meal-agent.git
cd meal-agent
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in the keys you plan to use:

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=meal-agent
OLLAMA_HOST=http://localhost:11434
```

You only need keys for the providers you actually want to use. Ollama is optional (for local models).

### 3. Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Backend runs on `http://localhost:8000`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## API Endpoints

| Method | Path                   | Purpose                              |
| ------ | ---------------------- | ------------------------------------ |
| Method | Path                      | Purpose                              |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/models`                 | List available models (cloud + Ollama) |
| POST   | `/chat`                   | Start or continue a LangGraph run    |
| POST   | `/edit`                   | Rerun from a checkpoint after edit   |
| POST   | `/feedback`               | Store thumbs up/down                 |
| GET    | `/users`                  | List all users                       |
| GET    | `/users/{id}`             | Fetch profile/preferences            |
| GET    | `/sessions/{user_id}`     | List chat sessions for a user        |
| GET    | `/history/{session_id}`   | Chat history                         |

## License

MIT
