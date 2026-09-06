/**
 * @module file-tree
 * @role File Viewer presentation-to-central-store request adapter
 *
 * No response listener or private cache lives here. The central file-data
 * store owns requests, correlation, responses, cache, and errors.
 */

import { useFileDataStore } from '../state/fileDataStore';
import { useFileStore } from '../state/fileStore';
import type { FileInfo } from '../types/file-explorer';
import { isFileEditorTab } from '../types/file-explorer';
import type { ViewActivityState } from '../types';

export function loadRootTree(force = true): string | null {
  const fileData = useFileDataStore.getState();
  fileData.clearFileViewerErrors();
  return fileData.requestTree('file-viewer', '', {
    force,
    includeHiddenFolders: useFileStore.getState().showHiddenFolders,
  });
}

export function loadFolderChildren(folderPath: string, force = false): string | null {
  return useFileDataStore.getState().requestTree('file-viewer', folderPath, {
    force,
    includeHiddenFolders: useFileStore.getState().showHiddenFolders,
  });
}

export function loadExpandedFolders(force = false): void {
  for (const path of useFileStore.getState().expandedFolders) {
    loadFolderChildren(path, force);
  }
}

export function loadFileContent(file: FileInfo) {
  useFileStore.getState().openFileTab(file);
  useFileDataStore.getState().requestContent('file-viewer', file.path);
}

/** Hydrate presentation first, then register only its authoritative tab paths. */
export function hydrateFileViewerActivity(activity: ViewActivityState): void {
  useFileStore.getState().hydrateTabsFromActivity(activity);
  for (const tab of useFileStore.getState().tabs) {
    if (isFileEditorTab(tab)) {
      useFileDataStore.getState().requestContent('file-viewer', tab.file.path);
    }
  }
}
