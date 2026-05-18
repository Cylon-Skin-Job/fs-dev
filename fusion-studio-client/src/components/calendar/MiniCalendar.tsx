import React, { useMemo, useState } from 'react';
import './CalendarViewer.css';

export interface MiniCalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
}

const DAYS: string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES: string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  const now = new Date();
  return isSameDate(date, now);
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({ selectedDate, onSelect }) => {
  const [viewDate, setViewDate] = useState<Date>(selectedDate);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  const days = useMemo(() => {
    const result: { day: number; currentMonth: boolean }[] = [];

    // Padding days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      result.push({ day: prevMonthDays - i, currentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, currentMonth: true });
    }

    // Padding days to fill remaining grid (up to 6 rows = 42 cells)
    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      result.push({ day: d, currentMonth: false });
    }

    return result;
  }, [daysInMonth, firstDay, prevMonthDays]);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day: number, currentMonth: boolean) => {
    const targetMonth = currentMonth ? month : day > 20 ? month - 1 : month + 1;
    onSelect(new Date(year, targetMonth, day));
  };

  return (
    <div className="rv-calendar-mini">
      <div className="rv-calendar-mini-header">
        <span className="rv-calendar-mini-month-label">
          {MONTH_NAMES[month]} {year}
        </span>
        <div>
          <button className="rv-calendar-mini-nav" onClick={handlePrevMonth} aria-label="Previous month">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button className="rv-calendar-mini-nav" onClick={handleNextMonth} aria-label="Next month">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="rv-calendar-mini-grid">
        {DAYS.map((d) => (
          <div key={d} className="rv-calendar-mini-day-header">
            {d}
          </div>
        ))}

        {days.map(({ day, currentMonth }, idx) => {
          const date = new Date(year, currentMonth ? month : day > 20 ? month - 1 : month + 1, day);
          const selected = isSameDate(date, selectedDate);
          const today = isToday(date);

          const className = [
            'rv-calendar-mini-day',
            selected ? 'rv-calendar-mini-day--selected' : '',
            today ? 'rv-calendar-mini-day--today' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={idx}
              className={className}
              onClick={() => handleDayClick(day, currentMonth)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
