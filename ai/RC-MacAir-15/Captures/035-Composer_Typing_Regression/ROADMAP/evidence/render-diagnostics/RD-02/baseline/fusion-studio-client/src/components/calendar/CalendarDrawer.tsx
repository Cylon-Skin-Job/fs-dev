import React from 'react';
import { CalendarListView, type CalendarItem } from './CalendarListView';
import { MiniCalendar } from './MiniCalendar';
import { ChecklistView } from './ChecklistView';
import { InboxView } from './InboxView';
import type { CalendarDrawerView } from './CalendarHeader';
import './CalendarViewer.css';

export interface CalendarDrawerProps {
  view: CalendarDrawerView;
  calendars: CalendarItem[];
  onCalendarToggle: (id: string) => void;
  selectedDate: Date;
  onMiniCalendarSelect: (date: Date) => void;
}

export const CalendarDrawer: React.FC<CalendarDrawerProps> = ({
  view,
  calendars,
  onCalendarToggle,
  selectedDate,
  onMiniCalendarSelect,
}) => {
  return (
    <div className="rv-calendar-drawer" data-open={view !== 'none'}>
      {view === 'calendarlist' && (
        <>
          <CalendarListView calendars={calendars} onToggle={onCalendarToggle} />
          <MiniCalendar selectedDate={selectedDate} onSelect={onMiniCalendarSelect} />
        </>
      )}
      {view === 'checklist' && <ChecklistView />}
      {view === 'inbox' && <InboxView />}
    </div>
  );
};

export default CalendarDrawer;
