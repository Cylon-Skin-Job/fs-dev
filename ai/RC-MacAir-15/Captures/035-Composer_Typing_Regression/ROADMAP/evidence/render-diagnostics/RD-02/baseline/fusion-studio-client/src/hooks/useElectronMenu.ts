import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { sendFusionMessage } from '../lib/ws-client';
import type { ElectronMenuAction, WorkspaceMenuState } from '../types/electron';

/**
 * Listens for menu actions from the Electron main process
 * and dispatches them to the appropriate store.
 */
export function useElectronMenu() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.setWorkspaceMenuState) return;

    const state: WorkspaceMenuState = {
      activeWorkspaceId,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        label: workspace.label,
        ribbonVisible: workspace.ribbonVisible !== false,
        ribbonSortOrder: workspace.ribbonSortOrder ?? null,
        sortOrder: workspace.sortOrder,
      })),
    };

    api.setWorkspaceMenuState(state);
  }, [activeWorkspaceId, workspaces]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onMenuAction) return;

    const unsubscribe = api.onMenuAction((payload: ElectronMenuAction) => {
      switch (payload.type) {
        case 'open-theme-picker': {
          usePanelStore.getState().setThemePickerOpen(true);
          break;
        }
        case 'open-secrets-manager': {
          usePanelStore.getState().setSecretsManagerOpen(true);
          break;
        }
        case 'sync-apple-calendar': {
          console.log('[Menu] Sync Apple Calendar triggered');
          sendFusionMessage({ type: 'calendar:force_sync', source: 'apple' });
          break;
        }
        case 'toggle-connector-mail': {
          usePanelStore.getState().toggleConnector('mail');
          break;
        }
        case 'toggle-connector-calendar': {
          usePanelStore.getState().toggleConnector('calendar');
          break;
        }
        case 'toggle-connector-notes': {
          usePanelStore.getState().toggleConnector('notes');
          break;
        }
        case 'toggle-connector-reminders': {
          usePanelStore.getState().toggleConnector('reminders');
          break;
        }
        case 'workspace-menu:show-ribbon': {
          useWorkspaceStore.getState().openRibbon();
          break;
        }
        case 'workspace-menu:add-project': {
          const store = useWorkspaceStore.getState();
          store.closeRibbon();
          store.openAddModal();
          break;
        }
        case 'workspace-menu:create-project': {
          const store = useWorkspaceStore.getState();
          store.closeRibbon();
          store.openCreateModal();
          break;
        }
        case 'workspace-menu:switch': {
          useWorkspaceStore.getState().requestSwitch(payload.workspaceId);
          break;
        }
        case 'workspace-menu:set-ribbon-visible': {
          const store = useWorkspaceStore.getState();
          if (payload.visible) {
            store.requestAddToRibbon(payload.workspaceId);
            store.requestSwitch(payload.workspaceId);
          } else {
            store.requestRemoveFromRibbon(payload.workspaceId);
          }
          break;
        }
      }
    });

    return unsubscribe;
  }, []);
}
