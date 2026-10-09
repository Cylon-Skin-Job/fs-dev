import React, { useEffect, useRef, useState } from 'react';
import './CalendarViewer.css';

export type CalendarDrawerView = 'none' | 'checklist' | 'inbox' | 'calendarlist';
export type CalendarGridView = 'day' | 'week' | 'month' | 'year';

export interface CalendarHeaderProps {
  monthLabel: string;
  selectedDate: Date;
  drawerView: CalendarDrawerView;
  onDrawerToggle: (view: CalendarDrawerView) => void;
  onViewChange: (view: CalendarGridView) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

const VIEW_OPTIONS: { value: CalendarGridView; label: string; enabled: boolean }[] = [
  { value: 'day', label: 'Day', enabled: false },
  { value: 'week', label: 'Week', enabled: false },
  { value: 'month', label: 'Month', enabled: true },
  { value: 'year', label: 'Year', enabled: false },
];

const ACTIONS: { view: CalendarDrawerView; icon: string; label: string }[] = [
  { view: 'checklist', icon: 'task_alt', label: 'Checklist' },
  { view: 'inbox', icon: 'inbox', label: 'Inbox' },
  { view: 'calendarlist', icon: 'calendar_month', label: 'Calendars' },
];

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  monthLabel,
  drawerView,
  onDrawerToggle,
  onViewChange,
  onPrevMonth,
  onNextMonth,
  onToday,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentView, setCurrentView] = useState<CalendarGridView>('month');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleViewSelect = (view: CalendarGridView) => {
    setCurrentView(view);
    setDropdownOpen(false);
    onViewChange(view);
  };

  const currentViewLabel =
    VIEW_OPTIONS.find((v) => v.value === currentView)?.label ?? 'Month';

  const drawerIsOpen = drawerView !== 'none';

  return (
    <div className="rv-calendar-header">
      <h1 className="rv-calendar-header-title">{monthLabel}</h1>

      <div className="rv-calendar-header-dropdown" ref={dropdownRef}>
        <button
          type="button"
          className="rv-calendar-header-dropdown-btn"
          onClick={() => setDropdownOpen((o) => !o)}
        >
          <span>{currentViewLabel}</span>
          <span className="material-symbols-outlined">expand_more</span>
        </button>
        {dropdownOpen && (
          <div className="rv-calendar-header-dropdown-menu">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="rv-calendar-header-dropdown-item"
                disabled={!opt.enabled}
                onClick={() => opt.enabled && handleViewSelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rv-calendar-header-nav">
        <button
          type="button"
          className="rv-calendar-header-nav-btn"
          onClick={onPrevMonth}
          aria-label="Previous month"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          type="button"
          className="rv-calendar-header-today"
          onClick={onToday}
        >
          Today
        </button>
        <button
          type="button"
          className="rv-calendar-header-nav-btn"
          onClick={onNextMonth}
          aria-label="Next month"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="rv-calendar-header-actions">
        {ACTIONS.map((action) => {
          const isActive = drawerView === action.view;
          const classes = [
            'rv-calendar-header-action',
            isActive ? 'rv-calendar-header-action--active' : '',
            drawerIsOpen ? 'rv-calendar-header-action--floating' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={action.view}
              type="button"
              className={classes}
              onClick={() => onDrawerToggle(action.view)}
              aria-label={action.label}
              aria-pressed={isActive}
            >
              <span className="material-symbols-outlined">{action.icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarHeader;
