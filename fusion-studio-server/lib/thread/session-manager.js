/**
 * SessionManager - Manages active wire sessions, idle timeouts, and LRU eviction
 *
 * Owns:
 * - activeSessions Map (threadId → ThreadSession)
 * - timeouts Map (threadId → timeout handle)
 * - maxActiveSessions / idleTimeoutMinutes config
 *
 * Does NOT know about ThreadIndex, ChatFile, or thread CRUD.
 * Accepts an onClose callback to notify the owner when a session closes.
 */

const { setSafeTimeout } = require('../background-services/safety');

const PROVIDER_CLOSE_GRACE_MS = 5_000;
const PROVIDER_CLOSE_FORCE_MS = 5_000;

function createWireTerminationWaiter(wireProcess) {
  if (!wireProcess) return null;
  if (wireProcess.exitCode !== undefined && wireProcess.exitCode !== null) {
    return { promise: Promise.resolve(), cancel() {} };
  }
  if (wireProcess.signalCode !== undefined && wireProcess.signalCode !== null) {
    return { promise: Promise.resolve(), cancel() {} };
  }
  if (typeof wireProcess.once !== 'function') return null;

  let settled = false;
  let resolveWait;
  const promise = new Promise((resolve) => {
    resolveWait = resolve;
  });
  const cleanup = () => {
    wireProcess.removeListener?.('exit', finish);
    wireProcess.removeListener?.('close', finish);
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveWait();
  };
  wireProcess.once('exit', finish);
  wireProcess.once('close', finish);
  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      cleanup();
      resolveWait();
    },
  };
}

function awaitBoundedProviderTermination(terminationPromise, timeoutMs) {
  let timeout;
  return Promise.race([
    Promise.resolve(terminationPromise),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('Provider process did not close during workspace retirement'));
      }, timeoutMs);
      timeout.unref?.();
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function terminateProviderProcessAndWait(
  wireProcess,
  graceMs = PROVIDER_CLOSE_GRACE_MS,
  forceMs = PROVIDER_CLOSE_FORCE_MS,
) {
  const stopMethod = typeof wireProcess?._stopSession === 'function'
    ? wireProcess._stopSession.bind(wireProcess)
    : (typeof wireProcess?.stop === 'function' ? wireProcess.stop.bind(wireProcess) : null);
  if (typeof wireProcess?.kill !== 'function' && stopMethod) {
    try {
      await awaitBoundedProviderTermination(stopMethod('SIGTERM'), graceMs);
      return;
    } catch (_graceError) {
      await awaitBoundedProviderTermination(stopMethod('SIGKILL'), forceMs);
      return;
    }
  }

  const eventWaiter = typeof wireProcess?._waitForTermination === 'function'
    ? null
    : createWireTerminationWaiter(wireProcess);
  const terminationPromise = () => {
    if (typeof wireProcess?._waitForTermination === 'function') {
      return wireProcess._waitForTermination();
    }
    if (eventWaiter) return eventWaiter.promise;
    return Promise.reject(new Error('Provider process has no termination contract'));
  };

  try {
    const alreadyExited = (wireProcess?.exitCode !== undefined && wireProcess.exitCode !== null)
      || (wireProcess?.signalCode !== undefined && wireProcess.signalCode !== null);
    if (wireProcess && !wireProcess.killed && !alreadyExited) wireProcess.kill('SIGTERM');
    await awaitBoundedProviderTermination(terminationPromise(), graceMs);
  } catch (_graceError) {
    try { wireProcess?.kill?.('SIGKILL'); } catch (_signalError) {}
    await awaitBoundedProviderTermination(terminationPromise(), forceMs);
  }
}

class SessionManager {
  /**
   * @param {object} [config]
   * @param {number} [config.maxActiveSessions]
   * @param {number} [config.idleTimeoutMinutes]
   * @param {function} [onClose] - Called with (threadId) when a session closes (explicit or timeout)
   */
  constructor(config = {}, onClose = null) {
    this.maxActiveSessions = config.maxActiveSessions ?? 10;
    this.idleTimeoutMinutes = config.idleTimeoutMinutes ?? 9;
    this.providerCloseGraceMs = config.providerCloseGraceMs ?? PROVIDER_CLOSE_GRACE_MS;
    this.providerCloseForceMs = config.providerCloseForceMs ?? PROVIDER_CLOSE_FORCE_MS;

    if (typeof this.idleTimeoutMinutes !== 'number' || this.idleTimeoutMinutes <= 0) {
      throw new Error(`idleTimeoutMinutes must be a positive number, got: ${config.idleTimeoutMinutes}`);
    }
    if (typeof this.providerCloseGraceMs !== 'number' || this.providerCloseGraceMs <= 0
      || typeof this.providerCloseForceMs !== 'number' || this.providerCloseForceMs <= 0) {
      throw new Error('provider close timeouts must be positive numbers');
    }

    this._onClose = onClose;

    /** @type {Map<string, import('./types').ThreadSession>} */
    this.activeSessions = new Map();

    /** @type {Map<string, NodeJS.Timeout>} */
    this.timeouts = new Map();
  }

  /**
   * Register an active session
   * @param {string} threadId
   * @param {string} panelId
   * @param {import('child_process').ChildProcess} wireProcess
   * @param {import('ws').WebSocket} [ws]
   * @returns {import('./types').ThreadSession}
   */
  openSession(threadId, panelId, wireProcess, ws = null, options = {}) {
    const existing = this.activeSessions.get(threadId);
    if (existing) {
      if (existing.state === 'stopping') {
        throw new Error('Provider termination is still pending');
      }
      if (existing.pendingActivation) {
        throw new Error('Provider activation ownership is still pending');
      }
      if (existing.wireProcess !== wireProcess) {
        throw new Error('A live provider already owns this thread');
      }
      const previousWs = existing.ws;
      const previousWorkspaceEpoch = existing.workspaceEpoch || null;
      existing.panelId = panelId;
      existing.ws = ws;
      existing.workspaceEpoch = options.workspaceEpoch || null;
      existing.projectRoot = options.projectRoot || existing.projectRoot || null;
      existing.lastActivity = Date.now();
      existing.state = 'active';
      if (options.activationToken) {
        existing.pendingActivation = {
          token: options.activationToken,
          completion: options.activationCompletion,
          previousWs,
          previousWorkspaceEpoch,
          nextWs: ws,
          nextWorkspaceEpoch: existing.workspaceEpoch,
          hadExistingOwner: true,
        };
      }
      this._setIdleTimeout(threadId);
      return existing;
    }

    /** @type {import('./types').ThreadSession} */
    const session = {
      threadId,
      panelId,
      wireProcess,
      ws,
      lastActivity: Date.now(),
      state: 'active'
    };
    session.workspaceEpoch = options.workspaceEpoch || null;
    session.projectRoot = options.projectRoot || null;
    if (options.activationToken) {
      session.pendingActivation = {
        token: options.activationToken,
        completion: options.activationCompletion,
        previousWs: null,
        previousWorkspaceEpoch: null,
        nextWs: ws,
        nextWorkspaceEpoch: session.workspaceEpoch,
        hadExistingOwner: false,
      };
    }

    this.activeSessions.set(threadId, session);
    this._setIdleTimeout(threadId);

    return session;
  }

  /**
   * Atomically reserve an exact connection-owned session for retirement.
   * Once marked stopping, same-wire ownership transfer and replacement both
   * fail closed until closeSessionAndWait proves provider exit.
   */
  beginSessionRetirement(threadId, ws) {
    const session = this.activeSessions.get(threadId);
    if (!session) return null;
    const transfer = session.pendingActivation;
    const ownsCurrent = session.ws === ws;
    const ownsTransferPredecessor = transfer?.hadExistingOwner === true
      && transfer.previousWs === ws;
    if (!ownsCurrent && !ownsTransferPredecessor) return null;
    if (session.state === 'stopping') return session;
    this._clearIdleTimeout(threadId);
    // When the former owner retires during a same-wire transfer, reclaim the
    // exact session before marking it stopping. The in-progress activation
    // will then fail its commit and cannot restore this retired owner.
    if (ownsTransferPredecessor) session.ws = ws;
    session.state = 'stopping';
    return session;
  }

  commitSessionActivation(threadId, session, token) {
    if (this.activeSessions.get(threadId) !== session) return false;
    const pending = session.pendingActivation;
    if (!pending || pending.token !== token) return false;
    return session.state === 'active' && session.ws === pending.nextWs;
  }

  rollbackSessionActivation(threadId, session, token) {
    if (this.activeSessions.get(threadId) !== session) return false;
    const pending = session.pendingActivation;
    if (!pending || pending.token !== token || session.state !== 'active') return false;
    if (pending.hadExistingOwner) {
      session.ws = pending.previousWs;
      session.workspaceEpoch = pending.previousWorkspaceEpoch;
    }
    return true;
  }

  /**
   * Restore a completed same-wire transfer when a different predecessor on
   * the challenger connection cannot retire. The exact session/wire/current
   * owner comparison prevents this rollback from overwriting a later owner.
   */
  restoreSessionOwner(threadId, expectedSession, expectedWire, expectedWs, previous = {}) {
    const session = this.activeSessions.get(threadId);
    if (session !== expectedSession || session?.wireProcess !== expectedWire
      || session?.ws !== expectedWs || session?.state !== 'active') return false;
    session.ws = previous.ws || null;
    session.workspaceEpoch = previous.workspaceEpoch || null;
    session.lastActivity = Date.now();
    this._setIdleTimeout(threadId);
    return true;
  }

  finishSessionActivation(threadId, session, token) {
    const pending = session.pendingActivation;
    if (!pending || pending.token !== token) return false;
    delete session.pendingActivation;
    return true;
  }

  /**
   * Close a session (kill process, remove from map, clear timeout)
   * @param {string} threadId
   * @returns {boolean} true if session existed and was closed
   */
  closeSession(threadId) {
    const session = this.activeSessions.get(threadId);
    if (!session) return false;
    if (session.state === 'stopping') {
      throw new Error('Provider termination is still pending');
    }

    this._clearIdleTimeout(threadId);

    if (session.wireProcess && !session.wireProcess.killed) {
      session.wireProcess.kill('SIGTERM');
    }

    this.activeSessions.delete(threadId);
    return true;
  }

  /**
   * Close a session and wait until its provider process has actually stopped.
   * Workspace retirement uses this stronger contract so a replacement
   * workspace cannot become live while the retired provider is still able to
   * run. Ordinary lifecycle callers retain closeSession's synchronous API.
   *
   * @param {string} threadId
   * @returns {Promise<boolean>}
   */
  async closeSessionAndWait(threadId, options = {}) {
    const session = this.activeSessions.get(threadId);
    if (!session) return false;
    if (session.closePromise) return session.closePromise;

    const closePromise = this._closeOwnedSessionAndWait(threadId, session, options);
    session.closePromise = closePromise;
    try {
      return await closePromise;
    } finally {
      if (session.closePromise === closePromise) delete session.closePromise;
    }
  }

  async _closeOwnedSessionAndWait(threadId, session, options = {}) {
    if (this.activeSessions.get(threadId) !== session) return false;

    const wireProcess = session.wireProcess;
    this._clearIdleTimeout(threadId);
    session.state = 'stopping';

    // A retirement may reserve either side of an in-progress exact-wire
    // transfer. Let its metadata operation settle before provider teardown so
    // no late activation write can overtake the final suspended state.
    const activationCompletion = session.pendingActivation?.completion;
    if (activationCompletion) await activationCompletion;

    try {
      await terminateProviderProcessAndWait(
        wireProcess,
        options.providerCloseGraceMs ?? this.providerCloseGraceMs,
        options.providerCloseForceMs ?? this.providerCloseForceMs,
      );
    } catch (forceError) {
      // Keep the exact failed owner discoverable. The caller fails closed
      // and cannot admit a replacement while an old provider may still live.
      session.state = 'stopping';
      throw forceError;
    }
    if (this.activeSessions.get(threadId) === session) {
      this.activeSessions.delete(threadId);
    }
    return true;
  }

  /**
   * Forget an exact session whose provider termination has already been
   * proven by its bound runtime control. This deliberately performs no
   * signalling; callers must first await the provider-owned stop contract.
   */
  completeStoppedSession(threadId, expectedWire) {
    const session = this.activeSessions.get(threadId);
    if (!session
      || session.state !== 'stopping'
      || !expectedWire
      || session.wireProcess !== expectedWire) return false;
    this._clearIdleTimeout(threadId);
    this.activeSessions.delete(threadId);
    return true;
  }

  /**
   * Get active session
   * @param {string} threadId
   * @returns {import('./types').ThreadSession|undefined}
   */
  getSession(threadId) {
    return this.activeSessions.get(threadId);
  }

  /**
   * Update session activity (reset idle timer)
   * @param {string} threadId
   */
  touchSession(threadId) {
    const session = this.activeSessions.get(threadId);
    if (session) {
      session.lastActivity = Date.now();
      this._setIdleTimeout(threadId);
    }
  }

  /**
   * Update session WebSocket
   * @param {string} threadId
   * @param {import('ws').WebSocket} ws
   */
  attachWebSocket(threadId, ws) {
    const session = this.activeSessions.get(threadId);
    if (session) {
      session.ws = ws;
    }
  }

  /**
   * Remove WebSocket from session
   * @param {string} threadId
   */
  detachWebSocket(threadId) {
    const session = this.activeSessions.get(threadId);
    if (session) {
      session.ws = null;
    }
  }

  /**
   * Check if thread is currently active
   * @param {string} threadId
   * @returns {boolean}
   */
  isActive(threadId) {
    return this.activeSessions.has(threadId);
  }

  /**
   * Get count of active sessions
   * @returns {number}
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }

  /**
   * Set idle timeout for a session
   * @private
   * @param {string} threadId
   */
  _setIdleTimeout(threadId) {
    this._clearIdleTimeout(threadId);

    const timeoutMs = this.idleTimeoutMinutes * 60 * 1000;
    const timeout = setSafeTimeout(`SessionManager:idle:${threadId}`, async () => {
      console.log(`[SessionManager] Idle timeout for ${threadId}`);
      try {
        const closed = await this.closeSessionAndWait(threadId);
        if (closed && this._onClose) {
          await this._onClose(threadId);
        }
      } catch (error) {
        console.error(`[SessionManager] Idle provider close failed for ${threadId}: ${error.message}`);
      }
    }, timeoutMs);

    this.timeouts.set(threadId, timeout);
  }

  /**
   * Clear idle timeout for a session
   * @private
   * @param {string} threadId
   */
  _clearIdleTimeout(threadId) {
    const timeout = this.timeouts.get(threadId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(threadId);
    }
  }
}

module.exports = { SessionManager, terminateProviderProcessAndWait };
