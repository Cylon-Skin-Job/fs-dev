/**
 * @module file-tree
 * @role File Viewer presentation-to-central-store request adapter
 *
 * No response listener or private cache lives here. The central file-data
 * store owns requests, correlation, responses, cache, and errors.
 *
 * VIEW-02 Slice 4 (SPEC-02 §10, VRT-012): the PUBLIC file-open action routes
 * through the connected File owner's serialized TABS-03 lane when the shipped
 * tab policy is active; the legacy local match/fill/append (`openFileTab`)
 * is retired from this path and remains only for views whose tab policy is
 * not ready (exact legacy behavior) and for the store's own internal use.
 */

import { useFileDataStore } from '../state/fileDataStore';
import { useFileStore } from '../state/fileStore';
import type { FileInfo } from '../types/file-explorer';
import { isFileEditorTab } from '../types/file-explorer';
import type { ViewActivityState } from '../types';
import { isFileConnectedActive, openFileDocument } from '../components/view-tabs/fileConnectedTabs';

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
  // Connected adoption (TABS-03): current fills the active unreserved Empty
  // tab or appends; an exact match activates; a pending `file.open`
  // reservation prepares its exact destination first (VRT-011A).
  if (isFileConnectedActive() && openFileDocument({ file, disposition: 'current' })) return;
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
