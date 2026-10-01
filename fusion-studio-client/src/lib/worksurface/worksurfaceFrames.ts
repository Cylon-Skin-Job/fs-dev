/**
 * @module worksurface/worksurfaceFrames
 * @role Registered frame handling, retry/discard, and reconnect reconciliation
 *       for the group-worksurface controller (CHAT-03 / SPEC-03 §6.2/§9,
 *       Slice 03D mechanical extraction from `worksurfaceController.ts`).
 *
 * Every in-flight request is correlated by `requestId` and addressed by the
 * exact durable `{workspaceId, viewId, threadGroupId}` tuple. A late read/write
 * acknowledgement can never overwrite the selected group or another key; a
 * broadcast is never treated as a write ack.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  getWorksurfaceBinding,
  getWorksurfaceConflict,
  getWorksurfacePendingCapture,
  worksurfaceEntryKey,
  worksurfaceKey,
} from '../../state/slices/worksurfaceSlice';
import type { WorksurfaceFlushReason } from '../../state/slices/worksurfaceSlice';
import { worksurfaceAdapterForView } from './registry';
import { failRequest } from './worksurfaceFailures';
import {
  sendContentRequest,
  sendGetRequest,
  sendPlacementCloseRequest,
  stampPendingCapture,
} from './worksurfaceRequests';
import {
  completeSwitch,
  completeSwitchToGroup,
  runDeferredAction,
} from './worksurfaceSwitch';
import type {
  WorksurfaceChangedFrame,
  WorksurfaceErrorFrame,
  WorksurfaceResultFrame,
} from './types';
import {
  deferredByView,
  getInFlightByView,
  inFlightByView,
  reconnectRetryByView,
  releaseRequest,
  tracked,
  type TrackedRequest,
} from './worksurfaceRuntime';

function applyResultRevision(
  request: TrackedRequest,
  frame: WorksurfaceResultFrame,
): void {
  const store = usePanelStore.getState();
  const groupId = frame.threadGroupId ?? request.threadGroupId;
  if (frame.entry !== undefined) {
    store.setWorksurfaceEntry(request.workspaceId, request.viewId, groupId, frame.entry ?? null);
  }
  store.updateWorksurfaceBinding(request.workspaceId, request.viewId, {
    contentRevision: frame.contentRevision ?? null,
    placementRevision: frame.placementRevision ?? null,
  });
}

/** Handle one `state:worksurface_result` frame. Returns true if consumed. */
export function handleWorksurfaceResultFrame(frame: WorksurfaceResultFrame): boolean {
  const requestId = frame.requestId;
  if (typeof requestId !== 'string') return false;
  const request = tracked.get(requestId);
  if (!request) return false;
  releaseRequest(requestId);
  const store = usePanelStore.getState();

  if (frame.lane === 'placement') {
    // SPEC-03 has no placement producer; still record the lane revision.
    if (frame.entry !== undefined) {
      store.setWorksurfaceEntry(request.workspaceId, request.viewId, frame.threadGroupId, frame.entry ?? null);
    }
    store.updateWorksurfaceBinding(request.workspaceId, request.viewId, {
      contentRevision: frame.contentRevision ?? null,
      placementRevision: frame.placementRevision ?? null,
    });
    return true;
  }

  if (request.kind === 'get') {
    const entry = frame.entry ?? null;
    // The entry cache is keyed by its own group, so a late read may still cache
    // its exact entry. But it may only mutate the live render state or the
    // binding revisions when the view still names this exact group — a late
    // read acknowledgement can never overwrite the selected group or another
    // key (SPEC-03 §9).
    store.setWorksurfaceEntry(request.workspaceId, request.viewId, request.threadGroupId, entry);
    const liveBinding = getWorksurfaceBinding(store, request.workspaceId, request.viewId);
    const stale = !liveBinding || liveBinding.threadGroupId !== request.threadGroupId;
    if (stale) return true;
    const adapter = worksurfaceAdapterForView(request.viewId);
    if (entry && adapter) {
      store.updateWorksurfaceBinding(request.workspaceId, request.viewId, {
        contentRevision: entry.contentRevision,
        placementRevision: entry.placementRevision,
      });
      if (entry.adapterId !== adapter.adapterId) {
        // Unsupported adapter identity: inert, keep current/default.
        store.pushWorksurfaceWarning('unsupported_adapter');
      } else {
        // Validate against the STORED version before any renderer mutation.
        const sanitized = adapter.sanitize(entry.content, entry.schemaVersion);
        if (!sanitized.ok || sanitized.content === null) {
          store.pushWorksurfaceWarning(sanitized.warning ?? 'invalid_content');
        } else {
          void adapter.restore(sanitized.content).then((result) => {
            if (result.warning) store.pushWorksurfaceWarning(result.warning);
          }).catch(() => store.pushWorksurfaceWarning('restore_failed'));
        }
      }
    }
    // No entry: preserve the view's established current/default content.
    // Reconnect: acknowledged server truth is hydrated first; the retained
    // pending capture is then reapplied through the CAS gate.
    const key = worksurfaceKey(request.workspaceId, request.viewId);
    if (reconnectRetryByView.has(key)) {
      reconnectRetryByView.delete(key);
      setTimeout(() => {
        retryPendingWorksurfaceCapture(request.workspaceId, request.viewId);
      }, 0);
    }
    return true;
  }

  // Content PUT (switch, outgoing flush, explicit flush, or persist).
  applyResultRevision(request, frame);
  store.clearWorksurfaceConflict(request.workspaceId, request.viewId);

  if ((request.kind === 'switch' || request.kind === 'switch-flush') && request.toGroupId) {
    // Every outgoing flush re-checks the live capture at ack time — not only
    // the first switch PUT. If content changed while THIS flush was in flight,
    // the outgoing group still owns it: retain the newest capture and send
    // another flush under the outgoing key with the acknowledged revision. The
    // switch completes only when the acknowledged flush captured the live
    // content, so no change made while bound to the outgoing group can be
    // discarded, and none of its bytes can land under the incoming key.
    const adapter = worksurfaceAdapterForView(request.viewId);
    if (adapter && request.content !== undefined) {
      const live = adapter.capture();
      const changed = JSON.stringify(live) !== JSON.stringify(request.content);
      if (changed) {
        const capture = stampPendingCapture(
          request.workspaceId, request.viewId, adapter, live,
          frame.contentRevision ?? null, 'switch',
        );
        sendContentRequest(
          request.workspaceId, request.viewId, request.threadGroupId,
          adapter, live, frame.contentRevision ?? null, 'switch-flush',
          request.toGroupId, 'switch', capture.seq,
        );
        return true;
      }
    }
    completeSwitch(request.workspaceId, request.viewId, request.toGroupId);
    return true;
  }

  // Explicit flush / persist acknowledged: the outgoing key is saved.
  store.clearWorksurfacePendingCapture(request.workspaceId, request.viewId);
  runDeferredAction(request.workspaceId, request.viewId);
  return true;
}

/**
 * SPEC-04 §6/§7: request the exact acknowledged `{workspaceId, viewId,
 * threadGroupId}` entry so the managed Side Chat placement lane materializes
 * through the accepted read path. Never reconstructs placement from history;
 * an absent placement simply leaves no Side Chat tab.
 */
export function requestWorksurfaceEntryRead(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
): void {
  if (!workspaceId || !viewId || !threadGroupId) return;
  sendGetRequest(workspaceId, viewId, threadGroupId);
}

/**
 * SPEC-04 §7: record a durable `closed` disposition for one managed Side Chat
 * placement through the accepted `state:worksurface_placement` lane. Closing
 * removes only the placement; the member session/transcript/Provenance/
 * membership are never touched and no harness session is warmed/created.
 */
export function closeSideChatPlacement(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
  placementId: string,
  expectedPlacementRevision: string | null,
): void {
  if (!workspaceId || !viewId || !threadGroupId || !placementId) return;
  sendPlacementCloseRequest(
    workspaceId,
    viewId,
    threadGroupId,
    placementId,
    expectedPlacementRevision,
  );
}

/** Handle one `state:worksurface_error` frame. Returns true if consumed. */
export function handleWorksurfaceErrorFrame(frame: WorksurfaceErrorFrame): boolean {
  const requestId = frame.requestId;
  if (typeof requestId !== 'string') return false;
  const request = tracked.get(requestId);
  if (!request) return false;
  const store = usePanelStore.getState();
  // Cache the stale lane entry but NEVER adopt the server's current revision as
  // the live CAS base: keeping the stale base makes a later change conflict and
  // surface instead of silently overwriting newer remote state.
  if (request.kind !== 'get' && frame.entry !== undefined) {
    store.setWorksurfaceEntry(request.workspaceId, request.viewId, request.threadGroupId, frame.entry ?? null);
  }
  failRequest(requestId, frame.code ?? 'worksurface_failed', {
    entry: frame.entry ?? null,
    contentRevision: frame.contentRevision ?? null,
    placementRevision: frame.placementRevision ?? null,
  });
  return true;
}

/**
 * Handle one `state:worksurface_changed` fan-out frame. Returns true if
 * consumed. A broadcast carries durable identities and lane revisions only; it
 * is never a write acknowledgement and never replaces pending local state.
 */
export function handleWorksurfaceChangedFrame(frame: WorksurfaceChangedFrame): boolean {
  if (!frame.workspaceId || !frame.viewId || !frame.threadGroupId) return false;
  const store = usePanelStore.getState();
  store.setWorksurfaceRemoteRevision(
    frame.workspaceId,
    frame.viewId,
    frame.threadGroupId,
    {
      contentRevision: frame.contentRevision ?? null,
      placementRevision: frame.placementRevision ?? null,
    },
  );

  const key = worksurfaceKey(frame.workspaceId, frame.viewId);
  const binding = getWorksurfaceBinding(store, frame.workspaceId, frame.viewId);
  const pending = getWorksurfacePendingCapture(store, frame.workspaceId, frame.viewId);
  const isBoundGroup = binding?.threadGroupId === frame.threadGroupId;
  // Dirty: a pending capture or an in-flight write owns this entry. Record the
  // newer remote revision but never hydrate over the dirty local state.
  const dirty = isBoundGroup && (pending !== null || inFlightByView.has(key));
  if (dirty || !isBoundGroup) return true;
  // Clean cached bound entry: re-read acknowledged server truth when the
  // broadcast names content OR placement revision we have not acknowledged
  // locally. A placement-only change (same contentRevision, newer
  // placementRevision) is exactly how a retried SPEC-04 delivery / restart
  // sweep surfaces a Side Chat tab, so it must trigger the same exact read.
  if (!binding) return true;
  if (inFlightByView.has(key) || getInFlightByView.has(key)) return true;
  const contentChanged = frame.contentRevision !== null
    && frame.contentRevision !== binding.contentRevision;
  const placementChanged = frame.placementRevision !== null
    && frame.placementRevision !== binding.placementRevision;
  if (!contentChanged && !placementChanged) return true;
  const cached = store.worksurfaceEntries?.[
    worksurfaceEntryKey(frame.workspaceId, frame.viewId, frame.threadGroupId)
  ];
  if (cached
    && (frame.contentRevision === null || cached.contentRevision === frame.contentRevision)
    && (cached.placementRevision ?? null) === (frame.placementRevision ?? null)) {
    return true;
  }
  sendGetRequest(frame.workspaceId, frame.viewId, frame.threadGroupId);
  return true;
}

/**
 * Retry/reconcile the retained pending capture (SPEC-03 §6.1/§6.2). Reconciles
 * the CAS base to the server's returned current revision/entry before resending
 * the exact pending capture — including the identical-capture ack path, where
 * the server acknowledges the current revision without a new write.
 */
export function retryPendingWorksurfaceCapture(workspaceId: string, viewId: string): boolean {
  const store = usePanelStore.getState();
  const binding = getWorksurfaceBinding(store, workspaceId, viewId);
  const pending = getWorksurfacePendingCapture(store, workspaceId, viewId);
  if (!binding || !pending) return false;
  if (inFlightByView.has(worksurfaceKey(workspaceId, viewId))) return false;
  const adapter = worksurfaceAdapterForView(binding.adapterId) ?? worksurfaceAdapterForView(viewId);
  if (!adapter) return false;

  const conflict = getWorksurfaceConflict(store, workspaceId, viewId);
  let expected = binding.contentRevision;
  if (conflict && conflict.serverContentRevision) {
    expected = conflict.serverContentRevision;
    store.updateWorksurfaceBinding(workspaceId, viewId, {
      contentRevision: conflict.serverContentRevision,
      ...(conflict.serverPlacementRevision !== null
        ? { placementRevision: conflict.serverPlacementRevision }
        : {}),
    });
  }
  const toGroupId = conflict?.toGroupId ?? null;
  const reason: WorksurfaceFlushReason = pending.reason ?? conflict?.reason ?? 'persist';
  store.clearWorksurfaceConflict(workspaceId, viewId);
  sendContentRequest(
    workspaceId, viewId, binding.threadGroupId,
    adapter, pending.content, expected,
    toGroupId ? 'switch' : (reason === 'persist' ? 'persist' : 'flush'),
    toGroupId ?? undefined,
    reason,
    pending.seq,
  );
  return true;
}

/**
 * The explicit warned-discard choice (`Switch without saving` /
 * `Discard unsaved changes`). This is the ONLY path that discards a pending
 * capture; it exists solely to be invoked behind the named loss-risk choice.
 */
export function discardPendingWorksurfaceConflict(
  workspaceId: string,
  viewId: string,
): boolean {
  const store = usePanelStore.getState();
  const conflict = getWorksurfaceConflict(store, workspaceId, viewId);
  if (!conflict) return false;
  store.clearWorksurfacePendingCapture(workspaceId, viewId);
  store.clearWorksurfaceConflict(workspaceId, viewId);
  deferredByView.delete(worksurfaceKey(workspaceId, viewId));
  if (conflict.toGroupId) {
    // Warned switch: complete the transition without saving the outgoing key.
    completeSwitchToGroup(workspaceId, viewId, conflict.toGroupId);
  }
  return true;
}

/**
 * On socket reconnect, re-hydrate acknowledged server truth for every bound
 * view in the active workspace, then reapply (or flag) the exact pending local
 * capture. Never treats a fan-out as a write ack.
 */
export function reconcileWorksurfacesOnReconnect(): void {
  const store = usePanelStore.getState();
  const workspaceId = store.activeWorkspaceId;
  if (!workspaceId) return;
  for (const binding of Object.values(store.worksurfaceBindings)) {
    if (binding.workspaceId !== workspaceId) continue;
    if (!binding.threadGroupId) continue;
    const key = worksurfaceKey(workspaceId, binding.viewId);
    if (inFlightByView.has(key) || getInFlightByView.has(key)) continue;
    const pending = getWorksurfacePendingCapture(store, workspaceId, binding.viewId);
    if (pending) {
      // Hydrate acknowledged server truth first; the retained pending capture is
      // reapplied through the CAS gate when the read settles.
      reconnectRetryByView.add(key);
      sendGetRequest(workspaceId, binding.viewId, binding.threadGroupId);
    } else {
      // A clean binding re-reads acknowledged truth (never pending replacement).
      sendGetRequest(workspaceId, binding.viewId, binding.threadGroupId);
    }
  }
}
