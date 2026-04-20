/**
 * page.tsx — Main chat page (route: /).
 *
 * Layout:
 *   <Sidebar> on the left (user selector, model selector, personality toggle, stats)
 *   <ChatWindow> on the right (message list + input bar)
 *
 * State managed here (or via context):
 * - messages: ChatMessage[]    — full conversation for the current session
 * - sessionId: string          — UUID created on first load, persisted in localStorage
 * - isLoading: boolean         — true while awaiting backend response
 *
 * Key interactions:
 * - User submits a message -> POST /chat -> append assistant reply to messages
 * - User clicks thumbs up/down on a message -> POST /feedback
 * - User clicks edit icon on a message -> show EditPrompt inline ->
 *   POST /edit -> replace messages from that point onward
 */

export default function ChatPage() {
  // TODO: implement in Phase 3
  return <main>Recipe Agent — coming soon</main>;
}
