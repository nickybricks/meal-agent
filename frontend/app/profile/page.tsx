/**
 * profile/page.tsx — User profile page (route: /profile).
 *
 * Shows the currently selected user's preferences and a recent feedback log.
 * Feedback edits are not implemented here; they happen via the chat agent
 * (save_preference tool) or directly in Supabase.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { getUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAppSettings } from "@/lib/app-context";
import type { UserProfile } from "@/lib/types";

interface FeedbackRow {
  id: string;
  recipe_name: string;
  rating: number;
  cuisine: string | null;
  created_at: string;
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-neutral-500">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((v) => (
        <span
          key={v}
          className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { userId } = useAppSettings();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await getUser(userId);
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }, [userId]);

  const loadFeedback = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("feedback")
      .select("id, recipe_name, rating, cuisine, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setError(error.message);
    } else {
      setFeedback((data ?? []) as FeedbackRow[]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setError(null);
    loadProfile();
    loadFeedback();

    // Live-refresh when preferences or feedback change for this user.
    // Requires Realtime enabled on both tables in Supabase.
    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "preferences", filter: `user_id=eq.${userId}` },
        () => loadProfile(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback", filter: `user_id=eq.${userId}` },
        () => loadFeedback(),
      )
      .subscribe();

    // Fallback: refetch when the tab regains focus.
    const onFocus = () => {
      loadProfile();
      loadFeedback();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, loadProfile, loadFeedback]);

  if (!userId) {
    return (
      <div className="p-6 text-sm text-neutral-500">
        Pick a user in the sidebar to view their profile.
      </div>
    );
  }

  const likedCuisines = feedback
    .filter((f) => f.rating === 5 && f.cuisine)
    .reduce<Record<string, number>>((acc, f) => {
      const k = f.cuisine as string;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const topCuisines = Object.entries(likedCuisines)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Profile</h1>
        {error && (
          <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {profile && (
          <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <div className="text-xs text-neutral-500">Name</div>
              <div className="text-sm font-medium">{profile.name}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Diet</div>
              <Chips items={profile.diet} />
            </div>
            <div>
              <div className="text-xs text-neutral-500">Favorite cuisines</div>
              <Chips items={profile.favoriteCuisines} />
            </div>
            <div>
              <div className="text-xs text-neutral-500">Disliked ingredients</div>
              <Chips items={profile.dislikedIngredients} />
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Taste analysis</h2>
          <div className="text-xs text-neutral-600">
            Most-liked cuisines:{" "}
            {topCuisines.length ? topCuisines.join(", ") : "Not enough data yet."}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Recent feedback</h2>
          {feedback.length === 0 ? (
            <div className="text-xs text-neutral-500">No feedback yet.</div>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {feedback.map((f) => (
                <li key={f.id} className="flex items-center gap-2 py-1 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      f.rating === 5 ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="flex-1 truncate">{f.recipe_name}</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(f.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
