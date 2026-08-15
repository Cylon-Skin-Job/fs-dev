/**
 * @module useFileTileMenu
 * @role Shared context-menu controller for viewer file and folder tiles
 *
 * Keeps Pin / Star / Rename / Archive / Delete menu composition out of view
 * components.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { showContextMenu } from '../lib/contextMenu';
import {
  isViewPinnedFolder,
  isViewStarred,
  toggleViewPinnedFolder,
  toggleViewStarred,
} from '../lib/viewCollections';
import type { FileNode, FileWithContent } from '../state/fileDataStore';
import { useTileFileActions } from './useTileFileActions';

interface UseFileTileMenuOptions {
  panel: string;
  folder: string;
}

export function useFileTileMenu({ panel, folder }: UseFileTileMenuOptions) {
  const {
    isArchiveEntry,
    renameFile,
    archiveOrRestoreFile,
    deleteFile,
  } = useTileFileActions({
    panel,
    folder,
  });
  const closeMenuRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      closeMenuRef.current?.();
    };
  }, []);

  const showFileMenu = useCallback(
    (file: FileWithContent, x: number, y: number, folderOverride = folder) => {
      const filePath = file.path || [folderOverride, file.name].filter(Boolean).join('/');
      const isStarred = isViewStarred(panel, panel, filePath);
      closeMenuRef.current?.();
      closeMenuRef.current = showContextMenu({
        x,
        y,
        items: [
          {
            label: isStarred ? 'Unstar' : 'Star',
            action: () => toggleViewStarred(panel, {
              panel,
              path: filePath,
              title: file.name,
              kind: 'document',
              folder: folderOverride,
              extension: file.extension ?? file.name.split('.').pop()?.toLowerCase(),
            }),
          },
          { label: 'Rename', action: () => renameFile(file, folderOverride) },
          {
            label: isArchiveEntry(file, folderOverride) ? 'Restore' : 'Archive',
            action: () => archiveOrRestoreFile(file, folderOverride),
          },
          { label: 'Delete', danger: true, action: () => deleteFile(file, folderOverride) },
        ],
      });
    },
    [archiveOrRestoreFile, deleteFile, folder, isArchiveEntry, panel, renameFile]
  );

  const showFolderMenu = useCallback(
    (folderEntry: Pick<FileNode, 'name' | 'path'>, x: number, y: number, folderOverride = folder) => {
      const entry = { ...folderEntry, type: 'folder' as const };
      const isPinned = isViewPinnedFolder(panel, panel, entry.path);
      closeMenuRef.current?.();
      closeMenuRef.current = showContextMenu({
        x,
        y,
        items: [
          {
            label: isPinned ? 'Unpin folder' : 'Pin folder',
            action: () => toggleViewPinnedFolder(panel, {
              panel,
              path: entry.path,
              title: entry.name,
              kind: 'folder',
            }),
          },
          { label: 'Rename', action: () => renameFile(entry, folderOverride) },
          {
            label: isArchiveEntry(entry, folderOverride) ? 'Restore' : 'Archive',
            action: () => archiveOrRestoreFile(entry, folderOverride),
          },
          { label: 'Delete', danger: true, action: () => deleteFile(entry, folderOverride) },
        ],
      });
    },
    [archiveOrRestoreFile, deleteFile, folder, isArchiveEntry, panel, renameFile]
  );

  const getFileContextMenuHandler = useCallback(
    (file: FileWithContent, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showFileMenu(file, event.clientX, event.clientY, folderOverride);
    },
    [folder, showFileMenu]
  );

  const getFileMoreClickHandler = useCallback(
    (file: FileWithContent, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      showFileMenu(file, rect.left, rect.bottom + 4, folderOverride);
    },
    [folder, showFileMenu]
  );

  const getFolderContextMenuHandler = useCallback(
    (folderEntry: Pick<FileNode, 'name' | 'path'>, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showFolderMenu(folderEntry, event.clientX, event.clientY, folderOverride);
    },
    [folder, showFolderMenu]
  );

  const getFolderMoreClickHandler = useCallback(
    (folderEntry: Pick<FileNode, 'name' | 'path'>, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      showFolderMenu(folderEntry, rect.left, rect.bottom + 4, folderOverride);
    },
    [folder, showFolderMenu]
  );

  return {
    showFileMenu,
    showFolderMenu,
    getFileContextMenuHandler,
    getFileMoreClickHandler,
    getFolderContextMenuHandler,
    getFolderMoreClickHandler,
  };
}
