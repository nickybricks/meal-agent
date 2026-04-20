/**
 * ChatWindow.tsx — Scrollable message list + input bar container.
 *
 * Props:
 *   messages: ChatMessage[]
 *   isLoading: boolean
 *   onSend: (text: string) => void
 *   onFeedback: (checkpointId: string, rating: 1 | 5) => void
 *   onEdit: (checkpointId: string, newText: string) => void
 *
 * Renders:
 * - A scrollable list of <ChatMessage> components
 * - A typing indicator when isLoading is true
 * - <ChatInput> pinned to the bottom
 *
 * Auto-scrolls to the bottom whenever messages changes.
 */

// TODO: implement in Phase 3
export default function ChatWindow() {
  return null;
}
