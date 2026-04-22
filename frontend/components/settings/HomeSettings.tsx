"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createInvitation,
  listHomeInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
} from "@/lib/api";
import type { Invitation, Member } from "@/lib/types";
import { useAppSettings } from "@/lib/app-context";
import { useAuth } from "@/components/auth/AuthProvider";

type Role = "owner" | "admin" | "member";

function inviteLinkFor(token: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/invite/${token}`;
}

export default function HomeSettings() {
  const { homeId } = useAppSettings();
  const { me } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const myRole: Role | undefined = members.find((m) => m.userId === me?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const refresh = useCallback(async () => {
    if (!homeId) return;
    setError(null);
    try {
      const [mem, invs] = await Promise.all([
        listMembers(homeId),
        listHomeInvitations(homeId).catch(() => [] as Invitation[]),
      ]);
      setMembers(mem);
      setInvitations(invs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load home");
    }
  }, [homeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!homeId) return;
    setError(null);
    setBusy(true);
    try {
      const inv = await createInvitation(homeId, inviteEmail.trim(), inviteRole);
      setInvitations((prev) => [inv, ...prev]);
      setInviteEmail("");
      setInviteRole("member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create invite");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    setBusy(true);
    try {
      await revokeInvitation(invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't revoke invite");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!homeId) return;
    if (!confirm("Remove this member from the home?")) return;
    setBusy(true);
    try {
      await removeMember(homeId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove member");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(token: string) {
    const link = inviteLinkFor(token);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(token);
      setTimeout(() => setCopied((prev) => (prev === token ? null : prev)), 1500);
    } catch {
      window.prompt("Copy invite link", link);
    }
  }

  if (!homeId) {
    return (
      <p className="text-sm text-on-surface-variant">No home selected.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-card bg-error-container px-4 py-3 text-sm text-brand-error">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          Members
        </h3>
        {members.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No members yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="flex-1">
                  <span className="font-medium text-on-surface">
                    {m.name || m.email || m.userId}
                  </span>
                  {m.email && (
                    <span className="ml-2 text-xs text-on-surface-variant">{m.email}</span>
                  )}
                </span>
                <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface">
                  {m.role}
                </span>
                {canManage && m.userId !== me?.id && m.role !== "owner" && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    disabled={busy}
                    className="text-xs text-brand-error hover:opacity-70 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Invite someone
          </h3>
          <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              className="flex-1 rounded-[1rem] bg-surface-container-highest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="rounded-[1rem] bg-surface-container-highest px-3 py-2 text-sm text-on-surface outline-none"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={busy || !inviteEmail}
              className="rounded-full bg-primary px-5 py-2 text-sm text-on-primary disabled:opacity-40"
            >
              Invite
            </button>
          </form>
          <p className="text-xs text-on-surface-variant">
            Invites are copy-paste links — no email is sent. Share the link with the
            invitee after creating it.
          </p>
        </div>
      )}

      {canManage && invitations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Pending invitations
          </h3>
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="flex-1 truncate">
                  <span className="font-medium text-on-surface">{inv.email}</span>
                  <span className="ml-2 text-xs text-on-surface-variant">
                    {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => copyLink(inv.token)}
                  className="rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface hover:bg-surface-container-high"
                >
                  {copied === inv.token ? "Copied!" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(inv.id)}
                  disabled={busy}
                  className="text-xs text-brand-error hover:opacity-70 disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
