import React from 'react';
import './CalendarViewer.css';

export const InboxView: React.FC = () => {
  return (
    <div className="rv-calendar-empty-state">
      <span className="material-symbols-outlined">inbox</span>
      <span>Invite inbox coming soon</span>
    </div>
  );
};

export default InboxView;
