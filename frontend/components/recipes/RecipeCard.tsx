"use client";

import { useRef, useState } from "react";
import type { SavedRecipe, StructuredRecipe } from "@/lib/types";
import { deleteRecipeImage, uploadRecipeImage } from "@/lib/api";

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant">
      {label}
    </span>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-on-primary">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chat variant
// ---------------------------------------------------------------------------

interface ChatRecipeCardProps {
  recipe: StructuredRecipe;
  saved?: boolean;
  onSave?: () => void;
  onAddToMealPlan?: () => void;
}

export function ChatRecipeCard({
  recipe,
  saved = false,
  onSave,
  onAddToMealPlan,
}: ChatRecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  return (
    <div className="mt-3 overflow-hidden rounded-card bg-surface-container-lowest [box-shadow:0_4px_40px_rgba(55,56,48,0.06)]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-on-surface">{recipe.name}</h3>
            <p className="mt-0.5 text-sm text-on-surface-variant">{recipe.description}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.cuisine && <MetaChip label={recipe.cuisine} />}
          <MetaChip label={`${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""}`} />
          {totalMins > 0 && <MetaChip label={`${totalMins} min`} />}
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="mt-3 text-xs text-tertiary underline-offset-2 hover:underline"
        >
          {expanded ? "Hide details" : "Show ingredients & steps"}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Ingredients
              </p>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm text-on-surface">
                    {ing.amount} {ing.unit} {ing.item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Steps
              </p>
              <ol className="list-inside list-decimal space-y-1.5">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="text-sm text-on-surface">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            {recipe.caloriesKcal != null && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Nutrition (per serving)
                </p>
                <div className="flex flex-wrap gap-2">
                  <Chip label={`${recipe.caloriesKcal} kcal`} />
                  {recipe.proteinG != null && <Chip label={`${recipe.proteinG}g protein`} />}
                  {recipe.carbsG != null && <Chip label={`${recipe.carbsG}g carbs`} />}
                  {recipe.fatG != null && <Chip label={`${recipe.fatG}g fat`} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 bg-surface-container-low px-5 py-3">
        {saved ? (
          <span className="text-xs text-on-surface-variant">Saved ✓</span>
        ) : (
          onSave && (
            <button
              type="button"
              onClick={onSave}
              className="text-xs text-on-surface hover:text-primary"
            >
              Save Recipe
            </button>
          )
        )}
        {onAddToMealPlan && (
          <button
            type="button"
            onClick={onAddToMealPlan}
            className="text-xs text-on-surface-variant hover:text-on-surface"
          >
            Add to Meal Plan
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Library variant
// ---------------------------------------------------------------------------

interface LibraryRecipeCardProps {
  recipe: SavedRecipe;
  homeId: string;
  onDeleted: () => void;
  onAddToMealPlan: (recipe: SavedRecipe) => void;
  onImageUpdated: (recipe: SavedRecipe) => void;
}

export function LibraryRecipeCard({
  recipe,
  homeId,
  onDeleted,
  onAddToMealPlan,
  onImageUpdated,
}: LibraryRecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadRecipeImage(homeId, recipe.id, file);
      onImageUpdated(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveImage() {
    try {
      await deleteRecipeImage(homeId, recipe.id);
      onImageUpdated({ ...recipe, imageUrl: null });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't remove image.");
    }
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface-container-lowest [box-shadow:0_4px_40px_rgba(55,56,48,0.06)]">
      <div className="group relative aspect-video w-full overflow-hidden rounded-t-card bg-surface-container">
        {recipe.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-on-surface/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-on-surface hover:bg-surface"
              >
                {uploading ? "Uploading…" : "Change Photo"}
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-on-surface hover:bg-surface"
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant hover:text-on-surface"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">{uploading ? "Uploading…" : "Upload Photo"}</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-on-surface">{recipe.name}</h3>
        <p className="mt-0.5 text-sm text-on-surface-variant">{recipe.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.cuisine && <MetaChip label={recipe.cuisine} />}
          <MetaChip label={`${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""}`} />
          {recipe.prepTimeMinutes > 0 && <MetaChip label={`Prep ${recipe.prepTimeMinutes} min`} />}
          {recipe.cookTimeMinutes > 0 && <MetaChip label={`Cook ${recipe.cookTimeMinutes} min`} />}
          {totalMins > 0 && <MetaChip label={`${totalMins} min total`} />}
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="mt-3 text-xs text-tertiary underline-offset-2 hover:underline"
        >
          {expanded ? "Hide details" : "Show ingredients & steps"}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Ingredients
              </p>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex gap-1 text-sm text-on-surface">
                    <span className="font-medium">{ing.amount} {ing.unit}</span>
                    <span>{ing.item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Steps
              </p>
              <ol className="list-inside list-decimal space-y-1.5">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="text-sm text-on-surface">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            {recipe.caloriesKcal != null && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Nutrition (per serving)
                </p>
                <div className="flex flex-wrap gap-2">
                  <Chip label={`${recipe.caloriesKcal} kcal`} />
                  {recipe.proteinG != null && <Chip label={`${recipe.proteinG}g protein`} />}
                  {recipe.carbsG != null && <Chip label={`${recipe.carbsG}g carbs`} />}
                  {recipe.fatG != null && <Chip label={`${recipe.fatG}g fat`} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 bg-surface-container-low px-5 py-3">
        <button
          type="button"
          onClick={() => onAddToMealPlan(recipe)}
          className="text-xs text-on-surface hover:text-primary"
        >
          Add to Meal Plan
        </button>
        <button
          type="button"
          onClick={onDeleted}
          className="ml-auto text-xs text-brand-error hover:opacity-70"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
