"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(nextUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-card bg-surface-container-lowest p-8 [box-shadow:0_8px_40px_rgba(55,56,48,0.06)]">
        <h1 className="text-xl font-semibold text-on-surface">Log in</h1>
        <label className="block">
          <span className="mb-1.5 block text-sm text-on-surface-variant">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-on-surface-variant">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-brand-error">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary py-3 text-on-primary disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-sm text-on-surface-variant">
          No account?{" "}
          <Link href={`/register${nextUrl !== "/" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`} className="text-on-surface underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
