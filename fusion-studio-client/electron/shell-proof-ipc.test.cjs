'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { registerShellProofIpc } = require('./shell-proof-ipc.cjs');

test('proof IPC uses only the authorized IPC boundary and closed request shape', async () => {
  let handler;
  const logs = [];
  registerShellProofIpc({
    authorizedIpcMain: { handle(_channel, value) { handler = value; } },
    getLaunchAuthority: () => ({ sign: (challenge, nonce) => ({ challenge, nonce }) }),
    log: (code) => logs.push(code),
  });
  assert.deepEqual(await handler({}, { challenge: { id: 1 }, rendererNonce: 'nonce' }), {
    challenge: { id: 1 }, nonce: 'nonce',
  });
  assert.equal(await handler({}, { challenge: {}, rendererNonce: 'nonce', trusted: true }), null);
  assert.deepEqual(logs, ['shell_proof_denied']);
});

test('proof IPC returns fixed null when launch authority is unavailable', async () => {
  let handler;
  registerShellProofIpc({
    authorizedIpcMain: { handle(_channel, value) { handler = value; } },
    getLaunchAuthority: () => null,
  });
  assert.equal(await handler({}, {}), null);
});
