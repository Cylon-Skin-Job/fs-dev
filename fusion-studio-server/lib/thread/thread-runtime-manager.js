/**
 * @module thread-runtime-manager
 * @role Own server-side chat thread runtime state keyed by structured thread identity.
 */

const RUNTIME_STATES = Object.freeze({
  COLD: 'cold',
  WARMING: 'warming',
  READY: 'ready',
  IN_FLIGHT: 'in_flight',
  STOPPING: 'stopping',
});

const liveTurnSnapshot = require('./live-turn-snapshot');

class ThreadRuntimeManager {
  constructor() {
    this.runtimes = new Map();
  }

  makeKey(key) {
    if (!key || !key.workspaceId || !key.threadId) {
      throw new Error('Thread runtime key requires workspaceId and threadId');
    }

    if (key.scope === 'project') {
      return `project:${key.workspaceId}:${key.threadId}`;
    }

    if (key.scope === 'view') {
      if (!key.viewId) {
        throw new Error('View thread runtime key requires viewId');
      }
      return `view:${key.workspaceId}:${key.viewId}:${key.threadId}`;
    }

    throw new Error(`Unsupported thread runtime scope: ${key.scope}`);
  }

  ensureRuntime(key) {
    const serializedKey = this.makeKey(key);
    let runtime = this.runtimes.get(serializedKey);
    if (!runtime) {
      runtime = {
        key: { ...key },
        state: RUNTIME_STATES.COLD,
        warmPromise: null,
        liveTurn: null,
        liveToolArgs: new Map(),
        updatedAt: Date.now(),
      };
      this.runtimes.set(serializedKey, runtime);
    }
    return runtime;
  }

  getRuntimeState(key) {
    const runtime = this.runtimes.get(this.makeKey(key));
    return runtime?.state || RUNTIME_STATES.COLD;
  }

  markState(key, state) {
    if (!Object.values(RUNTIME_STATES).includes(state)) {
      throw new Error(`Unsupported thread runtime state: ${state}`);
    }
    const runtime = this.ensureRuntime(key);
    runtime.state = state;
    runtime.updatedAt = Date.now();
    return runtime.state;
  }

  markReady(key) {
    return this.markState(key, RUNTIME_STATES.READY);
  }

  markWarming(key, warmPromise) {
    const runtime = this.ensureRuntime(key);
    runtime.state = RUNTIME_STATES.WARMING;
    runtime.warmPromise = warmPromise;
    runtime.updatedAt = Date.now();
    return runtime;
  }

  getWarmPromise(key) {
    return this.ensureRuntime(key).warmPromise;
  }

  clearWarmPromise(key) {
    const runtime = this.ensureRuntime(key);
    runtime.warmPromise = null;
    runtime.updatedAt = Date.now();
  }

  markInFlight(key) {
    return this.markState(key, RUNTIME_STATES.IN_FLIGHT);
  }

  markCold(key) {
    const runtime = this.ensureRuntime(key);
    runtime.state = RUNTIME_STATES.COLD;
    runtime.warmPromise = null;
    runtime.updatedAt = Date.now();
    return runtime.state;
  }

  coolIfIdle(key) {
    const runtime = this.runtimes.get(this.makeKey(key));
    if (!runtime) return RUNTIME_STATES.COLD;
    if (runtime.state === RUNTIME_STATES.IN_FLIGHT || runtime.state === RUNTIME_STATES.STOPPING) {
      return runtime.state;
    }
    runtime.state = RUNTIME_STATES.COLD;
    runtime.updatedAt = Date.now();
    return runtime.state;
  }

  beginLiveTurn(key, payload) {
    const runtime = this.ensureRuntime(key);
    runtime.liveTurn = liveTurnSnapshot.beginLiveTurn(key, payload);
    runtime.liveToolArgs.clear();
    return runtime.liveTurn;
  }

  appendLiveContent(key, text) {
    const runtime = this.ensureRuntime(key);
    liveTurnSnapshot.appendContent(runtime.liveTurn, text);
  }

  appendLiveThinking(key, text) {
    const runtime = this.ensureRuntime(key);
    liveTurnSnapshot.appendThinking(runtime.liveTurn, text);
  }

  appendLiveToolCall(key, payload) {
    const runtime = this.ensureRuntime(key);
    liveTurnSnapshot.appendToolCall(runtime.liveTurn, payload);
    if (payload.toolCallId) {
      runtime.liveToolArgs.set(payload.toolCallId, '');
    }
  }

  appendLiveToolArgs(key, toolCallId, argsChunk) {
    if (!toolCallId || !argsChunk) return;
    const runtime = this.ensureRuntime(key);
    const next = `${runtime.liveToolArgs.get(toolCallId) || ''}${argsChunk}`;
    runtime.liveToolArgs.set(toolCallId, next);
    try {
      liveTurnSnapshot.applyToolArgs(runtime.liveTurn, toolCallId, JSON.parse(next));
    } catch (_) {
      // Tool args often arrive as partial JSON. Keep buffering until parseable.
    }
  }

  applyLiveToolResult(key, payload) {
    const runtime = this.ensureRuntime(key);
    liveTurnSnapshot.applyToolResult(runtime.liveTurn, payload);
    if (payload.toolCallId) {
      runtime.liveToolArgs.delete(payload.toolCallId);
    }
  }

  touchLiveTurn(key) {
    const runtime = this.ensureRuntime(key);
    liveTurnSnapshot.touchStatus(runtime.liveTurn);
  }

  completeLiveTurn(key, status = 'complete') {
    const runtime = this.ensureRuntime(key);
    liveTurnSnapshot.completeLiveTurn(runtime.liveTurn, status);
    runtime.liveToolArgs.clear();
  }

  getLiveTurn(key) {
    const runtime = this.runtimes.get(this.makeKey(key));
    return liveTurnSnapshot.cloneLiveTurn(runtime?.liveTurn || null);
  }
}

const threadRuntimeManager = new ThreadRuntimeManager();

module.exports = {
  RUNTIME_STATES,
  ThreadRuntimeManager,
  threadRuntimeManager,
};
