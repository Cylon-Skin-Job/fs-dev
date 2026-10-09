const { v4: generateId } = require('uuid');
const path = require('path');
const { resolveScope } = require('../chat-scope');
const { createAgentTurnAuthorityRef, releaseAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { createCanonicalRouteContext, createCanonicalDrainControl } = require('./canonical-drain-context');
const { terminateProviderProcessAndWait } = require('./provider-termination');
const { awaitThreadManagerReady, getThreadManagerForTarget } = require('./thread-manager-registry');
const { ensureAutomationWire, getDeferReason } = require('./automation-runtime-activation');
const { createHeadlessTurnApplicationContext, disposeTurnApplicationContext, createAutomationBridge } = require('./automation-turn-context');
const { drainAutomationTurn } = require('./automation-drain');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
function normalizeTarget(target) {
  if (!target || !target.workspaceId || !target.projectRoot || !target.threadId) {
    throw new Error('Automation target requires workspaceId, projectRoot, and threadId');
  }
  return {
    workspaceId: target.workspaceId,
    projectRoot: path.resolve(target.projectRoot),
    workspaceEpoch: target.workspaceEpoch
      || `automation:${target.workspaceId}:${path.resolve(target.projectRoot)}`,
    scope: 'project',
    viewId: null,
    threadId: target.threadId,
  };
}

function getRuntimeKey(target) {
  return {
    workspaceId: target.workspaceId,
    projectRoot: target.projectRoot,
    workspaceEpoch: target.workspaceEpoch,
    scope: 'project',
    threadId: target.threadId,
  };
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
  let ownership;
  const sessions = Object.freeze({ openSession: manager.openSession.bind(manager),
    getSession: manager.getSession?.bind(manager), closeSession: manager.closeSession?.bind(manager) });
  try {
    const { withSessionAdmission } = require('../thread-groups/session-transactions');
    wireResult = await withSessionAdmission(target.workspaceId, target.threadId, async () => {
      const runtime = threadRuntimeManager.adoptRuntimeIdentity(runtimeKey);
      if (!runtime) return { wire: null, deferReason: 'in_flight' };
      ownership = threadRuntimeManager.captureOwnership(runtimeKey);
      const ready = await ensureAutomationWire(target, sessions, runtimeKey, ownership);
      if (ready.deferReason) return ready;
      const state = threadRuntimeManager.getRuntimeState(runtimeKey);
      if (!threadRuntimeManager.isOwnershipCurrent(ownership) || state !== RUNTIME_STATES.READY) return { wire: null, deferReason: getDeferReason(state) || 'in_flight' };
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.IN_FLIGHT);
      return ready;
    });
    if (!wireResult) return { accepted: false, deferred: false, error: `Thread not found: ${target.threadId}`,
      threadId: target.threadId, scope: target.scope };
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

  try {
    await persistAutomationUserPrompt(manager, target, input);
  } catch {
    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
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

  const turnId = generateId();
  let turnAuthority = null;
  try {
    const harnessId = thread.entry?.harnessId;
    if (!harnessId || wire._harnessId !== harnessId) throw new Error('resolved harness identity mismatch');
    turnAuthority = await createAgentTurnAuthorityRef({
      workspaceId: manager.workspaceId,
      threadId: target.threadId,
      turnId,
      harnessId,
      provider: wire._provider || harnessId,
      workspaceRoot: manager.projectRoot || target.projectRoot,
    });
  } catch {
    console.warn('[AgentProvenance] agent_turn_authority_unavailable');
  }
  if (!threadRuntimeManager.isOwnershipCurrent(ownership)) {
    releaseAgentTurnAuthorityRef(turnAuthority);
    return { accepted: false, deferred: false, error: 'Runtime replaced during admission',
      threadId: target.threadId, scope: target.scope };
  }
  const bridge = createAutomationBridge(turnAuthority);
  const turnApplicationContext = createHeadlessTurnApplicationContext(
    target,
    wire,
    turnAuthority,
    turnId,
    input,
  );
  let claimedRecord = null;
  try {
    const routeContext = createCanonicalRouteContext({
      workspaceId: target.workspaceId,
      workspace: resolveScope({ currentWorkspaceId: target.workspaceId, currentViewId: null }),
      projectRoot: turnAuthority?.canonicalRoot || target.projectRoot,
      workspaceEpoch: target.workspaceEpoch,
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
          await terminateProviderProcessAndWait(wire, 2_000, 1_000);
        } catch {
          console.warn('[ThreadRuntime] Automation harness stop failed', {
            threadId: target.threadId,
            drainId,
            marker: 'AUTOMATION_HARNESS_STOP_FAILED',
          });
          throw new Error('Automation provider termination failed');
        }
      },
    });

    claimedRecord = threadRuntimeManager.claimActiveDrain(runtimeKey, drainControl, routeContext);
  } catch {
    if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.IN_FLIGHT) {
      threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);
    }
    releaseAgentTurnAuthorityRef(turnAuthority);
    disposeTurnApplicationContext(turnApplicationContext);
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

  return drainAutomationTurn({ target, wire, runtimeKey, claimedRecord, bridge, turnAuthority, turnApplicationContext, input });
}
module.exports = {
  getAutomationRuntimeStatus,
  sendAutomationPrompt,
  _getRuntimeKey: target => getRuntimeKey(normalizeTarget(target)),
};
