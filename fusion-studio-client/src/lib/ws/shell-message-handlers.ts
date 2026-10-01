/** Apply residual shell projections after ordered domain dispatch. */
import { usePanelStore } from '../../state/panelStore';
import { useSecretsStore } from '../../state/secretsStore';
import { showModal } from '../modal';
import { emitFusion } from './fusion-response-listeners';
import type { ModalConfig } from '../modal';
import type { ApiKeyIndexEntry, ApiKeysErrorCode } from '../../state/secretsStore';
import type { WebSocketMessage } from '../../types';

interface ApiKeysStateMessage extends WebSocketMessage {
  type: 'secrets:api-keys:state';
  items?: ApiKeyIndexEntry[];
}

interface ApiKeysErrorMessage extends WebSocketMessage {
  type: 'secrets:api-keys:error';
  code?: ApiKeysErrorCode;
  message?: string;
}

export function handleShellMessage(msg: WebSocketMessage): void {
  const store = usePanelStore.getState();

  switch (msg.type) {
    case 'connected':
      console.log('[WS] Session:', msg.sessionId);
      break;

    case 'modal:show':
      showModal(msg as unknown as ModalConfig);
      break;

    case 'panel_config': {
      break;
    }

    case 'panel_changed':
      // CLI_CONFIG_SPEC §7d: stash per-view overrides for render-time merge.
      if (msg.panel) {
        store.setCliConfigViewDelta(msg.panel, msg.cliConfigDelta ?? {});
      }
      break;

    // Fusion system panel responses
    case 'fusion:tabs':
    case 'fusion:items':
    case 'fusion:wiki':
      emitFusion(msg.type, msg);
      break;

    // Clipboard manager responses
    case 'clipboard:list':
    case 'clipboard:append':
    case 'clipboard:touch':
    case 'clipboard:use':
    case 'clipboard:delete':
    case 'clipboard:clear':
    case 'clipboard:state':
    case 'clipboard:error':
      emitFusion(msg.type, msg);
      break;

    case 'emoji_recents:list':
    case 'emoji_recents:record':
    case 'emoji_recents:error':
      emitFusion(msg.type, msg);
      break;

    case 'secrets:api-keys:state': {
      const m = msg as ApiKeysStateMessage;
      useSecretsStore.getState().setApiKeys(m.items ?? []);
      break;
    }

    case 'secrets:api-keys:error': {
      const m = msg as ApiKeysErrorMessage;
      useSecretsStore.getState().setApiKeysError({
        code: m.code ?? 'UNKNOWN',
        message: m.message ?? '',
      });
      break;
    }

    default:
      break;
  }
}
