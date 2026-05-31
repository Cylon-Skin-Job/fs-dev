/**
 * @module clipboard/clipboard-monitor
 * @role Optional system clipboard polling controller.
 *
 * Disabled by default. Enable with:
 *   localStorage.setItem('fusion.clipboard.monitor.enabled', 'true')
 */

import { sendFusionMessage } from '../lib/ws-client';

const STORAGE_KEY = 'fusion.clipboard.monitor.enabled';
const MONITOR_INTERVAL_MS = 1000;

let lastClipboardText = '';
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastReadErrorLogAt = 0;

export function isClipboardMonitorEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setClipboardMonitorEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Storage may be unavailable; the runtime state still follows the call.
  }

  if (enabled) {
    startClipboardMonitor();
  } else {
    stopClipboardMonitor();
  }
}

export function initializeClipboardMonitorFromConfig(): void {
  if (isClipboardMonitorEnabled()) {
    startClipboardMonitor();
  } else {
    console.log('[Clipboard] Monitor disabled: opt-in not enabled');
  }
}

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
        sendFusionMessage({
          type: 'clipboard:append',
          text,
          source: 'auto',
        });
      }
    } catch (err) {
      const now = Date.now();
      if (now - lastReadErrorLogAt > 60_000) {
        lastReadErrorLogAt = now;
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[Clipboard] Monitor read skipped:', message);
      }
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
