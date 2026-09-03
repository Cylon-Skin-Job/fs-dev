/**
 * @module useTileFileActions
 * @role Controller hook for tile-level filesystem entry actions
 *
 * Orchestrates rename, archive/restore, and delete actions for files and
 * folders shown in tile grids. Keeps presentation components free of
 * WebSocket details.
 */

import { useCallback } from 'react';
import { usePanelStore } from '../state/panelStore';
import { showToast } from '../lib/toast';
import { getPanelArchiveFolder, isViewerArchivePath } from '../lib/viewFolders';
import { nextWorkspaceRequestId } from '../lib/workspaceResponseTracker';
import type { FileNode } from '../state/fileDataStore';

interface UseTileFileActionsOptions {
  panel: string;
  folder: string;
}

type FileActionEntry = Pick<FileNode, 'name' | 'path' | 'type' | 'extension'>;

function joinPanelPath(panelRoot: string, relativePath: string): string {
  return [panelRoot.replace(/\/+$/, ''), relativePath]
    .filter(Boolean)
    .join('/');
}

function entryRelativePath(entry: FileActionEntry, folder: string): string {
  return entry.path || [folder, entry.name].filter(Boolean).join('/');
}

function entryKind(entry: FileActionEntry): 'file' | 'folder' {
  return entry.type === 'folder' ? 'folder' : 'file';
}

export function useTileFileActions({ panel, folder }: UseTileFileActionsOptions) {
  const archiveFolder = getPanelArchiveFolder(panel);
  const isArchiveFolder = useCallback(
    (folderOverride = folder) => Boolean(archiveFolder && isViewerArchivePath(folderOverride, archiveFolder)),
    [archiveFolder, folder]
  );
  const isArchive = isArchiveFolder(folder);

  const getWs = useCallback(() => {
    const state = usePanelStore.getState();
    const panelRoot = state.panelRoots[panel];
    const ws = state.ws;
    if (!panelRoot) {
      showToast('Panel root not loaded');
      return null;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Not connected');
      return null;
    }
    return { panelRoot, ws, workspaceId: state.activeWorkspaceId };
  }, [panel]);

  const isArchiveEntry = useCallback(
    (entry: FileActionEntry, folderOverride = folder) => Boolean(
      archiveFolder && isViewerArchivePath(entryRelativePath(entry, folderOverride), archiveFolder)
    ),
    [archiveFolder, folder]
  );

  const archiveOrRestoreFile = useCallback(
    (entry: FileActionEntry, folderOverride = folder) => {
      const conn = getWs();
      if (!conn) return;
      if (!archiveFolder) {
        showToast('Archive is not supported for this view');
        return;
      }
      if (isArchiveEntry(entry, folderOverride)) {
        showToast('Restore from the flat archive is not available');
        return;
      }
      const { panelRoot, ws, workspaceId } = conn;
      const source = joinPanelPath(panelRoot, entryRelativePath(entry, folderOverride));
      const target = `${panelRoot.replace(/\/+$/, '')}/${archiveFolder}`;
      ws.send(JSON.stringify({
        type: 'file:move',
        source,
        target,
        requestId: nextWorkspaceRequestId('file:move', workspaceId),
      }));
    },
    [archiveFolder, folder, getWs, isArchiveEntry]
  );

  const renameFile = useCallback(
    (entry: FileActionEntry, folderOverride = folder) => {
      const conn = getWs();
      if (!conn) return;
      const { panelRoot, ws, workspaceId } = conn;
      const source = joinPanelPath(panelRoot, entryRelativePath(entry, folderOverride));
      const newName = window.prompt(`Rename ${entryKind(entry)}`, entry.name);
      if (!newName || newName === entry.name) return;
      ws.send(JSON.stringify({
        type: 'file:rename',
        source,
        newName,
        requestId: nextWorkspaceRequestId('file:rename', workspaceId),
      }));
    },
    [folder, getWs]
  );

  const deleteFile = useCallback(
    (entry: FileActionEntry, folderOverride = folder) => {
      const conn = getWs();
      if (!conn) return;
      const { panelRoot, ws, workspaceId } = conn;
      const source = joinPanelPath(panelRoot, entryRelativePath(entry, folderOverride));
      if (!window.confirm(`Delete ${entry.name}?`)) return;
      ws.send(JSON.stringify({
        type: 'file:delete',
        source,
        requestId: nextWorkspaceRequestId('file:delete', workspaceId),
      }));
    },
    [folder, getWs]
  );

  return {
    isArchive,
    isArchiveFolder,
    isArchiveEntry,
    archiveOrRestoreFile,
    renameFile,
    deleteFile,
  };
}
