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
    <div className="w-full flex-col gap-3 rounded-card bg-surface-container-high p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="mb-3 w-full resize-y rounded-[1rem] bg-surface-container-highest p-3 text-sm text-on-surface focus:bg-surface-bright focus:outline-none"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-surface-container px-4 py-1.5 text-xs text-on-surface hover:bg-surface-container-highest"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            const trimmed = text.trim();
            if (trimmed) onConfirm(checkpointId, trimmed);
          }}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-primary"
        >
          Save
        </button>
      </div>
    </div>
  );
}
