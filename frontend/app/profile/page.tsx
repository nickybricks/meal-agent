/**
 * profile/page.tsx — User profile page (route: /profile).
 *
 * Displays and allows editing of:
 * - Display name
 * - Dietary restrictions (multi-select chips: vegetarian, vegan, gluten-free, etc.)
 * - Disliked ingredients (free-form tag input)
 * - Favorite cuisines (multi-select chips)
 * - Personality preference (radio: friendly / professional / concise)
 *
 * Also shows a read-only feedback history section:
 * - List of liked/disliked recipes with timestamps
 * - A simple "taste analysis" summary (most liked cuisines, avoided ingredients)
 *
 * Data source: GET /users/{user_id} on load; PATCH via save_preference tool
 * (triggered through the chat agent) or a direct Supabase upsert.
 */

export default function ProfilePage() {
  // TODO: implement in Phase 3
  return <main>Profile — coming soon</main>;
}
