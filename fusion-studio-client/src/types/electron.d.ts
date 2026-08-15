export type ExportDocumentResult =
  | { success: true; base64: string; filename: string }
  | { success: false; error: string };

export type SendEmailResult =
  | { success: true }
  | { success: false; error: string };

export interface OfficeTableOutputDescriptor {
  markdownSha256: string;
  tables: Array<{
    tableIndex: number;
    sourceSha256: string;
    logicalWidth: number;
    columns: number[] | null;
    overflow: 'overflow' | 'truncate' | 'newline';
    titleRow: boolean;
    borderWidth: 1 | 2 | 3 | 4;
    borderColor: `#${string}` | null | 'default';
  }>;
}

export type OfficePresentationMode = {
  presentationMode: 'office-tables';
  tablePresentation: OfficeTableOutputDescriptor;
};

export type ExportDocumentPayload = {
  sourceType: 'document' | 'html-artifact' | 'spreadsheet';
  sourceFormat: 'markdown' | 'html' | 'csv';
  format: 'docx' | 'pdf';
  content: string;
  filename: string;
} | ({
  sourceType: 'document';
  sourceFormat: 'markdown';
  format: 'docx' | 'pdf';
  content: string;
  filename: string;
} & OfficePresentationMode);

export type SendDocumentEmailPayload = {
  format: 'docx' | 'pdf' | 'markdown';
  content: string;
  filename: string;
} | ({
  format: 'docx' | 'pdf';
  content: string;
  filename: string;
} & OfficePresentationMode);

export type PrintDocumentPayload = {
  content: string;
  filename: string;
} | ({
  content: string;
  filename: string;
} & OfficePresentationMode);

export interface ElectronAPI {
  capturePage: () => Promise<string | null>;
  captureRect: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    maxWidth?: number;
    maxHeight?: number;
  }) => Promise<string | null>;
  exportDocument: (payload: ExportDocumentPayload) => Promise<ExportDocumentResult>;
  sendDocumentEmail: (payload: SendDocumentEmailPayload) => Promise<SendEmailResult>;
  printDocument: (payload: PrintDocumentPayload) => Promise<{ success: boolean; error?: string }>;
  showEmojiPanel: () => Promise<{ success: boolean; error?: string }>;
  listCalendars: () => Promise<{ success: boolean; calendars?: Array<{ id: string; name: string; color: string; account: string }>; error?: string }>;
  listEvents: (payload: { startDate: string; endDate: string }) => Promise<{ success: boolean; events?: Array<{ uid: string; title: string; startDate: string; endDate: string; allDay: boolean; calendar: string; location?: string; notes?: string }>; error?: string }>;
  createEvent: (payload: { calendarName: string; title: string; startDate: string; endDate: string; allDay: boolean; location?: string; notes?: string }) => Promise<{ success: boolean; uid?: string; error?: string }>;
  updateEvent: (payload: { uid: string; calendarName: string; title: string; startDate: string; endDate: string; allDay: boolean; location?: string; notes?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteEvent: (payload: { uid: string }) => Promise<{ success: boolean; error?: string }>;
  onMenuAction: (callback: (payload: ElectronMenuAction) => void) => (() => void);
  onBrowserUrlChanged: (callback: (payload: { url: string }) => void) => (() => void);
  setWorkspaceRoot: (repoPath: string | null) => void;
  setWorkspaceMenuState: (state: WorkspaceMenuState) => void;
  listScreenshots: () => Promise<string[]>;
  readScreenshot: (filename: string) => Promise<{ base64: string; mimeType: string }>;
}

export interface WorkspaceMenuState {
  workspaces: WorkspaceMenuItem[];
  activeWorkspaceId: string | null;
}

export interface WorkspaceMenuItem {
  id: string;
  label: string;
  ribbonVisible: boolean;
  ribbonSortOrder?: number | null;
  sortOrder: number;
}

export type ElectronMenuAction =
  | { type: 'open-theme-picker' }
  | { type: 'open-secrets-manager' }
  | { type: 'sync-apple-calendar' }
  | { type: 'toggle-connector-mail' }
  | { type: 'toggle-connector-calendar' }
  | { type: 'toggle-connector-notes' }
  | { type: 'toggle-connector-reminders' }
  | { type: 'workspace-menu:show-ribbon' }
  | { type: 'workspace-menu:add-project' }
  | { type: 'workspace-menu:create-project' }
  | { type: 'workspace-menu:switch'; workspaceId: string }
  | { type: 'workspace-menu:set-ribbon-visible'; workspaceId: string; visible: boolean };

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
