"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, StructuredRecipe } from "@/lib/types";
import { editMessage, getHistory, streamMessage } from "@/lib/api";
import { useAppSettings } from "@/lib/app-context";
import { useAuth } from "@/components/auth/AuthProvider";
import ChatWindow from "@/components/chat/ChatWindow";
import AddToMealPlanDialog from "@/components/chat/AddToMealPlanDialog";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ChatPage() {
  const settings = useAppSettings();
  const { homeId, sessionId, updateStats, stats } = settings;
  const { me } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addToPlan, setAddToPlan] = useState<StructuredRecipe | null>(null);

  useEffect(() => {
    if (!sessionId || !homeId) return;
    let cancelled = false;
    getHistory(sessionId, homeId)
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
  }, [sessionId, homeId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!me) {
        setError("Signing you in… one moment.");
        return;
      }
      if (!homeId) {
        setError("Select a home in the sidebar first.");
        return;
      }
      setError(null);
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      const assistantId = newId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      try {
        for await (const event of streamMessage({ homeId, sessionId, message: text })) {
          if (event.type === "chunk") {
            setIsStreaming(true);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.content } : m,
              ),
            );
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === userMsg.id) return { ...m, checkpointId: event.checkpointId };
                if (m.id === assistantId)
                  return {
                    ...m,
                    checkpointId: event.checkpointId,
                    modelUsed: event.modelUsed,
                    tokensUsed: event.tokensUsed,
                    recipe: event.recipe,
                  };
                return m;
              }),
            );
            updateStats({
              messageCount: stats.messageCount + 2,
              totalTokens: stats.totalTokens + (event.tokensUsed ?? 0),
            });
          } else if (event.type === "error") {
            setError(event.message);
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [me, homeId, sessionId, stats, updateStats],
  );

  const handleEdit = useCallback(
    async (checkpointId: string, newText: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await editMessage({
          checkpointId,
          newMessage: newText,
          homeId,
          sessionId,
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
              recipe: res.recipe,
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
    [homeId, sessionId],
  );

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="bg-error-container px-4 py-2 text-sm text-brand-error">
          {error}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSend={handleSend}
          onEdit={handleEdit}
          onAddToMealPlan={(recipe) => setAddToPlan(recipe)}
        />
      </div>
      {addToPlan !== null && (
        <AddToMealPlanDialog
          recipe={addToPlan}
          sessionId={sessionId}
          onClose={() => setAddToPlan(null)}
          onSaved={() => setAddToPlan(null)}
        />
      )}
    </div>
  );
}
