"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSettings } from "@/lib/app-context";
import { deleteSavedRecipe, listSavedRecipes } from "@/lib/api";
import type { SavedRecipe, StructuredRecipe } from "@/lib/types";
import { LibraryRecipeCard } from "@/components/recipes/RecipeCard";
import AddToMealPlanDialog from "@/components/chat/AddToMealPlanDialog";

export default function RecipesPage() {
  const { homeId } = useAppSettings();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addToPlan, setAddToPlan] = useState<StructuredRecipe | null>(null);

  const load = useCallback(() => {
    if (!homeId) return;
    setLoading(true);
    setError(null);
    listSavedRecipes(homeId)
      .then(setRecipes)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load recipes."))
      .finally(() => setLoading(false));
  }, [homeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(recipe: SavedRecipe) {
    if (!homeId) return;
    if (!confirm(`Delete "${recipe.name}"?`)) return;
    try {
      await deleteSavedRecipe(homeId, recipe.id);
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't delete recipe.");
    }
  }

  function handleImageUpdated(updated: SavedRecipe) {
    setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const filtered = recipes.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.cuisine.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="h-full overflow-y-auto bg-surface p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-on-surface">Recipe Library</h1>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, cuisine, or tag…"
            className="w-64 rounded-[1rem] bg-surface-container-highest px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-card bg-error-container px-4 py-3 text-sm text-brand-error">{error}</div>
        )}

        {loading && (
          <p className="text-sm text-on-surface-variant">Loading recipes…</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-on-surface-variant">
            {recipes.length === 0
              ? "No recipes saved yet. Ask the agent to suggest one and save it!"
              : "No recipes match your search."}
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => (
            <LibraryRecipeCard
              key={recipe.id}
              recipe={recipe}
              homeId={homeId}
              onDeleted={() => handleDelete(recipe)}
              onAddToMealPlan={(r) => setAddToPlan(r)}
              onImageUpdated={handleImageUpdated}
            />
          ))}
        </div>
      </div>

      {addToPlan && (
        <AddToMealPlanDialog
          recipe={addToPlan}
          onClose={() => setAddToPlan(null)}
          onSaved={() => setAddToPlan(null)}
        />
      )}
    </div>
  );
}
