"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage as ChatMessageType, StructuredRecipe } from "@/lib/types";
import { ChatRecipeCard } from "@/components/recipes/RecipeCard";

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 font-semibold">{children}</h3>,
  h2: ({ children }) => <h2 className="mt-3 mb-1 font-semibold text-base">{children}</h2>,
  ul: ({ children }) => <ul className="mt-1 mb-2 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1 mb-2 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
};

interface Props {
  message: ChatMessageType;
  onEdit?: (checkpointId: string) => void;
  onAddToMealPlan?: (recipe: StructuredRecipe) => void;
}

export default function ChatMessage({
  message,
  onEdit,
  onAddToMealPlan,
}: Props) {
  const isUser = message.role === "user";
  const bubble = isUser
    ? "bg-on-surface text-surface"
    : "bg-surface-container text-on-surface";
  const align = isUser ? "justify-end" : "justify-start";

  return (
    <div className={`group flex ${align}`}>
      <div className="flex max-w-[80%] flex-col">
        <div className={`relative rounded-card px-4 py-3 text-sm leading-relaxed ${bubble}`}>
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <ReactMarkdown components={MD_COMPONENTS}>
              {message.content}
            </ReactMarkdown>
          )}
          {isUser && message.checkpointId && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message.checkpointId!)}
              className="absolute -top-2 -left-2 hidden rounded-full bg-surface-container-lowest px-2 py-0.5 text-[10px] text-on-surface-variant [box-shadow:0_4px_40px_rgba(55,56,48,0.06)] group-hover:block"
              aria-label="Edit"
            >
              edit
            </button>
          )}
        </div>
        {!isUser && (message.modelUsed || message.tokensUsed) && (
          <div className="mt-1 text-[10px] text-on-surface-variant">
            {message.modelUsed}
            {message.tokensUsed ? ` · ${message.tokensUsed} tok` : ""}
          </div>
        )}
        {!isUser && message.recipe && (
          <ChatRecipeCard
            recipe={message.recipe}
            saved
            onAddToMealPlan={
              onAddToMealPlan ? () => onAddToMealPlan(message.recipe!) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
