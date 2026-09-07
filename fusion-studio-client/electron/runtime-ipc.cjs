'use strict';

const { isShellMainFrameUrl } = require('./shell-protocol.cjs');

const RUNTIME_GET_CHANNEL = 'fusion-runtime:get';
const RUNTIME_CHANGED_CHANNEL = 'fusion-runtime:changed';

function frameHasShellAuthority(event, mainWindow, committedFrame = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const webContents = mainWindow.webContents;
  const frame = event?.senderFrame;
  if (!frame || event.sender !== webContents || frame !== webContents.mainFrame) return false;
  if (committedFrame !== frame) return false;
  return isShellMainFrameUrl(frame.url);
}

function registerRuntimeDescriptorIpc({ ipcMain, getMainWindow, getRuntimeDescriptor, log }) {
  let committedFrame = null;
  let committedGeneration = null;

  ipcMain.handle(RUNTIME_GET_CHANNEL, (event) => {
    const mainWindow = getMainWindow();
    const descriptor = getRuntimeDescriptor();
    if (!descriptor
      || descriptor.generation !== committedGeneration
      || !frameHasShellAuthority(event, mainWindow, committedFrame)) {
      log?.('runtime_descriptor_denied');
      return null;
    }
    return descriptor;
  });

  return Object.freeze({
    authorize(event) {
      const mainWindow = getMainWindow();
      const descriptor = getRuntimeDescriptor();
      return Boolean(descriptor
        && descriptor.generation === committedGeneration
        && frameHasShellAuthority(event, mainWindow, committedFrame));
    },
    hasCommittedShellAuthority() {
      const mainWindow = getMainWindow();
      const descriptor = getRuntimeDescriptor();
      return Boolean(mainWindow
        && !mainWindow.isDestroyed()
        && descriptor
        && descriptor.generation === committedGeneration
        && mainWindow.webContents.mainFrame === committedFrame
        && isShellMainFrameUrl(committedFrame?.url));
    },
    commitMainFrame() {
      const mainWindow = getMainWindow();
      const descriptor = getRuntimeDescriptor();
      if (!mainWindow || mainWindow.isDestroyed() || !descriptor) return false;
      const frame = mainWindow.webContents.mainFrame;
      if (!frame || !isShellMainFrameUrl(frame.url)) return false;
      committedFrame = frame;
      committedGeneration = descriptor.generation;
      return true;
    },
    clearMainFrame() {
      committedFrame = null;
      committedGeneration = null;
    },
    publish(descriptor) {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return false;
      const current = getRuntimeDescriptor();
      if (!current
        || current.generation !== committedGeneration
        || mainWindow.webContents.mainFrame !== committedFrame
        || !isShellMainFrameUrl(committedFrame?.url)) return false;
      if (descriptor !== null && descriptor !== current) return false;
      mainWindow.webContents.send(RUNTIME_CHANGED_CHANNEL, descriptor);
      return true;
    },
  });
}

module.exports = {
  RUNTIME_CHANGED_CHANNEL,
  RUNTIME_GET_CHANNEL,
  frameHasShellAuthority,
  registerRuntimeDescriptorIpc,
};
