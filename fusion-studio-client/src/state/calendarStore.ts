import { create } from 'zustand';
import type { Calendar, CalendarEvent, EventFormData } from '../types/calendar';

interface CalendarState {
  calendars: Calendar[];
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  selectedDate: Date;
  visibleRangeStart: Date;
  visibleRangeEnd: Date;
  permissionDenied: boolean;

  fetchCalendars: () => Promise<void>;
  fetchEvents: (start: Date, end: Date) => Promise<void>;
  createEvent: (data: EventFormData) => Promise<void>;
  updateEvent: (uid: string, data: EventFormData) => Promise<void>;
  deleteEvent: (uid: string) => Promise<void>;
  setSelectedDate: (date: Date) => void;
  toggleCalendarEnabled: (id: string) => void;
  refresh: () => Promise<void>;
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

interface CalendarApiRow {
  uuid: string;
  title: string;
  color?: string;
  source?: string;
}

interface CalendarEventApiRow {
  uuid: string;
  title?: string;
  startDate: number;
  endDate: number;
  allDay?: number | boolean;
  calendarUuid: string;
  description?: string;
}

function apiCalToStore(row: CalendarApiRow): Calendar {
  return {
    id: row.uuid,
    name: row.title,
    color: row.color || '#888888',
    account: row.source || '',
    enabled: true,
  };
}

function apiEventToStore(row: CalendarEventApiRow): CalendarEvent {
  return {
    uid: row.uuid,
    title: row.title || '(no title)',
    startDate: new Date(row.startDate * 1000).toISOString(),
    endDate: new Date(row.endDate * 1000).toISOString(),
    allDay: row.allDay === 1 || row.allDay === true,
    calendarId: row.calendarUuid,
    notes: row.description || undefined,
  };
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendars: [],
  events: [],
  loading: false,
  error: null,
  selectedDate: new Date(),
  visibleRangeStart: new Date(),
  visibleRangeEnd: new Date(),
  permissionDenied: false,

  fetchCalendars: async () => {
    try {
      const res = await fetch('/api/calendar/calendars');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ calendars: data.map(apiCalToStore), error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[calendarStore] fetchCalendars failed:', msg);
      set({ error: msg });
    }
  },

  fetchEvents: async (start, end) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({
        start: String(Math.floor(start.getTime() / 1000)),
        end: String(Math.floor(end.getTime() / 1000)),
      });
      const res = await fetch(`/api/calendar/events?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({
        events: data.map(apiEventToStore),
        visibleRangeStart: start,
        visibleRangeEnd: end,
        loading: false,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[calendarStore] fetchEvents failed:', msg);
      set({ loading: false, error: msg });
    }
  },

  createEvent: async () => {
    console.warn('[calendarStore] createEvent disabled — write-back deferred');
  },

  updateEvent: async () => {
    console.warn('[calendarStore] updateEvent disabled — write-back deferred');
  },

  deleteEvent: async () => {
    console.warn('[calendarStore] deleteEvent disabled — write-back deferred');
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    const { start, end } = getMonthRange(date);
    get().fetchEvents(start, end);
  },

  toggleCalendarEnabled: (id) =>
    set((state) => ({
      calendars: state.calendars.map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      ),
    })),

  refresh: async () => {
    const { visibleRangeStart, visibleRangeEnd } = get();
    await get().fetchEvents(visibleRangeStart, visibleRangeEnd);
  },
}));
