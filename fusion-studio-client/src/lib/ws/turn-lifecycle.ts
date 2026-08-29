/**
 * @module turn-lifecycle
 * @role Turn begin/end initialization and terminalization (RCC-0108 parent
 *       §4.6/§4.12) plus the observable Working activity clears that belong
 *       to those lifecycle edges (SPEC-05 Slice A).
 *
 * RCC-0108 Slice B routing rules implemented here:
 *  - turn_begin resolves the addressed PanelState by EXPLICIT msg.threadId
 *    only; selected workspace/thread state is never consulted to infer a
 *    missing route or turn. Rules applied atomically:
 *      (a) no currentTurn → initialize the supplied NON-EMPTY server turnId,
 *          its fresh helper namespace, empty seen-step ledger, and
 *          activityRevision-0 bookkeeping (transport-level), and clear any
 *          observable Working residue (§4.9 new-turn reset);
 *      (b) SAME active turnId → idempotent duplicate: nothing is reset;
 *      (c) DIFFERENT active turnId → diagnostic drop WITHOUT reset (the
 *          server terminalizes/supersedes the prior turn before beginning
 *          another — a begin cannot silently replace a live client turn);
 *      missing/empty supplied turnId → drop.
 *
 *  RCC-0108 behavior change vs. pre-SPEC code (parent-approved): the former
 *  "previous turn was not finalized — snapshotting now" safety net is GONE.
 *  Under §4.6 a begin can only initialize a null-turn panel; same-ID is an
 *  idempotent no-op and different-ID drops without touching anything, so no
 *  begin path may ever rewrite a live turn's segments into history.
 *
 *  - handleTurnEnd releases ONLY the addressed thread+turn helper namespace
 *    (terminalization); one turn's release never clears another pair, and
 *    clears observable Working UNCONDITIONALLY (any reason, §4.2) so no
 *    terminal path can strand it.
 *
 *  SPEC-05 Slice A: routed `step_begin` handling (transport ledger +
 *  observable projection) moved to the focused ./activity-stream-handler.
 */

import { usePanelStore } from '../../state/panelStore';
import type { WebSocketMessage } from '../../types';
import { validateTurnTerminalError } from '../chat/terminal-error';
import { isValidStreamSeq } from './frontier';
import {
  initializeNamespace,
  releaseNamespace,
} from './stream-helper-registry';

type TerminalCompanionType = 'auth_error' | 'error';

/**
 * Post-terminal runtime failures publish one identity-less companion after
 * their authoritative error turn_end. Remember that lifecycle edge so the
 * companion can retain its notification without being mistaken for a new
 * prompt's pre-begin acceptance failure on the same thread.
 *
 * The expected transport type comes only from the validated safe catalog;
 * no provider payload, message text, selected thread, or replacement turn is
 * inspected. Consumption is one-shot because the server emits one companion.
 */
const pendingTerminalCompanions = new Map<string, TerminalCompanionType>();

function expectedTerminalCompanion(error: ReturnType<typeof validateTurnTerminalError>): TerminalCompanionType {
  return error.code === 'AUTHENTICATION_FAILED' ? 'auth_error' : 'error';
}

export function consumeTerminalCompanion(
  threadId: string | undefined,
  type: TerminalCompanionType,
): boolean {
  if (!threadId || pendingTerminalCompanions.get(threadId) !== type) return false;
  pendingTerminalCompanions.delete(threadId);
  return true;
}

export function resetTerminalCompanions(): void {
  pendingTerminalCompanions.clear();
}

/**
 * Read the active chat state slot for an EXPLICIT threadId.
 * PER_THREAD_CHAT_STATE: chat slots are keyed by threadId; there is NO
 * currentThreadId fallback on this path (parent §4.6/§4.12).
 */
function readChatState(threadId: string) {
  const state = usePanelStore.getState();
  return state.projectChats[threadId];
}

function logTurnBeginDrop(reason: string, threadId: string): void {
  // Value-minimized diagnostic: type + route identifiers only — never payloads.
  console.warn('[WS] turn_begin dropped:', reason, { threadId: threadId.slice(0, 8) });
}

export function handleTurnBegin(msg: WebSocketMessage, threadId: string): void {
  const suppliedTurnId =
    typeof msg.turnId === 'string' && msg.turnId.trim() !== '' ? msg.turnId : null;
  if (!suppliedTurnId) {
    // Missing/empty supplied turnId on begin → drop (parent §4.6).
    console.warn('[WS] turn_begin dropped: missing/empty turnId', {
      type: msg.type,
      threadId: threadId.slice(0, 8),
    });
    return;
  }

  const chatState = readChatState(threadId);
  const currentTurn = chatState?.currentTurn ?? null;

  // (b) SAME active turnId — idempotent duplicate; do NOT reset anything.
  if (currentTurn && currentTurn.id === suppliedTurnId) {
    console.log('[WS] turn_begin: idempotent duplicate for same turnId', {
      threadId: threadId.slice(0, 8),
    });
    return;
  }

  // (c) DIFFERENT active turnId — diagnostic drop WITHOUT reset. The server
  // must terminalize/supersede the prior turn before beginning another;
  // a begin cannot silently replace a live client turn (parent §4.6).
  if (currentTurn && currentTurn.id !== suppliedTurnId) {
    logTurnBeginDrop('different active turnId on addressed panel', threadId);
    return;
  }

  // (a) Initialization for the addressed pair only: fresh helper namespace
  // (grouper/subagent/arg buffers), empty seen-step ledger,
  // activityRevision-0 bookkeeping, and a transport baseline seed from the
  // initial sequence carried by this accepted begin when present.
  initializeNamespace(threadId, suppliedTurnId, {
    initialStreamSeq: isValidStreamSeq(msg.streamSeq) ? msg.streamSeq : undefined,
  });

  const store = usePanelStore.getState();
  store.resetSegments(threadId);

  // SPEC-05 Slice A (§4.9): a new-turn reset clears any observable Working
  // residue so the fresh turn's strictly-greater gate starts clean.
  store.clearTurnActivity(threadId);

  // CRITICAL: Clear pendingTurnEnd from the PREVIOUS turn.
  //
  // If the old turn's renderer hadn't finished revealing when this
  // turn_begin arrives, pendingTurnEnd is still true. Without this
  // clear, the NEW turn would inherit it — causing premature
  // finalization as soon as the first segment of the new turn
  // finishes revealing.
  //
  // KNOWN PAST BUG (DO NOT REMOVE):
  // Omitting this line caused new turns to finalize immediately
  // after their first segment, because the stale pendingTurnEnd
  // from the previous turn was still set.
  store.setPendingTurnEnd(threadId, false);
  store.setPendingExchangeSave(threadId, null);

  store.setCurrentTurn(threadId, {
    id: suppliedTurnId,
    content: '',
    status: 'streaming',
    hasThinking: false,
    thinkingContent: '',
  });
}

/**
 * Routed `step_begin` handling (defensive duplicate gate, seen-ledger union,
 * cursor/revision mirror, observable strictly-greater Working projection)
 * lives in the focused ./activity-stream-handler (SPEC-05 Slice A).
 */

export function handleTurnEnd(msg: WebSocketMessage, threadId: string): void {
  const store = usePanelStore.getState();

  const addressedTurnId = typeof msg.turnId === 'string' ? msg.turnId : null;
  const addressedTurn = readChatState(threadId)?.currentTurn;
  if (!addressedTurnId || !addressedTurn || addressedTurn.id !== addressedTurnId) {
    console.warn('[WS] turn_end dropped: no matching active turn', {
      type: msg.type,
      threadId: threadId.slice(0, 8),
    });
    return;
  }

  // Terminalization of THIS pair only: releases the addressed namespace
  // before any flush side effects so one turn's teardown can never clear
  // another pair's tool/grouping/subagent/frontier state (parent §4.12).
  releaseNamespace(threadId, addressedTurnId);

  // SPEC-05 Slice A (parent §4.2): turn_end — ANY reason (complete,
  // interrupted, error) — clears observable Working so terminalization can
  // never strand it. The dispatcher's route gate matched this turn before
  // the body ran; the clear is unconditional by contract.
  store.clearTurnActivity(threadId);

  // turn_end signals that the API has finished producing content.
  // Normal completion keeps the paced reveal gate: set pendingTurnEnd and
  // let LiveSegmentRenderer finalize after it catches up.
  //
  // Interrupted/error terminal turns mimic CLI Escape: flush immediately
  // into history so Stop does not sit behind typing/collapse delays.
  //
  // LIFECYCLE:
  //   turn_end arrives → setPendingTurnEnd(true)
  //                    → MessageList passes onRevealComplete to LiveSegmentRenderer
  //                    → LiveSegmentRenderer's completion effect checks:
  //                        revealedCount >= segments.length AND onRevealComplete defined
  //                    → When both true: finalizeTurn() fires ONCE
  //                    → currentTurn.status = 'complete', pendingTurnEnd = false
  //
  // EITHER ORDER IS SAFE:
  //   Stream finishes first: pendingTurnEnd set, renderer catches up later, effect fires.
  //   Renderer catches up first: all revealed, then turn_end arrives, effect fires.
  //
  // See LiveSegmentRenderer.tsx completion detection comments for the
  // full explanation of why this is an effect and not a callback.
  const currentTurn = readChatState(threadId)?.currentTurn;

  if (currentTurn) {
    const flushImmediately = msg.partial === true ||
      msg.reason === 'interrupted' ||
      msg.reason === 'error';

    const terminalError = msg.reason === 'error'
      ? validateTurnTerminalError(msg.terminalError)
      : undefined;

    if (terminalError) {
      pendingTerminalCompanions.set(
        threadId,
        expectedTerminalCompanion(terminalError),
      );
    }

    // Mark last segment complete (closing tag) so reveal knows it's done
    const segs = readChatState(threadId)?.segments || [];
    if (segs.length > 0) {
      const lastSeg = segs[segs.length - 1];
      if (!lastSeg.complete) {
        store.updateLastSegment(threadId, { complete: true });
      }
    }
    store.setPendingTurnEnd(threadId, true);
    store.setPendingExchangeSave(threadId, msg.turnId || currentTurn.id);
    window.dispatchEvent(new CustomEvent('fusion:turn-ended', {
      detail: { threadId, reason: msg.reason, partial: msg.partial },
    }));

    if (flushImmediately) {
      // One atomic store finalization installs completed output plus the
      // immediate validated envelope; queued reveal is bypassed entirely.
      store.finalizeTurn(threadId, terminalError);
    }
  }
}
