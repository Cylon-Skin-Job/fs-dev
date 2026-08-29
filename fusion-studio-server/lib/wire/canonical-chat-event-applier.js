/**
 * Canonical Chat Event Applier
 *
 * Provider-neutral dispatcher/factory for drain-driven canonical chat events
 * (SPEC-01 Slice C). Every event is applied against the claimed drain context
 * { route, control }: ThreadRuntimeManager is the sole mutable canonical turn
 * owner, route fields drive emissions, and the control capability touches or
 * stops the exact bound harness session. Canonical accumulator state no longer
 * touches connection/session state at all.
 *
 * Separable mutation jobs live in focused modules composed here at creation:
 *   - canonical-chat-text-events.js      (content/thinking accumulation)
 *   - canonical-chat-tool-events.js      (tool_call/args/result + enforcement)
 *   - canonical-chat-terminal-events.js  (turn_end assembly/emission/clear)
 *
 * SPEC-02 Slice B: the step_begin identity/dedupe/time-normalization handler
 * lives here beside the other single-handler events (turn begin, subagent,
 * status) because it mutates only through the shared gated runtime API.
 *
 * This module is vendor-agnostic. It does not parse raw wire protocol messages
 * and does not import Kimi-specific normalizers.
 *
 * Dependencies are injected:
 *   - emit: event bus emitter
 *   - checkSettingsBounce: function(toolName, args, workspaceRoot) -> {message}|null
 *   - generateTurnId: function() -> string
 */

const { threadRuntimeManager } = require('../thread/thread-runtime-manager');
const liveTurnSnapshot = require('../thread/live-turn-snapshot');
const { createCanonicalChatTextEvents } = require('./canonical-chat-text-events');
const { createCanonicalChatToolEvents } = require('./canonical-chat-tool-events');
const { createCanonicalChatTerminalEvents } = require('./canonical-chat-terminal-events');

function createCanonicalChatEventApplier({
  emit,
  checkSettingsBounce,
  generateTurnId,
}) {

  const textEvents = createCanonicalChatTextEvents({ emit });

  const toolEvents = createCanonicalChatToolEvents({
    emit,
    checkSettingsBounce,
  });

  const terminalEvents = createCanonicalChatTerminalEvents({ emit });

  /**
   * Apply a canonical chat event against a claimed drain context.
   *
   * @param {object} event
   * @param {string} event.type - canonical event type
   * @param {object} event.payload - event-specific payload
   * @param {import('ws').WebSocket} [ws] - transport handle (unused by the
   *        drain-driven handlers; retained for call-shape compatibility)
   * @param {{ route: object, control: object }} drainContext - the claimed
   *        record's frozen route context and bound control. Events arriving
   *        without one are diagnostic drops (defensive; both real paths —
   *        interactive iteration and automation draining — always supply one).
   * @returns {{ accepted: boolean, turnId?: string }|undefined} turn_begin
   *          result so the bridge can bind the accepted server turnId once.
   */
  function applyChatEvent(event, ws, drainContext) {
    if (!drainContext?.control || !drainContext?.route) {
      console.warn('[CanonicalApplier] Dropping canonical event without a drain context');
      return;
    }
    if (!event || !event.type) return;

    const { type, payload } = event;
    const route = drainContext.route;
    const control = drainContext.control;

    switch (type) {
      case 'turn_begin':
        return applyTurnStart(payload, route, control);
      case 'content':
        textEvents.handleContent({ payload, route, control });
        return;
      case 'thinking':
        textEvents.handleThinking({ payload, route, control });
        return;
      case 'tool_call':
        toolEvents.handleToolCall({ payload, route, control });
        return;
      case 'tool_call_args':
        toolEvents.handleToolCallArgs({ payload, route, control });
        return;
      case 'tool_result':
        toolEvents.applyToolOutcome({ payload, route, control });
        return;
      case 'subagent_event':
        applySubagentUpdate(payload, route, control);
        return;
      case 'status_update':
        applyStatusMetadata(payload, route, control);
        return;
      case 'step_begin':
        applyStepBegin(payload, route, control);
        return;
      case 'turn_end':
        terminalEvents.handleTurnEnd({ payload, route, control });
        return;
      default:
        // Unknown canonical event type — silently ignore
        break;
    }
  }

  function applyTurnStart(payload, route, control) {
    control.touchThreadSession();

    // userInput precedence: accepted route data wins; payload is fallback.
    const userInput = route.acceptedUserInput || payload?.userInput || '';

    // Ignore spurious startup turns (e.g. harnesses emitting one on session
    // creation): no accepted input AND no payload input.
    if (!userInput) {
      console.log('[CanonicalApplier] Ignoring spurious turn_begin (no user input)');
      return { accepted: false };
    }

    const turnId = generateTurnId();
    const result = threadRuntimeManager.beginCanonicalTurn(control.runtimeKey, control.drainId, {
      turnId,
      userInput,
      attachments: Array.isArray(route.attachments) ? route.attachments : [],
    });
    if (!result.accepted) {
      console.log('[CanonicalApplier] Rejecting gated-out turn_begin (drain not current or live duplicate)');
      return { accepted: false };
    }

    emit('chat:turn_begin', {
      workspace: route.workspace,
      workspaceId: route.workspaceId,
      projectRoot: route.projectRoot,
      scope: route.scope,
      threadId: route.threadId,
      turnId,
      // SPEC-02 Slice D §2 rule 1: the initial positive integer frontier,
      // read back from the just-created snapshot through the manager's
      // single authority (never inferred from arrival order).
      streamSeq: threadRuntimeManager.getLiveTurn(control.runtimeKey)?.streamSeq ?? null,
      userInput,
      attachments: [...(route.attachments || [])],
    });

    return { accepted: true, turnId };
  }

  function applySubagentUpdate(payload, route, control) {
    control.touchThreadSession();

    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) {
      console.warn('[CanonicalApplier] Dropping pre-binding subagent_event');
      return;
    }

    // SPEC-02 Slice D §3.D: each subagent publication is a projection-changing
    // event, so it is sequenced through the same gated mutation primitive —
    // the snapshot touch gives every publication its unique resulting seq
    // represented by the snapshot projection. Stale drains drop here.
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      ({ snapshot }) => {
        liveTurnSnapshot.touchStatus(snapshot);
      }
    );
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale subagent_event (drain/turn no longer current)');
      return;
    }

    emit('chat:subagent_event', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId,
      streamSeq: seq,
      parentToolCallId: payload?.parentToolCallId || '',
      agentId: payload?.agentId || '',
      subagentType: payload?.subagentType || '',
      eventType: payload?.subagentEventType || '',
      eventPayload: payload?.subagentPayload || {}
    });
  }

  function applyStatusMetadata(payload, route, control) {
    control.touchThreadSession();

    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) {
      console.warn('[CanonicalApplier] Dropping pre-binding status_update');
      return;
    }

    // Usage metadata lives on the runtime-owned accumulator (authoritative
    // mutable copy). SPEC-02 Slice D repair R-FINDING-2 (roadmap §5.2): the
    // same gated mutation also mirrors a JSON-safe usage projection onto the
    // snapshot — one call, exactly one frontier advance — so the usage
    // published at seq N is reconstructible from the snapshot at N.
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      ({ snapshot, turn }) => {
        turn.usage.contextUsage = payload?.contextUsage ?? null;
        turn.usage.tokenUsage = payload?.tokenUsage ?? null;
        turn.usage.messageId = payload?.messageId ?? null;
        turn.usage.planMode = payload?.planMode ?? false;
        liveTurnSnapshot.setUsage(snapshot, turn.usage);
      }
    );
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale status_update (drain/turn no longer current)');
      return;
    }

    emit('chat:status_update', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      // SPEC-02 Slice D: bound turnId + the already-computed resulting seq.
      turnId,
      streamSeq: seq,
      contextUsage: payload?.contextUsage,
      tokenUsage: payload?.tokenUsage,
      messageId: payload?.messageId,
      planMode: payload?.planMode
    });
  }

  // SPEC-02 Slice B (RCC-0108 parent §4.7): step_begin identity, dedupe, and
  // display-time normalization. Handler order is normative:
  //   bind gate → identity derivation → full-turn ledger dedupe →
  //   one-captured-now normalization → single gated live mutation →
  //   compatibility-bus emission. Rejected input never mutates, bumps,
  //   or publishes.
  const MIN_STEP_TIMESTAMP_MS = 946684800000; // 2000-01-01T00:00:00Z
  const STEP_TIMESTAMP_FUTURE_SKEW_MS = 60000;

  function applyStepBegin(payload, route, control) {
    control.touchThreadSession();

    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) {
      console.warn('[CanonicalApplier] Dropping pre-binding step_begin');
      return;
    }

    // Derive the stable source identity BEFORE any time handling, in the
    // exact precedence step:<id> > message:<id> > time:<String(ts)>.
    const stepId = typeof payload?.stepId === 'string' && payload.stepId ? payload.stepId : null;
    const messageId = typeof payload?.messageId === 'string' && payload.messageId ? payload.messageId : null;
    const candidate = payload?.timestamp;
    const hasTimestampCandidate = typeof candidate === 'number' && Number.isFinite(candidate);

    let identity = null;
    if (stepId) {
      identity = `step:${stepId}`;
    } else if (messageId) {
      identity = `message:${messageId}`;
    } else if (hasTimestampCandidate) {
      identity = `time:${String(candidate)}`;
    }
    if (!identity) {
      // No replay-safe identity source — ignore with the normal diagnostic
      // style; the orb-until-output fallback remains.
      console.warn('[CanonicalApplier] Ignoring step_begin without a stable identity source');
      return;
    }

    // Full-turn seen-ledger dedupe BEFORE deriving startedAt — duplicate
    // detection never depends on time validity or the clock. A seen identity
    // changes nothing: no activity, cursor, ledger, revision, or publication.
    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    const seenStepIdentities = record && record.drainId === control.drainId && record.turn
      ? record.turn.seenStepIdentities
      : null;
    if (seenStepIdentities && seenStepIdentities.has(identity)) {
      console.warn('[CanonicalApplier] Dropping duplicate step_begin (identity already seen this turn)');
      return;
    }

    // Normalize display time ONCE with ONE captured now.
    const now = Date.now();
    const startedAt = (
      hasTimestampCandidate
      && candidate >= MIN_STEP_TIMESTAMP_MS
      && candidate <= now + STEP_TIMESTAMP_FUTURE_SKEW_MS
    ) ? Math.min(candidate, now) : now;

    let activityRevision = null;
    const streamSeq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      ({ snapshot, turn }) => {
        if (turn.seenStepIdentities.has(identity)) return; // defensive re-check
        turn.seenStepIdentities.add(identity);
        snapshot.seenStepIdentities = Array.from(turn.seenStepIdentities);
        snapshot.activityRevision += 1;
        activityRevision = snapshot.activityRevision;
        snapshot.activity = {
          kind: 'working',
          turnId,
          identity,
          startedAt,
          activityRevision,
          ...(stepId ? { stepId } : {}),
          ...(messageId ? { messageId } : {}),
        };
        snapshot.stepCursor = { identity, startedAt };
        // Projection-changing mutation: bump the single streamSeq frontier
        // exactly once (SPEC-02 §2 rule 2) so the emitted seq is the
        // resulting one.
        liveTurnSnapshot.touchStatus(snapshot);
      }
    );
    if (streamSeq === null || activityRevision === null) {
      console.warn('[CanonicalApplier] Dropping stale or defensively-skipped step_begin (drain/turn no longer current)');
      return;
    }

    // Compatibility bus only — same path as every sibling chat:* emission.
    emit('chat:step_begin', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId,
      streamSeq,
      identity,
      ...(stepId ? { stepId } : {}),
      ...(messageId ? { messageId } : {}),
      startedAt,
      activityRevision,
    });
  }

  return { applyChatEvent };
}

module.exports = { createCanonicalChatEventApplier };
