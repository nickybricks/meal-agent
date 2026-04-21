/**
 * UserSelector.tsx — Dropdown to switch between user profiles.
 */

"use client";

interface Props {
  users: { id: string; name: string }[];
  selectedUserId: string;
  onChange: (userId: string) => void;
}

export default function UserSelector({ users, selectedUserId, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      User
      <select
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        value={selectedUserId}
        onChange={(e) => onChange(e.target.value)}
      >
        {users.length === 0 && <option value="">No users</option>}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.id}
          </option>
        ))}
      </select>
    </label>
  );
}
