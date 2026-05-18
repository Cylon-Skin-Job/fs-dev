/**
 * @module recent-docs-handlers
 * @role Handle incoming recent_docs:* WebSocket messages
 */

import { useRecentDocsStore } from '../../state/recentDocsStore';
import type { WebSocketMessage } from '../../types';

export function handleRecentDocsMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'recent_docs:list':
    case 'recent_docs:updated': {
      const m = msg as any;
      if (m.items && Array.isArray(m.items)) {
        useRecentDocsStore.getState().setRecentDocs(m.items);
      }
      return true;
    }

    case 'recent_docs:cleared': {
      useRecentDocsStore.getState().setRecentDocs([]);
      return true;
    }

    default:
      return false;
  }
}
