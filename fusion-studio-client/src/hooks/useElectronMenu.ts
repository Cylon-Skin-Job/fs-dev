import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';

/**
 * Listens for menu actions from the Electron main process
 * and dispatches them to the appropriate store.
 */
export function useElectronMenu() {
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onMenuAction) return;

    const unsubscribe = api.onMenuAction((payload: { type: string }) => {
      switch (payload.type) {
        case 'open-theme-picker': {
          usePanelStore.getState().setThemePickerOpen(true);
          break;
        }
        case 'open-secrets-manager': {
          usePanelStore.getState().setSecretsManagerOpen(true);
          break;
        }
      }
    });

    return unsubscribe;
  }, []);
}
