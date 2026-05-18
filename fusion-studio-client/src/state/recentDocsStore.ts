/**
 * @module recentDocsStore
 * @role Track recently opened office-viewer documents + 3s promotion delay
 *
 * Reads list from server. Writes record events (immediate or delayed).
 * Does NOT duplicate file content — previews come from fileDataStore.contents.
 */

import { create } from 'zustand';
import { sendFusionMessage } from '../lib/ws-client';

export interface RecentDoc {
  id: number;
  workspaceId: string;
  path: string;
  folder: string;
  name: string;
  panel: string;
  openedAt: number;
}

interface RecentDocsState {
  recentDocs: RecentDoc[];
  highlightedPath: string | null;

  setRecentDocs: (items: RecentDoc[]) => void;
  recordOpen: (doc: Pick<RecentDoc, 'workspaceId' | 'path' | 'folder' | 'name' | 'panel'>) => void;
  previewSelect: (path: string) => void;
  cancelPreviewSelect: () => void;
  loadRecentDocs: (workspaceId: string) => void;
}

export const useRecentDocsStore = create<RecentDocsState>((set, get) => {
  let promoteTimer: ReturnType<typeof setTimeout> | null = null;
  let promoteTarget: string | null = null;

  return {
    recentDocs: [],
    highlightedPath: null,

    setRecentDocs: (items) => set({ recentDocs: items }),

    recordOpen: ({ workspaceId, path, folder, name, panel }) => {
      sendFusionMessage({ type: 'recent_docs:record', workspaceId, panel, path, folder, name });
    },

    previewSelect: (path) => {
      set({ highlightedPath: path });
      if (promoteTimer) clearTimeout(promoteTimer);
      promoteTarget = path;
      promoteTimer = setTimeout(() => {
        if (promoteTarget === path) {
          const doc = get().recentDocs.find((d) => d.path === path);
          if (doc) {
            sendFusionMessage({
              type: 'recent_docs:record',
              workspaceId: doc.workspaceId,
              panel: doc.panel,
              path: doc.path,
              folder: doc.folder,
              name: doc.name,
            });
          }
          set({ highlightedPath: null });
          promoteTarget = null;
        }
      }, 3000);
    },

    cancelPreviewSelect: () => {
      if (promoteTimer) clearTimeout(promoteTimer);
      promoteTimer = null;
      promoteTarget = null;
      set({ highlightedPath: null });
    },

    loadRecentDocs: (workspaceId) => {
      sendFusionMessage({ type: 'recent_docs:list', workspaceId });
    },
  };
});
