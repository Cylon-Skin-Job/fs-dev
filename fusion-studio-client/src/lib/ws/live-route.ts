/**
 * @module live-route
 * @role Explicit turn gate + sequencing/frontier disposition for ONE routed
 *       in-flight member (RCC-0108 parent §4.6/§4.12, roadmap §5.3,
 *       SPEC-04 §2 — extracted from stream-handlers.ts in Slice C so the
 *       routed dispatcher stays thin).
 *
 * Identity runs BEFORE any mutation; shapes are tolerated safely (decision
 * #11) without crashing or partially mutating. Disposition ladder:
 *   1. identity: addressed thread's CURRENT turn must match → else drop.
 *   2. sequence must be a positive integer → else drop.
 *   3. no current turn on a KNOWN thread whose pair has an open speculative
 *      window → buffer until its snapshot installs (see below); any other
 *      current-turn-less member drops exactly as before.
 *   4. hydration window open → hold everything above the baseline verbatim
 *      (≤ baseline drops as already-represented).
 *   5. live mode:
 *        seq ≤ baseline            → drop (already represented).
 *        seq === baseline + 1      → APPLY immediately.
 *        otherwise (gap ahead)     → hold verbatim; NEVER guess across.
 *
 * CONTIGUOUS LIVE APPLICATION (SPEC-04 objective 1a): only
 * `streamSeq === baselineStreamSeq + 1` applies now; anything else arriving
 * out of order is BUFFERED VERBATIM — arrival order irrelevant, never
 * reordered/renumbered/time-sorted — until its predecessor lands or a newer
 * snapshot advances the baseline through the gap (roadmap §5.3 rule 5).
 *
 * PRE-INSTALL BUFFERING: live events racing ahead of a thread:opened
 * snapshot frame find no currentTurn yet. When the addressed thread is one
 * this client already knows about (listed/chatted), the FIRST such validated
 * straggler speculatively opens the pair's hydration window so all further
 * stragglers buffer; installLiveTurnSnapshot() later claims them and drains
 * contiguously onto the installed baseline. Speculation never creates store
 * state — registry bookkeeping only (bounded: one record per typed pair,
 * cleared by turn_begin replacement / turn_end release /
 * resetAllNamespaces).
 *
 * Post-terminal family (`exchange_metadata`, `chat-turn:saved`,
 * `chat-turn:metadata:updated`) never reaches this module: they legally
 * arrive after currentTurn===null and bypass the live gate entirely.
 */

import { usePanelStore } from '../../state/panelStore';
import type { ChatInFlightWireMessage, WebSocketMessage } from '../../types';
import {
  bufferFrontierEvent,
  isValidStreamSeq,
  isBeyondBaseline,
} from './frontier';
import { ensureNamespace, getNamespace, setNamespaceHydrating } from './stream-helper-registry';
import type { StreamHelperNamespace } from './stream-helper-registry';

export interface LiveRoute {
  threadId: string;
  /** Validated positive-integer sequence (sole whole-turn order). */
  streamSeq: number;
  /** The addressed turn's keyed helper namespace. */
  ns: StreamHelperNamespace;
}

export type RouteResolution =
  | { kind: 'drop' }
  /** Held in the pair's buffer for its contiguous drain slot (never applied). */
  | { kind: 'deferred' }
  | ({ kind: 'apply' } & LiveRoute);

/** Read the active chat state slot for an EXPLICIT threadId (PER_THREAD_CHAT_STATE). */
function readChatState(threadId: string) {
  const state = usePanelStore.getState();
  return state.projectChats[threadId];
}

/** True when this client has SEEN the thread (listed or has a chat slot). */
function isKnownThread(threadId: string): boolean {
  const state = usePanelStore.getState();
  if (state.projectChats[threadId]) return true;
  return state.threads.some((t) => t.threadId === threadId);
}

/** Value-minimized drop diagnostics: route ids/type only — never payloads. */
function logGateDrop(
  reason: string,
  msg: WebSocketMessage,
  threadId: string,
  streamSeq?: number,
): void {
  console.warn(`[WS] ${msg.type} dropped (${reason})`, {
    type: msg.type,
    threadId: threadId.slice(0, 8),
    ...(isValidStreamSeq(streamSeq) ? { streamSeq } : {}),
  });
}

/**
 * Explicit turn gate + sequencing/frontier disposition for one in-flight
 * member (the former resolveLiveRoute in stream-handlers.ts).
 */
export function resolveLiveRoute(msg: WebSocketMessage, threadId: string): RouteResolution {
  const currentTurn = readChatState(threadId)?.currentTurn ?? null;

  // Identity first: the addressed thread's own current turn must match.
  if (!currentTurn) {
    return resolvePreInstallBuffering(msg, threadId);
  }
  const turnId = typeof msg.turnId === 'string' ? msg.turnId : '';
  if (!turnId || turnId !== currentTurn.id) {
    logGateDrop('wrong-turn message', msg, threadId);
    return { kind: 'drop' };
  }

  // Sequence next: required positive integer (tolerated-safe drop otherwise;
  // legacy adapters also lack turnId so they were rejected above already).
  if (!isValidStreamSeq(msg.streamSeq)) {
    logGateDrop('invalid/missing streamSeq', msg, threadId);
    return { kind: 'drop' };
  }

  return resolveByFrontier(msg, threadId, ensureNamespace(threadId, turnId), msg.streamSeq);
}

/**
 * No-current-turn branch (parent §4.12 routing). Normally a drop — except
 * for validated stragglers of an open-in-progress KNOWN thread, where
 * speculative pre-install buffering preserves them for the snapshot install's
 * contiguous drain. See module docblock "PRE-INSTALL BUFFERING".
 */
function resolvePreInstallBuffering(msg: WebSocketMessage, threadId: string): RouteResolution {
  const turnId = typeof msg.turnId === 'string' ? msg.turnId : '';
  if (!isKnownThread(threadId) || !turnId || !isValidStreamSeq(msg.streamSeq)) {
    logGateDrop('no current turn on addressed thread', msg, threadId);
    return { kind: 'drop' };
  }

  const existing = getNamespace(threadId, turnId);
  if (!existing) {
    // First validated straggler: speculatively open THIS pair's hydration
    // window so every successor buffers too. Registry bookkeeping only — no
    // store mutation, no observable output. A later genuine turn_begin for
    // the same pair replaces the record wholesale (initializeNamespace); a
    // never-confirmed record simply stays dormant until reset/release.
    setNamespaceHydrating(threadId, turnId, true);
    logGateDrop('buffered: speculative pre-install window', msg, threadId, msg.streamSeq);
    return deferIntoWindow(msg, threadId, ensureNamespace(threadId, turnId));
  }
  if (!existing.frontier.hydrating) {
    logGateDrop('no current turn on addressed thread', msg, threadId);
    return { kind: 'drop' };
  }
  logGateDrop('buffered during pre-install window', msg, threadId, msg.streamSeq);
  return deferIntoWindow(msg, threadId, existing);
}

/** Hydration-window + live-mode frontier dispositions for a routed member. */
function resolveByFrontier(
  msg: WebSocketMessage,
  threadId: string,
  ns: StreamHelperNamespace,
  streamSeq: number,
): RouteResolution {
  const frontier = ns.frontier;

  // Hydration window: above-baseline events are buffered verbatim instead of
  // applied; ≤ baseline is already represented by the installed snapshot.
  if (frontier.hydrating) {
    if (!isBeyondBaseline(frontier, streamSeq)) {
      logGateDrop('at or below installed baseline', msg, threadId, streamSeq);
      return { kind: 'drop' };
    }
    logGateDrop('buffered during hydration window', msg, threadId, streamSeq);
    return deferIntoWindow(msg, threadId, ns);
  }

  // Live mode: below-or-equal baseline means already represented.
  if (streamSeq <= frontier.baselineStreamSeq) {
    logGateDrop('already-represented streamSeq', msg, threadId, streamSeq);
    return { kind: 'drop' };
  }

  // CONTIGUOUS LIVE APPLICATION: only the exact next sequence applies now.
  // Anything further arrives out of order (or its predecessor is missing):
  // it is held verbatim until the cascade reaches it — gaps are never
  // guessed across (roadmap §5.3 rule 5).
  if (streamSeq !== frontier.baselineStreamSeq + 1) {
    logGateDrop('held pending missing predecessor', msg, threadId, streamSeq);
    return deferIntoWindow(msg, threadId, ns);
  }

  return { kind: 'apply', threadId, streamSeq, ns };
}

/**
 * Shared buffer entry with defensive duplicate-sequence rejection at the
 * gate (Slice A advisory A4 ownership); the drain stays exactly-once
 * regardless. Events are stored verbatim in ARRIVAL order — extraction scans
 * BY sequence value and never sorts/renumbers.
 */
function deferIntoWindow(
  msg: WebSocketMessage,
  threadId: string,
  ns: StreamHelperNamespace,
): RouteResolution {
  if (ns.frontier.buffered.some((e) => e.streamSeq === msg.streamSeq)) {
    logGateDrop('duplicate buffered streamSeq', msg, threadId, msg.streamSeq);
    return { kind: 'drop' };
  }
  bufferFrontierEvent(ns.frontier, msg as unknown as ChatInFlightWireMessage);
  return { kind: 'deferred' };
}
