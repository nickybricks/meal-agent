# Recipe & Meal Planning Agent

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


## Project Overview
A conversational AI agent that acts as a personal chef assistant for daily meal planning. It suggests recipes based on available ingredients, remembers user preferences, learns from feedback, and supports multiple LLM providers.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend:** FastAPI (Python)
- **Agent Framework:** LangGraph (stateful graph with checkpoints)
- **Database:** Supabase (Postgres - cloud-synced)
- **Observability:** LangSmith (tracing every run)
- **Recipe API:** TheMealDB (free, no key required)

## Directory Layout
```
recipe-agent/
├── frontend/                # Next.js 14
│   ├── app/
│   │   ├── page.tsx         # Main chat
│   │   ├── profile/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── meal-plan/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── chat/            # ChatWindow, ChatMessage, ChatInput, EditPrompt, FeedbackButtons
│   │   ├── sidebar/         # Sidebar, ModelSelector, UserSelector, PersonalityToggle, StatsPanel
│   │   └── settings/        # ApiKeyManager, ModelParams, OllamaStatus, ToolToggle, LangSmithStatus
│   └── lib/
│       ├── api.ts           # FastAPI client
│       ├── supabase.ts      # Supabase client
│       └── types.ts         # TypeScript types
├── backend/
│   ├── main.py              # FastAPI routes
│   ├── agent.py             # LangGraph graph
│   ├── model_router.py      # Model factory
│   ├── tools.py             # 5 agent tools
│   ├── memory.py            # Memory system
│   ├── database.py          # Supabase queries
│   ├── config.py            # Model configs
│   └── schemas.py           # Pydantic models
├── docs/
│   └── plan.md              # Full product plan
├── .env.example
├── requirements.txt
└── README.md
```

## Key Conventions
- All LLM calls go through `model_router.py` - never instantiate models directly
- LangGraph graph defined in `agent.py` with nodes: LoadProfile -> ProcessQuery -> Tools/DirectReply -> GenerateResponse -> Checkpoint -> AwaitFeedback
- Environment variables in `.env` (never commit - use `.env.example`)
- Supabase tables: users, preferences, feedback, chat_history, checkpoints
- Every agent run is traced via LangSmith (`LANGCHAIN_TRACING_V2=true`)

## Models Supported
### Cloud
- OpenAI: `gpt-4o-mini`, `gpt-4o`
- Anthropic: `claude-3-5-haiku`, `claude-3-5-sonnet`
- Google: `gemini-2.0-flash`, `gemini-1.5-pro`

### Local (Ollama)
- `llama3.2:3b`, `llama3.2:8b`, `mistral:7b`, `gemma3:4b`, `phi4:14b`, `deepseek-r1:8b`, `qwen2.5:7b`

## Agent Tools (5 total, each toggleable in settings)
1. `search_recipes` - TheMealDB API lookup
2. `get_user_profile` - Load preferences from Supabase
3. `save_preference` - Save feedback to Supabase
4. `substitute_ingredient` - LLM-powered ingredient swaps
5. `generate_meal_plan` - Weekly plan via LLM + TheMealDB

## Key Features
- **Edit Prompt / Rewind:** User can edit any previous message -> backend rewinds to that LangGraph checkpoint and reruns
- **Feedback Loop:** thumbs up/down on recipes -> stored in Supabase -> injected into system prompt on future runs
- **Multi-user:** User selector in sidebar, each with separate preferences/feedback
- **Personality Toggle:** Friendly / Professional / Concise

## API Endpoints (FastAPI)
- `GET /models` - list available models (cloud + detected Ollama)
- `POST /chat` - start/continue LangGraph run
- `POST /edit` - rerun from checkpoint after prompt edit
- `POST /feedback` - store thumbs up/down
- `GET /users/{id}` - fetch profile/preferences
- `GET /history/{session_id}` - chat history

## Environment Variables (.env)
```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=recipe-agent
OLLAMA_HOST=http://localhost:11434
```

## Important Notes
- Do NOT modify files outside the scope of the current task
- Always use TypeScript for frontend code
- Use Pydantic models for all API request/response schemas
- Handle Ollama connection failures gracefully (it may not be running)
- TheMealDB base URL: `https://themealdb.com/api/json/v1/1/`

## Release Workflow

When the user asks to push and release, follow these steps. Decide the version bump yourself (semver):
- **major** (`x.0.0`) — breaking changes
- **minor** (`0.x.0`) — new features, no breaking changes
- **patch** (`0.0.x`) — bug fixes / small tweaks

### 1. Pick the version

Check latest tag with `git describe --tags --abbrev=0` (or start at `v0.1.0` if none). Decide bump based on the diff.

### 2. Update README.md

Before pushing, ensure `README.md` reflects:
- Any new features or changes
- Updated tech stack if dependencies changed
- Updated setup instructions if env vars or steps changed

### 3. Commit & Tag

```bash
git add -A
git commit -m "v{VERSION}: {Brief description of changes}"
git tag v{VERSION}
```

### 4. Push

```bash
git push {remote} main --tags
```

- Default remote is `origin`
- Always push tags with `--tags`

### 5. Create GitHub Release

```bash
gh release create v{VERSION} --title "v{VERSION}: {Brief description}" --notes "{Release notes in markdown}"
```

- Always create a GitHub release after pushing a new tag
- Include a `## Changes` section with bullet points summarizing what changed
- The release title should match the commit message format: `v{VERSION}: {Brief description}`
