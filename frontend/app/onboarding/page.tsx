"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppSettings } from "@/lib/app-context";
import {
  acceptInvitation,
  createHome,
  listHomes,
  listMyInvitations,
  updatePreferences,
} from "@/lib/api";
import type { Home, Invitation } from "@/lib/types";

const DIET_OPTIONS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto"];
const SKILL_OPTIONS = [
  { id: "beginner", label: "Beginner — simple recipes, basic techniques" },
  { id: "intermediate", label: "Intermediate — standard techniques, a bit more complex" },
  { id: "advanced", label: "Advanced — comfortable with complex recipes" },
];
const DEFAULT_MODEL = "gpt-4o-mini";
const TOTAL_STEPS = 7;

// Inline tag input used for multiple preference steps
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
    <div className="min-h-[2.75rem] w-full cursor-text rounded-[1rem] bg-surface-container-highest px-3 py-2 text-sm text-on-surface focus-within:bg-surface-bright">
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

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { user, loading } = useAuth();
  const { setHomeId } = useAppSettings();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [homeName, setHomeName] = useState("My Kitchen");
  const [localHomeId, setLocalHomeId] = useState("");
  const [existingHomes, setExistingHomes] = useState<Home[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preference state — collected across steps 3–7
  const [diets, setDiets] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("");
  const [adventurousness, setAdventurousness] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/onboarding");
      return;
    }
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    setName((meta.name as string) ?? "");
    Promise.all([listHomes().catch(() => [] as Home[]), listMyInvitations().catch(() => [] as Invitation[])])
      .then(([homes, invitations]) => {
        setExistingHomes(homes);
        setInvites(invitations);

        if (homes.length > 0) {
          const primaryHomeId = homes[0].id;
          setHomeId(primaryHomeId);
          setLocalHomeId(primaryHomeId);
          setStep(3);
        }
      })
      .catch(() => {
        setExistingHomes([]);
        setInvites([]);
      });
  }, [user, loading, router]);

  async function handleStep1(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ data: { name } });
    setBusy(false);
    if (err) return setError(err.message);
    setStep(2);
  }

  async function handleCreateHome(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const home = await createHome(homeName.trim() || "My Kitchen");
      setHomeId(home.id);
      setLocalHomeId(home.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create home");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvite(token: string) {
    setError(null);
    setBusy(true);
    try {
      const home = await acceptInvitation(token);
      setHomeId(home.id);
      setLocalHomeId(home.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept invite");
    } finally {
      setBusy(false);
    }
  }

  function toggleDiet(value: string) {
    setDiets((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  async function finishOnboarding() {
    setError(null);
    setBusy(true);
    try {
      if (localHomeId) {
        await updatePreferences(localHomeId, {
          diet: diets,
          allergies,
          dislikedIngredients: dislikes,
          likedIngredients: likes,
          favoriteCuisines: cuisines,
          ...(skillLevel ? { cookingSkillLevel: skillLevel } : {}),
          ...(adventurousness > 0 ? { adventurousness } : {}),
        });
      }
      const { error: err } = await supabase.auth.updateUser({
        data: { default_model: DEFAULT_MODEL, onboarded: true },
      });
      if (err) return setError(err.message);
      await supabase.auth.refreshSession();
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save preferences");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish(e: FormEvent) {
    e.preventDefault();
    await finishOnboarding();
  }

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-card bg-surface-container-lowest p-8 [box-shadow:0_8px_40px_rgba(55,56,48,0.06)]">
        {/* Progress bar */}
        <div className="mb-6 flex items-center gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-surface-container-high"}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-card bg-error-container px-4 py-3 text-sm text-brand-error">
            {error}
          </div>
        )}

        {/* Step 1 — Name */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-5">
            <h1 className="text-xl font-semibold text-on-surface">What should we call you?</h1>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 text-on-primary disabled:opacity-60"
            >
              Continue
            </button>
          </form>
        )}

        {/* Step 2 — Home */}
        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-xl font-semibold text-on-surface">Your kitchen</h1>

            {existingHomes.length > 0 && (
              <section className="space-y-3 rounded-card bg-surface-container p-4">
                <h2 className="text-sm font-semibold text-on-surface">You're already in a home</h2>
                <ul className="space-y-2">
                  {existingHomes.map((home) => (
                    <li key={home.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium text-on-surface">{home.name}</div>
                        <div className="text-xs text-on-surface-variant">role: {home.role}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setHomeId(home.id);
                          setLocalHomeId(home.id);
                          setStep(3);
                        }}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs text-on-primary"
                      >
                        Continue
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {invites.length > 0 && (
              <section className="space-y-3 rounded-card bg-surface-container p-4">
                <h2 className="text-sm font-semibold text-on-surface">Pending invitations</h2>
                <ul className="space-y-3">
                  {invites.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium text-on-surface">{inv.homeName ?? "Home"}</div>
                        <div className="text-xs text-on-surface-variant">
                          {inv.inviterName ? `from ${inv.inviterName}` : ""} · role: {inv.role}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAcceptInvite(inv.token)}
                        disabled={busy}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs text-on-primary disabled:opacity-60"
                      >
                        Accept
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <form onSubmit={handleCreateHome} className="space-y-3">
              <h2 className="text-sm font-semibold text-on-surface">
                {existingHomes.length > 0 || invites.length > 0
                  ? "Or create your own"
                  : "Create your home"}
              </h2>
              <input
                required
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                placeholder="Home name"
                className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-primary py-3 text-on-primary disabled:opacity-60"
              >
                Create home
              </button>
            </form>
          </div>
        )}

        {/* Step 3 — Allergies & Diet */}
        {step === 3 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-on-surface">
              Any allergies or dietary restrictions?
            </h1>
            <p className="text-sm text-on-surface-variant">Pick all that apply. You can change these later.</p>

            <div>
              <div className="mb-2 text-xs font-medium text-on-surface-variant">Diet</div>
              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map((d) => {
                  const active = diets.includes(d);
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

            <div>
              <div className="mb-2 text-xs font-medium text-on-surface-variant">
                Allergies (type and press Enter)
              </div>
              <TagInput
                tags={allergies}
                onChange={setAllergies}
                placeholder="e.g. peanuts, shellfish, gluten…"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 rounded-full bg-surface-container py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm text-on-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Disliked ingredients */}
        {step === 4 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-on-surface">
              What foods do you want to avoid?
            </h1>
            <p className="text-sm text-on-surface-variant">
              Ingredients or foods you dislike. Type and press Enter to add.
            </p>
            <TagInput
              tags={dislikes}
              onChange={setDislikes}
              placeholder="e.g. cilantro, liver, blue cheese…"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 rounded-full bg-surface-container py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm text-on-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — Liked ingredients */}
        {step === 5 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-on-surface">
              What ingredients do you enjoy?
            </h1>
            <p className="text-sm text-on-surface-variant">
              Foods or ingredients you love. Type and press Enter to add.
            </p>
            <TagInput
              tags={likes}
              onChange={setLikes}
              placeholder="e.g. garlic, lemon, mushrooms…"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(6)}
                className="flex-1 rounded-full bg-surface-container py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep(6)}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm text-on-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 6 — Cuisines */}
        {step === 6 && (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-on-surface">
              What cuisines do you enjoy?
            </h1>
            <p className="text-sm text-on-surface-variant">
              Type and press Enter to add cuisines you like.
            </p>
            <TagInput
              tags={cuisines}
              onChange={setCuisines}
              placeholder="e.g. Italian, Japanese, Mexican…"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(7)}
                className="flex-1 rounded-full bg-surface-container py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep(7)}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm text-on-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 7 — Cooking skill & Adventurousness */}
        {step === 7 && (
          <form onSubmit={handleFinish} className="space-y-6">
            <h1 className="text-xl font-semibold text-on-surface">
              Tell us about your cooking style
            </h1>

            <div className="space-y-2">
              <div className="text-sm font-medium text-on-surface">What's your cooking skill level?</div>
              {SKILL_OPTIONS.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-card p-3 text-sm transition ${
                    skillLevel === s.id
                      ? "bg-primary-container text-on-surface"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <input
                    type="radio"
                    name="skill"
                    value={s.id}
                    checked={skillLevel === s.id}
                    onChange={() => setSkillLevel(s.id)}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-on-surface">
                How adventurous are you with food?
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
              <div className="text-center text-sm font-medium text-primary">
                {adventurousness > 0
                  ? ["", "1 — Stick to the classics", "2 — Mostly familiar", "3 — Open to new things", "4 — Love variety", "5 — Surprise me!"][adventurousness]
                  : "Move the slider to set"}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                onClick={() => {
                  setSkillLevel("");
                  setAdventurousness(0);
                }}
                disabled={busy}
                className="flex-1 rounded-full bg-surface-container py-2.5 text-sm text-on-surface hover:bg-surface-container-high"
              >
                {busy ? "Saving…" : "Skip"}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm text-on-primary disabled:opacity-60"
              >
                {busy ? "Saving…" : "Finish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
