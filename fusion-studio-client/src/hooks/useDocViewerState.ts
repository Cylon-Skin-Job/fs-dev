/**
 * @module useDocViewerState
 * @role Controller hook for the doc-viewer panel
 *
 * Owns mode, selected file, and scroll persistence for the doc-viewer view.
 * Active and archive modes each keep their own selected file and scroll state.
 * Reads from / writes to the workspace view-state layer.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useFileDataStore } from '../state/fileDataStore';
import { showToast } from '../lib/toast';
import type { FileWithContent } from '../components/tile-row/TileRow';
import type { ViewUIState } from '../types';

export type DocViewerMode = 'active' | 'archive';

export interface DocViewerSelection {
  file: FileWithContent;
  siblings: FileWithContent[];
  folder: string;
}

export interface UseDocViewerStateResult {
  mode: DocViewerMode;
  selected: DocViewerSelection | null;
  gridScroll: number;
  docScroll: number;
  setMode: (mode: DocViewerMode) => void;
  selectFile: (folder: string, file: FileWithContent) => void;
  selectSibling: (sib: FileWithContent) => void;
  clearSelection: () => void;
  restoreSelectedFile: () => void;
  archiveSelectedFile: () => void;
  persistGridScroll: (scrollTop: number) => void;
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
  const state = usePanelStore.getState();
  state.setViewState('doc-viewer', patch);
  state._persistViewPatch('doc-viewer', patch);
}

export function useDocViewerState(): UseDocViewerStateResult {
  const mode = usePanelStore((s) => s.viewStates['doc-viewer']?.docViewerMode ?? 'active');
  const selectedPath = usePanelStore((s) => {
    const vs = s.viewStates['doc-viewer'];
    return mode === 'archive' ? (vs?.docViewerArchiveSelectedPath ?? null) : (vs?.docViewerActiveSelectedPath ?? null);
  });
  const gridScroll = usePanelStore((s) => {
    const vs = s.viewStates['doc-viewer'];
    return mode === 'archive' ? (vs?.docViewerArchiveGridScroll ?? 0) : (vs?.docViewerActiveGridScroll ?? 0);
  });
  const docScroll = usePanelStore((s) => {
    const vs = s.viewStates['doc-viewer'];
    return mode === 'archive' ? (vs?.docViewerArchiveDocScroll ?? 0) : (vs?.docViewerActiveDocScroll ?? 0);
  });

  const parsedPath = useMemo(
    () => (selectedPath ? parseSelectedPath(selectedPath) : null),
    [selectedPath]
  );

  const tree = useFileDataStore((s) =>
    parsedPath ? s.trees[`doc-viewer:${parsedPath.folder}`] : undefined
  );
  const content = useFileDataStore((s) =>
    selectedPath ? s.contents[`doc-viewer:${selectedPath}`] : undefined
  );

  useEffect(() => {
    if (!parsedPath || !selectedPath) return;
    const store = useFileDataStore.getState();
    store.requestTree('doc-viewer', parsedPath.folder);
    store.requestContent('doc-viewer', selectedPath);
  }, [parsedPath, selectedPath]);

  const selected: DocViewerSelection | null = useMemo(() => {
    if (!parsedPath || !selectedPath || !tree || content === undefined) return null;
    const fileNode = tree.find((n) => n.type === 'file' && n.name === parsedPath.name);
    if (!fileNode) return null;
    const siblings = tree
      .filter((n) => n.type === 'file')
      .map((n) => ({ ...n, content: n.name === parsedPath.name ? content : '' }) as FileWithContent);
    return { file: { ...fileNode, content }, siblings, folder: parsedPath.folder };
  }, [parsedPath, selectedPath, tree, content]);

  const setMode = useCallback((nextMode: DocViewerMode) => {
    persistViewPatch({ docViewerMode: nextMode });
  }, []);

  const selectFile = useCallback((folder: string, file: FileWithContent) => {
    persistViewPatch({ [selectedPathKey(mode)]: `${folder}/${file.name}` } as Partial<ViewUIState>);
  }, [mode]);

  const selectSibling = useCallback((sib: FileWithContent) => {
    if (!selected) return;
    persistViewPatch({ [selectedPathKey(mode)]: `${selected.folder}/${sib.name}` } as Partial<ViewUIState>);
  }, [selected, mode]);

  const clearSelection = useCallback(() => {
    persistViewPatch({ [selectedPathKey(mode)]: null } as Partial<ViewUIState>);
  }, [mode]);

  const gridScrollThrottleRef = useRef<number>(0);
  const persistGridScroll = useCallback((scrollTop: number) => {
    const now = Date.now();
    if (now - gridScrollThrottleRef.current < 100) return;
    gridScrollThrottleRef.current = now;
    persistViewPatch({ [gridScrollKey(mode)]: scrollTop } as Partial<ViewUIState>);
  }, [mode]);

  const docScrollThrottleRef = useRef<number>(0);
  const persistDocScroll = useCallback((scrollTop: number) => {
    const now = Date.now();
    if (now - docScrollThrottleRef.current < 100) return;
    docScrollThrottleRef.current = now;
    persistViewPatch({ [docScrollKey(mode)]: scrollTop } as Partial<ViewUIState>);
  }, [mode]);

  const restoreSelectedFile = useCallback(() => {
    if (!selected) return;
    const state = usePanelStore.getState();
    const panelRoot = state.panelRoots['doc-viewer'];
    const ws = state.ws;
    if (!panelRoot) {
      showToast('Cannot restore: doc-viewer root not loaded');
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Cannot restore: not connected');
      return;
    }
    const activeFolder = selected.folder.replace(/\/Archive$/, '');
    const source = `${panelRoot}/${selected.folder}/${selected.file.name}`;
    const target = `${panelRoot}/${activeFolder}`;
    ws.send(JSON.stringify({ type: 'file:move', source, target }));
    persistViewPatch({
      docViewerArchiveSelectedPath: null,
    });
    showToast('Restored to active folder');
  }, [selected]);

  const archiveSelectedFile = useCallback(() => {
    if (!selected) return;
    const state = usePanelStore.getState();
    const panelRoot = state.panelRoots['doc-viewer'];
    const ws = state.ws;
    if (!panelRoot) {
      showToast('Cannot archive: doc-viewer root not loaded');
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Cannot archive: not connected');
      return;
    }
    const archiveFolder = `${selected.folder}/Archive`;
    const source = `${panelRoot}/${selected.folder}/${selected.file.name}`;
    const target = `${panelRoot}/${archiveFolder}`;
    ws.send(JSON.stringify({ type: 'file:move', source, target }));
    persistViewPatch({
      docViewerActiveSelectedPath: null,
    });
    showToast('Archived');
  }, [selected]);

  return {
    mode,
    selected,
    gridScroll,
    docScroll,
    setMode,
    selectFile,
    selectSibling,
    clearSelection,
    restoreSelectedFile,
    archiveSelectedFile,
    persistGridScroll,
    persistDocScroll,
  };
}
