const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  exportDocument: (payload) => ipcRenderer.invoke('export-document', payload),
  sendDocumentEmail: (payload) => ipcRenderer.invoke('send-document-email', payload),
  printDocument: (payload) => ipcRenderer.invoke('print-document', payload),
  listCalendars: () => ipcRenderer.invoke('calendar:list-calendars').then(r => { console.log('[preload] listCalendars:', r); return r; }),
  listEvents: (payload) => ipcRenderer.invoke('calendar:list-events', payload).then(r => { console.log('[preload] listEvents:', r); return r; }),
  createEvent: (payload) => ipcRenderer.invoke('calendar:create-event', payload),
  updateEvent: (payload) => ipcRenderer.invoke('calendar:update-event', payload),
  deleteEvent: (payload) => ipcRenderer.invoke('calendar:delete-event', payload),
  onMenuAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },
});
