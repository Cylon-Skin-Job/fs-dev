import React from 'react';
import './CalendarViewer.css';

export interface EventBarProps {
  title: string;
  color: string; // hex color
  position: 'start' | 'middle' | 'end' | 'single';
  onClick?: () => void;
}

const positionClassMap: Record<EventBarProps['position'], string> = {
  single: '',
  start: 'rv-calendar-event--start',
  middle: 'rv-calendar-event--middle',
  end: 'rv-calendar-event--end',
};

export const EventBar: React.FC<EventBarProps> = ({ title, color, position, onClick }) => {
  const positionClass = positionClassMap[position];
  const className = ['rv-calendar-event', positionClass].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      style={{ '--event-color': color } as React.CSSProperties}
      title={title}
      onClick={onClick}
    >
      {title}
    </div>
  );
};

export default EventBar;
