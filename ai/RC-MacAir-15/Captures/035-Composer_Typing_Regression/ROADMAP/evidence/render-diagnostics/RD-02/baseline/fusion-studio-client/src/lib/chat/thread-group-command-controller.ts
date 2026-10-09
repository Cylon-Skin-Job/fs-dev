/** Exact group/session intents. Server `thread:action:completed` remains the mutation authority. */
import { usePanelStore } from '../../state/panelStore';
import { selectionForThread } from '../../state/slices/chatSurfaceSlice';
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
  const socket = state.ws;
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

export function openGroup(address: GroupAddress, viewId: string): boolean {
  const state = usePanelStore.getState();
  if (!sendAtWorkspace(address.workspaceId, threadOpenRequest(address.threadGroupId, address.threadId))) return false;
  state.requestThreadOpen({ ...address, viewId });
  return true;
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
  if (!sendAtWorkspace(address.workspaceId, request)) return false;
  state.beginHarnessSelection(address.threadId, {
    modelId: model,
    variant: variant ?? null,
    requestId: request.requestId,
  });
  return true;
}
