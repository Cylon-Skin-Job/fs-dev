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
  hasReceivedInit: boolean;
  homePath: string;

  // UI flags
  isSwitcherOpen: boolean;
  isAddModalOpen: boolean;

  // Setters
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setHomePath: (p: string) => void;
  markInit: () => void;
  openSwitcher: () => void;
  closeSwitcher: () => void;
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
  hasReceivedInit: false,
  homePath: '/',
  isSwitcherOpen: false,
  isAddModalOpen: false,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setHomePath: (p) => set({ homePath: p }),
  markInit: () => set({ hasReceivedInit: true }),
  openSwitcher: () => set({ isSwitcherOpen: true }),
  closeSwitcher: () => set({ isSwitcherOpen: false }),
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
