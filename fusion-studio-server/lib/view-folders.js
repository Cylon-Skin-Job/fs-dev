'use strict';

const VIEW_ARCHIVE_FOLDER = '999-Archive';

const PANEL_ARCHIVE_FOLDERS = new Map([
  ['capture-viewer', VIEW_ARCHIVE_FOLDER],
  ['office-viewer', VIEW_ARCHIVE_FOLDER],
  ['email-viewer', VIEW_ARCHIVE_FOLDER],
]);

function getPanelArchiveFolder(panel) {
  return PANEL_ARCHIVE_FOLDERS.get(panel) || null;
}

function isPanelArchiveRoot(panel, requestPath, entryName) {
  return requestPath === '' && getPanelArchiveFolder(panel) === entryName;
}

module.exports = {
  VIEW_ARCHIVE_FOLDER,
  getPanelArchiveFolder,
  isPanelArchiveRoot,
};
