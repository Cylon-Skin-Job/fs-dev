/**
 * @module worksurface/worksurfaceRequests
 * @role Capture stamping and registered get/put emission for the
 *       group-worksurface controller (CHAT-03 / SPEC-03 §6–§7, Slice 03D
 *       mechanical extraction from `worksurfaceController.ts`).
 *
 * Serialized per `{workspaceId, viewId}`: while a request is in flight only the
 * intent is queued (re-frozen later against the owning group), so a capture
 * taken under the outgoing group can never be stored under the incoming key.
 */

import { usePanelStore } from '../../state/panelStore';
import { worksurfaceKey } from '../../state/slices/worksurfaceSlice';
import type { PendingWorksurfaceCapture, WorksurfaceFlushReason } from '../../state/slices/worksurfaceSlice';
import type { JsonValue, WorksurfaceAdapter } from './types';
import { failRequest, armTimeout } from './worksurfaceFailures';
import {
  deferredByView,
  inFlightByView,
  getInFlightByView,
  nextCaptureSequence,
  nextRequestId,
  socketSend,
  tracked,
  type TrackedRequest,
} from './worksurfaceRuntime';

export function captureFor(adapter: WorksurfaceAdapter): JsonValue {
  return adapter.capture();
}

/** Stamp the newest capture so an older failure can never clobber it. */
export function stampPendingCapture(
  workspaceId: string,
  viewId: string,
  adapter: WorksurfaceAdapter,
  content: JsonValue,
  expectedContentRevision: string | null,
  reason: WorksurfaceFlushReason,
): PendingWorksurfaceCapture {
  const capture: PendingWorksurfaceCapture = {
    adapterId: adapter.adapterId,
    adapterVersion: adapter.adapterVersion,
    expectedContentRevision,
    content,
    seq: nextCaptureSequence(),
    reason,
  };
  usePanelStore.getState().setWorksurfacePendingCapture(workspaceId, viewId, capture);
  return capture;
}

/**
 * Persist one frozen capture to a bound group. Serialized per view so a
 * concurrent change cannot race the in-flight CAS.
 */
export function sendContentRequest(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
  adapter: WorksurfaceAdapter,
  content: JsonValue,
  expectedContentRevision: string | null,
  kind: 'switch' | 'switch-flush' | 'persist' | 'flush',
  toGroupId: string | undefined,
  reason: WorksurfaceFlushReason,
  captureSeq: number | undefined,
): void {
  const key = worksurfaceKey(workspaceId, viewId);
  if (inFlightByView.has(key)) {
    // Serialize per view. Only the intent is queued; the capture is re-frozen
    // when the deferred action executes, against whatever group owns the write
    // at that moment. A pending switch wins over a coalesced persist.
    if (kind === 'switch' && toGroupId) {
      deferredByView.set(key, { type: 'switch', toGroupId });
    } else if (!deferredByView.has(key)) {
      deferredByView.set(key, { type: 'persist' });
    }
    return;
  }
  const requestId = nextRequestId(kind);
  const request: TrackedRequest = {
    requestId,
    kind,
    workspaceId,
    viewId,
    threadGroupId,
    adapterId: adapter.adapterId,
    adapterVersion: adapter.adapterVersion,
    content,
    expectedContentRevision,
    toGroupId,
    reason,
    captureSeq,
    timer: null,
  };
  tracked.set(requestId, request);
  inFlightByView.set(key, requestId);
  armTimeout(request);
  const sent = socketSend({
    type: 'state:worksurface_put',
    viewId,
    threadGroupId,
    requestId,
    expectedContentRevision,
    adapterId: adapter.adapterId,
    adapterVersion: adapter.adapterVersion,
    content,
  });
  if (!sent) failRequest(requestId, 'worksurface_unavailable');
}

export function sendGetRequest(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
): void {
  const key = worksurfaceKey(workspaceId, viewId);
  if (getInFlightByView.has(key)) return;
  const requestId = nextRequestId('get');
  const request: TrackedRequest = {
    requestId,
    kind: 'get',
    workspaceId,
    viewId,
    threadGroupId,
    timer: null,
  };
  tracked.set(requestId, request);
  getInFlightByView.add(key);
  armTimeout(request);
  const sent = socketSend({
    type: 'state:worksurface_get',
    viewId,
    threadGroupId,
    requestId,
  });
  if (!sent) failRequest(requestId, 'worksurface_unavailable');
}

/**
 * SPEC-04 §7 close disposition. Records a durable `closed` disposition for one
 * managed Side Chat placement through the accepted `state:worksurface_placement`
 * lane. It carries the stable `sideChatPlacementId` and the expected placement
 * revision (CAS); a stale revision is a non-destructive conflict, never a
 * silent overwrite. It never deletes the member session/transcript/Provenance.
 */
export function sendPlacementCloseRequest(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
  placementId: string,
  expectedPlacementRevision: string | null,
): void {
  const requestId = nextRequestId('placement-close');
  const request: TrackedRequest = {
    requestId,
    kind: 'placement',
    workspaceId,
    viewId,
    threadGroupId,
    timer: null,
  };
  tracked.set(requestId, request);
  armTimeout(request);
  const sent = socketSend({
    type: 'state:worksurface_placement',
    viewId,
    threadGroupId,
    requestId,
    placementId,
    expectedPlacementRevision,
    operation: 'close',
  });
  if (!sent) failRequest(requestId, 'worksurface_unavailable');
}
