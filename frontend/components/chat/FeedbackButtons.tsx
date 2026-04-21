/**
 * FeedbackButtons.tsx — Thumbs up / thumbs down row shown below assistant messages.
 */

"use client";

import { useState } from "react";

interface Props {
  checkpointId: string;
  onFeedback: (checkpointId: string, rating: 1 | 5) => void;
}

export default function FeedbackButtons({ checkpointId, onFeedback }: Props) {
  const [submitted, setSubmitted] = useState<1 | 5 | null>(null);

  const handle = (rating: 1 | 5) => {
    if (submitted !== null) return;
    setSubmitted(rating);
    onFeedback(checkpointId, rating);
  };

  const base =
    "rounded px-2 py-1 text-xs transition disabled:opacity-60";
  const up =
    submitted === 5
      ? "bg-green-100 text-green-800"
      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700";
  const down =
    submitted === 1
      ? "bg-red-100 text-red-800"
      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700";

  return (
    <div className="mt-1 flex gap-1">
      <button
        type="button"
        className={`${base} ${up}`}
        onClick={() => handle(5)}
        disabled={submitted !== null}
        aria-label="Like"
      >
        thumbs up
      </button>
      <button
        type="button"
        className={`${base} ${down}`}
        onClick={() => handle(1)}
        disabled={submitted !== null}
        aria-label="Dislike"
      >
        thumbs down
      </button>
    </div>
  );
}
