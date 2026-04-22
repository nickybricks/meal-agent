"""
tools.py — The 4 LangChain @tool functions available to the LangGraph agent.

Each tool is decorated with @tool so LangGraph can bind them to the LLM.
Use get_tools(enabled) to filter which tools are active for a given request.

substitute_ingredient and generate_meal_plan call an LLM internally — they
read the per-request LLM from AgentState via InjectedState (no globals).
"""

import threading
from typing import Annotated

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import InjectedState

import database
import memory as mem
from schemas import RecipeIngredient

MAX_MEAL_PLAN_DAYS = 14

# Serialises concurrent save_preference calls. ToolNode runs tool calls in
# parallel, and each call is a read-modify-write on the preferences row, so
# without this lock later writes clobber earlier ones in the same turn.
_pref_lock = threading.Lock()


def _state_llm(state: dict):
    """Build a fresh LLM using the per-request parameters in AgentState."""
    from model_router import get_llm
    s = state or {}
    return get_llm(
        s.get("model_name", "gpt-4o-mini"),
        temperature=s.get("temperature", 0.7),
        top_p=s.get("top_p", 1.0),
        max_tokens=s.get("max_tokens", 1024),
    )


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool
def get_user_profile(state: Annotated[dict, InjectedState] = None) -> str:
    """Load the current user's preferences and feedback history from the database."""
    user_id = (state or {}).get("user_id", "")
    home_id = (state or {}).get("home_id") or database.LEGACY_HOME_ID
    if not user_id:
        return "Sorry, I couldn't identify the current user."

    try:
        user = database.get_user(user_id)
    except Exception:
        return "Sorry, I couldn't load your profile right now."

    if not user:
        return f"No user found with id {user_id}."

    try:
        prefs = database.get_preferences(user_id, home_id)
        feedback = database.get_feedback_history(user_id, home_id=home_id, limit=20)
    except Exception:
        return "Sorry, I couldn't load your preferences right now."

    signals = mem.summarise_feedback(feedback)

    lines = [f"User: {user.get('name', user_id)}"]
    if prefs.get("diet"):
        lines.append(f"Diet: {', '.join(prefs['diet'])}")
    if prefs.get("disliked_ingredients"):
        lines.append(f"Dislikes: {', '.join(prefs['disliked_ingredients'])}")
    if prefs.get("favorite_cuisines"):
        lines.append(f"Favourite cuisines: {', '.join(prefs['favorite_cuisines'])}")
    if signals["liked_recipes"]:
        lines.append(f"Liked recipes: {', '.join(signals['liked_recipes'])}")
    if signals["disliked_recipes"]:
        lines.append(f"Disliked recipes: {', '.join(signals['disliked_recipes'])}")
    if signals["ingredients_to_avoid"]:
        lines.append(f"Ingredients to avoid (from feedback): {', '.join(signals['ingredients_to_avoid'])}")

    return "\n".join(lines)


@tool
def save_preference(
    field: str,
    value: str,
    state: Annotated[dict, InjectedState] = None,
) -> str:
    """Save or update a preference for the current user. Call once per value — do NOT pass comma-separated lists.

    field must be one of:
    - diet: diets, allergies, and eating styles (e.g. 'vegan', 'keto', 'high protein', 'gluten-free', 'nut allergy')
    - disliked_ingredients: specific ingredients the user wants to avoid (e.g. 'cilantro', 'olives')
    - favorite_cuisines: cuisine styles the user enjoys (e.g. 'italian', 'thai', 'mexican')
    """
    array_fields = {"diet", "disliked_ingredients", "favorite_cuisines"}
    if field not in array_fields:
        return f"Unknown field '{field}'. Must be one of: diet, disliked_ingredients, favorite_cuisines."

    user_id = (state or {}).get("user_id", "")
    home_id = (state or {}).get("home_id") or database.LEGACY_HOME_ID
    if not user_id:
        return "Sorry, I couldn't identify the current user."

    with _pref_lock:
        try:
            prefs = database.get_preferences(user_id, home_id)
            existing = prefs.get(field)
            current: list[str] = [str(v) for v in existing if v is not None] if isinstance(existing, list) else []
            if value not in current:
                current.append(value)
            database.update_preference(user_id, field, current, home_id=home_id)
            return f"Added '{value}' to {field}."
        except Exception as e:
            print(f"[save_preference] failed: {e.__class__.__name__}: {e}")
            return "Sorry, I couldn't save that preference right now. Please try again."


@tool
async def substitute_ingredient(
    ingredient: str,
    reason: str | None = None,
    state: Annotated[dict, InjectedState] = None,
) -> str:
    """Suggest 3 substitutes for an ingredient, with rationale."""
    llm = _state_llm(state or {})
    reason_text = f" The reason for substitution: {reason}." if reason else ""
    prompt = (
        f"Suggest exactly 3 substitutes for '{ingredient}' in cooking.{reason_text}\n"
        "For each substitute give: the name, a one-sentence rationale, and any quantity adjustment. "
        "Format as a numbered list."
    )
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception:
        return "Sorry, I couldn't generate substitutes right now. Please try again."
    return response.content


@tool
async def generate_meal_plan(
    days: int = 7,
    state: Annotated[dict, InjectedState] = None,
) -> str:
    """Generate a personalised weekly meal plan for the current user."""
    if days < 1:
        days = 1
    if days > MAX_MEAL_PLAN_DAYS:
        days = MAX_MEAL_PLAN_DAYS

    user_id = (state or {}).get("user_id", "")
    home_id = (state or {}).get("home_id") or database.LEGACY_HOME_ID
    if not user_id:
        return "Sorry, I couldn't identify the current user."

    try:
        prefs = database.get_preferences(user_id, home_id)
        feedback = database.get_feedback_history(user_id, home_id=home_id, limit=30)
    except Exception:
        return "Sorry, I couldn't load your preferences to build a meal plan."

    signals = mem.summarise_feedback(feedback)

    avoid = list({*(prefs.get("disliked_ingredients") or []), *signals["ingredients_to_avoid"]})
    diet = prefs.get("diet") or []
    liked_cuisines = list({*(prefs.get("favorite_cuisines") or []), *signals["liked_cuisines"]})
    disliked = signals["disliked_recipes"]

    constraints = []
    if diet:
        constraints.append(f"Diet: {', '.join(diet)}")
    if avoid:
        constraints.append(f"Avoid these ingredients: {', '.join(avoid)}")
    if liked_cuisines:
        constraints.append(f"Prefer these cuisines: {', '.join(liked_cuisines)}")
    if disliked:
        constraints.append(f"Exclude these disliked recipes: {', '.join(disliked)}")

    constraint_text = "\n".join(constraints) if constraints else "No specific restrictions."

    prompt = (
        f"Create a {days}-day meal plan for the user.\n"
        f"User constraints:\n{constraint_text}\n\n"
        f"Format as a markdown table with columns: Day | Breakfast idea | Lunch | Dinner. "
        f"Pick concrete, well-known dishes for lunch and dinner and a simple complementary option for breakfast. "
        f"Vary cuisines and proteins across the week. "
        f"Respect all user constraints."
    )

    llm = _state_llm(state or {})
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception:
        return "Sorry, I couldn't generate a meal plan right now. Please try again."
    return response.content


@tool
def save_recipe(
    name: str,
    description: str,
    servings: int,
    prep_time_minutes: int,
    cook_time_minutes: int,
    calories_kcal: int,
    protein_g: int,
    carbs_g: int,
    fat_g: int,
    ingredients: list[RecipeIngredient] = None,
    steps: list[str] = None,
    cuisine: str = "",
    tags: list[str] = None,
    state: Annotated[dict, InjectedState] = None,
) -> str:
    """Save a single complete recipe to the user's recipe library.

    Always include all fields:
    - ingredients: list of {item, amount, unit} objects. Never leave empty — every recipe must have ingredients.
    - calories_kcal, protein_g, carbs_g, fat_g: integer per-serving macros. Always estimate these — never pass 0 as a placeholder.
    Call this only for one concrete recipe the user can cook — not for lists, meal plans, or substitution suggestions.
    """
    user_id = (state or {}).get("user_id", "")
    home_id = (state or {}).get("home_id") or database.LEGACY_HOME_ID
    session_id = (state or {}).get("session_id")
    if not user_id:
        return "Sorry, I couldn't identify the current user."
    macros = {
        "calories_kcal": calories_kcal,
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
    }
    ingredient_dicts = [
        ing.model_dump() if isinstance(ing, RecipeIngredient) else ing
        for ing in (ingredients or [])
    ]
    print(f"[save_recipe] name={name!r} ingredients={len(ingredient_dicts)} macros={macros}")
    if not ingredient_dicts:
        return "I couldn't save that recipe because no ingredients were provided. Please include the ingredient list."
    try:
        database.save_recipe(
            home_id=home_id,
            user_id=user_id,
            name=name,
            description=description,
            servings=servings,
            prep_time_minutes=prep_time_minutes,
            cook_time_minutes=cook_time_minutes,
            ingredients=ingredient_dicts,
            steps=steps or [],
            cuisine=cuisine,
            tags=tags,
            macros=macros,
            source_session_id=session_id,
        )
        return f"Recipe '{name}' has been saved to your recipe library."
    except Exception as e:
        print(f"[save_recipe] failed: {e.__class__.__name__}: {e}")
        return "Sorry, I couldn't save that recipe right now. Please try again."


ALL_TOOLS = [get_user_profile, save_preference,
             substitute_ingredient, generate_meal_plan, save_recipe]


def get_tools(enabled: list[str]) -> list:
    """Return only the tools whose names are in the enabled list."""
    return [t for t in ALL_TOOLS if t.name in enabled]
