import { create } from 'zustand';
import type {
  OfficePaletteAvailability,
  OfficePaletteErrorCode,
  OfficePaletteOperation,
  OfficePaletteProtocolState,
  OfficePaletteSource,
  OfficePaletteSyncStatus,
} from '../types';

export const OFFICE_PALETTE_VISIBLE_LIMIT = 20;

export interface OfficePaletteStoreError {
  code: OfficePaletteErrorCode;
  message: string;
  operation: OfficePaletteOperation;
}

export interface OfficePaletteWorkspaceState {
  customColors: string[];
  syncEnabled: boolean;
  source: OfficePaletteSource | null;
  operation: OfficePaletteOperation | null;
  availability: OfficePaletteAvailability;
  syncStatus: OfficePaletteSyncStatus;
  error: OfficePaletteStoreError | null;
  isLoading: boolean;
}

interface OfficePaletteStoreState {
  activeWorkspaceId: string | null;
  byWorkspace: Record<string, OfficePaletteWorkspaceState>;
  setActiveWorkspace: (workspaceId: string | null) => void;
  beginRequest: (workspaceId: string) => void;
  cancelRequest: (workspaceId: string) => void;
  applyState: (
    workspaceId: string,
    state: OfficePaletteProtocolState,
    operation: OfficePaletteOperation,
  ) => void;
  applyError: (
    workspaceId: string,
    error: OfficePaletteStoreError,
    state?: OfficePaletteProtocolState,
  ) => void;
  reset: () => void;
}

function emptyWorkspaceState(): OfficePaletteWorkspaceState {
  return {
    customColors: [],
    syncEnabled: true,
    source: null,
    operation: null,
    availability: 'unavailable',
    syncStatus: 'degraded',
    error: null,
    isLoading: false,
  };
}

export function projectOfficePaletteColors(colors: readonly string[]): string[] {
  return colors.slice(0, OFFICE_PALETTE_VISIBLE_LIMIT);
}

export const useOfficePaletteStore = create<OfficePaletteStoreState>((set) => ({
  activeWorkspaceId: null,
  byWorkspace: {},

  setActiveWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),

  beginRequest: (workspaceId) => set((current) => ({
    byWorkspace: {
      ...current.byWorkspace,
      [workspaceId]: {
        ...(current.byWorkspace[workspaceId] ?? emptyWorkspaceState()),
        error: null,
        isLoading: true,
      },
    },
  })),

  cancelRequest: (workspaceId) => set((current) => {
    const previous = current.byWorkspace[workspaceId];
    if (!previous?.isLoading) return current;
    return {
      byWorkspace: {
        ...current.byWorkspace,
        [workspaceId]: { ...previous, isLoading: false },
      },
    };
  }),

  applyState: (workspaceId, state, operation) => set((current) => ({
    byWorkspace: {
      ...current.byWorkspace,
      [workspaceId]: {
        customColors: projectOfficePaletteColors(state.customColors),
        syncEnabled: state.syncEnabled,
        source: state.source,
        operation,
        availability: state.availability,
        syncStatus: state.syncStatus,
        error: null,
        isLoading: false,
      },
    },
  })),

  applyError: (workspaceId, error, state) => set((current) => {
    const previous = current.byWorkspace[workspaceId] ?? emptyWorkspaceState();
    return {
      byWorkspace: {
        ...current.byWorkspace,
        [workspaceId]: {
          ...previous,
          ...(state ? {
            customColors: projectOfficePaletteColors(state.customColors),
            syncEnabled: state.syncEnabled,
            source: state.source,
            availability: state.availability,
            syncStatus: state.syncStatus,
          } : {}),
          operation: error.operation,
          error,
          isLoading: false,
        },
      },
    };
  }),

  reset: () => set({ activeWorkspaceId: null, byWorkspace: {} }),
}));
