/** Sole canonical runtime and drain state owner. Async owners use captured ownership stamps. */
const RUNTIME_STATES = Object.freeze({
  COLD: 'cold',
  WARMING: 'warming',
  READY: 'ready',
  IN_FLIGHT: 'in_flight',
  STOPPING: 'stopping',
});

const liveTurnSnapshot = require('./live-turn-snapshot');
const { serializeRuntimeKey, sameRuntimeResource } = require('./runtime-identity');
const {
  createTurnAccumulator,
  settleAccumulatorForTerminal,
} = require('./canonical-turn-accumulator');

const { awaitBoundedDrainCompletion } = require('./canonical-drain-context');

class ThreadRuntimeManager {
  constructor() {
    this.runtimes = new Map();
  }

  makeKey(key) { return serializeRuntimeKey(key); }

  _resourceRuntimes(key) {
    return [...this.runtimes.entries()].filter(([, runtime]) => sameRuntimeResource(runtime.key, key));
  }

  getRuntimeForResource(key) {
    const matches = this._resourceRuntimes(key);
    return matches.length === 1 ? matches[0][1] : null;
  }

  getResourceBusyState(key) {
    for (const [, runtime] of this._resourceRuntimes(key)) {
      if (runtime.activeDrain) return 'draining';
      if (runtime.warmPromise || runtime.state === RUNTIME_STATES.WARMING) return 'accepting';
      if (runtime.state === RUNTIME_STATES.IN_FLIGHT) return 'active';
      if (runtime.state === RUNTIME_STATES.STOPPING) return 'stopping';
    }
    return null;
  }

  async retireResourceDrains(key) {
    const matches = this._resourceRuntimes(key);
    for (const [, runtime] of matches) {
      if (runtime.activeDrain) await this.retireActiveDrain(runtime.key);
    }
    return matches.length;
  }

  fenceResource(key) {
    const matches = this._resourceRuntimes(key);
    for (const [serializedKey, runtime] of matches) {
      runtime.state = RUNTIME_STATES.STOPPING;
      runtime.activeDrain = null;
      runtime.warmPromise = null;
      runtime.liveTurn = null;
      runtime.liveToolArgs.clear();
      runtime.updatedAt = Date.now();
      this.runtimes.delete(serializedKey);
    }
    return matches.length;
  }

  adoptRuntimeIdentity(key) {
    const exactKey = this.makeKey(key);
    const exact = this.runtimes.get(exactKey);
    if (exact) return exact;
    const matches = this._resourceRuntimes(key);
    if (matches.length === 0) return this.ensureRuntime(key);
    if (matches.length !== 1) return null;
    const [previousKey, runtime] = matches[0];
    if (runtime.activeDrain || runtime.warmPromise
      || ![RUNTIME_STATES.COLD, RUNTIME_STATES.READY].includes(runtime.state)) return null;
    this.runtimes.delete(previousKey);
    runtime.key = Object.freeze({ ...key });
    runtime.updatedAt = Date.now();
    this.runtimes.set(exactKey, runtime);
    return runtime;
  }

  ensureRuntime(key) {
    const serializedKey = this.makeKey(key);
    let runtime = this.runtimes.get(serializedKey);
    if (!runtime) {
      runtime = {
        key: Object.freeze({ ...key }),
        state: RUNTIME_STATES.COLD,
        warmPromise: null,
        liveTurn: null,
        liveToolArgs: new Map(),
        activeDrain: null,
        updatedAt: Date.now(),
      };
      this.runtimes.set(serializedKey, runtime);
    }
    return runtime;
  }

  getRuntime(key) {
    return this.runtimes.get(this.makeKey(key)) || null;
  }

  captureOwnership(key) {
    const runtime = this.getRuntime(key);
    return runtime ? Object.freeze({ key: Object.freeze({ ...key }), runtime,
      drainRevision: runtime.drainRevision || 0 }) : null;
  }

  isOwnershipCurrent(ownership) {
    return Boolean(ownership && this.getRuntime(ownership.key) === ownership.runtime
      && (ownership.runtime.drainRevision || 0) === ownership.drainRevision);
  }

  markOwnedState(ownership, state) {
    if (!this.isOwnershipCurrent(ownership)) return false;
    this.markState(ownership.key, state);
    if (state === RUNTIME_STATES.COLD) ownership.runtime.warmPromise = null;
    return true;
  }

  clearOwnedWarmPromise(ownership, promise) {
    if (!this.isOwnershipCurrent(ownership) || ownership.runtime.warmPromise !== promise) return false;
    ownership.runtime.warmPromise = null;
    return true;
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

  markReady(key) { return this.markState(key, RUNTIME_STATES.READY); }

  markWarming(key, warmPromise) {
    const runtime = this.ensureRuntime(key);
    runtime.state = RUNTIME_STATES.WARMING;
    runtime.warmPromise = warmPromise;
    runtime.updatedAt = Date.now();
    return runtime;
  }

  getWarmPromise(key) {
    return this.getRuntime(key)?.warmPromise || null;
  }

  clearWarmPromise(key) {
    const runtime = this.getRuntime(key);
    if (!runtime) return;
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

  claimActiveDrain(key, control, routeContext = null) {
    if (!control || !control.drainId) {
      throw new Error('Active drain claim requires a control with a drainId');
    }
    const runtime = this.ensureRuntime(key);
    if (runtime.activeDrain) {
      console.warn(
        `[ThreadRuntime] Replacing leftover active drain ${runtime.activeDrain.drainId} with ${control.drainId} (stale-record cleanup)`
      );
    }
    runtime.drainRevision = (runtime.drainRevision || 0) + 1;
    runtime.activeDrain = {
      drainId: control.drainId,
      turnId: null,
      control,
      routeContext: routeContext || null,
      completion: null,
      retire: null,
      retirementPromise: null,
    };
    runtime.updatedAt = Date.now();
    return runtime.activeDrain;
  }

  getActiveDrain(key) {
    const runtime = this.runtimes.get(this.makeKey(key));
    return runtime?.activeDrain || null;
  }

  bindActiveDrainLifecycle(key, drainId, { completion, retire }) {
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== drainId) return false;
    if (!completion || typeof completion.then !== 'function' || typeof retire !== 'function') {
      throw new Error('Active drain lifecycle requires completion and retire capabilities');
    }
    if (record.completion || record.retire) {
      throw new Error('Active drain lifecycle is already bound');
    }
    record.completion = completion;
    record.retire = retire;
    runtime.updatedAt = Date.now();
    return true;
  }

  async retireActiveDrain(key) {
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record) return false;
    if (typeof record.retire !== 'function' || !record.completion) {
      throw new Error('Active drain has no retirement lifecycle');
    }
    if (!record.retirementPromise) {
      record.retirementPromise = (async () => {
        const retired = await record.retire();
        if (retired !== true) throw new Error('Canonical drain retirement failed');
        await awaitBoundedDrainCompletion(record.completion);
        return true;
      })();
    }
    return record.retirementPromise;
  }

  isDrainCurrent(key, drainId) {
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    return Boolean(record && record.drainId === drainId);
  }

  beginCanonicalTurn(key, drainId, { turnId, userInput, attachments = [] }) {
    if (typeof turnId !== 'string' || !turnId) {
      return { accepted: false };
    }
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== drainId) {
      return { accepted: false };
    }
    if (record.turn || (record.turnId !== null && record.turnId !== turnId)) {
      return { accepted: false };
    }

    runtime.liveTurn = liveTurnSnapshot.beginLiveTurn(key, {
      turnId,
      userInput,
      attachments,
    });
    runtime.liveToolArgs.clear();
    record.turn = createTurnAccumulator();
    runtime.updatedAt = Date.now();
    return { accepted: true, turnId };
  }

  bindTurnToDrain(key, drainId, turnId) {
    if (typeof turnId !== 'string' || !turnId) return false;
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== drainId) return false;
    if (record.turnId !== null) return false;
    record.turnId = turnId;
    runtime.updatedAt = Date.now();
    return true;
  }

  resolveBoundTurnId(key, drainId) {
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== drainId) return null;
    return record.turnId;
  }

  applyLiveMutation(key, identity, mutator) {
    if (!identity || typeof mutator !== 'function') return null;
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== identity.drainId) return null;
    if (record.turnId === null || record.turnId !== identity.turnId || record.turn?.terminalized) return null;
    mutator({ snapshot: runtime.liveTurn, turn: record.turn });
    return runtime.liveTurn ? runtime.liveTurn.streamSeq : null;
  }

  terminalizeTurn(key, identity, status = 'complete', options = {}) {
    if (!identity || typeof identity.drainId !== 'string') return false;
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== identity.drainId) return false;
    if (!record.turn || record.turn.terminalized || record.turnId !== identity.turnId) return false;
    liveTurnSnapshot.completeLiveTurn(runtime.liveTurn, status, options?.terminalError ?? null);
    settleAccumulatorForTerminal(record.turn);
    runtime.liveToolArgs.clear();
    runtime.updatedAt = Date.now();
    return true;
  }

  clearActiveDrainIfCurrent(key, drainId) {
    const runtime = this.runtimes.get(this.makeKey(key));
    if (!runtime?.activeDrain || runtime.activeDrain.drainId !== drainId) {
      return false;
    }
    runtime.activeDrain = null;
    runtime.updatedAt = Date.now();
    return true;
  }
}

const threadRuntimeManager = new ThreadRuntimeManager();

module.exports = {
  RUNTIME_STATES,
  ThreadRuntimeManager,
  threadRuntimeManager,
};
