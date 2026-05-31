/**
 * @module bookmarks-handlers
 * @role Handle incoming bookmarks:* WebSocket messages
 */

import { useBookmarksStore } from '../../state/bookmarksStore';
import type { WebSocketMessage } from '../../types';

export function handleBookmarksMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'bookmarks:list':
    case 'bookmarks:updated': {
      const m = msg as any;
      if (m.items && Array.isArray(m.items)) {
        useBookmarksStore.getState().setBookmarks(m.items);
      }
      return true;
    }

    default:
      return false;
  }
}
