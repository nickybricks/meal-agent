"""
main.py — FastAPI application entry point.

Builds the LangGraph agent once at startup and serves all API routes.
"""

from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import database
import agent as agent_module
from model_router import list_available_models
from schemas import (
    ChatRequest, ChatResponse,
    EditRequest,
    FeedbackRequest,
    UserProfile,
    UserSummary, UserListResponse,
    ModelListResponse, ModelInfo,
    HistoryMessage, HistoryResponse,
    SessionSummary, SessionListResponse,
)

_graph = None


def _as_str_list(value) -> list[str]:
    """Coerce a preferences field from Supabase to a clean list of strings.

    Guards against legacy/corrupt rows where a value was stored as a string
    (e.g. a JSON-encoded list) instead of a Postgres array.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    return []


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _graph
    _graph = agent_module.build_graph()
    yield


app = FastAPI(title="Recipe Agent API", lifespan=lifespan)

# Allow localhost + private LAN ranges (RFC1918) on any port so an iPhone
# or other device on the same network can hit the dev server.
_LAN_ORIGIN_REGEX = (
    r"^http://("
    r"localhost"
    r"|127\.0\.0\.1"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _extract_reply(messages: list) -> str:
    for msg in reversed(messages):
        if hasattr(msg, "content") and not getattr(msg, "tool_calls", None):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    return ""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/models", response_model=ModelListResponse)
def get_models():
    models = list_available_models()
    return ModelListResponse(models=[ModelInfo(**m) for m in models])


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    config = {"configurable": {"thread_id": f"{req.user_id}:{req.session_id}"}}

    state_input = {
        "messages": [{"role": "user", "content": req.message}],
        "user_id": req.user_id,
        "session_id": req.session_id,
        "user_profile": {},
        "model_name": req.model,
        "temperature": req.temperature,
        "top_p": req.top_p,
        "max_tokens": req.max_tokens,
        "personality": req.personality,
        "enabled_tools": req.enabled_tools,
        "current_recipe": None,
        "feedback_history": [],
        "last_checkpoint_id": "",
    }

    try:
        result = await agent_module.run_graph(_graph, state_input, config)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Agent run failed: {e.__class__.__name__}. Please try again.",
        )

    reply = _extract_reply(result.get("messages", []))
    checkpoint_id = result.get("last_checkpoint_id", "")
    tokens = result.get("tokens_used")

    try:
        database.save_chat_message(req.user_id, req.session_id, "user", req.message,
                                   model_used=req.model)
        database.save_chat_message(req.user_id, req.session_id, "assistant", reply,
                                   checkpoint_id=checkpoint_id, model_used=req.model,
                                   tokens_used=tokens)
    except Exception as e:
        # Non-fatal — the reply still goes back to the user, but log so the
        # dev can see when Supabase is misconfigured or tables are missing.
        print(f"[chat] save_chat_message failed: {e.__class__.__name__}: {e}")

    return ChatResponse(
        reply=reply,
        checkpoint_id=checkpoint_id,
        tokens_used=tokens,
        model_used=req.model,
    )


@app.post("/edit", response_model=ChatResponse)
async def edit(req: EditRequest):
    config = {"configurable": {"thread_id": f"{req.user_id}:{req.session_id}"}}

    overrides = {
        "model_name": req.model,
        "temperature": req.temperature,
        "top_p": req.top_p,
        "max_tokens": req.max_tokens,
    }

    try:
        result = await agent_module.rewind_and_run(
            _graph, req.checkpoint_id, req.new_message, config, overrides=overrides,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Edit re-run failed: {e.__class__.__name__}. Please try again.",
        )

    reply = _extract_reply(result.get("messages", []))
    checkpoint_id = result.get("last_checkpoint_id", "")
    tokens = result.get("tokens_used")

    try:
        database.save_chat_message(req.user_id, req.session_id, "user", req.new_message,
                                   model_used=req.model)
        database.save_chat_message(req.user_id, req.session_id, "assistant", reply,
                                   checkpoint_id=checkpoint_id, model_used=req.model,
                                   tokens_used=tokens)
    except Exception as e:
        print(f"[edit] save_chat_message failed: {e.__class__.__name__}: {e}")

    return ChatResponse(
        reply=reply,
        checkpoint_id=checkpoint_id,
        tokens_used=tokens,
        model_used=req.model,
    )


@app.post("/feedback")
def feedback(req: FeedbackRequest):
    try:
        database.save_feedback(
            user_id=req.user_id,
            recipe_name=req.recipe_name,
            rating=req.rating,
            ingredients=req.ingredients,
            cuisine=req.cuisine,
            model_used=req.model_used,
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Couldn't save your feedback right now. Please try again.",
        )
    return {"status": "ok"}


@app.get("/users", response_model=UserListResponse)
def list_users():
    try:
        rows = database.list_users()
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list users.")
    return UserListResponse(
        users=[UserSummary(id=str(r["id"]), name=r.get("name", "")) for r in rows]
    )


@app.get("/users/{user_id}", response_model=UserProfile)
def get_user(user_id: str):
    try:
        user = database.get_user(user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load user profile.")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        prefs = database.get_preferences(user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load preferences.")
    return UserProfile(
        id=str(user["id"]),
        name=user.get("name", ""),
        diet=_as_str_list(prefs.get("diet")),
        disliked_ingredients=_as_str_list(prefs.get("disliked_ingredients")),
        favorite_cuisines=_as_str_list(prefs.get("favorite_cuisines")),
    )


@app.get("/sessions/{user_id}", response_model=SessionListResponse)
def list_sessions(user_id: str):
    try:
        rows = database.list_sessions(user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load sessions.")
    return SessionListResponse(
        sessions=[
            SessionSummary(
                session_id=str(r["session_id"]),
                title=r.get("title") or "",
                last_at=str(r["last_at"]),
            )
            for r in rows
        ]
    )


@app.get("/history/{session_id}", response_model=HistoryResponse)
def get_history(session_id: str):
    try:
        rows = database.get_chat_history(session_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load chat history.")
    messages = [
        HistoryMessage(
            id=str(row["id"]),
            role=row["role"],
            content=row["content"],
            checkpoint_id=row.get("checkpoint_id"),
            model_used=row.get("model_used"),
            tokens_used=row.get("tokens_used"),
            created_at=str(row["created_at"]),
        )
        for row in rows
    ]
    return HistoryResponse(session_id=session_id, messages=messages)
