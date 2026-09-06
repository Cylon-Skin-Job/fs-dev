'use strict';

const { compareOrdinalStrings } = require('../event-registry/ordinal');

const ALLOWED_HANDLER_KEYS = Object.freeze([
  'system.provenance-ledger',
  'system.resource-render-projection',
  'system.agent-provenance-ledger',
  'system.agent-resource-observer',
]);

function createHandlerCatalog(handlers = {}) {
  if (!handlers || typeof handlers !== 'object' || Array.isArray(handlers)) {
    throw new TypeError('handler catalog input must be an object');
  }
  for (const key of Object.keys(handlers)) {
    if (!ALLOWED_HANDLER_KEYS.includes(key)) throw new TypeError(`Unknown handler ${key}`);
    if (typeof handlers[key] !== 'function') throw new TypeError(`Handler ${key} must be a function`);
  }
  const installed = new Map(Object.entries(handlers));
  return Object.freeze({
    get(handlerKey) {
      return installed.get(handlerKey) || null;
    },
    has(handlerKey) {
      return installed.has(handlerKey);
    },
    keys() {
      return Object.freeze([...installed.keys()].sort(compareOrdinalStrings));
    },
  });
}

module.exports = { createHandlerCatalog };
