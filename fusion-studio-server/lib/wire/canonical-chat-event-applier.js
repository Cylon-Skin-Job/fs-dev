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
 *   - persistAssistantMessage: async function(ws, content, hasToolCalls, metadata, explicitThreadId)
 *   - checkSettingsBounce: function(toolName, args) -> {message}|null
 *   - generateTurnId: function() -> string
 */

const { threadRuntimeManager } = require('../thread/thread-runtime-manager');

function createCanonicalChatEventApplier({
  session,
  emit,
  resolveWorkspace,
  touchThreadSession,
  persistAssistantMessage,
  checkSettingsBounce,
  generateTurnId,
}) {

  function getWorkspace() {
    return resolveWorkspace(session);
  }

  function getThreadId() {
    return session.currentThreadId;
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
    if (!session.currentWorkspaceId || !threadId) return null;
    return {
      workspaceId: session.currentWorkspaceId,
      scope: getScope(),
      threadId,
    };
  }

  /**
   * Apply a canonical chat event.
   * @param {object} event
   * @param {string} event.type - canonical event type
   * @param {object} event.payload - event-specific payload
   * @param {import('ws').WebSocket} [ws] - required for turn_end persistence
   */
  function applyChatEvent(event, ws) {
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
        handleToolCall(payload);
        break;
      case 'tool_call_args':
        handleToolCallArgs(payload);
        break;
      case 'tool_result':
        applyToolOutcome(payload);
        break;
      case 'subagent_event':
        applySubagentUpdate(payload);
        break;
      case 'status_update':
        applyStatusMetadata(payload);
        break;
      case 'turn_end':
        handleTurnEnd(payload, ws);
        break;
      default:
        // Unknown canonical event type — silently ignore
        break;
    }
  }

  function applyTurnStart(payload) {
    touchThreadSession();

    // Ignore spurious startup turns (Gemini emits one on ACP session creation)
    if (!payload?.userInput && !session.pendingUserInput) {
      console.log('[CanonicalApplier] Ignoring spurious turn_begin (no user input)');
      return;
    }

    session.currentTurn = {
      id: generateTurnId(),
      text: '',
      userInput: payload?.userInput || session.pendingUserInput || ''
    };
    session.pendingUserInput = null;
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
      scope: getScope(),
      threadId: getThreadId(),
      turnId: session.currentTurn.id,
      userInput: session.currentTurn.userInput
    });
  }

  function handleContent(payload) {
    touchThreadSession();
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
    touchThreadSession();
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

  function handleToolCall(payload) {
    touchThreadSession();
    session.hasToolCalls = true;
    session.activeToolId = payload?.toolCallId || '';
    session.toolArgs[session.activeToolId] = '';

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

  function handleToolCallArgs(payload) {
    touchThreadSession();
    const toolCallId = payload?.toolCallId || session.activeToolId;
    const argsChunk = payload?.argsChunk || '';

    if (toolCallId && argsChunk) {
      session.toolArgs[toolCallId] = (session.toolArgs[toolCallId] || '') + argsChunk;
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
    }
  }

  function applyToolOutcome(payload) {
    touchThreadSession();

    const toolCallId = payload?.toolCallId || '';
    const toolName = payload?.toolName || '';
    const fullArgs = session.toolArgs[toolCallId] || '';
    let parsedArgs = {};
    try { parsedArgs = JSON.parse(fullArgs); } catch (_) {}
    delete session.toolArgs[toolCallId];

    // --- Hardwired enforcement: settings/ folder write-lock ---
    const bounce = checkSettingsBounce(toolName, parsedArgs);
    if (bounce) {
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

      emit('system:tool_bounced', {
        workspace: getWorkspace(),
        threadId: getThreadId(),
        toolName,
        filePath: parsedArgs.file_path,
        reason: bounce.message
      });

      // Emit chat:tool_result for bounced tools so the broadcaster
      // handles delivery uniformly. Same shape as a normal tool_result
      // but with isError=true and the bounce message as output.
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
        isError: true
      });
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
      toolCallPart.result = {
        output,
        statusMessage,
        display,
        returnedDiff,
        isError,
        error: isError ? (output || statusMessage || 'Tool failed') : undefined,
        files
      };
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
      isError
    });
  }

  function applySubagentUpdate(payload) {
    touchThreadSession();
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
    touchThreadSession();

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

  function handleTurnEnd(payload, ws) {
    if (!session.currentTurn) return;

    // Runtime-1R: capture the thread identity that produced this turn.
    // Do NOT read mutable selection state later — passive browse may have
    // changed it while this turn was in flight.
    const threadId = getThreadId();
    const runtimeKey = getRuntimeKey(threadId);

    // Build metadata from tracked context/token usage
    const metadata = {
      contextUsage: session.contextUsage,
      tokenUsage: session.tokenUsage,
      messageId: session.messageId,
      planMode: session.planMode,
      reason: payload?.reason || 'complete',
      partial: Boolean(payload?.partial),
      capturedAt: Date.now()
    };

    // Save assistant message to CHAT.md. Preserve the legacy router behavior:
    // persistence is a handoff and must not block chat:turn_end emission/reset.
    // Note: SQLite persistence is handled by audit-subscriber listening to chat:turn_end
    try {
      const maybePromise = persistAssistantMessage(
        ws,
        session.currentTurn.text,
        session.hasToolCalls,
        metadata,
        threadId
      );
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch((err) => {
          console.error('[CanonicalApplier] Failed to persist assistant message:', err);
        });
      }
    } catch (err) {
      console.error('[CanonicalApplier] Failed to persist assistant message:', err);
    }

    emit('chat:turn_end', {
      workspace: getWorkspace(),
      scope: getScope(),
      threadId,
      turnId: session.currentTurn.id,
      fullText: session.currentTurn.text,
      hasToolCalls: session.hasToolCalls,
      userInput: session.currentTurn.userInput,
      parts: session.assistantParts,
      reason: payload?.reason || 'complete',
      partial: Boolean(payload?.partial),
    });

    if (runtimeKey) {
      threadRuntimeManager.completeLiveTurn(runtimeKey, payload?.reason || 'complete');
    }

    // Reset turn tracking
    session.currentTurn = null;
    session.assistantParts = [];
    session.contextUsage = null;
    session.tokenUsage = null;
    session.messageId = null;
    session.planMode = false;
  }

  return { applyChatEvent };
}

module.exports = { createCanonicalChatEventApplier };
