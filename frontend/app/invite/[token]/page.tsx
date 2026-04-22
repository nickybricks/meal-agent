"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  acceptInvitation,
  declineInvitation,
  lookupInvitation,
} from "@/lib/api";
import type { Invitation } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppSettings } from "@/lib/app-context";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const { user, loading } = useAuth();
  const { setHomeId } = useAppSettings();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || !token) return;
    lookupInvitation(token)
      .then(setInvitation)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load invitation"));
  }, [loading, user, token]);

  async function handleAccept() {
    setError(null);
    setBusy(true);
    try {
      const home = await acceptInvitation(token);
      setHomeId(home.id);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept invitation");
      setBusy(false);
    }
  }

  async function handleDecline() {
    setError(null);
    setBusy(true);
    try {
      await declineInvitation(token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't decline invitation");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-on-surface-variant">
        Loading…
      </div>
    );
  }

  if (!user) {
    const next = `/invite/${token}`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm space-y-5 rounded-card bg-surface-container-lowest p-8 [box-shadow:0_8px_40px_rgba(55,56,48,0.06)]">
          <h1 className="text-xl font-semibold text-on-surface">You&apos;ve been invited</h1>
          <p className="text-sm text-on-surface-variant">
            Sign in or create an account to accept this invitation.
          </p>
          <div className="flex gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="flex-1 rounded-full bg-primary py-2.5 text-center text-sm text-on-primary"
            >
              Sign in
            </Link>
            <Link
              href={`/register?next=${encodeURIComponent(next)}`}
              className="flex-1 rounded-full bg-surface-container py-2.5 text-center text-sm text-on-surface hover:bg-surface-container-high"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-5 rounded-card bg-surface-container-lowest p-8 [box-shadow:0_8px_40px_rgba(55,56,48,0.06)]">
        <h1 className="text-xl font-semibold text-on-surface">Invitation</h1>

        {error && (
          <div className="rounded-card bg-error-container px-4 py-3 text-sm text-brand-error">{error}</div>
        )}

        {!invitation && !error && (
          <div className="text-sm text-on-surface-variant">Loading invitation…</div>
        )}

        {invitation && (
          <>
            <div className="rounded-card bg-surface-container p-4 text-sm">
              <div className="text-xs text-on-surface-variant">Home</div>
              <div className="font-medium text-on-surface">{invitation.homeName ?? "Home"}</div>
              <div className="mt-3 text-xs text-on-surface-variant">Invited by</div>
              <div className="font-medium text-on-surface">{invitation.inviterName ?? "A member"}</div>
              <div className="mt-3 text-xs text-on-surface-variant">Role</div>
              <div className="font-medium text-on-surface">{invitation.role}</div>
              <div className="mt-3 text-xs text-on-surface-variant">Expires</div>
              <div className="text-on-surface">{new Date(invitation.expiresAt).toLocaleString()}</div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDecline}
                disabled={busy}
                className="flex-1 rounded-full bg-surface-container py-2.5 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-60"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={busy}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm text-on-primary disabled:opacity-60"
              >
                {busy ? "Accepting…" : "Accept"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
