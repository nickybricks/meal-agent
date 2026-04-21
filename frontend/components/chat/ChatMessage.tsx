/**
 * ChatMessage.tsx — Renders a single chat bubble.
 */

"use client";

import type { ChatMessage as ChatMessageType } from "@/lib/types";
import FeedbackButtons from "./FeedbackButtons";

interface Props {
  message: ChatMessageType;
  onFeedback?: (checkpointId: string, rating: 1 | 5) => void;
  onEdit?: (checkpointId: string) => void;
}

export default function ChatMessage({ message, onFeedback, onEdit }: Props) {
  const isUser = message.role === "user";
  const bubble = isUser
    ? "bg-neutral-900 text-white"
    : "bg-neutral-100 text-neutral-900";
  const align = isUser ? "justify-end" : "justify-start";

  return (
    <div className={`group flex ${align}`}>
      <div className="flex max-w-[80%] flex-col">
        <div className={`relative rounded-lg px-3 py-2 text-sm ${bubble}`}>
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
          {isUser && message.checkpointId && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message.checkpointId!)}
              className="absolute -top-2 -left-2 hidden rounded bg-white px-1 text-[10px] text-neutral-700 shadow group-hover:block"
              aria-label="Edit"
            >
              edit
            </button>
          )}
        </div>
        {!isUser && (message.modelUsed || message.tokensUsed) && (
          <div className="mt-0.5 text-[10px] text-neutral-400">
            {message.modelUsed}
            {message.tokensUsed ? ` · ${message.tokensUsed} tok` : ""}
          </div>
        )}
        {!isUser && message.checkpointId && onFeedback && (
          <FeedbackButtons
            checkpointId={message.checkpointId}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}
