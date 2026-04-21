/**
 * EditPrompt.tsx — Inline edit form that replaces a user message bubble.
 */

"use client";

import { useState } from "react";

interface Props {
  originalText: string;
  checkpointId: string;
  onConfirm: (checkpointId: string, newText: string) => void;
  onCancel: () => void;
}

export default function EditPrompt({
  originalText,
  checkpointId,
  onConfirm,
  onCancel,
}: Props) {
  const [text, setText] = useState(originalText);

  return (
    <div className="flex max-w-[80%] flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full resize-y rounded border border-amber-300 bg-white p-2 text-sm focus:border-amber-500 focus:outline-none"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            const trimmed = text.trim();
            if (trimmed) onConfirm(checkpointId, trimmed);
          }}
          className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700"
        >
          Rerun
        </button>
      </div>
    </div>
  );
}
