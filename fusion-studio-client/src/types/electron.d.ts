export type ExportDocumentResult =
  | { success: true; base64: string; filename: string }
  | { success: false; error: string };

export type SendEmailResult =
  | { success: true }
  | { success: false; error: string };

export interface ElectronAPI {
  capturePage: () => Promise<string | null>;
  captureRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
  exportDocument: (payload: {
    sourceType: 'document' | 'html-artifact' | 'spreadsheet';
    sourceFormat: 'markdown' | 'html' | 'csv';
    format: 'docx' | 'pdf';
    content: string;
    filename: string;
  }) => Promise<ExportDocumentResult>;
  sendDocumentEmail: (payload: {
    format: 'docx' | 'pdf' | 'markdown';
    content: string;
    filename: string;
  }) => Promise<SendEmailResult>;
  printDocument: (payload: {
    content: string;
    filename: string;
  }) => Promise<{ success: boolean; error?: string }>;
  listCalendars: () => Promise<{ success: boolean; calendars?: Array<{ id: string; name: string; color: string; account: string }>; error?: string }>;
  listEvents: (payload: { startDate: string; endDate: string }) => Promise<{ success: boolean; events?: Array<{ uid: string; title: string; startDate: string; endDate: string; allDay: boolean; calendar: string; location?: string; notes?: string }>; error?: string }>;
  createEvent: (payload: { calendarName: string; title: string; startDate: string; endDate: string; allDay: boolean; location?: string; notes?: string }) => Promise<{ success: boolean; uid?: string; error?: string }>;
  updateEvent: (payload: { uid: string; calendarName: string; title: string; startDate: string; endDate: string; allDay: boolean; location?: string; notes?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteEvent: (payload: { uid: string }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
