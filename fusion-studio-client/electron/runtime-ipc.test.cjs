'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  RUNTIME_CHANGED_CHANNEL,
  RUNTIME_GET_CHANNEL,
  frameHasShellAuthority,
  registerRuntimeDescriptorIpc,
} = require('./runtime-ipc.cjs');

function harness(frameUrl = 'fusion-shell://app/') {
  const mainFrame = { url: frameUrl };
  const sends = [];
  const webContents = { mainFrame, send: (...args) => sends.push(args) };
  const mainWindow = { webContents, isDestroyed: () => false };
  const handlers = new Map();
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) };
  return { handlers, ipcMain, mainFrame, mainWindow, sends, webContents };
}

test('runtime IPC returns the descriptor only to the current shell main frame', () => {
  const fixture = harness();
  const descriptor = Object.freeze({
    generation: 'generation_000001',
    httpOrigin: 'http://127.0.0.1:41001',
    webSocketUrl: 'ws://127.0.0.1:41001',
  });
  const denied = [];
  const bridge = registerRuntimeDescriptorIpc({
    ipcMain: fixture.ipcMain,
    getMainWindow: () => fixture.mainWindow,
    getRuntimeDescriptor: () => descriptor,
    log: (code) => denied.push(code),
  });
  const handler = fixture.handlers.get(RUNTIME_GET_CHANNEL);
  assert.equal(handler({ sender: fixture.webContents, senderFrame: fixture.mainFrame }), null);
  assert.equal(bridge.commitMainFrame(), true);
  assert.equal(handler({ sender: fixture.webContents, senderFrame: fixture.mainFrame }), descriptor);
  assert.equal(bridge.authorize({ sender: fixture.webContents, senderFrame: fixture.mainFrame }), true);
  assert.equal(bridge.hasCommittedShellAuthority(), true);
  assert.equal(handler({ sender: fixture.webContents, senderFrame: { url: 'fusion-shell://app/' } }), null);
  assert.equal(handler({ sender: {}, senderFrame: fixture.mainFrame }), null);
  fixture.mainFrame.url = 'fusion-studio://wiki-viewer/app/index.html';
  assert.equal(bridge.authorize({ sender: fixture.webContents, senderFrame: fixture.mainFrame }), false);
  assert.equal(bridge.hasCommittedShellAuthority(), false);
  assert.equal(handler({ sender: fixture.webContents, senderFrame: fixture.mainFrame }), null);
  assert.deepEqual(denied, [
    'runtime_descriptor_denied',
    'runtime_descriptor_denied',
    'runtime_descriptor_denied',
    'runtime_descriptor_denied',
  ]);
  assert.equal(frameHasShellAuthority({}, fixture.mainWindow), false);
  bridge.clearMainFrame();
  fixture.mainFrame.url = 'fusion-shell://app/';
  assert.equal(handler({ sender: fixture.webContents, senderFrame: fixture.mainFrame }), null);
});

test('runtime IPC rejects publication without a committed generation and frame', () => {
  const fixture = harness();
  const bridge = registerRuntimeDescriptorIpc({
    ipcMain: fixture.ipcMain,
    getMainWindow: () => fixture.mainWindow,
    getRuntimeDescriptor: () => null,
  });
  assert.equal(bridge.publish(null), false);
  assert.deepEqual(fixture.sends, []);
  fixture.mainWindow.isDestroyed = () => true;
  assert.equal(bridge.publish(null), false);
});

test('runtime IPC publishes a generation only after committing that exact shell frame', () => {
  const fixture = harness();
  let descriptor = Object.freeze({
    generation: 'generation_000001',
    httpOrigin: 'http://127.0.0.1:41001',
    webSocketUrl: 'ws://127.0.0.1:41001',
  });
  const bridge = registerRuntimeDescriptorIpc({
    ipcMain: fixture.ipcMain,
    getMainWindow: () => fixture.mainWindow,
    getRuntimeDescriptor: () => descriptor,
  });
  assert.equal(bridge.publish(descriptor), false);
  assert.equal(bridge.commitMainFrame(), true);
  assert.equal(bridge.publish(descriptor), true);
  assert.equal(bridge.publish(null), true);
  bridge.clearMainFrame();
  descriptor = Object.freeze({ ...descriptor, generation: 'generation_000002' });
  assert.equal(bridge.publish(descriptor), false);
  assert.equal(bridge.publish(null), false);
  assert.deepEqual(fixture.sends, [
    [RUNTIME_CHANGED_CHANNEL, expectDescriptor('generation_000001')],
    [RUNTIME_CHANGED_CHANNEL, null],
  ]);
});

function expectDescriptor(generation) {
  return {
    generation,
    httpOrigin: 'http://127.0.0.1:41001',
    webSocketUrl: 'ws://127.0.0.1:41001',
  };
}
