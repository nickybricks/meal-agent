"""
schemas.py — Pydantic models for all FastAPI request/response bodies.

Models defined here:
- ChatRequest: POST /chat — user_id, session_id, message, model, temperature,
                            top_p, max_tokens, enabled_tools, personality
- ChatResponse: response with assistant text, checkpoint_id, tokens_used, model_used
- EditRequest: POST /edit — checkpoint_id, new_message, user_id, model, temperature
- FeedbackRequest: POST /feedback — user_id, recipe_name, rating, ingredients, cuisine,
                                    model_used
- UserProfile: GET /users/{id} response — id, name, dietary_restrictions,
               disliked_ingredients, favorite_cuisines, personality
- ModelListResponse: GET /models — cloud models + detected local Ollama models
- HistoryMessage: single message in GET /history/{session_id}
- HistoryResponse: list of HistoryMessage

All fields use snake_case. Optional fields default to None unless noted.
"""

from pydantic import BaseModel, field_validator
from typing import Optional


class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    top_p: float = 1.0
    max_tokens: int = 1024
    enabled_tools: list[str] = ["search_recipes", "get_user_profile", "save_preference",
                                 "substitute_ingredient", "generate_meal_plan"]
    personality: str = "friendly"


class ChatResponse(BaseModel):
    reply: str
    checkpoint_id: str
    tokens_used: Optional[int] = None
    model_used: str


class EditRequest(BaseModel):
    checkpoint_id: str
    new_message: str
    user_id: str
    session_id: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    top_p: float = 1.0
    max_tokens: int = 1024


class FeedbackRequest(BaseModel):
    user_id: str
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


class UserProfile(BaseModel):
    id: str
    name: str
    dietary_restrictions: list[str] = []
    disliked_ingredients: list[str] = []
    favorite_cuisines: list[str] = []
    personality: str = "friendly"


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
