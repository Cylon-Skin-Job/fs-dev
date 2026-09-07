/**
 * Per-WS-message-type redaction map.
 *
 * Used by the WS debug logger (Wave 3, Brief W3G) to scrub credential-bearing
 * fields before `JSON.stringify(msg)` lands in server-live.log.
 *
 * Adding a new message type that carries a value? Add an entry to RULES below.
 *
 * --- Envelope key: msg.type ----------------------------------------------
 * The WS message envelope's type discriminator is `msg.type` (string).
 * Confirmed by inspection of:
 *   - fusion-studio-server/lib/clipboard/ws-handlers.js — every send uses
 *     `{ type: 'clipboard:...', ... }`. Outbound responses wrap the row as
 *     `{ type: 'clipboard:append', item }`, hence the `item.text`/`item.value`
 *     paths in addition to top-level `text`/`value` for inbound messages.
 *   - fusion-studio-server/lib/secrets/api-keys/handlers.js — same convention,
 *     `{ type: 'secrets:api-keys:set', ... }`.
 *
 * If a future message family adopts a different discriminator (e.g. `msg.kind`
 * or `msg.event`), update `getRule()` here — keep the envelope-key choice in
 * one place so Wave 3's logger can stay agnostic.
 *
 * Pure module: no I/O, no logging, no state.
 */

'use strict';

const REDACTED = '[redacted]';

const AUTH_DIAGNOSTIC_KEY_MARKERS = Object.freeze([
  'master',
  'generation',
  'proof',
  'challenge',
  'nonce',
  'authorization',
  'authentication',
  'authority',
  'credential',
  'signature',
  'hmac',
  'digest',
  'bearer',
  'secret',
  'token',
  'derivedkey',
  'shellsecret',
  'bootstrapsecret',
]);

const CHAT_TURN_NOTE_REDACTION_PATHS = [
  'note.body',
  'patch.note.body',
  'metadata.note.body',
  'payload.note.body',
  'payload.patch.note.body',
  'payload.metadata.note.body',
];

const RULES = {
  'shell-auth:challenge': { redactPaths: ['serverNonce'] },
  'shell-auth:proof': { redactPaths: ['serverNonce', 'rendererNonce', 'proof'] },
  client_log: { redactPaths: ['level', 'message', 'data'] },
  'clipboard:append': { redactPaths: ['text', 'value', 'item.text', 'item.value'] },
  'clipboard:use':    { redactPaths: ['text', 'value', 'item.text', 'item.value'] },
  'secrets:api-keys:set': { redactPaths: ['value'] },
  'chat-turn:metadata:update': { redactPaths: CHAT_TURN_NOTE_REDACTION_PATHS },
  'chat-turn:metadata:updated': { redactPaths: CHAT_TURN_NOTE_REDACTION_PATHS },
  'chat-turn:metadata:error': { redactPaths: CHAT_TURN_NOTE_REDACTION_PATHS },
  'agent:activity:query': { redactPaths: ['path', 'folderPrefix', 'fileName'] },
  'provenance:test:agent_tool': { redactPaths: ['nonce'] },
  file_save: { redactPaths: ['content'] },
};

function isAuthDiagnosticKey(key) {
  if (typeof key !== 'string') return false;
  const normalized = key.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
  return AUTH_DIAGNOSTIC_KEY_MARKERS.some((marker) => normalized.includes(marker));
}

function redactAuthDiagnosticFields(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const clone = Array.isArray(value) ? [] : {};
  seen.set(value, clone);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') continue;
    const descriptor = descriptors[key];
    if (!descriptor.enumerable) continue;
    if (isAuthDiagnosticKey(key)) {
      clone[key] = REDACTED;
    } else if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      clone[key] = redactAuthDiagnosticFields(descriptor.value, seen);
    } else {
      clone[key] = REDACTED;
    }
  }
  return clone;
}

function setAtPath(obj, path, value) {
  const parts = path.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cursor[parts[i]];
    if (next === null || typeof next !== 'object') return;
    cursor = next;
  }
  const leaf = parts[parts.length - 1];
  if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
    cursor[leaf] = value;
  }
}

function getRule(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const type = msg.type;
  if (typeof type !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(RULES, type) ? RULES[type] : null;
}

function redactWsMessage(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  const clone = redactAuthDiagnosticFields(msg);
  const rule = getRule(msg);
  if (rule) {
    for (const path of rule.redactPaths) {
      setAtPath(clone, path, REDACTED);
    }
  }
  return clone;
}

module.exports = {
  AUTH_DIAGNOSTIC_KEY_MARKERS,
  REDACTED,
  RULES,
  isAuthDiagnosticKey,
  redactWsMessage,
};
