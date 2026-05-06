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
 *   - open-robin-server/lib/clipboard/ws-handlers.js — every send uses
 *     `{ type: 'clipboard:...', ... }`. Outbound responses wrap the row as
 *     `{ type: 'clipboard:append', item }`, hence the `item.text`/`item.value`
 *     paths in addition to top-level `text`/`value` for inbound messages.
 *   - open-robin-server/lib/secrets/api-keys/handlers.js — same convention,
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

const RULES = {
  'clipboard:append': { redactPaths: ['text', 'value', 'item.text', 'item.value'] },
  'clipboard:use':    { redactPaths: ['text', 'value', 'item.text', 'item.value'] },
  'secrets:api-keys:set': { redactPaths: ['value'] },
};

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
  const rule = getRule(msg);
  if (!rule) return msg;
  const clone = JSON.parse(JSON.stringify(msg));
  for (const path of rule.redactPaths) {
    setAtPath(clone, path, REDACTED);
  }
  return clone;
}

module.exports = { redactWsMessage, RULES, REDACTED };
