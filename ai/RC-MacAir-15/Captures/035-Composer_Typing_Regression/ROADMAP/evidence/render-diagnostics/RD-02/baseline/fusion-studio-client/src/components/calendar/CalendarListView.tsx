import React, { useMemo } from 'react';
import './CalendarViewer.css';

export interface CalendarItem {
  id: string;
  name: string;
  color: string;
  account: string;
  enabled: boolean;
}

export interface CalendarListViewProps {
  calendars: CalendarItem[];
  onToggle: (id: string) => void;
}

export const CalendarListView: React.FC<CalendarListViewProps> = ({ calendars, onToggle }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, CalendarItem[]> = {};
    for (const cal of calendars) {
      if (!groups[cal.account]) {
        groups[cal.account] = [];
      }
      groups[cal.account].push(cal);
    }
    return groups;
  }, [calendars]);

  const accounts = Object.keys(grouped);

  return (
    <div className="rv-calendar-list">
      {accounts.map((account) => (
        <div key={account} className="rv-calendar-list-section">
          <div className="rv-calendar-list-section-title">{account}</div>
          {grouped[account].map((cal) => {
            const dotClass = [
              'rv-calendar-list-dot',
              cal.enabled ? '' : 'rv-calendar-list-dot--disabled',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={cal.id}
                className="rv-calendar-list-row"
                onClick={() => onToggle(cal.id)}
                role="button"
                aria-pressed={cal.enabled}
                title={cal.enabled ? 'Disable calendar' : 'Enable calendar'}
              >
                <div
                  className={dotClass}
                  style={{ background: cal.color }}
                />
                <span className="rv-calendar-list-name">{cal.name}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default CalendarListView;
