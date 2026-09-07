'use strict';

const {
  ClientFrameError,
  MAX_SHELL_AUTH_FRAME_BYTES,
  getClientFrameByteLength,
  decodeClientTextFrame,
} = require('./client-frame-decoder');
const { AUTH_CLOSE_CODE, AUTH_CLOSE_REASON } = require('./shell-auth');

const MAX_STANDALONE_INITIALIZATION_FRAMES = 64;
const MAX_STANDALONE_INITIALIZATION_BYTES = MAX_STANDALONE_INITIALIZATION_FRAMES
  * MAX_SHELL_AUTH_FRAME_BYTES;
const STANDALONE_INITIALIZATION_CLOSE_CODE = 1013;
const STANDALONE_INITIALIZATION_CLOSE_REASON = 'server initialization pending';

function closeAuthentication(ws, log) {
  log?.('shell_auth_denied');
  try { ws.close(AUTH_CLOSE_CODE, AUTH_CLOSE_REASON); } catch (_error) {}
}

function createShellAuthDispatch({
  authOwner,
  ws,
  session,
  origin,
  initialize,
  activate,
  activateTransport = async () => {},
  handleNext,
  log,
  schedule = setTimeout,
  cancel = clearTimeout,
  now = Date.now,
}) {
  if (typeof initialize !== 'function' || typeof activate !== 'function'
    || typeof activateTransport !== 'function' || typeof handleNext !== 'function') {
    throw new TypeError('shell authentication dispatch capabilities are required');
  }
  const standalone = !authOwner.available;
  let phase = standalone ? 'initializing' : 'pending';
  let standaloneQueue = [];
  let standaloneQueueBytes = 0;
  let closeObserved = false;
  let closeRequested = false;
  let expiryTimer = null;
  const cancelExpiry = () => {
    if (expiryTimer === null) return;
    cancel(expiryTimer);
    expiryTimer = null;
  };
  let authorityRetired = false;
  const retireAuthority = () => {
    if (authorityRetired) return;
    authorityRetired = true;
    try { authOwner.retire?.({ session }); } catch (_error) {}
  };
  const denyAuthentication = () => {
    phase = 'closed';
    standaloneQueue = [];
    standaloneQueueBytes = 0;
    cancelExpiry();
    retireAuthority();
    closeRequested = true;
    closeAuthentication(ws, log);
  };
  const closeStandaloneInitialization = () => {
    phase = 'closed';
    standaloneQueue = [];
    standaloneQueueBytes = 0;
    cancelExpiry();
    retireAuthority();
    log?.('standalone_initialization_overflow');
    closeRequested = true;
    try {
      ws.close(STANDALONE_INITIALIZATION_CLOSE_CODE, STANDALONE_INITIALIZATION_CLOSE_REASON);
    } catch (_error) {}
  };
  let authState;
  try {
    authState = authOwner.begin({ ws, session, origin });
  } catch (error) {
    retireAuthority();
    throw error;
  }
  expiryTimer = authOwner.available
    ? schedule(() => {
        if (phase !== 'pending') return;
        denyAuthentication();
      }, Math.max(0, authState.challenge.expiresAt - now()))
    : null;
  ws.once?.('close', () => {
    closeObserved = true;
    phase = 'closed';
    standaloneQueue = [];
    standaloneQueueBytes = 0;
    cancelExpiry();
    retireAuthority();
  });

  const initializationWasClosed = () => {
    if (phase !== 'closed') return false;
    if (closeObserved && !closeRequested) {
      closeRequested = true;
      try { ws.close(1011, 'workspace initialization failed'); } catch (_error) {}
    }
    return true;
  };

  const completeInitialization = async (sendAuthenticated) => {
    try {
      await initialize();
      if (initializationWasClosed()) return;
      await activateTransport();
      if (initializationWasClosed()) return;
      await activate();
      if (initializationWasClosed()) return;
      if (standalone) {
        phase = 'draining';
        while (standaloneQueue.length > 0 && phase === 'draining') {
          const queued = standaloneQueue.shift();
          standaloneQueueBytes -= queued.byteLength;
          await handleNext(queued.message, queued.isBinary);
        }
        if (phase !== 'draining') return;
      }
      phase = 'active';
      if (sendAuthenticated) {
        ws.send(JSON.stringify({ type: 'shell-auth:authenticated', version: 1 }));
      }
    } catch (_error) {
      phase = 'closed';
      standaloneQueue = [];
      standaloneQueueBytes = 0;
      cancelExpiry();
      retireAuthority();
      closeRequested = true;
      try { ws.close(1011, 'workspace initialization failed'); } catch (_closeError) {}
    }
  };

  if (!authOwner.available) void completeInitialization(false);

  return async function dispatch(message, isBinary = false) {
    if (phase === 'active') {
      try {
        const value = decodeClientTextFrame(message, isBinary).value;
        if (value && typeof value === 'object' && !Array.isArray(value)
          && typeof value.type === 'string'
          && value.type.startsWith('shell-auth:')) {
          denyAuthentication();
          return;
        }
      } catch (_error) {
        // The application decoder owns ordinary malformed/binary close codes.
      }
      return handleNext(message, isBinary);
    }
    if (standalone && (phase === 'initializing' || phase === 'draining')) {
      const byteLength = getClientFrameByteLength(message);
      if (byteLength === null
        || standaloneQueue.length >= MAX_STANDALONE_INITIALIZATION_FRAMES
        || standaloneQueueBytes + byteLength > MAX_STANDALONE_INITIALIZATION_BYTES) {
        closeStandaloneInitialization();
        return;
      }
      standaloneQueue.push({ message, isBinary, byteLength });
      standaloneQueueBytes += byteLength;
      return;
    }
    if (phase !== 'pending') {
      denyAuthentication();
      return;
    }
    let value;
    try {
      value = decodeClientTextFrame(message, isBinary, {
        maxBytes: MAX_SHELL_AUTH_FRAME_BYTES,
      }).value;
    } catch (error) {
      if (error instanceof ClientFrameError) {
        denyAuthentication();
        return;
      }
      throw error;
    }
    phase = 'initializing';
    cancelExpiry();
    if (!authOwner.verify({ ws, session, state: authState, value })) {
      phase = 'closed';
      retireAuthority();
      return;
    }
    await completeInitialization(true);
  };
}

module.exports = { createShellAuthDispatch };
