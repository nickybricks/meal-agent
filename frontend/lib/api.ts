/**
 * api.ts — Typed HTTP client for the FastAPI backend.
 *
 * Base URL read from NEXT_PUBLIC_API_URL env var (defaults to http://localhost:8000).
 * All functions throw an Error with the response body text on non-2xx status.
 */

import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  EditRequest,
  FeedbackRequest,
  ModelInfo,
  SessionSummary,
  UserProfile,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function toSnakeChatRequest(req: ChatRequest) {
  return {
    user_id: req.userId,
    session_id: req.sessionId,
    message: req.message,
    model: req.model,
    temperature: req.temperature,
    top_p: req.topP,
    max_tokens: req.maxTokens,
    enabled_tools: req.enabledTools,
    personality: req.personality,
  };
}

function toSnakeEditRequest(req: EditRequest) {
  return {
    checkpoint_id: req.checkpointId,
    new_message: req.newMessage,
    user_id: req.userId,
    session_id: req.sessionId,
    model: req.model,
    temperature: req.temperature,
  };
}

function toSnakeFeedback(req: FeedbackRequest) {
  return {
    user_id: req.userId,
    recipe_name: req.recipeName,
    rating: req.rating,
    ingredients: req.ingredients ?? [],
    cuisine: req.cuisine,
    model_used: req.modelUsed,
  };
}

type ChatResponseSnake = {
  reply: string;
  checkpoint_id: string;
  tokens_used?: number | null;
  model_used: string;
};

function fromSnakeChatResponse(res: ChatResponseSnake): ChatResponse {
  return {
    reply: res.reply,
    checkpointId: res.checkpoint_id,
    tokensUsed: res.tokens_used ?? undefined,
    modelUsed: res.model_used,
  };
}

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  const raw = await jsonRequest<ChatResponseSnake>("/chat", {
    method: "POST",
    body: JSON.stringify(toSnakeChatRequest(req)),
  });
  return fromSnakeChatResponse(raw);
}

export async function editMessage(req: EditRequest): Promise<ChatResponse> {
  const raw = await jsonRequest<ChatResponseSnake>("/edit", {
    method: "POST",
    body: JSON.stringify(toSnakeEditRequest(req)),
  });
  return fromSnakeChatResponse(raw);
}

export async function sendFeedback(req: FeedbackRequest): Promise<void> {
  await jsonRequest<{ status: string }>("/feedback", {
    method: "POST",
    body: JSON.stringify(toSnakeFeedback(req)),
  });
}

type UserProfileSnake = {
  id: string;
  name: string;
  diet: string[];
  disliked_ingredients: string[];
  favorite_cuisines: string[];
};

export async function getUser(userId: string): Promise<UserProfile> {
  const raw = await jsonRequest<UserProfileSnake>(
    `/users/${encodeURIComponent(userId)}`,
  );
  return {
    id: raw.id,
    name: raw.name,
    diet: raw.diet,
    dislikedIngredients: raw.disliked_ingredients,
    favoriteCuisines: raw.favorite_cuisines,
  };
}

type HistoryMessageSnake = {
  id: string;
  role: "user" | "assistant";
  content: string;
  checkpoint_id?: string | null;
  model_used?: string | null;
  tokens_used?: number | null;
  created_at: string;
};

type HistoryResponseSnake = {
  session_id: string;
  messages: HistoryMessageSnake[];
};

export async function getHistory(sessionId: string): Promise<ChatMessage[]> {
  const raw = await jsonRequest<HistoryResponseSnake>(
    `/history/${encodeURIComponent(sessionId)}`,
  );
  return raw.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    checkpointId: m.checkpoint_id ?? undefined,
    modelUsed: m.model_used ?? undefined,
    tokensUsed: m.tokens_used ?? undefined,
    createdAt: m.created_at,
  }));
}

type ModelListSnake = {
  models: Array<{
    id: string;
    display: string;
    provider: "openai" | "anthropic" | "google" | "ollama";
  }>;
};

export async function getModels(): Promise<ModelInfo[]> {
  const raw = await jsonRequest<ModelListSnake>("/models");
  return raw.models;
}

export async function getHealth(): Promise<{ status: string }> {
  return jsonRequest<{ status: string }>("/health");
}

type SessionListSnake = {
  sessions: Array<{ session_id: string; title: string; last_at: string }>;
};

export async function listSessions(userId: string): Promise<SessionSummary[]> {
  const raw = await jsonRequest<SessionListSnake>(
    `/sessions/${encodeURIComponent(userId)}`,
  );
  return raw.sessions.map((s) => ({
    sessionId: s.session_id,
    title: s.title,
    lastAt: s.last_at,
  }));
}

type UserListSnake = { users: Array<{ id: string; name: string }> };

export async function listUsers(): Promise<Array<{ id: string; name: string }>> {
  const raw = await jsonRequest<UserListSnake>("/users");
  return raw.users;
}

export { BASE_URL };
