import { create } from 'zustand';
import type { Workspace } from '../types';
import { usePanelStore } from './panelStore';

/**
 * workspaceStore — multi-workspace registry and switcher UI state.
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
  isSwitcherOpen: boolean;
  isRibbonOpen: boolean;
  isAddModalOpen: boolean;

  // Setters
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setWorkspaceType: (type: 'code' | 'app') => void;
  setHomePath: (p: string) => void;
  markInit: () => void;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  openRibbon: () => void;
  closeRibbon: () => void;
  openAddModal: () => void;
  closeAddModal: () => void;

  // Server request actions (WebSocket sends)
  requestAdd: (repoPath: string) => void;
  requestSwitch: (workspaceId: string) => void;
  requestRemove: (workspaceId: string) => void;
}

function sendWorkspaceMessage(message: Record<string, unknown>): void {
  const ws = usePanelStore.getState().ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  workspaceType: 'code',
  hasReceivedInit: false,
  homePath: '/',
  isSwitcherOpen: false,
  isRibbonOpen: false,
  isAddModalOpen: false,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setWorkspaceType: (type) => set({ workspaceType: type }),
  setHomePath: (p) => set({ homePath: p }),
  markInit: () => set({ hasReceivedInit: true }),
  openSwitcher: () => set({ isSwitcherOpen: true }),
  closeSwitcher: () => set({ isSwitcherOpen: false }),
  openRibbon: () => set({ isRibbonOpen: true }),
  closeRibbon: () => set({ isRibbonOpen: false }),
  openAddModal: () => set({ isAddModalOpen: true }),
  closeAddModal: () => set({ isAddModalOpen: false }),

  requestAdd: (repoPath) => {
    sendWorkspaceMessage({ type: 'workspace:add_requested', repoPath });
  },
  requestSwitch: (workspaceId) => {
    sendWorkspaceMessage({ type: 'workspace:switch_requested', workspaceId });
  },
  requestRemove: (workspaceId) => {
    sendWorkspaceMessage({ type: 'workspace:remove_requested', workspaceId });
  },
}));
