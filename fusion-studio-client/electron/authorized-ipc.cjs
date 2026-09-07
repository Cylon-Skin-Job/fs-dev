'use strict';

/**
 * Restrict every preload-exposed native IPC entry point to the current
 * committed shell frame and runtime generation.
 */
function createAuthorizedIpcMain(ipcMain, { authorize, log }) {
  return Object.freeze({
    handle(channel, listener) {
      ipcMain.handle(channel, async (event, ...args) => {
        if (!authorize(event)) {
          log?.('native_ipc_denied');
          throw new Error('Native IPC unavailable');
        }
        return listener(event, ...args);
      });
    },
    on(channel, listener) {
      ipcMain.on(channel, (event, ...args) => {
        if (!authorize(event)) {
          log?.('native_ipc_denied');
          return;
        }
        listener(event, ...args);
      });
    },
  });
}

module.exports = { createAuthorizedIpcMain };
