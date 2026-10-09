/**
 * @module theme-handlers
 * @role Handle incoming theme:* WebSocket messages.
 *
 * theme:state  → hydrateThemes + resetSharedStyles (hot-reload themes.css)
 * theme:error  → showToast
 *
 * See THEME_PICKER_SPEC.md §6b.
 */

import { usePanelStore } from '../../state/panelStore';
import { reloadThemesLayer } from '../../hooks/useSharedWorkspaceStyles';
import { showToast } from '../toast';
import type { ThemeEntry, WebSocketMessage } from '../../types';

interface ThemeStateMessage extends WebSocketMessage {
  type: 'theme:state';
  themes?: ThemeEntry[];
  activeId?: string | null;
}

interface ThemeErrorMessage extends WebSocketMessage {
  type: 'theme:error';
  message?: string;
}

export function handleThemeMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'theme:state': {
      const m = msg as ThemeStateMessage;
      const store = usePanelStore.getState();
      store.hydrateThemes(m.themes ?? [], m.activeId ?? null);
      // Targeted reload of just themes.css — avoids flashing chat/threads
      // (which would briefly lose components.css while the WS roundtrip
      // re-fetched it).
      const ws = store.ws;
      if (ws) reloadThemesLayer(ws);
      return true;
    }

    case 'theme:error': {
      const m = msg as ThemeErrorMessage;
      showToast(m.message ?? 'Theme error');
      return true;
    }

    default:
      return false;
  }
}
