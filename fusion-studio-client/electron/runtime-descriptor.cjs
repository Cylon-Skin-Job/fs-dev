'use strict';

const { randomUUID } = require('node:crypto');

const GENERATION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function assertRuntimePort(port) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('Runtime port must be an integer from 1 through 65535');
  }
  return port;
}

function createRuntimeDescriptor(port, generation = randomUUID()) {
  assertRuntimePort(port);
  if (typeof generation !== 'string' || !GENERATION_PATTERN.test(generation)) {
    throw new TypeError('Runtime generation is invalid');
  }
  return Object.freeze({
    generation,
    httpOrigin: `http://127.0.0.1:${port}`,
    webSocketUrl: `ws://127.0.0.1:${port}`,
  });
}

function createRuntimeDescriptorOwner(options = {}) {
  const createGeneration = options.createGeneration || randomUUID;
  let current = null;

  return Object.freeze({
    activate(port, generation = createGeneration()) {
      current = createRuntimeDescriptor(port, generation);
      return current;
    },
    clear() {
      current = null;
    },
    getCurrent() {
      return current;
    },
  });
}

module.exports = {
  GENERATION_PATTERN,
  assertRuntimePort,
  createRuntimeDescriptor,
  createRuntimeDescriptorOwner,
};
