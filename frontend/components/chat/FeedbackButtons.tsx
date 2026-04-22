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

  const base = "rounded-full px-3 py-1 text-xs transition disabled:opacity-60";
  const up =
    submitted === 5
      ? "bg-primary-container text-on-surface"
      : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant";
  const down =
    submitted === 1
      ? "bg-error-container text-brand-error"
      : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant";

  return (
    <div className="mt-2 flex gap-1.5">
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
