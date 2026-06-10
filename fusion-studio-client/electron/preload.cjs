const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  exportDocument: (payload) => ipcRenderer.invoke('export-document', payload),
  sendDocumentEmail: (payload) => ipcRenderer.invoke('send-document-email', payload),
  printDocument: (payload) => ipcRenderer.invoke('print-document', payload),
  showEmojiPanel: () => ipcRenderer.invoke('show-emoji-panel'),
  onMenuAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },
  onBrowserUrlChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('browser:url-changed', listener);
    return () => ipcRenderer.removeListener('browser:url-changed', listener);
  },
  setWorkspaceRoot: (repoPath) => ipcRenderer.send('workspace:set-root', repoPath),
  setWorkspaceMenuState: (state) => ipcRenderer.send('workspace-menu:set-state', state),
  listScreenshots: () => ipcRenderer.invoke('screenshots:list'),
  readScreenshot: (filename) => ipcRenderer.invoke('screenshots:read', filename),
});
