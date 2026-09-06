/**
 * Canonical Chat Event Applier
 *
 * Provider-neutral dispatcher for prompt-bound canonical drains. Runtime state
 * remains owned by ThreadRuntimeManager; agent provenance uses the immutable
 * authority captured at prompt acceptance and carried by the bridge.
 */

const { threadRuntimeManager } = require('../thread/thread-runtime-manager');
const liveTurnSnapshot = require('../thread/live-turn-snapshot');
const { releaseAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { createCanonicalChatTextEvents } = require('./canonical-chat-text-events');
const { createCanonicalChatToolEvents } = require('./canonical-chat-tool-events');
const { createCanonicalChatTerminalEvents } = require('./canonical-chat-terminal-events');
const {
  createCanonicalChatEventApplier: createLegacyCanonicalChatEventApplier,
} = require('./canonical-chat-event-applier-legacy');

function createDrainDrivenCanonicalChatEventApplier({
  emit,
  checkSettingsBounce,
  generateTurnId,
  activityOwner = null,
  enableSyntheticIncrementalProvenance = false,
}) {
  const textEvents = createCanonicalChatTextEvents({ emit });
  let replayedTerminalBounce = null;
  const toolEvents = createCanonicalChatToolEvents({
    emit,
    checkSettingsBounce: (toolName, args, workspaceRoot) => {
      const replay = replayedTerminalBounce;
      if (replay
        && replay.toolName === toolName
        && replay.workspaceRoot === workspaceRoot
        && JSON.stringify(replay.args) === JSON.stringify(args)) {
        replayedTerminalBounce = null;
        return replay.bounce;
      }
      return checkSettingsBounce(toolName, args, workspaceRoot);
    },
  });
  const terminalEvents = createCanonicalChatTerminalEvents({ emit });

  function lifecycleCurrent(payload) {
    return !payload?.isLifecycleCurrent || payload.isLifecycleCurrent();
  }

  function authorityFor(payload) {
    return payload?.agentTurnAuthority || null;
  }

  function currentTurn(control) {
    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    if (!record || record.drainId !== control.drainId || !record.turn) return null;
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    return turnId ? { record, turnId } : null;
  }

  function jsonSafePersistedResult(result) {
    if (activityOwner?.jsonSafePersistedResult) return activityOwner.jsonSafePersistedResult(result);
    const serialized = JSON.stringify(result);
    if (serialized === undefined) throw new TypeError('Tool result has no JSON representation');
    return JSON.parse(serialized);
  }

  function applyChatEvent(event, ws, drainContext) {
    if (!drainContext?.control || !drainContext?.route) {
      console.warn('[CanonicalApplier] Dropping canonical event without a drain context');
      return undefined;
    }
    if (!event || !event.type) return undefined;
    const { type, payload } = event;
    const { route, control } = drainContext;
    switch (type) {
      case 'turn_begin': return applyTurnStart(payload, route, control);
      case 'content': textEvents.handleContent({ payload, route, control }); return undefined;
      case 'thinking': textEvents.handleThinking({ payload, route, control }); return undefined;
      case 'tool_call': return applyToolCall(payload, route, control);
      case 'tool_call_args': return applyToolCallArgs(payload, route, control);
      case 'tool_result': return applyToolResult(payload, route, control);
      case 'tool_snapshot': return applyTerminalToolSnapshot(payload, route, control);
      case 'subagent_event': applySubagentUpdate(payload, route, control); return undefined;
      case 'status_update': applyStatusMetadata(payload, route, control); return undefined;
      case 'step_begin': applyStepBegin(payload, route, control); return undefined;
      case 'turn_end': return applyTurnEnd(payload, route, control);
      default: return undefined;
    }
  }

  function applyTurnStart(payload, route, control) {
    control.touchThreadSession();
    const userInput = route.acceptedUserInput || payload?.userInput || '';
    if (!userInput) return { accepted: false };
    const authority = authorityFor(payload);
    const turnId = authority?.turnId || generateTurnId();
    const result = threadRuntimeManager.beginCanonicalTurn(control.runtimeKey, control.drainId, {
      turnId,
      userInput,
      attachments: Array.isArray(route.attachments) ? route.attachments : [],
    });
    if (!result.accepted) return { accepted: false };
    emit('chat:turn_begin', {
      workspace: route.workspace,
      workspaceId: route.workspaceId,
      projectRoot: authority?.canonicalRoot || route.projectRoot,
      scope: route.scope,
      threadId: route.threadId,
      turnId,
      streamSeq: threadRuntimeManager.getLiveTurn(control.runtimeKey)?.streamSeq ?? null,
      userInput,
      attachments: [...(route.attachments || [])],
    });
    return { accepted: true, turnId };
  }

  async function applyToolCall(payload, route, control) {
    const active = currentTurn(control);
    if (enableSyntheticIncrementalProvenance
      && payload?.origin !== 'terminal_snapshot' && activityOwner?.announce) {
      try {
        await activityOwner.announce(authorityFor(payload), {
          ...payload,
          nativeToolName: payload?.nativeToolName || payload?.toolName || 'unknown',
          observedAt: payload?.observedAt ?? Date.now(),
        });
      } catch {
        console.warn('[CanonicalApplier] agent_tool_reservation_failed');
      }
    }
    const stillActive = currentTurn(control);
    if (!lifecycleCurrent(payload) || !active || active.record !== stillActive?.record) return;
    toolEvents.handleToolCall({ payload, route, control });
  }

  async function applyToolCallArgs(payload, route, control) {
    const activeBefore = currentTurn(control);
    let completeArgs = null;
    if (payload?.hasCompleteArgs) {
      completeArgs = payload.completeArgs;
    } else if (activeBefore && payload?.toolCallId && payload?.argsChunk) {
      try {
        completeArgs = JSON.parse(
          (activeBefore.record.turn.toolArgsBuffers.get(payload.toolCallId) || '')
            + payload.argsChunk,
        );
      } catch {
        completeArgs = null;
      }
    }
    toolEvents.handleToolCallArgs({ payload, route, control });
    if (!enableSyntheticIncrementalProvenance
      || payload?.origin === 'terminal_snapshot' || !activityOwner?.acceptArguments) return;
    const active = currentTurn(control);
    if (!active || !lifecycleCurrent(payload)) return;
    try {
      if (completeArgs === null) return;
      await activityOwner.acceptArguments(authorityFor(payload), {
        ...payload,
        hasCompleteArgs: true,
        completeArgs,
        observedAt: payload?.observedAt ?? Date.now(),
      });
      if (!lifecycleCurrent(payload) || active.record !== currentTurn(control)?.record) return;
      if (active.record.turn.bouncedToolCalls.has(payload?.toolCallId)
        && activityOwner?.blockBeforeExecution) {
        await activityOwner.blockBeforeExecution(authorityFor(payload), {
          ...payload,
          toolCallId: payload?.toolCallId,
          toolName: payload?.toolName
            || active.record.turn.toolNamesById?.[payload?.toolCallId]
            || '',
          observedAt: payload?.observedAt ?? Date.now(),
        });
      }
    } catch {
      // Partial argument streams are expected; ownership advances once complete.
    }
  }

  async function applyToolResult(payload, route, control) {
    toolEvents.applyToolOutcome({ payload, route, control });
    if (!enableSyntheticIncrementalProvenance
      || payload?.origin === 'terminal_snapshot' || !activityOwner?.complete) return;
    try {
      await activityOwner.complete(authorityFor(payload), {
        ...payload,
        isError: Boolean(payload?.result?.isError),
        observedAt: payload?.observedAt ?? Date.now(),
      }, jsonSafePersistedResult(payload?.result || {}));
    } catch {
      console.warn('[CanonicalApplier] agent_tool_reservation_failed');
    }
  }

  async function applyTerminalToolSnapshot(payload, route, control) {
    control.touchThreadSession();
    const active = currentTurn(control);
    if (!active || !lifecycleCurrent(payload)) return;
    const authority = authorityFor(payload);
    if (payload?.origin !== 'terminal_snapshot') {
      console.warn('[CanonicalApplier] agent_tool_malformed_identity');
      return;
    }
    const eligible = authority?.harnessId === 'opencode'
      && authority.provider === 'opencode'
      && payload.harnessId === authority.harnessId
      && payload.provider === authority.provider;
    if (!eligible) console.warn('[CanonicalApplier] agent_tool_malformed_identity');
    const turn = active.record.turn;
    if (!turn.terminalSnapshotsExpanded) turn.terminalSnapshotsExpanded = new Set();
    const alreadyExpanded = turn.terminalSnapshotsExpanded.has(payload.toolCallId);
    if (alreadyExpanded && !eligible) {
      console.warn('[CanonicalApplier] agent_tool_duplicate_terminal');
      return;
    }

    const args = payload.hasInput ? payload.input : undefined;
    let resolvedBounce = null;
    if (payload.hasInput && authority?.canonicalRoot) {
      try {
        resolvedBounce = checkSettingsBounce(payload.toolName, args, authority.canonicalRoot);
      } catch {
        console.warn('[CanonicalApplier] agent_tool_enforcement_evaluation_failed');
      }
    }
    const selectedResult = resolvedBounce ? {
      output: resolvedBounce.message,
      statusMessage: resolvedBounce.message,
      display: [], returnedDiff: false, isError: true, files: [],
      enforcementPhase: 'tool_result',
    } : (payload.result || {});
    const output = selectedResult.output || '';
    const statusMessage = selectedResult.statusMessage;
    const isError = Boolean(selectedResult.isError);
    const resultValue = {
      output,
      statusMessage,
      display: Array.isArray(selectedResult.display) ? selectedResult.display : [],
      returnedDiff: Boolean(selectedResult.returnedDiff),
      isError,
      error: isError ? (output || statusMessage || 'Tool failed') : undefined,
      files: Array.isArray(selectedResult.files) ? selectedResult.files : [],
      ...(resolvedBounce ? { enforcementPhase: 'tool_result' } : {}),
    };
    let persistedResult;
    let fingerprintResult;
    try {
      persistedResult = jsonSafePersistedResult(resultValue);
      fingerprintResult = persistedResult;
    } catch {
      persistedResult = resultValue;
      fingerprintResult = undefined;
    }
    try {
      if (eligible) {
        await activityOwner?.captureTerminalSnapshot(authority, payload, fingerprintResult, {
          isCurrent: payload.isLifecycleCurrent,
        });
      }
    } catch {
      console.warn('[CanonicalApplier] agent_tool_reservation_failed');
    }
    if (!lifecycleCurrent(payload) || active.record !== currentTurn(control)?.record) return;
    if (alreadyExpanded || turn.terminalSnapshotsExpanded.has(payload.toolCallId)) {
      console.warn('[CanonicalApplier] agent_tool_duplicate_terminal');
      return;
    }
    turn.terminalSnapshotsExpanded.add(payload.toolCallId);

    toolEvents.handleToolCall({ payload: { ...payload, origin: 'terminal_snapshot' }, route, control });
    if (payload.hasInput) {
      const identity = { drainId: control.drainId, turnId: active.turnId };
      const argsChunk = JSON.stringify(args);
      const seq = threadRuntimeManager.applyLiveMutation(
        control.runtimeKey,
        identity,
        ({ snapshot, turn: accumulator }) => {
          accumulator.toolArgsBuffers.set(payload.toolCallId, argsChunk);
          liveTurnSnapshot.applyToolArgs(snapshot, payload.toolCallId, args);
        },
      );
      if (seq !== null) {
        emit('chat:tool_call_args', {
          workspace: route.workspace,
          scope: route.scope,
          threadId: route.threadId,
          turnId: active.turnId,
          streamSeq: seq,
          toolCallId: payload.toolCallId,
          argsChunk,
        });
      }
    }
    const terminalRoute = { ...route, projectRoot: authority?.canonicalRoot || null };
    replayedTerminalBounce = {
      toolName: payload.toolName,
      args: payload.hasInput ? args : {},
      workspaceRoot: terminalRoute.projectRoot,
      bounce: resolvedBounce,
    };
    try {
      toolEvents.applyToolOutcome({
        payload: {
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          result: persistedResult,
          origin: 'terminal_snapshot',
        },
        route: terminalRoute,
        control,
      });
    } finally {
      replayedTerminalBounce = null;
    }
  }

  function applySubagentUpdate(payload, route, control) {
    control.touchThreadSession();
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) return;
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      ({ snapshot }) => liveTurnSnapshot.touchStatus(snapshot),
    );
    if (seq === null) return;
    emit('chat:subagent_event', {
      workspace: route.workspace, scope: route.scope, threadId: route.threadId,
      turnId, streamSeq: seq, parentToolCallId: payload?.parentToolCallId || '',
      agentId: payload?.agentId || '', subagentType: payload?.subagentType || '',
      eventType: payload?.subagentEventType || '', eventPayload: payload?.subagentPayload || {},
    });
  }

  function applyStatusMetadata(payload, route, control) {
    control.touchThreadSession();
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) return;
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      ({ snapshot, turn }) => {
        turn.usage.contextUsage = payload?.contextUsage ?? null;
        turn.usage.tokenUsage = payload?.tokenUsage ?? null;
        turn.usage.messageId = payload?.messageId ?? null;
        turn.usage.planMode = payload?.planMode ?? false;
        liveTurnSnapshot.setUsage(snapshot, turn.usage);
      },
    );
    if (seq === null) return;
    emit('chat:status_update', {
      workspace: route.workspace, scope: route.scope, threadId: route.threadId,
      turnId, streamSeq: seq, contextUsage: payload?.contextUsage,
      tokenUsage: payload?.tokenUsage, messageId: payload?.messageId, planMode: payload?.planMode,
    });
  }

  const MIN_STEP_TIMESTAMP_MS = 946684800000;
  const STEP_TIMESTAMP_FUTURE_SKEW_MS = 60000;
  function applyStepBegin(payload, route, control) {
    control.touchThreadSession();
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) return;
    const stepId = typeof payload?.stepId === 'string' && payload.stepId ? payload.stepId : null;
    const messageId = typeof payload?.messageId === 'string' && payload.messageId ? payload.messageId : null;
    const candidate = payload?.timestamp;
    const hasTimestamp = typeof candidate === 'number' && Number.isFinite(candidate);
    const identity = stepId ? `step:${stepId}` : messageId ? `message:${messageId}`
      : hasTimestamp ? `time:${String(candidate)}` : null;
    if (!identity) return;
    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    if (record?.turn?.seenStepIdentities?.has(identity)) return;
    const now = Date.now();
    const startedAt = hasTimestamp && candidate >= MIN_STEP_TIMESTAMP_MS
      && candidate <= now + STEP_TIMESTAMP_FUTURE_SKEW_MS ? Math.min(candidate, now) : now;
    let activityRevision = null;
    const streamSeq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      ({ snapshot, turn }) => {
        if (turn.seenStepIdentities.has(identity)) return;
        turn.seenStepIdentities.add(identity);
        snapshot.seenStepIdentities = Array.from(turn.seenStepIdentities);
        snapshot.activityRevision += 1;
        activityRevision = snapshot.activityRevision;
        snapshot.activity = {
          kind: 'working', turnId, identity, startedAt, activityRevision,
          ...(stepId ? { stepId } : {}), ...(messageId ? { messageId } : {}),
        };
        snapshot.stepCursor = { identity, startedAt };
        liveTurnSnapshot.touchStatus(snapshot);
      },
    );
    if (streamSeq === null || activityRevision === null) return;
    emit('chat:step_begin', {
      workspace: route.workspace, scope: route.scope, threadId: route.threadId,
      turnId, streamSeq, identity, ...(stepId ? { stepId } : {}),
      ...(messageId ? { messageId } : {}), startedAt, activityRevision,
    });
  }

  async function applyTurnEnd(payload, route, control) {
    const authority = authorityFor(payload);
    try {
      if (activityOwner?.interruptOpen) {
        const interruption = Promise.resolve(activityOwner.interruptOpen(authority, {
          observedAt: payload?.observedAt ?? Date.now(), timeoutMs: 2_000,
        }));
        if (payload?.shutdownSignal) {
          const aborted = new Promise((resolve) => {
            if (payload.shutdownSignal.aborted) resolve();
            else payload.shutdownSignal.addEventListener('abort', resolve, { once: true });
          });
          await Promise.race([interruption, aborted]);
          interruption.catch(() => {});
        } else {
          await interruption;
        }
      }
    } catch {
      console.warn('[CanonicalApplier] agent_tool_reservation_failed');
    }
    if (payload?.shutdownSignal?.aborted) {
      releaseAgentTurnAuthorityRef(authority);
      return;
    }
    terminalEvents.handleTurnEnd({ payload, route, control });
    releaseAgentTurnAuthorityRef(authority);
  }

  return { applyChatEvent };
}

function createCanonicalChatEventApplier(options) {
  if (options && Object.prototype.hasOwnProperty.call(options, 'session')) {
    const legacy = createLegacyCanonicalChatEventApplier(options);
    Object.defineProperty(legacy.applyChatEvent, '_requiresSequencedBridge', {
      value: true,
    });
    return legacy;
  }
  return createDrainDrivenCanonicalChatEventApplier(options);
}

module.exports = { createCanonicalChatEventApplier };
