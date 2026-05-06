/**
 * @module clipboard/clipboard-api
 * @role Public API for clipboard operations — uses ws-client for transport
 *
 * Post-keychain-redesign: list/append/touch/state broadcasts carry metadata
 * only. The full value is fetched per-click via `clipboard:use`, which is
 * also the hook for the under-chat icon → click → insert into chat input
 * flow. The value is sent only to the requesting socket; broadcasts and
 * server-live.log never see it.
 */

import { sendRobinMessage, onRobinMessage } from '../lib/ws-client';
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
} from './types';

// ── State broadcast subscription ─────────────────────────────

let stateUnsubscribe: (() => void) | null = null;

/**
 * Subscribe the clipboard store to server-side `clipboard:state` broadcasts.
 * Call once at app start. Idempotent.
 */
export function subscribeClipboardBroadcasts(): void {
  if (stateUnsubscribe) return;
  stateUnsubscribe = onRobinMessage('clipboard:state', (msg: ClipboardStateBroadcast) => {
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

// ── System clipboard monitor ─────────────────────────────────

let lastClipboardText = '';
let monitorInterval: ReturnType<typeof setInterval> | null = null;
const MONITOR_INTERVAL_MS = 1000;

export function startClipboardMonitor(): void {
  if (monitorInterval) return;

  if (!navigator.clipboard || !navigator.clipboard.readText) {
    console.log('[Clipboard] Clipboard reading not supported');
    return;
  }

  monitorInterval = setInterval(async () => {
    try {
      const text = await navigator.clipboard.readText();

      // Server-side hash dedup handles repeats; we only suppress the
      // immediately-prior value to avoid round-tripping the same string
      // every second.
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        sendRobinMessage({
          type: 'clipboard:append',
          text,
          source: 'auto',
        });
      }
    } catch {
      // Permission denied / no focus — silently ignore.
    }
  }, MONITOR_INTERVAL_MS);

  console.log('[Clipboard] Monitor started');
}

export function stopClipboardMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[Clipboard] Monitor stopped');
  }
}

// ── WS request helpers ───────────────────────────────────────

function request<T>(type: string, payload: Record<string, unknown>, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onRobinMessage(type, (msg: T & { error?: string }) => {
      unsubscribe();
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg);
      }
    });
    sendRobinMessage({ type, ...payload });
    setTimeout(() => {
      unsubscribe();
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

export async function useEntry(id: number): Promise<string> {
  const msg = await request<ClipboardUseResponse>('clipboard:use', { id });
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
 * insertion path, which calls `useEntry` directly).
 */
export async function copyFromHistory(entry: ClipboardEntry): Promise<boolean> {
  try {
    const value = await useEntry(entry.id);
    await navigator.clipboard.writeText(value);
    showToast('Copied to clipboard');
    return true;
  } catch (err) {
    console.error('[Clipboard] copyFromHistory error:', err);
    showToast('Failed to copy');
    return false;
  }
}
