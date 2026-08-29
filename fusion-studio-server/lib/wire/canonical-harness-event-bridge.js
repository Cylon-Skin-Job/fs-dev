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
 * @returns {{ applyHarnessEvent: Function, drainHarnessEvents: Function }}
 */
function createCanonicalHarnessEventBridge({
  applyChatEvent,
  bindDrainTurn,
  onNonChatEvent,
}) {

  /**
   * Apply a single canonical harness event.
   * @param {import('../harness/types').CanonicalEvent} event
   * @param {import('ws').WebSocket} [ws]
   * @param {{ route: object, control: object }} [drainContext] - claimed route + control
   */
  function applyHarnessEvent(event, ws, drainContext) {
    if (!event || !event.type) return;

    switch (event.type) {
      case 'turn_begin': {
        const result = applyChatEvent({
          type: 'turn_begin',
          payload: {
            userInput: event.userInput
          }
        }, ws, drainContext);
        // Bind-once (parent §4.6): only an accepted begin with a non-empty
        // server turnId binds; rejected/spurious/duplicate begins never reach
        // bindDrainTurn.
        if (drainContext && result?.accepted && result.turnId && bindDrainTurn) {
          bindDrainTurn(drainContext, result.turnId);
        }
        break;
      }

      case 'content':
        applyChatEvent({
          type: 'content',
          payload: {
            text: event.text
          }
        }, ws, drainContext);
        break;

      case 'thinking':
        applyChatEvent({
          type: 'thinking',
          payload: {
            text: event.text
          }
        }, ws, drainContext);
        break;

      case 'tool_call':
        applyChatEvent({
          type: 'tool_call',
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName
          }
        }, ws, drainContext);
        break;

      case 'tool_call_args':
        applyChatEvent({
          type: 'tool_call_args',
          payload: {
            toolCallId: event.toolCallId,
            argsChunk: event.argsChunk
          }
        }, ws, drainContext);
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
        }, ws, drainContext);
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
        }, ws, drainContext);
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
        }, ws, drainContext);
        break;

      // SPEC-02 Slice B: native fields forwarded verbatim — timestamp stays
      // unchanged (absent keys stay undefined; the applier owns all judging).
      case 'step_begin':
        applyChatEvent({
          type: 'step_begin',
          payload: {
            timestamp: event.timestamp,
            stepId: event.stepId,
            messageId: event.messageId
          }
        }, ws, drainContext);
        break;

      // SPEC-03 Slice B: terminalError forwarded verbatim when the harness
      // event carries one (the failure-path synthesis paths attach the
      // already-normalized safe envelope). The applier owns validation and
      // reason gating; undefined stays absent exactly like every other
      // optional native field.
      case 'turn_end':
        applyChatEvent({
          type: 'turn_end',
          payload: {
            reason: event.reason,
            partial: event.partial,
            ...(event.terminalError !== undefined ? { terminalError: event.terminalError } : {}),
          }
        }, ws, drainContext);
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
   * @param {{ route: object, control: object }} [options.drainContext] - passed
   *        through per event to every applier call
   * @param {Function} [options.onError] - error handler
   * @returns {Promise<void>}
   */
  async function drainHarnessEvents(events, ws, options = {}) {
    try {
      for await (const event of events) {
        applyHarnessEvent(event, ws, options.drainContext);
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
