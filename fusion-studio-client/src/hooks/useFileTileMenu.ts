/**
 * @module useFileTileMenu
 * @role Shared context-menu controller for viewer file and folder tiles
 *
 * Keeps Pin / Star / Rename / Archive / Delete menu composition out of view
 * components.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { openMenuTree } from '../components/menu';
import type { MenuAnchor, MenuDescriptor, MenuHandle } from '../components/menu';
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
  const menuRef = useRef<MenuHandle | null>(null);

  useEffect(() => {
    return () => {
      menuRef.current?.close('programmatic');
      menuRef.current = null;
    };
  }, []);

  const focusInvocationTarget = useCallback((target: HTMLElement) => {
    if (!target.isConnected) return;
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }, []);

  const openActionMenu = useCallback((
    anchor: MenuAnchor,
    invocationTarget: HTMLElement,
    ariaLabel: string,
    items: readonly MenuDescriptor[],
  ) => {
    menuRef.current?.close('replaced');
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor,
      items,
      ariaLabel,
      minWidth: 160,
      restoreInvocationFocus: () => focusInvocationTarget(invocationTarget),
      focusAfterAction: () => focusInvocationTarget(invocationTarget),
      onClose: () => {
        if (menuRef.current === handle) menuRef.current = null;
      },
    });
    menuRef.current = handle;
  }, [focusInvocationTarget]);

  const showFileMenu = useCallback(
    (
      file: FileWithContent,
      anchor: MenuAnchor,
      invocationTarget: HTMLElement,
      folderOverride = folder,
    ) => {
      const filePath = file.path || [folderOverride, file.name].filter(Boolean).join('/');
      const isStarred = isViewStarred(panel, panel, filePath);
      openActionMenu(
        anchor,
        invocationTarget,
        `Actions for ${file.name}`,
        [
          {
            kind: 'action',
            id: 'file-toggle-star',
            label: isStarred ? 'Unstar' : 'Star',
            icon: 'kid_star',
            onSelect: () => {
              toggleViewStarred(panel, {
                panel,
                path: filePath,
                title: file.name,
                kind: 'document',
                folder: folderOverride,
                extension: file.extension ?? file.name.split('.').pop()?.toLowerCase(),
              });
              return { kind: 'close-all' };
            },
          },
          {
            kind: 'action',
            id: 'file-rename',
            label: 'Rename',
            icon: 'drive_file_rename',
            onSelect: () => {
              renameFile(file, folderOverride);
              return { kind: 'close-all' };
            },
          },
          {
            kind: 'action',
            id: 'file-archive-restore',
            label: isArchiveEntry(file, folderOverride) ? 'Restore' : 'Archive',
            icon: isArchiveEntry(file, folderOverride) ? 'unarchive' : 'archive',
            onSelect: () => {
              archiveOrRestoreFile(file, folderOverride);
              return { kind: 'close-all' };
            },
          },
          {
            kind: 'action',
            id: 'file-delete',
            label: 'Delete',
            icon: 'delete',
            tone: 'destructive',
            onSelect: () => {
              deleteFile(file, folderOverride);
              return { kind: 'close-all' };
            },
          },
        ],
      );
    },
    [archiveOrRestoreFile, deleteFile, folder, isArchiveEntry, openActionMenu, panel, renameFile]
  );

  const showFolderMenu = useCallback(
    (
      folderEntry: Pick<FileNode, 'name' | 'path'>,
      anchor: MenuAnchor,
      invocationTarget: HTMLElement,
      folderOverride = folder,
    ) => {
      const entry = { ...folderEntry, type: 'folder' as const };
      const isPinned = isViewPinnedFolder(panel, panel, entry.path);
      openActionMenu(
        anchor,
        invocationTarget,
        `Actions for ${entry.name}`,
        [
          {
            kind: 'action',
            id: 'folder-toggle-pin',
            label: isPinned ? 'Unpin folder' : 'Pin folder',
            icon: 'push_pin',
            onSelect: () => {
              toggleViewPinnedFolder(panel, {
                panel,
                path: entry.path,
                title: entry.name,
                kind: 'folder',
              });
              return { kind: 'close-all' };
            },
          },
          {
            kind: 'action',
            id: 'folder-rename',
            label: 'Rename',
            icon: 'drive_file_rename',
            onSelect: () => {
              renameFile(entry, folderOverride);
              return { kind: 'close-all' };
            },
          },
          {
            kind: 'action',
            id: 'folder-archive-restore',
            label: isArchiveEntry(entry, folderOverride) ? 'Restore' : 'Archive',
            icon: isArchiveEntry(entry, folderOverride) ? 'unarchive' : 'archive',
            onSelect: () => {
              archiveOrRestoreFile(entry, folderOverride);
              return { kind: 'close-all' };
            },
          },
          {
            kind: 'action',
            id: 'folder-delete',
            label: 'Delete',
            icon: 'delete',
            tone: 'destructive',
            onSelect: () => {
              deleteFile(entry, folderOverride);
              return { kind: 'close-all' };
            },
          },
        ],
      );
    },
    [archiveOrRestoreFile, deleteFile, folder, isArchiveEntry, openActionMenu, panel, renameFile]
  );

  const getFileContextMenuHandler = useCallback(
    (file: FileWithContent, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showFileMenu(
        file,
        { kind: 'pointer', clientX: event.clientX, clientY: event.clientY },
        event.currentTarget as HTMLElement,
        folderOverride,
      );
    },
    [folder, showFileMenu]
  );

  const getFileMoreClickHandler = useCallback(
    (file: FileWithContent, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showFileMenu(
        file,
        { kind: 'element', element: event.currentTarget, placement: 'below-start' },
        event.currentTarget as HTMLElement,
        folderOverride,
      );
    },
    [folder, showFileMenu]
  );

  const getFileStarClickHandler = useCallback(
    (file: FileWithContent, folderOverride = folder) => () => {
      const filePath = file.path || [folderOverride, file.name].filter(Boolean).join('/');
      toggleViewStarred(panel, {
        panel,
        path: filePath,
        title: file.name,
        kind: 'document',
        folder: folderOverride,
        extension: file.extension ?? file.name.split('.').pop()?.toLowerCase(),
      });
    },
    [folder, panel]
  );

  const getFolderContextMenuHandler = useCallback(
    (folderEntry: Pick<FileNode, 'name' | 'path'>, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showFolderMenu(
        folderEntry,
        { kind: 'pointer', clientX: event.clientX, clientY: event.clientY },
        event.currentTarget as HTMLElement,
        folderOverride,
      );
    },
    [folder, showFolderMenu]
  );

  const getFolderMoreClickHandler = useCallback(
    (folderEntry: Pick<FileNode, 'name' | 'path'>, folderOverride = folder) => (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showFolderMenu(
        folderEntry,
        { kind: 'element', element: event.currentTarget, placement: 'below-start' },
        event.currentTarget as HTMLElement,
        folderOverride,
      );
    },
    [folder, showFolderMenu]
  );

  return {
    showFileMenu,
    showFolderMenu,
    getFileContextMenuHandler,
    getFileMoreClickHandler,
    getFileStarClickHandler,
    getFolderContextMenuHandler,
    getFolderMoreClickHandler,
  };
}
