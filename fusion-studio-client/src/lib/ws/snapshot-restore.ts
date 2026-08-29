/**
 * @module snapshot-restore
 * @role Authoritative live-turn snapshot restoration (SPEC-04 Slice C) — the
 *       overlay path for thread:opened / thread:forked.
 *
 * One job: install a served LiveTurnSnapshot for an addressed thread/turn so
 * the client resumes from authoritative server progress, never from renderer
 * position (parent §4.9/§4.9.1). One entry point: installLiveTurnSnapshot().
 * Routing stays in stream-handlers.ts; frontier primitives in frontier.ts;
 * this module owns the TRIGGERS and view-path selection.
 *
 * Status routing:
 *  - Durable-history match (legacy userInput+fullText rule) → no-op; the
 *    hydrated exchanges already render everything (no duplicate rows).
 *  - complete / interrupted / error → completed INSTANT-rendering path: ONE
 *    assistant message row via existing durable-history mechanics, NO live
 *    replay remount. For non-durable 'error', the snapshot's typed
 *    terminalError envelope is revalidated into the closed client catalog
 *    and retained on the completed message's immediate terminalError field.
 *    A later saved acknowledgement supplies the durable metadata fallback;
 *    presentation prefers the immediate field and never duplicates the row.
 *  - in_flight → already-revealed catch-up baseline: parts become segments on
 *    an explicitly unfinished instant projection (normal assistant/tool output,
 *    no message-level reply chrome) and the live reveal plane is left EMPTY
 *    with currentTurn streaming, so post-baseline events flow through normal
 *    live wiring. "Already revealed" holds through existing public mechanics:
 *    LiveSegmentRenderer's completion gate requires revealedCount >=
 *    segments.length, revealedCount starts at 0, and 0 >= 0 holds from mount
 *    (the DO-NOT-SPLIT renderer was not edited).
 *
 * Atomicity (roadmap §5.3 rule 1): the whole install runs inside ONE
 * synchronous task; JS run-to-completion plus zustand's synchronous notifies
 * mean wire callbacks cannot observe half-applied baseline/mirror/view
 * writes. Entering/exiting the pair's hydration window inside that one task
 * closes the loop.
 *
 * Monotone authority (objective 1b): claimInstalledSnapshotBaseline() gates
 * EVERY mutation path per pair; ≤ installed-baseline snapshots are ignored-
 * for-mutation, equal-N reinstall is a mutation no-op, only strictly newer
 * frames advance what the user sees; the ledger survives namespace release.
 * ONE sanctioned exception keeps open races safe: an equal-or-older frame
 * on a slot carrying NO representation of THIS turn (thread:opened cleared
 * it moments earlier) rebuilds the newest accepted projection from registry
 * cache — refusal must never strand a wiped slot empty.
 * Restoration vs turn_begin gating (parent §4.6): snapshots RESTORE server
 * truth — they legitimately initialize a NULL panel slot or refresh their OWN
 * turn when strictly newer, and are ignored while a DIFFERENT turn is active;
 * afterwards live turn_begin still obeys §4.6 verbatim (same-ID idempotent,
 * different-ID rejected without reset; supersession is server terminalization,
 * never a begin).
 *
 * Cross-thread isolation (objective 5): registry ops are pair-keyed, store
 * ops use the explicit threadId slot — A can never reset/pause/drain B.
 */

import { usePanelStore } from '../../state/panelStore';
import type {
  AssistantPart,
  AssistantTurn,
  ExchangeData,
  LiveTurnSnapshot,
} from '../../types';
import { isValidStreamSeq } from './frontier';
import { convertPartToSegment } from './assistant-parts';
import { restoreSnapshotActivity } from './activity-stream-handler';
import { validateTurnTerminalError } from '../chat/terminal-error';
import {
  claimInstalledSnapshotBaseline,
  recallAcceptedSnapshot,
  releaseNamespace,
  rememberAcceptedSnapshot,
  setNamespaceHydrating,
} from './stream-helper-registry';
import { cascadeBufferedApplication } from './stream-handlers';

/** Deterministic synthetic row id for THIS pair's catch-up baseline message. */
function catchupRowId(turnId: string): string {
  return `catchup-${turnId}`;
}

/**
 * Deterministic synthetic id for THIS turn's ensured prompt row. Sole
 * writers are this module's installers, keyed by their own snap.turnId;
 * durable hydration writes `ex-<idx>-user`, so an id match can never hit
 * another exchange's row (F-C1 repair).
 */
function liveUserRowId(turnId: string): string {
  return `live-${turnId}-user`;
}

function logSkip(reason: string, snap: LiveTurnSnapshot): void {
  // Value-minimized: route identifiers + status only — never payloads.
  console.warn('[WS] snapshot skipped:', reason, {
    threadId: snap.threadId.slice(0, 8),
    status: snap.status,
    streamSeq: snap.streamSeq,
  });
}

/**
 * A snapshot is durable only when hydrated exchange metadata carries the
 * same authoritative server turnId. Prompt/text equality is not identity:
 * retries can legitimately produce identical (including empty) content.
 */
function isLiveTurnDurable(
  liveTurn: LiveTurnSnapshot,
  exchanges: ExchangeData[] | undefined,
): boolean {
  return Boolean(exchanges?.some(
    exchange => exchange.metadata?.turnId === liveTurn.turnId,
  ));
}

function partsText(parts: AssistantPart[]): string {
  return parts
    .filter((p): p is { type: 'text'; content: string } => p.type === 'text')
    .map(p => p.content)
    .join('');
}

function thinkText(parts: AssistantPart[]): string {
  return parts
    .filter((part): part is { type: 'think'; content: string } => part.type === 'think')
    .map(part => part.content)
    .join('');
}

/**
 * Remove the pair's previous synthetic catch-up row before a replace-install
 * so a refresh at N2 > N1 cannot stack duplicated baseline content. Only OUR
 * synthetic id is targeted.
 */
function stripPriorCatchupRow(threadId: string, turnId: string): void {
  const store = usePanelStore.getState();
  const cs = store.projectChats[threadId];
  if (!cs?.messages.some(m => m.type === 'assistant' && m.id === catchupRowId(turnId))) return;
  const messages = cs.messages.filter(m => !(m.type === 'assistant' && m.id === catchupRowId(turnId)));
  usePanelStore.setState((state) => {
    const current = state.projectChats[threadId];
    if (!current) return state;
    return { projectChats: { ...state.projectChats, [threadId]: { ...current, messages } } };
  });
}

/**
 * Completed/durable-or-terminal instant path (objective 3): ONE assistant
 * message row (id === turnId so the LATER chat-turn:saved ack merges straight
 * into it) rendered instantly by InstantSegmentRenderer; same-pair live-plane
 * residue from a prior in-flight baseline is closed out first.
 */
function installCompletedInstantRow(threadId: string, snap: LiveTurnSnapshot): void {
  const store = usePanelStore.getState();

  // Terminalization equivalence, addressed pair ONLY: restoration bypasses
  // the live gate, so the §4.12 clear-on-terminalization release happens here.
  const chatState = store.projectChats[threadId];
  if (chatState?.currentTurn?.id === snap.turnId) {
    store.resetSegments(threadId);
    store.setCurrentTurn(threadId, null);
    store.setPendingTurnEnd(threadId, false);
    // SPEC-05 Slice A (§4.9): terminal paths clear observable Working too —
    // activity restores ONLY for in_flight snapshots.
    store.clearTurnActivity(threadId);
  }
  stripPriorCatchupRow(threadId, snap.turnId);
  releaseNamespace(threadId, snap.turnId);

  // Legacy parity: an unsaved failed/completed turn has no durable exchange
  // to have hydrated its prompt row; without it the transcript would show an
  // orphan assistant row.
  const postState = usePanelStore.getState().projectChats[threadId];
  const hasUserBubble = Boolean(postState?.messages.some(
    message => message.type === 'user' && message.id === liveUserRowId(snap.turnId),
  ));
  if (!hasUserBubble) {
    store.addMessage(threadId, {
      id: liveUserRowId(snap.turnId),
      type: 'user',
      content: snap.userInput,
      timestamp: snap.updatedAt,
    });
  }

  // Error snapshots always produce one client-validated safe immediate
  // envelope. Invalid/absent input maps to the generic catalog row without
  // copying unknown fields; non-error terminals carry no immediate error.
  const envelope = snap.status === 'error'
    ? validateTurnTerminalError(snap.terminalError)
    : null;

  store.addMessage(threadId, {
    id: snap.turnId,
    type: 'assistant',
    content: partsText(snap.parts),
    timestamp: snap.updatedAt,
    segments: snap.parts.map((part, index) => convertPartToSegment(part, {
      isTerminal: true,
      isLastPart: index === snap.parts.length - 1,
    })),
    ...(envelope ? { terminalError: envelope } : {}),
  });

  console.log('[WS] snapshot installed (completed instant path)', {
    threadId: threadId.slice(0, 8),
    status: snap.status,
    streamSeq: snap.streamSeq,
    retainedTerminalError: Boolean(envelope),
  });
}

/**
 * In-flight already-revealed catch-up install (objective 2). Baseline parts
 * land on an instant-rendered message row tagged with the synthetic catch-up
 * id; the LIVE reveal plane is emptied and currentTurn restored to streaming
 * so later events finalize normally through the existing pipeline.
 */
function installInFlightBaseline(threadId: string, snap: LiveTurnSnapshot): void {
  const store = usePanelStore.getState();

  stripPriorCatchupRow(threadId, snap.turnId);

  // Legacy parity: add the accepted prompt row when hydrated history does
  // not already show it. Re-read after the strip above for current bytes.
  const chatState = usePanelStore.getState().projectChats[threadId];
  const hasUserBubble = Boolean(chatState?.messages.some(
    message => message.type === 'user' && message.id === liveUserRowId(snap.turnId),
  ));
  if (!hasUserBubble) {
    store.addMessage(threadId, {
      id: liveUserRowId(snap.turnId),
      type: 'user',
      content: snap.userInput,
      timestamp: snap.updatedAt,
    });
  }

  // Already-revealed baseline row (InstantSegmentRenderer domain).
  store.addMessage(threadId, {
    id: catchupRowId(snap.turnId),
    type: 'assistant',
    content: partsText(snap.parts),
    timestamp: snap.updatedAt,
    segments: snap.parts.map((part) => convertPartToSegment(part, { isTerminal: true })),
    projection: 'in-flight-snapshot-baseline',
  });

  // Live plane empty ⇒ completion gate holds from mount; currentTurn
  // streaming keeps existing gate/finalize/saved-ack wiring working (the ack
  // merges onto the tail row by turnId). Tail-finalize yields a SECOND row
  // with only post-N output — the snapshot-boundary row split is cosmetic
  // territory deferred to RCC-0112 (parent §4.9.1); order/content preserved.
  store.resetSegments(threadId);
  const turnView: AssistantTurn = {
    id: snap.turnId,
    content: '',
    status: 'streaming',
    hasThinking: snap.parts.some(part => part.type === 'think'),
    thinkingContent: thinkText(snap.parts),
  };
  store.setCurrentTurn(threadId, turnView);
  store.setPendingTurnEnd(threadId, false);
  // Deliberately NOT touched: pendingSavedExchanges / pendingExchangeSaveTurnId
  // serve prior turns' save-correlation (objective 4 reverse race); clearChat
  // resets them on open paths, a bare refresh must not discard pending acks.

  console.log('[WS] snapshot installed (in-flight already-revealed baseline)', {
    threadId: threadId.slice(0, 8),
    streamSeq: snap.streamSeq,
    baselineParts: snap.parts.length,
  });
}

/**
 * Restore the route/turn activity state an IN-FLIGHT snapshot represents
 * (parent §4.9) by delegating to the focused activity handler (SPEC-05 Slice
 * A): seen-ledger union + strictly-greater activity/cursor/revision restore,
 * now including the OBSERVABLE Working install with its original server
 * `startedAt`. Kept as this module's named step so the install task's single
 * synchronous shape is unchanged.
 */
function restoreInFlightTransportState(threadId: string, snap: LiveTurnSnapshot): void {
  restoreSnapshotActivity(threadId, snap);
}

/**
 * True when the addressed slot already shows SOME representation of THIS
 * turn. TURN-DETERMINISTIC legs only (F-C1): the assistant ids are this
 * turn's own, and the user leg matches the synthetic id OUR installers write
 * — content equality is forbidden here because a DIFFERENT exchange sharing
 * the prompt text would otherwise mask a wiped slot and strand it without a
 * projection. Distinguishes "genuinely nothing installed yet" /
 * "wiped-but-should-rebuild" from "already showing — pure no-op".
 */
function slotRepresentsTurn(threadId: string, snap: LiveTurnSnapshot): boolean {
  const messages = usePanelStore.getState().projectChats[threadId]?.messages ?? [];
  return messages.some(m =>
    m.type === 'assistant' && (m.id === snap.turnId || m.id === catchupRowId(snap.turnId))
  ) || messages.some(m => m.type === 'user' && m.id === liveUserRowId(snap.turnId));
}

/** Entry point — see module docblock. Caller: thread-handlers.ts overlays. */
export function installLiveTurnSnapshot(
  threadId: string,
  liveTurn: LiveTurnSnapshot | null | undefined,
  exchanges: ExchangeData[] | undefined,
): void {
  if (!liveTurn || liveTurn.threadId !== threadId) return;
  const turnId = typeof liveTurn.turnId === 'string' ? liveTurn.turnId : '';
  if (!turnId || !isValidStreamSeq(liveTurn.streamSeq)) {
    console.warn('[WS] snapshot dropped: invalid route/sequence', {
      threadId: threadId.slice(0, 8),
      status: liveTurn?.status,
    });
    return;
  }
  // Normalize the terminal slot before this snapshot can enter the accepted
  // projection cache. Malformed/raw envelope fields are never copied into
  // client state, including the open-race rebuild cache.
  const snap: LiveTurnSnapshot = {
    ...liveTurn,
    terminalError: liveTurn.status === 'error'
      ? validateTurnTerminalError(liveTurn.terminalError)
      : null,
  };

  // Authoritative turn-id short-circuit: hydrated exchanges already contain
  // this exact turn — absolutely no duplicate mutation.
  if (isLiveTurnDurable(snap, exchanges)) return;

  // Stale-turn guard: a snapshot addressing a DIFFERENT currently-active
  // turn is ignored-for-mutation (restoration owns null slots or its own
  // turn id only; the newer live turn keeps rendering). See module docblock
  // for the restoration-vs-begin gating distinction.
  const activeTurnId = usePanelStore.getState().projectChats[threadId]?.currentTurn?.id ?? null;
  if (activeTurnId !== null && activeTurnId !== turnId) {
    logSkip('addresses a retired turn while a different turn is active', snap);
    return;
  }

  // ── ATOMIC INSTALL TASK (single synchronous pass; see docblock) ──
  const claimed = claimInstalledSnapshotBaseline(threadId, turnId, snap.streamSeq);
  if (!claimed) {
    // Equal-or-older snapshot: normally a mutation NO-OP (objective 1b).
    // ONE sanctioned exception — the open-race rebuild: thread:opened wipes
    // the chat slot BEFORE its overlay attempt, so a refused racing frame
    // must rebuild the newest accepted projection from cache instead of
    // leaving a wiped slot empty. Fires ONLY when the slot carries no
    // representation of THIS turn; otherwise pure no-op (equal-N idempotence).
    const cached = recallAcceptedSnapshot(threadId, turnId);
    if (cached?.snapshot && !slotRepresentsTurn(threadId, snap)) {
      console.log('[WS] snapshot skipped (older) — rebuilding newest accepted projection', {
        threadId: threadId.slice(0, 8),
        stored: cached.seq,
        arrived: snap.streamSeq,
      });
      setNamespaceHydrating(threadId, turnId, true);
      if (cached.snapshot.status === 'in_flight') {
        // Same ordering discipline as the fresh install: slot first, then
        // observable activity restoration (SPEC-05 Slice A).
        installInFlightBaseline(threadId, cached.snapshot);
        restoreInFlightTransportState(threadId, cached.snapshot);
        setNamespaceHydrating(threadId, turnId, false);
      } else {
        installCompletedInstantRow(threadId, cached.snapshot);
      }
      cascadeBufferedApplication(threadId);
      return;
    }
    logSkip('at or below installed baseline', snap);
    setNamespaceHydrating(threadId, turnId, false);
    cascadeBufferedApplication(threadId);
    return;
  }
  rememberAcceptedSnapshot(threadId, turnId, snap.streamSeq, snap);

  if (snap.status === 'in_flight') {
    // Enter the pair's hydration window so wire callbacks queue behind this
    // task; within-task interleave is impossible by JS run-to-completion.
    setNamespaceHydrating(threadId, turnId, true);
    // Order matters (SPEC-05 Slice A): the baseline install creates the
    // thread slot FIRST; the activity restoration then projects the
    // observable Working state onto that existing slot (activity writes
    // never create chat state).
    installInFlightBaseline(threadId, snap);
    restoreInFlightTransportState(threadId, snap);
    setNamespaceHydrating(threadId, turnId, false);
    // Window exited ⇒ contiguous drain kicks here: buffered stragglers from
    // BEFORE the open frame (N+1 …) apply once, in order, onto the baseline.
    cascadeBufferedApplication(threadId);
    return;
  }

  // Terminal trio: instant completed-message path. No window is opened —
  // installCompletedInstantRow releases the pair's record entirely
  // (terminalization equivalence), which also dissolves any speculative
  // pre-open window that stragglers may have created for this turn.
  installCompletedInstantRow(threadId, snap);
}
