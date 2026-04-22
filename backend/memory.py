"""
memory.py — Builds and injects the dynamic system prompt from user profile + feedback history.

No DB calls here — accepts already-loaded data so it's pure and testable.
"""

from datetime import date

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
    recent_recipes: list[dict] | None = None,
) -> str:
    """Build the full system prompt to inject into each agent run."""
    base = PERSONALITY_PROMPTS.get(personality, PERSONALITY_PROMPTS["friendly"])

    name = user_profile.get("name", "the user")
    diet = user_profile.get("diet") or []
    disliked_ingredients = user_profile.get("disliked_ingredients") or []
    liked_ingredients = user_profile.get("liked_ingredients") or []
    favorite_cuisines = user_profile.get("favorite_cuisines") or []
    allergies = user_profile.get("allergies") or []
    cooking_skill_level = user_profile.get("cooking_skill_level")
    adventurousness = user_profile.get("adventurousness")

    signals = summarise_feedback(feedback_history)

    today = date.today().strftime("%A, %B %-d, %Y")
    lines = [
        base,
        f"Today's date is {today}.",
        f"\nYou are assisting {name}.",
    ]

    if diet:
        lines.append(f"Diet: {', '.join(diet)}.")
    if allergies:
        lines.append(f"Allergies / intolerances (never include these): {', '.join(allergies)}.")

    avoid = list({*disliked_ingredients, *signals["ingredients_to_avoid"]})
    # Cap to 20 to keep the prompt concise
    if len(avoid) > 20:
        avoid = avoid[:20]
    if avoid:
        lines.append(f"Ingredients to avoid: {', '.join(avoid)}.")

    # Cap liked ingredients to 20
    liked = liked_ingredients[:20] if len(liked_ingredients) > 20 else liked_ingredients
    if liked:
        lines.append(
            f"Ingredients they occasionally enjoy (not a requirement — use sparingly "
            f"and avoid defaulting to these; variety matters more): {', '.join(liked)}."
        )

    all_cuisines = list({*favorite_cuisines, *signals["liked_cuisines"]})
    if all_cuisines:
        lines.append(f"Favourite cuisines: {', '.join(all_cuisines)}.")

    if cooking_skill_level:
        skill_hints = {
            "beginner": "Keep recipes simple — short ingredient lists and basic techniques only.",
            "intermediate": "Suggest moderately complex recipes with standard techniques.",
            "advanced": "Feel free to suggest complex recipes with advanced techniques.",
        }
        lines.append(skill_hints.get(cooking_skill_level, f"Cooking skill: {cooking_skill_level}."))

    if adventurousness is not None:
        if adventurousness <= 2:
            lines.append(
                "Stick close to familiar, comfort-food preferences. "
                "Avoid unusual or exotic ingredients."
            )
        elif adventurousness >= 4:
            lines.append(
                "Be adventurous! Suggest diverse cuisines, unusual ingredients, "
                "and creative combinations they may not have tried yet."
            )

    if signals["liked_recipes"]:
        lines.append(f"Previously enjoyed recipes: {', '.join(signals['liked_recipes'])}.")
    if signals["disliked_recipes"]:
        lines.append(f"Recipes to steer away from: {', '.join(signals['disliked_recipes'])}.")

    measurement_system = user_profile.get("measurement_system") or "metric"
    if measurement_system == "imperial":
        lines.append(
            "Use US/imperial units (cups, tablespoons, ounces, pounds, °F) for all measurements."
        )
    else:
        lines.append(
            "Always use metric units (grams, milliliters, kilograms, liters, °C). "
            "Never use cups, tablespoons, ounces, pounds, or °F."
        )

    if recent_recipes:
        names = [
            f"{r['name']} ({r['cuisine']})" if r.get("cuisine") else r["name"]
            for r in recent_recipes
            if r.get("name")
        ]
        if names:
            lines.append(
                "\nThe user has recently been suggested the following recipes — "
                "do NOT repeat them. Suggest different cuisines, proteins, and cooking styles:\n"
                + "\n".join(f"- {n}" for n in names)
            )

    lines.append(
        "\nHard rules (always enforce): diet restrictions, allergies, and disliked ingredients. "
        "Soft hints (use occasionally, not every time): favourite cuisines and liked ingredients. "
        "Prioritise variety — vary protein, cuisine, and cooking method across suggestions. "
        "It is fine and encouraged to suggest dishes that don't use any liked ingredients at all."
    )
    lines.append(
        "When the user shares a new preference, diet, allergy, "
        "cuisine they like, or an ingredient they dislike, call the "
        "save_preference tool immediately to persist it. Use fields: "
        "diet, disliked_ingredients, favorite_cuisines."
    )
    lines.append(
        "When you present a complete recipe, first present it conversationally "
        "in your message text (ingredients and steps in readable prose or markdown). "
        "Always include an approximate macros breakdown at the end of the recipe "
        "in this exact format:\n\n"
        "**Macros Breakdown (Approximate)**\n"
        "- Calories: X kcal\n"
        "- Protein: X grams\n"
        "- Carbohydrates: X grams\n"
        "- Fat: X grams\n\n"
        "Then ask the user if they'd like to save it. "
        "If the user says yes or asks you to save it, call the save_recipe tool "
        "with all fields filled in: name, description, servings, prep_time_minutes, "
        "cook_time_minutes, ingredients (list of {item, amount, unit} dicts), "
        "steps (list of strings), cuisine, tags, and macros "
        "(a dict with keys: calories_kcal, protein_g, carbs_g, fat_g — integers). "
        "Do NOT call save_recipe for meal plan tables, ingredient substitutions, "
        "lists of options, or clarifying questions — only for a single concrete "
        "recipe the user wants saved. Do NOT use any special delimiters around recipes. "
        "After saving a recipe, simply confirm it was saved (e.g. 'Saved to your library!') "
        "and then STOP. Do NOT suggest a new recipe or ask follow-up questions unless "
        "the user explicitly requests more."
    )

    return "\n".join(lines)
