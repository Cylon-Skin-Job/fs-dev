import React from 'react';
import './CalendarViewer.css';

export const ChecklistView: React.FC = () => {
  return (
    <div className="rv-calendar-empty-state">
      <span className="material-symbols-outlined">task_alt</span>
      <span>To-do integration coming soon</span>
    </div>
  );
};

export default ChecklistView;
