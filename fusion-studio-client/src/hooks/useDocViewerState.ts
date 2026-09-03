/**
 * @module useDocViewerState
 * @role Controller hook for the capture-viewer panel
 *
 * Owns mode, selected file, and scroll persistence for the capture-viewer view.
 * Active and archive modes each keep their own selected file and scroll state.
 * Reads from / writes to the workspace view-state layer.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useFileDataStore } from '../state/fileDataStore';
import { showToast } from '../lib/toast';
import type { FileWithContent } from '../components/tile-row/TileRow';
import type { ViewUIState } from '../types';
import { recordViewRecent } from '../lib/viewActivity';
import { DOC_VIEWER_ARCHIVE_FOLDER } from '../lib/viewFolders';
import { isImageFile } from '../components/tile-row/documentTileUtils';
import { updateCaptureTabUi } from '../components/view-tabs/captureTabsController';
import { nextWorkspaceRequestId } from '../lib/workspaceResponseTracker';

export { DOC_VIEWER_ARCHIVE_FOLDER } from '../lib/viewFolders';

const DOC_VIEWER_PANEL = 'capture-viewer';

export type DocViewerMode = 'active' | 'recent' | 'starred' | 'archive';

export interface DocViewerSelection {
  file: FileWithContent;
  siblings: FileWithContent[];
  folder: string;
}

export interface UseDocViewerStateResult {
  mode: DocViewerMode;
  selected: DocViewerSelection | null;
  lastOpenedPath: string | null;
  gridScroll: number;
  docScroll: number;
  setMode: (mode: DocViewerMode) => void;
  selectFile: (folder: string, file: FileWithContent) => void;
  selectSibling: (sib: FileWithContent) => void;
  clearSelection: () => void;
  restoreSelectedFile: () => void;
  archiveSelectedFile: () => void;
  persistGridScroll: (scrollTop: number) => void;
  resetGridScroll: (mode?: DocViewerMode) => void;
  persistDocScroll: (scrollTop: number) => void;
}

function selectedPathKey(mode: DocViewerMode): 'docViewerActiveSelectedPath' | 'docViewerArchiveSelectedPath' {
  return mode === 'archive' ? 'docViewerArchiveSelectedPath' : 'docViewerActiveSelectedPath';
}

function gridScrollKey(mode: DocViewerMode): 'docViewerActiveGridScroll' | 'docViewerArchiveGridScroll' {
  return mode === 'archive' ? 'docViewerArchiveGridScroll' : 'docViewerActiveGridScroll';
}

function docScrollKey(mode: DocViewerMode): 'docViewerActiveDocScroll' | 'docViewerArchiveDocScroll' {
  return mode === 'archive' ? 'docViewerArchiveDocScroll' : 'docViewerActiveDocScroll';
}

function parseSelectedPath(selectedPath: string): { folder: string; name: string } | null {
  const lastSlash = selectedPath.lastIndexOf('/');
  if (lastSlash === -1) return null;
  return {
    folder: selectedPath.slice(0, lastSlash),
    name: selectedPath.slice(lastSlash + 1),
  };
}

function persistViewPatch(patch: Partial<ViewUIState>) {
  if (updateCaptureTabUi(patch)) return;
  const state = usePanelStore.getState();
  state.setViewState(DOC_VIEWER_PANEL, patch);
  state._persistViewPatch(DOC_VIEWER_PANEL, patch);
}

function persistClassicScrollPatch(patch: Partial<ViewUIState>) {
  const state = usePanelStore.getState();
  state.setViewState(DOC_VIEWER_PANEL, patch);
  state._persistViewPatch(DOC_VIEWER_PANEL, patch);
}

export function useDocViewerState(): UseDocViewerStateResult {
  const fileDataGeneration = useFileDataStore((s) => s.generation);
  const mode = usePanelStore((s) => s.viewStates[DOC_VIEWER_PANEL]?.docViewerMode ?? 'active');
  const selectedPath = usePanelStore((s) => {
    const vs = s.viewStates[DOC_VIEWER_PANEL];
    return mode === 'archive' ? (vs?.docViewerArchiveSelectedPath ?? null) : (vs?.docViewerActiveSelectedPath ?? null);
  });
  const lastOpenedPath = usePanelStore(
    (s) => s.viewStates[DOC_VIEWER_PANEL]?.docViewerLastOpenedPath ?? null
  );
  const gridScroll = usePanelStore((s) => {
    const vs = s.viewStates[DOC_VIEWER_PANEL];
    return mode === 'archive' ? (vs?.docViewerArchiveGridScroll ?? 0) : (vs?.docViewerActiveGridScroll ?? 0);
  });
  const docScroll = usePanelStore((s) => {
    const vs = s.viewStates[DOC_VIEWER_PANEL];
    return mode === 'archive' ? (vs?.docViewerArchiveDocScroll ?? 0) : (vs?.docViewerActiveDocScroll ?? 0);
  });

  const parsedPath = useMemo(
    () => (selectedPath ? parseSelectedPath(selectedPath) : null),
    [selectedPath]
  );

  const tree = useFileDataStore((s) =>
    parsedPath ? s.trees[`${DOC_VIEWER_PANEL}:${parsedPath.folder}`] : undefined
  );
  const content = useFileDataStore((s) =>
    selectedPath ? s.contents[`${DOC_VIEWER_PANEL}:${selectedPath}`] : undefined
  );
  const contentMetadata = useFileDataStore((s) =>
    selectedPath ? s.contentMetadata[`${DOC_VIEWER_PANEL}:${selectedPath}`] : undefined
  );
  const contents = useFileDataStore((s) => s.contents);
  const contentMetadataByPath = useFileDataStore((s) => s.contentMetadata);

  useEffect(() => {
    if (!parsedPath || !selectedPath) return;
    const store = useFileDataStore.getState();
    store.requestTree(DOC_VIEWER_PANEL, parsedPath.folder);
    store.requestContent(DOC_VIEWER_PANEL, selectedPath);
  }, [fileDataGeneration, parsedPath, selectedPath]);

  useEffect(() => {
    if (!tree) return;
    const store = useFileDataStore.getState();
    for (const node of tree) {
      if (node.type !== 'file' || isImageFile(node.name)) continue;
      store.requestContent(DOC_VIEWER_PANEL, node.path);
    }
  }, [fileDataGeneration, tree]);

  const selected: DocViewerSelection | null = useMemo(() => {
    if (!parsedPath || !selectedPath || !tree || content === undefined) return null;
    const fileNode = tree.find((n) => n.type === 'file' && n.name === parsedPath.name);
    if (!fileNode) return null;
    const siblings = tree
      .filter((n) => n.type === 'file')
      .map((n) => {
        const key = `${DOC_VIEWER_PANEL}:${n.path}`;
        return {
          ...n,
          ...contentMetadataByPath[key],
          content: isImageFile(n.name) ? '' : (contents[key] ?? ''),
        } as FileWithContent;
      });
    return { file: { ...fileNode, ...contentMetadata, content }, siblings, folder: parsedPath.folder };
  }, [parsedPath, selectedPath, tree, content, contentMetadata, contents, contentMetadataByPath]);

  const setMode = useCallback((nextMode: DocViewerMode) => {
    persistViewPatch({
      docViewerMode: nextMode,
      [gridScrollKey(nextMode)]: 0,
    } as Partial<ViewUIState>);
  }, []);

  const selectFile = useCallback((folder: string, file: FileWithContent) => {
    const path = `${folder}/${file.name}`;
    persistViewPatch({
      [selectedPathKey(mode)]: path,
      docViewerLastOpenedPath: path,
    } as Partial<ViewUIState>);
    recordViewRecent(DOC_VIEWER_PANEL, {
      panel: DOC_VIEWER_PANEL,
      path: file.path,
      title: file.name,
      kind: 'document',
      folder,
      extension: file.extension ?? file.name.split('.').pop()?.toLowerCase(),
    });
  }, [mode]);

  const selectSibling = useCallback((sib: FileWithContent) => {
    if (!selected) return;
    const path = `${selected.folder}/${sib.name}`;
    persistViewPatch({
      [selectedPathKey(mode)]: path,
      docViewerLastOpenedPath: path,
    } as Partial<ViewUIState>);
    recordViewRecent(DOC_VIEWER_PANEL, {
      panel: DOC_VIEWER_PANEL,
      path: sib.path,
      title: sib.name,
      kind: 'document',
      folder: selected.folder,
      extension: sib.extension ?? sib.name.split('.').pop()?.toLowerCase(),
    });
  }, [selected, mode]);

  const clearSelection = useCallback(() => {
    persistViewPatch({ [selectedPathKey(mode)]: null } as Partial<ViewUIState>);
  }, [mode]);

  const gridScrollThrottleRef = useRef<number>(0);
  const persistGridScroll = useCallback((scrollTop: number) => {
    const patch = { [gridScrollKey(mode)]: scrollTop } as Partial<ViewUIState>;
    if (updateCaptureTabUi(patch, { throttled: true })) return;
    const now = Date.now();
    if (now - gridScrollThrottleRef.current < 100) return;
    gridScrollThrottleRef.current = now;
    persistClassicScrollPatch(patch);
  }, [mode]);

  const resetGridScroll = useCallback((targetMode: DocViewerMode = mode) => {
    gridScrollThrottleRef.current = 0;
    persistViewPatch({ [gridScrollKey(targetMode)]: 0 } as Partial<ViewUIState>);
  }, [mode]);

  const docScrollThrottleRef = useRef<number>(0);
  const persistDocScroll = useCallback((scrollTop: number) => {
    const patch = { [docScrollKey(mode)]: scrollTop } as Partial<ViewUIState>;
    if (updateCaptureTabUi(patch, { throttled: true })) return;
    const now = Date.now();
    if (now - docScrollThrottleRef.current < 100) return;
    docScrollThrottleRef.current = now;
    persistClassicScrollPatch(patch);
  }, [mode]);

  const restoreSelectedFile = useCallback(() => {
    if (!selected) return;
    showToast('Restore from the flat archive is not available');
  }, [selected]);

  const archiveSelectedFile = useCallback(() => {
    if (!selected) return;
    const state = usePanelStore.getState();
    const panelRoot = state.panelRoots[DOC_VIEWER_PANEL];
    const ws = state.ws;
    if (!panelRoot) {
      showToast('Cannot archive: capture-viewer root not loaded');
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Cannot archive: not connected');
      return;
    }
    const source = `${panelRoot}/${selected.folder}/${selected.file.name}`;
    const target = `${panelRoot}/${DOC_VIEWER_ARCHIVE_FOLDER}`;
    ws.send(JSON.stringify({
      type: 'file:move',
      source,
      target,
      requestId: nextWorkspaceRequestId('file:move', state.activeWorkspaceId),
    }));
    persistViewPatch({
      docViewerActiveSelectedPath: null,
    });
    showToast('Archived');
  }, [selected]);

  return {
    mode,
    selected,
    lastOpenedPath,
    gridScroll,
    docScroll,
    setMode,
    selectFile,
    selectSibling,
    clearSelection,
    restoreSelectedFile,
    archiveSelectedFile,
    persistGridScroll,
    resetGridScroll,
    persistDocScroll,
  };
}
