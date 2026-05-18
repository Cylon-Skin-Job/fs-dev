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
  loadDemoData: () => void;
}

// Demo events for April 2026 (matching the screenshot)
const DEMO_EVENTS: CalendarEvent[] = [
  { uid: 'demo-1', title: 'Happy birthday!', startDate: '2026-04-01T07:00:00.000Z', endDate: '2026-04-01T07:00:00.000Z', allDay: true, calendarId: 'Family' },
  { uid: 'demo-2', title: "Me's birthday", startDate: '2026-04-01T07:00:00.000Z', endDate: '2026-04-01T07:00:00.000Z', allDay: true, calendarId: 'Family' },
  { uid: 'demo-3', title: "R.C. Curtright's birthday", startDate: '2026-04-01T07:00:00.000Z', endDate: '2026-04-01T07:00:00.000Z', allDay: true, calendarId: 'r.c.curtright@gmail.com' },
  { uid: 'demo-4', title: 'Wiles - $1140', startDate: '2026-04-01T07:00:00.000Z', endDate: '2026-04-01T07:00:00.000Z', allDay: true, calendarId: 'Job Scheduling' },
  { uid: 'demo-5', title: "El Pollo - $750", startDate: '2026-04-01T07:00:00.000Z', endDate: '2026-04-01T07:00:00.000Z', allDay: true, calendarId: 'Completed' },
  { uid: 'demo-6', title: 'Upper - $750', startDate: '2026-04-01T07:00:00.000Z', endDate: '2026-04-01T07:00:00.000Z', allDay: true, calendarId: 'Completed' },
  { uid: 'demo-7', title: "April Fools' Day", startDate: '2026-04-02T07:00:00.000Z', endDate: '2026-04-02T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-8', title: 'Passover', startDate: '2026-04-02T07:00:00.000Z', endDate: '2026-04-02T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-9', title: 'Rambler - $750', startDate: '2026-04-02T07:00:00.000Z', endDate: '2026-04-02T07:00:00.000Z', allDay: true, calendarId: 'Job Scheduling' },
  { uid: 'demo-10', title: 'Good Friday', startDate: '2026-04-04T07:00:00.000Z', endDate: '2026-04-04T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-11', title: 'Easter Sunday', startDate: '2026-04-06T07:00:00.000Z', endDate: '2026-04-06T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-12', title: 'Easter', startDate: '2026-04-06T07:00:00.000Z', endDate: '2026-04-06T07:00:00.000Z', allDay: true, calendarId: 'Family' },
  { uid: 'demo-13', title: 'Wiles OC', startDate: '2026-04-06T07:00:00.000Z', endDate: '2026-04-10T07:00:00.000Z', allDay: true, calendarId: 'Job Scheduling' },
  { uid: 'demo-14', title: 'Easter Monday', startDate: '2026-04-07T07:00:00.000Z', endDate: '2026-04-07T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-15', title: 'Bonanza - $750', startDate: '2026-04-07T07:00:00.000Z', endDate: '2026-04-07T07:00:00.000Z', allDay: true, calendarId: 'Completed' },
  { uid: 'demo-16', title: 'Orthodox Easter', startDate: '2026-04-13T07:00:00.000Z', endDate: '2026-04-13T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-17', title: 'Tax Day', startDate: '2026-04-16T07:00:00.000Z', endDate: '2026-04-16T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-18', title: 'Earth Day', startDate: '2026-04-23T07:00:00.000Z', endDate: '2026-04-23T07:00:00.000Z', allDay: true, calendarId: 'Holidays in United States' },
  { uid: 'demo-19', title: 'Mogul', startDate: '2026-04-24T07:00:00.000Z', endDate: '2026-04-24T07:00:00.000Z', allDay: true, calendarId: 'Job Scheduling' },
  { uid: 'demo-20', title: 'Mogul - $650', startDate: '2026-04-24T07:00:00.000Z', endDate: '2026-04-24T07:00:00.000Z', allDay: true, calendarId: 'Completed' },
  { uid: 'demo-21', title: 'Goodlife - $690', startDate: '2026-04-30T07:00:00.000Z', endDate: '2026-04-30T07:00:00.000Z', allDay: true, calendarId: 'Completed' },
];

const DEMO_CALENDARS: Calendar[] = [
  { id: 'Family', name: 'Family', color: '#FF9534', account: 'iCloud', enabled: true },
  { id: 'Holidays in United States', name: 'Holidays in United States', color: '#3AD180', account: 'iCloud', enabled: true },
  { id: 'r.c.curtright@gmail.com', name: 'r.c.curtright@gmail.com', color: '#AA83FF', account: 'Google', enabled: true },
  { id: 'Job Scheduling', name: 'Job Scheduling', color: '#5EADF2', account: 'Google', enabled: true },
  { id: 'Completed', name: 'Completed', color: '#63DA38', account: 'Google', enabled: true },
  { id: 'Due Dates', name: 'Due Dates', color: '#FC3C44', account: 'Google', enabled: true },
  { id: 'Follow Up', name: 'Follow Up', color: '#FFD60A', account: 'Google', enabled: true },
  { id: 'Scheduled Reminders', name: 'Scheduled Reminders', color: '#FB7DAF', account: 'Other', enabled: true },
  { id: 'Birthdays', name: 'Birthdays', color: '#A284F5', account: 'Other', enabled: true },
  { id: 'US Holidays', name: 'US Holidays', color: '#D4A574', account: 'Other', enabled: true },
  { id: 'Siri Suggestions', name: 'Siri Suggestions', color: '#5EADF2', account: 'Other', enabled: true },
];

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
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
    if (!window.electronAPI?.listCalendars) {
      console.log('[calendarStore] no electronAPI — loading demo data');
      get().loadDemoData();
      return;
    }
    try {
      const result = await window.electronAPI.listCalendars();
      console.log('[calendarStore] listCalendars result:', result);
      if (result.success && result.calendars && result.calendars.length > 0) {
        set({
          calendars: result.calendars.map((c) => ({ ...c, enabled: true })),
          permissionDenied: false,
          error: null,
        });
      } else {
        console.log('[calendarStore] calendars empty or error — loading demo data');
        get().loadDemoData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('[calendarStore] listCalendars threw:', msg);
      get().loadDemoData();
    }
  },

  fetchEvents: async (start, end) => {
    if (!window.electronAPI?.listEvents) {
      console.log('[calendarStore] no electronAPI — loading demo data');
      get().loadDemoData();
      return;
    }
    set({ loading: true, error: null });
    try {
      const result = await window.electronAPI.listEvents({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      console.log('[calendarStore] listEvents result:', result);
      if (result.success && result.events) {
        set({
          events: result.events.map((e) => ({ ...e, calendarId: e.calendar })),
          visibleRangeStart: start,
          visibleRangeEnd: end,
          loading: false,
          permissionDenied: false,
        });
      } else {
        console.log('[calendarStore] listEvents failed:', result.error);
        get().loadDemoData();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('[calendarStore] listEvents threw:', msg);
      get().loadDemoData();
    }
  },

  createEvent: async (data) => {
    if (!window.electronAPI?.createEvent) return;
    const calendar = get().calendars.find((c) => c.id === data.calendarId);
    if (!calendar) return;
    try {
      const result = await window.electronAPI.createEvent({
        calendarName: calendar.name,
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay,
        location: data.location,
        notes: data.notes,
      });
      if (result.success) {
        await get().refresh();
      } else {
        set({ error: result.error || 'Failed to create event' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  updateEvent: async (uid, data) => {
    if (!window.electronAPI?.updateEvent) return;
    const calendar = get().calendars.find((c) => c.id === data.calendarId);
    if (!calendar) return;
    try {
      const result = await window.electronAPI.updateEvent({
        uid,
        calendarName: calendar.name,
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay,
        location: data.location,
        notes: data.notes,
      });
      if (result.success) {
        await get().refresh();
      } else {
        set({ error: result.error || 'Failed to update event' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  deleteEvent: async (uid) => {
    if (!window.electronAPI?.deleteEvent) return;
    try {
      const result = await window.electronAPI.deleteEvent({ uid });
      if (result.success) {
        await get().refresh();
      } else {
        set({ error: result.error || 'Failed to delete event' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
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

  loadDemoData: () => {
    set({
      calendars: DEMO_CALENDARS,
      events: DEMO_EVENTS,
      loading: false,
      error: null,
      permissionDenied: false,
    });
  },
}));
