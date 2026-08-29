/**
 * Canonical Chat Text Events
 *
 * Accumulates canonical content/thinking text into the runtime-owned live
 * turn snapshot for one claimed canonical drain (SPEC-01 Slice C).
 *
 * SPEC-02 Slice C (RCC-0108 parent §4.8): the renderable-output suppression
 * decision lives inside the single gated mutator — a blank chunk is dropped
 * only when it would create a NEW same-type part, before ANY accumulator,
 * snapshot, or sequence mutation; once a real same-type part exists, later
 * chunks are preserved exactly (never trimmed or rewritten). The first
 * renderable chunk clears non-null Working with exactly one activityRevision
 * bump in that same mutation.
 *
 * SPEC-02 Slice D (RCC-0108 §2/§3.D): accepted publications carry the exact
 * resulting frontier — `streamSeq` is applyLiveMutation's return value and
 * `activityRevision` is captured inside the mutator after any Working clear,
 * so emission and snapshot projection expose one atomic state.
 *
 * This module is vendor-agnostic. It does not parse raw wire protocol messages
 * and does not import Kimi-specific normalizers.
 *
 * Dependencies are injected by the composing applier:
 *   - emit: event bus emitter
 *
 * Each handler receives { payload, route, control } — the immutable route
 * context and the non-serializable drain control from the claimed active
 * drain record. All mutable state goes through the ThreadRuntimeManager
 * authority API; no connection/session state is read or written.
 */

const liveTurnSnapshot = require('../thread/live-turn-snapshot');
const { threadRuntimeManager } = require('../thread/thread-runtime-manager');

function createCanonicalChatTextEvents({ emit }) {

  /**
   * Resolve the compare-current mutation identity for a post-begin event, or
   * null when the drain has no bound server turn yet (pre-binding events are
   * ignored with fixed value-minimized diagnostics).
   */
  function resolveIdentity(control) {
    const turnId = threadRuntimeManager.resolveBoundTurnId(control.runtimeKey, control.drainId);
    return turnId ? { drainId: control.drainId, turnId } : null;
  }

  /**
   * SPEC-02 Slice C blank predicate: empty string and whitespace-only text
   * are both "blank" for new-part suppression purposes.
   */
  function isBlank(text) {
    return String(text).trim().length === 0;
  }

  /**
   * One gated text mutation shared by content ('text') and thinking
   * ('think'). Returns false when the chunk is suppressed (it would create a
   * NEW same-type part); in that case NOTHING is touched — no append, no
   * fullText/parts change, no Working clear, no streamSeq bump. Renderable
   * chunks first clear non-null Working with exactly one activityRevision
   * bump (later renderable chunks find activity already null and never
   * bump), then concatenate per the existing snapshot contract.
   */
  function applyRenderableText({ snapshot, text, partType }) {
    const lastPart = snapshot.parts[snapshot.parts.length - 1];
    if (!lastPart || lastPart.type !== partType) {
      if (isBlank(text)) return false; // would create a new blank part — suppressed
    }
    if (snapshot.activity !== null) {
      snapshot.activity = null;
      snapshot.activityRevision += 1;
    }
    if (partType === 'think') {
      liveTurnSnapshot.appendThinking(snapshot, text);
    } else {
      liveTurnSnapshot.appendContent(snapshot, text);
    }
    return true;
  }

  function handleContent({ payload, route, control }) {
    control.touchThreadSession();

    const identity = resolveIdentity(control);
    if (!identity) {
      console.warn('[CanonicalApplier] Dropping pre-binding content event');
      return;
    }

    const text = payload?.text || '';
    let suppressed = false;
    let activityRevision = null;
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      identity,
      ({ snapshot }) => {
        suppressed = !applyRenderableText({ snapshot, text, partType: 'text' });
        if (!suppressed) activityRevision = snapshot.activityRevision;
      }
    );
    if (suppressed) {
      // Silent drop: no emission, no frontier movement, no Working clear.
      // Blank chunks are normal expected model flow — no diagnostic noise.
      return;
    }
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale content event (drain/turn no longer current)');
      return;
    }

    emit('chat:content', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId: identity.turnId,
      streamSeq: seq,
      activityRevision,
      text
    });
  }

  function handleThinking({ payload, route, control }) {
    control.touchThreadSession();

    const identity = resolveIdentity(control);
    if (!identity) {
      console.warn('[CanonicalApplier] Dropping pre-binding thinking event');
      return;
    }

    const text = payload?.text || '';
    let suppressed = false;
    let activityRevision = null;
    const seq = threadRuntimeManager.applyLiveMutation(
      control.runtimeKey,
      identity,
      ({ snapshot }) => {
        suppressed = !applyRenderableText({ snapshot, text, partType: 'think' });
        if (!suppressed) activityRevision = snapshot.activityRevision;
      }
    );
    if (suppressed) {
      // Silent drop: no emission, no frontier movement, no Working clear.
      return;
    }
    if (seq === null) {
      console.warn('[CanonicalApplier] Dropping stale thinking event (drain/turn no longer current)');
      return;
    }

    emit('chat:thinking', {
      workspace: route.workspace,
      scope: route.scope,
      threadId: route.threadId,
      turnId: identity.turnId,
      streamSeq: seq,
      activityRevision,
      text
    });
  }

  return { handleContent, handleThinking };
}

module.exports = { createCanonicalChatTextEvents };
