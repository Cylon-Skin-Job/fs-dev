/**
 * @module file-handlers
 * @role Handle file-related WebSocket messages (cache invalidation, live updates).
 *
 * Extracted from ws-client.ts (spec 05b) so file logic is isolated.
 */

import { useActiveResourceStore } from '../../state/activeResourceStore';
import { useFileDataStore, type FileNode, type FileResourceMetadata } from '../../state/fileDataStore';
import { markOfficeThumbnailUpdated } from '../../state/officeThumbnailStore';
import { showToast } from '../toast';
import { removeViewPathReferences, rewriteViewPathReferences } from '../viewCollections';
import type { WebSocketMessage } from '../../types';
import {
  removeCaptureDocumentPaths,
  rewriteCaptureDocumentPaths,
} from '../../components/view-tabs/captureTabsController';

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
  isSymlink?: boolean;
  symlinkTarget?: string;
  requestId?: string;
  workspaceId?: string;
  generation?: number;
  success?: boolean;
  error?: string;
}

interface FileContentResponseMessage extends WebSocketMessage {
  type: 'file_content_response';
  panel?: string;
  path?: string;
  success?: boolean;
  content?: string;
  isSymlink?: boolean;
  symlinkTarget?: string;
  requestId?: string;
  workspaceId?: string;
  generation?: number;
  error?: string;
}

interface FileSaveResponseMessage extends WebSocketMessage {
  type: 'file_save_response';
  panel?: string;
  path?: string;
  success?: boolean;
  error?: string;
}

interface FolderCreateResponseMessage extends WebSocketMessage {
  type: 'folder_create_response';
  panel?: string;
  path?: string;
  parentPath?: string;
  success?: boolean;
  error?: string;
}

interface DocumentCreateResponseMessage extends WebSocketMessage {
  type: 'document_create_response';
  panel?: string;
  path?: string;
  parentPath?: string;
  content?: string;
  success?: boolean;
  error?: string;
}

interface FileMoveErrorMessage extends WebSocketMessage {
  type: 'file:move_error';
  error?: string;
}

interface FileMovedMessage extends WebSocketMessage {
  type: 'file:moved';
  sourcePanel?: string;
  sourcePath?: string;
  targetPanel?: string;
  targetPath?: string;
  sourceIsDirectory?: boolean;
}

interface FileRenamedMessage extends WebSocketMessage {
  type: 'file:renamed';
  newName?: string;
  sourcePanel?: string;
  sourcePath?: string;
  targetPanel?: string;
  targetPath?: string;
  sourceIsDirectory?: boolean;
}

interface FileRenameErrorMessage extends WebSocketMessage {
  type: 'file:rename_error';
  error?: string;
}

interface FileDeleteErrorMessage extends WebSocketMessage {
  type: 'file:delete_error';
  error?: string;
}

interface FileDeletedMessage extends WebSocketMessage {
  type: 'file:deleted';
  sourcePanel?: string;
  sourcePath?: string;
  sourceIsDirectory?: boolean;
}

interface OfficeThumbnailErrorMessage extends WebSocketMessage {
  type: 'office:thumbnail_error';
  documentPath?: string;
  error?: string;
}

interface OfficeThumbnailSavedMessage extends WebSocketMessage {
  type: 'office:thumbnail_saved';
  documentPath?: string;
  savedAt?: number;
}

function folderFromPath(filePath: string): string {
  return filePath.split('/').slice(0, -1).join('/');
}

function extensionFromPath(filePath: string): string | undefined {
  const name = filePath.split('/').pop() || '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : undefined;
}

function symlinkMetadata(msg: { isSymlink?: boolean; symlinkTarget?: string }): FileResourceMetadata | undefined {
  return msg.isSymlink === true
    ? { isSymlink: true, symlinkTarget: msg.symlinkTarget }
    : undefined;
}

function responseCorrelation(msg: {
  requestId?: string;
  workspaceId?: string | null;
  generation?: number;
  success?: boolean;
  error?: string;
}) {
  return {
    requestId: msg.requestId ?? '',
    workspaceId: msg.workspaceId ?? null,
    generation: msg.generation ?? -1,
    success: msg.success === true,
    error: msg.error,
  };
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
        fileData.requestContent(activeRes.panel, activeRes.relativePath);
      }
      return true;
    }

    // --- Central file data cache population ---
    case 'file_tree_response': {
      const m = msg as FileTreeResponseMessage;
      if (m.panel && m.path !== undefined) {
        useFileDataStore.getState().handleTreeResponse(
          m.panel,
          m.path,
          m.nodes || [],
          symlinkMetadata(m),
          responseCorrelation(m),
        );
      }
      return true;
    }

    case 'file_content_response': {
      const m = msg as FileContentResponseMessage;
      if (m.panel && m.path) {
        useFileDataStore.getState().handleContentResponse(
          m.panel,
          m.path,
          m.content || '',
          symlinkMetadata(m),
          responseCorrelation(m),
        );
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

    case 'folder_create_response': {
      const m = msg as FolderCreateResponseMessage;
      if (m.panel && m.success) {
        useFileDataStore.getState().invalidateTree(m.panel, m.parentPath ?? '');
        showToast('Folder created');
      } else if (m.error) {
        showToast(`Folder create failed: ${m.error}`);
      }
      return true;
    }

    case 'document_create_response': {
      const m = msg as DocumentCreateResponseMessage;
      if (m.panel && m.success) {
        const fileData = useFileDataStore.getState();
        fileData.invalidateTree(m.panel, m.parentPath ?? '');
        if (m.path) {
          fileData.handleContentResponse(m.panel, m.path, m.content ?? '');
        }
        showToast('Document created');
      } else if (m.error) {
        showToast(`Document create failed: ${m.error}`);
      }
      return true;
    }

    case 'file:moved': {
      const m = msg as FileMovedMessage;
      if (m.sourcePanel && m.sourcePath && m.targetPath) {
        rewriteViewPathReferences({
          panel: m.sourcePanel,
          path: m.sourcePath,
          nextPanel: m.targetPanel ?? m.sourcePanel,
          nextPath: m.targetPath,
          title: m.targetPath.split('/').pop(),
          folder: folderFromPath(m.targetPath),
          extension: extensionFromPath(m.targetPath),
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
        rewriteCaptureDocumentPaths({
          sourcePanel: m.sourcePanel,
          sourcePath: m.sourcePath,
          targetPanel: m.targetPanel,
          targetPath: m.targetPath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
      }
      return true;
    }

    case 'file:move_error':
      showToast(`File move failed: ${(msg as FileMoveErrorMessage).error}`);
      return true;

    case 'file:renamed': {
      const m = msg as FileRenamedMessage;
      if (m.sourcePanel && m.sourcePath && m.targetPath) {
        rewriteViewPathReferences({
          panel: m.sourcePanel,
          path: m.sourcePath,
          nextPanel: m.targetPanel ?? m.sourcePanel,
          nextPath: m.targetPath,
          title: m.newName || m.targetPath.split('/').pop(),
          folder: folderFromPath(m.targetPath),
          extension: extensionFromPath(m.targetPath),
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
        rewriteCaptureDocumentPaths({
          sourcePanel: m.sourcePanel,
          sourcePath: m.sourcePath,
          targetPanel: m.targetPanel,
          targetPath: m.targetPath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
      }
      showToast(`Renamed to ${m.newName || 'file'}`);
      return true;
    }

    case 'file:rename_error':
      showToast(`Rename failed: ${(msg as FileRenameErrorMessage).error}`);
      return true;

    case 'file:deleted': {
      const m = msg as FileDeletedMessage;
      if (m.sourcePanel && m.sourcePath) {
        removeViewPathReferences({
          panel: m.sourcePanel,
          path: m.sourcePath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
        removeCaptureDocumentPaths({
          sourcePanel: m.sourcePanel,
          sourcePath: m.sourcePath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
      }
      showToast(m.sourceIsDirectory ? 'Folder deleted' : 'File deleted');
      return true;
    }

    case 'file:delete_error':
      showToast(`Delete failed: ${(msg as FileDeleteErrorMessage).error}`);
      return true;

    case 'office:thumbnail_saved': {
      const m = msg as OfficeThumbnailSavedMessage;
      if (m.documentPath) {
        markOfficeThumbnailUpdated(m.documentPath, m.savedAt);
      }
      return true;
    }

    case 'office:thumbnail_error': {
      const m = msg as OfficeThumbnailErrorMessage;
      console.warn(`[OfficeThumbnail] ${m.documentPath || 'document'}: ${m.error || 'unknown error'}`);
      return true;
    }

    default:
      return false;
  }
}
