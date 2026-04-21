"""
memory.py — Builds and injects the dynamic system prompt from user profile + feedback history.

No DB calls here — accepts already-loaded data so it's pure and testable.
"""

from config import PERSONALITY_PROMPTS


def summarise_feedback(feedback_history: list[dict]) -> dict:
    """Aggregate raw feedback rows into preference signals."""
    liked_recipes: list[str] = []
    disliked_recipes: list[str] = []
    liked_cuisines: list[str] = []
    disliked_cuisines: list[str] = []
    ingredients_to_avoid: list[str] = []

    for row in feedback_history:
        name = row.get("recipe_name", "")
        rating = row.get("rating", 0)
        cuisine = row.get("cuisine") or ""
        ingredients = row.get("ingredients") or []

        if rating >= 4:
            if name:
                liked_recipes.append(name)
            if cuisine:
                liked_cuisines.append(cuisine)
        else:
            if name:
                disliked_recipes.append(name)
            if cuisine:
                disliked_cuisines.append(cuisine)
            ingredients_to_avoid.extend(ingredients)

    # Deduplicate and take most recent signals (list was already ordered desc)
    def top(lst: list[str], n: int = 5) -> list[str]:
        seen: set[str] = set()
        result = []
        for x in lst:
            if x not in seen:
                seen.add(x)
                result.append(x)
            if len(result) == n:
                break
        return result

    return {
        "liked_recipes": top(liked_recipes),
        "disliked_recipes": top(disliked_recipes),
        "liked_cuisines": top(liked_cuisines),
        "disliked_cuisines": top(disliked_cuisines),
        "ingredients_to_avoid": top(ingredients_to_avoid, 10),
    }


def build_system_prompt(
    user_profile: dict,
    feedback_history: list[dict],
    personality: str,
) -> str:
    """Build the full system prompt to inject into each agent run."""
    base = PERSONALITY_PROMPTS.get(personality, PERSONALITY_PROMPTS["friendly"])

    name = user_profile.get("name", "the user")
    diet = user_profile.get("diet") or []
    disliked_ingredients = user_profile.get("disliked_ingredients") or []
    favorite_cuisines = user_profile.get("favorite_cuisines") or []

    signals = summarise_feedback(feedback_history)

    lines = [
        base,
        f"\nYou are assisting {name}.",
    ]

    if diet:
        lines.append(f"Diet: {', '.join(diet)}.")
    if favorite_cuisines:
        lines.append(f"Favourite cuisines: {', '.join(favorite_cuisines)}.")

    avoid = list({*disliked_ingredients, *signals["ingredients_to_avoid"]})
    if avoid:
        lines.append(f"Ingredients to avoid: {', '.join(avoid)}.")

    if signals["liked_recipes"]:
        lines.append(f"Previously enjoyed recipes: {', '.join(signals['liked_recipes'])}.")
    if signals["disliked_recipes"]:
        lines.append(f"Recipes to steer away from: {', '.join(signals['disliked_recipes'])}.")
    if signals["liked_cuisines"]:
        lines.append(f"Cuisines they enjoy: {', '.join(signals['liked_cuisines'])}.")

    lines.append("\nAlways personalise suggestions based on these preferences.")
    lines.append(
        "When the user shares a new preference, diet, allergy, "
        "cuisine they like, or an ingredient they dislike, call the "
        "save_preference tool immediately to persist it. Use fields: "
        "diet, disliked_ingredients, favorite_cuisines."
    )

    return "\n".join(lines)
