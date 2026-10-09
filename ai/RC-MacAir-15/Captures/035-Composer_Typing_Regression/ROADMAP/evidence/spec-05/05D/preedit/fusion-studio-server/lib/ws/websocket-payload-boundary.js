'use strict';

const { MAX_SHELL_AUTH_FRAME_BYTES } = require('./client-frame-decoder');

// Preserve the established product-frame ceiling after authentication while
// making the unauthenticated receiver protocol-sized.
const MAX_APPLICATION_FRAME_BYTES = 100 * 1024 * 1024;

function activateApplicationPayloadLimit(ws) {
  const receiver = ws?._receiver;
  if (!receiver || receiver._maxPayload !== MAX_SHELL_AUTH_FRAME_BYTES) {
    throw new Error('WebSocket payload boundary unavailable');
  }
  receiver._maxPayload = MAX_APPLICATION_FRAME_BYTES;
}

module.exports = {
  MAX_APPLICATION_FRAME_BYTES,
  MAX_SHELL_AUTH_FRAME_BYTES,
  activateApplicationPayloadLimit,
};
