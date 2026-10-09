import type { ChatLinkAttachment } from './chat-file-links/file-link-types';
import { usePanelStore } from '../state/panelStore';
import { getCurrentThreadGroupId, getThreadGroupPopulation } from '../state/slices/chatSurfaceSlice';

export type ChatActionTarget = 'current' | 'new';
export type ChatActionDelivery = 'insert' | 'send';

/** Immutable destination selected when the user invokes the action. */
export interface ChatActionAddress {
  workspaceId: string;
  viewId: string;
  threadGroupId: string | null;
  threadId: string | null;
  surfaceId?: string;
}

export interface ChatActionPayload {
  content?: string;
  attachment?: ChatLinkAttachment;
  promptId?: string;
  variables?: Record<string, unknown>;
  target: ChatActionTarget;
  delivery: ChatActionDelivery;
  /** The source view is the target population for a current-chat action. */
  sourceViewId?: string;
  /** A mounted chat action can provide its already captured exact identity. */
  address?: ChatActionAddress;
  threadName?: string;
  metadata?: Record<string, unknown>;
  /** Cancels an uncommitted intent when its invoking UI closes. */
  signal?: AbortSignal;
}

export type ChatActionResult =
  | { status: 'applied'; address: ChatActionAddress }
  | { status: 'accepted'; address: ChatActionAddress; requestId: string; turnId: string }
  | { status: 'pending'; address: ChatActionAddress; requestId: string }
  | { status: 'unknown'; address: ChatActionAddress; requestId: string }
  | { status: 'cancelled'; address: ChatActionAddress; requestId?: string }
  | { status: 'failed'; reason: 'no_target' | 'no_consumer' | 'unsupported' | 'busy' | 'not_enqueued' | 'invalid_action' };

export interface ChatActionRequest extends ChatActionPayload {
  readonly capturedAddress: ChatActionAddress | null;
  readonly complete: (result: ChatActionResult) => void;
  readonly claim: () => void;
}

export const CHAT_ACTION_EVENT = 'fusion:chat-action';

/** Resolve the view's selected group once; never consult selection after an await. */
export function captureChatActionAddress(viewId?: string): ChatActionAddress | null {
  const state = usePanelStore.getState();
  const workspaceId = state.activeWorkspaceId;
  const resolvedViewId = viewId ?? state.currentPanel;
  if (!workspaceId || !resolvedViewId) return null;
  const threadGroupId = getCurrentThreadGroupId(state, workspaceId, resolvedViewId);
  const row = threadGroupId
    ? getThreadGroupPopulation(state, workspaceId, resolvedViewId)
      .find((item) => item.threadGroupId === threadGroupId)
    : null;
  return Object.freeze({
    workspaceId,
    viewId: resolvedViewId,
    threadGroupId: row?.threadGroupId ?? null,
    threadId: row?.threadId ?? null,
  });
}

/** The event remains the established boundary; its one app consumer owns the result. */
export function dispatchChatAction(action: ChatActionPayload): Promise<ChatActionResult> {
  const capturedAddress = action.address ?? captureChatActionAddress(action.sourceViewId);
  return new Promise((resolve) => {
    let claimed = false;
    let completed = false;
    const complete = (result: ChatActionResult) => {
      if (completed) return;
      completed = true;
      resolve(result);
    };
    window.dispatchEvent(new CustomEvent<ChatActionRequest>(CHAT_ACTION_EVENT, {
      detail: { ...action, capturedAddress, claim: () => { claimed = true; }, complete },
    }));
    if (!claimed) complete({ status: 'failed', reason: 'no_consumer' });
  });
}

// Compose-only prepared material. Explicit Send and System creation keep their separate API above.
export { beginChatMaterial, validateChatMaterial } from './chat-material-target';
export type { ChatMaterialOperation, ChatMaterialResult, ChatMaterialBegin } from './chat-material-target';
import type { ChatMaterialOperation, ChatMaterialResult } from './chat-material-target';

export interface ChatMaterialSelection {
  surfaceId: string;
  generation: number;
  value: string;
  revision: number;
  start: number;
  end: number;
}
export type PreparedChatMaterial =
  | { text: string; selection?: ChatMaterialSelection }
  | { attachment: ChatLinkAttachment }
  | { sourceFailure: true };
export interface ChatMaterialRequest {
  readonly kind: 'material';
  readonly operation: ChatMaterialOperation;
  readonly material: PreparedChatMaterial;
  readonly complete: (result: ChatMaterialResult) => void;
  readonly claim: () => void;
}

/** Dispatch is synchronous through the single installed consumer before this promise returns. */
export function commitChatMaterial(operation: ChatMaterialOperation, material: PreparedChatMaterial): Promise<ChatMaterialResult> {
  return new Promise((resolve) => {
    let claimed = false, completed = false;
    const complete = (result: ChatMaterialResult) => {
      if (completed) return;
      completed = true;
      resolve(result);
    };
    window.dispatchEvent(new CustomEvent<ChatMaterialRequest>(CHAT_ACTION_EVENT, {
      detail: { kind: 'material', operation, material, claim: () => { claimed = true; }, complete },
    }));
    if (!claimed) complete({ status: 'unavailable', reason: 'no_consumer' });
  });
}
