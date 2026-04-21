/**
 * ChatInput.tsx — Message composition bar at the bottom of ChatWindow.
 */

"use client";

import { useRef, useState, KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const maxHeight = 5 * 24;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className="flex items-end gap-2 border-t border-neutral-200 bg-white p-3">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="What should we cook today?"
        rows={1}
        className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm leading-6 focus:border-neutral-400 focus:outline-none"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:bg-neutral-400"
      >
        {disabled ? "…" : "Send"}
      </button>
    </div>
  );
}
