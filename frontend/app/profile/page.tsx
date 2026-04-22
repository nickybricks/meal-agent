"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { getUser, updatePreferences } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAppSettings } from "@/lib/app-context";
import { useAuth } from "@/components/auth/AuthProvider";
import type { UserProfile } from "@/lib/types";

const DIET_OPTIONS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto"];
const SKILL_OPTIONS = ["beginner", "intermediate", "advanced"];

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function commit() {
    const val = input.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="min-h-[2.75rem] w-full cursor-text rounded-[1rem] bg-surface-container-highest px-3 py-2 text-sm focus-within:bg-surface-bright">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-primary-container px-3 py-0.5 text-xs text-on-surface"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="ml-0.5 opacity-60 hover:opacity-100"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { homeId } = useAppSettings();
  const { me } = useAuth();
  const userId = me?.id ?? "";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable preference state (populated on load)
  const [diet, setDiet] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("");
  const [adventurousness, setAdventurousness] = useState<number>(0);

  const loadProfile = useCallback(async () => {
    if (!userId || !homeId) return;
    try {
      const p = await getUser(userId, homeId);
      setProfile(p);
      setDiet(p.diet);
      setAllergies(p.allergies);
      setDislikes(p.dislikedIngredients);
      setLikes(p.likedIngredients);
      setCuisines(p.favoriteCuisines);
      setSkillLevel(p.cookingSkillLevel ?? "");
      setAdventurousness(p.adventurousness ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }, [userId, homeId]);

  useEffect(() => {
    if (!userId) return;
    setError(null);
    loadProfile();

    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "preferences", filter: `user_id=eq.${userId}` },
        () => loadProfile(),
      )
      .subscribe();

    const onFocus = () => { loadProfile(); };
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, loadProfile]);

  async function handleSave() {
    if (!homeId) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      await updatePreferences(homeId, {
        diet,
        allergies,
        dislikedIngredients: dislikes,
        likedIngredients: likes,
        favoriteCuisines: cuisines,
        cookingSkillLevel: skillLevel || undefined,
        adventurousness: adventurousness > 0 ? adventurousness : undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  function toggleDiet(value: string) {
    setDiet((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  if (!userId || !homeId) {
    return (
      <div className="p-6 text-sm text-on-surface-variant">Loading your profile…</div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-on-surface">Profile</h1>
          {profile && (
            <div className="text-sm text-on-surface-variant">{profile.name}</div>
          )}
        </div>

        {error && (
          <div className="rounded-card bg-error-container px-4 py-3 text-sm text-brand-error">
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-card bg-primary-container px-4 py-3 text-sm text-on-surface">
            Preferences saved.
          </div>
        )}

        {/* Editable preferences */}
        <section className="flex flex-col gap-5 rounded-card bg-surface-container-lowest shadow-card p-6">
          <h2 className="text-sm font-semibold text-on-surface">Food preferences</h2>

          {/* Diet */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">Dietary restrictions</div>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((d) => {
                const active = diet.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDiet(d)}
                    className={`rounded-full px-4 py-1.5 text-sm transition active:scale-95 ${
                      active
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">
              Allergies &amp; intolerances
            </div>
            <TagInput
              tags={allergies}
              onChange={setAllergies}
              placeholder="e.g. peanuts, shellfish — press Enter to add"
            />
          </div>

          {/* Dislikes */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">Ingredients to avoid</div>
            <TagInput
              tags={dislikes}
              onChange={setDislikes}
              placeholder="e.g. cilantro, liver — press Enter to add"
            />
          </div>

          {/* Likes */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">
              Favourite ingredients
            </div>
            <TagInput
              tags={likes}
              onChange={setLikes}
              placeholder="e.g. garlic, lemon — press Enter to add"
            />
          </div>

          {/* Cuisines */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">Favourite cuisines</div>
            <TagInput
              tags={cuisines}
              onChange={setCuisines}
              placeholder="e.g. Italian, Japanese — press Enter to add"
            />
          </div>

          {/* Skill level */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">Cooking skill level</div>
            <select
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
              className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface focus:bg-surface-bright focus:outline-none"
            >
              <option value="">Not set</option>
              {SKILL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Adventurousness */}
          <div>
            <div className="mb-2 text-xs text-on-surface-variant">
              Food adventurousness{adventurousness > 0 ? ` — ${adventurousness}/5` : ""}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant">Comfort food</span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={adventurousness || 3}
                onChange={(e) => setAdventurousness(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-on-surface-variant">Adventurous</span>
            </div>
            {adventurousness > 0 && (
              <div className="mt-1 text-center text-xs text-on-surface-variant">
                {["", "Stick to the classics", "Mostly familiar", "Open to new things", "Love variety", "Surprise me!"][adventurousness]}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="self-end rounded-full bg-primary px-6 py-2.5 text-sm text-on-primary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </section>

      </div>
    </div>
  );
}
