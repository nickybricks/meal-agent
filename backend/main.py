"""
main.py — FastAPI application entry point.

Builds the LangGraph agent once at startup and serves all API routes.
All non-public routes require a Supabase JWT via `require_current_user`;
the caller's user id is always derived from the token. Per-home routes
additionally enforce membership via `require_home_member`.
"""

from contextlib import asynccontextmanager
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(override=True)

import json

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import config
import database
import agent as agent_module
from auth import CurrentUser, require_current_user, require_home_member, require_home_role
from model_router import list_available_models
from schemas import (
    ChatRequest, ChatResponse, StructuredRecipe, RecipeIngredient, SavedRecipeOut,
    EditRequest,
    FeedbackRequest,
    UserProfile, PreferencesUpdate,
    UserSummary, UserListResponse,
    ModelListResponse, ModelInfo,
    HistoryMessage, HistoryResponse,
    SessionSummary, SessionListResponse,
    MeResponse,
    HomeCreate, HomeOut, HomeListResponse,
    MemberOut, MemberListResponse,
    InvitationCreate, InvitationOut, InvitationListResponse,
    AdminHomeOut, AdminHomeListResponse,
    AdminFeedbackRow, AdminFeedbackListResponse,
    MealPlanEntryCreate, MealPlanEntryOut, MealPlanListResponse,
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

# CORS: allow-list from ALLOWED_ORIGINS env var plus LAN regex in dev.
_LAN_ORIGIN_REGEX = (
    r"^http://("
    r"localhost"
    r"|127\.0\.0\.1"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?$"
)
_env = (os.environ.get("ENV") or "dev").lower()
_allowed = [o.strip() for o in (os.environ.get("ALLOWED_ORIGINS") or "").split(",") if o.strip()]
# In prod, allow_credentials=True requires explicit origins (not "*").
# Fall back to no credentials if no origins are configured.
_use_credentials = bool(_allowed) or _env == "dev"
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed if _env != "dev" else [],
    allow_origin_regex=_LAN_ORIGIN_REGEX if _env == "dev" else None,
    allow_credentials=_use_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _extract_reply(messages: list) -> str:
    for msg in reversed(messages):
        if hasattr(msg, "content") and not getattr(msg, "tool_calls", None):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    return ""


def _extract_saved_recipe(messages: list) -> StructuredRecipe | None:
    """Find the most recent save_recipe tool call in the message list and return its args as StructuredRecipe."""
    for msg in reversed(messages):
        tool_calls = getattr(msg, "tool_calls", None) or []
        for tc in tool_calls:
            if tc.get("name") == "save_recipe":
                args = tc.get("args", {})
                try:
                    return StructuredRecipe(
                        name=args["name"],
                        description=args.get("description", ""),
                        servings=args.get("servings", 1),
                        prep_time_minutes=args.get("prep_time_minutes", 0),
                        cook_time_minutes=args.get("cook_time_minutes", 0),
                        ingredients=[
                            RecipeIngredient(**ing) if isinstance(ing, dict) else ing
                            for ing in args.get("ingredients", [])
                        ],
                        steps=args.get("steps", []),
                        cuisine=args.get("cuisine", ""),
                        tags=args.get("tags", []),
                    )
                except Exception:
                    return None
    return None


# ---------------------------------------------------------------------------
# Public routes (no auth)
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/models", response_model=ModelListResponse)
def get_models():
    models = list_available_models()
    return ModelListResponse(models=[ModelInfo(**m) for m in models])


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(req.home_id, user)
    user_id, home_id = user.id, req.home_id

    graph_config = {"configurable": {"thread_id": f"{home_id}:{user_id}:{req.session_id}"}}

    state_input = {
        "messages": [{"role": "user", "content": req.message}],
        "user_id": user_id,
        "home_id": home_id,
        "session_id": req.session_id,
        "user_profile": {},
        "model_name": config.DEFAULT_MODEL,
        "temperature": config.DEFAULT_TEMPERATURE,
        "top_p": config.DEFAULT_TOP_P,
        "max_tokens": config.DEFAULT_MAX_TOKENS,
        "personality": config.DEFAULT_PERSONALITY,
        "enabled_tools": config.DEFAULT_ENABLED_TOOLS,
        "current_recipe": None,
        "feedback_history": [],
        "recent_recipes": [],
        "last_checkpoint_id": "",
    }

    try:
        result = await agent_module.run_graph(_graph, state_input, graph_config)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Agent run failed: {e.__class__.__name__}. Please try again.",
        )

    messages = result.get("messages", [])
    reply = _extract_reply(messages)
    recipe = _extract_saved_recipe(messages)
    checkpoint_id = result.get("last_checkpoint_id", "")
    tokens = result.get("tokens_used")

    try:
        database.save_chat_message(
            user_id, req.session_id, "user", req.message,
            model_used=config.DEFAULT_MODEL, home_id=home_id,
        )
        database.save_chat_message(
            user_id, req.session_id, "assistant", reply,
            checkpoint_id=checkpoint_id, model_used=config.DEFAULT_MODEL,
            tokens_used=tokens, home_id=home_id,
        )
    except Exception as e:
        print(f"[chat] save_chat_message failed: {e.__class__.__name__}: {e}")

    return ChatResponse(
        reply=reply,
        checkpoint_id=checkpoint_id,
        tokens_used=tokens,
        model_used=config.DEFAULT_MODEL,
        recipe=recipe,
    )


@app.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(req.home_id, user)
    user_id, home_id = user.id, req.home_id

    graph_config = {"configurable": {"thread_id": f"{home_id}:{user_id}:{req.session_id}"}}

    state_input = {
        "messages": [{"role": "user", "content": req.message}],
        "user_id": user_id,
        "home_id": home_id,
        "session_id": req.session_id,
        "user_profile": {},
        "model_name": config.DEFAULT_MODEL,
        "temperature": config.DEFAULT_TEMPERATURE,
        "top_p": config.DEFAULT_TOP_P,
        "max_tokens": config.DEFAULT_MAX_TOKENS,
        "personality": config.DEFAULT_PERSONALITY,
        "enabled_tools": config.DEFAULT_ENABLED_TOOLS,
        "current_recipe": None,
        "feedback_history": [],
        "recent_recipes": [],
        "last_checkpoint_id": "",
    }

    async def generate():
        try:
            async for event in _graph.astream_events(state_input, graph_config, version="v2"):
                if event["event"] == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    content = chunk.content
                    if isinstance(content, list):
                        content = "".join(
                            c.get("text", "") if isinstance(c, dict) else str(c)
                            for c in content
                        )
                    if isinstance(content, str) and content:
                        yield json.dumps({"type": "chunk", "content": content}) + "\n"

            snapshot = await _graph.aget_state(graph_config)
            messages = list(snapshot.values.get("messages", []))
            reply = _extract_reply(messages)
            recipe = _extract_saved_recipe(messages)
            checkpoint_id = snapshot.config.get("configurable", {}).get("checkpoint_id", "")
            tokens = snapshot.values.get("tokens_used")

            try:
                database.save_chat_message(
                    user_id, req.session_id, "user", req.message,
                    model_used=config.DEFAULT_MODEL, home_id=home_id,
                )
                database.save_chat_message(
                    user_id, req.session_id, "assistant", reply,
                    checkpoint_id=checkpoint_id, model_used=config.DEFAULT_MODEL,
                    tokens_used=tokens, home_id=home_id,
                )
            except Exception as e:
                print(f"[chat_stream] save_chat_message failed: {e.__class__.__name__}: {e}")

            yield json.dumps({
                "type": "done",
                "checkpoint_id": checkpoint_id,
                "model_used": config.DEFAULT_MODEL,
                "tokens_used": tokens,
                "recipe": recipe.model_dump() if recipe else None,
            }) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": f"Stream failed: {e.__class__.__name__}"}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/edit", response_model=ChatResponse)
async def edit(
    req: EditRequest,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(req.home_id, user)
    user_id, home_id = user.id, req.home_id

    graph_config = {"configurable": {"thread_id": f"{home_id}:{user_id}:{req.session_id}"}}

    overrides = {
        "model_name": config.DEFAULT_MODEL,
        "temperature": config.DEFAULT_TEMPERATURE,
        "top_p": config.DEFAULT_TOP_P,
        "max_tokens": config.DEFAULT_MAX_TOKENS,
    }

    try:
        result = await agent_module.rewind_and_run(
            _graph, req.checkpoint_id, req.new_message, graph_config, overrides=overrides,
            session_id=req.session_id, home_id=home_id, user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Edit re-run failed: {e.__class__.__name__}. Please try again.",
        )

    messages = result.get("messages", [])
    reply = _extract_reply(messages)
    recipe = _extract_saved_recipe(messages)
    checkpoint_id = result.get("last_checkpoint_id", "")
    tokens = result.get("tokens_used")

    try:
        database.save_chat_message(
            user_id, req.session_id, "user", req.new_message,
            model_used=config.DEFAULT_MODEL, home_id=home_id,
        )
        database.save_chat_message(
            user_id, req.session_id, "assistant", reply,
            checkpoint_id=checkpoint_id, model_used=config.DEFAULT_MODEL,
            tokens_used=tokens, home_id=home_id,
        )
    except Exception as e:
        print(f"[edit] save_chat_message failed: {e.__class__.__name__}: {e}")

    return ChatResponse(
        reply=reply,
        checkpoint_id=checkpoint_id,
        tokens_used=tokens,
        model_used=config.DEFAULT_MODEL,
        recipe=recipe,
    )


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

@app.post("/feedback")
def feedback(
    req: FeedbackRequest,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(req.home_id, user)
    try:
        database.save_feedback(
            user_id=user.id,
            recipe_name=req.recipe_name,
            rating=req.rating,
            ingredients=req.ingredients,
            cuisine=req.cuisine,
            model_used=req.model_used,
            home_id=req.home_id,
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Couldn't save your feedback right now. Please try again.",
        )
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/users", response_model=UserListResponse)
def list_users_route(user: CurrentUser = Depends(require_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        rows = database.list_users()
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list users.")
    return UserListResponse(
        users=[UserSummary(id=str(r["id"]), name=r.get("name", "")) for r in rows]
    )


@app.get("/users/{user_id}", response_model=UserProfile)
def get_user(
    user_id: str,
    home_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        user_row = database.get_user(user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load user profile.")
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        prefs = database.get_preferences(user_id, home_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't load preferences.")
    return UserProfile(
        id=str(user_row["id"]),
        name=user_row.get("name", ""),
        diet=_as_str_list(prefs.get("diet")),
        disliked_ingredients=_as_str_list(prefs.get("disliked_ingredients")),
        favorite_cuisines=_as_str_list(prefs.get("favorite_cuisines")),
        liked_ingredients=_as_str_list(prefs.get("liked_ingredients")),
        allergies=_as_str_list(prefs.get("allergies")),
        cooking_skill_level=prefs.get("cooking_skill_level"),
        adventurousness=prefs.get("adventurousness"),
        measurement_system=prefs.get("measurement_system") or "metric",
    )


@app.patch("/preferences")
def update_preferences_route(
    body: PreferencesUpdate,
    home_id: str = Query(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        return {"status": "ok"}
    try:
        database.update_preferences_bulk(user.id, fields, home_id)
    except Exception as e:
        print(f"[preferences] update failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't update preferences.")
    return {"status": "ok"}


@app.get("/sessions/{user_id}", response_model=SessionListResponse)
def list_sessions(
    user_id: str,
    home_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        rows = database.list_sessions(user_id, home_id=home_id)
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
def get_history(
    session_id: str,
    home_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        rows = database.get_chat_history(session_id, home_id=home_id)
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


# ---------------------------------------------------------------------------
# Auth / me
# ---------------------------------------------------------------------------

@app.get("/me", response_model=MeResponse)
def me(user: CurrentUser = Depends(require_current_user)):
    return MeResponse(
        id=user.id,
        auth_id=user.auth_id,
        name=user.name,
        email=user.email,
        is_admin=user.is_admin,
    )


# ---------------------------------------------------------------------------
# Homes
# ---------------------------------------------------------------------------

def _to_home_out(row: dict) -> HomeOut:
    return HomeOut(
        id=str(row["id"]),
        name=row.get("name", ""),
        role=row.get("role", "member"),
        created_at=str(row["created_at"]) if row.get("created_at") else None,
    )


@app.post("/homes", response_model=HomeOut)
def create_home_route(
    body: HomeCreate,
    user: CurrentUser = Depends(require_current_user),
):
    try:
        home = database.create_home(body.name.strip() or "Home", user.id)
    except Exception as e:
        print(f"[homes] create failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't create home.")
    return HomeOut(
        id=str(home["id"]),
        name=home.get("name", ""),
        role="owner",
        created_at=str(home["created_at"]) if home.get("created_at") else None,
    )


@app.get("/homes", response_model=HomeListResponse)
def list_homes_route(user: CurrentUser = Depends(require_current_user)):
    try:
        rows = database.list_homes_for_user(user.id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list homes.")
    return HomeListResponse(homes=[_to_home_out(r) for r in rows])


@app.get("/homes/{home_id}/members", response_model=MemberListResponse)
def list_members_route(
    home_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        rows = database.list_members(home_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list members.")
    members = [
        MemberOut(
            user_id=str(r["user_id"]),
            name=r.get("name", ""),
            email=r.get("email"),
            role=r.get("role", "member"),
            joined_at=str(r["joined_at"]) if r.get("joined_at") else None,
        )
        for r in rows if r.get("user_id")
    ]
    return MemberListResponse(members=members)


@app.delete("/homes/{home_id}/members/{user_id}")
def remove_member_route(
    home_id: str,
    user_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_role(home_id, user, allowed={"owner", "admin"})
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You can't remove yourself here.")
    try:
        database.remove_member(home_id, user_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't remove member.")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

def _invitation_to_out(row: dict) -> InvitationOut:
    home = row.get("home") or {}
    inviter = row.get("inviter") or {}
    return InvitationOut(
        id=str(row["id"]),
        token=str(row["token"]),
        home_id=str(row["home_id"]),
        home_name=home.get("name"),
        email=row.get("email", ""),
        role=row.get("role", "member"),
        status=row.get("status", "pending"),
        expires_at=str(row["expires_at"]),
        created_at=str(row["created_at"]),
        inviter_name=inviter.get("name"),
    )


@app.post("/homes/{home_id}/invite", response_model=InvitationOut)
def create_invitation_route(
    home_id: str,
    body: InvitationCreate,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_role(home_id, user, allowed={"owner", "admin"})
    try:
        inv = database.create_invitation(
            home_id=home_id,
            email=body.email,
            invited_by=user.id,
            role=body.role,
        )
    except Exception as e:
        print(f"[invite] create failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't create invitation.")
    return _invitation_to_out(inv)


@app.get("/homes/{home_id}/invitations", response_model=InvitationListResponse)
def list_home_invitations_route(
    home_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_role(home_id, user, allowed={"owner", "admin"})
    try:
        rows = database.list_pending_invitations_for_home(home_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list invitations.")
    return InvitationListResponse(invitations=[_invitation_to_out(r) for r in rows])


@app.delete("/invitations/{invitation_id}")
def revoke_invitation_route(
    invitation_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    # Revoke is scoped to home role — we don't have the home_id in the path,
    # so look it up and authorise against it.
    resp = database.get_service_client().table("invitations").select("home_id").eq("id", invitation_id).execute()
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Invitation not found")
    require_home_role(rows[0]["home_id"], user, allowed={"owner", "admin"})
    database.revoke_invitation(invitation_id)
    return {"status": "ok"}


@app.get("/invitations", response_model=InvitationListResponse)
def list_my_invitations_route(user: CurrentUser = Depends(require_current_user)):
    try:
        rows = database.list_pending_invitations_for_email(user.email)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list invitations.")
    return InvitationListResponse(invitations=[_invitation_to_out(r) for r in rows])


@app.get("/invitations/{token}", response_model=InvitationOut)
def lookup_invitation_route(
    token: str,
    user: CurrentUser = Depends(require_current_user),
):
    inv = database.get_invitation_by_token(token)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.get("status") != "pending":
        raise HTTPException(status_code=410, detail=f"Invitation is {inv['status']}")
    if _is_expired(inv):
        raise HTTPException(status_code=410, detail="Invitation has expired")
    return _invitation_to_out(inv)


def _is_expired(inv: dict) -> bool:
    expires_at = inv.get("expires_at")
    if not expires_at:
        return False
    try:
        dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
    except ValueError:
        return False
    return dt < datetime.now(timezone.utc)


@app.post("/invitations/{token}/accept", response_model=HomeOut)
def accept_invitation_route(
    token: str,
    user: CurrentUser = Depends(require_current_user),
):
    inv = database.get_invitation_by_token(token)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.get("status") != "pending":
        raise HTTPException(status_code=410, detail=f"Invitation is {inv['status']}")
    if _is_expired(inv):
        raise HTTPException(status_code=410, detail="Invitation has expired")
    if (inv.get("email") or "").lower() != user.email.lower():
        raise HTTPException(status_code=403, detail="This invitation was sent to a different email.")
    try:
        database.accept_invitation(token, user.id)
    except Exception as e:
        print(f"[invite] accept failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't accept invitation.")
    home = database.get_home(inv["home_id"]) or {}
    return HomeOut(
        id=str(inv["home_id"]),
        name=home.get("name", ""),
        role=inv.get("role", "member"),
        created_at=str(home["created_at"]) if home.get("created_at") else None,
    )


@app.post("/invitations/{token}/decline")
def decline_invitation_route(
    token: str,
    user: CurrentUser = Depends(require_current_user),
):
    inv = database.get_invitation_by_token(token)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if (inv.get("email") or "").lower() != user.email.lower():
        raise HTTPException(status_code=403, detail="This invitation was sent to a different email.")
    database.decline_invitation(token)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Admin (email-gated via CurrentUser.is_admin)
# ---------------------------------------------------------------------------

def _require_admin(user: CurrentUser) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


@app.get("/admin/homes", response_model=AdminHomeListResponse)
def admin_list_homes(user: CurrentUser = Depends(require_current_user)):
    _require_admin(user)
    try:
        rows = database.list_all_homes()
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list homes.")
    return AdminHomeListResponse(
        homes=[
            AdminHomeOut(
                id=str(r["id"]),
                name=r.get("name", ""),
                created_at=str(r["created_at"]) if r.get("created_at") else None,
                member_count=int(r.get("member_count") or 0),
            )
            for r in rows
        ]
    )


@app.get("/admin/feedback", response_model=AdminFeedbackListResponse)
def admin_list_feedback(
    limit: int = 50,
    user: CurrentUser = Depends(require_current_user),
):
    _require_admin(user)
    try:
        rows = database.list_recent_feedback(limit=limit)
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't list feedback.")
    return AdminFeedbackListResponse(
        feedback=[
            AdminFeedbackRow(
                id=str(r["id"]),
                recipe_name=r.get("recipe_name", ""),
                rating=int(r.get("rating") or 0),
                cuisine=r.get("cuisine"),
                created_at=str(r.get("created_at")),
                user_id=str(r["user_id"]) if r.get("user_id") else None,
                user_name=r.get("user_name"),
                home_id=str(r["home_id"]) if r.get("home_id") else None,
                home_name=r.get("home_name"),
            )
            for r in rows
        ]
    )


# ---------------------------------------------------------------------------
# Meal plan entries
# ---------------------------------------------------------------------------

def _to_meal_plan_out(row: dict) -> MealPlanEntryOut:
    return MealPlanEntryOut(
        id=str(row["id"]),
        plan_date=str(row["plan_date"]),
        slot=row["slot"],
        recipe_name=row.get("recipe_name", ""),
        recipe_content=row.get("recipe_content", ""),
        created_at=str(row.get("created_at", "")),
    )


@app.get("/meal-plan/entries", response_model=MealPlanListResponse)
def list_meal_plan_entries_route(
    home_id: str,
    start: str,
    end: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        rows = database.list_meal_plan_entries(home_id, start, end)
    except Exception as e:
        print(f"[meal-plan] list failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't load meal plan.")
    return MealPlanListResponse(entries=[_to_meal_plan_out(r) for r in rows])


@app.post("/meal-plan/entries", response_model=MealPlanEntryOut)
def create_meal_plan_entry_route(
    body: MealPlanEntryCreate,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(body.home_id, user)
    try:
        row = database.add_meal_plan_entry(
            home_id=body.home_id,
            user_id=user.id,
            plan_date=body.plan_date,
            slot=body.slot,
            recipe_name=body.recipe_name,
            recipe_content=body.recipe_content,
            source_session_id=body.source_session_id,
            overwrite=body.overwrite,
        )
    except database.SlotTakenError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "slot_taken",
                "existing": _to_meal_plan_out(e.existing).model_dump(),
            },
        )
    except Exception as e:
        print(f"[meal-plan] create failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't save meal plan entry.")
    return _to_meal_plan_out(row)


@app.delete("/meal-plan/entries/{entry_id}")
def delete_meal_plan_entry_route(
    entry_id: str,
    home_id: str,
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        deleted = database.delete_meal_plan_entry(home_id, entry_id)
    except Exception as e:
        print(f"[meal-plan] delete failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't delete meal plan entry.")
    if not deleted:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Saved recipes
# ---------------------------------------------------------------------------

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _to_saved_recipe_out(row: dict) -> SavedRecipeOut:
    return SavedRecipeOut(
        id=str(row["id"]),
        name=row.get("name", ""),
        description=row.get("description", ""),
        servings=row.get("servings", 1),
        prep_time_minutes=row.get("prep_time_minutes", 0),
        cook_time_minutes=row.get("cook_time_minutes", 0),
        ingredients=row.get("ingredients") or [],
        steps=row.get("steps") or [],
        cuisine=row.get("cuisine", ""),
        tags=row.get("tags") or [],
        calories_kcal=row.get("calories_kcal"),
        protein_g=row.get("protein_g"),
        carbs_g=row.get("carbs_g"),
        fat_g=row.get("fat_g"),
        image_url=row.get("image_url"),
        created_at=str(row.get("created_at", "")),
    )


@app.get("/recipes", response_model=list[SavedRecipeOut])
def list_recipes_route(
    home_id: str = Query(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        rows = database.list_saved_recipes(home_id)
    except Exception as e:
        print(f"[recipes] list failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't load recipes.")
    return [_to_saved_recipe_out(r) for r in rows]


@app.post("/recipes", response_model=SavedRecipeOut)
def create_recipe_route(
    body: StructuredRecipe,
    home_id: str = Query(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    try:
        row = database.save_recipe(
            home_id=home_id,
            user_id=user.id,
            name=body.name,
            description=body.description,
            servings=body.servings,
            prep_time_minutes=body.prep_time_minutes,
            cook_time_minutes=body.cook_time_minutes,
            ingredients=[ing.model_dump() for ing in body.ingredients],
            steps=body.steps,
            cuisine=body.cuisine,
            tags=body.tags,
        )
    except Exception as e:
        print(f"[recipes] create failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't save recipe.")
    return _to_saved_recipe_out(row)


@app.get("/recipes/{recipe_id}", response_model=SavedRecipeOut)
def get_recipe_route(
    recipe_id: str,
    home_id: str = Query(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    row = database.get_saved_recipe(home_id, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _to_saved_recipe_out(row)


@app.delete("/recipes/{recipe_id}")
def delete_recipe_route(
    recipe_id: str,
    home_id: str = Query(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    row = database.get_saved_recipe(home_id, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if row.get("image_url"):
        try:
            _delete_recipe_image_from_storage(home_id, recipe_id)
        except Exception as e:
            print(f"[recipes] image delete failed (non-fatal): {e.__class__.__name__}: {e}")
    deleted = database.delete_saved_recipe(home_id, recipe_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"status": "ok"}


def _delete_recipe_image_from_storage(home_id: str, recipe_id: str) -> None:
    client = database.get_service_client()
    bucket = client.storage.from_("recipe-images")
    # Try all supported extensions
    for ext in ("jpg", "jpeg", "png", "webp"):
        try:
            bucket.remove([f"{home_id}/{recipe_id}.{ext}"])
        except Exception:
            pass


@app.post("/recipes/{recipe_id}/image", response_model=SavedRecipeOut)
async def upload_recipe_image_route(
    recipe_id: str,
    home_id: str = Query(...),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    row = database.get_saved_recipe(home_id, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")

    content_type = file.content_type or ""
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File must be jpeg, png, or webp.")

    data = await file.read()
    if len(data) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB.")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    path = f"{home_id}/{recipe_id}.{ext}"

    try:
        client = database.get_service_client()
        # Create bucket if it doesn't exist yet
        try:
            client.storage.create_bucket("recipe-images", options={"public": True})
            print("[recipes] created recipe-images storage bucket")
        except Exception:
            pass  # Bucket already exists
        bucket = client.storage.from_("recipe-images")
        # Remove any existing image variants before uploading
        _delete_recipe_image_from_storage(home_id, recipe_id)
        bucket.upload(path, data, {"content-type": content_type})
        public_url = bucket.get_public_url(path)
    except Exception as e:
        print(f"[recipes] image upload failed: {e.__class__.__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't upload image.")

    updated = database.update_recipe_image(home_id, recipe_id, public_url)
    if not updated:
        raise HTTPException(status_code=503, detail="Couldn't update recipe image URL.")
    return _to_saved_recipe_out(updated)


@app.delete("/recipes/{recipe_id}/image")
def delete_recipe_image_route(
    recipe_id: str,
    home_id: str = Query(...),
    user: CurrentUser = Depends(require_current_user),
):
    require_home_member(home_id, user)
    row = database.get_saved_recipe(home_id, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    try:
        _delete_recipe_image_from_storage(home_id, recipe_id)
    except Exception as e:
        print(f"[recipes] image delete failed: {e.__class__.__name__}: {e}")
    database.update_recipe_image(home_id, recipe_id, None)
    return {"status": "ok"}
