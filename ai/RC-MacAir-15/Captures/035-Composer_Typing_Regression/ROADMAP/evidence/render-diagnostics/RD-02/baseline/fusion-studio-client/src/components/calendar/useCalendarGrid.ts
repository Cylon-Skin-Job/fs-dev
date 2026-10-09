import { useMemo } from 'react';
import type { Calendar, CalendarEvent } from '../../types/calendar';

export type { Calendar, CalendarEvent };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridDayEvent {
  uid: string;
  title: string;
  color: string;
  position: 'start' | 'middle' | 'end' | 'single';
}

export interface GridDay {
  date: Date | null;
  dayNumber: number | null;
  isPadding: boolean; // true = darkened blank cell (end of month)
  isOtherMonth: boolean; // true = belongs to prev/next month (start padding)
  isToday: boolean;
  isLastDayOfMonth: boolean;
  events: GridDayEvent[];
}

export interface GridWeek {
  days: GridDay[];
  weekIndex: number;
}

export interface GridMonth {
  year: number;
  month: number; // 0-11
  monthName: string; // "April"
  monthLabel: string; // "Apr 2026"
  weeks: GridWeek[];
  isFirstMonth: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getEventColor(event: CalendarEvent, calendars: Calendar[]): string {
  const cal = calendars.find(
    (c) => c.id === event.calendarId || c.name === event.calendarId
  );
  return cal?.color || '#5EADF2';
}

function getEventPosition(event: CalendarEvent, dayDate: Date): 'start' | 'middle' | 'end' | 'single' {
  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);
  const effectiveEnd = event.allDay
    ? new Date(eventEnd.getTime() - 1)
    : eventEnd;

  const isStart = isSameDay(eventStart, dayDate);
  const isEnd = isSameDay(effectiveEnd, dayDate);

  if (isStart && isEnd) return 'single';
  if (isStart) return 'start';
  if (isEnd) return 'end';
  return 'middle';
}

// ---------------------------------------------------------------------------
// Single month grid generation
// ---------------------------------------------------------------------------

function generateMonthGrid(
  year: number,
  month: number,
  events: CalendarEvent[],
  calendars: Calendar[],
  isFirstMonth: boolean
): GridMonth {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Previous month padding
  const prevMonth = month - 1;
  const prevYear = prevMonth < 0 ? year - 1 : year;
  const prevMonthIndex = prevMonth < 0 ? 11 : prevMonth;
  const prevMonthDays = getDaysInMonth(prevYear, prevMonthIndex);

  const today = new Date();

  const days: GridDay[] = [];

  // Prev month padding (isOtherMonth = true)
  for (let i = 0; i < firstDayOfWeek; i++) {
    const dayNum = prevMonthDays - firstDayOfWeek + 1 + i;
    const date = new Date(prevYear, prevMonthIndex, dayNum);
    days.push({
      date,
      dayNumber: dayNum,
      isPadding: false,
      isOtherMonth: true,
      isToday: isSameDay(date, today),
      isLastDayOfMonth: false,
      events: [],
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Find overlapping events
    const dayEvents: GridDayEvent[] = [];
    for (const event of events) {
      const eventStart = startOfDay(new Date(event.startDate));
      const rawEnd = new Date(event.endDate);
      const eventEnd = event.allDay
        ? new Date(rawEnd.getTime() - 1)
        : endOfDay(rawEnd);

      const overlaps = eventStart <= dayEnd && eventEnd >= dayStart;
      if (overlaps) {
        dayEvents.push({
          uid: event.uid,
          title: event.title,
          color: getEventColor(event, calendars),
          position: getEventPosition(event, date),
        });
      }
    }

    days.push({
      date,
      dayNumber: d,
      isPadding: false,
      isOtherMonth: false,
      isToday: isSameDay(date, today),
      isLastDayOfMonth: d === daysInMonth,
      events: dayEvents,
    });
  }

  // Fill only enough trailing days to complete the final week
  const trailingDays = (7 - (days.length % 7)) % 7;
  const nextMonth = month + 1;
  const nextYear = nextMonth > 11 ? year + 1 : year;
  const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;

  for (let d = 1; d <= trailingDays; d++) {
    const date = new Date(nextYear, nextMonthIndex, d);
    days.push({
      date,
      dayNumber: d,
      isPadding: true,
      isOtherMonth: true,
      isToday: isSameDay(date, today),
      isLastDayOfMonth: false,
      events: [],
    });
  }

  // Group into weeks — only as many as needed
  const weeks: GridWeek[] = [];
  const numWeeks = days.length / 7;
  for (let w = 0; w < numWeeks; w++) {
    weeks.push({
      days: days.slice(w * 7, w * 7 + 7),
      weekIndex: w,
    });
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month],
    monthLabel: `${MONTH_NAMES[month]} ${year}`,
    weeks,
    isFirstMonth,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCalendarGrid(
  baseDate: Date,
  events: CalendarEvent[],
  calendars: Calendar[],
  startOffset: number = 0,
  endOffset: number = 1
): GridMonth[] {
  return useMemo(() => {
    const enabledLookup = new Set(
      calendars.filter((c) => c.enabled).flatMap((c) => [c.id, c.name])
    );
    const visibleEvents = events.filter((e) => enabledLookup.has(e.calendarId));

    const months: GridMonth[] = [];
    for (let offset = startOffset; offset <= endOffset; offset++) {
      const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
      months.push(
        generateMonthGrid(
          monthDate.getFullYear(),
          monthDate.getMonth(),
          visibleEvents,
          calendars,
          offset === startOffset
        )
      );
    }
    return months;
  }, [baseDate, events, calendars, startOffset, endOffset]);
}
