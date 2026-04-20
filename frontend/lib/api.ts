/**
 * api.ts — Typed HTTP client for the FastAPI backend.
 *
 * Base URL read from NEXT_PUBLIC_API_URL env var (defaults to http://localhost:8000).
 *
 * Functions to implement:
 *
 * sendMessage(req: ChatRequest): Promise<ChatResponse>
 *   POST /chat
 *
 * editMessage(req: EditRequest): Promise<ChatResponse>
 *   POST /edit
 *
 * sendFeedback(req: FeedbackRequest): Promise<void>
 *   POST /feedback
 *
 * getUser(userId: string): Promise<UserProfile>
 *   GET /users/{userId}
 *
 * getHistory(sessionId: string): Promise<ChatMessage[]>
 *   GET /history/{sessionId}
 *
 * getModels(): Promise<ModelInfo[]>
 *   GET /models — returns cloud + detected Ollama models
 *
 * All functions throw an Error with the response body text on non-2xx status.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// TODO: implement functions in Phase 3

export { BASE_URL };
