"""
schemas.py — Pydantic models for all FastAPI request/response bodies.

The caller is always resolved from the Supabase JWT (see auth.py); request
bodies never carry user_id. home_id is required so the backend knows which
household scope to act in.
"""

from pydantic import BaseModel, field_validator
from typing import Optional


class ChatRequest(BaseModel):
    home_id: str
    session_id: str
    message: str


class RecipeIngredient(BaseModel):
    item: str
    amount: str
    unit: str


class StructuredRecipe(BaseModel):
    name: str
    description: str
    servings: int
    prep_time_minutes: int
    cook_time_minutes: int
    ingredients: list[RecipeIngredient]
    steps: list[str]
    cuisine: str
    tags: list[str]
    calories_kcal: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fat_g: Optional[int] = None


class SavedRecipeOut(StructuredRecipe):
    id: str
    image_url: Optional[str] = None
    created_at: str


class ChatResponse(BaseModel):
    reply: str
    checkpoint_id: str
    tokens_used: Optional[int] = None
    model_used: str
    recipe: Optional[StructuredRecipe] = None


class EditRequest(BaseModel):
    checkpoint_id: str
    new_message: str
    home_id: str
    session_id: str


class FeedbackRequest(BaseModel):
    home_id: str
    recipe_name: str
    rating: int  # 1 = dislike, 5 = like
    ingredients: list[str] = []
    cuisine: Optional[str] = None
    model_used: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def _rating_is_1_or_5(cls, v: int) -> int:
        if v not in (1, 5):
            raise ValueError("rating must be 1 (dislike) or 5 (like)")
        return v


_VALID_MEASUREMENT_SYSTEMS = {"metric", "imperial"}


class UserProfile(BaseModel):
    id: str
    name: str
    diet: list[str] = []
    disliked_ingredients: list[str] = []
    favorite_cuisines: list[str] = []
    liked_ingredients: list[str] = []
    allergies: list[str] = []
    cooking_skill_level: Optional[str] = None
    adventurousness: Optional[int] = None
    measurement_system: Optional[str] = None


class PreferencesUpdate(BaseModel):
    diet: Optional[list[str]] = None
    disliked_ingredients: Optional[list[str]] = None
    favorite_cuisines: Optional[list[str]] = None
    liked_ingredients: Optional[list[str]] = None
    allergies: Optional[list[str]] = None
    cooking_skill_level: Optional[str] = None
    adventurousness: Optional[int] = None
    measurement_system: Optional[str] = None

    @field_validator("measurement_system")
    @classmethod
    def _measurement_system_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_MEASUREMENT_SYSTEMS:
            raise ValueError("measurement_system must be 'metric' or 'imperial'")
        return v


class UserSummary(BaseModel):
    id: str
    name: str


class UserListResponse(BaseModel):
    users: list[UserSummary]


class ModelInfo(BaseModel):
    id: str
    display: str
    provider: str  # openai | anthropic | google | ollama


class ModelListResponse(BaseModel):
    models: list[ModelInfo]


class HistoryMessage(BaseModel):
    id: str
    role: str  # user | assistant
    content: str
    checkpoint_id: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: str


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]


class SessionSummary(BaseModel):
    session_id: str
    title: str
    last_at: str


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]


# ---------------------------------------------------------------------------
# Auth / Homes / Invitations
# ---------------------------------------------------------------------------

class MeResponse(BaseModel):
    id: str
    auth_id: str
    name: str
    email: str
    is_admin: bool


class HomeCreate(BaseModel):
    name: str


class HomeOut(BaseModel):
    id: str
    name: str
    role: str
    created_at: Optional[str] = None


class HomeListResponse(BaseModel):
    homes: list[HomeOut]


class MemberOut(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    role: str
    joined_at: Optional[str] = None


class MemberListResponse(BaseModel):
    members: list[MemberOut]


class InvitationCreate(BaseModel):
    email: str
    role: str = "member"

    @field_validator("role")
    @classmethod
    def _role_valid(cls, v: str) -> str:
        if v not in ("owner", "admin", "member"):
            raise ValueError("role must be owner, admin, or member")
        return v


class InvitationOut(BaseModel):
    id: str
    token: str
    home_id: str
    home_name: Optional[str] = None
    email: str
    role: str
    status: str
    expires_at: str
    created_at: str
    inviter_name: Optional[str] = None


class InvitationListResponse(BaseModel):
    invitations: list[InvitationOut]


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

class AdminHomeOut(BaseModel):
    id: str
    name: str
    created_at: Optional[str] = None
    member_count: int = 0


class AdminHomeListResponse(BaseModel):
    homes: list[AdminHomeOut]


class AdminFeedbackRow(BaseModel):
    id: str
    recipe_name: str
    rating: int
    cuisine: Optional[str] = None
    created_at: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    home_id: Optional[str] = None
    home_name: Optional[str] = None


class AdminFeedbackListResponse(BaseModel):
    feedback: list[AdminFeedbackRow]


# ---------------------------------------------------------------------------
# Meal plan entries
# ---------------------------------------------------------------------------

_VALID_SLOTS = ("breakfast", "lunch", "dinner")


class MealPlanEntryCreate(BaseModel):
    home_id: str
    plan_date: str  # ISO yyyy-mm-dd
    slot: str
    recipe_name: str
    recipe_content: str
    source_session_id: Optional[str] = None
    overwrite: bool = False

    @field_validator("slot")
    @classmethod
    def _slot_valid(cls, v: str) -> str:
        if v not in _VALID_SLOTS:
            raise ValueError(f"slot must be one of: {', '.join(_VALID_SLOTS)}")
        return v


class MealPlanEntryOut(BaseModel):
    id: str
    plan_date: str
    slot: str
    recipe_name: str
    recipe_content: str
    created_at: str


class MealPlanListResponse(BaseModel):
    entries: list[MealPlanEntryOut]
