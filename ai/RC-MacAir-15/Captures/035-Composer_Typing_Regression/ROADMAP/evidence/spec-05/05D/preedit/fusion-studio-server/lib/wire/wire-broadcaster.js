/**
 * Wire Broadcaster — bus → WebSocket fan-out for chat events.
 *
 * Extracted per SPEC-01d / SPEC-23a. Subscribes to chat:* events on the
 * event bus and routes each to the specific client whose connection
 * owns the thread that produced the event.
 *
 * Routing uses exact workspace/root/epoch/thread identity, provided at init
 * time. Thread IDs are only unique inside their owning workspace.
 * Today that resolves via wireRegistry in lib/wire/process-manager.js
 * (augmented in this spec to carry a ws reference per entry).
 *
 * Architectural template: lib/audit/audit-subscriber.js. Same shape:
 * subscribe to bus events at startup, do work on each, no state.
 *
 * This module owns ONE job: translating bus events to wire messages
 * and delivering them to the right client. It does NOT own:
 *   - Event parsing (that's the wire message router)
 *   - Per-client session state (that's server.js)
 *   - The wire registry (that's lib/wire/process-manager.js)
 */

const { on } = require('../event-bus');

/**
 * Initialize the wire broadcaster. Call once at server startup,
 * BEFORE server.listen() opens the port. The returned object is
 * informational — there's no stop() because the process lifetime
 * owns the subscribers.
 *
 * @param {object} deps
 * @param {(threadId: string, scope: object) => import('ws').WebSocket|null} deps.getClientForThread
 *        Called on every chat event; returns the ws that owns the thread,
 *        or null if the thread has no live wire.
 * @returns {{ started: boolean }}
 */
function createWireBroadcaster({ getClientForThread }) {

  function workspaceIdForEvent(event) {
    if (typeof event?.workspaceId === 'string' && event.workspaceId) {
      return event.workspaceId;
    }
    if (typeof event?.workspace === 'string' && event.workspace.startsWith('workspace:')) {
      return event.workspace.slice('workspace:'.length).split(',')[0].trim() || null;
    }
    return null;
  }

  function sendToThread(event, wireMessage) {
    const threadId = event?.threadId;
    const workspaceId = workspaceIdForEvent(event);
    const ws = getClientForThread(threadId, {
      workspaceId,
      projectRoot: event?.projectRoot,
      workspaceEpoch: event?.workspaceEpoch,
    });
    const messageType = wireMessage?.type || 'unknown';
    const threadLabel = String(threadId || 'unknown');

    if (!ws) {
      console.warn(`[WireBroadcaster] Dropped ${messageType} for thread ${threadLabel}: no registered client`);
      return false;
    }
    if (ws.readyState !== 1) {
      console.warn(
        `[WireBroadcaster] Dropped ${messageType} for thread ${threadLabel}: client readyState=${ws.readyState}`
      );
      return false;
    }

    try {
      ws.send(JSON.stringify(wireMessage));
      return true;
    } catch (err) {
      console.warn(
        `[WireBroadcaster] Dropped ${messageType} for thread ${threadLabel}: send failed (${err?.message || 'unknown error'})`
      );
      return false;
    }
  }

  // Every outbound live stream message carries scope and threadId so the
  // client routes by explicit server identity, not selected UI state.
  //
  // SPEC-02 Slice D (RCC-0108 §2): every accepted client-facing in-flight
  // message from turn_begin through turn_end additionally carries turnId +
  // streamSeq, forwarded 1:1 from the bus payload; content/thinking/tool_call/
  // turn_end also carry activityRevision (parent §4.9 — their handling may
  // change Working activity). Post-terminal acknowledgements
  // (chat:exchange_metadata / chat-turn:saved) stay in their separate
  // lifecycle family without streamSeq.
  on('chat:turn_begin', (event) => {
    sendToThread(event, {
      type: 'turn_begin',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      userInput: event.userInput,
    });
  });

  on('chat:step_begin', (event) => {
    sendToThread(event, {
      type: 'step_begin',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      identity: event.identity,
      ...(event.stepId ? { stepId: event.stepId } : {}),
      ...(event.messageId ? { messageId: event.messageId } : {}),
      startedAt: event.startedAt,
      activityRevision: event.activityRevision,
    });
  });

  on('chat:content', (event) => {
    sendToThread(event, {
      type: 'content',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      activityRevision: event.activityRevision,
      text: event.text,
    });
  });

  on('chat:thinking', (event) => {
    sendToThread(event, {
      type: 'thinking',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      activityRevision: event.activityRevision,
      text: event.text,
    });
  });

  on('chat:tool_call', (event) => {
    sendToThread(event, {
      type: 'tool_call',
      scope: event.scope,
      threadId: event.threadId,
      toolName: event.toolName,
      toolCallId: event.toolCallId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      activityRevision: event.activityRevision,
    });
  });

  on('chat:tool_call_args', (event) => {
    sendToThread(event, {
      type: 'tool_call_args',
      scope: event.scope,
      threadId: event.threadId,
      toolCallId: event.toolCallId,
      argsChunk: event.argsChunk,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
    });
  });

  on('chat:tool_result', (event) => {
    sendToThread(event, {
      type: 'tool_result',
      scope: event.scope,
      threadId: event.threadId,
      toolCallId: event.toolCallId,
      toolArgs: event.toolArgs,
      toolOutput: event.toolOutput,
      toolStatus: event.toolStatus,
      toolDisplay: event.toolDisplay,
      returnedDiff: event.returnedDiff,
      isError: event.isError,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
    });
  });

  on('chat:subagent_event', (event) => {
    sendToThread(event, {
      type: 'subagent_event',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      parentToolCallId: event.parentToolCallId,
      agentId: event.agentId,
      subagentType: event.subagentType,
      subagentEventType: event.eventType,
      subagentPayload: event.eventPayload,
    });
  });

  // SPEC-02 Slice D: turn_end forwards streamSeq + activityRevision 1:1.
  // SPEC-03 Slice B: terminalError is forwarded 1:1 ONLY when the bus event
  // carries one — i.e. reason-'error' terminals, which always carry a
  // validated safe envelope from the canonical terminal path. Non-error
  // terminals OMIT the key entirely (pinned wire shape; the SPEC-02 wire
  // union table has no terminalError key on turn_end).
  on('chat:turn_end', (event) => {
    sendToThread(event, {
      type: 'turn_end',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      activityRevision: event.activityRevision,
      fullText: event.fullText,
      hasToolCalls: event.hasToolCalls,
      userInput: event.userInput,
      parts: event.parts,
      reason: event.reason,
      partial: event.partial,
      ...(event.terminalError ? { terminalError: event.terminalError } : {}),
    });
  });

  on('chat:status_update', (event) => {
    sendToThread(event, {
      type: 'status_update',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      streamSeq: event.streamSeq,
      contextUsage: event.contextUsage,
      tokenUsage: event.tokenUsage,
    });
  });

  on('chat:exchange_metadata', (event) => {
    sendToThread(event, {
      type: 'exchange_metadata',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      ts: event.ts,
      userInput: event.userInput,
      metadata: event.metadata,
    });
  });

  on('chat-turn:saved', (event) => {
    sendToThread(event, {
      type: 'chat-turn:saved',
      scope: event.scope,
      threadId: event.threadId,
      turnId: event.turnId,
      exchangeId: event.exchangeId,
      seq: event.seq,
      ts: event.ts,
      partial: event.partial,
      reason: event.reason,
      metadata: event.metadata,
    });
  });

  console.log('[WireBroadcaster] Started');
  return { started: true };
}

module.exports = { createWireBroadcaster };
