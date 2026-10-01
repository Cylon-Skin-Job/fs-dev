/** Reconcile workspace-qualified view state and mutation watermarks. */
import { usePanelStore } from '../../state/panelStore';
import { getWorksurfaceBinding } from '../../state/slices/worksurfaceSlice';
import { boundViewContentKeys } from '../worksurface/worksurfaceController';
import { getLatestViewStateMutationId, getViewStateMutationOrigin, hasPendingViewStateMutation, settleViewStateMutation } from '../viewStateMutationTracker';
import { shouldApplyWorkspaceResponse } from '../workspaceResponseTracker';
import type { ViewUIState, WebSocketMessage } from '../../types';

interface StateResultMessage extends WebSocketMessage {
  type: 'state:result';
  view?: string;
  state?: ViewUIState;
  clientMutationId?: number;
  requestId?: string;
  workspaceId?: string | null;
}

interface StateErrorMessage extends WebSocketMessage {
  type: 'state:error';
  message?: string;
  view?: string;
  clientMutationId?: number;
  requestId?: string;
  workspaceId?: string | null;
}

export function handleViewStateMessage(msg: WebSocketMessage): boolean {
  // SPEC-26c-2 / STATE_OVERRIDE_SPEC: view UI state responses.
  if (msg.type === 'state:result') {
    const store = usePanelStore.getState();
    const stateMsg = msg as StateResultMessage;
    const view = stateMsg.view;
    const incoming = stateMsg.state;
    if (!view || !incoming) return true;
    const clientMutationId = typeof stateMsg.clientMutationId === 'number'
      ? stateMsg.clientMutationId
      : null;
    if (
      clientMutationId === null
      && !shouldApplyWorkspaceResponse(
        'state:get',
        stateMsg.requestId,
        stateMsg.workspaceId,
        store.activeWorkspaceId,
        {
          view,
          mutationWatermark: getLatestViewStateMutationId(view, store.activeWorkspaceId),
        },
      )
    ) {
      return true;
    }
    const mutationOrigin = clientMutationId === null
      ? null
      : getViewStateMutationOrigin(clientMutationId);
    if (clientMutationId !== null && !mutationOrigin) return true;
    if (clientMutationId !== null && mutationOrigin
      && (mutationOrigin.workspaceId !== store.activeWorkspaceId || mutationOrigin.view !== view)) {
      settleViewStateMutation(clientMutationId);
      return true;
    }
    const workspaceId = mutationOrigin?.workspaceId ?? store.activeWorkspaceId;
    const latestMutationId = getLatestViewStateMutationId(view, workspaceId);
    if (clientMutationId !== null && clientMutationId < latestMutationId) {
      settleViewStateMutation(clientMutationId);
      return true;
    }

    const current = store.viewStates[view];
    const hasPendingMutation = current && hasPendingViewStateMutation(view, workspaceId);
    // state:set responses contain a full server state. When multiple patches
    // are in flight, a later echo can be based on an older disk snapshot, so
    // keep the optimistic local state until the pending mutation settles.
    const stateToApply = hasPendingMutation ? { ...incoming, ...current } : { ...incoming };
    // CHAT-03 / SPEC-03 §5: while a view is bound to a Thread Group, the global
    // `activity` document is not the content owner. A global state response may
    // update non-content facts (widths, collapse, tints) but must never hydrate
    // over the selected group's authoritative content.
    if (getWorksurfaceBinding(store, workspaceId, view) && current) {
      stateToApply.activity = current.activity;
      // The document viewers also elect top-level ViewUIState keys; pin them so
      // a global echo can never hydrate over the selected group's content.
      const contentKeys = boundViewContentKeys(view);
      if (contentKeys) {
        const apply = stateToApply as unknown as Record<string, unknown>;
        const live = current as unknown as Record<string, unknown>;
        for (const key of contentKeys) apply[key] = live[key];
      }
    }
    store.setViewState(view, stateToApply);
    // VIEW-02 §9: a persisted state document landed for this view — the
    // connected adapters' initial-policy gate may open.
    store.settleViewStateLoad(view);
    if (clientMutationId !== null) {
      settleViewStateMutation(clientMutationId);
    }
    // STATE_OVERRIDE_SPEC §9.3: hydrate persisted currentThreadId into the
    // live slot when loading the active view. Guarded equality check in
    // setCurrentThreadId prevents a persist-echo loop.
    if (
      view === store.currentPanel &&
      incoming?.currentThreadId &&
      incoming.currentThreadId !== store.currentThreadId
    ) {
      store.setCurrentThreadId(incoming.currentThreadId);
    }
    return true;
  }
  if (msg.type === 'state:error') {
    const stateMsg = msg as StateErrorMessage;
    if (
      typeof stateMsg.clientMutationId !== 'number'
      && !shouldApplyWorkspaceResponse(
        'state:get',
        stateMsg.requestId,
        stateMsg.workspaceId,
        usePanelStore.getState().activeWorkspaceId,
        stateMsg.view ? {
          view: stateMsg.view,
          mutationWatermark: getLatestViewStateMutationId(
            stateMsg.view,
            usePanelStore.getState().activeWorkspaceId,
          ),
        } : undefined,
      )
    ) {
      return true;
    }
    if (stateMsg.view && typeof stateMsg.clientMutationId === 'number') {
      const mutationOrigin = getViewStateMutationOrigin(stateMsg.clientMutationId);
      if (
        mutationOrigin
        && (mutationOrigin.workspaceId !== usePanelStore.getState().activeWorkspaceId
          || mutationOrigin.view !== stateMsg.view)
      ) {
        settleViewStateMutation(stateMsg.clientMutationId);
        return true;
      }
      settleViewStateMutation(stateMsg.clientMutationId);
    }
    // VIEW-02 §9: the state read settled (with an error) — release the
    // connected adapters' initial-policy gate for this view.
    if (typeof stateMsg.view === 'string') {
      usePanelStore.getState().settleViewStateLoad(stateMsg.view);
    }
    console.error('[state] error:', stateMsg.message);
    return true;
  }

  return false;
}
