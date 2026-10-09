/**
 * @module worksurface/worksurfaceFailures
 * @role Conflict classification and failure retention for the group-worksurface
 *       controller (CHAT-03 / SPEC-03 §6.2, Slice 03D mechanical extraction from
 *       `worksurfaceController.ts`).
 *
 * A failed switch/flush/persist retains the exact capture as a non-destructive
 * conflict; a failed read records a classified warning. Behavior is unchanged
 * from the accepted 03B controller.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  getWorksurfacePendingCapture,
} from '../../state/slices/worksurfaceSlice';
import type {
  PendingWorksurfaceCapture,
  WorksurfaceConflict,
  WorksurfaceConflictKind,
  WorksurfaceFlushReason,
} from '../../state/slices/worksurfaceSlice';
import type { ThreadWorksurfaceEntry } from './types';
import {
  currentRequestTimeoutMs,
  releaseRequest,
  tracked,
  type TrackedRequest,
} from './worksurfaceRuntime';

export function classifyConflictKind(code: string): WorksurfaceConflictKind {
  if (code === 'revision_conflict') return 'revision_conflict';
  if (code === 'timeout') return 'timeout';
  if (code === 'worksurface_unavailable'
    || code === 'workspace_unavailable'
    || code === 'view_registry_unavailable') {
    return 'worksurface_unavailable';
  }
  return 'rejected';
}

export function captureMatchesEntry(
  pending: PendingWorksurfaceCapture,
  entry: ThreadWorksurfaceEntry | null,
): boolean {
  if (!entry) return false;
  if (entry.adapterId !== pending.adapterId) return false;
  if (entry.adapterVersion !== pending.adapterVersion) return false;
  try {
    return JSON.stringify(entry.content) === JSON.stringify(pending.content);
  } catch {
    return false;
  }
}

export function buildConflict(
  request: TrackedRequest,
  code: string,
  extras: {
    entry?: ThreadWorksurfaceEntry | null;
    contentRevision?: string | null;
    placementRevision?: string | null;
  },
  store: ReturnType<typeof usePanelStore.getState>,
): WorksurfaceConflict {
  const pending = getWorksurfacePendingCapture(store, request.workspaceId, request.viewId);
  const serverEntry = extras.entry ?? null;
  const reason: WorksurfaceFlushReason = request.reason
    ?? (request.toGroupId ? 'switch' : 'persist');
  return {
    kind: classifyConflictKind(code),
    code,
    threadGroupId: request.threadGroupId,
    toGroupId: request.toGroupId ?? null,
    reason,
    serverEntry,
    serverContentRevision: extras.contentRevision ?? null,
    serverPlacementRevision: extras.placementRevision ?? null,
    lossRisk: pending !== null && !captureMatchesEntry(pending, serverEntry),
  };
}

/**
 * Retain the failed write's capture as a non-destructive conflict. A newer
 * capture already stamped while the request was in flight is never clobbered by
 * the older failed request's bytes (03A advisory F2).
 */
export function failRequest(
  requestId: string,
  code: string,
  extras: {
    entry?: ThreadWorksurfaceEntry | null;
    contentRevision?: string | null;
    placementRevision?: string | null;
  } = {},
): void {
  const request = releaseRequest(requestId);
  if (!request) return;
  const store = usePanelStore.getState();
  if (request.kind === 'get') {
    store.pushWorksurfaceWarning(code);
    return;
  }
  // SPEC-04 §7: a failed close disposition is a classified, non-destructive
  // warning. It never fabricates a content pending-capture/conflict because it
  // carries no adapter content and must not block the owning view's content.
  if (request.kind === 'placement') {
    store.pushWorksurfaceWarning(code);
    return;
  }
  const existing = getWorksurfacePendingCapture(store, request.workspaceId, request.viewId);
  if (!existing && request.adapterId && request.content !== undefined) {
    store.setWorksurfacePendingCapture(request.workspaceId, request.viewId, {
      adapterId: request.adapterId,
      adapterVersion: request.adapterVersion ?? 1,
      expectedContentRevision: request.expectedContentRevision ?? null,
      content: request.content,
      seq: request.captureSeq,
      reason: request.reason,
    });
  }
  store.pushWorksurfaceWarning(code);
  store.setWorksurfaceConflict(
    request.workspaceId,
    request.viewId,
    buildConflict(request, code, extras, store),
  );
  // The outgoing surface remains selected; nothing is silently discarded.
}

export function armTimeout(request: TrackedRequest): void {
  request.timer = setTimeout(() => {
    failRequest(request.requestId, 'timeout');
  }, currentRequestTimeoutMs());
}

/** True while a tracked request owns this id (used by the result/error lanes). */
export function trackedRequest(requestId: string): TrackedRequest | null {
  return tracked.get(requestId) ?? null;
}
