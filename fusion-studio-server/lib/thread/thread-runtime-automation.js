/**
 * @module thread-runtime-automation
 * @role Headless runtime status and prompt sending for server automation callers.
 */

const { v4: generateId } = require('uuid');
const { resolveScope } = require('../chat-scope');
const { checkSettingsBounce } = require('../enforcement');
const { emit } = require('../event-bus');
const { spawnThreadWire } = require('../harness/compat');
const { createCanonicalChatEventApplier } = require('../wire/canonical-chat-event-applier');
const { createCanonicalHarnessEventBridge } = require('../wire/canonical-harness-event-bridge');
const { getWireForThread, registerWire } = require('../wire/process-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { isHarnessRuntimeError } = require('../harness/errors');
const { normalizeTurnTerminalError } = require('./turn-terminal-error');
const { persistDiagnosticReport } = require('./harness-diagnostic-service');
const { persistTerminalDiagnosticSafely } = require('./terminal-diagnostic-boundary');
const {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
} = require('./canonical-drain-context');
const {
  awaitThreadManagerReady,
  getThreadManagerForTarget,
} = require('./thread-manager-registry');

function normalizeTarget(target) {
  if (!target || !target.workspaceId || !target.projectRoot || !target.threadId) {
    throw new Error('Automation target requires workspaceId, projectRoot, and threadId');
  }
  // RCC-0095: all threads are workspace-scoped ('project').
  return {
    workspaceId: target.workspaceId,
    projectRoot: target.projectRoot,
    scope: 'project',
    viewId: null,
    threadId: target.threadId,
  };
}

function getRuntimeKey(target) {
  return {
    workspaceId: target.workspaceId,
    scope: 'project',
    threadId: target.threadId,
  };
}

function getDeferReason(state) {
  if (state === RUNTIME_STATES.WARMING) return 'warming';
  if (state === RUNTIME_STATES.IN_FLIGHT) return 'in_flight';
  if (state === RUNTIME_STATES.STOPPING) return 'stopping';
  return null;
}

function getAutomationRuntimeStatus(rawTarget) {
  const target = normalizeTarget(rawTarget);
  const runtimeKey = getRuntimeKey(target);
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  const deferReason = getDeferReason(state);
  const liveTurn = threadRuntimeManager.getLiveTurn(runtimeKey);
  return {
    state,
    canSend: !deferReason,
    deferReason,
    hasLiveTurn: Boolean(liveTurn),
    liveTurn,
  };
}

function createAutomationBridge() {
  const applier = createCanonicalChatEventApplier({
    emit,
    checkSettingsBounce,
    generateTurnId: () => generateId(),
  });

  return createCanonicalHarnessEventBridge({
    applyChatEvent: applier.applyChatEvent,
    // SPEC-01 Slice C bind-once: the accepted server turnId binds exactly once
    // to the automation drain that produced it.
    bindDrainTurn: (drainContext, turnId) => threadRuntimeManager.bindTurnToDrain(
      drainContext.control.runtimeKey,
      drainContext.control.drainId,
      turnId
    ),
  });
}

async function warmAutomationRuntime(target, manager, runtimeKey) {
  const scopeContext = {
    workspaceId: target.workspaceId,
    viewId: target.viewId,
  };
  const warmPromise = (async () => {
    const wire = spawnThreadWire(target.threadId, target.projectRoot, scopeContext);
    registerWire(target.threadId, wire, target.projectRoot, null, scopeContext);
    if (wire._harnessPromise) await wire._harnessPromise;
    if (!wire._sendMessage) {
      throw new Error('Wire does not support ACP sendMessage. Legacy wire format has been retired.');
    }
    if (!wire._usesDirectCanonicalEvents) {
      throw new Error('Wire does not support direct canonical event delivery. Legacy wire format has been retired.');
    }
    await manager.openSession(target.threadId, wire, null);
    return wire;
  })();

  threadRuntimeManager.markWarming(runtimeKey, warmPromise);
  try {
    const wire = await warmPromise;
    threadRuntimeManager.markReady(runtimeKey);
    return wire;
  } catch (err) {
    threadRuntimeManager.markCold(runtimeKey);
    throw err;
  } finally {
    threadRuntimeManager.clearWarmPromise(runtimeKey);
  }
}

async function ensureAutomationWire(target, manager, runtimeKey) {
  const state = threadRuntimeManager.getRuntimeState(runtimeKey);
  if (state === RUNTIME_STATES.READY) {
    const wire = getWireForThread(target.threadId);
    if (wire) return { wire, deferReason: null };
    threadRuntimeManager.markCold(runtimeKey);
  } else {
    const deferReason = getDeferReason(state);
    if (deferReason) {
      return { wire: null, deferReason };
    }
  }
  return {
    wire: await warmAutomationRuntime(target, manager, runtimeKey),
    deferReason: null,
  };
}

async function persistAutomationUserPrompt(manager, target, input) {
  await manager.addMessage(target.threadId, {
    role: 'user',
    content: input,
    hasToolCalls: false,
  });
  await manager.index.touch(target.threadId);
}

async function sendAutomationPrompt(rawTarget, input) {
  const target = normalizeTarget(rawTarget);

  // SPEC-01 Slice B: the drain-binding factories below require non-empty
  // string input. Validate before any state transition or persistence so a
  // garbage prompt can neither wedge the runtime nor dirty history.
  if (typeof input !== 'string' || !input) {
    return {
      accepted: false,
      deferred: false,
      error: 'Prompt requires a non-empty input',
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  const status = getAutomationRuntimeStatus(target);
  if (status.deferReason) {
    return {
      accepted: false,
      deferred: true,
      reason: status.deferReason,
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  let manager;
  let thread;
  try {
    manager = getThreadManagerForTarget(target);
    await awaitThreadManagerReady(manager);
    thread = await manager.getThread(target.threadId);
  } catch {
    console.error('[ThreadRuntime] Automation thread lookup failed', {
      threadId: target.threadId,
      marker: 'AUTOMATION_THREAD_LOOKUP_FAILED',
    });
    return {
      accepted: false,
      deferred: false,
      error: 'Thread lookup failed',
      threadId: target.threadId,
      scope: target.scope,
    };
  }
  if (!thread) {
    return {
      accepted: false,
      deferred: false,
      error: `Thread not found: ${target.threadId}`,
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  const runtimeKey = getRuntimeKey(target);
  let wireResult;
  try {
    wireResult = await ensureAutomationWire(target, manager, runtimeKey);
  } catch {
    console.error('[ThreadRuntime] Automation warm-up failed', {
      threadId: target.threadId,
      marker: 'AUTOMATION_WARM_UP_FAILED',
    });
    return {
      accepted: false,
      deferred: false,
      error: 'Thread warm-up failed',
      threadId: target.threadId,
      scope: target.scope,
    };
  }
  if (wireResult.deferReason) {
    return {
      accepted: false,
      deferred: true,
      reason: wireResult.deferReason,
      threadId: target.threadId,
      scope: target.scope,
    };
  }
  const { wire } = wireResult;

  if (threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.READY) {
    return {
      accepted: false,
      deferred: true,
      reason: getDeferReason(threadRuntimeManager.getRuntimeState(runtimeKey)) || 'in_flight',
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  threadRuntimeManager.markInFlight(runtimeKey);
  try {
    await persistAutomationUserPrompt(manager, target, input);
  } catch {
    threadRuntimeManager.markReady(runtimeKey);
    console.error('[ThreadRuntime] Automation prompt persistence failed', {
      threadId: target.threadId,
      marker: 'AUTOMATION_PROMPT_PERSISTENCE_FAILED',
    });
    return {
      accepted: false,
      deferred: false,
      error: 'Message could not be saved',
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  const bridge = createAutomationBridge();

  // SPEC-01 Slice B: bind the accepted prompt to an immutable route context
  // and claim one UUID drain before bridge.drainHarnessEvents consumes the
  // iterator. The control closes over this target's exact manager/wire. Any
  // binding failure rolls the runtime back to READY instead of wedging it.
  let claimedRecord = null;
  try {
    const routeContext = createCanonicalRouteContext({
      workspaceId: target.workspaceId,
      workspace: resolveScope({ currentWorkspaceId: target.workspaceId, currentViewId: null }),
      projectRoot: target.projectRoot,
      scope: 'project',
      threadId: target.threadId,
      acceptedUserInput: input,
      attachments: [],
    });

    const drainId = generateId();
    const drainControl = createCanonicalDrainControl({
      drainId,
      runtimeKey,
      touchThreadSession: () => manager.touchSession(target.threadId),
      stopHarness: async () => {
        try {
          if (wire._stopSession) {
            await wire._stopSession();
          } else if (wire.stop) {
            await wire.stop();
          } else if (wire.kill) {
            wire.kill('SIGTERM');
          }
        } catch {
          console.warn('[ThreadRuntime] Automation harness stop failed', {
            threadId: target.threadId,
            drainId,
            marker: 'AUTOMATION_HARNESS_STOP_FAILED',
          });
        }
      },
    });

    claimedRecord = threadRuntimeManager.claimActiveDrain(runtimeKey, drainControl, routeContext);
  } catch {
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.IN_FLIGHT) {
      threadRuntimeManager.markReady(runtimeKey);
    }
    console.error('[ThreadRuntime] Automation prompt drain binding failed', {
      threadId: target.threadId,
      marker: 'AUTOMATION_PROMPT_DRAIN_BINDING_FAILED',
    });
    return {
      accepted: false,
      deferred: false,
      error: 'Prompt binding failed',
      threadId: target.threadId,
      scope: target.scope,
    };
  }

  const drainContext = { route: claimedRecord.routeContext, control: claimedRecord.control };

  // SPEC-01 Slice C stale guard (same contract as the interactive loop): a
  // DIFFERENT live drain on this runtime key proves this iterator is stale;
  // absence is our own terminal clear-if-current and must still mark ready.
  function isDrainSuperseded() {
    const current = threadRuntimeManager.getActiveDrain(runtimeKey);
    return Boolean(current && current.drainId !== claimedRecord.drainId);
  }

  try {
    await bridge.drainHarnessEvents(wire._sendMessage(input, {}), null, { drainContext });
    if (isDrainSuperseded()) {
      console.warn(`[ThreadRuntime] Drain ${claimedRecord.drainId} superseded; automation completion is a diagnostic no-op`);
      return {
        accepted: false,
        deferred: false,
        error: 'Drain superseded during iteration',
        threadId: target.threadId,
        scope: target.scope,
      };
    }
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.IN_FLIGHT) {
      threadRuntimeManager.markReady(runtimeKey);
    }
    return {
      accepted: true,
      deferred: false,
      threadId: target.threadId,
      scope: target.scope,
    };
  } catch (err) {
    if (isDrainSuperseded()) {
      console.warn('[ThreadRuntime] Ignoring superseded automation iterator failure', {
        threadId: target.threadId,
        drainId: claimedRecord.drainId,
        marker: 'SUPERSEDED_AUTOMATION_ITERATOR_FAILURE',
      });
      return {
        accepted: false,
        deferred: false,
        error: 'Drain superseded during iteration',
        threadId: target.threadId,
        scope: target.scope,
      };
    }
    // SPEC-03 Slice B headless parity (parent §4.13, criterion 9): a begun,
    // non-terminalized bound turn synthesizes the identical canonical error
    // turn_end through the SAME bridge with the claimed drainContext BEFORE
    // computing the return value — headless runtimes must not strand
    // finalization. Superseded drains never reach here and remain diagnostic
    // no-ops. Same single sequenced terminal publication path; same fixed
    // catalog envelope; no raw error material attached.
    const boundTurnId = threadRuntimeManager.resolveBoundTurnId(runtimeKey, claimedRecord.drainId);
    if (boundTurnId) {
      // SPEC-03 Slice C headless parity (parent §4.13.1, R5/R5A): best-effort
      // diagnostic persistence BEFORE synthesis, gated on a genuine marker
      // carrying an already-redacted closed V1 candidate. The service
      // normally resolves to null on failure. The shared terminal boundary
      // also contains a rejecting replacement/dependency as fixed-safe null,
      // so terminalization proceeds identically with or without a diagnosticId.
      let diagnosticId = null;
      if (isHarnessRuntimeError(err) && err.candidate) {
        diagnosticId = await persistTerminalDiagnosticSafely(
          persistDiagnosticReport,
          { workspaceId: target.workspaceId, threadId: target.threadId, turnId: boundTurnId },
          err.candidate,
        );
      }
      try {
        // New plain envelope object carrying the optional opaque
        // diagnosticId; downstream validateTurnTerminalError re-validates.
        bridge.applyHarnessEvent({
          type: 'turn_end',
          reason: 'error',
          partial: true,
          terminalError: {
            ...normalizeTurnTerminalError(err),
            ...(diagnosticId ? { diagnosticId } : {}),
          },
        }, null, drainContext);
      } catch {
        console.error('[ThreadRuntime] Automation error-turn synthesis failed', {
          threadId: target.threadId,
          drainId: claimedRecord.drainId,
          marker: 'AUTOMATION_ERROR_TURN_SYNTHESIS_FAILED',
        });
      }
    }
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.IN_FLIGHT) {
      threadRuntimeManager.markReady(runtimeKey);
    }
    const safeTerminalError = normalizeTurnTerminalError(err);
    console.error('[ThreadRuntime] Automation harness send failed', {
      threadId: target.threadId,
      drainId: claimedRecord.drainId,
      marker: safeTerminalError.code,
    });
    return {
      accepted: false,
      deferred: false,
      error: safeTerminalError.message,
      threadId: target.threadId,
      scope: target.scope,
    };
  }
}

module.exports = {
  getAutomationRuntimeStatus,
  sendAutomationPrompt,
  _getRuntimeKey: getRuntimeKey,
};
