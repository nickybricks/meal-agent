/**
 * supabase.ts — Re-exports the browser Supabase client.
 *
 * Keep existing callers working (profile page direct reads, settings helpers)
 * while new code imports from supabase-browser.ts directly.
 */

export { getSupabaseBrowserClient as default, getSupabaseBrowserClient } from "./supabase-browser";
export { getSupabaseBrowserClient as supabaseClient } from "./supabase-browser";
import { getSupabaseBrowserClient } from "./supabase-browser";

export const supabase = getSupabaseBrowserClient();
