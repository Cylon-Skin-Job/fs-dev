/** Portable source callbacks; destination and store ownership stay with the Chat action. */
import type { ChatLinkAttachment } from './chat-file-links/file-link-types';
import type { ChatMaterialResult } from './chat-material-target';
export interface ChatMaterialSource {
  readonly signal: AbortSignal;
  text: (text: string) => Promise<ChatMaterialResult>;
  attachment: (attachment: ChatLinkAttachment) => Promise<ChatMaterialResult>;
  fail: () => Promise<ChatMaterialResult>;
  cancel: () => void;
}
export type BeginChatMaterialSource = (options?: { append?: boolean; warm?: boolean }) =>
  | { status: 'ready'; source: ChatMaterialSource }
  | Exclude<ChatMaterialResult, { status: 'applied' | 'noop' }>;
