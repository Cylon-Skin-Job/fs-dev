import { create } from 'zustand';
import type { Workspace, WorkspaceCreateManifest } from '../types';
import { usePanelStore } from './panelStore';

/**
 * workspaceStore — multi-workspace registry and ribbon UI state.
 *
 * Lives alongside panelStore but is a higher level: panels exist
 * within a workspace. Reads the WebSocket from panelStore to avoid
 * duplicating the connection reference.
 *
 * See docs/WORKSPACE_CLIENT_UI_SPEC.md.
 */
interface WorkspaceStoreState {
  // Registry
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  workspaceType: 'code' | 'app';
  hasReceivedInit: boolean;
  homePath: string;

  // UI flags
  isRibbonOpen: boolean;
  isAddModalOpen: boolean;
  isCreateModalOpen: boolean;
  createManifest: WorkspaceCreateManifest | null;
  createError: string | null;
  isCreatingWorkspace: boolean;

  // Setters
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setWorkspaceType: (type: 'code' | 'app') => void;
  setHomePath: (p: string) => void;
  markInit: () => void;
  openRibbon: () => void;
  closeRibbon: () => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  setCreateManifest: (manifest: WorkspaceCreateManifest) => void;
  setCreateError: (message: string | null) => void;

  // Server request actions (WebSocket sends)
  requestAdd: (repoPath: string) => void;
  requestSwitch: (workspaceId: string) => void;
  requestRemove: (workspaceId: string) => void;
  requestRemoveFromRibbon: (workspaceId: string) => void;
  requestAddToRibbon: (workspaceId: string) => void;
  requestRibbonReorder: (workspaceIds: string[]) => void;
  requestCreateManifest: () => void;
  requestCreateWorkspace: (projectPath: string, label: string, viewIds: string[]) => void;

  // Canonical navigation — one source of truth for cycling and toggling
  cycleWorkspace: (direction: 'left' | 'right') => void;
  toggleRibbon: () => void;
}

function sendWorkspaceMessage(message: Record<string, unknown>): void {
  const ws = usePanelStore.getState().ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function toRibbonWorkspaces(workspaces: Workspace[]): Workspace[] {
  return workspaces
    .filter((workspace) => workspace.ribbonVisible !== false)
    .sort((a, b) => {
      const aOrder = a.ribbonSortOrder ?? a.sortOrder;
      const bOrder = b.ribbonSortOrder ?? b.sortOrder;
      return aOrder - bOrder;
    });
}

export function toHiddenRibbonWorkspaces(workspaces: Workspace[]): Workspace[] {
  return workspaces
    .filter((workspace) => workspace.ribbonVisible === false)
    .sort((a, b) => {
      const aOrder = a.ribbonSortOrder ?? a.sortOrder;
      const bOrder = b.ribbonSortOrder ?? b.sortOrder;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.label.localeCompare(b.label);
    });
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  workspaceType: 'code',
  hasReceivedInit: false,
  homePath: '/',
  isRibbonOpen: false,
  isAddModalOpen: false,
  isCreateModalOpen: false,
  createManifest: null,
  createError: null,
  isCreatingWorkspace: false,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setWorkspaceType: (type) => set({ workspaceType: type }),
  setHomePath: (p) => set({ homePath: p }),
  markInit: () => {
    console.log('[workspaceStore] markInit called (hasReceivedInit = true)');
    set({ hasReceivedInit: true });
  },
  openRibbon: () => set({ isRibbonOpen: true }),
  closeRibbon: () => set({ isRibbonOpen: false }),
  openAddModal: () => set({ isAddModalOpen: true }),
  closeAddModal: () => set({ isAddModalOpen: false }),
  openCreateModal: () => set({ isCreateModalOpen: true, createError: null }),
  closeCreateModal: () => set({ isCreateModalOpen: false, createError: null, isCreatingWorkspace: false }),
  setCreateManifest: (manifest) => set({ createManifest: manifest }),
  setCreateError: (message) => set({ createError: message, isCreatingWorkspace: false }),

  requestAdd: (repoPath) => {
    sendWorkspaceMessage({ type: 'workspace:add_requested', repoPath });
  },
  requestSwitch: (workspaceId) => {
    sendWorkspaceMessage({ type: 'workspace:switch_requested', workspaceId });
  },
  requestRemove: (workspaceId) => {
    sendWorkspaceMessage({ type: 'workspace:remove_requested', workspaceId });
  },
  requestRemoveFromRibbon: (workspaceId) => {
    sendWorkspaceMessage({ type: 'workspace:ribbon_remove_requested', workspaceId });
  },
  requestAddToRibbon: (workspaceId) => {
    sendWorkspaceMessage({ type: 'workspace:ribbon_add_requested', workspaceId });
  },
  requestRibbonReorder: (workspaceIds) => {
    sendWorkspaceMessage({ type: 'workspace:ribbon_reorder_requested', workspaceIds });
  },
  requestCreateManifest: () => {
    sendWorkspaceMessage({ type: 'workspace:create_manifest_requested' });
  },
  requestCreateWorkspace: (projectPath, label, viewIds) => {
    set({ createError: null, isCreatingWorkspace: true });
    sendWorkspaceMessage({ type: 'workspace:create_requested', projectPath, label, viewIds });
  },

  cycleWorkspace: (direction) => {
    const { workspaces, activeWorkspaceId } = get();
    const ribbonWorkspaces = toRibbonWorkspaces(workspaces);
    if (ribbonWorkspaces.length <= 1 || !activeWorkspaceId) return;

    const ids = ribbonWorkspaces.map((w) => w.id);
    const idx = ids.indexOf(activeWorkspaceId);
    if (idx < 0) return;

    const nextIdx =
      direction === 'right'
        ? (idx + 1) % ids.length
        : (idx - 1 + ids.length) % ids.length;

    get().requestSwitch(ids[nextIdx]);
  },

  toggleRibbon: () => {
    const { isRibbonOpen } = get();
    set({ isRibbonOpen: !isRibbonOpen });
  },
}));
