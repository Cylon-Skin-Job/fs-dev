/**
 * @module file-handlers
 * @role Handle file-related WebSocket messages (cache invalidation, live updates).
 *
 * Extracted from ws-client.ts (spec 05b) so file logic is isolated.
 */

import { useActiveResourceStore } from '../../state/activeResourceStore';
import { useFileDataStore, type FileNode, type FileResourceMetadata } from '../../state/fileDataStore';
import { useFileStore } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import { markOfficeThumbnailUpdated } from '../../state/officeThumbnailStore';
import { showToast } from '../toast';
import { removeViewPathReferences, rewriteViewPathReferences } from '../viewCollections';
import {
  removeCaptureTabPathReferences,
  rewriteCaptureTabPathReferences,
} from '../../components/view-tabs/captureTabPathReferences';
import type { WebSocketMessage } from '../../types';
import {
  shouldApplyWorkspaceResponse,
  type WorkspaceRequestFamily,
} from '../workspaceResponseTracker';
import type { FileContentResponseV1, FileSaveResponseV1 } from '../../types/file-explorer';
import { isFileContentResponseV1, isFileTreeResponseV1 } from './file-viewer-read-protocol';
import {
  isResourceChangedMessageV1,
  isResourceChangedMessageV2,
  isResourceRefreshRequiredV1,
} from './resource-projection-protocol';

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

function shouldApplyFileMutationResponse(
  family: WorkspaceRequestFamily,
  msg: WebSocketMessage,
): boolean {
  return shouldApplyWorkspaceResponse(
    family,
    msg.requestId,
    msg.workspaceId,
    usePanelStore.getState().activeWorkspaceId,
  );
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
    workspaceEpoch: useFileDataStore.getState().workspaceEpoch,
    localGeneration: msg.generation ?? -1,
    success: msg.success === true,
    error: msg.error,
  };
}

function closeForInvalidCanonicalMessage(reason: string): void {
  const ws = usePanelStore.getState().ws;
  try { ws?.close(1011, reason); } catch { /* best effort */ }
}

/**
 * Handle file-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 */
export function handleFileMessage(msg: WebSocketMessage): boolean {
  switch ((msg as { type: string }).type) {
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
      const protocol = msg as unknown as { version?: number; panel?: string };
      if (protocol.panel === 'file-viewer' || Object.prototype.hasOwnProperty.call(protocol, 'version')) {
        if (protocol.version !== 1 || !isFileTreeResponseV1(msg)) {
          closeForInvalidCanonicalMessage('invalid file tree v1 response');
          return true;
        }
        useFileDataStore.getState().handleTreeResponseV1(msg);
        return true;
      }
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
      const protocol = msg as unknown as { version?: number; panel?: string };
      if (protocol.panel === 'file-viewer' || Object.prototype.hasOwnProperty.call(protocol, 'version')) {
        if (protocol.version !== 1 || !isFileContentResponseV1(msg)) {
          closeForInvalidCanonicalMessage('invalid file content v1 response');
          return true;
        }
        const response = msg as unknown as FileContentResponseV1;
        const fileData = useFileDataStore.getState();
        const pendingPath = Array.from(fileData.pendingContents.entries()).find(
          ([, pending]) => pending.requestId === response.requestId,
        )?.[0].slice('file-viewer:'.length);
        const accepted = fileData.handleContentResponseV1(response);
        if (accepted && response.success) {
          // Persist presentation activity from canonical symlink metadata
          // without copying resource metadata into the presentation store.
          useFileStore.getState().refreshPersistedTabMetadata();
        } else if (accepted && pendingPath !== undefined) {
          // Error state remains canonical in fileDataStore. This adapter only
          // preserves the File Viewer presentation behavior of closing a tab
          // whose authoritative read failed.
          useFileStore.getState().removeTabAfterError(pendingPath);
        }
        return true;
      }
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

    case 'resource:changed': {
      const version = (msg as unknown as { version?: unknown }).version;
      const projection = version === 1 && isResourceChangedMessageV1(msg)
        ? msg
        : version === 2 && isResourceChangedMessageV2(msg)
          ? msg
          : null;
      if (!projection) {
        closeForInvalidCanonicalMessage('invalid resource changed message');
        return true;
      }
      if (useFileDataStore.getState().handleResourceChanged(projection) === 'conflict') {
        closeForInvalidCanonicalMessage('conflicting resource projection identity');
      }
      return true;
    }

    case 'resource:refresh_required': {
      if (!isResourceRefreshRequiredV1(msg)) {
        closeForInvalidCanonicalMessage('invalid resource recovery message');
        return true;
      }
      useFileDataStore.getState().handleResourceRefreshRequired(msg);
      return true;
    }

    case 'file_save_response': {
      const m = msg as FileSaveResponseMessage;
      if ((msg as unknown as { version?: number }).version === 1) {
        useFileDataStore.getState().handleSaveResponseV1(msg as unknown as FileSaveResponseV1);
      } else if (m.panel && m.path) {
        useFileDataStore.getState().handleLegacySaveResponse(m.panel, m.path, Boolean(m.success), m.error);
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
      if (!shouldApplyFileMutationResponse('file:move', msg)) return true;
      const m = msg as FileMovedMessage;
      if (m.sourcePanel && m.sourcePath && m.targetPath) {
        const targetPanel = m.targetPanel ?? m.sourcePanel;
        rewriteViewPathReferences({
          panel: m.sourcePanel,
          path: m.sourcePath,
          nextPanel: targetPanel,
          nextPath: m.targetPath,
          title: m.targetPath.split('/').pop(),
          folder: folderFromPath(m.targetPath),
          extension: extensionFromPath(m.targetPath),
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
        rewriteCaptureTabPathReferences({
          sourcePanel: m.sourcePanel,
          sourcePath: m.sourcePath,
          targetPanel,
          targetPath: m.targetPath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
      }
      return true;
    }

    case 'file:move_error':
      if (!shouldApplyFileMutationResponse('file:move', msg)) return true;
      showToast(`File move failed: ${(msg as FileMoveErrorMessage).error}`);
      return true;

    case 'file:renamed': {
      if (!shouldApplyFileMutationResponse('file:rename', msg)) return true;
      const m = msg as FileRenamedMessage;
      if (m.sourcePanel && m.sourcePath && m.targetPath) {
        const targetPanel = m.targetPanel ?? m.sourcePanel;
        rewriteViewPathReferences({
          panel: m.sourcePanel,
          path: m.sourcePath,
          nextPanel: targetPanel,
          nextPath: m.targetPath,
          title: m.newName || m.targetPath.split('/').pop(),
          folder: folderFromPath(m.targetPath),
          extension: extensionFromPath(m.targetPath),
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
        rewriteCaptureTabPathReferences({
          sourcePanel: m.sourcePanel,
          sourcePath: m.sourcePath,
          targetPanel,
          targetPath: m.targetPath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
      }
      showToast(`Renamed to ${m.newName || 'file'}`);
      return true;
    }

    case 'file:rename_error':
      if (!shouldApplyFileMutationResponse('file:rename', msg)) return true;
      showToast(`Rename failed: ${(msg as FileRenameErrorMessage).error}`);
      return true;

    case 'file:deleted': {
      if (!shouldApplyFileMutationResponse('file:delete', msg)) return true;
      const m = msg as FileDeletedMessage;
      if (m.sourcePanel && m.sourcePath) {
        removeViewPathReferences({
          panel: m.sourcePanel,
          path: m.sourcePath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
        removeCaptureTabPathReferences({
          sourcePanel: m.sourcePanel,
          sourcePath: m.sourcePath,
          includeDescendants: Boolean(m.sourceIsDirectory),
        });
      }
      showToast(m.sourceIsDirectory ? 'Folder deleted' : 'File deleted');
      return true;
    }

    case 'file:delete_error':
      if (!shouldApplyFileMutationResponse('file:delete', msg)) return true;
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
