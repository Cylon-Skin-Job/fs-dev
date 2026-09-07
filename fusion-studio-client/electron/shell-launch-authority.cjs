'use strict';

const { createHmac, randomBytes, randomUUID } = require('node:crypto');

const AUTH_PROTOCOL_VERSION = 1;
const MASTER_BYTES = 32;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const GENERATION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const CONNECTION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_ACTIVE_CHALLENGES = 512;

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.every((key) => typeof key === 'string')
    && keys.length === expected.length
    && [...keys].sort().every((key, index) => key === [...expected].sort()[index]);
}

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateChallenge(value, generation, now) {
  const keys = ['type', 'version', 'connectionId', 'serverNonce', 'generation', 'issuedAt', 'expiresAt'];
  if (!exactKeys(value, keys)) return null;
  if (value.type !== 'shell-auth:challenge' || value.version !== AUTH_PROTOCOL_VERSION) return null;
  if (typeof value.connectionId !== 'string' || !CONNECTION_ID_PATTERN.test(value.connectionId)) return null;
  if (typeof value.serverNonce !== 'string' || !NONCE_PATTERN.test(value.serverNonce)) return null;
  if (value.generation !== generation || !GENERATION_PATTERN.test(value.generation)) return null;
  if (!validTimestamp(value.issuedAt) || !validTimestamp(value.expiresAt)) return null;
  if (value.expiresAt <= value.issuedAt || value.expiresAt - value.issuedAt > 30_000) return null;
  if (now < value.issuedAt - 1_000 || now >= value.expiresAt) return null;
  return value;
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

function createShellLaunchAuthority(options = {}) {
  const entropy = options.randomBytes || randomBytes;
  const createGeneration = options.createGeneration || randomUUID;
  const now = options.now || Date.now;
  const master = Buffer.from(entropy(MASTER_BYTES));
  const generation = createGeneration();
  if (master.length !== MASTER_BYTES) throw new TypeError('Shell authority entropy is invalid');
  if (typeof generation !== 'string' || !GENERATION_PATTERN.test(generation)) {
    throw new TypeError('Shell authority generation is invalid');
  }

  let bootstrapTaken = false;
  const consumed = new Map();

  const prune = (currentTime) => {
    for (const [key, expiresAt] of consumed) {
      if (expiresAt <= currentTime) consumed.delete(key);
    }
  };

  return Object.freeze({
    get generation() {
      return generation;
    },
    takeBootstrapPayload() {
      if (bootstrapTaken) throw new Error('Shell bootstrap already consumed');
      bootstrapTaken = true;
      return `${JSON.stringify({
        version: AUTH_PROTOCOL_VERSION,
        generation,
        master: master.toString('base64url'),
      })}\n`;
    },
    sign(challengeValue, rendererNonceValue) {
      const currentTime = now();
      const challenge = validateChallenge(challengeValue, generation, currentTime);
      if (!challenge || typeof rendererNonceValue !== 'string' || !NONCE_PATTERN.test(rendererNonceValue)) {
        return null;
      }
      prune(currentTime);
      const key = `${challenge.connectionId}:${challenge.serverNonce}`;
      if (consumed.has(key) || consumed.size >= MAX_ACTIVE_CHALLENGES) return null;
      consumed.set(key, challenge.expiresAt);
      const proof = createHmac('sha256', master)
        .update(proofInput(challenge, rendererNonceValue))
        .digest('base64url');
      return Object.freeze({
        type: 'shell-auth:proof',
        version: AUTH_PROTOCOL_VERSION,
        connectionId: challenge.connectionId,
        serverNonce: challenge.serverNonce,
        rendererNonce: rendererNonceValue,
        generation,
        expiresAt: challenge.expiresAt,
        proof,
      });
    },
  });
}

module.exports = {
  AUTH_PROTOCOL_VERSION,
  CONNECTION_ID_PATTERN,
  GENERATION_PATTERN,
  MASTER_BYTES,
  NONCE_PATTERN,
  createShellLaunchAuthority,
  proofInput,
  validateChallenge,
};
