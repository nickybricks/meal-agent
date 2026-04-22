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
- **Tracing** — every run traced through LangSmith

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python), Pydantic
- **Agent:** LangGraph + LangChain
- **Database:** Supabase (Postgres)
- **Observability:** LangSmith

## Agent Tools

1. `get_user_profile` — load preferences from Supabase
2. `save_preference` — persist feedback to Supabase
3. `substitute_ingredient` — LLM-powered ingredient swaps
4. `generate_meal_plan` — weekly plan via LLM

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
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
ALLOWED_ORIGINS=
ENV=dev
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=meal-agent
OLLAMA_HOST=http://localhost:11434
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

You only need keys for the providers you actually want to use. Ollama is optional (for local models).

`SUPABASE_SERVICE_ROLE_KEY` is required by the backend to bypass RLS. `ADMIN_EMAIL` grants the `/admin` page to a single account. `ALLOWED_ORIGINS` is a comma-separated list of origins accepted by CORS when `ENV != dev` (e.g. `https://your-app.vercel.app`); when `ENV=dev`, the backend additionally allows the local LAN regex. The three `NEXT_PUBLIC_*` vars are read by the Next.js frontend and should be set in `frontend/.env.local` (or in the Vercel project).

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

## Deploy

The frontend is designed for Vercel, the backend for Railway (or any Docker host).

### Frontend → Vercel

1. From the Vercel dashboard, import the repo and set the **Root Directory** to `frontend/`. The bundled [frontend/vercel.json](frontend/vercel.json) pins the Next.js framework preset.
2. Set these environment variables in the Vercel project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` — the Railway URL of the backend (e.g. `https://meal-agent-api.up.railway.app`)
3. Deploy. Note the production URL — you'll need it for `ALLOWED_ORIGINS` below.

### Backend → Railway

The backend ships with both a [backend/Dockerfile](backend/Dockerfile) and a [backend/Procfile](backend/Procfile); Railway will use whichever builder you pick.

1. Create a new Railway service from the repo. If using the Docker builder, set the build context to the repo root and point it at `backend/Dockerfile`. If using Nixpacks/Buildpacks, set the root to `backend/` so the Procfile is picked up.
2. Set these environment variables on the service:
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` (whichever you use)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAIL` — the email that should see `/admin`
   - `ALLOWED_ORIGINS` — the Vercel production URL (comma-separated if more than one)
   - `ENV=production`
   - `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` (optional)
3. Deploy. Railway injects `PORT`; both the Dockerfile CMD and the Procfile bind to it.

### Supabase

Before either deploy is useful, apply the migrations to your Supabase project (SQL editor):

1. `supabase_schema.sql` — base tables
2. `supabase_migration_diet.sql` — dietary prefs columns
3. `002_auth_homes.sql` — auth, homes, invitations, RLS, and the `auth.users` trigger
4. `003_meal_plan.sql` — meal plan tables
5. `004_saved_recipes.sql` — saved recipes
6. `005_expanded_preferences.sql` — expanded user preferences
7. `006_measurement_system.sql` — measurement system preference
8. `007_recipe_macros.sql` — recipe macro tracking

Apply these SQL files via the Supabase SQL editor in order.

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
