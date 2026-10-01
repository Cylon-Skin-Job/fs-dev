/**
 * @module worksurface/worksurfaceSwitch
 * @role Acknowledgement-gated group selection, content-writer cutover, flush,
 *       and deferred-intent execution (CHAT-03 / SPEC-03 §5–§6.1, Slice 03D
 *       mechanical extraction from `worksurfaceController.ts`).
 *
 * The ordered transition is exactly SPEC-03 §6.1: freeze the outgoing capture,
 * submit it with the last acknowledged revision, keep the outgoing group
 * selected until correlated success, then bind/select the incoming group and
 * request its exact entry. A queued intent is executed only when no unresolved
 * conflict is holding the outgoing surface.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  getWorksurfaceBinding,
  getWorksurfaceConflict,
  worksurfaceKey,
} from '../../state/slices/worksurfaceSlice';
import type { WorksurfaceFlushReason } from '../../state/slices/worksurfaceSlice';
import { getThreadGroupPopulation } from '../../state/slices/chatSurfaceSlice';
import { threadOpenRequest } from '../ws/threadGroupRows';
import { sendChatProduct } from '../ws/product-send';
import { worksurfaceAdapterForView } from './registry';
import {
  captureFor,
  sendContentRequest,
  sendGetRequest,
  stampPendingCapture,
} from './worksurfaceRequests';
import { deferredByView } from './worksurfaceRuntime';

/** Select the exact group in one population and open its Main Chat. */
export function selectViewGroup(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
): void {
  const store = usePanelStore.getState();
  store.setCurrentThreadGroupId(workspaceId, viewId, threadGroupId);
  const row = getThreadGroupPopulation(store, workspaceId, viewId)
    .find((candidate) => candidate.threadGroupId === threadGroupId);
  if (row) {
    const alreadyPending = store.pendingThreadOpens.some((pending) => pending.workspaceId === workspaceId
      && pending.viewId === viewId && pending.threadGroupId === threadGroupId
      && pending.threadId === row.threadId);
    store.requestThreadOpen({
      workspaceId,
      viewId,
      threadId: row.threadId,
      threadGroupId,
    });
    const outcome = sendChatProduct(threadOpenRequest(threadGroupId, row.threadId),
      { workspaceId, policy: 'socket_only', expectedSocket: store.ws });
    if (outcome.status === 'not_enqueued' && !alreadyPending) usePanelStore.getState().consumeThreadOpen(
      { workspaceId, viewId }, { threadId: row.threadId, threadGroupId });
  }
}

/** Bind a view to a group with its last acknowledged revisions (or null). */
export function bindViewWorksurface(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
  adapterId: string,
  adapterVersion: number,
  contentRevision: string | null,
  placementRevision: string | null,
): void {
  usePanelStore.getState().setWorksurfaceBinding({
    workspaceId,
    viewId,
    threadGroupId,
    adapterId,
    adapterVersion,
    contentRevision,
    placementRevision,
  });
}

/** Bind + select the incoming group and request its exact entry (post-ack). */
export function completeSwitchToGroup(
  workspaceId: string,
  viewId: string,
  toGroupId: string,
): void {
  const store = usePanelStore.getState();
  const binding = getWorksurfaceBinding(store, workspaceId, viewId);
  // The `viewId` fallback is valid only because every registered built-in
  // adapter's `adapterId` equals its view id (registry.ts `adapterId`/`viewId`).
  bindViewWorksurface(
    workspaceId, viewId, toGroupId,
    binding?.adapterId ?? viewId, binding?.adapterVersion ?? 1,
    null, null,
  );
  selectViewGroup(workspaceId, viewId, toGroupId);
  sendGetRequest(workspaceId, viewId, toGroupId);
}

/**
 * Request selection of `toGroupId` for one view. Returns true when the
 * worksurface controller owns the transition (a registered adapter exists);
 * false lets callers keep the established selection behavior unchanged.
 */
export function requestGroupSelection(
  workspaceId: string,
  viewId: string,
  toGroupId: string,
): boolean {
  const adapter = worksurfaceAdapterForView(viewId);
  if (!adapter) return false;
  const store = usePanelStore.getState();
  const binding = getWorksurfaceBinding(store, workspaceId, viewId);

  if (!binding) {
    // First selection: bind, select immediately, then restore a stored entry
    // if one exists; otherwise the current/default content is preserved.
    bindViewWorksurface(
      workspaceId, viewId, toGroupId,
      adapter.adapterId, adapter.adapterVersion, null, null,
    );
    selectViewGroup(workspaceId, viewId, toGroupId);
    sendGetRequest(workspaceId, viewId, toGroupId);
    return true;
  }
  if (binding.threadGroupId === toGroupId) return true;

  // An unresolved conflict holds the outgoing surface: selecting another group
  // only updates the warned-discard target; it never bypasses the gate.
  const conflict = getWorksurfaceConflict(store, workspaceId, viewId);
  if (conflict) {
    if (conflict.toGroupId !== toGroupId) {
      store.setWorksurfaceConflict(workspaceId, viewId, { ...conflict, toGroupId });
    }
    return true;
  }

  const content = captureFor(adapter);
  const capture = stampPendingCapture(
    workspaceId, viewId, adapter, content, binding.contentRevision, 'switch',
  );
  sendContentRequest(
    workspaceId, viewId, binding.threadGroupId,
    adapter, content, binding.contentRevision, 'switch', toGroupId,
    'switch', capture.seq,
  );
  return true;
}

/**
 * Called after a view's in-memory content changed. Returns true when the
 * group content lane owns the write (the global writer must be skipped).
 */
export function onViewContentChanged(viewId: string): boolean {
  const store = usePanelStore.getState();
  const workspaceId = store.activeWorkspaceId;
  if (!workspaceId) return false;
  const binding = getWorksurfaceBinding(store, workspaceId, viewId);
  if (!binding) return false;
  const adapter = worksurfaceAdapterForView(binding.adapterId);
  if (!adapter) return false;

  const content = captureFor(adapter);
  const capture = stampPendingCapture(
    workspaceId, viewId, adapter, content, binding.contentRevision, 'persist',
  );
  sendContentRequest(
    workspaceId, viewId, binding.threadGroupId,
    adapter, content, binding.contentRevision, 'persist', undefined,
    'persist', capture.seq,
  );
  return true;
}

/**
 * Flush the outgoing bound key through the acknowledgement gate before a view
 * switch, panel close, workspace detach, or orderly teardown (SPEC-03 §6.1).
 * Returns true when a bound adapter owned the flush. A queued intent while a
 * request is in flight is re-frozen against the owning group at execution.
 */
export function flushBoundView(
  workspaceId: string | null,
  viewId: string,
  reason: WorksurfaceFlushReason,
): boolean {
  if (!workspaceId) return false;
  const store = usePanelStore.getState();
  const binding = getWorksurfaceBinding(store, workspaceId, viewId);
  if (!binding) return false;
  const adapter = worksurfaceAdapterForView(binding.adapterId);
  if (!adapter) return false;
  const content = captureFor(adapter);
  const capture = stampPendingCapture(
    workspaceId, viewId, adapter, content, binding.contentRevision, reason,
  );
  sendContentRequest(
    workspaceId, viewId, binding.threadGroupId,
    adapter, content, binding.contentRevision, 'flush', undefined,
    reason, capture.seq,
  );
  return true;
}

/**
 * Flush every bound view belonging to a workspace before a workspace
 * switch/detach/teardown. Returns the number of flushed views.
 */
export function flushBoundWorkspaceViews(
  workspaceId: string | null,
  reason: WorksurfaceFlushReason,
): number {
  if (!workspaceId) return 0;
  const state = usePanelStore.getState();
  let flushed = 0;
  for (const binding of Object.values(state.worksurfaceBindings)) {
    if (binding.workspaceId !== workspaceId) continue;
    if (flushBoundView(workspaceId, binding.viewId, reason)) flushed += 1;
  }
  return flushed;
}

/**
 * Execute the newest deferred action. The capture is re-frozen here against the
 * binding that owns the write now, so a queued intent can never carry an
 * outgoing group's bytes into the incoming group's lane. A queued switch is
 * never run past an unresolved conflict (the warned-discard gate).
 */
export function runDeferredAction(workspaceId: string, viewId: string): void {
  const key = worksurfaceKey(workspaceId, viewId);
  const deferred = deferredByView.get(key);
  if (!deferred) return;
  const store = usePanelStore.getState();
  if (getWorksurfaceConflict(store, workspaceId, viewId)) return;
  deferredByView.delete(key);
  const binding = getWorksurfaceBinding(store, workspaceId, viewId);
  if (!binding) return;
  const adapter = worksurfaceAdapterForView(viewId);
  if (!adapter) return;
  const content = adapter.capture();
  if (deferred.type === 'switch') {
    const capture = stampPendingCapture(
      workspaceId, viewId, adapter, content, binding.contentRevision, 'switch',
    );
    sendContentRequest(
      workspaceId, viewId, binding.threadGroupId,
      adapter, content, binding.contentRevision, 'switch', deferred.toGroupId,
      'switch', capture.seq,
    );
  } else {
    const capture = stampPendingCapture(
      workspaceId, viewId, adapter, content, binding.contentRevision, 'persist',
    );
    sendContentRequest(
      workspaceId, viewId, binding.threadGroupId,
      adapter, content, binding.contentRevision, 'persist', undefined,
      'persist', capture.seq,
    );
  }
}

/**
 * Finish a switch once the outgoing key is fully acknowledged: bind the
 * incoming key provisionally (its revision is unknown until the exact GET),
 * select/open it, and request the exact entry. A queued persist is dropped
 * because the outgoing capture was already flushed under the outgoing key; the
 * incoming entry is created only by a real content change, not by the switch.
 * A queued re-switch (a newer group selection) is executed instead.
 */
export function completeSwitch(
  workspaceId: string,
  viewId: string,
  toGroupId: string,
): void {
  const store = usePanelStore.getState();
  store.clearWorksurfacePendingCapture(workspaceId, viewId);
  store.clearWorksurfaceConflict(workspaceId, viewId);
  completeSwitchToGroup(workspaceId, viewId, toGroupId);
  const key = worksurfaceKey(workspaceId, viewId);
  const queued = deferredByView.get(key);
  if (queued?.type === 'switch') {
    runDeferredAction(workspaceId, viewId);
  } else if (queued) {
    deferredByView.delete(key);
  }
}
