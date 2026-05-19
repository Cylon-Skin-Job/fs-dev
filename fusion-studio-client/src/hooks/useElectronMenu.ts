import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import { sendFusionMessage } from '../lib/ws-client';

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
        case 'sync-apple-calendar': {
          console.log('[Menu] Sync Apple Calendar triggered');
          sendFusionMessage({ type: 'calendar:force_sync', source: 'apple' });
          break;
        }
      }
    });

    return unsubscribe;
  }, []);
}
