export interface Calendar {
  id: string;
  name: string;
  color: string;
  account: string;
  enabled: boolean;
}

export interface CalendarEvent {
  uid: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendarId: string;
  location?: string;
  notes?: string;
}

export interface EventFormData {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendarId: string;
  location?: string;
  notes?: string;
}
