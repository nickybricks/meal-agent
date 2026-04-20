/**
 * meal-plan/page.tsx — Weekly meal plan page (route: /meal-plan).
 *
 * Layout:
 * - 7-column grid (Mon–Sun), each cell showing the suggested meal name
 *   with a small thumbnail from TheMealDB if available.
 * - "Generate Plan" button — sends a chat message to the agent using the
 *   generate_meal_plan tool for the current user.
 * - "Regenerate Day" button per column — re-asks the agent for a single day.
 * - "Shopping List" button — sends the current plan to the agent and asks
 *   it to produce a consolidated shopping list.
 *
 * State:
 * - mealPlan: Record<string, MealPlanDay>  — keyed by day name
 * - isGenerating: boolean
 *
 * The meal plan is not persisted server-side in Phase 1; it lives in
 * component state and is regenerated on demand.
 */

export default function MealPlanPage() {
  // TODO: implement in Phase 3
  return <main>Meal Plan — coming soon</main>;
}
