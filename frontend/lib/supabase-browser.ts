/**
 * supabase-browser.ts — Browser-side Supabase client.
 *
 * Created via @supabase/ssr so the auth session is persisted in cookies that
 * the Next.js middleware can also read. Singleton — created once per tab.
 */

import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createBrowserClient(url, key);
  return _client;
}

// Satisfy eslint when CookieOptions is imported for future callers.
export type { CookieOptions };
