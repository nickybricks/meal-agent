/**
 * offline-queue.ts — Client-side queue for requests that failed due to
 * network loss. Currently only /chat POSTs are queued (see api.ts).
 * OfflineBanner drains the queue when connectivity returns.
 */

"use client";

import { STORAGE_KEYS, readJSON, writeJSON } from "./storage";

export interface PendingRequest {
  endpoint: string;
  body: unknown;
  timestamp: number;
}

const CHANGE_EVENT = "recipe_agent:offline-queue-changed";

function emitChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function listPending(): PendingRequest[] {
  return readJSON<PendingRequest[]>(STORAGE_KEYS.pendingRequests, []);
}

export function enqueuePending(req: PendingRequest): void {
  const items = listPending();
  items.push(req);
  writeJSON(STORAGE_KEYS.pendingRequests, items);
  emitChange();
}

export function shiftPending(): PendingRequest | undefined {
  const items = listPending();
  const head = items.shift();
  writeJSON(STORAGE_KEYS.pendingRequests, items);
  emitChange();
  return head;
}

export function unshiftPending(req: PendingRequest): void {
  const items = listPending();
  items.unshift(req);
  writeJSON(STORAGE_KEYS.pendingRequests, items);
  emitChange();
}

export function clearPending(): void {
  writeJSON<PendingRequest[]>(STORAGE_KEYS.pendingRequests, []);
  emitChange();
}

export function onQueueChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}
