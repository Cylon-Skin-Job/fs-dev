/**
 * Canonical Chat Terminal Events
 *
 * Assembles, emits, and clears the terminal chat:turn_end state for one
 * claimed canonical drain's active turn (SPEC-01 Slice C). Assembly sources
 * fullText/parts/userInput/attachments/hasToolCalls from the runtime-owned
 * snapshot + accumulator — never from connection/session state.
 *
 * This module is vendor-agnostic. It does not parse raw wire protocol messages
 * and does not import Kimi-specific normalizers.
 *
 * Dependencies are injected by the composing applier:
 *   - emit: event bus emitter
 *
 * The handler receives { payload, route, control } — the immutable route
 * context and the non-serializable drain control from the claimed active
 * drain record.
 */

const { threadRuntimeManager } = require('../thread/thread-runtime-manager');
const {
  normalizeTurnTerminalError,
  resolveTerminalErrorForReason,
} = require('../thread/turn-terminal-error');

function createCanonicalChatTerminalEvents({ emit }) {

  function handleTurnEnd({ payload, route, control }) {
    // Runtime-1R successor: route identity comes from the frozen route context
    // bound at prompt acceptance, never from mutable selection state.
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    if (!turnId) {
      console.warn('[CanonicalApplier] Dropping pre-binding turn_end event');
      return;
    }

    const record = threadRuntimeManager.getActiveDrain(control.runtimeKey);
    if (!record || record.drainId !== control.drainId || !record.turn) {
      console.warn('[CanonicalApplier] Dropping turn_end for a drain that is no longer current');
      return;
    }

    // SPEC-03 Slice B (parent §4.13): the safe envelope attaches ONLY to
    // reason 'error'. An invalid or hostile envelope on an error terminal is
    // substituted with the generic MODEL_RESPONSE_FAILED catalog row — a
    // reason-'error' turn_end ALWAYS carries a valid envelope. Normal and
    // interrupted terminals force null (envelopes are rejected there), even
    // when a hostile payload supplies one.
    const reason = payload?.reason || 'complete';
    const terminalError = resolveTerminalErrorForReason(reason, payload?.terminalError)
      || normalizeTurnTerminalError();

    // Idempotent runtime terminalization: completes the snapshot (carrying
    // the error envelope INSIDE this one existing terminal mutation),
    // resets usage metadata, clears mutable buffers, marks the record
    // terminalized.
    const terminalized = threadRuntimeManager.terminalizeTurn(
      control.runtimeKey,
      { drainId: control.drainId, turnId },
      reason,
      { terminalError },
    );
    if (!terminalized) {
      console.warn('[CanonicalApplier] Dropping duplicate or non-current turn_end event');
      return;
    }

    // getLiveTurn returns a deep JSON clone, so emitted parts/attachments are
    // copies — subscribers can never reach live runtime references.
    // SPEC-02 Slice D: streamSeq (final frontier) and activityRevision
    // (post-terminal-clear revision) are read from this same clone, so the
    // terminal publication and the retained snapshot expose one state.
    // SPEC-03 Slice B: terminalError is read from that SAME post-terminalize
    // clone — the published envelope IS the retained one (published seq ===
    // retained snapshot seq). Emitted ONLY on reason 'error'; non-error
    // terminals omit the key entirely (pinned wire shape; the SPEC-02 wire
    // union table has no terminalError key on turn_end).
    const snapshot = threadRuntimeManager.getLiveTurn(control.runtimeKey);

    emit('chat:turn_end', {
      workspace: route.workspace,
      workspaceId: route.workspaceId,
      projectRoot: route.projectRoot,
      scope: route.scope,
      threadId: route.threadId,
      turnId,
      streamSeq: snapshot.streamSeq,
      fullText: snapshot.fullText,
      hasToolCalls: record.turn.hasToolCalls,
      userInput: snapshot.userInput,
      parts: snapshot.parts,
      attachments: snapshot.attachments || [],
      reason: payload?.reason || 'complete',
      partial: Boolean(payload?.partial),
      activityRevision: snapshot.activityRevision,
      ...(snapshot.terminalError ? { terminalError: snapshot.terminalError } : {}),
    });

    // Clear-if-current: only removes our own record. The completed snapshot
    // remains available for the thread:opened overlay.
    threadRuntimeManager.clearActiveDrainIfCurrent(control.runtimeKey, control.drainId);
  }

  return { handleTurnEnd };
}

module.exports = { createCanonicalChatTerminalEvents };
