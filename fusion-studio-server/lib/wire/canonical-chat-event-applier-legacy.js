/**
 * Canonical Chat Event Applier
 *
 * Consumes canonical-shaped chat events and applies them to session state,
 * emitting chat:* events on the event bus.
 *
 * This module is vendor-agnostic. It does not parse raw wire protocol messages
 * and does not import Kimi-specific normalizers.
 *
 * Dependencies are injected:
 *   - session: per-connection session state (mutated)
 *   - emit: event bus emitter
 *   - resolveWorkspace: function to resolve workspace string from session
 *   - touchThreadSession: function to reset idle timeout
 *   - checkSettingsBounce: function(toolName, args, workspaceRoot) -> {message}|null
 *   - generateTurnId: function() -> string
 */

const { threadRuntimeManager } = require('../thread/thread-runtime-manager');
const { releaseAgentTurnAuthorityRef } = require('../agent-provenance/turn-authority');
const { AsyncLocalStorage } = require('async_hooks');

function createCanonicalChatEventApplier({
  session: baseSession,
  emit,
  resolveWorkspace,
  touchThreadSession,
  checkSettingsBounce,
  generateTurnId,
  activityOwner = null,
  enableSyntheticIncrementalProvenance = false,
}) {
  const turnApplicationStorage = new AsyncLocalStorage();
  const session = new Proxy(baseSession, {
    get(target, property, receiver) {
      const turnSession = turnApplicationStorage.getStore();
      return turnSession && Reflect.has(turnSession, property)
        ? Reflect.get(turnSession, property, turnSession)
        : Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      const turnSession = turnApplicationStorage.getStore();
      return turnSession
        ? Reflect.set(turnSession, property, value, turnSession)
        : Reflect.set(target, property, value, receiver);
    },
    deleteProperty(target, property) {
      const turnSession = turnApplicationStorage.getStore();
      return Reflect.deleteProperty(turnSession || target, property);
    },
  });

  function getWorkspace() {
    if (session.currentTurn?.authority?.workspaceId) {
      return `workspace:${session.currentTurn.authority.workspaceId}`;
    }
    return resolveWorkspace(session);
  }

  function getThreadId() {
    return session.currentTurn?.authority?.threadId || session.currentThreadId;
  }

  function getScope() {
    // RCC-0095: all threads are workspace-scoped. The literal is kept on
    // emitted chat:* events for wire compatibility.
    return 'project';
  }

  function getTurnId() {
    return session.currentTurn?.id;
  }

  function getRuntimeKey(threadId = getThreadId()) {
    const workspaceId = session.currentTurn?.authority?.workspaceId || session.currentWorkspaceId;
    if (!workspaceId || !threadId) return null;
    return {
      workspaceId,
      scope: getScope(),
      threadId,
    };
  }

  function isTerminalDerived(payload) {
    return payload?.origin === 'terminal_snapshot' || payload?.origin === 'terminal_chat_fail_open';
  }

  function isLifecycleCurrent(payload) {
    return !payload?.isLifecycleCurrent || payload.isLifecycleCurrent();
  }

  /**
   * Apply a canonical chat event.
   * @param {object} event
   * @param {string} event.type - canonical event type
   * @param {object} event.payload - event-specific payload
   * @param {import('ws').WebSocket} [ws] - required for turn_end persistence
   */
  async function applyChatEventInContext(event, ws) {
    const { type, payload } = event;

    switch (type) {
      case 'turn_begin':
        applyTurnStart(payload);
        break;
      case 'content':
        handleContent(payload);
        break;
      case 'thinking':
        handleThinking(payload);
        break;
      case 'tool_call':
        await handleToolCall(payload);
        break;
      case 'tool_call_args':
        await handleToolCallArgs(payload);
        break;
      case 'tool_result':
        await applyToolOutcome(payload);
        break;
      case 'tool_snapshot':
        await applyTerminalToolSnapshot(payload);
        break;
      case 'subagent_event':
        applySubagentUpdate(payload);
        break;
      case 'status_update':
        applyStatusMetadata(payload);
        break;
      case 'turn_end':
        await handleTurnEnd(payload, ws);
        break;
      default:
        // Unknown canonical event type — silently ignore
        break;
    }
  }

  function applyChatEvent(event, ws, turnApplicationContext = null) {
    if (turnApplicationContext && typeof turnApplicationContext === 'object') {
      return turnApplicationStorage.run(
        turnApplicationContext,
        () => applyChatEventInContext(event, ws),
      );
    }
    return applyChatEventInContext(event, ws);
  }

  function applyTurnStart(payload) {
    touchThreadSession(getThreadId());

    // Ignore spurious startup turns (Gemini emits one on ACP session creation)
    if (!payload?.userInput && !session.pendingUserInput) {
      console.log('[CanonicalApplier] Ignoring spurious turn_begin (no user input)');
      return;
    }

    const pendingAttachments = Array.isArray(session.pendingAttachments)
      ? session.pendingAttachments
      : [];

    const authority = session.pendingAgentTurnAuthority || null;
    const turnId = authority?.turnId || session.pendingTurnId || generateTurnId();
    session.currentTurn = {
      id: turnId,
      text: '',
      userInput: session.pendingUserInput || payload?.userInput || '',
      attachments: pendingAttachments,
    };
    Object.defineProperties(session.currentTurn, {
      authority: { value: authority, enumerable: false },
      terminalSnapshotsExpanded: { value: new Set(), enumerable: false },
    });
    session.pendingAgentTurnAuthority = null;
    session.pendingTurnId = null;
    session.pendingUserInput = null;
    session.pendingAttachments = [];
    session.hasToolCalls = false;
    session.assistantParts = [];  // Reset parts for new exchange

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.beginLiveTurn(runtimeKey, {
        turnId: session.currentTurn.id,
        userInput: session.currentTurn.userInput,
      });
    }

    emit('chat:turn_begin', {
      workspace: getWorkspace(),
      workspaceId: authority?.workspaceId || session.currentWorkspaceId,
      projectRoot: authority?.canonicalRoot || session.projectRoot,
      scope: getScope(),
      threadId: getThreadId(),
      turnId: session.currentTurn.id,
      userInput: session.currentTurn.userInput,
      attachments: session.currentTurn.attachments,
    });
  }

  function handleContent(payload) {
    touchThreadSession(getThreadId());
    if (!session.currentTurn) return;

    const text = payload?.text || '';
    session.currentTurn.text += text;

    // Combine consecutive text parts
    const lastPart = session.assistantParts[session.assistantParts.length - 1];
    if (lastPart && lastPart.type === 'text') {
      lastPart.content += text;
    } else {
      session.assistantParts.push({
        type: 'text',
        content: text
      });
    }

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.appendLiveContent(runtimeKey, text);
    }

    emit('chat:content', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      turnId: getTurnId(),
      text
    });
  }

  function handleThinking(payload) {
    touchThreadSession(getThreadId());
    if (!session.currentTurn) return;

    const text = payload?.text || '';

    // Track thinking separately (not combined with text)
    const lastPart = session.assistantParts[session.assistantParts.length - 1];
    if (lastPart && lastPart.type === 'think') {
      lastPart.content += text;
    } else {
      session.assistantParts.push({
        type: 'think',
        content: text
      });
    }

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.appendLiveThinking(runtimeKey, text);
    }

    emit('chat:thinking', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      turnId: getTurnId(),
      text
    });
  }

  async function handleToolCall(payload) {
    touchThreadSession(getThreadId());
    const turn = session.currentTurn;
    const authority = turn?.authority;
    if (enableSyntheticIncrementalProvenance
      && payload?.origin !== 'terminal_snapshot' && activityOwner?.announce) {
      try {
        await activityOwner.announce(authority, {
          ...payload,
          nativeToolName: payload?.nativeToolName || payload?.toolName || 'unknown',
          observedAt: payload?.observedAt ?? Date.now(),
        });
      } catch {
        console.warn('[CanonicalApplier] agent_tool_reservation_failed');
      }
    }
    if (!isLifecycleCurrent(payload) || turn !== session.currentTurn) return;
    session.hasToolCalls = true;
    session.activeToolId = payload?.toolCallId || '';
    session.activeToolName = payload?.toolName || '';
    session.toolArgs[session.activeToolId] = '';
    session.toolNamesById = session.toolNamesById || {};
    session.toolNamesById[session.activeToolId] = session.activeToolName;

    // Start tracking tool call for history
    session.assistantParts.push({
      type: 'tool_call',
      toolCallId: session.activeToolId,
      name: payload?.toolName || 'unknown',
      arguments: {},
      result: {
        output: '',
        display: [],
        isError: false
      }
    });

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.appendLiveToolCall(runtimeKey, {
        toolCallId: session.activeToolId,
        toolName: payload?.toolName || 'unknown',
      });
    }

    emit('chat:tool_call', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      turnId: getTurnId(),
      toolName: payload?.toolName || 'unknown',
      toolCallId: session.activeToolId
    });
  }

  async function handleToolCallArgs(payload) {
    touchThreadSession(getThreadId());
    const turn = session.currentTurn;
    const authority = turn?.authority;
    const toolCallId = payload?.toolCallId || session.activeToolId;
    const argsChunk = payload?.argsChunk || '';

    if (payload?.origin === 'terminal_snapshot' && payload.hasCompleteArgs) {
      session.toolArgs[toolCallId] = JSON.stringify(payload.completeArgs);
    }

    if (toolCallId && argsChunk) {
      if (!(payload?.origin === 'terminal_snapshot' && payload.hasCompleteArgs)) {
        session.toolArgs[toolCallId] = (session.toolArgs[toolCallId] || '') + argsChunk;
      }
      const toolName = payload?.toolName || session.toolNamesById?.[toolCallId] || session.activeToolName || '';
      const runtimeKey = getRuntimeKey();
      if (runtimeKey) {
        threadRuntimeManager.appendLiveToolArgs(runtimeKey, toolCallId, argsChunk);
      }
      emit('chat:tool_call_args', {
        workspace: getWorkspace(),
        scope: getScope(),
        threadId: getThreadId(),
        turnId: getTurnId(),
        toolCallId,
        argsChunk
      });

      try {
        const parsedArgs = payload?.origin === 'terminal_snapshot' && payload.hasCompleteArgs
          ? payload.completeArgs
          : JSON.parse(session.toolArgs[toolCallId]);
        const bounced = isTerminalDerived(payload)
          ? false
          : applySettingsBounce(toolCallId, toolName, parsedArgs, true);
        if (bounced) {
          stopWireAfterPreExecutionBounce();
        }
        if (enableSyntheticIncrementalProvenance
          && payload?.origin !== 'terminal_snapshot' && activityOwner?.acceptArguments) {
          await activityOwner.acceptArguments(authority, {
            ...payload,
            hasCompleteArgs: true,
            completeArgs: parsedArgs,
            observedAt: payload?.observedAt ?? Date.now(),
          });
        }
        if (!isLifecycleCurrent(payload) || turn !== session.currentTurn) return;
        if (enableSyntheticIncrementalProvenance && bounced && activityOwner?.blockBeforeExecution) {
          await activityOwner.blockBeforeExecution(authority, {
            ...payload,
            toolCallId,
            toolName,
            observedAt: payload?.observedAt ?? Date.now(),
          });
        }
      } catch (_) {
        // Tool args may stream in chunks; enforce once a complete JSON object exists.
      }
    }
  }

  function getBouncedToolCalls() {
    if (!session.bouncedToolCalls) {
      session.bouncedToolCalls = new Set();
    }
    return session.bouncedToolCalls;
  }

  function stopWireAfterPreExecutionBounce() {
    if (session.wire && typeof session.wire.kill === 'function' && !session.wire.killed) {
      session.wire.kill('SIGTERM');
    }
  }

  function applySettingsBounce(
    toolCallId,
    toolName,
    parsedArgs,
    preExecution = false,
    workspaceRoot = session.projectRoot || null,
  ) {
    const bouncedToolCalls = getBouncedToolCalls();
    if (toolCallId && bouncedToolCalls.has(toolCallId)) return true;

    const bounce = checkSettingsBounce(toolName, parsedArgs, workspaceRoot);
    if (!bounce) return false;

    if (toolCallId) bouncedToolCalls.add(toolCallId);
    delete session.toolArgs[toolCallId];

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.applyLiveToolResult(runtimeKey, {
        toolCallId,
        toolArgs: parsedArgs,
        output: bounce.message,
        statusMessage: bounce.message,
        display: [],
        returnedDiff: false,
        isError: true,
        files: [],
      });
    }

    const toolCallPart = session.assistantParts.find(
      p => p.type === 'tool_call' && p.toolCallId === toolCallId
    );
    if (toolCallPart) {
      toolCallPart.arguments = parsedArgs;
      toolCallPart.result = {
        output: bounce.message,
        statusMessage: bounce.message,
        display: [],
        returnedDiff: false,
        isError: true,
        files: [],
        enforcementPhase: preExecution ? 'tool_args' : 'tool_result',
      };
    }

    emit('system:tool_bounced', {
      workspace: getWorkspace(),
      threadId: getThreadId(),
      toolName,
      filePath: parsedArgs.file_path || parsedArgs.filePath || parsedArgs.path,
      reason: bounce.message,
      phase: preExecution ? 'tool_args' : 'tool_result',
    });

    emit('chat:tool_result', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      turnId: getTurnId(),
      toolCallId,
      toolName,
      toolArgs: parsedArgs,
      toolOutput: bounce.message,
      toolStatus: bounce.message,
      toolDisplay: [],
      returnedDiff: false,
      isError: true,
      enforcementPhase: preExecution ? 'tool_args' : 'tool_result',
    });

    return true;
  }

  async function recordLegacyTerminal(payload, toolCallPart) {
    if (!enableSyntheticIncrementalProvenance
      || payload?.origin === 'terminal_snapshot' || !activityOwner?.complete) return;
    let persistedResult;
    try {
      persistedResult = makePersistedResult(toolCallPart?.result || payload?.result || {});
    } catch {
      persistedResult = undefined;
    }
    await activityOwner.complete(session.currentTurn?.authority, {
      ...payload,
      isError: Boolean(payload?.result?.isError),
      observedAt: payload?.observedAt ?? Date.now(),
    }, persistedResult);
  }

  async function applyToolOutcome(payload) {
    touchThreadSession(getThreadId());

    const toolCallId = payload?.toolCallId || '';
    const toolName = payload?.toolName || '';
    const fullArgs = session.toolArgs[toolCallId] || '';
    let parsedArgs = payload?.resolvedArgs || {};
    if (!payload?.hasResolvedArgs) {
      try { parsedArgs = JSON.parse(fullArgs); } catch (_) {}
    }
    delete session.toolArgs[toolCallId];

    if (payload?.origin !== 'terminal_snapshot' && toolCallId && session.bouncedToolCalls?.has(toolCallId)) {
      return;
    }

    // --- Hardwired enforcement: settings/ folder write-lock ---
    const terminalFailOpen = payload?.origin === 'terminal_chat_fail_open';
    const terminalAuthorityRoot = session.currentTurn?.authority?.canonicalRoot;
    const shouldApplyLegacyBounce = payload?.origin !== 'terminal_snapshot'
      && (!terminalFailOpen || terminalAuthorityRoot)
      && applySettingsBounce(
        toolCallId,
        toolName,
        parsedArgs,
        false,
        terminalFailOpen ? terminalAuthorityRoot : session.projectRoot || null,
      );
    if (shouldApplyLegacyBounce) {
      const bouncedPart = session.assistantParts.find(
        p => p.type === 'tool_call' && p.toolCallId === toolCallId
      );
      await recordLegacyTerminal(payload, bouncedPart);
      return;
    }
    // --- End enforcement ---

    const result = payload?.result || {};
    const output = result.output || '';
    const statusMessage = result.statusMessage;
    const display = Array.isArray(result.display) ? result.display : [];
    const returnedDiff = Boolean(result.returnedDiff);
    const isError = Boolean(result.isError);
    const files = Array.isArray(result.files) ? result.files : [];

    // Find and update the corresponding tool_call part
    const toolCallPart = session.assistantParts.find(
      p => p.type === 'tool_call' && p.toolCallId === toolCallId
    );
    if (toolCallPart) {
      toolCallPart.arguments = parsedArgs;
      if (payload?.origin === 'terminal_snapshot') {
        // This is the exact JSON-safe value fingerprinted before expansion.
        // Do not reconstruct omitted undefined properties on the persisted part.
        toolCallPart.result = result;
        toolCallPart.terminalSnapshotExpansionVersion = 1;
        toolCallPart.terminalSnapshotExpansionComplete = true;
      } else {
        toolCallPart.result = {
          output,
          statusMessage,
          display,
          returnedDiff,
          isError,
          error: isError ? (output || statusMessage || 'Tool failed') : undefined,
          files,
          ...(payload?.resolvedBounce ? { enforcementPhase: 'tool_result' } : {}),
        };
      }
    }

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.applyLiveToolResult(runtimeKey, {
        toolCallId,
        toolArgs: parsedArgs,
        output,
        statusMessage,
        display,
        returnedDiff,
        isError,
        files,
      });
    }

    if (payload?.resolvedBounce) {
      getBouncedToolCalls().add(toolCallId);
      emit('system:tool_bounced', {
        workspace: getWorkspace(),
        threadId: getThreadId(),
        toolName,
        filePath: parsedArgs.file_path || parsedArgs.filePath || parsedArgs.path,
        reason: output,
        phase: 'tool_result',
      });
    }

    emit('chat:tool_result', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      turnId: getTurnId(),
      toolCallId,
      toolName,
      toolArgs: parsedArgs,
      toolOutput: output,
      toolStatus: statusMessage,
      toolDisplay: display,
      returnedDiff,
      isError,
      ...(payload?.resolvedBounce ? { enforcementPhase: 'tool_result' } : {}),
    });
    await recordLegacyTerminal(payload, toolCallPart);
  }

  function makePersistedResult(result) {
    if (activityOwner?.jsonSafePersistedResult) return activityOwner.jsonSafePersistedResult(result);
    const serialized = JSON.stringify(result);
    if (serialized === undefined) throw new TypeError('Tool result has no JSON representation');
    return JSON.parse(serialized);
  }

  async function applyTerminalToolSnapshot(payload) {
    touchThreadSession(getThreadId());
    const turn = session.currentTurn;
    if (!turn) return;
    if (!isLifecycleCurrent(payload)) return;
    const authority = turn.authority;
    if (payload?.origin !== 'terminal_snapshot') {
      console.warn('[CanonicalApplier] agent_tool_malformed_identity');
      return;
    }
    const provenanceEligible = authority?.harnessId === 'opencode'
      && authority.provider === 'opencode'
      && payload.harnessId === authority.harnessId
      && payload.provider === authority.provider;
    if (!provenanceEligible) console.warn('[CanonicalApplier] agent_tool_malformed_identity');
    const alreadyExpanded = turn.terminalSnapshotsExpanded.has(payload.toolCallId);
    if (alreadyExpanded && !provenanceEligible) {
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
    const ordinaryResult = payload.result || {};
    const selectedResult = resolvedBounce ? {
      output: resolvedBounce.message,
      statusMessage: resolvedBounce.message,
      display: [],
      returnedDiff: false,
      isError: true,
      files: [],
      enforcementPhase: 'tool_result',
    } : ordinaryResult;
    const normalizedOutput = selectedResult.output || '';
    const normalizedStatus = selectedResult.statusMessage;
    const normalizedError = Boolean(selectedResult.isError);
    const resultValue = {
      output: normalizedOutput,
      statusMessage: normalizedStatus,
      display: Array.isArray(selectedResult.display) ? selectedResult.display : [],
      returnedDiff: Boolean(selectedResult.returnedDiff),
      isError: normalizedError,
      error: normalizedError ? (normalizedOutput || normalizedStatus || 'Tool failed') : undefined,
      files: Array.isArray(selectedResult.files) ? selectedResult.files : [],
      ...(resolvedBounce ? { enforcementPhase: 'tool_result' } : {}),
    };
    let persistedResult;
    let fingerprintResult;
    try {
      persistedResult = makePersistedResult(resultValue);
      fingerprintResult = persistedResult;
    } catch {
      // Serialization failure omits only provenance fingerprinting. Keep the
      // executed result on the legacy rendering path without rewriting truth.
      persistedResult = resultValue;
      fingerprintResult = undefined;
    }

    try {
      if (provenanceEligible) {
        await activityOwner?.captureTerminalSnapshot(authority, payload, fingerprintResult, {
          isCurrent: payload.isLifecycleCurrent,
        });
      }
    } catch {
      console.warn('[CanonicalApplier] agent_tool_reservation_failed');
    }

    if (!isLifecycleCurrent(payload) || turn !== session.currentTurn) return;
    if (alreadyExpanded || turn.terminalSnapshotsExpanded.has(payload.toolCallId)) {
      console.warn('[CanonicalApplier] agent_tool_duplicate_terminal');
      return;
    }
    turn.terminalSnapshotsExpanded.add(payload.toolCallId);
    await handleToolCall({
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      origin: 'terminal_snapshot',
    });
    if (payload.hasInput) {
      await handleToolCallArgs({
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        argsChunk: JSON.stringify(args),
        origin: 'terminal_snapshot',
        hasCompleteArgs: true,
        completeArgs: args,
      });
    }
    await applyToolOutcome({
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      result: persistedResult,
      origin: 'terminal_snapshot',
      hasResolvedArgs: payload.hasInput,
      resolvedArgs: payload.hasInput ? args : {},
      resolvedBounce: Boolean(resolvedBounce),
    });
  }

  function applySubagentUpdate(payload) {
    touchThreadSession(getThreadId());
    emit('chat:subagent_event', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      turnId: getTurnId(),
      parentToolCallId: payload?.parentToolCallId || '',
      agentId: payload?.agentId || '',
      subagentType: payload?.subagentType || '',
      eventType: payload?.subagentEventType || '',
      eventPayload: payload?.subagentPayload || {}
    });
  }

  function applyStatusMetadata(payload) {
    touchThreadSession(getThreadId());

    // Track latest context/token usage for persistence
    session.contextUsage = payload?.contextUsage ?? null;
    session.tokenUsage = payload?.tokenUsage ?? null;
    session.messageId = payload?.messageId ?? null;
    session.planMode = payload?.planMode ?? false;

    const runtimeKey = getRuntimeKey();
    if (runtimeKey) {
      threadRuntimeManager.touchLiveTurn(runtimeKey);
    }

    emit('chat:status_update', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId: getThreadId(),
      contextUsage: payload?.contextUsage,
      tokenUsage: payload?.tokenUsage,
      messageId: payload?.messageId,
      planMode: payload?.planMode
    });
  }

  async function handleTurnEnd(payload, ws) {
    const turn = session.currentTurn;
    if (!turn) return;
    const authority = turn.authority;

    const shutdownExpired = () => payload?.shutdownSignal?.aborted
      || (Number.isFinite(payload?.shutdownDeadline)
        && typeof payload?.shutdownMonotonicNow === 'function'
        && payload.shutdownMonotonicNow() >= payload.shutdownDeadline);

    try {
      if (activityOwner?.interruptOpen) {
        const interruption = Promise.resolve(activityOwner.interruptOpen(authority, {
          observedAt: payload?.observedAt ?? Date.now(),
          timeoutMs: 2_000,
        }));
        const shutdownSignal = payload?.shutdownSignal;
        if (!shutdownSignal) {
          await interruption;
        } else if (!shutdownExpired()) {
          let onAbort;
          const aborted = new Promise((resolve) => {
            onAbort = resolve;
            shutdownSignal.addEventListener('abort', onAbort, { once: true });
          });
          try {
            await Promise.race([interruption, aborted]);
          } finally {
            shutdownSignal.removeEventListener('abort', onAbort);
          }
        }
      }
    } catch {
      console.warn('[CanonicalApplier] agent_tool_reservation_failed');
    }

    if (shutdownExpired()) {
      releaseAgentTurnAuthorityRef(authority);
      if (session.currentTurn === turn) {
        session.currentTurn = null;
        session.pendingAgentTurnAuthority = null;
        session.pendingTurnId = null;
        session.pendingUserInput = null;
        session.pendingAttachments = [];
        session.assistantParts = [];
        session.hasToolCalls = false;
        session.activeToolId = null;
        session.activeToolName = null;
        session.toolArgs = {};
        session.toolNamesById = {};
        session.bouncedToolCalls = new Set();
        session.contextUsage = null;
        session.tokenUsage = null;
        session.messageId = null;
        session.planMode = false;
        session.wire = null;
        session.projectRoot = null;
      }
      return;
    }

    const threadId = authority?.threadId || session.currentThreadId;
    const workspaceId = authority?.workspaceId || session.currentWorkspaceId;
    const projectRoot = authority?.canonicalRoot || session.projectRoot;
    const workspace = authority?.workspaceId
      ? `workspace:${authority.workspaceId}`
      : resolveWorkspace(session);
    const runtimeKey = workspaceId && threadId ? {
      workspaceId,
      scope: getScope(),
      threadId,
    } : null;
    const parts = session.assistantParts;
    const hasToolCalls = session.hasToolCalls;

    // Runtime-1R: capture the thread identity that produced this turn.
    // Do NOT read mutable selection state later — passive browse may have
    // changed it while this turn was in flight.
    emit('chat:turn_end', {
      workspace,
      workspaceId,
      projectRoot,
      scope: getScope(),
      threadId,
      turnId: turn.id,
      fullText: turn.text,
      hasToolCalls,
      userInput: turn.userInput,
      parts,
      attachments: turn.attachments || [],
      reason: payload?.reason || 'complete',
      partial: Boolean(payload?.partial),
    });

    if (runtimeKey) {
      threadRuntimeManager.completeLiveTurn(runtimeKey, payload?.reason || 'complete');
    }

    releaseAgentTurnAuthorityRef(authority);

    // Reset turn tracking
    if (session.currentTurn === turn) {
      session.currentTurn = null;
      session.assistantParts = [];
      session.contextUsage = null;
      session.tokenUsage = null;
      session.messageId = null;
      session.planMode = false;
    }
  }

  return { applyChatEvent };
}

module.exports = { createCanonicalChatEventApplier };
