'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createAuthorizedIpcMain } = require('./authorized-ipc.cjs');

test('authorized IPC rejects stale frames before invoke or send side effects', async () => {
  const handles = new Map();
  const events = new Map();
  const denied = [];
  const ipcMain = {
    handle: (channel, listener) => handles.set(channel, listener),
    on: (channel, listener) => events.set(channel, listener),
  };
  const allowedEvent = { allowed: true };
  const gated = createAuthorizedIpcMain(ipcMain, {
    authorize: (event) => event === allowedEvent,
    log: (code) => denied.push(code),
  });
  let sideEffects = 0;
  gated.handle('invoke', (_event, value) => { sideEffects += value; return value; });
  gated.on('send', (_event, value) => { sideEffects += value; });

  await assert.rejects(handles.get('invoke')({ allowed: false }, 2), /Native IPC unavailable/);
  events.get('send')({ allowed: false }, 3);
  assert.equal(sideEffects, 0);
  assert.deepEqual(denied, ['native_ipc_denied', 'native_ipc_denied']);

  assert.equal(await handles.get('invoke')(allowedEvent, 5), 5);
  events.get('send')(allowedEvent, 7);
  assert.equal(sideEffects, 12);
});
