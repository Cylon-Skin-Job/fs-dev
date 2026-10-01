/** Own the claimed headless iterator lifecycle through canonical drain APIs. */
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { unregisterWire } = require('../wire/process-manager');
const { releaseAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { disposeTurnApplicationContext } = require('./automation-turn-context');
const { isHarnessRuntimeError } = require('../harness/errors');
const { normalizeTurnTerminalError } = require('./turn-terminal-error');
const { persistDiagnosticReport } = require('./harness-diagnostic-service');
const { persistTerminalDiagnosticSafely } = require('./terminal-diagnostic-boundary');
async function drainAutomationTurn({ target, wire, runtimeKey, claimedRecord, bridge, turnAuthority, turnApplicationContext, input }) {
  const ownership = threadRuntimeManager.captureOwnership(runtimeKey);
  const current = () => threadRuntimeManager.isOwnershipCurrent(ownership);
  const drainContext = { route: claimedRecord.routeContext, control: claimedRecord.control };
  let resolveDrainCompletion;
  const drainCompletion = new Promise(resolve => {
    resolveDrainCompletion = resolve;
  });
  let retirementRequested = false;

  try {
    threadRuntimeManager.bindActiveDrainLifecycle(runtimeKey, claimedRecord.drainId, {
      completion: drainCompletion,
      retire: async () => {
        if (!current() || !threadRuntimeManager.isDrainCurrent(runtimeKey, claimedRecord.drainId)) return false;
        retirementRequested = true;
        threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
        const boundTurnId = threadRuntimeManager.resolveBoundTurnId(
          runtimeKey,
          claimedRecord.drainId,
        );
        if (boundTurnId) {
          try {
            await bridge.applyHarnessEvent({
              type: 'turn_end',
              reason: 'interrupted',
              partial: true,
            }, null, drainContext);
          } catch {
            console.error('[ThreadRuntime] Automation interruption synthesis failed', {
              threadId: target.threadId,
              drainId: claimedRecord.drainId,
              marker: 'AUTOMATION_INTERRUPTION_SYNTHESIS_FAILED',
            });
          }
        }
        if (!current()) return false;
        try {
          await claimedRecord.control.stopHarness();
        } catch {
          threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.STOPPING);
          return false;
        }
        if (!current()) return false;
        unregisterWire(target.threadId, target, wire);
        threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, claimedRecord.drainId);
        if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING) {
          threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.COLD);
        }
        return true;
      },
    });
  } catch {
    threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, claimedRecord.drainId);
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    resolveDrainCompletion();
    releaseAgentTurnAuthorityRef(turnAuthority);
    disposeTurnApplicationContext(turnApplicationContext);
    console.error('[ThreadRuntime] Automation prompt drain lifecycle failed', {
      threadId: target.threadId,
      marker: 'AUTOMATION_PROMPT_DRAIN_LIFECYCLE_FAILED',
    });
    return {
      accepted: false,
      deferred: false,
      error: 'Prompt binding failed',
      threadId: target.threadId,
      scope: target.scope,
    };
  }
  function isDrainSuperseded() {
    return !current();
  }

  try {
    await bridge.drainHarnessEvents(wire._sendMessage(input, {}), null, {
      drainContext,
      turnAuthority,
      turnApplicationContext,
      finalizeOnError: false,
    });
    if (retirementRequested) {
      return {
        accepted: false,
        deferred: false,
        error: 'Drain retired during iteration',
        threadId: target.threadId,
        scope: target.scope,
      };
    }
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
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    }
    return {
      accepted: true,
      deferred: false,
      threadId: target.threadId,
      scope: target.scope,
    };
  } catch (err) {
    if (retirementRequested) {
      return {
        accepted: false,
        deferred: false,
        error: 'Drain retired during iteration',
        threadId: target.threadId,
        scope: target.scope,
      };
    }
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
    const boundTurnId = threadRuntimeManager.resolveBoundTurnId(runtimeKey, claimedRecord.drainId);
    if (boundTurnId) {
      let diagnosticId = null;
      if (isHarnessRuntimeError(err) && err.candidate) {
        diagnosticId = await persistTerminalDiagnosticSafely(
          persistDiagnosticReport,
          {
            workspaceId: target.workspaceId,
            projectRoot: target.projectRoot,
            workspaceEpoch: target.workspaceEpoch,
            threadId: target.threadId,
            turnId: boundTurnId,
          },
          err.candidate,
        );
      }
      try {
        await bridge.applyHarnessEvent({
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
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
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
  } finally {
    if (current() && threadRuntimeManager.getRuntimeState(runtimeKey) !== RUNTIME_STATES.STOPPING) {
      threadRuntimeManager.clearActiveDrainIfCurrent(runtimeKey, claimedRecord.drainId);
    }
    releaseAgentTurnAuthorityRef(turnAuthority);
    disposeTurnApplicationContext(turnApplicationContext);
    resolveDrainCompletion();
  }
}

module.exports = { drainAutomationTurn };
