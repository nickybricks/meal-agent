/**
 * types.ts — Shared TypeScript types used across the frontend.
 *
 * Mirrors the Pydantic schemas in backend/schemas.py.
 */

export interface RecipeIngredient {
  item: string;
  amount: string;
  unit: string;
}

export interface StructuredRecipe {
  name: string;
  description: string;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  cuisine: string;
  tags: string[];
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export interface SavedRecipe extends StructuredRecipe {
  id: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  checkpointId?: string;
  modelUsed?: string;
  tokensUsed?: number;
  recipe?: StructuredRecipe;
  createdAt: string;
}

export interface ChatRequest {
  homeId: string;
  sessionId: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
  checkpointId: string;
  tokensUsed?: number;
  modelUsed: string;
  recipe?: StructuredRecipe;
}

export type ChatStreamEvent =
  | { type: "chunk"; content: string }
  | { type: "done"; checkpointId: string; modelUsed: string; tokensUsed?: number; recipe?: StructuredRecipe }
  | { type: "error"; message: string };

export interface EditRequest {
  checkpointId: string;
  newMessage: string;
  homeId: string;
  sessionId: string;
}

export interface FeedbackRequest {
  homeId: string;
  recipeName: string;
  rating: 1 | 5;
  ingredients?: string[];
  cuisine?: string;
  modelUsed?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  diet: string[];
  dislikedIngredients: string[];
  favoriteCuisines: string[];
  likedIngredients: string[];
  allergies: string[];
  cookingSkillLevel?: string;
  adventurousness?: number;
  measurementSystem?: "metric" | "imperial";
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

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface MealPlanEntry {
  id: string;
  planDate: string; // yyyy-mm-dd
  slot: MealSlot;
  recipeName: string;
  recipeContent: string;
  createdAt: string;
}

export type Personality = "friendly" | "professional" | "concise";

export interface SessionSummary {
  sessionId: string;
  title: string;
  lastAt: string;
}

export interface Home {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  createdAt?: string;
}

export interface Member {
  userId: string;
  name: string;
  email?: string;
  role: "owner" | "admin" | "member";
  joinedAt?: string;
}

export interface Invitation {
  id: string;
  token: string;
  homeId: string;
  homeName?: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: string;
  createdAt: string;
  inviterName?: string;
}
