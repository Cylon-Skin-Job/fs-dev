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
const path = require('path');
const {
  createTurnAccumulator,
  settleAccumulatorForTerminal,
} = require('./canonical-turn-accumulator');

const DRAIN_RETIRE_TIMEOUT_MS = 5_000;

function awaitBoundedDrainCompletion(completion, timeoutMs = DRAIN_RETIRE_TIMEOUT_MS) {
  let timeout;
  return Promise.race([
    Promise.resolve(completion),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Canonical drain did not retire in time')), timeoutMs);
      timeout.unref?.();
    }),
  ]).finally(() => clearTimeout(timeout));
}

class ThreadRuntimeManager {
  constructor() {
    this.runtimes = new Map();
  }

  makeKey(key) {
    if (!key || !key.workspaceId || !key.threadId) {
      throw new Error('Thread runtime key requires workspaceId and threadId');
    }

    // RCC-0095: all threads are workspace-scoped ('project').
    if (key.scope !== 'project') {
      throw new Error(`Unsupported thread runtime scope: ${key.scope}`);
    }

    // Production callers provide both fields. The legacy sentinels retain
    // compatibility for older isolated unit fixtures without weakening live
    // root/epoch identity, because no production owner constructs them.
    const projectRoot = typeof key.projectRoot === 'string' && key.projectRoot
      ? path.resolve(key.projectRoot)
      : `legacy-root:${key.workspaceId}`;
    const workspaceEpoch = typeof key.workspaceEpoch === 'string' && key.workspaceEpoch
      ? key.workspaceEpoch
      : `legacy-epoch:${projectRoot}`;
    return JSON.stringify(['project', key.workspaceId, projectRoot, workspaceEpoch, key.threadId]);
  }

  _resourceRuntimes(key) {
    const root = typeof key?.projectRoot === 'string' && key.projectRoot
      ? path.resolve(key.projectRoot)
      : `legacy-root:${key?.workspaceId}`;
    return [...this.runtimes.entries()].filter(([, runtime]) => (
      runtime.key.workspaceId === key?.workspaceId
      && runtime.key.threadId === key?.threadId
      && (typeof runtime.key.projectRoot === 'string' && runtime.key.projectRoot
        ? path.resolve(runtime.key.projectRoot)
        : `legacy-root:${runtime.key.workspaceId}`) === root
    ));
  }

  getRuntimeForResource(key) {
    const matches = this._resourceRuntimes(key);
    return matches.length === 1 ? matches[0][1] : null;
  }

  async retireResourceDrains(key) {
    const matches = this._resourceRuntimes(key);
    for (const [, runtime] of matches) {
      if (runtime.activeDrain) await this.retireActiveDrain(runtime.key);
    }
    return matches.length;
  }

  /**
   * Move an idle/ready provider runtime to a replacement connection epoch.
   * Busy drains and warmups remain immutably owned by their accepting epoch.
   */
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
    runtime.key = { ...key };
    runtime.updatedAt = Date.now();
    this.runtimes.set(exactKey, runtime);
    return runtime;
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
        activeDrain: null,
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

  /**
   * Claim the active canonical drain for a runtime key (SPEC-01 Slice B).
   * Must be called before the harness iterator is consumed. A leftover record
   * is replaced with a diagnostic: runtime state gating already prevents
   * concurrent prompts, so replacement is stale-record cleanup, never a live
   * takeover. Slice C adds bind/compare/mutate/terminalize/clear authority.
   *
   * @param {object} key - structured thread runtime key
   * @param {{ drainId: string, runtimeKey: object, touchThreadSession: () => void, stopHarness: () => Promise<void> }} control - CanonicalDrainControl capability
   * @param {object|null} [routeContext] - frozen CanonicalRouteContext for the accepted prompt
   * @returns {{ drainId: string, turnId: string|null, control: object, routeContext: object|null, turn: object|null }}
   */
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

  /**
   * Read the active canonical drain record for a runtime key, or null.
   * @param {object} key - structured thread runtime key
   */
  getActiveDrain(key) {
    const runtime = this.runtimes.get(this.makeKey(key));
    return runtime?.activeDrain || null;
  }

  /**
   * Bind the non-serializable lifecycle owned by the interactive iterator.
   * Workspace retirement uses this exact record to stop/finalize the admitted
   * turn and then await iterator quiescence before installing another binding.
   */
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

  /**
   * Retire one exact interactive drain and wait until its iterator can no
   * longer publish canonical events. A missing drain is already quiescent.
   */
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

  // ─── SPEC-01 Slice C: runtime drain authority API ────────────────────
  // ThreadRuntimeManager is the SOLE mutable canonical turn owner. Every
  // canonical mutation below compares the current drain (and, after bind,
  // the bound server turnId). The active drain record shape is:
  //   { drainId, turnId: string|null, control, routeContext,
  //     turn: <accumulator>|null, completion, retire, retirementPromise }
  // where `turn` is created by beginCanonicalTurn and holds the
  // non-serializable mutable accumulator beside the serializable snapshot.

  /**
   * True when an active drain record exists for the runtime key and its
   * drainId still matches. The compare-current primitive every other
   * operation builds on.
   *
   * @param {object} key - structured thread runtime key
   * @param {string} drainId
   * @returns {boolean}
   */
  isDrainCurrent(key, drainId) {
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    return Boolean(record && record.drainId === drainId);
  }

  /**
   * Begin one canonical turn under the claimed drain. Gates on
   * isDrainCurrent AND a not-yet-terminalized record AND no live duplicate
   * begin (a rejected/spurious/duplicate begin can never reset state).
   * Creates the serializable live-turn snapshot (with attachments) plus the
   * non-serializable turn accumulator; replaces any previous completed
   * snapshot exactly like beginLiveTurn.
   *
   * @param {object} key - structured thread runtime key
   * @param {string} drainId
   * @param {{ turnId: string, userInput: string, attachments?: Array }} payload
   * @returns {{ accepted: boolean, turnId?: string }}
   */
  beginCanonicalTurn(key, drainId, { turnId, userInput, attachments = [] }) {
    if (typeof turnId !== 'string' || !turnId) {
      return { accepted: false };
    }
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== drainId) {
      return { accepted: false };
    }
    if (record.turn && !record.turn.terminalized) {
      // Duplicate turn_begin for the live turn — idempotent reject, never reset.
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

  /**
   * Bind the accepted server turnId to the current drain exactly once.
   * Returns true only when the record exists, drainId matches, no turnId has
   * been bound yet, and turnId is non-empty (bind-once contract §4.6).
   *
   * @param {object} key - structured thread runtime key
   * @param {string} drainId
   * @param {string} turnId
   * @returns {boolean}
   */
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

  /**
   * Resolve the bound server turnId for the current drain, or null when the
   * record is missing, superseded, or has no bound turn yet (pre-binding
   * events are dropped by callers).
   *
   * @param {object} key - structured thread runtime key
   * @param {string} drainId
   * @returns {string|null}
   */
  resolveBoundTurnId(key, drainId) {
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== drainId) return null;
    return record.turnId;
  }

  /**
   * Apply one gated live mutation and return its resulting streamSeq.
   *
   * Gate: record exists && drainId matches && record.turnId !== null &&
   * record.turnId === identity.turnId. When gated in, mutator({ snapshot,
   * turn }) mutates the live-turn snapshot and/or the turn accumulator using
   * the existing live-turn-snapshot helpers (bump semantics preserved
   * exactly); returns snapshot.streamSeq after mutation. Returns null when
   * gated out. This is the method downstream SPECs build on.
   *
   * @param {object} key - structured thread runtime key
   * @param {{ drainId: string, turnId: string }} identity
   * @param {({ snapshot: object|null, turn: object }) => void} mutator
   * @returns {number|null}
   */
  applyLiveMutation(key, identity, mutator) {
    if (!identity || typeof mutator !== 'function') return null;
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== identity.drainId) return null;
    if (record.turnId === null || record.turnId !== identity.turnId) return null;
    mutator({ snapshot: runtime.liveTurn, turn: record.turn });
    return runtime.liveTurn ? runtime.liveTurn.streamSeq : null;
  }

  /**
   * Idempotently terminalize the current drain's canonical turn: completes
   * the snapshot via completeLiveTurn(status, terminalError), resets usage
   * metadata, clears mutable accumulator buffers, and marks the record
   * terminalized. Repeated calls return false without side effects. Gate:
   * compare-current AND a begun, not-yet-terminalized turn.
   *
   * SPEC-03 Slice B (parent §4.13): the optional `options.terminalError`
   * safe envelope rides INSIDE this one existing terminal mutation — it is
   * carried into completeLiveTurn so the error envelope lands on the
   * snapshot during the single terminal bump. No second bump, no separate
   * setter. The envelope must already be validated (the applier validates;
   * completeLiveTurn re-validates defensively). Non-error terminals pass no
   * envelope and force snapshot terminalError null.
   *
   * @param {object} key - structured thread runtime key
   * @param {{ drainId: string, turnId: string }} identity
   * @param {string} [status]
   * @param {{ terminalError?: object|null }} [options]
   * @returns {boolean}
   */
  terminalizeTurn(key, identity, status = 'complete', options = {}) {
    if (!identity || typeof identity.drainId !== 'string') return false;
    const runtime = this.runtimes.get(this.makeKey(key));
    const record = runtime?.activeDrain;
    if (!record || record.drainId !== identity.drainId) return false;
    if (!record.turn || record.turn.terminalized) return false;
    liveTurnSnapshot.completeLiveTurn(runtime.liveTurn, status, options?.terminalError ?? null);
    settleAccumulatorForTerminal(record.turn);
    runtime.liveToolArgs.clear();
    runtime.updatedAt = Date.now();
    return true;
  }

  /**
   * Remove the active drain record only when its drainId still matches
   * (clear-if-current). The completed snapshot remains available for the
   * thread:opened overlay. A replacement drain's record is never touched.
   *
   * @param {object} key - structured thread runtime key
   * @param {string} drainId
   * @returns {boolean}
   */
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
