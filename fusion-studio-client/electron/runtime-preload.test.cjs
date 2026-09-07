'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { webcrypto } = require('node:crypto');
const test = require('node:test');

const preloadPath = path.join(__dirname, 'preload.cjs');

function loadRuntimeApi() {
  const listeners = new Map();
  const removed = [];
  let exposed;
  const invokes = [];
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, value) => { exposed = value; } },
    ipcRenderer: {
      invoke: async (channel, payload) => {
        invokes.push([channel, payload]);
        return channel === 'fusion-runtime:get' ? { generation: 'generation_000001' } : { type: 'shell-auth:proof' };
      },
      on: (channel, listener) => listeners.set(channel, listener),
      removeListener: (channel, listener) => removed.push([channel, listener]),
      send() {},
    },
  };
  const source = fs.readFileSync(preloadPath, 'utf8');
  const hostRequire = createRequire(preloadPath);
  const localRequire = (specifier) => specifier === 'electron' ? electron : hostRequire(specifier);
  const module = { exports: {} };
  const context = vm.createContext({
    atob, btoa, Buffer, console, crypto: webcrypto, exports: module.exports,
    module, require: localRequire, structuredClone, TextDecoder, TextEncoder,
    URL, URLSearchParams, __dirname, __filename: preloadPath,
  });
  new vm.Script(`(function(require,module,exports,__filename,__dirname){${source}\n})`, {
    filename: preloadPath,
  }).runInContext(context)(localRequire, module, module.exports, preloadPath, __dirname);
  return { api: exposed, listeners, removed, invokes };
}

test('bundled preload exposes descriptor read and change notification only through fixed channels', async () => {
  const { api, listeners, removed } = loadRuntimeApi();
  assert.deepEqual(await api.getRuntimeDescriptor(), { generation: 'generation_000001' });
  const observed = [];
  const unsubscribe = api.onRuntimeDescriptorChanged((value) => observed.push(value));
  const listener = listeners.get('fusion-runtime:changed');
  listener({}, { generation: 'generation_000002' });
  assert.deepEqual(observed, [{ generation: 'generation_000002' }]);
  unsubscribe();
  assert.deepEqual(removed, [['fusion-runtime:changed', listener]]);
});

test('bundled preload forwards one exact challenge-signing request through fixed IPC', async () => {
  const { api, invokes } = loadRuntimeApi();
  const challenge = { type: 'shell-auth:challenge', version: 1 };
  assert.deepEqual(await api.authorizeShellChallenge(challenge, 'renderer-nonce'), { type: 'shell-auth:proof' });
  assert.deepEqual(JSON.parse(JSON.stringify(invokes)), [[
    'fusion-shell-auth:sign',
    { challenge, rendererNonce: 'renderer-nonce' },
  ]]);
});
