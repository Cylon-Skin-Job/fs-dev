import React from 'react';
import { EventBar, type EventBarProps } from './EventBar';
import './CalendarViewer.css';

export interface CalendarDayCellEvent {
  uid: string;
  title: string;
  color: string;
  position: EventBarProps['position'];
}

export interface CalendarDayCellProps {
  day: number | null; // null = padding/blank cell
  isPadding: boolean; // true = darkened blank cell
  isOtherMonth: boolean; // true = belongs to prev/next month
  isToday: boolean;
  isLastDayOfMonth: boolean;
  events: CalendarDayCellEvent[];
  onClick?: () => void;
  onDoubleClick?: () => void;
  onEventClick?: (uid: string) => void;
}

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  day,
  isPadding,
  isOtherMonth,
  isToday,
  isLastDayOfMonth,
  events,
  onClick,
  onDoubleClick,
  onEventClick,
}) => {
  // If day is null and isPadding: render empty dark cell
  if (day === null && isPadding) {
    return <div className="rv-calendar-day rv-calendar-day--padding" />;
  }

  // If day is null but not padding: render empty cell
  if (day === null) {
    return <div className="rv-calendar-day" />;
  }

  const className = [
    'rv-calendar-day',
    isToday ? 'rv-calendar-day--today' : '',
    isOtherMonth ? 'rv-calendar-day--other-month' : '',
    isLastDayOfMonth ? 'rv-calendar-day--last-day' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {!isOtherMonth && <div className="rv-calendar-day-number">{day}</div>}
      {events.map((evt) => (
        <EventBar
          key={evt.uid}
          title={evt.title}
          color={evt.color}
          position={evt.position}
          onClick={onEventClick ? () => onEventClick(evt.uid) : undefined}
        />
      ))}
    </div>
  );
};

export default CalendarDayCell;
