/**
 * calendar-handlers — handle calendar WebSocket messages.
 * Mirrors workspace-handlers pattern: boolean-returning, switch on msg.type.
 */

import { useCalendarStore } from '../../state/calendarStore';
import type { WebSocketMessage } from '../../types';

export function handleCalendarMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'calendar:sync_complete': {
      const store = useCalendarStore.getState();
      store.fetchEvents(store.visibleRangeStart, store.visibleRangeEnd);
      return true;
    }
    default:
      return false;
  }
}
