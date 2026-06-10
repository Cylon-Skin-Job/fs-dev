/**
 * Canonical Harness Event Bridge
 *
 * Converts flat CanonicalEvent objects from harness/types.js into the
 * { type, payload } shape consumed by canonical-chat-event-applier.js.
 *
 * This module provides a direct bridge for harness sessions that yield
 * canonical events, bypassing the Kimi-wire compatibility serialization
 * when _usesDirectCanonicalEvents is enabled.
 */

/**
 * Create a bridge for applying canonical harness events.
 *
 * @param {object} deps
 * @param {Function} deps.applyChatEvent - from canonical-chat-event-applier
 * @param {Function} [deps.onNonChatEvent] - optional handler for non-chat events
 * @returns {{ applyHarnessEvent: Function, drainHarnessEvents: Function }}
 */
function createCanonicalHarnessEventBridge({
  applyChatEvent,
  onNonChatEvent,
}) {

  /**
   * Apply a single canonical harness event.
   * @param {import('../harness/types').CanonicalEvent} event
   * @param {import('ws').WebSocket} [ws]
   */
  function applyHarnessEvent(event, ws) {
    if (!event || !event.type) return;

    switch (event.type) {
      case 'turn_begin':
        applyChatEvent({
          type: 'turn_begin',
          payload: {
            userInput: event.userInput
          }
        }, ws);
        break;

      case 'content':
        applyChatEvent({
          type: 'content',
          payload: {
            text: event.text
          }
        }, ws);
        break;

      case 'thinking':
        applyChatEvent({
          type: 'thinking',
          payload: {
            text: event.text
          }
        }, ws);
        break;

      case 'tool_call':
        applyChatEvent({
          type: 'tool_call',
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName
          }
        }, ws);
        break;

      case 'tool_call_args':
        applyChatEvent({
          type: 'tool_call_args',
          payload: {
            toolCallId: event.toolCallId,
            argsChunk: event.argsChunk
          }
        }, ws);
        break;

      case 'tool_result':
        applyChatEvent({
          type: 'tool_result',
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            result: {
              output: event.output,
              statusMessage: event.statusMessage,
              display: event.display,
              returnedDiff: event.returnedDiff,
              isError: event.isError,
              files: event.files
            }
          }
        }, ws);
        break;

      case 'subagent_event':
        applyChatEvent({
          type: 'subagent_event',
          payload: {
            parentToolCallId: event.parentToolCallId,
            agentId: event.agentId,
            subagentType: event.subagentType,
            subagentEventType: event.subagentEventType,
            subagentPayload: event.subagentPayload
          }
        }, ws);
        break;

      case 'status_update':
        applyChatEvent({
          type: 'status_update',
          payload: {
            contextUsage: event.contextUsage,
            tokenUsage: event.tokenUsage,
            messageId: event.messageId,
            planMode: event.planMode
          }
        }, ws);
        break;

      case 'turn_end':
        applyChatEvent({
          type: 'turn_end',
          payload: {
            reason: event.reason,
            partial: event.partial,
          }
        }, ws);
        break;

      default:
        if (onNonChatEvent) {
          onNonChatEvent(event, ws);
        }
        break;
    }
  }

  /**
   * Drain an async iterable of canonical harness events and apply them.
   * @param {AsyncIterable<import('../harness/types').CanonicalEvent>} events
   * @param {import('ws').WebSocket} [ws]
   * @param {object} [options]
   * @param {Function} [options.onError] - error handler
   * @returns {Promise<void>}
   */
  async function drainHarnessEvents(events, ws, options = {}) {
    try {
      for await (const event of events) {
        applyHarnessEvent(event, ws);
      }
    } catch (err) {
      if (options.onError) {
        options.onError(err);
      }
      throw err;
    }
  }

  return { applyHarnessEvent, drainHarnessEvents };
}

module.exports = { createCanonicalHarnessEventBridge };
