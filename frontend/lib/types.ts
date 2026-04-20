/**
 * types.ts — Shared TypeScript types used across the frontend.
 *
 * Mirrors the Pydantic schemas in backend/schemas.py.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  checkpointId?: string;
  modelUsed?: string;
  tokensUsed?: number;
  createdAt: string;
}

export interface ChatRequest {
  userId: string;
  sessionId: string;
  message: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  enabledTools: string[];
  personality: "friendly" | "professional" | "concise";
}

export interface ChatResponse {
  reply: string;
  checkpointId: string;
  tokensUsed?: number;
  modelUsed: string;
}

export interface EditRequest {
  checkpointId: string;
  newMessage: string;
  userId: string;
  sessionId: string;
  model: string;
  temperature: number;
}

export interface FeedbackRequest {
  userId: string;
  recipeName: string;
  rating: 1 | 5;
  ingredients?: string[];
  cuisine?: string;
  modelUsed?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  dietaryRestrictions: string[];
  dislikedIngredients: string[];
  favoriteCuisines: string[];
  personality: "friendly" | "professional" | "concise";
}

export interface ModelInfo {
  id: string;
  display: string;
  provider: "openai" | "anthropic" | "google" | "ollama";
}

export interface MealPlanDay {
  day: string;
  mealName: string;
  thumbnailUrl?: string;
}

export type Personality = "friendly" | "professional" | "concise";
