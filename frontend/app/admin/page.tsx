"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listAllHomes,
  listRecentFeedback,
  listUsers,
  type AdminFeedbackRow,
  type AdminHome,
} from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminPage() {
  const { me, loading } = useAuth();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [homes, setHomes] = useState<AdminHome[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.isAdmin) return;
    Promise.all([listUsers(), listAllHomes(), listRecentFeedback(50)])
      .then(([u, h, f]) => {
        setUsers(u);
        setHomes(h);
        setFeedback(f);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [me?.isAdmin]);

  if (loading || !me) {
    return <div className="p-6 text-sm text-on-surface-variant">Loading…</div>;
  }
  if (!me.isAdmin) {
    return (
      <div className="p-6 text-sm text-on-surface-variant">
        Admin access required.{" "}
        <Link href="/" className="underline">
          Back to chat
        </Link>
      </div>
    );
  }

  const likes = feedback.filter((f) => f.rating === 5).length;
  const dislikes = feedback.filter((f) => f.rating === 1).length;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-on-surface">Admin</h1>
          <Link href="/" className="text-sm text-on-surface-variant hover:text-on-surface">
            ← Back to chat
          </Link>
        </div>

        {error && (
          <div className="rounded-card bg-error-container px-4 py-3 text-sm text-brand-error">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Users" value={users.length} />
          <Stat label="Homes" value={homes.length} />
          <Stat label="Likes (recent)" value={likes} />
          <Stat label="Dislikes (recent)" value={dislikes} />
        </div>

        <section className="flex flex-col gap-3 rounded-card bg-surface-container-lowest shadow-card p-5">
          <h2 className="text-sm font-semibold text-on-surface">Homes</h2>
          {homes.length === 0 ? (
            <div className="text-xs text-on-surface-variant">No homes.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="py-1 font-normal">Name</th>
                  <th className="py-1 font-normal">Members</th>
                  <th className="py-1 font-normal">Created</th>
                </tr>
              </thead>
              <tbody>
                {homes.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 text-on-surface">{h.name}</td>
                    <td className="py-2 text-on-surface">{h.memberCount}</td>
                    <td className="py-2 text-xs text-on-surface-variant">
                      {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-card bg-surface-container-lowest shadow-card p-5">
          <h2 className="text-sm font-semibold text-on-surface">Users</h2>
          {users.length === 0 ? (
            <div className="text-xs text-on-surface-variant">No users.</div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="rounded-full bg-surface-container px-3 py-0.5 text-xs text-on-surface"
                >
                  {u.name || u.id}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-card bg-surface-container-lowest shadow-card p-5">
          <h2 className="text-sm font-semibold text-on-surface">Recent feedback</h2>
          {feedback.length === 0 ? (
            <div className="text-xs text-on-surface-variant">No feedback yet.</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {feedback.map((f) => (
                <li key={f.id} className="flex items-center gap-2 py-1 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      f.rating === 5 ? "bg-primary" : "bg-brand-error"
                    }`}
                  />
                  <span className="flex-1 truncate text-on-surface">{f.recipeName}</span>
                  <span className="truncate text-xs text-on-surface-variant">
                    {f.userName ?? "—"} · {f.homeName ?? "—"}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-surface-container-lowest shadow-card p-4">
      <div className="text-xs text-on-surface-variant">{label}</div>
      <div className="text-xl font-semibold text-on-surface">{value}</div>
    </div>
  );
}
