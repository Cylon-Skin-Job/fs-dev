/** Exact mounted-owner validation for the existing Chat action boundary. */
import { useWorkspaceStore } from '../state/workspaceStore';
import { usePanelStore } from '../state/panelStore';
import { mountedChatIsCurrent, type MountedChatBinding } from '../state/slices/mountedChatState';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../state/chatSubmissionStore';

export interface ChatMaterialOperation {
  readonly owner: MountedChatBinding;
  readonly signal?: AbortSignal;
  readonly workspaceEpoch: string;
  readonly bindingSerial: number;
  readonly bindingRevision: number | null;
}
export type ChatMaterialResult =
  | { status: 'applied' | 'noop'; owner: MountedChatBinding }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: 'no_target' | 'busy' | 'no_consumer' }
  | { status: 'invalid' | 'source_failed' };
export type ChatMaterialBegin = { status: 'ready'; operation: ChatMaterialOperation }
  | Exclude<ChatMaterialResult, { status: 'applied' | 'noop' }>;

export function validateChatMaterial(operation: ChatMaterialOperation): Exclude<ChatMaterialResult, { status: 'applied' | 'noop' }> | null {
  const workspace = useWorkspaceStore.getState();
  if (!workspace.hasReceivedInit || workspace.activeWorkspaceId !== operation.owner.workspaceId
    || workspace.workspaceEpoch !== operation.workspaceEpoch || workspace.bindingSerial !== operation.bindingSerial
    || workspace.bindingRevision !== operation.bindingRevision) return { status: 'cancelled' };
  if (operation.signal?.aborted || !mountedChatIsCurrent(usePanelStore.getState(), operation.owner)) {
    return { status: 'cancelled' };
  }
  const { workspaceId, threadId } = operation.owner;
  if (useChatSubmissionStore.getState().attemptsByOwner[chatSubmissionOwnerKey(workspaceId, threadId)]?.phase === 'pending') {
    return { status: 'unavailable', reason: 'busy' };
  }
  return null;
}

/** Global begin requires foreground activity; explicit begin retains its own live binding. */
export function beginChatMaterial(owner?: MountedChatBinding | null, signal?: AbortSignal): ChatMaterialBegin {
  const state = usePanelStore.getState(), workspace = useWorkspaceStore.getState();
  const binding = owner === undefined ? state.activeMountedChat : owner;
  if (!workspace.hasReceivedInit || !workspace.workspaceEpoch || workspace.activeWorkspaceId !== state.activeWorkspaceId
    || !binding || !mountedChatIsCurrent(state, binding)
    || (owner === undefined && state.currentPanel !== binding.viewId)) {
    return { status: 'unavailable', reason: 'no_target' };
  }
  const operation = Object.freeze({ owner: binding, signal, workspaceEpoch: workspace.workspaceEpoch,
    bindingSerial: workspace.bindingSerial, bindingRevision: workspace.bindingRevision });
  const denied = validateChatMaterial(operation);
  return denied ?? { status: 'ready', operation };
}
