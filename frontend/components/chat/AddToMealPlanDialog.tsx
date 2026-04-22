"use client";

import { useMemo, useState } from "react";
import { addMealPlanEntry, SlotTakenError } from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";
import type { MealSlot, StructuredRecipe } from "@/lib/types";

interface Props {
  recipe: StructuredRecipe;
  sessionId?: string;
  onClose: () => void;
  onSaved: () => void;
}

function recipeToMarkdown(r: StructuredRecipe): string {
  const lines = [
    `**${r.name}**`,
    r.description,
    `Servings: ${r.servings} | Prep: ${r.prepTimeMinutes} min | Cook: ${r.cookTimeMinutes} min`,
    "",
    "**Ingredients**",
    ...r.ingredients.map((ing) => `- ${ing.amount} ${ing.unit} ${ing.item}`),
    "",
    "**Steps**",
    ...r.steps.map((s, i) => `${i + 1}. ${s}`),
  ];
  return lines.join("\n");
}

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AddToMealPlanDialog({
  recipe,
  sessionId,
  onClose,
  onSaved,
}: Props) {
  const { homeId } = useAppSettings();
  const [name, setName] = useState<string>(() => recipe.name);
  const [date, setDate] = useState<string>(todayIso);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () => !!homeId && !!date && !!slot && name.trim().length > 0,
    [homeId, date, slot, name],
  );

  const save = async (overwrite: boolean) => {
    if (!homeId) {
      setError("Pick a home first.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addMealPlanEntry({
        homeId,
        planDate: date,
        slot,
        recipeName: name.trim(),
        recipeContent: recipeToMarkdown(recipe),
        sourceSessionId: sessionId,
        overwrite,
      });
      onSaved();
    } catch (err) {
      if (err instanceof SlotTakenError) {
        const replace = window.confirm(
          `${formatSlot(slot)} on ${date} already has "${err.existing.recipeName}". Replace it?`,
        );
        if (replace) {
          await save(true);
          return;
        }
      } else {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/30 p-4 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card bg-surface/80 p-6 backdrop-blur-[20px] [box-shadow:0_8px_40px_rgba(55,56,48,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-on-surface">
          Add to meal plan
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
            <span>Recipe name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-[1rem] bg-surface-container-highest px-3 py-2 text-sm text-on-surface focus:bg-surface-bright focus:outline-none"
              placeholder="e.g. Chicken Adobo"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-[1rem] bg-surface-container-highest px-3 py-2 text-sm text-on-surface focus:outline-none"
            />
          </label>

          <fieldset className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
            <span>Slot</span>
            <div className="flex gap-2">
              {SLOTS.map((s) => (
                <label
                  key={s}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-sm transition ${
                    slot === s
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="slot"
                    value={s}
                    checked={slot === s}
                    onChange={() => setSlot(s)}
                    className="sr-only"
                  />
                  {formatSlot(s)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {error && (
          <div className="mt-3 rounded-full bg-error-container px-3 py-2 text-xs text-brand-error">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full bg-surface-container px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={!canSave || saving}
            className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSlot(s: MealSlot): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
