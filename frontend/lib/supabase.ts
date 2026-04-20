/**
 * supabase.ts — Supabase browser client for direct frontend queries.
 *
 * Used for:
 * - Reading/writing user preferences from the profile page (bypasses the agent)
 * - Clearing feedback history from the settings page
 * - Real-time subscriptions if added in a later phase
 *
 * Credentials come from:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * The anon key is safe to expose in the browser — Supabase Row Level Security
 * (RLS) policies on the database restrict what it can read/write.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
