"""
database.py — All Supabase read/write operations.

Two clients:
- service: uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS. Used for all
  backend writes and tenant-scoped reads after the app has verified home
  membership itself.
- anon: uses SUPABASE_ANON_KEY and only ever validates JWTs via
  supabase.auth.get_user(token). Never used for DB reads.

During the transition to the multi-tenant model, home_id defaults to the
Legacy Home so the old single-tenant frontend keeps working.
"""

import os
from supabase import create_client, Client

LEGACY_HOME_ID = "00000000-0000-0000-0000-000000000001"

_service_client: Client | None = None
_anon_client: Client | None = None


def get_service_client() -> Client:
    global _service_client
    if _service_client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_ANON_KEY"]
        _service_client = create_client(url, key)
    return _service_client


def get_anon_client() -> Client:
    global _anon_client
    if _anon_client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_ANON_KEY"]
        _anon_client = create_client(url, key)
    return _anon_client


# Backwards-compat alias so any leftover callers still work.
def get_client() -> Client:
    return get_service_client()


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def get_user(user_id: str) -> dict | None:
    resp = get_service_client().table("users").select("*").eq("id", user_id).execute()
    rows = resp.data
    return rows[0] if rows else None


def get_user_by_auth_id(auth_id: str) -> dict | None:
    resp = get_service_client().table("users").select("*").eq("auth_id", auth_id).execute()
    rows = resp.data
    return rows[0] if rows else None


def get_user_by_email(email: str) -> dict | None:
    resp = (
        get_service_client()
        .table("users")
        .select("*")
        .ilike("email", email)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None


def list_users() -> list[dict]:
    resp = (
        get_service_client()
        .table("users")
        .select("id, name, email")
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Preferences — scoped to (user_id, home_id)
# ---------------------------------------------------------------------------

def get_preferences(user_id: str, home_id: str = LEGACY_HOME_ID) -> dict:
    resp = (
        get_service_client()
        .table("preferences")
        .select("*")
        .eq("user_id", user_id)
        .eq("home_id", home_id)
        .execute()
    )
    rows = resp.data
    if rows:
        return rows[0]
    return {
        "diet": [],
        "disliked_ingredients": [],
        "favorite_cuisines": [],
    }


def update_preference(user_id: str, field: str, value, home_id: str = LEGACY_HOME_ID) -> None:
    """Upsert a single field in preferences for a given (user, home)."""
    existing = (
        get_service_client()
        .table("preferences")
        .select("id")
        .eq("user_id", user_id)
        .eq("home_id", home_id)
        .execute()
    )
    if existing.data:
        (get_service_client()
            .table("preferences")
            .update({field: value})
            .eq("user_id", user_id)
            .eq("home_id", home_id)
            .execute())
    else:
        (get_service_client()
            .table("preferences")
            .insert({"user_id": user_id, "home_id": home_id, field: value})
            .execute())


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

def get_feedback_history(
    user_id: str,
    home_id: str = LEGACY_HOME_ID,
    limit: int = 20,
) -> list[dict]:
    resp = (
        get_service_client()
        .table("feedback")
        .select("*")
        .eq("user_id", user_id)
        .eq("home_id", home_id)
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
    home_id: str = LEGACY_HOME_ID,
) -> None:
    get_service_client().table("feedback").insert({
        "user_id": user_id,
        "home_id": home_id,
        "recipe_name": recipe_name,
        "rating": rating,
        "ingredients": ingredients,
        "cuisine": cuisine,
        "model_used": model_used,
    }).execute()


# ---------------------------------------------------------------------------
# Chat history & sessions
# ---------------------------------------------------------------------------

def save_chat_message(
    user_id: str,
    session_id: str,
    role: str,
    content: str,
    checkpoint_id: str | None = None,
    model_used: str | None = None,
    tokens_used: int | None = None,
    home_id: str = LEGACY_HOME_ID,
) -> None:
    get_service_client().table("chat_history").insert({
        "user_id": user_id,
        "home_id": home_id,
        "session_id": session_id,
        "role": role,
        "content": content,
        "checkpoint_id": checkpoint_id,
        "model_used": model_used,
        "tokens_used": tokens_used,
    }).execute()


def get_chat_history(session_id: str, home_id: str = LEGACY_HOME_ID) -> list[dict]:
    resp = (
        get_service_client()
        .table("chat_history")
        .select("*")
        .eq("session_id", session_id)
        .eq("home_id", home_id)
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


def list_sessions(user_id: str, home_id: str = LEGACY_HOME_ID, limit: int = 20) -> list[dict]:
    """Return recent sessions for a user inside a home as [{session_id, title, last_at}]."""
    resp = (
        get_service_client()
        .table("chat_history")
        .select("session_id, role, content, created_at")
        .eq("user_id", user_id)
        .eq("home_id", home_id)
        .order("created_at", desc=False)
        .execute()
    )
    rows = resp.data or []
    sessions: dict[str, dict] = {}
    for r in rows:
        sid = r.get("session_id")
        if not sid:
            continue
        entry = sessions.get(sid)
        if entry is None:
            entry = {"session_id": sid, "title": "", "last_at": r["created_at"]}
            sessions[sid] = entry
        if not entry["title"] and r.get("role") == "user":
            entry["title"] = (r.get("content") or "").strip()
        if r["created_at"] > entry["last_at"]:
            entry["last_at"] = r["created_at"]
    ordered = sorted(sessions.values(), key=lambda s: s["last_at"], reverse=True)
    return ordered[:limit]


# ---------------------------------------------------------------------------
# Checkpoints (internal plumbing — not home-scoped, service-role only)
# ---------------------------------------------------------------------------

def save_checkpoint(
    checkpoint_id: str,
    user_id: str,
    session_id: str,
    state_json: str,
) -> None:
    get_service_client().table("checkpoints").upsert({
        "id": checkpoint_id,
        "user_id": user_id,
        "session_id": session_id,
        "state_json": state_json,
    }).execute()


def get_checkpoint(checkpoint_id: str) -> dict | None:
    resp = (
        get_service_client()
        .table("checkpoints")
        .select("*")
        .eq("id", checkpoint_id)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Homes
# ---------------------------------------------------------------------------

def create_home(name: str, owner_user_id: str) -> dict:
    home = (
        get_service_client()
        .table("homes")
        .insert({"name": name, "created_by": owner_user_id})
        .execute()
        .data[0]
    )
    (get_service_client()
        .table("home_members")
        .insert({"home_id": home["id"], "user_id": owner_user_id, "role": "owner"})
        .execute())
    return home


def get_home(home_id: str) -> dict | None:
    resp = get_service_client().table("homes").select("*").eq("id", home_id).execute()
    rows = resp.data
    return rows[0] if rows else None


def list_homes_for_user(user_id: str) -> list[dict]:
    resp = (
        get_service_client()
        .table("home_members")
        .select("role, home:homes(id, name, created_at)")
        .eq("user_id", user_id)
        .execute()
    )
    rows = resp.data or []
    out = []
    for r in rows:
        home = r.get("home") or {}
        if not home:
            continue
        out.append({
            "id": home["id"],
            "name": home.get("name", ""),
            "role": r.get("role", "member"),
            "created_at": home.get("created_at"),
        })
    return out


def list_all_homes() -> list[dict]:
    """Admin-only: every home with member count."""
    homes_resp = (
        get_service_client()
        .table("homes")
        .select("id, name, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    members_resp = (
        get_service_client()
        .table("home_members")
        .select("home_id")
        .execute()
    )
    counts: dict[str, int] = {}
    for r in members_resp.data or []:
        counts[r["home_id"]] = counts.get(r["home_id"], 0) + 1
    return [
        {**h, "member_count": counts.get(h["id"], 0)}
        for h in (homes_resp.data or [])
    ]


def list_recent_feedback(limit: int = 50) -> list[dict]:
    """Admin-only: recent feedback rows joined with user + home names."""
    resp = (
        get_service_client()
        .table("feedback")
        .select(
            "id, recipe_name, rating, cuisine, created_at, "
            "user:users(id, name), home:homes(id, name)"
        )
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = resp.data or []
    out = []
    for r in rows:
        user = r.get("user") or {}
        home = r.get("home") or {}
        out.append({
            "id": r["id"],
            "recipe_name": r.get("recipe_name", ""),
            "rating": r.get("rating", 0),
            "cuisine": r.get("cuisine"),
            "created_at": r.get("created_at"),
            "user_name": user.get("name"),
            "user_id": user.get("id"),
            "home_name": home.get("name"),
            "home_id": home.get("id"),
        })
    return out


def list_members(home_id: str) -> list[dict]:
    resp = (
        get_service_client()
        .table("home_members")
        .select("role, joined_at, user:users(id, name, email)")
        .eq("home_id", home_id)
        .execute()
    )
    rows = resp.data or []
    out = []
    for r in rows:
        user = r.get("user") or {}
        out.append({
            "user_id": user.get("id"),
            "name": user.get("name", ""),
            "email": user.get("email"),
            "role": r.get("role", "member"),
            "joined_at": r.get("joined_at"),
        })
    return out


def get_member_role(home_id: str, user_id: str) -> str | None:
    resp = (
        get_service_client()
        .table("home_members")
        .select("role")
        .eq("home_id", home_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = resp.data
    return rows[0]["role"] if rows else None


def add_member(home_id: str, user_id: str, role: str = "member") -> None:
    (get_service_client()
        .table("home_members")
        .upsert({"home_id": home_id, "user_id": user_id, "role": role})
        .execute())


def remove_member(home_id: str, user_id: str) -> None:
    (get_service_client()
        .table("home_members")
        .delete()
        .eq("home_id", home_id)
        .eq("user_id", user_id)
        .execute())


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

def create_invitation(
    home_id: str,
    email: str,
    invited_by: str,
    role: str = "member",
) -> dict:
    resp = (
        get_service_client()
        .table("invitations")
        .insert({
            "home_id": home_id,
            "email": email.lower(),
            "invited_by": invited_by,
            "role": role,
        })
        .execute()
    )
    return resp.data[0]


def get_invitation_by_token(token: str) -> dict | None:
    resp = (
        get_service_client()
        .table("invitations")
        .select("*, home:homes(id, name), inviter:users!invitations_invited_by_fkey(id, name, email)")
        .eq("token", token)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None


def list_pending_invitations_for_email(email: str) -> list[dict]:
    resp = (
        get_service_client()
        .table("invitations")
        .select("*, home:homes(id, name)")
        .ilike("email", email)
        .eq("status", "pending")
        .execute()
    )
    return resp.data or []


def list_pending_invitations_for_home(home_id: str) -> list[dict]:
    resp = (
        get_service_client()
        .table("invitations")
        .select("*")
        .eq("home_id", home_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


def accept_invitation(token: str, user_id: str) -> dict:
    """Mark invitation accepted and add user to the home. Caller is responsible
    for validating the token, expiry, and email match beforehand."""
    inv = get_invitation_by_token(token)
    if not inv:
        raise ValueError("Invitation not found")
    add_member(inv["home_id"], user_id, role=inv.get("role", "member"))
    (get_service_client()
        .table("invitations")
        .update({"status": "accepted", "accepted_by": user_id})
        .eq("token", token)
        .execute())
    return inv


def decline_invitation(token: str) -> None:
    (get_service_client()
        .table("invitations")
        .update({"status": "declined"})
        .eq("token", token)
        .execute())


def revoke_invitation(invitation_id: str) -> None:
    (get_service_client()
        .table("invitations")
        .delete()
        .eq("id", invitation_id)
        .execute())


# ---------------------------------------------------------------------------
# Meal plan entries — one recipe per (home, date, slot)
# ---------------------------------------------------------------------------

class SlotTakenError(Exception):
    """Raised when an insert would collide with an existing (home, date, slot)."""

    def __init__(self, existing: dict):
        super().__init__("Slot already has an entry")
        self.existing = existing


def list_meal_plan_entries(
    home_id: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    resp = (
        get_service_client()
        .table("meal_plan_entries")
        .select("*")
        .eq("home_id", home_id)
        .gte("plan_date", start_date)
        .lte("plan_date", end_date)
        .order("plan_date", desc=False)
        .order("slot", desc=False)
        .execute()
    )
    return resp.data or []


def _get_entry_by_slot(home_id: str, plan_date: str, slot: str) -> dict | None:
    resp = (
        get_service_client()
        .table("meal_plan_entries")
        .select("*")
        .eq("home_id", home_id)
        .eq("plan_date", plan_date)
        .eq("slot", slot)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None


def add_meal_plan_entry(
    home_id: str,
    user_id: str,
    plan_date: str,
    slot: str,
    recipe_name: str,
    recipe_content: str,
    source_session_id: str | None = None,
    overwrite: bool = False,
) -> dict:
    """Insert or replace a recipe in (home, plan_date, slot).

    Raises SlotTakenError if the slot is already filled and overwrite=False.
    """
    existing = _get_entry_by_slot(home_id, plan_date, slot)
    if existing and not overwrite:
        raise SlotTakenError(existing)

    payload = {
        "home_id": home_id,
        "user_id": user_id,
        "plan_date": plan_date,
        "slot": slot,
        "recipe_name": recipe_name,
        "recipe_content": recipe_content,
        "source_session_id": source_session_id,
    }

    if existing:
        resp = (
            get_service_client()
            .table("meal_plan_entries")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )
    else:
        resp = (
            get_service_client()
            .table("meal_plan_entries")
            .insert(payload)
            .execute()
        )
    return (resp.data or [{}])[0]


def delete_meal_plan_entry(home_id: str, entry_id: str) -> bool:
    resp = (
        get_service_client()
        .table("meal_plan_entries")
        .delete()
        .eq("home_id", home_id)
        .eq("id", entry_id)
        .execute()
    )
    return bool(resp.data)


# ---------------------------------------------------------------------------
# Saved recipes
# ---------------------------------------------------------------------------

def save_recipe(
    home_id: str,
    user_id: str,
    name: str,
    description: str,
    servings: int,
    prep_time_minutes: int,
    cook_time_minutes: int,
    ingredients: list[dict],
    steps: list[str],
    cuisine: str,
    tags: list[str],
    macros: dict | None = None,
    source_session_id: str | None = None,
) -> dict:
    """Upsert a recipe by (home_id, name). Returns the saved row."""
    macros = macros or {}
    payload = {
        "home_id": home_id,
        "user_id": user_id,
        "name": name,
        "description": description,
        "servings": servings,
        "prep_time_minutes": prep_time_minutes,
        "cook_time_minutes": cook_time_minutes,
        "ingredients": ingredients,
        "steps": steps,
        "cuisine": cuisine,
        "tags": tags,
        "calories_kcal": macros.get("calories_kcal"),
        "protein_g": macros.get("protein_g"),
        "carbs_g": macros.get("carbs_g"),
        "fat_g": macros.get("fat_g"),
        "source_session_id": source_session_id,
    }
    existing = (
        get_service_client()
        .table("saved_recipes")
        .select("id")
        .eq("home_id", home_id)
        .eq("name", name)
        .execute()
    )
    if existing.data:
        resp = (
            get_service_client()
            .table("saved_recipes")
            .update({**payload, "updated_at": "now()"})
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        resp = (
            get_service_client()
            .table("saved_recipes")
            .insert(payload)
            .execute()
        )
    return (resp.data or [{}])[0]


def list_saved_recipes(home_id: str) -> list[dict]:
    resp = (
        get_service_client()
        .table("saved_recipes")
        .select("*")
        .eq("home_id", home_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


def get_saved_recipe(home_id: str, recipe_id: str) -> dict | None:
    resp = (
        get_service_client()
        .table("saved_recipes")
        .select("*")
        .eq("home_id", home_id)
        .eq("id", recipe_id)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None


def delete_saved_recipe(home_id: str, recipe_id: str) -> bool:
    resp = (
        get_service_client()
        .table("saved_recipes")
        .delete()
        .eq("home_id", home_id)
        .eq("id", recipe_id)
        .execute()
    )
    return bool(resp.data)


def get_recent_recipe_names(home_id: str, limit: int = 20) -> list[dict]:
    """Return [{name, cuisine}] for the most recently saved recipes in a home."""
    resp = (
        get_service_client()
        .table("saved_recipes")
        .select("name, cuisine")
        .eq("home_id", home_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def update_preferences_bulk(user_id: str, fields: dict, home_id: str = LEGACY_HOME_ID) -> None:
    """Upsert multiple preference fields at once."""
    existing = (
        get_service_client()
        .table("preferences")
        .select("id")
        .eq("user_id", user_id)
        .eq("home_id", home_id)
        .execute()
    )
    if existing.data:
        (get_service_client()
            .table("preferences")
            .update(fields)
            .eq("user_id", user_id)
            .eq("home_id", home_id)
            .execute())
    else:
        (get_service_client()
            .table("preferences")
            .insert({"user_id": user_id, "home_id": home_id, **fields})
            .execute())


def update_recipe_image(home_id: str, recipe_id: str, image_url: str | None) -> dict | None:
    resp = (
        get_service_client()
        .table("saved_recipes")
        .update({"image_url": image_url, "updated_at": "now()"})
        .eq("home_id", home_id)
        .eq("id", recipe_id)
        .execute()
    )
    rows = resp.data
    return rows[0] if rows else None
