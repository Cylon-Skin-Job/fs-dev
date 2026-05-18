import React, { useEffect, useState } from 'react';
import type { Calendar, CalendarEvent, EventFormData } from '../../types/calendar';
import './CalendarViewer.css';

export interface EventModalProps {
  event?: CalendarEvent;
  initialDate?: Date;
  calendars: Calendar[];
  onSave: (data: EventFormData) => void;
  onUpdate: (uid: string, data: EventFormData) => void;
  onDelete?: (uid: string) => void;
  onClose: () => void;
}

function formatForDatetimeLocal(isoString: string): string {
  const d = new Date(isoString);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function buildInitialForm(
  event: CalendarEvent | undefined,
  initialDate: Date | undefined,
  calendars: Calendar[],
): EventFormData {
  if (event) {
    return {
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: event.allDay,
      calendarId: event.calendarId,
      location: event.location || '',
      notes: event.notes || '',
    };
  }
  const base = initialDate ?? new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0);
  return {
    title: '',
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    allDay: true,
    calendarId: calendars[0]?.id || '',
    location: '',
    notes: '',
  };
}

export const EventModal: React.FC<EventModalProps> = ({
  event,
  initialDate,
  calendars,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const [form, setForm] = useState<EventFormData>(() =>
    buildInitialForm(event, initialDate, calendars),
  );

  useEffect(() => {
    setForm(buildInitialForm(event, initialDate, calendars));
  }, [event, initialDate, calendars]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (event) {
      onUpdate(event.uid, form);
    } else {
      onSave(form);
    }
    onClose();
  };

  const enabledCalendars = calendars.filter((c) => c.enabled);

  return (
    <div className="rv-calendar-modal-overlay" onClick={onClose}>
      <div className="rv-calendar-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="rv-calendar-modal-title">
          {event ? 'Edit Event' : 'New Event'}
        </h3>

        <div className="rv-calendar-modal-field">
          <label htmlFor="rv-calendar-modal-title-input">Title</label>
          <input
            id="rv-calendar-modal-title-input"
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            autoFocus
          />
        </div>

        <div className="rv-calendar-modal-row">
          <div className="rv-calendar-modal-field">
            <label htmlFor="rv-calendar-modal-start">Start</label>
            <input
              id="rv-calendar-modal-start"
              type="datetime-local"
              value={formatForDatetimeLocal(form.startDate)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  startDate: new Date(e.target.value).toISOString(),
                }))
              }
            />
          </div>
          <div className="rv-calendar-modal-field">
            <label htmlFor="rv-calendar-modal-end">End</label>
            <input
              id="rv-calendar-modal-end"
              type="datetime-local"
              value={formatForDatetimeLocal(form.endDate)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  endDate: new Date(e.target.value).toISOString(),
                }))
              }
            />
          </div>
        </div>

        <div className="rv-calendar-modal-field rv-calendar-modal-checkbox">
          <input
            type="checkbox"
            id="rv-calendar-modal-allday"
            checked={form.allDay}
            onChange={(e) =>
              setForm((f) => ({ ...f, allDay: e.target.checked }))
            }
          />
          <label htmlFor="rv-calendar-modal-allday">All-day</label>
        </div>

        <div className="rv-calendar-modal-field">
          <label htmlFor="rv-calendar-modal-calendar">Calendar</label>
          <select
            id="rv-calendar-modal-calendar"
            value={form.calendarId}
            onChange={(e) =>
              setForm((f) => ({ ...f, calendarId: e.target.value }))
            }
          >
            {enabledCalendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rv-calendar-modal-field">
          <label htmlFor="rv-calendar-modal-location">Location</label>
          <input
            id="rv-calendar-modal-location"
            type="text"
            value={form.location || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
            placeholder="Add location"
          />
        </div>

        <div className="rv-calendar-modal-field">
          <label htmlFor="rv-calendar-modal-notes">Notes</label>
          <textarea
            id="rv-calendar-modal-notes"
            value={form.notes || ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Add notes"
            rows={3}
          />
        </div>

        <div className="rv-calendar-modal-actions">
          {event && onDelete && (
            <button
              type="button"
              className="rv-calendar-modal-btn rv-calendar-modal-btn--danger"
              onClick={() => onDelete(event.uid)}
            >
              Delete
            </button>
          )}
          <div className="rv-calendar-modal-actions-spacer" />
          <button
            type="button"
            className="rv-calendar-modal-btn rv-calendar-modal-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rv-calendar-modal-btn rv-calendar-modal-btn--primary"
            onClick={handleSave}
            disabled={!form.title.trim()}
          >
            {event ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
