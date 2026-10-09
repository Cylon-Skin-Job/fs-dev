/**
 * @module bookmarks-handlers
 * @role Handle incoming bookmarks:* WebSocket messages
 */

import { useBookmarksStore, type Bookmark } from '../../state/bookmarksStore';
import type { WebSocketMessage } from '../../types';

interface BookmarksListMessage extends WebSocketMessage {
  type: 'bookmarks:list' | 'bookmarks:updated';
  items?: Bookmark[];
}

export function handleBookmarksMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'bookmarks:list':
    case 'bookmarks:updated': {
      const m = msg as BookmarksListMessage;
      if (m.items && Array.isArray(m.items)) {
        useBookmarksStore.getState().setBookmarks(m.items);
      }
      return true;
    }

    default:
      return false;
  }
}
