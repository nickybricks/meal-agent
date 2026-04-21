/**
 * page.tsx — Main chat page (route: /).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { editMessage, getHistory, sendFeedback, sendMessage } from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";
import ChatWindow from "@/components/chat/ChatWindow";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatPage() {
  const settings = useAppSettings();
  const { userId, sessionId, model, personality, temperature, topP, maxTokens, enabledTools, updateStats, stats } = settings;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load prior session history once a sessionId is available.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getHistory(sessionId)
      .then((loaded) => {
        if (!cancelled) {
          setMessages(loaded);
          updateStats({ messageCount: loaded.length });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            `Couldn't load chat history: ${e instanceof Error ? e.message : "unknown error"}. ` +
              "Check that Supabase tables exist (run supabase_schema.sql) and the backend is running.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!userId) {
        setError("Select a user in the sidebar first.");
        return;
      }
      setError(null);
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      try {
        const res = await sendMessage({
          userId,
          sessionId,
          message: text,
          model,
          temperature,
          topP,
          maxTokens,
          enabledTools,
          personality,
        });
        const assistantMsg: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: res.reply,
          checkpointId: res.checkpointId,
          modelUsed: res.modelUsed,
          tokensUsed: res.tokensUsed,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => {
          // Attach the checkpointId to the user message too so editing works.
          const withCp = prev.map((m) =>
            m.id === userMsg.id ? { ...m, checkpointId: res.checkpointId } : m,
          );
          return [...withCp, assistantMsg];
        });
        updateStats({
          messageCount: stats.messageCount + 2,
          totalTokens: stats.totalTokens + (res.tokensUsed ?? 0),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setIsLoading(false);
      }
    },
    [userId, sessionId, model, personality, temperature, topP, maxTokens, enabledTools, stats, updateStats],
  );

  const handleFeedback = useCallback(
    async (checkpointId: string, rating: 1 | 5) => {
      const msg = messages.find((m) => m.checkpointId === checkpointId);
      if (!msg) return;
      try {
        await sendFeedback({
          userId,
          recipeName: msg.content.slice(0, 80),
          rating,
          modelUsed: msg.modelUsed,
        });
        updateStats(
          rating === 5
            ? { likeCount: stats.likeCount + 1 }
            : { dislikeCount: stats.dislikeCount + 1 },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Feedback failed");
      }
    },
    [messages, userId, stats, updateStats],
  );

  const handleEdit = useCallback(
    async (checkpointId: string, newText: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await editMessage({
          checkpointId,
          newMessage: newText,
          userId,
          sessionId,
          model,
          temperature,
        });
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.checkpointId === checkpointId && m.role === "user");
          const head = idx >= 0 ? prev.slice(0, idx) : prev;
          return [
            ...head,
            {
              id: newId(),
              role: "user",
              content: newText,
              checkpointId: res.checkpointId,
              createdAt: new Date().toISOString(),
            },
            {
              id: newId(),
              role: "assistant",
              content: res.reply,
              checkpointId: res.checkpointId,
              modelUsed: res.modelUsed,
              tokensUsed: res.tokensUsed,
              createdAt: new Date().toISOString(),
            },
          ];
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Edit failed");
      } finally {
        setIsLoading(false);
      }
    },
    [userId, sessionId, model, temperature],
  );

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onFeedback={handleFeedback}
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
}
