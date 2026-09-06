/**
 * Canonical Harness Event Bridge
 *
 * Converts flat CanonicalEvent objects from harness/types.js into the
 * { type, payload } shape consumed by canonical-chat-event-applier.js.
 *
 * This module provides a direct bridge for harness sessions that yield
 * canonical events, bypassing the Kimi-wire compatibility serialization
 * when _usesDirectCanonicalEvents is enabled.
 *
 * SPEC-01 Slice C: every applied event carries the claimed drainContext
 * ({ route, control }) through to the applier. On an accepted turn_begin the
 * returned server turnId is bound to the matching drain exactly once via the
 * injected bindDrainTurn capability. Rejected, spurious, and duplicate begins
 * never reach bindDrainTurn.
 */

/**
 * Create a bridge for applying canonical harness events.
 *
 * @param {object} deps
 * @param {Function} deps.applyChatEvent - from canonical-chat-event-applier
 * @param {Function} [deps.bindDrainTurn] - (drainContext, turnId) => boolean;
 *        binds the accepted server turnId once for the matching drain
 * @param {Function} [deps.onNonChatEvent] - optional handler for non-chat events
 * @param {Function} [deps.resolveTurnIdentity] - immutable turn identity resolver
 * @returns {{ applyHarnessEvent: Function, drainHarnessEvents: Function }}
 */

const { performance } = require('perf_hooks');

const sharedTurnLifecycles = new Map();
const settledTurnTombstones = new Map();
const settledAuthorityLifecycles = new WeakMap();
const MAX_SETTLED_TURN_TOMBSTONES = 1_024;
let nextBridgeId = 0;

function newLifecycle(turnKey = null) {
  return {
    turnKey,
    applicationTail: Promise.resolve(),
    queuePending: false,
    ingressOpen: true,
    finalization: null,
    finalizationSettled: false,
    nextIngressOrdinal: 0,
    ownerApplyChatEvent: null,
    ownerApplyMappedEvent: null,
    ownerWs: null,
    ownerApplicationContext: null,
    ownerDrainContext: null,
    ownerFinalizeLifecycle: null,
    applicationExpired: false,
    shutdownFence: new AbortController(),
    authorityToken: null,
  };
}

function identityKey(identity) {
  if (!identity || typeof identity !== 'object') return null;
  const { workspaceId, threadId, turnId } = identity;
  if (![workspaceId, threadId, turnId].every(value => typeof value === 'string' && value.length > 0)) return null;
  return JSON.stringify([workspaceId, threadId, turnId]);
}

function getLifecycleStats() {
  return {
    active: sharedTurnLifecycles.size,
    tombstones: settledTurnTombstones.size,
  };
}

function retainLifecycleTombstone(key, lifecycle) {
  if (sharedTurnLifecycles.get(key) === lifecycle) sharedTurnLifecycles.delete(key);
  if (lifecycle.authorityToken) settledAuthorityLifecycles.set(lifecycle.authorityToken, lifecycle);
  settledTurnTombstones.delete(key);
  settledTurnTombstones.set(key, lifecycle);
  while (settledTurnTombstones.size > MAX_SETTLED_TURN_TOMBSTONES) {
    const evictedKey = settledTurnTombstones.keys().next().value;
    settledTurnTombstones.delete(evictedKey);
  }
}

function expireLifecycleForShutdown(lifecycle) {
  lifecycle.applicationExpired = true;
  const context = lifecycle.ownerApplicationContext;
  if (context && typeof context === 'object') {
    context.pendingTurnId = null;
    context.pendingAgentTurnAuthority = null;
    context.pendingUserInput = null;
    context.pendingAttachments = [];
    context.currentTurn = null;
    context.assistantParts = [];
    context.hasToolCalls = false;
    context.activeToolId = null;
    context.activeToolName = null;
    context.toolArgs = {};
    context.toolNamesById = {};
    context.bouncedToolCalls = new Set();
    context.contextUsage = null;
    context.tokenUsage = null;
    context.messageId = null;
    context.planMode = false;
    context.wire = null;
    context.projectRoot = null;
  }
  lifecycle.ownerApplicationContext = null;
  lifecycle.ownerDrainContext = null;
  lifecycle.ownerWs = null;
  lifecycle.ownerApplyChatEvent = null;
  lifecycle.ownerApplyMappedEvent = null;
  lifecycle.ownerFinalizeLifecycle = null;
  lifecycle.authorityToken = null;
  lifecycle.shutdownFence.abort();
  retainLifecycleTombstone(lifecycle.turnKey, lifecycle);
}

function remainingUntil(deadline, monotonicNow) {
  return Math.max(0, deadline - monotonicNow());
}

function settleWithin(promise, timeoutMs, { setTimer, clearTimer }) {
  const pending = Promise.resolve(promise);
  if (timeoutMs <= 0) {
    pending.catch(() => {});
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimer(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);
    timer?.unref?.();
    pending.then((value) => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      resolve(value !== false);
    }, () => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      resolve(false);
    });
  });
}

function signalWireAndWaitForClose(wire, signal, timeoutMs, timers) {
  if (wire.exitCode != null || wire.signalCode != null) return Promise.resolve(true);
  if (timeoutMs <= 0 || typeof wire.once !== 'function' || typeof wire.kill !== 'function') {
    return Promise.resolve(false);
  }
  let onClose;
  let timer;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) timers.clearTimer(timer);
      wire.removeListener?.('close', onClose);
      resolve(value);
    };
    onClose = () => finish(true);
    wire.once('close', onClose);
    try {
      const accepted = wire.kill(signal);
      if (accepted === false) {
        finish(wire.exitCode != null || wire.signalCode != null);
        return;
      }
    } catch (_error) {
      finish(false);
      return;
    }
    if (!settled) {
      timer = timers.setTimer(() => finish(false), timeoutMs);
      timer?.unref?.();
    }
  });
}

async function stopWireForShutdown(wire, deadline, options) {
  const timers = { setTimer: options.setTimer, clearTimer: options.clearTimer };
  const attempt = async (signal, timeoutMs) => {
    if (typeof wire._stopSession === 'function') {
      try {
        return await settleWithin(wire._stopSession(signal), timeoutMs, timers);
      } catch (_error) {
        return false;
      }
    }
    if (typeof wire.stop === 'function') {
      try {
        return await settleWithin(wire.stop(signal), timeoutMs, timers);
      } catch (_error) {
        return false;
      }
    }
    return signalWireAndWaitForClose(wire, signal, timeoutMs, timers);
  };

  const termWait = Math.min(2_000, remainingUntil(deadline, options.monotonicNow));
  if (await attempt('SIGTERM', termWait)) return true;
  const killWait = Math.min(1_000, remainingUntil(deadline, options.monotonicNow));
  if (killWait <= 0) return false;
  return attempt('SIGKILL', killWait);
}

async function shutdownActiveTurnLifecycles({
  timeoutMs = 5_000,
  deadline = null,
  monotonicNow = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const startedAt = monotonicNow();
  const finalDeadline = Math.min(
    startedAt + Math.max(0, timeoutMs),
    Number.isFinite(deadline) ? deadline : Number.POSITIVE_INFINITY,
  );
  const lifecycles = [...sharedTurnLifecycles.values()]
    .filter((lifecycle) => lifecycle.ingressOpen || !lifecycle.finalizationSettled);
  const finalizationPromises = [];
  const wires = new Set();
  for (const lifecycle of lifecycles) {
    if (typeof lifecycle.ownerFinalizeLifecycle === 'function') {
      try {
        finalizationPromises.push({
          lifecycle,
          promise: Promise.resolve(lifecycle.ownerFinalizeLifecycle({
            type: 'turn_end',
            reason: 'interrupted',
            partial: true,
            finalizationSource: 'shutdown',
            shutdownDeadline: finalDeadline,
            shutdownMonotonicNow: monotonicNow,
          })),
        });
      } catch (error) {
        finalizationPromises.push({ lifecycle, promise: Promise.reject(error) });
      }
    }
    const wire = lifecycle.ownerApplicationContext?.wire;
    if (wire) wires.add(wire);
  }
  const options = { monotonicNow, setTimer, clearTimer };
  const finalizations = finalizationPromises.map(({ promise }) => promise);
  const stops = [...wires].map((wire) => stopWireForShutdown(wire, finalDeadline, options));
  const remaining = remainingUntil(finalDeadline, monotonicNow);
  const work = Promise.allSettled([...finalizations, ...stops]);
  if (remaining <= 0) {
    for (const lifecycle of lifecycles) {
      if (lifecycle.finalizationSettled) continue;
      expireLifecycleForShutdown(lifecycle);
    }
    return Object.freeze({ drained: lifecycles.length === 0, lifecycles: lifecycles.length, wires: wires.size });
  }
  let timer;
  const completed = await Promise.race([
    work.then((results) => (
      results.every((result) => result.status === 'fulfilled' && result.value !== false)
        && monotonicNow() < finalDeadline
    )),
    new Promise((resolve) => {
      timer = setTimer(() => resolve(false), remaining);
      timer?.unref?.();
    }),
  ]);
  if (timer) clearTimer(timer);
  if (!completed) {
    for (const lifecycle of lifecycles) {
      if (lifecycle.finalizationSettled) continue;
      expireLifecycleForShutdown(lifecycle);
    }
  }
  return Object.freeze({ drained: completed, lifecycles: lifecycles.length, wires: wires.size });
}

function createCanonicalHarnessEventBridge({
  applyChatEvent,
  bindDrainTurn,
  onNonChatEvent,
  onDiagnostic = () => {},
  finalizationTimeoutMs = 2_000,
  resolveTurnIdentity: injectedTurnIdentityResolver = null,
}) {
  const hasTurnIdentityResolver = typeof injectedTurnIdentityResolver === 'function';
  const requiresSequencedBridge = applyChatEvent?._requiresSequencedBridge === true
    || applyChatEvent?.constructor?.name === 'AsyncFunction';
  const resolveTurnIdentity = hasTurnIdentityResolver
    ? injectedTurnIdentityResolver
    : () => null;
  const bridgeId = ++nextBridgeId;
  let localTurnSequence = 0;
  let activeTurnKey = null;
  let activeLifecycle = null;

  function lifecycleFor(key, authorityToken = null) {
    let lifecycle = sharedTurnLifecycles.get(key);
    if (!lifecycle) lifecycle = settledTurnTombstones.get(key);
    if (!lifecycle && authorityToken) {
      const exactSettled = settledAuthorityLifecycles.get(authorityToken);
      if (exactSettled?.turnKey === key) lifecycle = exactSettled;
    }
    if (!lifecycle) {
      lifecycle = newLifecycle(key);
      lifecycle.authorityToken = authorityToken;
      sharedTurnLifecycles.set(key, lifecycle);
    }
    return lifecycle;
  }

  function retainSettledTombstone(key, lifecycle) {
    retainLifecycleTombstone(key, lifecycle);
  }

  function claimOwner(lifecycle, ws, applicationContext = null, drainContext = null) {
    if (lifecycle.ownerApplyChatEvent) {
      if (!lifecycle.ownerApplicationContext && applicationContext) {
        lifecycle.ownerApplicationContext = applicationContext;
      }
      if (!lifecycle.ownerDrainContext && drainContext) {
        lifecycle.ownerDrainContext = drainContext;
      }
      return;
    }
    lifecycle.ownerApplyChatEvent = applyChatEvent;
    lifecycle.ownerApplyMappedEvent = applyMappedEvent;
    lifecycle.ownerWs = ws;
    lifecycle.ownerApplicationContext = applicationContext;
    lifecycle.ownerDrainContext = drainContext;
    lifecycle.ownerFinalizeLifecycle = (event) => finalizeLifecycle(lifecycle, event, lifecycle.ownerWs);
  }

  function applyThroughOwner(lifecycle, event, ingressOrdinal) {
    if (lifecycle.applicationExpired) {
      onDiagnostic('agent_turn_late_event');
      return undefined;
    }
    return lifecycle.ownerApplyMappedEvent(event, lifecycle.ownerWs, ingressOrdinal, lifecycle);
  }

  function resolvedTurn(event, begin = false, identityOverride = null) {
    const identity = identityOverride || resolveTurnIdentity(event);
    const explicit = identityKey(identity)
      || (event?.turnId ? identityKey({ workspaceId: 'event', threadId: 'event', turnId: event.turnId }) : null);
    if (explicit) {
      return {
        key: explicit,
        // Only the frozen prompt-accepted authority is an exact lifecycle
        // token. Mutable identity wrappers remain governed by the bounded
        // string-key tombstone cache.
        authorityToken: identity && Object.isFrozen(identity) ? identity : null,
      };
    }
    if (!begin && activeTurnKey) {
      return { key: activeTurnKey, authorityToken: activeLifecycle?.authorityToken || null };
    }
    if (begin || !activeTurnKey) localTurnSequence += 1;
    return {
      key: activeTurnKey || JSON.stringify(['bridge', bridgeId, localTurnSequence]),
      authorityToken: null,
    };
  }

  function enqueue(lifecycle, work) {
    let task;
    if (!lifecycle.queuePending) {
      lifecycle.queuePending = true;
      try {
        task = Promise.resolve(work());
      } catch (error) {
        task = Promise.reject(error);
      }
    } else {
      task = lifecycle.applicationTail.then(work);
    }
    lifecycle.applicationTail = task.catch(() => {});
    const currentTail = lifecycle.applicationTail;
    currentTail.finally(() => {
      if (lifecycle.applicationTail === currentTail) lifecycle.queuePending = false;
    }).catch(() => {});
    return task;
  }

  function lifecycleForAcceptedBegin(key, authorityToken) {
    let lifecycle = lifecycleFor(key, authorityToken);
    const newAuthorityGeneration = authorityToken && lifecycle.authorityToken !== authorityToken;
    const reopenLegacyGeneration = !authorityToken
      && !lifecycle.ingressOpen
      && lifecycle.finalizationSettled;
    if (newAuthorityGeneration || reopenLegacyGeneration) {
      // A separately accepted immutable authority object is a new ownership
      // generation even if a deterministic fixture reuses scalar identity.
      // Authority-unavailable legacy turns retain the prior fail-open reopen
      // behavior. A verified rebound carries the original object and remains
      // settled.
      settledTurnTombstones.delete(key);
      lifecycle = newLifecycle(key);
      lifecycle.authorityToken = authorityToken;
      sharedTurnLifecycles.set(key, lifecycle);
    }
    return lifecycle;
  }

  function applyEventToLifecycle(
    lifecycle,
    event,
    ws,
    applicationContext = null,
    drainContext = null,
  ) {
    if (lifecycle.applicationExpired || !lifecycle.ingressOpen) {
      onDiagnostic('agent_turn_late_event');
      return lifecycle.finalization;
    }
    claimOwner(lifecycle, ws, applicationContext, drainContext);
    const ingressOrdinal = lifecycle.nextIngressOrdinal;
    lifecycle.nextIngressOrdinal += 1;
    return enqueue(lifecycle, () => applyThroughOwner(lifecycle, event, ingressOrdinal));
  }

  function beginTurn(event, ws, drainContext = null, applicationContext = null) {
    const { key: nextKey, authorityToken } = resolvedTurn(event, true);
    const start = () => {
      activeTurnKey = nextKey;
      const lifecycle = lifecycleForAcceptedBegin(nextKey, authorityToken);
      activeLifecycle = lifecycle;
      return applyEventToLifecycle(lifecycle, event, ws, applicationContext, drainContext);
    };

    if (!activeTurnKey || activeTurnKey === nextKey) return start();
    const previous = activeLifecycle || lifecycleFor(activeTurnKey);
    if (previous.ingressOpen) {
      return finalizeLifecycle(previous, {
        type: 'turn_end',
        reason: 'interrupted',
        partial: true,
        finalizationSource: 'superseded_turn',
      }, ws).then(start);
    }
    return Promise.resolve(previous.finalization).then(start);
  }

  /**
   * Apply a single canonical harness event.
   * @param {import('../harness/types').CanonicalEvent} event
   * @param {import('ws').WebSocket} [ws]
   * @param {{ route: object, control: object }} [drainContext] - claimed route + control
   */
  function applyDirectDrainEvent(event, ws, drainContext) {
    let mapped;
    switch (event.type) {
      case 'turn_begin':
        mapped = { type: 'turn_begin', payload: { timestamp: event.timestamp, userInput: event.userInput } };
        break;
      case 'content':
        mapped = { type: 'content', payload: { timestamp: event.timestamp, text: event.text } };
        break;
      case 'thinking':
        mapped = { type: 'thinking', payload: { timestamp: event.timestamp, text: event.text } };
        break;
      case 'tool_call':
        mapped = { type: 'tool_call', payload: { timestamp: event.timestamp, toolCallId: event.toolCallId, toolName: event.toolName } };
        break;
      case 'tool_call_args':
        mapped = { type: 'tool_call_args', payload: { timestamp: event.timestamp, toolCallId: event.toolCallId, argsChunk: event.argsChunk } };
        break;
      case 'tool_result':
        mapped = {
          type: 'tool_result',
          payload: {
            timestamp: event.timestamp,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            result: {
              output: event.output,
              statusMessage: event.statusMessage,
              display: event.display,
              returnedDiff: event.returnedDiff,
              isError: event.isError,
              files: event.files,
            },
          },
        };
        break;
      case 'subagent_event':
        mapped = {
          type: 'subagent_event',
          payload: {
            parentToolCallId: event.parentToolCallId,
            agentId: event.agentId,
            subagentType: event.subagentType,
            subagentEventType: event.subagentEventType,
            subagentPayload: event.subagentPayload,
          },
        };
        break;
      case 'status_update':
        mapped = {
          type: 'status_update',
          payload: {
            contextUsage: event.contextUsage,
            tokenUsage: event.tokenUsage,
            messageId: event.messageId,
            planMode: event.planMode,
          },
        };
        break;
      case 'step_begin':
        mapped = {
          type: 'step_begin',
          payload: { timestamp: event.timestamp, stepId: event.stepId, messageId: event.messageId },
        };
        break;
      case 'turn_end':
        mapped = {
          type: 'turn_end',
          payload: {
            reason: event.reason,
            partial: event.partial,
            ...(event.terminalError !== undefined ? { terminalError: event.terminalError } : {}),
          },
        };
        break;
      default:
        if (onNonChatEvent) return onNonChatEvent(event, ws);
        return undefined;
    }
    const result = applyChatEvent(mapped, ws, drainContext);
    if (drainContext && event.type === 'turn_begin' && result?.accepted && result.turnId && bindDrainTurn) {
      bindDrainTurn(drainContext, result.turnId);
    }
    return result;
  }

  function applyHarnessEvent(event, ws, drainContext) {
    if (!event || !event.type) return;

    // Preserve the synchronous drain-context contract for callers without an
    // immutable PROV authority. Accepted authority turns use the queued owner
    // lifecycle below.
    if (!requiresSequencedBridge
      && (!hasTurnIdentityResolver || drainContext)
      && !identityKey(resolveTurnIdentity(event))) {
      return applyDirectDrainEvent(event, ws, drainContext);
    }

    if (event.type === 'turn_begin') return beginTurn(event, ws, drainContext);
    if (event.type === 'turn_end') return finalizeTurn(event, ws, null, null, drainContext);

    const { key, authorityToken } = resolvedTurn(event);
    const lifecycle = activeTurnKey === key && activeLifecycle
      ? activeLifecycle
      : lifecycleFor(key, authorityToken);
    activeTurnKey = key;
    activeLifecycle = lifecycle;
    return applyEventToLifecycle(lifecycle, event, ws, null, drainContext);
  }

  async function applyMappedEvent(event, ws, ingressOrdinal, lifecycle = null) {
    const timing = {
      ingressOrdinal,
      timestamp: event.timestamp,
      timestampSource: event.timestampSource,
      observedAt: event.observedAt,
      reportedAt: event.reportedAt,
      isLifecycleCurrent: lifecycle ? () => !lifecycle.applicationExpired : undefined,
    };
    if (lifecycle?.authorityToken) timing.agentTurnAuthority = lifecycle.authorityToken;
    const apply = mappedEvent => applyChatEvent(
      mappedEvent,
      ws,
      lifecycle?.ownerDrainContext || lifecycle?.ownerApplicationContext || null,
    );

    switch (event.type) {
      case 'turn_begin': {
        const result = await apply({
          type: 'turn_begin',
          payload: {
            ...timing,
            userInput: event.userInput,
          }
        });
        // Bind-once (parent §4.6): only an accepted begin with a non-empty
        // server turnId binds; rejected/spurious/duplicate begins never reach
        // bindDrainTurn.
        const drainContext = lifecycle?.ownerDrainContext;
        if (drainContext && result?.accepted && result.turnId && bindDrainTurn) {
          bindDrainTurn(drainContext, result.turnId);
        }
        break;
      }

      case 'content':
        await apply({
          type: 'content',
          payload: {
            ...timing,
            text: event.text,
          }
        });
        break;

      case 'thinking':
        await apply({
          type: 'thinking',
          payload: {
            ...timing,
            text: event.text,
          }
        });
        break;

      case 'tool_call':
        await apply({
          type: 'tool_call',
          payload: {
            ...timing,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            nativeToolName: event.nativeToolName,
            harnessId: event.harnessId,
            provider: event.provider,
            origin: event.origin,
          }
        });
        break;

      case 'tool_call_args':
        await apply({
          type: 'tool_call_args',
          payload: {
            ...timing,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            argsChunk: event.argsChunk,
            completeArgs: event.completeArgs,
            hasCompleteArgs: event.hasCompleteArgs,
            origin: event.origin,
          }
        });
        break;

      case 'tool_result':
        await apply({
          type: 'tool_result',
          payload: {
            ...timing,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            origin: event.origin,
            result: {
              output: event.output,
              statusMessage: event.statusMessage,
              display: event.display,
              returnedDiff: event.returnedDiff,
              isError: event.isError,
              files: event.files
            }
          }
        });
        break;

      case 'tool_snapshot': {
        const { type: _type, ...payload } = event;
        await apply({
          type: 'tool_snapshot',
          payload: {
            ...payload,
            ingressOrdinal,
            isLifecycleCurrent: lifecycle ? () => !lifecycle.applicationExpired : undefined,
            agentTurnAuthority: lifecycle?.authorityToken || null,
          },
        });
        break;
      }

      case 'subagent_event':
        await apply({
          type: 'subagent_event',
          payload: {
            ...timing,
            parentToolCallId: event.parentToolCallId,
            agentId: event.agentId,
            subagentType: event.subagentType,
            subagentEventType: event.subagentEventType,
            subagentPayload: event.subagentPayload
          }
        });
        break;

      case 'status_update':
        await apply({
          type: 'status_update',
          payload: {
            ...timing,
            contextUsage: event.contextUsage,
            tokenUsage: event.tokenUsage,
            messageId: event.messageId,
            planMode: event.planMode
          }
        });
        break;

      // SPEC-02 Slice B: native fields forwarded verbatim — timestamp stays
      // unchanged (absent keys stay undefined; the applier owns all judging).
      case 'step_begin':
        await apply({
          type: 'step_begin',
          payload: {
            ...timing,
            timestamp: event.timestamp,
            stepId: event.stepId,
            messageId: event.messageId
          }
        });
        break;

      default:
        if (onNonChatEvent) {
          await onNonChatEvent(event, ws);
        }
        break;
    }
  }

  function finalizeLifecycle(lifecycle, event, ws) {
    if (lifecycle.finalization) return lifecycle.finalization;
    claimOwner(lifecycle, ws);
    const ownerApplyChatEvent = lifecycle.ownerApplyChatEvent;
    const ownerWs = lifecycle.ownerWs;
    lifecycle.ingressOpen = false;
    const ingressOrdinal = lifecycle.nextIngressOrdinal;
    lifecycle.nextIngressOrdinal += 1;
    const payload = {
      ingressOrdinal,
      timestamp: event.timestamp,
      timestampSource: event.timestampSource,
      observedAt: event.observedAt,
      reportedAt: event.reportedAt,
      reason: event.reason,
      partial: event.partial,
      finalizationSource: event.finalizationSource,
      shutdownSignal: lifecycle.shutdownFence.signal,
      shutdownDeadline: event.shutdownDeadline,
      shutdownMonotonicNow: event.shutdownMonotonicNow,
      terminalError: event.terminalError,
      agentTurnAuthority: lifecycle.authorityToken || null,
    };
    if (!lifecycle.queuePending) {
      // Close ingress synchronously but defer finalizer work one microtask so
      // stop can signal the child immediately after owning the same barrier.
      lifecycle.finalization = Promise.resolve().then(
        () => ownerApplyChatEvent(
          { type: 'turn_end', payload },
          ownerWs,
          lifecycle.ownerDrainContext || lifecycle.ownerApplicationContext,
        ),
      );
      lifecycle.finalization.finally(() => {
        lifecycle.finalizationSettled = true;
        retainSettledTombstone(lifecycle.turnKey, lifecycle);
      }).catch(() => {});
      return lifecycle.finalization;
    }
    const queueAtBarrier = lifecycle.applicationTail;
    lifecycle.finalization = (async () => {
      let timer;
      const drained = await Promise.race([
        queueAtBarrier.then(() => true),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), finalizationTimeoutMs);
          timer.unref?.();
        }),
      ]);
      clearTimeout(timer);
      if (!drained) {
        lifecycle.applicationExpired = true;
        onDiagnostic('agent_turn_queue_timeout');
      }
      return ownerApplyChatEvent(
        { type: 'turn_end', payload },
        ownerWs,
        lifecycle.ownerDrainContext || lifecycle.ownerApplicationContext,
      );
    })();
    lifecycle.finalization.finally(() => {
      lifecycle.finalizationSettled = true;
      retainSettledTombstone(lifecycle.turnKey, lifecycle);
    }).catch(() => {});
    return lifecycle.finalization;
  }

  function finalizeTurn(
    event,
    ws,
    identityOverride = null,
    applicationContext = null,
    drainContext = null,
  ) {
    const { key, authorityToken } = resolvedTurn(event, false, identityOverride);
    const lifecycle = activeTurnKey === key && activeLifecycle
      ? activeLifecycle
      : lifecycleFor(key, authorityToken);
    activeTurnKey = key;
    activeLifecycle = lifecycle;
    claimOwner(lifecycle, ws, applicationContext, drainContext);
    return finalizeLifecycle(lifecycle, event, ws);
  }

  /**
   * Drain an async iterable of canonical harness events and apply them.
   * @param {AsyncIterable<import('../harness/types').CanonicalEvent>} events
   * @param {import('ws').WebSocket} [ws]
   * @param {object} [options]
   * @param {{ route: object, control: object }} [options.drainContext] - passed
   *        through per event to every applier call
   * @param {Function} [options.onError] - error handler
   * @param {object} [options.turnAuthority] - frozen prompt-accepted authority
   * @param {object} [options.turnApplicationContext] - drain-local applier state
   * @returns {Promise<void>}
   */
  async function drainHarnessEvents(events, ws, options = {}) {
    const capturedIdentity = options.turnAuthority || resolveTurnIdentity();
    const capturedAuthorityToken = capturedIdentity && Object.isFrozen(capturedIdentity)
      ? capturedIdentity
      : null;
    let capturedKey = identityKey(capturedIdentity);
    // Prompt acceptance supplies a frozen authority, or a stable fallback
    // identity when provenance authority is unavailable, before the harness
    // can yield its first event. Register that accepted turn synchronously so
    // shutdown while iterator.next() is pending still owns its finalizer,
    // application context, and harness wire.
    let lifecycle = capturedKey
      ? lifecycleForAcceptedBegin(capturedKey, capturedAuthorityToken)
      : null;
    if (lifecycle) {
      claimOwner(
        lifecycle,
        ws,
        options.turnApplicationContext || null,
        options.drainContext || null,
      );
    }

    function bindLifecycle(event) {
      if (!capturedKey) {
        capturedKey = event?.turnId
          ? identityKey({ workspaceId: 'event', threadId: 'event', turnId: event.turnId })
          : null;
      }
      if (!capturedKey) {
        localTurnSequence += 1;
        capturedKey = JSON.stringify(['bridge', bridgeId, localTurnSequence]);
      }
      lifecycle = event?.type === 'turn_begin'
        ? lifecycleForAcceptedBegin(capturedKey, capturedAuthorityToken)
        : lifecycleFor(capturedKey, capturedAuthorityToken);
      return lifecycle;
    }

    function applyBoundEvent(event) {
      if (!event || !event.type) return undefined;
      const bound = lifecycle || bindLifecycle(event);
      if (event.type === 'turn_end') return finalizeLifecycle(bound, event, ws);
      return applyEventToLifecycle(
        bound,
        event,
        ws,
        options.turnApplicationContext || null,
        options.drainContext || null,
      );
    }

    try {
      for await (const event of events) {
        await applyBoundEvent(event);
      }
      if (lifecycle?.ingressOpen) {
        await finalizeLifecycle(lifecycle, {
          type: 'turn_end',
          reason: 'interrupted',
          partial: true,
          finalizationSource: 'iterator_end',
        }, ws);
      }
    } catch (err) {
      if (options.finalizeOnError !== false && lifecycle?.ingressOpen) {
        await finalizeLifecycle(lifecycle, {
          type: 'turn_end',
          reason: 'interrupted',
          partial: true,
          finalizationSource: 'iterator_error',
        }, ws);
      }
      if (options.onError) {
        options.onError(err);
      }
      throw err;
    }
  }

  return { applyHarnessEvent, drainHarnessEvents, finalizeTurn };
}

module.exports = {
  createCanonicalHarnessEventBridge,
  shutdownActiveTurnLifecycles,
  _getLifecycleStats: getLifecycleStats,
};
