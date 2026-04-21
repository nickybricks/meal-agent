/**
 * ToolToggle.tsx — Enable/disable individual agent tools.
 */

"use client";

interface Props {
  enabledTools: string[];
  onChange: (tools: string[]) => void;
}

const TOOLS: { key: string; label: string; description: string }[] = [
  {
    key: "search_recipes",
    label: "search_recipes",
    description: "Look up recipes on TheMealDB by ingredient, cuisine, or name.",
  },
  {
    key: "get_user_profile",
    label: "get_user_profile",
    description: "Read the current user's preferences and feedback history.",
  },
  {
    key: "save_preference",
    label: "save_preference",
    description: "Record likes / dislikes back to Supabase.",
  },
  {
    key: "substitute_ingredient",
    label: "substitute_ingredient",
    description: "LLM-powered swaps for missing or unwanted ingredients.",
  },
  {
    key: "generate_meal_plan",
    label: "generate_meal_plan",
    description: "Build a multi-day meal plan using the LLM + TheMealDB.",
  },
];

export default function ToolToggle({ enabledTools, onChange }: Props) {
  const set = new Set(enabledTools);

  const toggle = (key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-2">
      {TOOLS.map((t) => {
        const on = set.has(t.key);
        return (
          <label
            key={t.key}
            className="flex cursor-pointer items-start gap-3 rounded border border-neutral-200 p-2 hover:bg-neutral-50"
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => toggle(t.key)}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-neutral-900">{t.label}</div>
              <div className="text-xs text-neutral-600">{t.description}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
