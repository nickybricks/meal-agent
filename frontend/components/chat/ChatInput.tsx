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
    <div className="bg-surface-container-low px-4 py-4">
    <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="What should we cook today?"
        rows={1}
        className="flex-1 resize-none rounded-card bg-surface-container-highest px-4 py-3 text-sm leading-6 text-on-surface placeholder:text-on-surface-variant focus:bg-surface-bright focus:outline-none"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-on-primary disabled:opacity-40"
      >
        {disabled ? "…" : "Send"}
      </button>
    </div>
    </div>
  );
}
