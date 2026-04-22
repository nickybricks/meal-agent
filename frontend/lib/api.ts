/**
 * api.ts — Typed HTTP client for the FastAPI backend.
 *
 * Base URL read from NEXT_PUBLIC_API_URL env var (defaults to http://localhost:8000).
 * Every protected request carries `Authorization: Bearer <supabase access_token>`;
 * the backend derives the caller from the JWT, so request bodies carry only
 * `home_id` (never `user_id`).
 */

import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  EditRequest,
  FeedbackRequest,
  Home,
  Invitation,
  MealPlanEntry,
  MealSlot,
  Member,
  ModelInfo,
  SavedRecipe,
  SessionSummary,
  StructuredRecipe,
  UserProfile,
} from "./types";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { enqueuePending } from "./offline-queue";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthHeader(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...auth,
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
    home_id: req.homeId,
    session_id: req.sessionId,
    message: req.message,
  };
}

function toSnakeEditRequest(req: EditRequest) {
  return {
    checkpoint_id: req.checkpointId,
    new_message: req.newMessage,
    home_id: req.homeId,
    session_id: req.sessionId,
  };
}

function toSnakeFeedback(req: FeedbackRequest) {
  return {
    home_id: req.homeId,
    recipe_name: req.recipeName,
    rating: req.rating,
    ingredients: req.ingredients ?? [],
    cuisine: req.cuisine,
    model_used: req.modelUsed,
  };
}

type StructuredRecipeSnake = {
  name: string;
  description: string;
  servings: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  ingredients: { item: string; amount: string; unit: string }[];
  steps: string[];
  cuisine: string;
  tags: string[];
  calories_kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

function fromSnakeStructuredRecipe(r: StructuredRecipeSnake): StructuredRecipe {
  return {
    name: r.name,
    description: r.description,
    servings: r.servings,
    prepTimeMinutes: r.prep_time_minutes,
    cookTimeMinutes: r.cook_time_minutes,
    ingredients: r.ingredients,
    steps: r.steps,
    cuisine: r.cuisine,
    tags: r.tags,
    caloriesKcal: r.calories_kcal ?? undefined,
    proteinG: r.protein_g ?? undefined,
    carbsG: r.carbs_g ?? undefined,
    fatG: r.fat_g ?? undefined,
  };
}

type ChatResponseSnake = {
  reply: string;
  checkpoint_id: string;
  tokens_used?: number | null;
  model_used: string;
  recipe?: StructuredRecipeSnake | null;
};

function fromSnakeChatResponse(res: ChatResponseSnake): ChatResponse {
  return {
    reply: res.reply,
    checkpointId: res.checkpoint_id,
    tokensUsed: res.tokens_used ?? undefined,
    modelUsed: res.model_used,
    recipe: res.recipe ? fromSnakeStructuredRecipe(res.recipe) : undefined,
  };
}

export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  const body = toSnakeChatRequest(req);
  try {
    const raw = await jsonRequest<ChatResponseSnake>("/chat", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return fromSnakeChatResponse(raw);
  } catch (err) {
    // Only queue when the browser reports no connectivity. A bare TypeError
    // can also come from CORS, malformed responses, etc. — surface those
    // instead of mis-labeling them "offline".
    const isOffline =
      err instanceof TypeError &&
      typeof navigator !== "undefined" &&
      navigator.onLine === false;
    if (isOffline) {
      enqueuePending({ endpoint: "/chat", body, timestamp: Date.now() });
      throw new Error(
        "You appear to be offline. Your message has been queued and will be sent when the connection is restored.",
      );
    }
    throw err;
  }
}

export async function* streamMessage(req: ChatRequest): AsyncGenerator<ChatStreamEvent> {
  const auth = await getAuthHeader();
  const body = toSnakeChatRequest(req);

  const res = await fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const raw = JSON.parse(trimmed) as {
          type: string;
          content?: string;
          checkpoint_id?: string;
          model_used?: string;
          tokens_used?: number | null;
          recipe?: StructuredRecipeSnake | null;
          message?: string;
        };
        if (raw.type === "chunk") {
          yield { type: "chunk", content: raw.content ?? "" };
        } else if (raw.type === "done") {
          yield {
            type: "done",
            checkpointId: raw.checkpoint_id ?? "",
            modelUsed: raw.model_used ?? "",
            tokensUsed: raw.tokens_used ?? undefined,
            recipe: raw.recipe ? fromSnakeStructuredRecipe(raw.recipe) : undefined,
          };
        } else if (raw.type === "error") {
          yield { type: "error", message: raw.message ?? "Unknown error" };
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
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
  liked_ingredients: string[];
  allergies: string[];
  cooking_skill_level?: string | null;
  adventurousness?: number | null;
  measurement_system?: string | null;
};

export async function getUser(userId: string, homeId: string): Promise<UserProfile> {
  const raw = await jsonRequest<UserProfileSnake>(
    `/users/${encodeURIComponent(userId)}?home_id=${encodeURIComponent(homeId)}`,
  );
  return {
    id: raw.id,
    name: raw.name,
    diet: raw.diet,
    dislikedIngredients: raw.disliked_ingredients,
    favoriteCuisines: raw.favorite_cuisines,
    likedIngredients: raw.liked_ingredients ?? [],
    allergies: raw.allergies ?? [],
    cookingSkillLevel: raw.cooking_skill_level ?? undefined,
    adventurousness: raw.adventurousness ?? undefined,
    measurementSystem: (raw.measurement_system as "metric" | "imperial" | null) ?? "metric",
  };
}

export async function updatePreferences(
  homeId: string,
  prefs: Partial<Omit<UserProfile, "id" | "name">>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (prefs.diet !== undefined) body.diet = prefs.diet;
  if (prefs.dislikedIngredients !== undefined) body.disliked_ingredients = prefs.dislikedIngredients;
  if (prefs.favoriteCuisines !== undefined) body.favorite_cuisines = prefs.favoriteCuisines;
  if (prefs.likedIngredients !== undefined) body.liked_ingredients = prefs.likedIngredients;
  if (prefs.allergies !== undefined) body.allergies = prefs.allergies;
  if (prefs.cookingSkillLevel !== undefined) body.cooking_skill_level = prefs.cookingSkillLevel;
  if (prefs.adventurousness !== undefined) body.adventurousness = prefs.adventurousness;
  if (prefs.measurementSystem !== undefined) body.measurement_system = prefs.measurementSystem;
  await jsonRequest<{ status: string }>(
    `/preferences?home_id=${encodeURIComponent(homeId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
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

export async function getHistory(sessionId: string, homeId: string): Promise<ChatMessage[]> {
  const raw = await jsonRequest<HistoryResponseSnake>(
    `/history/${encodeURIComponent(sessionId)}?home_id=${encodeURIComponent(homeId)}`,
  );
  const messages: ChatMessage[] = raw.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    checkpointId: m.checkpoint_id ?? undefined,
    modelUsed: m.model_used ?? undefined,
    tokensUsed: m.tokens_used ?? undefined,
    createdAt: m.created_at,
  }));
  // User messages are saved without a checkpoint_id but the following assistant
  // message has the checkpoint from the same agent run — propagate it back so
  // the edit button works after navigating away and returning to a session.
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (curr.role === "assistant" && curr.checkpointId && prev.role === "user" && !prev.checkpointId) {
      messages[i - 1] = { ...prev, checkpointId: curr.checkpointId };
    }
  }
  return messages;
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

export async function listSessions(userId: string, homeId: string): Promise<SessionSummary[]> {
  const raw = await jsonRequest<SessionListSnake>(
    `/sessions/${encodeURIComponent(userId)}?home_id=${encodeURIComponent(homeId)}`,
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

// ---------------------------------------------------------------------------
// Auth / me
// ---------------------------------------------------------------------------

type MeSnake = {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  is_admin: boolean;
};

export interface Me {
  id: string;
  authId: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export async function getMe(): Promise<Me> {
  const raw = await jsonRequest<MeSnake>("/me");
  return {
    id: raw.id,
    authId: raw.auth_id,
    name: raw.name,
    email: raw.email,
    isAdmin: raw.is_admin,
  };
}

// ---------------------------------------------------------------------------
// Homes
// ---------------------------------------------------------------------------

type HomeSnake = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  created_at?: string | null;
};

function fromSnakeHome(h: HomeSnake): Home {
  return {
    id: h.id,
    name: h.name,
    role: h.role,
    createdAt: h.created_at ?? undefined,
  };
}

export async function createHome(name: string): Promise<Home> {
  const raw = await jsonRequest<HomeSnake>("/homes", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return fromSnakeHome(raw);
}

export async function listHomes(): Promise<Home[]> {
  const raw = await jsonRequest<{ homes: HomeSnake[] }>("/homes");
  return raw.homes.map(fromSnakeHome);
}

type MemberSnake = {
  user_id: string;
  name: string;
  email?: string | null;
  role: "owner" | "admin" | "member";
  joined_at?: string | null;
};

export async function listMembers(homeId: string): Promise<Member[]> {
  const raw = await jsonRequest<{ members: MemberSnake[] }>(
    `/homes/${encodeURIComponent(homeId)}/members`,
  );
  return raw.members.map((m) => ({
    userId: m.user_id,
    name: m.name,
    email: m.email ?? undefined,
    role: m.role,
    joinedAt: m.joined_at ?? undefined,
  }));
}

export async function removeMember(homeId: string, userId: string): Promise<void> {
  await jsonRequest<{ status: string }>(
    `/homes/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

type InvitationSnake = {
  id: string;
  token: string;
  home_id: string;
  home_name?: string | null;
  email: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  created_at: string;
  inviter_name?: string | null;
};

function fromSnakeInvitation(i: InvitationSnake): Invitation {
  return {
    id: i.id,
    token: i.token,
    homeId: i.home_id,
    homeName: i.home_name ?? undefined,
    email: i.email,
    role: i.role,
    status: i.status,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
    inviterName: i.inviter_name ?? undefined,
  };
}

export async function createInvitation(
  homeId: string,
  email: string,
  role: "owner" | "admin" | "member" = "member",
): Promise<Invitation> {
  const raw = await jsonRequest<InvitationSnake>(
    `/homes/${encodeURIComponent(homeId)}/invite`,
    {
      method: "POST",
      body: JSON.stringify({ email, role }),
    },
  );
  return fromSnakeInvitation(raw);
}

export async function listHomeInvitations(homeId: string): Promise<Invitation[]> {
  const raw = await jsonRequest<{ invitations: InvitationSnake[] }>(
    `/homes/${encodeURIComponent(homeId)}/invitations`,
  );
  return raw.invitations.map(fromSnakeInvitation);
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await jsonRequest<{ status: string }>(
    `/invitations/${encodeURIComponent(invitationId)}`,
    { method: "DELETE" },
  );
}

export async function listMyInvitations(): Promise<Invitation[]> {
  const raw = await jsonRequest<{ invitations: InvitationSnake[] }>("/invitations");
  return raw.invitations.map(fromSnakeInvitation);
}

export async function lookupInvitation(token: string): Promise<Invitation> {
  const raw = await jsonRequest<InvitationSnake>(
    `/invitations/${encodeURIComponent(token)}`,
  );
  return fromSnakeInvitation(raw);
}

export async function acceptInvitation(token: string): Promise<Home> {
  const raw = await jsonRequest<HomeSnake>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    { method: "POST" },
  );
  return fromSnakeHome(raw);
}

export async function declineInvitation(token: string): Promise<void> {
  await jsonRequest<{ status: string }>(
    `/invitations/${encodeURIComponent(token)}/decline`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminHome {
  id: string;
  name: string;
  createdAt?: string;
  memberCount: number;
}

export interface AdminFeedbackRow {
  id: string;
  recipeName: string;
  rating: number;
  cuisine?: string;
  createdAt: string;
  userId?: string;
  userName?: string;
  homeId?: string;
  homeName?: string;
}

type AdminHomeSnake = {
  id: string;
  name: string;
  created_at?: string | null;
  member_count: number;
};

type AdminFeedbackSnake = {
  id: string;
  recipe_name: string;
  rating: number;
  cuisine?: string | null;
  created_at: string;
  user_id?: string | null;
  user_name?: string | null;
  home_id?: string | null;
  home_name?: string | null;
};

export async function listAllHomes(): Promise<AdminHome[]> {
  const raw = await jsonRequest<{ homes: AdminHomeSnake[] }>("/admin/homes");
  return raw.homes.map((h) => ({
    id: h.id,
    name: h.name,
    createdAt: h.created_at ?? undefined,
    memberCount: h.member_count,
  }));
}

// ---------------------------------------------------------------------------
// Meal plan entries
// ---------------------------------------------------------------------------

type MealPlanEntrySnake = {
  id: string;
  plan_date: string;
  slot: MealSlot;
  recipe_name: string;
  recipe_content: string;
  created_at: string;
};

function fromSnakeMealPlanEntry(e: MealPlanEntrySnake): MealPlanEntry {
  return {
    id: e.id,
    planDate: e.plan_date,
    slot: e.slot,
    recipeName: e.recipe_name,
    recipeContent: e.recipe_content,
    createdAt: e.created_at,
  };
}

export class SlotTakenError extends Error {
  existing: MealPlanEntry;
  constructor(existing: MealPlanEntry) {
    super(`Slot already has "${existing.recipeName}"`);
    this.name = "SlotTakenError";
    this.existing = existing;
  }
}

export async function listMealPlanEntries(
  homeId: string,
  startDate: string,
  endDate: string,
): Promise<MealPlanEntry[]> {
  const qs = new URLSearchParams({
    home_id: homeId,
    start: startDate,
    end: endDate,
  }).toString();
  const raw = await jsonRequest<{ entries: MealPlanEntrySnake[] }>(
    `/meal-plan/entries?${qs}`,
  );
  return raw.entries.map(fromSnakeMealPlanEntry);
}

export async function addMealPlanEntry(req: {
  homeId: string;
  planDate: string;
  slot: MealSlot;
  recipeName: string;
  recipeContent: string;
  sourceSessionId?: string;
  overwrite?: boolean;
}): Promise<MealPlanEntry> {
  const auth = await getAuthHeader();
  const body = {
    home_id: req.homeId,
    plan_date: req.planDate,
    slot: req.slot,
    recipe_name: req.recipeName,
    recipe_content: req.recipeContent,
    source_session_id: req.sourceSessionId,
    overwrite: req.overwrite ?? false,
  };
  const res = await fetch(`${BASE_URL}/meal-plan/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    try {
      const payload = await res.json();
      const existing = payload?.detail?.existing as MealPlanEntrySnake | undefined;
      if (existing) {
        throw new SlotTakenError(fromSnakeMealPlanEntry(existing));
      }
    } catch (err) {
      if (err instanceof SlotTakenError) throw err;
      // fall through to generic error below
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  const raw = (await res.json()) as MealPlanEntrySnake;
  return fromSnakeMealPlanEntry(raw);
}

export async function deleteMealPlanEntry(
  homeId: string,
  entryId: string,
): Promise<void> {
  await jsonRequest<{ status: string }>(
    `/meal-plan/entries/${encodeURIComponent(entryId)}?home_id=${encodeURIComponent(homeId)}`,
    { method: "DELETE" },
  );
}

export async function listRecentFeedback(limit = 50): Promise<AdminFeedbackRow[]> {
  const raw = await jsonRequest<{ feedback: AdminFeedbackSnake[] }>(
    `/admin/feedback?limit=${limit}`,
  );
  return raw.feedback.map((f) => ({
    id: f.id,
    recipeName: f.recipe_name,
    rating: f.rating,
    cuisine: f.cuisine ?? undefined,
    createdAt: f.created_at,
    userId: f.user_id ?? undefined,
    userName: f.user_name ?? undefined,
    homeId: f.home_id ?? undefined,
    homeName: f.home_name ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// Saved recipes
// ---------------------------------------------------------------------------

type SavedRecipeSnake = StructuredRecipeSnake & {
  id: string;
  image_url: string | null;
  created_at: string;
};

function fromSnakeSavedRecipe(r: SavedRecipeSnake): SavedRecipe {
  return {
    ...fromSnakeStructuredRecipe(r),
    id: r.id,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

function toSnakeStructuredRecipe(r: StructuredRecipe): StructuredRecipeSnake {
  return {
    name: r.name,
    description: r.description,
    servings: r.servings,
    prep_time_minutes: r.prepTimeMinutes,
    cook_time_minutes: r.cookTimeMinutes,
    ingredients: r.ingredients,
    steps: r.steps,
    cuisine: r.cuisine,
    tags: r.tags,
  };
}

export async function listSavedRecipes(homeId: string): Promise<SavedRecipe[]> {
  const raw = await jsonRequest<SavedRecipeSnake[]>(
    `/recipes?home_id=${encodeURIComponent(homeId)}`,
  );
  return raw.map(fromSnakeSavedRecipe);
}

export async function saveRecipe(homeId: string, recipe: StructuredRecipe): Promise<SavedRecipe> {
  const raw = await jsonRequest<SavedRecipeSnake>(
    `/recipes?home_id=${encodeURIComponent(homeId)}`,
    {
      method: "POST",
      body: JSON.stringify(toSnakeStructuredRecipe(recipe)),
    },
  );
  return fromSnakeSavedRecipe(raw);
}

export async function deleteSavedRecipe(homeId: string, recipeId: string): Promise<void> {
  await jsonRequest<{ status: string }>(
    `/recipes/${encodeURIComponent(recipeId)}?home_id=${encodeURIComponent(homeId)}`,
    { method: "DELETE" },
  );
}

export async function uploadRecipeImage(
  homeId: string,
  recipeId: string,
  file: File,
): Promise<SavedRecipe> {
  const auth = await getAuthHeader();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${BASE_URL}/recipes/${encodeURIComponent(recipeId)}/image?home_id=${encodeURIComponent(homeId)}`,
    { method: "POST", headers: auth, body: form },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return fromSnakeSavedRecipe((await res.json()) as SavedRecipeSnake);
}

export async function deleteRecipeImage(homeId: string, recipeId: string): Promise<void> {
  await jsonRequest<{ status: string }>(
    `/recipes/${encodeURIComponent(recipeId)}/image?home_id=${encodeURIComponent(homeId)}`,
    { method: "DELETE" },
  );
}

export { BASE_URL };
