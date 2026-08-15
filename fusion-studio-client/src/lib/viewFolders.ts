export const VIEW_ARCHIVE_FOLDER = '999-Archive';
export const DOC_VIEWER_ARCHIVE_FOLDER = VIEW_ARCHIVE_FOLDER;
export const OFFICE_VIEWER_ARCHIVE_FOLDER = VIEW_ARCHIVE_FOLDER;
export const EMAIL_VIEWER_ARCHIVE_FOLDER = VIEW_ARCHIVE_FOLDER;

const PANEL_ARCHIVE_FOLDERS: Record<string, string> = {
  'capture-viewer': DOC_VIEWER_ARCHIVE_FOLDER,
  'office-viewer': OFFICE_VIEWER_ARCHIVE_FOLDER,
  'email-viewer': EMAIL_VIEWER_ARCHIVE_FOLDER,
};

export function getPanelArchiveFolder(panel: string): string | null {
  return PANEL_ARCHIVE_FOLDERS[panel] ?? null;
}

export function isViewerArchivePath(path: string, archiveFolder = VIEW_ARCHIVE_FOLDER): boolean {
  return path.split('/').filter(Boolean).includes(archiveFolder);
}
