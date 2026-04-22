"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function RegisterPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") || "/onboarding";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setInfo("Check your email to confirm your address, then sign in.");
      return;
    }
    router.replace(nextUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-card bg-surface-container-lowest p-8 [box-shadow:0_8px_40px_rgba(55,56,48,0.06)]">
        <h1 className="text-xl font-semibold text-on-surface">Create an account</h1>
        <label className="block">
          <span className="mb-1.5 block text-sm text-on-surface-variant">Display name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
          />
        </label>
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[1rem] bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-brand-error">{error}</p>}
        {info && <p className="text-sm text-primary">{info}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary py-3 text-on-primary disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create account"}
        </button>
        <p className="text-sm text-on-surface-variant">
          Already have one?{" "}
          <Link href="/login" className="text-on-surface underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
