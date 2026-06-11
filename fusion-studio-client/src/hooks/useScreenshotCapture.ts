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

function canCaptureWorkspace(workspaceId: string): boolean {
  const workspace = useWorkspaceStore.getState();
  return workspace.activeWorkspaceId === workspaceId
    && !workspace.isRibbonOpen
    && !workspace.isWorkspacePreviewOpen
    && !workspace.previewWorkspaceId
    && !workspace.previewCommitWorkspaceId;
}

async function _doElectronCapture(workspaceId: string) {
  if (!window.electronAPI?.captureRect) return;
  if (!canCaptureWorkspace(workspaceId)) return;

  const app = document.querySelector('.rv-app-container') as HTMLElement | null;
  if (!app) return;

  const appRect = app.getBoundingClientRect();
  const header = document.querySelector('.rv-header') as HTMLElement | null;
  const headerHeight = header?.getBoundingClientRect().height ?? 60;
  try {
    const base64 = await window.electronAPI.captureRect({
      x: Math.round(appRect.x),
      y: Math.round(appRect.y + headerHeight),
      width: Math.round(appRect.width),
      height: Math.round(appRect.height - headerHeight),
    });
    if (!base64) return;
    if (!canCaptureWorkspace(workspaceId)) return;

    sendScreenshotMessage({
      type: 'screenshot:capture',
      workspaceId,
      panelId: usePanelStore.getState().currentPanel,
      dataUrl: `data:image/png;base64,${base64}`,
    });
  } catch (_err) {
    // Silent fail
  }
}
