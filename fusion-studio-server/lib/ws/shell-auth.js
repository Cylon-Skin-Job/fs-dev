'use strict';

const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const AUTH_PROTOCOL_VERSION = 1;
const SHELL_ORIGIN = 'fusion-shell://app';
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CONNECTION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const GENERATION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const PROOF_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const AUTH_CLOSE_CODE = 1008;
const AUTH_CLOSE_REASON = 'shell authentication failed';

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  const sorted = [...expected].sort();
  return keys.every((key) => typeof key === 'string')
    && keys.length === sorted.length
    && [...keys].sort().every((key, index) => key === sorted[index]);
}

function proofInput(challenge, rendererNonce) {
  return [
    String(AUTH_PROTOCOL_VERSION),
    challenge.generation,
    challenge.connectionId,
    challenge.serverNonce,
    rendererNonce,
    String(challenge.expiresAt),
  ].join('\n');
}

function parseProof(value) {
  const keys = ['type', 'version', 'connectionId', 'serverNonce', 'rendererNonce', 'generation', 'expiresAt', 'proof'];
  if (!exactKeys(value, keys)) return null;
  if (value.type !== 'shell-auth:proof' || value.version !== AUTH_PROTOCOL_VERSION) return null;
  if (typeof value.connectionId !== 'string' || !CONNECTION_ID_PATTERN.test(value.connectionId)) return null;
  if (typeof value.serverNonce !== 'string' || !NONCE_PATTERN.test(value.serverNonce)) return null;
  if (typeof value.rendererNonce !== 'string' || !NONCE_PATTERN.test(value.rendererNonce)) return null;
  if (typeof value.generation !== 'string' || !GENERATION_PATTERN.test(value.generation)) return null;
  if (!Number.isSafeInteger(value.expiresAt) || value.expiresAt < 0) return null;
  if (typeof value.proof !== 'string' || !PROOF_PATTERN.test(value.proof)) return null;
  return value;
}

function fixedClose(ws, log, code = 'shell_auth_denied') {
  log?.(code);
  try { ws.close(AUTH_CLOSE_CODE, AUTH_CLOSE_REASON); } catch (_error) {}
}

function setConnectionRole(session, role) {
  Object.defineProperty(session, 'connectionRole', {
    value: role,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

function retireConnectionRole(session) {
  if (Object.prototype.hasOwnProperty.call(session, 'connectionRole')) {
    delete session.connectionRole;
  }
}

function createShellAuthOwner(options = {}) {
  const authority = options.authority || null;
  const now = options.now || Date.now;
  const entropy = options.randomBytes || randomBytes;
  const ttlMs = options.ttlMs ?? 10_000;
  const log = options.log;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 30_000) {
    throw new TypeError('Shell auth TTL is invalid');
  }

  const available = Boolean(authority
    && authority.version === AUTH_PROTOCOL_VERSION
    && typeof authority.generation === 'string'
    && GENERATION_PATTERN.test(authority.generation)
    && Buffer.isBuffer(authority.master)
    && authority.master.length === 32);

  function begin({ ws, session, origin }) {
    setConnectionRole(session, 'untrusted');
    if (!available) return Object.freeze({ mode: 'standalone' });
    const issuedAt = now();
    const nonce = Buffer.from(entropy(32));
    if (nonce.length !== 32) throw new TypeError('Shell challenge entropy is invalid');
    const challenge = Object.freeze({
      type: 'shell-auth:challenge',
      version: AUTH_PROTOCOL_VERSION,
      connectionId: session.connectionId,
      serverNonce: nonce.toString('base64url'),
      generation: authority.generation,
      issuedAt,
      expiresAt: issuedAt + ttlMs,
    });
    const state = { status: 'pending', challenge, origin };
    ws.send(JSON.stringify(challenge));
    return state;
  }

  function verify({ ws, session, state, value }) {
    if (!available || !state || state.status !== 'pending') {
      retireConnectionRole(session);
      fixedClose(ws, log);
      return false;
    }
    state.status = 'consumed';
    const proof = parseProof(value);
    const challenge = state.challenge;
    const currentTime = now();
    if (state.origin !== SHELL_ORIGIN
      || !proof
      || currentTime < challenge.issuedAt
      || currentTime >= challenge.expiresAt
      || proof.connectionId !== challenge.connectionId
      || proof.serverNonce !== challenge.serverNonce
      || proof.generation !== challenge.generation
      || proof.expiresAt !== challenge.expiresAt) {
      retireConnectionRole(session);
      fixedClose(ws, log);
      return false;
    }
    const expected = createHmac('sha256', authority.master)
      .update(proofInput(challenge, proof.rendererNonce))
      .digest();
    const supplied = Buffer.from(proof.proof, 'base64url');
    if (supplied.length !== expected.length
      || supplied.toString('base64url') !== proof.proof
      || !timingSafeEqual(supplied, expected)) {
      retireConnectionRole(session);
      fixedClose(ws, log);
      return false;
    }
    setConnectionRole(session, 'trusted-shell');
    return true;
  }

  function retire({ session }) {
    retireConnectionRole(session);
  }

  return Object.freeze({ available, begin, verify, retire });
}

module.exports = {
  AUTH_CLOSE_CODE,
  AUTH_CLOSE_REASON,
  AUTH_PROTOCOL_VERSION,
  SHELL_ORIGIN,
  createShellAuthOwner,
  parseProof,
  proofInput,
};
