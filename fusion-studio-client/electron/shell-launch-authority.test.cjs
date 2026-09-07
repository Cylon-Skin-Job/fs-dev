'use strict';

const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');
const {
  createShellLaunchAuthority,
  proofInput,
} = require('./shell-launch-authority.cjs');

const GENERATION = 'generation_auth_000001';
const SERVER_NONCE = Buffer.alloc(32, 2).toString('base64url');
const RENDERER_NONCE = Buffer.alloc(32, 3).toString('base64url');
const MASTER = Buffer.alloc(32, 1);

function challenge(overrides = {}) {
  return {
    type: 'shell-auth:challenge', version: 1,
    connectionId: 'connection_auth_000001', serverNonce: SERVER_NONCE,
    generation: GENERATION, issuedAt: 1_000, expiresAt: 11_000,
    ...overrides,
  };
}

test('launch authority emits one bounded bootstrap value and signs one exact challenge', () => {
  const authority = createShellLaunchAuthority({
    randomBytes: () => MASTER,
    createGeneration: () => GENERATION,
    now: () => 2_000,
  });
  const payload = authority.takeBootstrapPayload();
  assert.equal(payload.endsWith('\n'), true);
  assert.deepEqual(JSON.parse(payload), {
    version: 1, generation: GENERATION, master: MASTER.toString('base64url'),
  });
  assert.throws(() => authority.takeBootstrapPayload(), /already consumed/);

  const result = authority.sign(challenge(), RENDERER_NONCE);
  const expected = createHmac('sha256', MASTER)
    .update(proofInput(challenge(), RENDERER_NONCE)).digest('base64url');
  assert.equal(result.proof, expected);
  assert.equal(authority.sign(challenge(), RENDERER_NONCE), null);
});

test('signing fails closed for stale generation, expiry, malformed shapes, and bad nonces', () => {
  const make = (now = 2_000) => createShellLaunchAuthority({
    randomBytes: () => MASTER,
    createGeneration: () => GENERATION,
    now: () => now,
  });
  assert.equal(make().sign(challenge({ generation: 'generation_auth_000002' }), RENDERER_NONCE), null);
  assert.equal(make(11_000).sign(challenge(), RENDERER_NONCE), null);
  assert.equal(make().sign({ ...challenge(), delegated: true }, RENDERER_NONCE), null);
  assert.equal(make().sign(challenge(), 'short'), null);
  assert.equal(make().sign(challenge({ connectionId: 'short' }), RENDERER_NONCE), null);
});

test('launch authority does not expose master bytes as data properties', () => {
  const authority = createShellLaunchAuthority({
    randomBytes: () => MASTER,
    createGeneration: () => GENERATION,
  });
  assert.equal(JSON.stringify(authority), JSON.stringify({ generation: GENERATION }));
  assert.equal(Object.values(authority).some((value) => Buffer.isBuffer(value)), false);
});
