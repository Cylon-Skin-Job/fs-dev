/**
 * @module clipboard/types
 * @role Type definitions for clipboard manager
 *
 * Post-keychain-redesign: ClipboardEntry is metadata only. Values live in
 * the macOS Keychain on the server and are fetched per-click via
 * `clipboard:use`. Clients never receive the value through `clipboard:list`
 * or any broadcast.
 */

export interface ClipboardEntry {
  id: number;
  type: string;            // 'text' | 'link' | 'code' | 'secret' | ...
  preview: string;         // first 80 chars (display) OR fingerprint when type === 'secret'
  created_at?: number;
  last_used_at: number;
  source?: string;         // 'auto' | 'manual' | 'api' | ...
}

export type BubbleState = 'CLOSED' | 'PREVIEW' | 'LOCKED' | 'LEAVING';

export interface ClipboardListResponse {
  items: ClipboardEntry[];
  total: number;
  offset: number;
  limit: number;
  error?: string;
}

export interface ClipboardAppendResponse {
  item?: ClipboardEntry;
  error?: string;
}

export interface ClipboardUseResponse {
  id: number;
  value: string;           // returned to the requesting socket only; redacted in WS debug logs
  error?: string;
}

export interface ClipboardTouchResponse {
  item?: ClipboardEntry;
  error?: string;
}

export interface ClipboardDeleteResponse {
  id: number;
  removed: boolean;
  error?: string;
}

export interface ClipboardClearResponse {
  deleted: number;
  error?: string;
}

export interface ClipboardStateBroadcast {
  type: 'clipboard:state';
  items: ClipboardEntry[];
  total: number;
}

export interface ClipboardErrorFrame {
  type: 'clipboard:error';
  code: string;
  message: string;
}
