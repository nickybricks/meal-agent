"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage as ChatMessageType, StructuredRecipe } from "@/lib/types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import EditPrompt from "./EditPrompt";

interface Props {
  messages: ChatMessageType[];
  isLoading: boolean;
  isStreaming?: boolean;
  onSend: (text: string) => void;
  onEdit: (checkpointId: string, newText: string) => void;
  onAddToMealPlan?: (recipe: StructuredRecipe) => void;
}

export default function ChatWindow({
  messages,
  isLoading,
  isStreaming,
  onSend,
  onEdit,
  onAddToMealPlan,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading, isStreaming]);

  const editingMessage =
    editingId !== null
      ? messages.find((m) => m.checkpointId === editingId)
      : null;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">
            Start by telling me what ingredients you have or what you&apos;re craving.
          </div>
        )}
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {messages.map((m) => {
            if (
              editingMessage &&
              m.checkpointId === editingMessage.checkpointId &&
              m.role === "user"
            ) {
              return (
                <EditPrompt
                  key={m.id}
                  originalText={m.content}
                  checkpointId={m.checkpointId!}
                  onConfirm={(cid, txt) => {
                    setEditingId(null);
                    onEdit(cid, txt);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }
            return (
              <ChatMessage
                key={m.id}
                message={m}
                onEdit={(cid) => setEditingId(cid)}
                onAddToMealPlan={onAddToMealPlan}
              />
            );
          })}
          {isLoading && !isStreaming && (
            <div className="flex justify-start">
              <div className="rounded-card bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
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
