/**
 * ChatWindow.tsx — Scrollable message list + input bar container.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import EditPrompt from "./EditPrompt";

interface Props {
  messages: ChatMessageType[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onFeedback: (checkpointId: string, rating: 1 | 5) => void;
  onEdit: (checkpointId: string, newText: string) => void;
}

export default function ChatWindow({
  messages,
  isLoading,
  onSend,
  onFeedback,
  onEdit,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  const editingMessage =
    editingId !== null
      ? messages.find((m) => m.checkpointId === editingId)
      : null;

  return (
    <div className="flex h-full flex-col bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">
            Start by telling me what ingredients you have or what you&apos;re craving.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m) => {
            if (
              editingMessage &&
              m.checkpointId === editingMessage.checkpointId &&
              m.role === "user"
            ) {
              return (
                <div key={m.id} className="flex justify-end">
                  <EditPrompt
                    originalText={m.content}
                    checkpointId={m.checkpointId!}
                    onConfirm={(cid, txt) => {
                      setEditingId(null);
                      onEdit(cid, txt);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              );
            }
            return (
              <ChatMessage
                key={m.id}
                message={m}
                onFeedback={onFeedback}
                onEdit={(cid) => setEditingId(cid)}
              />
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
                <span className="inline-flex gap-1">
                  <span className="animate-pulse">·</span>
                  <span className="animate-pulse [animation-delay:150ms]">·</span>
                  <span className="animate-pulse [animation-delay:300ms]">·</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      <ChatInput onSend={onSend} disabled={isLoading} />
    </div>
  );
}
