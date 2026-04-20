"""
database.py — All Supabase read/write operations.

Initialises the supabase-py client from SUPABASE_URL and SUPABASE_ANON_KEY env vars.
Lazy-initialises the client so missing env vars don't crash on import.
"""

import os
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


def get_user(user_id: str) -> dict | None:
    resp = get_client().table("users").select("*").eq("id", user_id).execute()
    rows = resp.data
    return rows[0] if rows else None


def get_preferences(user_id: str) -> dict:
    resp = get_client().table("preferences").select("*").eq("user_id", user_id).execute()
    rows = resp.data
    if rows:
        return rows[0]
    return {
        "dietary_restrictions": [],
        "disliked_ingredients": [],
        "favorite_cuisines": [],
        "personality": "friendly",
    }


def get_feedback_history(user_id: str, limit: int = 20) -> list[dict]:
    resp = (
        get_client()
        .table("feedback")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def save_feedback(
    user_id: str,
    recipe_name: str,
    rating: int,
    ingredients: list[str],
    cuisine: str | None,
    model_used: str | None,
) -> None:
    get_client().table("feedback").insert({
        "user_id": user_id,
        "recipe_name": recipe_name,
        "rating": rating,
        "ingredients": ingredients,
        "cuisine": cuisine,
        "model_used": model_used,
    }).execute()


def save_chat_message(
    user_id: str,
    session_id: str,
    role: str,
    content: str,
    checkpoint_id: str | None = None,
    model_used: str | None = None,
    tokens_used: int | None = None,
) -> None:
    get_client().table("chat_history").insert({
        "user_id": user_id,
        "session_id": session_id,
        "role": role,
        "content": content,
        "checkpoint_id": checkpoint_id,
        "model_used": model_used,
        "tokens_used": tokens_used,
    }).execute()


def get_chat_history(session_id: str) -> list[dict]:
    resp = (
        get_client()
        .table("chat_history")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


def save_checkpoint(
    checkpoint_id: str,
    user_id: str,
    session_id: str,
    state_json: str,
) -> None:
    get_client().table("checkpoints").upsert({
        "id": checkpoint_id,
        "user_id": user_id,
        "session_id": session_id,
        "state_json": state_json,
    }).execute()


def get_checkpoint(checkpoint_id: str) -> dict | None:
    resp = (
        get_client()
        .table("checkpoints")
        .select("*")
        .eq("id", checkpoint_id)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None


def list_users() -> list[dict]:
    resp = (
        get_client()
        .table("users")
        .select("id, name")
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


def update_preference(user_id: str, field: str, value) -> None:
    """Upsert a single field in the preferences table."""
    existing = get_client().table("preferences").select("id").eq("user_id", user_id).execute()
    if existing.data:
        get_client().table("preferences").update({field: value}).eq("user_id", user_id).execute()
    else:
        get_client().table("preferences").insert({"user_id": user_id, field: value}).execute()
