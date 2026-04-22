"""
auth.py — FastAPI dependencies for Supabase Auth.

- `get_current_user` validates the Bearer JWT against Supabase Auth, resolves
  the matching `public.users` row (created by the DB trigger on first signup),
  and returns a CurrentUser — or None if no Authorization header was sent.
- `require_current_user` wraps it and raises 401 when no user is present; all
  non-public routes depend on it.
- `require_home_member(home_id)` / `require_home_role(home_id, allowed)` check
  the resolved user's membership/role in the home, with an admin bypass.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

import database


@dataclass
class CurrentUser:
    id: str              # public.users.id
    auth_id: str         # auth.users.id
    email: str
    name: str
    is_admin: bool


def _admin_email() -> str:
    return (os.environ.get("ADMIN_EMAIL") or "").strip().lower()


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> CurrentUser | None:
    """Resolve the bearer token to a CurrentUser. Returns None if no header
    was sent (transition-mode fallback). Raises 401 if a header is present
    but invalid."""
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expected 'Authorization: Bearer <jwt>'",
        )

    try:
        resp = database.get_anon_client().auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    auth_user = getattr(resp, "user", None)
    if auth_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    auth_id = str(auth_user.id)
    email = (auth_user.email or "").lower()

    # Trigger handle_new_auth_user should have created/linked the row, but
    # fall back to matching by email if a dev applied migrations out of order.
    row = database.get_user_by_auth_id(auth_id)
    if row is None and email:
        row = database.get_user_by_email(email)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user has no profile row",
        )

    return CurrentUser(
        id=str(row["id"]),
        auth_id=auth_id,
        email=email,
        name=row.get("name", ""),
        is_admin=bool(email) and email == _admin_email(),
    )


async def require_current_user(
    user: CurrentUser | None = Depends(get_current_user),
) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


def require_home_member(home_id: str, user: CurrentUser) -> None:
    """Raise 403 if the user is not a member of the home (admins bypass)."""
    if user.is_admin:
        return
    role = database.get_member_role(home_id, user.id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this home",
        )


def require_home_role(home_id: str, user: CurrentUser, allowed: set[str]) -> str:
    """Return the user's role in the home; 403 if not in allowed set.
    Admins always pass and get 'owner'."""
    if user.is_admin:
        return "owner"
    role = database.get_member_role(home_id, user.id)
    if role is None or role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires one of: {', '.join(sorted(allowed))}",
        )
    return role
