/**
 * @module officeThumbnailStore
 * @role Tracks saved Office thumbnail revisions so tiles retry sidecar images.
 */

import { create } from 'zustand';

interface OfficeThumbnailState {
  versions: Record<string, number>;
  markUpdated: (documentPath: string, version?: number) => void;
}

function normalizeDocumentPath(documentPath: string): string {
  return documentPath.split('/').filter(Boolean).join('/');
}

export const useOfficeThumbnailStore = create<OfficeThumbnailState>((set) => ({
  versions: {},
  markUpdated: (documentPath, version = Date.now()) => {
    const key = normalizeDocumentPath(documentPath);
    if (!key) return;
    set((state) => ({
      versions: {
        ...state.versions,
        [key]: version,
      },
    }));
  },
}));

export function markOfficeThumbnailUpdated(documentPath: string, version?: number) {
  useOfficeThumbnailStore.getState().markUpdated(documentPath, version);
}
