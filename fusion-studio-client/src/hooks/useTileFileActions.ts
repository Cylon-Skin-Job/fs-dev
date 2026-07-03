/**
 * @module useTileFileActions
 * @role Controller hook for tile-level file actions
 *
 * Orchestrates rename, archive/restore, and delete actions for files shown
 * in a tile row. Keeps presentation components free of WebSocket details.
 */

import { useCallback } from 'react';
import { usePanelStore } from '../state/panelStore';
import { showToast } from '../lib/toast';
import type { FileWithContent } from '../state/fileDataStore';

interface UseTileFileActionsOptions {
  panel: string;
  folder: string;
}

export function useTileFileActions({ panel, folder }: UseTileFileActionsOptions) {
  const isArchive = folder.includes('/Archive');

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
    return { panelRoot, ws };
  }, [panel]);

  const archiveOrRestoreFile = useCallback(
    (file: FileWithContent) => {
      const conn = getWs();
      if (!conn) return;
      const { panelRoot, ws } = conn;
      const source = `${panelRoot}/${folder}/${file.name}`;
      const target = isArchive
        ? `${panelRoot}/${folder.replace(/\/Archive$/, '')}`
        : `${panelRoot}/${folder}/Archive`;
      ws.send(JSON.stringify({ type: 'file:move', source, target }));
    },
    [folder, isArchive, getWs]
  );

  const renameFile = useCallback(
    (file: FileWithContent) => {
      const conn = getWs();
      if (!conn) return;
      const { panelRoot, ws } = conn;
      const source = `${panelRoot}/${folder}/${file.name}`;
      const newName = window.prompt('Rename file', file.name);
      if (!newName || newName === file.name) return;
      ws.send(JSON.stringify({ type: 'file:rename', source, newName }));
    },
    [folder, getWs]
  );

  const deleteFile = useCallback(
    (file: FileWithContent) => {
      const conn = getWs();
      if (!conn) return;
      const { panelRoot, ws } = conn;
      const source = `${panelRoot}/${folder}/${file.name}`;
      if (!window.confirm(`Delete ${file.name}?`)) return;
      ws.send(JSON.stringify({ type: 'file:delete', source }));
    },
    [folder, getWs]
  );

  return {
    isArchive,
    archiveOrRestoreFile,
    renameFile,
    deleteFile,
  };
}
