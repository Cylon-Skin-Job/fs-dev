/**
 * @module worksurface/worksurfaceRuntime
 * @role Shared request-tracking runtime for the group-worksurface controller
 *       (CHAT-03 / SPEC-03 §6, Slice 03D mechanical extraction from
 *       `worksurfaceController.ts`).
 *
 * This module owns the module-level mutable state that used to live inside the
 * controller: correlated in-flight requests, per-view serialization slots,
 * deferred intents, reconnect flags, and the request timeout seam. Splitting it
 * is behavior-identical because every consumer shares this single singleton;
 * only the request lifecycle functions moved to sibling modules.
 */

import { usePanelStore } from '../../state/panelStore';
import { worksurfaceKey } from '../../state/slices/worksurfaceSlice';
import type { WorksurfaceFlushReason } from '../../state/slices/worksurfaceSlice';
import type { JsonValue } from './types';

export const WORKSURFACE_REQUEST_TIMEOUT_MS = 10_000;

export type RequestKind = 'switch' | 'switch-flush' | 'persist' | 'flush' | 'get' | 'placement';

export interface TrackedRequest {
  requestId: string;
  kind: RequestKind;
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  adapterId?: string;
  adapterVersion?: number;
  content?: JsonValue;
  expectedContentRevision?: string | null;
  /** Incoming group for a switch / switch-flush request. */
  toGroupId?: string;
  /** Why the flush was issued (conflict copy + warned-discard gate). */
  reason?: WorksurfaceFlushReason;
  /** Monotonic stamp of the capture this request carried. */
  captureSeq?: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * A queued intent that arrived while a content request was in flight. It stores
 * only the INTENT (never a frozen capture): the capture is re-frozen against the
 * group that owns the write when the deferred action is actually executed, so a
 * capture taken under the outgoing group can never be stored under the incoming
 * group's key.
 */
export type DeferredAction =
  | { type: 'persist' }
  | { type: 'switch'; toGroupId: string };

export const tracked = new Map<string, TrackedRequest>();
/** One in-flight content request per `{workspaceId, viewId}` view. */
export const inFlightByView = new Map<string, string>();
/** One in-flight read per `{workspaceId, viewId}` view (fan-out/reconnect dedupe). */
export const getInFlightByView = new Set<string>();
/** Newest action that arrived while a content request was in flight. */
export const deferredByView = new Map<string, DeferredAction>();
/**
 * Bound views whose pending capture must be reapplied after the reconnect read
 * hydrates acknowledged server truth (SPEC-03 §9).
 */
export const reconnectRetryByView = new Set<string>();

let sequence = 0;
let captureSequence = 0;
let requestTimeoutMs = WORKSURFACE_REQUEST_TIMEOUT_MS;

/** Test seam: shorten/lengthen the per-request timeout. */
export function setWorksurfaceRequestTimeout(ms: number): void {
  requestTimeoutMs = ms;
}

export function currentRequestTimeoutMs(): number {
  return requestTimeoutMs;
}

export function nextRequestId(purpose: string): string {
  return `worksurface-${purpose}-${Date.now().toString(36)}-${(sequence++).toString(36)}`;
}

export function nextCaptureSequence(): number {
  captureSequence += 1;
  return captureSequence;
}

export function socketSend(message: object): boolean {
  const ws = usePanelStore.getState().ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(message));
  return true;
}

export function clearTimer(request: TrackedRequest): void {
  if (request.timer) {
    clearTimeout(request.timer);
    request.timer = null;
  }
}

export function releaseRequest(requestId: string): TrackedRequest | null {
  const request = tracked.get(requestId) ?? null;
  if (!request) return null;
  clearTimer(request);
  tracked.delete(requestId);
  const key = worksurfaceKey(request.workspaceId, request.viewId);
  if (inFlightByView.get(key) === requestId) inFlightByView.delete(key);
  if (request.kind === 'get') getInFlightByView.delete(key);
  return request;
}

/** Test seam: clear all in-flight tracking (does not reset id sequences). */
export function resetWorksurfaceRuntime(): void {
  for (const request of tracked.values()) clearTimer(request);
  tracked.clear();
  inFlightByView.clear();
  getInFlightByView.clear();
  deferredByView.clear();
  reconnectRetryByView.clear();
}
