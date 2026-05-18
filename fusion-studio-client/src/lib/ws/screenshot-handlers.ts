/**
 * Screenshot WebSocket message handlers.
 *
 * One job: route server screenshot messages into the screenshot store.
 */

import { useScreenshotStore } from '../../state/screenshotStore';
import { usePanelStore } from '../../state/panelStore';
import type { WebSocketMessage } from '../../types';

function sendWs(msg: Record<string, unknown>) {
  const ws = usePanelStore.getState().ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function handleScreenshotMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'screenshot:data': {
      const m = msg as any;
      console.log('[SS] data received:', m.workspaceId, m.dataUrl ? m.dataUrl.length + ' chars' : 'no data');
      if (m.workspaceId && m.dataUrl) {
        useScreenshotStore.getState().setScreenshot(m.workspaceId, m.dataUrl);
      }
      return true;
    }

    case 'screenshot:list': {
      const m = msg as any;
      console.log('[SS] list received:', m.screenshots?.length, 'items');
      if (Array.isArray(m.screenshots)) {
        for (const row of m.screenshots) {
          if (row.workspaceId) {
            sendWs({ type: 'screenshot:request', workspaceId: row.workspaceId });
          }
        }
      }
      return true;
    }

    case 'screenshot:updated': {
      const m = msg as any;
      if (m.workspaceId) {
        sendWs({ type: 'screenshot:request', workspaceId: m.workspaceId });
      }
      return true;
    }

    case 'screenshot:missing':
      return true;

    case 'screenshot:error': {
      console.error('[SS] server error:', (msg as any).message);
      return true;
    }

    default:
      return false;
  }
}
