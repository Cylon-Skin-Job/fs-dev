/**
 * Canonical Chat Tool Events
 *
 * Accumulates canonical tool_call / tool_call_args / tool_result state into
 * the runtime-owned turn accumulator and live-turn snapshot for one claimed
 * canonical drain, and enforces the pre-execution settings bounce through the
 * drain's bound control (SPEC-01 Slice C).
 *
 * SPEC-02 Slice C (RCC-0108 parent §4.9): a tool_call is always renderable —
 * its gated mutation clears non-null Working with exactly one
 * activityRevision bump before appending the part.
 *
 * SPEC-02 Slice D (RCC-0108 §2/§3.D): every accepted tool publication carries
 * the exact resulting frontier — `streamSeq` is applyLiveMutation's return
 * value, and `activityRevision` on chat:tool_call is captured inside the
 * mutator after any Working clear (parent §4.9 routed-activity revision).
 *
 * This module is vendor-agnostic. It does not parse raw wire protocol messages
 * and does not import Kimi-specific normalizers.
 *
 * Dependencies are injected by the composing applier:
 *   - emit: event bus emitter
 *   - checkSettingsBounce: function(toolName, args, workspaceRoot) -> {message}|null
 *
 * Each handler receives { payload, route, control } — the immutable route
 * context and the non-serializable drain control from the claimed active
 * drain record. All mutable state goes through the ThreadRuntimeManager
 * authority API; no connection/session state is read or written.
 */

const liveTurnSnapshot = require('../thread/live-turn-snapshot');
const { threadRuntimeManager } = require('../thread/thread-runtime-manager');

function createCanonicalChatToolEvents({
  emit,
  checkSettingsBounce,
}) {

  function resolveIdentity(control) {
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    return turnId ? { drainId: control.drainId, turnId } : null;
  }

  /**
   * Fire-and-forget stop of ONLY the bound harness through its drain control.
   * Replaces the historical session.wire.kill: a bounce can never stop a wire
   * selected by mutable connection state.
   */
  function stopBoundHarnessAfterPreExecutionBounce(control) {
    Promise.resolve()
      .then(() => control.stopHarness())
      .catch((err) => {
        console.warn(`[CanonicalApplier] Bound harness stop after enforcement bounce failed: ${err?.message || err}`);
      });
  }

  /**
   * Shared enforcement bounce. Returns true when the call was (or had already
   * been) bounced and callers must not continue normal processing. State
   * changes happen inside the gated live mutation; emissions happen only
   * after the mutation is accepted.
   */
  function enforceSettingsBounce({ identity, route, control, toolCallId, toolName, parsedArgs, preExecution }) {
    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    if (toolCallId && record?.turn?.bouncedToolCalls.has(toolCallId)) return true;

    const bounce = checkSettingsBounce(toolName, parsedArgs, route.projectRoot || null);
    if (!bounce) return false;

    const seq = threadRuntimeManager.applyLiveMutation(control.runtimeKey, identity, ({ snapshot, turn }) => {
      if (toolCallId) turn.bouncedToolCalls.add(toolCallId);
      turn.toolArgsBuffers.delete(toolCallId);
      liveTurnSnapshot.applyToolResult(snapshot, {
        toolCallId,
        toolArgs: parsedArgs,
        output: bounce.message,
        statusMessage: bounce.message,
        display: [],
        returnedDiff: false,
        isError: true,
        files: [],
        enforcementPhase: preExecution ? 'tool_args' : 'tool_result',
      });
    });
    if (seq === null) {
      // Drain superseded between read and mutation — suppress like a stale event.
      return true;
    }

    emit('system:tool_bounced', {
      workspace: route.workspace,
      threadId: route.threadId,
      toolName,
      filePath: parsedArgs.file_path || parsedArgs.filePath || parsedArgs.path,
      reason: bounce.message,
      phase: preExecution ? 'tool_args' : 'tool_result',
    });

    emit('chat:tool_result', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId: identity.turnId,
      streamSeq: seq,
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

  function handleToolCall({ payload, route, control }) {
    control.touchThreadSession();

    const identity = resolveIdentity(control);
    if (!identity) {
      console.warn('[CanonicalApplier] Dropping pre-binding tool_call event');
      return;
    }

    const toolCallId = payload?.toolCallId || '';
    const emittedToolName = payload?.toolName || 'unknown';
    const trackedToolName = payload?.toolName || '';
    let activityRevision = null;
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      identity,
      ({ snapshot, turn }) => {
        // SPEC-02 Slice C: a tool call is always renderable. The first one
        // while Working is active clears it with exactly one activityRevision
        // bump, inside this same gated mutation (later calls find activity
        // already null and never bump).
        if (snapshot.activity !== null) {
          snapshot.activity = null;
          snapshot.activityRevision += 1;
        }
        activityRevision = snapshot.activityRevision;
        turn.hasToolCalls = true;
        if (toolCallId) {
          turn.toolArgsBuffers.set(toolCallId, '');
          turn.toolNamesById[toolCallId] = trackedToolName;
        }
        liveTurnSnapshot.appendToolCall(snapshot, {
          toolCallId,
          toolName: emittedToolName,
        });
      }
    );
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale tool_call event (drain/turn no longer current)');
      return;
    }

    emit('chat:tool_call', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId: identity.turnId,
      streamSeq: seq,
      activityRevision,
      toolName: emittedToolName,
      toolCallId
    });
  }

  function handleToolCallArgs({ payload, route, control }) {
    control.touchThreadSession();

    const identity = resolveIdentity(control);
    if (!identity) {
      console.warn('[CanonicalApplier] Dropping pre-binding tool_call_args event');
      return;
    }

    // Fall back to the most recently opened argument buffer when the harness
    // omits toolCallId on an args chunk (Map preserves insertion order).
    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    const bufferedIds = Array.from(record?.turn?.toolArgsBuffers.keys() || []);
    const lastBufferedId = bufferedIds[bufferedIds.length - 1];
    const toolCallId = payload?.toolCallId || lastBufferedId;
    const argsChunk = payload?.argsChunk || '';

    if (!toolCallId || !argsChunk) return;

    let completeParsedArgs = null;
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      identity,
      ({ snapshot, turn }) => {
        const buffered = (turn.toolArgsBuffers.get(toolCallId) || '') + argsChunk;
        turn.toolArgsBuffers.set(toolCallId, buffered);
        // R-FINDING-1 (SPEC §2 rule 2 / ledger decision #1): EVERY accepted
        // tool_call_args publication advances the frontier EXACTLY ONCE.
        // When the buffer parses, applyToolArgs performs that one bump —
        // never double-bump. When it does not (partial JSON, or a parsed
        // value with no matching snapshot part), no helper has bumped yet,
        // so the touch advances once instead; a repeated streamSeq would
        // make a frontier-draining client drop this chunk as already seen.
        const beforeSeq = snapshot.streamSeq;
        try {
          completeParsedArgs = JSON.parse(buffered);
          liveTurnSnapshot.applyToolArgs(snapshot, toolCallId, completeParsedArgs);
        } catch (_) {
          // Tool args often arrive as partial JSON. Keep buffering until parseable.
        }
        if (snapshot.streamSeq === beforeSeq) {
          liveTurnSnapshot.touchStatus(snapshot);
        }
      }
    );
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale tool_call_args event (drain/turn no longer current)');
      return;
    }

    emit('chat:tool_call_args', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId: identity.turnId,
      streamSeq: seq,
      toolCallId,
      argsChunk
    });

    if (completeParsedArgs) {
      const toolName = payload?.toolName || record?.turn?.toolNamesById?.[toolCallId] || '';
      const bounced = enforceSettingsBounce({
        identity,
        route,
        control,
        toolCallId,
        toolName,
        parsedArgs: completeParsedArgs,
        preExecution: true,
      });
      if (bounced) {
        stopBoundHarnessAfterPreExecutionBounce(control);
      }
    }
  }

  function applyToolOutcome({ payload, route, control }) {
    control.touchThreadSession();

    const identity = resolveIdentity(control);
    if (!identity) {
      console.warn('[CanonicalApplier] Dropping pre-binding tool_result event');
      return;
    }

    const toolCallId = payload?.toolCallId || '';
    const toolName = payload?.toolName || '';

    // Read-only pre-checks against the runtime-owned accumulator.
    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(record?.turn?.toolArgsBuffers.get(toolCallId) || '');
    } catch (_) {}
    const suppressedBefore = Boolean(record?.turn?.bouncedToolCalls.has(toolCallId));

    // Hardwired enforcement: settings/ folder write-lock. Decision is read
    // here; all state changes happen inside the gated mutation below.
    const hardBounce = suppressedBefore
      ? null
      : checkSettingsBounce(toolName, parsedArgs, route.projectRoot || null);

    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      identity,
      ({ snapshot, turn }) => {
        turn.toolArgsBuffers.delete(toolCallId);
        if (suppressedBefore) return;
        if (hardBounce) {
          turn.bouncedToolCalls.add(toolCallId);
          liveTurnSnapshot.applyToolResult(snapshot, {
            toolCallId,
            toolArgs: parsedArgs,
            output: hardBounce.message,
            statusMessage: hardBounce.message,
            display: [],
            returnedDiff: false,
            isError: true,
            files: [],
            enforcementPhase: 'tool_result',
            ...(payload?.origin === 'terminal_snapshot'
              ? { terminalSnapshotResult: payload?.result || {} }
              : {}),
          });
          return;
        }
        const result = payload?.result || {};
        liveTurnSnapshot.applyToolResult(snapshot, {
          toolCallId,
          toolArgs: parsedArgs,
          output: result.output || '',
          statusMessage: result.statusMessage,
          display: Array.isArray(result.display) ? result.display : [],
          returnedDiff: Boolean(result.returnedDiff),
          isError: Boolean(result.isError),
          files: Array.isArray(result.files) ? result.files : [],
          ...(payload?.origin === 'terminal_snapshot'
            ? { terminalSnapshotResult: result }
            : {}),
        });
      }
    );
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale tool_result event (drain/turn no longer current)');
      return;
    }

    if (suppressedBefore) return;

    if (hardBounce) {
      emit('system:tool_bounced', {
        workspace: route.workspace,
        threadId: route.threadId,
        toolName,
        filePath: parsedArgs.file_path || parsedArgs.filePath || parsedArgs.path,
        reason: hardBounce.message,
        phase: 'tool_result',
      });
      emit('chat:tool_result', {
        workspace: route.workspace,
        scope: route.scope,
        threadId: route.threadId,
        turnId: identity.turnId,
        streamSeq: seq,
        toolCallId,
        toolName,
        toolArgs: parsedArgs,
        toolOutput: hardBounce.message,
        toolStatus: hardBounce.message,
        toolDisplay: [],
        returnedDiff: false,
        isError: true,
        enforcementPhase: 'tool_result',
      });
      return;
    }

    const result = payload?.result || {};
    const output = result.output || '';
    const statusMessage = result.statusMessage;
    const display = Array.isArray(result.display) ? result.display : [];
    const returnedDiff = Boolean(result.returnedDiff);
    const isError = Boolean(result.isError);

    emit('chat:tool_result', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId: identity.turnId,
      streamSeq: seq,
      toolCallId,
      toolName,
      toolArgs: parsedArgs,
      toolOutput: output,
      toolStatus: statusMessage,
      toolDisplay: display,
      returnedDiff,
      isError
    });
  }

  return { handleToolCall, handleToolCallArgs, applyToolOutcome };
}

module.exports = { createCanonicalChatToolEvents };
