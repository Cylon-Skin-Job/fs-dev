'use strict';

const { createHmac } = require('node:crypto');
const {
  AUTH_CLOSE_CODE,
  AUTH_CLOSE_REASON,
  createShellAuthOwner,
  proofInput,
} = require('../../lib/ws/shell-auth');

const GENERATION = 'generation_auth_000001';
const MASTER = Buffer.alloc(32, 1);
const SERVER_NONCE_BYTES = Buffer.alloc(32, 2);
const RENDERER_NONCE = Buffer.alloc(32, 3).toString('base64url');

function createWs() {
  return {
    sent: [], closed: [],
    send(value) { this.sent.push(JSON.parse(value)); },
    close(code, reason) { this.closed.push([code, reason]); },
  };
}

function setup(overrides = {}) {
  let clock = overrides.clock ?? 1_000;
  const owner = createShellAuthOwner({
    authority: overrides.authority === undefined
      ? { version: 1, generation: GENERATION, master: MASTER }
      : overrides.authority,
    now: () => clock,
    randomBytes: () => SERVER_NONCE_BYTES,
    ttlMs: 10_000,
  });
  const ws = createWs();
  const session = { connectionId: overrides.connectionId || 'connection_auth_000001' };
  const state = owner.begin({ ws, session, origin: overrides.origin ?? 'fusion-shell://app' });
  const challenge = ws.sent[0];
  const proof = challenge ? {
    type: 'shell-auth:proof', version: 1,
    connectionId: challenge.connectionId,
    serverNonce: challenge.serverNonce,
    rendererNonce: RENDERER_NONCE,
    generation: challenge.generation,
    expiresAt: challenge.expiresAt,
    proof: createHmac('sha256', MASTER).update(proofInput(challenge, RENDERER_NONCE)).digest('base64url'),
  } : null;
  return { owner, ws, session, state, challenge, proof, setClock(value) { clock = value; } };
}

describe('shell connection authentication', () => {
  test('accepts one exact proof and stores role only on private session state', () => {
    const value = setup();
    expect(value.session.connectionRole).toBe('untrusted');
    expect(Object.getOwnPropertyDescriptor(value.session, 'connectionRole')).toMatchObject({
      enumerable: false,
      configurable: true,
    });
    expect({ ...value.session }).not.toHaveProperty('connectionRole');
    expect(JSON.parse(JSON.stringify(value.session))).not.toHaveProperty('connectionRole');
    expect(value.owner.verify({ ws: value.ws, session: value.session, state: value.state, value: value.proof })).toBe(true);
    expect(value.session.connectionRole).toBe('trusted-shell');
    expect(Object.getOwnPropertyDescriptor(value.session, 'connectionRole')?.enumerable).toBe(false);
    expect({ ...value.session }).not.toHaveProperty('connectionRole');
    expect(value.ws.closed).toEqual([]);
    expect(value.owner.verify({ ws: value.ws, session: value.session, state: value.state, value: value.proof })).toBe(false);
    expect(value.session).not.toHaveProperty('connectionRole');
    expect(value.ws.closed).toContainEqual([AUTH_CLOSE_CODE, AUTH_CLOSE_REASON]);
  });

  test('retires a live connection role synchronously and idempotently', () => {
    const value = setup();
    expect(value.owner.verify({ ws: value.ws, session: value.session, state: value.state, value: value.proof })).toBe(true);
    value.owner.retire({ session: value.session });
    value.owner.retire({ session: value.session });
    expect(value.session.connectionRole).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value.session, 'connectionRole')).toBe(false);
  });

  test.each([
    ['wrong origin', (v) => { v.state.origin = 'http://127.0.0.1:3001'; }],
    ['cross connection', (v) => { v.proof.connectionId = 'connection_auth_000002'; }],
    ['wrong server nonce', (v) => { v.proof.serverNonce = Buffer.alloc(32, 8).toString('base64url'); }],
    ['wrong renderer nonce', (v) => { v.proof.rendererNonce = Buffer.alloc(32, 9).toString('base64url'); }],
    ['stale generation', (v) => { v.proof.generation = 'generation_auth_000002'; }],
    ['forged proof', (v) => { v.proof.proof = Buffer.alloc(32, 7).toString('base64url'); }],
    ['extra authority field', (v) => { v.proof.role = 'trusted-shell'; }],
  ])('denies %s with one fixed close and no role', (_label, mutate) => {
    const value = setup();
    mutate(value);
    expect(value.owner.verify({ ws: value.ws, session: value.session, state: value.state, value: value.proof })).toBe(false);
    expect(value.session.connectionRole).toBeUndefined();
    expect(value.ws.closed).toEqual([[AUTH_CLOSE_CODE, AUTH_CLOSE_REASON]]);
  });

  test('denies expiry and malformed proof before role assignment', () => {
    const expired = setup();
    expired.setClock(expired.challenge.expiresAt);
    expect(expired.owner.verify({ ws: expired.ws, session: expired.session, state: expired.state, value: expired.proof })).toBe(false);
    expect(expired.session.connectionRole).toBeUndefined();

    const malformed = setup();
    expect(malformed.owner.verify({ ws: malformed.ws, session: malformed.session, state: malformed.state, value: '{bad' })).toBe(false);
    expect(malformed.session.connectionRole).toBeUndefined();
  });

  test('standalone mode sends no challenge and can never mint trusted-shell', () => {
    const value = setup({ authority: null });
    expect(value.owner.available).toBe(false);
    expect(value.ws.sent).toEqual([]);
    expect(value.owner.verify({ ws: value.ws, session: value.session, state: value.state, value: value.proof })).toBe(false);
    expect(value.session.connectionRole).toBeUndefined();
  });
});
