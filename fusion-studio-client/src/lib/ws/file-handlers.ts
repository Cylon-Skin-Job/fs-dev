/**
 * @module file-handlers
 * @role Handle file-related WebSocket messages (cache invalidation, live updates).
 *
 * Extracted from ws-client.ts (spec 05b) so file logic is isolated.
 */

import { usePanelStore } from '../../state/panelStore';
import { useActiveResourceStore } from '../../state/activeResourceStore';
import { useFileDataStore, type FileNode } from '../../state/fileDataStore';
import { showToast } from '../toast';
import type { WebSocketMessage } from '../../types';

interface FileChangedMessage extends WebSocketMessage {
  type: 'file_changed';
  filePath?: string;
  panel?: string;
}

interface FileTreeResponseMessage extends WebSocketMessage {
  type: 'file_tree_response';
  panel?: string;
  path?: string;
  nodes?: FileNode[];
}

interface FileContentResponseMessage extends WebSocketMessage {
  type: 'file_content_response';
  panel?: string;
  path?: string;
  success?: boolean;
  content?: string;
}

interface FileSaveResponseMessage extends WebSocketMessage {
  type: 'file_save_response';
  panel?: string;
  path?: string;
  success?: boolean;
  error?: string;
}

interface FileMoveErrorMessage extends WebSocketMessage {
  type: 'file:move_error';
  error?: string;
}

interface FileRenamedMessage extends WebSocketMessage {
  type: 'file:renamed';
  newName?: string;
}

interface FileRenameErrorMessage extends WebSocketMessage {
  type: 'file:rename_error';
  error?: string;
}

interface FileDeleteErrorMessage extends WebSocketMessage {
  type: 'file:delete_error';
  error?: string;
}

/**
 * Handle file-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 */
export function handleFileMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'file_changed': {
      // Invalidate central cache — triggers re-fetch for affected entries
      const fileData = useFileDataStore.getState();
      const m = msg as FileChangedMessage;
      const changedPath = m.filePath || '';
      const changedPanel = m.panel;
      if (changedPanel && changedPath) {
        fileData.invalidate(changedPanel, changedPath);
      }

      // Also re-fetch if the active resource matches (page view live update)
      const activeRes = useActiveResourceStore.getState().activeResource;
      if (activeRes && changedPath.endsWith(activeRes.relativePath)) {
        const store = usePanelStore.getState();
        const ws = store.ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'file_content_request',
            panel: activeRes.panel,
            path: activeRes.relativePath,
          }));
        }
      }
      return true;
    }

    // --- Central file data cache population ---
    case 'file_tree_response': {
      const m = msg as FileTreeResponseMessage;
      if (m.panel && m.path !== undefined) {
        useFileDataStore.getState().handleTreeResponse(m.panel, m.path, m.nodes || []);
      }
      return true;
    }

    case 'file_content_response': {
      const m = msg as FileContentResponseMessage;
      if (m.panel && m.path && m.success) {
        useFileDataStore.getState().handleContentResponse(m.panel, m.path, m.content || '');
      }
      return true;
    }

    case 'file_save_response': {
      const m = msg as FileSaveResponseMessage;
      if (m.panel && m.path) {
        useFileDataStore.getState().handleSaveResponse(m.panel, m.path, Boolean(m.success), m.error);
      }
      return true;
    }

    case 'file:moved':
      console.log('[WS] File moved:', msg);
      return true;

    case 'file:move_error':
      showToast(`File move failed: ${(msg as FileMoveErrorMessage).error}`);
      return true;

    case 'file:renamed':
      showToast(`Renamed to ${(msg as FileRenamedMessage).newName || 'file'}`);
      return true;

    case 'file:rename_error':
      showToast(`Rename failed: ${(msg as FileRenameErrorMessage).error}`);
      return true;

    case 'file:deleted':
      showToast('File deleted');
      return true;

    case 'file:delete_error':
      showToast(`Delete failed: ${(msg as FileDeleteErrorMessage).error}`);
      return true;

    default:
      return false;
  }
}
