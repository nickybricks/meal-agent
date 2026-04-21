/**
 * meal-plan/page.tsx — Weekly meal plan page (route: /meal-plan).
 *
 * Uses the chat agent (with generate_meal_plan enabled) to produce a 7-day
 * plan, then renders it as a grid. The plan is parsed best-effort from the
 * agent's reply — TheMealDB images aren't threaded through yet.
 */

"use client";

import { useMemo, useState } from "react";
import { sendMessage } from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";
import type { MealPlanDay } from "@/lib/types";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePlan(text: string): MealPlanDay[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const isTable = lines.some((l) => l.startsWith("|") && l.slice(1).includes("|"));

  const out: MealPlanDay[] = [];
  for (const day of DAYS) {
    if (isTable) {
      const row = lines.find(
        (l) => l.startsWith("|") && new RegExp(`\\b${day}\\b`, "i").test(l),
      );
      if (row) {
        const cells = row
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c && !/^[-:]+$/.test(c));
        // First cell is the day name; rest are meals (Breakfast/Lunch/Dinner).
        const meals = cells.slice(1);
        const meal = meals.length ? meals.join(" · ") : "—";
        out.push({ day, mealName: meal });
        continue;
      }
    }
    const match = lines.find((l) =>
      new RegExp(`^(\\*\\*|\\-|\\d+\\.|)\\s*${day}`, "i").test(l),
    );
    const meal = match
      ? match
          .replace(new RegExp(`^.*${day}[:\\-\\s]*`, "i"), "")
          .replace(/^\*+|\*+$/g, "")
          .trim()
      : "—";
    out.push({ day, mealName: meal });
  }
  return out;
}

export default function MealPlanPage() {
  const settings = useAppSettings();
  // Dedicated session per page mount — keeps plan/shopping-list runs out of
  // the main chat thread so repeated tool calls can't corrupt its state.
  const sessionId = useMemo(newSessionId, []);
  const [plan, setPlan] = useState<MealPlanDay[]>([]);
  const [rawReply, setRawReply] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (prompt: string) => {
    if (!settings.userId) {
      setError("Pick a user first.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await sendMessage({
        userId: settings.userId,
        sessionId,
        message: prompt,
        model: settings.model,
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
        enabledTools: settings.enabledTools,
        personality: settings.personality,
      });
      setRawReply(res.reply);
      setPlan(parsePlan(res.reply));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Weekly meal plan</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                generate(
                  "Call the generate_meal_plan tool for me with days=7. Don't ask follow-up questions — use whatever preferences are on file and pick reasonable defaults otherwise. Return the tool's markdown table unchanged.",
                )
              }
              disabled={isLoading}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:bg-neutral-400"
            >
              {isLoading ? "Generating…" : "Generate plan"}
            </button>
            {plan.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  generate(
                    `Turn this weekly plan into a consolidated shopping list:\n${rawReply}`,
                  )
                }
                disabled={isLoading}
                className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                Shopping list
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {plan.length === 0 && !isLoading && (
          <div className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            Click <strong>Generate plan</strong> to build a week.
          </div>
        )}

        {plan.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {plan.map((d) => (
              <div
                key={d.day}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {d.day}
                </div>
                <div className="flex-1 text-sm text-neutral-900">{d.mealName}</div>
                <button
                  type="button"
                  onClick={() => generate(`Regenerate ${d.day}'s meal only.`)}
                  disabled={isLoading}
                  className="self-start text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            ))}
          </div>
        )}

        {rawReply && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-500">
              Raw agent reply
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-neutral-100 p-3 text-xs text-neutral-700">
              {rawReply}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
