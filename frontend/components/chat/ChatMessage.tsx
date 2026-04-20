/**
 * ChatMessage.tsx — Renders a single chat bubble.
 *
 * Props:
 *   message: ChatMessage
 *   onFeedback?: (checkpointId: string, rating: 1 | 5) => void
 *   onEdit?: (checkpointId: string) => void
 *
 * Behaviour:
 * - User messages align right, assistant messages align left.
 * - Assistant messages show <FeedbackButtons> below the bubble.
 * - User messages show an edit (pencil) icon on hover; clicking it triggers onEdit.
 * - Renders markdown in assistant content (use a lightweight markdown renderer).
 * - Shows model name and token count as faint metadata below assistant bubbles.
 */

// TODO: implement in Phase 3
export default function ChatMessage() {
  return null;
}
