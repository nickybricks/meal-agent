"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMealPlanEntry,
  deleteMealPlanEntry,
  listMealPlanEntries,
  listSavedRecipes,
  SlotTakenError,
} from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";
import type { MealPlanEntry, MealSlot, SavedRecipe } from "@/lib/types";

const DAY_ABBREVS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SLOTS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "☀️" },
  { key: "lunch", label: "Lunch", emoji: "🍴" },
  { key: "dinner", label: "Dinner", emoji: "🍽️" },
];

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const offset = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - offset);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parsePrepMinutes(content: string): number | null {
  const m = content.match(/prep[^0-9]*(\d+)\s*min/i);
  return m ? parseInt(m[1], 10) : null;
}

type AddTarget = { date: string; slot: MealSlot; dayAbbrev: string };

export default function MealPlanPage() {
  const router = useRouter();
  const settings = useAppSettings();

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(() => {
    const dow = new Date().getDay();
    return (dow + 6) % 7;
  });

  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);

  const [undoEntry, setUndoEntry] = useState<MealPlanEntry | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayIso = isoDate(new Date());
  const thisWeekStart = mondayOf(new Date());
  const isThisWeek = isoDate(weekStart) === isoDate(thisWeekStart);

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        return { abbrev: DAY_ABBREVS[i], date: isoDate(d), dateObj: d };
      }),
    [weekStart],
  );

  const selectedDate = weekDates[selectedDayIdx]?.date ?? weekDates[0].date;

  const entriesByKey = useMemo(() => {
    const map = new Map<string, MealPlanEntry>();
    for (const e of entries) map.set(`${e.planDate}:${e.slot}`, e);
    return map;
  }, [entries]);

  const loadEntries = useCallback(async () => {
    if (!settings.homeId) return;
    setIsLoading(true);
    try {
      const start = isoDate(weekStart);
      const end = isoDate(addDays(weekStart, 6));
      const rows = await listMealPlanEntries(settings.homeId, start, end);
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load meal plan.");
    } finally {
      setIsLoading(false);
    }
  }, [settings.homeId, weekStart]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (entry: MealPlanEntry) => {
    if (!settings.homeId) return;
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    setUndoEntry(entry);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoEntry(null), 5000);
    try {
      await deleteMealPlanEntry(settings.homeId, entry.id);
    } catch (e) {
      setEntries((prev) => [...prev, entry]);
      setUndoEntry(null);
      setError(e instanceof Error ? e.message : "Couldn't delete entry.");
    }
  };

  const handleUndo = async () => {
    if (!undoEntry || !settings.homeId) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const saved = undoEntry;
    setUndoEntry(null);
    try {
      const restored = await addMealPlanEntry({
        homeId: settings.homeId,
        planDate: saved.planDate,
        slot: saved.slot,
        recipeName: saved.recipeName,
        recipeContent: saved.recipeContent,
        overwrite: false,
      });
      setEntries((prev) => [...prev, restored]);
    } catch {
      // slot may have been refilled — silently ignore
    }
  };

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => addDays(prev, delta));
    setSelectedDayIdx(0);
  };

  const goToThisWeek = () => {
    setWeekStart(thisWeekStart);
    const dow = new Date().getDay();
    setSelectedDayIdx((dow + 6) % 7);
  };

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  }, [weekStart]);

  const handleOpenAdd = (date: string, slot: MealSlot, dayAbbrev: string) => {
    setAddTarget({ date, slot, dayAbbrev });
    setShowRecipePicker(false);
  };

  const handleOpenRecipePicker = async () => {
    if (!settings.homeId) return;
    setShowRecipePicker(true);
    setIsLoadingRecipes(true);
    setRecipeSearch("");
    try {
      const recipes = await listSavedRecipes(settings.homeId);
      setSavedRecipes(recipes);
    } catch {
      setSavedRecipes([]);
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const handleSelectRecipe = async (recipe: SavedRecipe) => {
    if (!addTarget || !settings.homeId) return;
    try {
      const entry = await addMealPlanEntry({
        homeId: settings.homeId,
        planDate: addTarget.date,
        slot: addTarget.slot,
        recipeName: recipe.name,
        recipeContent: recipe.description || recipe.name,
        overwrite: false,
      });
      setEntries((prev) => [...prev, entry]);
      setAddTarget(null);
      setShowRecipePicker(false);
    } catch (err) {
      if (err instanceof SlotTakenError) {
        setError(`Slot already has "${err.existing.recipeName}"`);
      } else {
        setError(err instanceof Error ? err.message : "Couldn't add recipe.");
      }
      setAddTarget(null);
      setShowRecipePicker(false);
    }
  };

  const handleCreateWithAI = () => {
    if (!addTarget) return;
    const prompt = `Suggest a ${addTarget.slot} recipe for ${addTarget.dayAbbrev}`;
    setAddTarget(null);
    router.push(`/?q=${encodeURIComponent(prompt)}`);
  };

  const filteredRecipes = useMemo(
    () =>
      savedRecipes.filter((r) =>
        r.name.toLowerCase().includes(recipeSearch.toLowerCase()),
      ),
    [savedRecipes, recipeSearch],
  );

  const closeDialogs = () => {
    setAddTarget(null);
    setShowRecipePicker(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-8">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold leading-none tracking-tight text-on-surface">
              This Week&apos;s Canvas
            </h1>
            <p className="mt-2 text-base text-on-surface-variant">
              Your Melagent canvas for {weekLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => shiftWeek(-7)}
              disabled={isLoading}
              className="rounded-full bg-surface-container-high px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
              aria-label="Previous week"
            >
              ←
            </button>
            {!isThisWeek && (
              <button
                type="button"
                onClick={goToThisWeek}
                className="rounded-full bg-surface-container-high px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => shiftWeek(7)}
              disabled={isLoading}
              className="rounded-full bg-surface-container-high px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
              aria-label="Next week"
            >
              →
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-card bg-error-container px-4 py-3 text-sm text-brand-error flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-4 underline"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Day selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weekDates.map(({ abbrev, date, dateObj }, i) => {
            const isSelected = i === selectedDayIdx;
            const isToday = date === todayIso;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDayIdx(i)}
                className={`flex min-w-[3.75rem] flex-col items-center gap-0.5 rounded-full px-3 py-2.5 transition-colors ${
                  isSelected
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <span className="text-xs font-semibold">{abbrev}</span>
                <span
                  className={`text-base font-bold ${
                    isToday && !isSelected ? "text-primary" : ""
                  }`}
                >
                  {dateObj.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Meal columns */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {SLOTS.map(({ key, label, emoji }) => {
            const entry = entriesByKey.get(`${selectedDate}:${key}`);
            const prepMin = entry ? parsePrepMinutes(entry.recipeContent) : null;
            const hasDescription =
              entry?.recipeContent &&
              entry.recipeContent !== entry.recipeName;

            return (
              <div key={key} className="flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden="true">
                    {emoji}
                  </span>
                  <h2 className="text-lg font-bold text-on-surface">{label}</h2>
                </div>

                {entry ? (
                  /* Filled recipe card */
                  <div className="group relative rounded-card bg-surface-container-lowest shadow-card overflow-hidden">
                    {/* Gradient image placeholder */}
                    <div
                      className="relative h-40 w-full"
                      style={{
                        background:
                          "linear-gradient(135deg, #297300 0%, #99f070 100%)",
                      }}
                    >
                      {prepMin !== null && (
                        <span className="absolute left-3 top-3 rounded-full bg-primary-container px-3 py-1 text-xs font-semibold text-on-surface">
                          {prepMin} min prep
                        </span>
                      )}
                    </div>

                    {/* Delete button — revealed on hover */}
                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant opacity-0 transition-all group-hover:opacity-100 hover:!bg-brand-error hover:!text-white"
                      aria-label={`Remove ${entry.recipeName}`}
                    >
                      ✕
                    </button>

                    <div className="p-4">
                      <h3 className="font-bold text-on-surface leading-snug">
                        {entry.recipeName}
                      </h3>
                      {hasDescription && (
                        <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                          {entry.recipeContent}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Empty slot placeholder */
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAdd(
                        selectedDate,
                        key,
                        weekDates[selectedDayIdx]?.abbrev ?? "",
                      )
                    }
                    className="flex h-[14.5rem] w-full items-center justify-center rounded-card border-2 border-dashed border-outline-variant text-4xl text-on-surface-variant opacity-40 transition-opacity hover:opacity-70"
                    aria-label={`Add ${label}`}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add-to-slot choice dialog */}
      {addTarget && !showRecipePicker && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/10 backdrop-blur-sm"
          onClick={closeDialogs}
        >
          <div
            className="rounded-card bg-surface-container-lowest shadow-card p-7 w-80 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-lg text-on-surface">
                Add {addTarget.slot}
              </h3>
              <p className="mt-0.5 text-sm text-on-surface-variant capitalize">
                {addTarget.dayAbbrev}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenRecipePicker}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary"
            >
              Add from Recipe Library
            </button>
            <button
              type="button"
              onClick={handleCreateWithAI}
              className="rounded-full bg-surface-container-high px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-highest"
            >
              Create with AI
            </button>
            <button
              type="button"
              onClick={closeDialogs}
              className="text-sm text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recipe picker dialog */}
      {addTarget && showRecipePicker && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/10 backdrop-blur-sm"
          onClick={closeDialogs}
        >
          <div
            className="rounded-card bg-surface-container-lowest shadow-card p-6 w-96 max-h-[70vh] flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg text-on-surface">
              Recipe Library
            </h3>
            <input
              type="text"
              placeholder="Search recipes…"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm focus:bg-surface-bright focus:outline-none"
            />
            <div className="overflow-y-auto flex flex-col gap-2 min-h-[6rem]">
              {isLoadingRecipes ? (
                <p className="text-sm text-on-surface-variant py-4 text-center">
                  Loading…
                </p>
              ) : filteredRecipes.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-4 text-center">
                  No saved recipes found.
                </p>
              ) : (
                filteredRecipes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRecipe(r)}
                    className="rounded-[1rem] bg-surface-container p-4 text-left hover:bg-surface-container-high transition-colors"
                  >
                    <div className="font-medium text-sm text-on-surface">
                      {r.name}
                    </div>
                    {r.description && (
                      <div className="mt-0.5 text-xs text-on-surface-variant line-clamp-1">
                        {r.description}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={closeDialogs}
              className="text-sm text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {undoEntry && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-4 rounded-full bg-on-surface px-5 py-3 text-sm text-surface shadow-card whitespace-nowrap">
          <span>Removed &ldquo;{undoEntry.recipeName}&rdquo;</span>
          <button
            type="button"
            onClick={handleUndo}
            className="font-semibold underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
