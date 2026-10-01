/** Exact group/session intents. Server `thread:action:completed` remains the mutation authority. */
import { usePanelStore } from '../../state/panelStore';
import { selectionForThread } from '../../state/slices/chatSurfaceSlice';
import { sendChatProduct } from '../ws/product-send';
import {
  threadActionCopyLink,
  threadActionDelete,
  threadActionMoveChatToSide,
  threadActionOpenMemberInSide,
  threadActionRename,
  threadActionSetHarnessSelection,
  threadActionViewMarkdown,
  threadMembersRequest,
  threadOpenRequest,
} from '../ws/threadGroupRows';

export interface GroupAddress {
  workspaceId: string;
  threadGroupId: string;
  threadId: string;
}

function sendAtWorkspace(workspaceId: string, message: object): boolean {
  const state = usePanelStore.getState();
  if (!workspaceId || state.activeWorkspaceId !== workspaceId) return false;
  const result = sendChatProduct(message as Record<string, unknown>,
    { workspaceId, policy: 'socket_only', expectedSocket: state.ws });
  return result.status !== 'not_enqueued';
}

export function openGroup(address: GroupAddress, viewId: string): boolean {
  const state = usePanelStore.getState();
  const alreadyPending = state.pendingThreadOpens.some((pending) => pending.workspaceId === address.workspaceId
    && pending.viewId === viewId && pending.threadGroupId === address.threadGroupId
    && pending.threadId === address.threadId);
  state.requestThreadOpen({ ...address, viewId });
  const possibleSend = sendAtWorkspace(address.workspaceId,
    threadOpenRequest(address.threadGroupId, address.threadId));
  if (!possibleSend && !alreadyPending) usePanelStore.getState().consumeThreadOpen(
    { workspaceId: address.workspaceId, viewId },
    { threadGroupId: address.threadGroupId, threadId: address.threadId });
  return possibleSend;
}

export function requestGroupMembers(address: GroupAddress): boolean {
  return Boolean(address.threadGroupId)
    && sendAtWorkspace(address.workspaceId, threadMembersRequest(address.threadGroupId));
}

export function renameGroup(address: GroupAddress, name: string): boolean {
  const trimmed = name.trim();
  return Boolean(address.threadId && trimmed)
    && sendAtWorkspace(address.workspaceId, threadActionRename({ ...address, name: trimmed }));
}

export function deleteGroup(address: GroupAddress): boolean {
  return Boolean(address.threadId)
    && sendAtWorkspace(address.workspaceId, threadActionDelete(address));
}

export function copyGroupLink(address: GroupAddress): boolean {
  return Boolean(address.threadId)
    && sendAtWorkspace(address.workspaceId, threadActionCopyLink(address));
}

export function viewGroupMarkdown(address: GroupAddress): boolean {
  return Boolean(address.threadId)
    && sendAtWorkspace(address.workspaceId, threadActionViewMarkdown(address));
}

export function openGroupMember(address: GroupAddress, memberThreadId: string): boolean {
  return Boolean(address.threadGroupId && memberThreadId)
    && sendAtWorkspace(address.workspaceId, threadActionOpenMemberInSide({
      threadGroupId: address.threadGroupId,
      threadId: memberThreadId,
    }));
}

export function copyGroupMemberLink(address: GroupAddress, memberThreadId: string): boolean {
  return Boolean(address.threadGroupId && memberThreadId)
    && sendAtWorkspace(address.workspaceId, threadActionCopyLink({
      threadGroupId: address.threadGroupId,
      threadId: memberThreadId,
    }));
}

export function moveGroupToSide(address: GroupAddress, expectedPrimarySequence: number): boolean {
  if (!address.threadGroupId || !address.threadId || !Number.isInteger(expectedPrimarySequence)) return false;
  return sendAtWorkspace(address.workspaceId, threadActionMoveChatToSide({
    ...address,
    expectedPrimarySequence,
  }));
}

export function selectGroupModel(
  address: GroupAddress,
  patch: { modelId?: string | null; variant?: string | null },
): boolean {
  if (!address.threadId) return false;
  const state = usePanelStore.getState();
  const current = selectionForThread(state, address.threadId).acknowledged;
  const model = patch.modelId !== undefined ? patch.modelId : current.model;
  if (!model) return false;
  const variant = patch.variant !== undefined ? patch.variant : current.variant;
  const request = threadActionSetHarnessSelection({
    threadGroupId: address.threadGroupId,
    threadId: address.threadId,
    model,
    variant: variant ?? null,
  });
  const priorPending = selectionForThread(state, address.threadId).pending;
  state.beginHarnessSelection(address.threadId, {
    modelId: model,
    variant: variant ?? null,
    requestId: request.requestId,
  });
  const possibleSend = sendAtWorkspace(address.workspaceId, request);
  if (!possibleSend) {
    const current = selectionForThread(usePanelStore.getState(), address.threadId);
    if (current.pending?.requestId === request.requestId) {
      usePanelStore.getState().rejectHarnessSelection(address.threadId, request.requestId);
      if (priorPending) usePanelStore.getState().beginHarnessSelection(address.threadId, priorPending);
    }
  }
  return possibleSend;
}
