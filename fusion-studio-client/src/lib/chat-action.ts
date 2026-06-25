import type { ChatLinkAttachment } from './chat-file-links/file-link-types';

export type ChatActionTarget = 'current' | 'new';
export type ChatActionDelivery = 'insert' | 'send';

export interface ChatActionPayload {
  content?: string;
  attachment?: ChatLinkAttachment;
  promptId?: string;
  variables?: Record<string, unknown>;
  target: ChatActionTarget;
  delivery: ChatActionDelivery;
  threadName?: string;
  metadata?: Record<string, unknown>;
}

export const CHAT_ACTION_EVENT = 'fusion:chat-action';

export function dispatchChatAction(action: ChatActionPayload) {
  window.dispatchEvent(new CustomEvent<ChatActionPayload>(CHAT_ACTION_EVENT, { detail: action }));
}
