/**
 * @module useScreenshotCapture
 * @role Capture workspace screenshots and push them to the server.
 *
 * Electron: uses native IPC capture (non-blocking).
 * Browser: disabled — DOM-to-image libraries freeze on complex panels.
 */

import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { usePanelStore } from '../state/panelStore';

function sendScreenshotMessage(message: Record<string, unknown>): void {
  const ws = usePanelStore.getState().ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function useScreenshotCapture() {
  const activeIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ribbonWasOpen = useRef(false);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isRibbonOpen = useWorkspaceStore((s) => s.isRibbonOpen);

  // Electron native capture
  useEffect(() => {
    if (!activeWorkspaceId || !window.electronAPI?.captureRect) return;
    activeIdRef.current = activeWorkspaceId;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      _doElectronCapture(activeWorkspaceId);
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!window.electronAPI?.captureRect) return;
    if (ribbonWasOpen.current && !isRibbonOpen) {
      const id = activeIdRef.current;
      if (id) setTimeout(() => _doElectronCapture(id), 200);
    }
    ribbonWasOpen.current = isRibbonOpen;
  }, [isRibbonOpen]);
}

async function _doElectronCapture(workspaceId: string) {
  if (!window.electronAPI?.captureRect) return;
  const el = document.querySelector('.rv-panel.active') as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  try {
    const base64 = await window.electronAPI.captureRect({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    if (!base64) return;

    sendScreenshotMessage({
      type: 'screenshot:capture',
      workspaceId,
      dataUrl: `data:image/png;base64,${base64}`,
    });
  } catch (_err) {
    // Silent fail
  }
}
