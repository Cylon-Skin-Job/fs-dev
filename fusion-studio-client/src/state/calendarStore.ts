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
  demoMode: boolean;

  fetchCalendars: () => Promise<void>;
  fetchEvents: (start: Date, end: Date) => Promise<void>;
  createEvent: (data: EventFormData) => Promise<void>;
  updateEvent: (uid: string, data: EventFormData) => Promise<void>;
  deleteEvent: (uid: string) => Promise<void>;
  setSelectedDate: (date: Date) => void;
  toggleCalendarEnabled: (id: string) => void;
  refresh: () => Promise<void>;
  loadDemoData: () => void;
}

function demoDate(dayOffset: number, hour = 0, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildDemoCalendars(): Calendar[] {
  return [
    { id: 'demo:personal', name: 'Personal', color: '#63DA38', account: 'demo', enabled: true },
    { id: 'demo:work', name: 'Work', color: '#0A84FF', account: 'demo', enabled: true },
    { id: 'demo:family', name: 'Family', color: '#FF9500', account: 'demo', enabled: true },
    { id: 'demo:holidays', name: 'Holidays', color: '#CC73E1', account: 'demo', enabled: true },
  ];
}

function buildDemoEvents(): CalendarEvent[] {
  return [
    {
      uid: 'demo:1', title: 'Team standup', allDay: false, calendarId: 'demo:work',
      startDate: demoDate(0, 9, 0).toISOString(), endDate: demoDate(0, 9, 30).toISOString(),
    },
    {
      uid: 'demo:2', title: 'Dentist appointment', allDay: false, calendarId: 'demo:personal',
      startDate: demoDate(2, 14, 0).toISOString(), endDate: demoDate(2, 15, 0).toISOString(),
    },
    {
      uid: 'demo:3', title: 'Product offsite', allDay: false, calendarId: 'demo:work',
      startDate: demoDate(5, 9, 0).toISOString(), endDate: demoDate(7, 17, 0).toISOString(),
    },
    {
      uid: 'demo:4', title: "Mom's birthday", allDay: true, calendarId: 'demo:family',
      startDate: demoDate(9, 0, 0).toISOString(), endDate: demoDate(10, 0, 0).toISOString(),
    },
    {
      uid: 'demo:5', title: 'Grocery run', allDay: false, calendarId: 'demo:personal',
      startDate: demoDate(-3, 18, 0).toISOString(), endDate: demoDate(-3, 19, 0).toISOString(),
    },
    {
      uid: 'demo:6', title: 'Quarterly review', allDay: false, calendarId: 'demo:work',
      startDate: demoDate(-6, 13, 0).toISOString(), endDate: demoDate(-6, 14, 30).toISOString(),
    },
    {
      uid: 'demo:7', title: 'National Holiday', allDay: true, calendarId: 'demo:holidays',
      startDate: demoDate(14, 0, 0).toISOString(), endDate: demoDate(15, 0, 0).toISOString(),
    },
    {
      uid: 'demo:8', title: 'Family weekend trip', allDay: false, calendarId: 'demo:family',
      startDate: demoDate(20, 8, 0).toISOString(), endDate: demoDate(22, 20, 0).toISOString(),
    },
    {
      uid: 'demo:9', title: '1:1 with manager', allDay: false, calendarId: 'demo:work',
      startDate: demoDate(-15, 11, 0).toISOString(), endDate: demoDate(-15, 11, 30).toISOString(),
    },
  ];
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
  demoMode: false,

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
    if (get().demoMode) return;
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

  loadDemoData: () => {
    set({
      calendars: buildDemoCalendars(),
      events: buildDemoEvents(),
      demoMode: true,
      loading: false,
      error: null,
    });
  },
}));
