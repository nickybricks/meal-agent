"""
tools.py — The 5 LangChain @tool functions available to the LangGraph agent.

Each tool is decorated with @tool so LangGraph can bind them to the LLM.
Use get_tools(enabled) to filter which tools are active for a given request.

substitute_ingredient and generate_meal_plan call an LLM internally — they
read the per-request LLM from AgentState via InjectedState (no globals).
"""

import threading
from typing import Annotated

import httpx
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import InjectedState

import database
import memory as mem
from config import THEMEALDB_BASE_URL

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
# Helpers
# ---------------------------------------------------------------------------

def _format_recipe(meal: dict) -> str:
    name = meal.get("strMeal", "Unknown")
    area = meal.get("strArea", "")
    category = meal.get("strCategory", "")
    source = meal.get("strSource") or meal.get("strYoutube") or ""
    ingredients = []
    for i in range(1, 21):
        ing = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if ing:
            ingredients.append(f"{measure} {ing}".strip())
    lines = [f"**{name}**"]
    if area or category:
        lines.append(f"Cuisine: {area} | Category: {category}")
    if ingredients:
        lines.append(f"Ingredients: {', '.join(ingredients[:10])}")
    if source:
        lines.append(f"Source: {source}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool
async def search_recipes(query: str, cuisine: str | None = None) -> str:
    """Search TheMealDB for recipes matching query, optionally filtered by cuisine/area."""
    url = f"{THEMEALDB_BASE_URL}/search.php"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"s": query})
            resp.raise_for_status()
            meals = resp.json().get("meals") or []
    except httpx.HTTPError as e:
        return f"Sorry, I couldn't reach the recipe database right now ({e.__class__.__name__})."

    if cuisine:
        meals = [m for m in meals if (m.get("strArea") or "").lower() == cuisine.lower()]

    if not meals:
        return f"No recipes found for '{query}'" + (f" in {cuisine} cuisine." if cuisine else ".")

    return "\n\n".join(_format_recipe(m) for m in meals[:5])


@tool
def get_user_profile(state: Annotated[dict, InjectedState] = None) -> str:
    """Load the current user's preferences and feedback history from the database."""
    user_id = (state or {}).get("user_id", "")
    if not user_id:
        return "Sorry, I couldn't identify the current user."

    try:
        user = database.get_user(user_id)
    except Exception:
        return "Sorry, I couldn't load your profile right now."

    if not user:
        return f"No user found with id {user_id}."

    try:
        prefs = database.get_preferences(user_id)
        feedback = database.get_feedback_history(user_id, limit=20)
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
    if not user_id:
        return "Sorry, I couldn't identify the current user."

    with _pref_lock:
        try:
            prefs = database.get_preferences(user_id)
            existing = prefs.get(field)
            current: list[str] = [str(v) for v in existing if v is not None] if isinstance(existing, list) else []
            if value not in current:
                current.append(value)
            database.update_preference(user_id, field, current)
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
    if not user_id:
        return "Sorry, I couldn't identify the current user."

    try:
        prefs = database.get_preferences(user_id)
        feedback = database.get_feedback_history(user_id, limit=30)
    except Exception:
        return "Sorry, I couldn't load your preferences to build a meal plan."

    signals = mem.summarise_feedback(feedback)

    recipes: list[dict] = []
    seen: set[str] = set()
    async with httpx.AsyncClient(timeout=5) as client:
        for _ in range(days * 2):
            try:
                resp = await client.get(f"{THEMEALDB_BASE_URL}/random.php")
                meal = (resp.json().get("meals") or [{}])[0]
            except Exception:
                break
            name = meal.get("strMeal", "")
            if name and name not in seen:
                seen.add(name)
                recipes.append(meal)

    recipe_list = "\n".join(
        f"- {m.get('strMeal')} ({m.get('strArea', '')} {m.get('strCategory', '')})"
        for m in recipes[:days + 3]
    )

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
        f"Create a {days}-day meal plan using recipes from the list below.\n"
        f"User constraints:\n{constraint_text}\n\n"
        f"Available recipes:\n{recipe_list}\n\n"
        f"Format as a markdown table with columns: Day | Breakfast idea | Lunch | Dinner. "
        f"For lunch and dinner choose from the recipe list. "
        f"For breakfast suggest a simple complementary option. "
        f"Respect all user constraints."
    )

    llm = _state_llm(state or {})
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception:
        return "Sorry, I couldn't generate a meal plan right now. Please try again."
    return response.content


ALL_TOOLS = [search_recipes, get_user_profile, save_preference,
             substitute_ingredient, generate_meal_plan]


def get_tools(enabled: list[str]) -> list:
    """Return only the tools whose names are in the enabled list."""
    return [t for t in ALL_TOOLS if t.name in enabled]
