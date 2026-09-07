/**
 * @module clipboard/clipboard-api
 * @role Public API for clipboard operations — uses ws-client for transport
 *
 * Post-keychain-redesign: list/append/touch/state broadcasts carry metadata
 * only. The full value is fetched per-click via `clipboard:use`, which is
 * also the path for the under-chat icon → click → insert into chat input
 * flow. The value is sent only to the requesting socket; broadcasts and
 * server-live.log never see it.
 */

import { sendFusionMessage, onFusionMessage, onFusionResponse } from '../lib/ws-client';
import { showToast } from '../lib/toast';
import { useClipboardStore } from './clipboard-store';
import type {
  ClipboardEntry,
  ClipboardListResponse,
  ClipboardAppendResponse,
  ClipboardUseResponse,
  ClipboardTouchResponse,
  ClipboardDeleteResponse,
  ClipboardClearResponse,
  ClipboardStateBroadcast,
  ClipboardErrorFrame,
} from './types';

// ── State broadcast subscription ─────────────────────────────

let stateUnsubscribe: (() => void) | null = null;

/**
 * Subscribe the clipboard store to server-side `clipboard:state` broadcasts.
 * Call once at app start. Idempotent.
 */
export function subscribeClipboardBroadcasts(): void {
  if (stateUnsubscribe) return;
  stateUnsubscribe = onFusionMessage('clipboard:state', (msg: ClipboardStateBroadcast) => {
    if (Array.isArray(msg.items)) {
      useClipboardStore.getState().setItems(msg.items, msg.total ?? msg.items.length);
    }
  });
}

export function unsubscribeClipboardBroadcasts(): void {
  if (stateUnsubscribe) {
    stateUnsubscribe();
    stateUnsubscribe = null;
  }
}

// ── WS request helpers ───────────────────────────────────────

function request<T extends { error?: string }>(
  type: string,
  payload: Record<string, unknown>,
  options: {
    timeoutMs?: number;
    matches?: (msg: T) => boolean;
  } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const matches = options.matches ?? (() => true);

  return new Promise((resolve, reject) => {
    let settled = false;
    const retire = () => {
      cleanup();
      reject(new Error(`Connection retired while waiting for ${type}`));
    };
    const cleanup = () => {
      if (settled) return;
      settled = true;
      unsubscribe();
      unsubscribeError();
      clearTimeout(timeout);
    };
    const unsubscribe = onFusionResponse(type, (msg: T) => {
      if (!matches(msg)) return;

      cleanup();
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg);
      }
    }, retire);
    const unsubscribeError = onFusionResponse('clipboard:error', (msg: ClipboardErrorFrame) => {
      if (msg.requestType && msg.requestType !== type) return;
      if (typeof payload.id === 'number' && typeof msg.id === 'number' && msg.id !== payload.id) return;

      cleanup();
      reject(new Error(msg.message || msg.code || `Clipboard request failed: ${type}`));
    }, retire);
    sendFusionMessage({ type, ...payload });
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeoutMs);
  });
}

// ── Public surface ───────────────────────────────────────────

export async function appendEntry(text: string, source = 'user'): Promise<ClipboardEntry | null> {
  const msg = await request<ClipboardAppendResponse>('clipboard:append', { text, source });
  return msg.item ?? null;
}

export async function listPage(offset = 0, limit = 50): Promise<ClipboardListResponse> {
  return request<ClipboardListResponse>('clipboard:list', { offset, limit });
}

export async function fetchEntryValue(id: number): Promise<string> {
  const msg = await request<ClipboardUseResponse>('clipboard:use', { id }, {
    matches: response => response.id === id,
  });
  return msg.value;
}

export async function touchEntry(id: number): Promise<ClipboardEntry | null> {
  const msg = await request<ClipboardTouchResponse>('clipboard:touch', { id });
  return msg.item ?? null;
}

export async function deleteEntry(id: number): Promise<boolean> {
  const msg = await request<ClipboardDeleteResponse>('clipboard:delete', { id });
  return msg.removed;
}

export async function clearHistory(): Promise<number> {
  const msg = await request<ClipboardClearResponse>('clipboard:clear', {});
  showToast('Clipboard history cleared');
  return msg.deleted;
}

/**
 * Write text to the system clipboard and record it in history. The clipboard
 * monitor will see it on the next tick anyway, but this gives the caller a
 * direct write + immediate confirmation.
 */
export async function writeAndRecord(text: string, source = 'user'): Promise<ClipboardEntry | null> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('[Clipboard] writeAndRecord — system clipboard write failed:', err);
  }
  return appendEntry(text, source);
}

/**
 * Fetch the value for an entry and write it to the system clipboard. Used
 * for system-clipboard paste-back paths (distinct from the chat-input
 * insertion path, which calls `fetchEntryValue` directly).
 */
export async function copyFromHistory(entry: ClipboardEntry): Promise<boolean> {
  try {
    const value = await fetchEntryValue(entry.id);
    await navigator.clipboard.writeText(value);
    showToast('Copied to clipboard');
    return true;
  } catch (err) {
    console.error('[Clipboard] copyFromHistory error:', err);
    showToast('Failed to copy');
    return false;
  }
}
