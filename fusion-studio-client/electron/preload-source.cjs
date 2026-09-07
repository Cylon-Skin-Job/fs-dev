const { contextBridge, ipcRenderer } = require('electron');
const {
  INVALID_TABLE_PRESENTATION,
  canonicalizeOfficePayload,
  hasOfficePresentationFields,
} = require('./shared/office-table-presentation-validation.cjs');

async function invokeDocumentChannel(channel, surface, payload) {
  if (!hasOfficePresentationFields(payload)) return ipcRenderer.invoke(channel, payload);
  let canonicalPayload;
  try {
    const capturedPayload = structuredClone(payload);
    canonicalPayload = await canonicalizeOfficePayload(capturedPayload, surface);
    if (canonicalPayload === null) throw new Error(INVALID_TABLE_PRESENTATION);
  } catch {
    throw new Error(INVALID_TABLE_PRESENTATION);
  }
  try {
    return await ipcRenderer.invoke(channel, canonicalPayload);
  } catch (error) {
    if (error && error.name === 'DataCloneError') {
      throw new Error(INVALID_TABLE_PRESENTATION);
    }
    throw error;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureRect: (rect) => ipcRenderer.invoke('capture-rect', rect),
  exportDocument: (payload) => invokeDocumentChannel('export-document', 'export', payload),
  sendDocumentEmail: (payload) => invokeDocumentChannel('send-document-email', 'email', payload),
  printDocument: (payload) => invokeDocumentChannel('print-document', 'print', payload),
  showEmojiPanel: () => ipcRenderer.invoke('show-emoji-panel'),
  getRuntimeDescriptor: () => ipcRenderer.invoke('fusion-runtime:get'),
  authorizeShellChallenge: (challenge, rendererNonce) => ipcRenderer.invoke('fusion-shell-auth:sign', { challenge, rendererNonce }),
  onRuntimeDescriptorChanged: (callback) => {
    const listener = (_event, descriptor) => callback(descriptor);
    ipcRenderer.on('fusion-runtime:changed', listener);
    return () => ipcRenderer.removeListener('fusion-runtime:changed', listener);
  },
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
