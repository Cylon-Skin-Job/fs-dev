/**
 * @module stream-handlers
 * @role Thin routed dispatcher for stream-related WebSocket messages
 *       (RCC-0108 SPEC-04 Slice B).
 *
 * Extracted from ws-client.ts (spec 05a); under RCC-0108 it keeps the
 * message-type switch shape but delegates domain work to focused modules:
 *   - tool-stream-handlers.ts        tool_call / args / result application
 *   - stream-helper-registry.ts      thread+turn-keyed helper namespaces +
 *                                    the Slice-C frontier seam
 *   - turn-lifecycle.ts              begin/end/init rules + step transport ledger
 *   - chat-diagnostic-handlers.ts    diagnostic retrieval frames
 *
 * LIVE GATE (parent §4.6/§4.12): every in-flight member through turn_end
 * (content, thinking, tool_call, tool_call_args, tool_result,
 * subagent_event, status_update, step_begin) plus turn_end must match the
 * addressed thread's CURRENT turn BEFORE any store action or stream helper
 * runs; wrong-thread / wrong-turn / sequence-invalid messages are dropped
 * with value-minimized diagnostics (route ids/type only — never payloads).
 *
 * SEQUENCING (roadmap §5.3 / SPEC-04 §2 — Slice C end-to-end): gated messages
 * require a positive-integer streamSeq (isValidStreamSeq). CONTIGUOUS LIVE
 * APPLICATION: a gated member applies IMMEDIATELY only when
 * `streamSeq === baselineStreamSeq + 1`; otherwise it is BUFFERED verbatim
 * (arrival order irrelevant; never reordered/renumbered/time-sorted) until its
 * predecessor lands or a newer snapshot advances the baseline through the gap.
 * Gaps are never guessed across. After each contiguous application the drain
 * continuation cascades automatically from the buffer.
 *
 * PRE-INSTALL BUFFERING: live events racing ahead of a thread:opened snapshot
 * frame find no currentTurn yet. When the addressed thread is one this client
 * already knows about (listed/chatted), the FIRST such validated straggler
 * speculatively opens the pair's hydration window so all further stragglers
 * buffer; installLiveTurnSnapshot() later claims them and drains contiguously
 * onto the installed baseline. Unknown thread/turn/sequence combos drop with
 * value-minimized diagnostics exactly as before — speculation never creates
 * store state, only registry bookkeeping (bounded: one record per typed pair,
 * cleared by turn_end/resetAllNamespaces).
 *
 * POST-TERMINAL FAMILY: exchange_metadata, chat-turn:saved, and
 * chat-turn:metadata:updated legally arrive after currentTurn===null and
 * bypass the live gate entirely; they never mutate live helpers/activity/
 * grouper/subagent/frontier state.
 */

import { usePanelStore } from '../../state/panelStore';
import { readTokenUsage } from '../chat/context-usage';
import { useChatFileLinkStore } from '../../state/chatFileLinkStore';
import { useFileStore } from '../../state/fileStore';
import {
  handleToolCall,
  handleToolCallArgs,
  handleToolResult,
} from './tool-stream-handlers';
import {
  advanceLiveFrontier,
  getNamespace,
  resetAllNamespaces,
  takeContiguousDrain,
} from './stream-helper-registry';
import { resolveLiveRoute } from './live-route';
import type { LiveRoute } from './live-route';
import {
  handleChatDiagnosticReportFrame,
  handleChatDiagnosticUnavailableFrame,
} from './chat-diagnostic-handlers';
import { showToast } from '../toast';
import type { WebSocketMessage, WebSocketMessageType } from '../../types';
import {
  consumeTerminalCompanion,
  handleTurnBegin,
  handleTurnEnd,
  resetTerminalCompanions,
} from './turn-lifecycle';
import { clearActivityOnRenderable, handleStepBegin } from './activity-stream-handler';

interface TimingProbe {
  firstTokenAt?: number;
  firstTokenType?: string;
  sendAt?: number;
}

const ROUTED_STREAM_TYPES = new Set<WebSocketMessageType>([
  'turn_begin',
  'step_begin',
  'content',
  'thinking',
  'tool_call',
  'tool_call_args',
  'tool_result',
  'subagent_event',
  'turn_end',
  'exchange_metadata',
  'chat-turn:saved',
  'chat-turn:metadata:updated',
  'status_update',
  'auth_error',
]);

function getStreamRoute(msg: WebSocketMessage): { threadId: string } | null {
  if (!ROUTED_STREAM_TYPES.has(msg.type)) return null;
  if (!msg.threadId) {
    console.warn('[WS] Dropping stream message without explicit route metadata', {
      type: msg.type,
      threadId: msg.threadId,
    });
    return null;
  }
  return { threadId: msg.threadId };
}

/** Read the active chat state slot for an EXPLICIT threadId. */
function readChatState(threadId: string) {
  const state = usePanelStore.getState();
  return state.projectChats[threadId];
}

/**
 * Gate → domain work → frontier advancement → drain continuation, in ONE
 * place so every gated family member behaves identically.
 *
 * ADVISORY A2 FIX (binding repair-packet item): sequence advancement is
 * UNCONDITIONAL once the gate returns `apply` — it no longer sits inside any
 * payload conditional. A validated-gated event whose effect payload is empty
 * (e.g. whitespace-only content that produces no segment mutation under
 * SPEC-02 suppression rules) still consumes its exact streamSeq slot: the
 * baseline advances by one so buffered successors can flow. Without this,
 * an in-order empty chunk would strand baseline+1 successors behind a gap
 * that can never fill. Exactly-once is preserved: advancement happens at
 * most once per resolution, and resolution returns `apply` only when
 * `seq === baseline + 1`.
 *
 * `advanceBeforeBody` is used ONLY by turn_end: the terminalization body
 * releases this pair's namespace (parent §4.12), so the final advancement
 * must land on the still-current record first. SLICE-B ADVISORY A1 COHERENCE:
 * release-at-turn_end with async finalize pending is safe because (a) the
 * released namespace cannot be re-entered — any subsequent gated message for
 * the pair resolves against a null/stale currentTurn and drops; (b)
 * finalizeTurn() later reads only STORE state (segments/pendingSavedExchanges),
 * never the registry record; and (c) a NEWER begin builds a FRESH namespace
 * keyed by its own turnId — never aliasing the released one.
 */
function routeAndApply(
  msg: WebSocketMessage,
  threadId: string,
  applyBody: (resolved: LiveRoute) => void,
  opts?: { advanceBeforeBody?: boolean },
): boolean {
  const resolved = resolveLiveRoute(msg, threadId);
  if (resolved.kind !== 'apply') return true;
  if (opts?.advanceBeforeBody) {
    advanceLiveFrontier(resolved.ns, resolved.streamSeq);
  }
  applyBody(resolved);
  if (!opts?.advanceBeforeBody) {
    advanceLiveFrontier(resolved.ns, resolved.streamSeq);
  }
  cascadeBufferedApplication(threadId);
  return true;
}

/**
 * Drain continuation (roadmap §5.3 rule 4): after each contiguous
 * application, take the ENTIRE contiguous buffered run and replay EVERY
 * taken event in ascending order through the PUBLIC dispatcher so the
 * identical route/sequence gate applies it — the registry's documented seam
 * protocol (take→apply loop, Slice B docblock). Exactly-once holds by
 * construction: `take` is the sole owner removing events from the buffer;
 * once spliced, an event can only re-enter handling through THIS replay.
 *
 * Per-event guards bound correctness to the original pairing:
 *  - identity/teardown: if a replayed turn_end released THIS namespace
 *    (§4.12 clear-on-terminalization) or finalization cleared the addressed
 *    turn, iteration STOPS — the remainder intentionally dies with the
 *    terminalized pair (nothing legal follows a terminal). Object-identity
 *    comparison of the namespace record means a NEWER turn's fresh record is
 *    never confused with this run's.
 *  - contiguity/skip: if an event's slot precondition is already consumed
 *    (a nested continuation of one of OUR replays advanced past it) and it is
 *    neither next nor still buffered elsewhere, it was applied exactly once
 *    through that path — skipping prevents duplicates without loss.
 *
 * Thread B records are never consulted here (objective 5).
 */
export function cascadeBufferedApplication(threadId: string): void {
  const startTurn = readChatState(threadId)?.currentTurn ?? null;
  if (!startTurn) return;
  const ns = getNamespace(threadId, startTurn.id);
  if (!ns || ns.frontier.hydrating) return;

  const drained = takeContiguousDrain(threadId, startTurn.id);
  for (const event of drained) {
    const nowTurn = readChatState(threadId)?.currentTurn ?? null;
    const nowNs = nowTurn ? getNamespace(threadId, nowTurn.id) : undefined;
    if (!nowTurn || nowNs !== ns || nowNs.frontier.hydrating) return;
    const isNext = event.streamSeq === nowNs.frontier.baselineStreamSeq + 1;
    const stillBuffered = nowNs.frontier.buffered.some((e) => e.streamSeq === event.streamSeq);
    if (!isNext && !stillBuffered) continue;
    handleStreamMessage(event.message as unknown as WebSocketMessage);
  }
}

/** First-token timing probe — preserved equivalent on the routed path. */
function markFirstToken(type: 'content' | 'thinking'): void {
  const t = (window as Window & { __TIMING?: TimingProbe }).__TIMING;
  if (t && !t.firstTokenAt) {
    t.firstTokenAt = performance.now();
    t.firstTokenType = type;
    const ttft = t.sendAt === undefined ? 0 : t.firstTokenAt - t.sendAt;
    console.log(`[TIMING] FIRST TOKEN (${type}) at ${t.firstTokenAt.toFixed(1)}ms — TTFT: ${ttft.toFixed(1)}ms`);
  }
}

/**
 * Handle stream-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 *
 * PER_THREAD_CHAT_STATE: every write is routed via msg.threadId so primary
 * and secondary streams stay isolated into their own chat slots. Server
 * stamps threadId on every outbound chat:* event (wire-broadcaster.js).
 */
export function handleStreamMessage(msg: WebSocketMessage): boolean {
  const store = usePanelStore.getState();

  // ── Diagnostic retrieval frames — claimed AHEAD of metadata dispatch ──
  // Mirrors the server's client-message-router.js registration intent:
  // `chat-turn:diagnostic:*` never falls through to metadata routing.
  // Their report payloads are suppressed from ALL console/captured-log
  // paths earlier still, in ws-client's redactMessageForLog().
  if (msg.type === 'chat-turn:diagnostic:report') {
    return handleChatDiagnosticReportFrame(msg);
  }
  if (msg.type === 'chat-turn:diagnostic:unavailable') {
    return handleChatDiagnosticUnavailableFrame(msg);
  }

  const route = getStreamRoute(msg);
  if (ROUTED_STREAM_TYPES.has(msg.type) && !route) return true;
  const threadId = route?.threadId;

  switch (msg.type) {
    case 'turn_begin': {
      if (!threadId) return true;
      handleTurnBegin(msg, threadId);
      return true;
    }

    case 'content':
      // Payload conditional covers SEGMENT effects only (A2): sequence
      // advancement happens unconditionally in routeAndApply.
      if (!threadId) return true;
      return routeAndApply(msg, threadId, (resolved) => {
        const text = typeof msg.text === 'string' ? msg.text : '';
        if (text) {
          markFirstToken('content');
          resolved.ns.grouper.breakSequence();
          store.appendSegment(threadId, 'text', text);

          const turn = readChatState(threadId)?.currentTurn;
          if (turn) {
            store.updateTurnContent(threadId, turn.content + text);
          }

          // SPEC-05 Slice A: renderable output clears observable Working
          // under the strictly-greater revision gate. The append above is
          // UNCONDITIONAL — an equal/lower revision never suppresses or
          // reorders valid output (parent §4.1/§4.2).
          clearActivityOnRenderable(msg, threadId, resolved.ns);
        }
      });

    case 'thinking':
      if (!threadId) return true;
      return routeAndApply(msg, threadId, (resolved) => {
        const text = typeof msg.text === 'string' ? msg.text : '';
        if (text) {
          markFirstToken('thinking');
          resolved.ns.grouper.breakSequence();
          store.appendSegment(threadId, 'think', text);
          // SPEC-05 Slice A: same strictly-greater gated Working clear as
          // content (output applied unconditionally, parent §4.2).
          clearActivityOnRenderable(msg, threadId, resolved.ns);
        }
      });

    case 'tool_call':
      if (!threadId) return true;
      return routeAndApply(msg, threadId, (resolved) => {
        handleToolCall(msg, resolved.ns);
        // SPEC-05 Slice A: a tool call is renderable output — strictly-greater
        // gated Working clear; never suppresses the tool itself (§4.2).
        clearActivityOnRenderable(msg, threadId, resolved.ns);
      });

    case 'tool_call_args':
      if (!threadId) return true;
      return routeAndApply(msg, threadId, (resolved) => {
        handleToolCallArgs(msg, resolved.ns);
      });

    case 'tool_result':
      if (!threadId) return true;
      return routeAndApply(msg, threadId, (resolved) => {
        handleToolResult(msg, resolved.ns);
      });

    case 'subagent_event':
      if (!threadId) return true;
      return routeAndApply(msg, threadId, (resolved) => {
        resolved.ns.subagentStreams.handleSubagentEvent(msg, threadId);
      });

    case 'step_begin':
      if (!threadId) return true;
      // Focused handler (SPEC-05 Slice A): ONE routed step_begin applies the
      // full activity transition INSIDE this validated route/turn gate —
      // defensive seen-ledger duplicate gate (§4.7), transport ledger/cursor/
      // revision bookkeeping, and the OBSERVABLE strictly-greater Working
      // projection with the server-authoritative startedAt. Duplicate and
      // equal/lower-revision frames are activity no-ops. Never resets tool/
      // subagent/grouping state (§4.12). A duplicate-identity step still
      // consumes its streamSeq slot (unconditional advancement): the server
      // only publishes unseen identities with unique increasing sequences, so
      // a seen-duplex arrival is a replay artifact whose sequence must not
      // strand the frontier (activityRevision remains Working-transition
      // ordering only — streamSeq is the sole whole-turn order).
      return routeAndApply(msg, threadId, () => {
        handleStepBegin(msg, threadId);
      });

    case 'status_update':
      if (!threadId) return true;
      return routeAndApply(msg, threadId, () => {
        const tokenUsage = readTokenUsage(msg.tokenUsage);
        // Context/status projections that affect visible chat are selected
        // by thread rather than overwritten from an unrelated background
        // thread (parent §4.12): only the SELECTED thread projects onto the
        // panel-level usage fields; other turns consume their update.
        if (usePanelStore.getState().currentThreadId === threadId) {
          if (msg.tokenUsage !== undefined) {
            store.setTokenUsage(tokenUsage);
          }
          if (msg.contextUsage !== undefined) {
            store.setContextUsage(msg.contextUsage);
          } else if (typeof tokenUsage?.context_pct === 'number') {
            store.setContextUsage(tokenUsage.context_pct);
          }
        }
      });

    case 'turn_end': {
      if (!threadId) return true;
      // advanceBeforeBody: terminalization releases THIS pair's namespace
      // (§4.12), so the final sequence lands on the still-current record
      // first; cascade afterwards exits immediately on the released pair.
      // See routeAndApply for the A1 lifecycle-invariant justification.
      return routeAndApply(msg, threadId, () => {
        handleTurnEnd(msg, threadId);
      }, { advanceBeforeBody: true });
    }

    case 'exchange_metadata': {
      if (!threadId) return true;
      // Post-terminal acknowledgement family — bypasses the live-current-
      // turn gate entirely (legally arrives after currentTurn===null) and
      // touches no live helper namespace.
      const openTabPaths = useFileStore.getState().tabs
        .filter((tab) => tab.kind === 'file')
        .map((tab) => tab.file.path);
      useChatFileLinkStore.getState().mergeExchangeAutocompleteCandidates({
        seq: 0,
        ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
        user: msg.userInput || '',
        assistant: { parts: [] },
        metadata: msg.metadata || {},
      }, openTabPaths);
      return true;
    }

    case 'chat-turn:saved': {
      if (!threadId || !msg.turnId) return true;
      store.setMessageExchangeSaved(threadId, msg.turnId, {
        exchangeId: msg.exchangeId,
        seq: msg.seq,
        ts: msg.ts,
        metadata: msg.metadata,
      });
      return true;
    }

    case 'chat-turn:metadata:updated': {
      if (!threadId || typeof msg.exchangeId !== 'number') return true;
      store.updateMessageMetadata(threadId, msg.exchangeId, msg.metadata || {});
      return true;
    }

    case 'request':
      console.log('[WS] Agent request:', msg.requestType);
      return true;

    case 'auth_error':
      // A post-terminal identity-less companion retains its toast but MUST
      // NOT masquerade as a replacement prompt's acceptance failure. The
      // authoritative error turn_end arms the one-shot lifecycle marker.
      // Without that marker this is a true pre-begin failure and preserves
      // the existing acceptance cleanup event.
      if (!threadId) return true;
      if (!consumeTerminalCompanion(threadId, 'auth_error')) {
        const pendingPrompt = store.projectChats[threadId]?.pendingPromptAcceptance;
        const pendingPromptMatched = pendingPrompt != null;
        if (pendingPrompt) {
          store.setPromptRetryDraft(threadId, pendingPrompt);
          store.setPendingPromptAcceptance(threadId, null);
        }
        window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed', {
          detail: { threadId, message: msg.message || 'Authentication failed', pendingPromptMatched },
        }));
      }
      showToast(msg.message || 'Authentication failed. Run `kimi login` in your terminal.');
      return true;

    case 'error':
      console.error('[WS] Wire error:', msg.error);
      // Route-less transport errors are global diagnostics. They cannot be
      // correlated to any pending prompt and must never guess that the
      // currently visible/pending thread owns them (parent §4.13).
      if (typeof msg.threadId !== 'string' || msg.threadId.trim() === '') {
        return true;
      }
      if (!consumeTerminalCompanion(msg.threadId, 'error')) {
        const pendingPrompt = store.projectChats[msg.threadId]?.pendingPromptAcceptance;
        const pendingPromptMatched = pendingPrompt != null;
        if (pendingPrompt) {
          store.setPromptRetryDraft(msg.threadId, pendingPrompt);
          store.setPendingPromptAcceptance(msg.threadId, null);
        }
        window.dispatchEvent(new CustomEvent('fusion:prompt-acceptance-failed', {
          detail: {
            threadId: msg.threadId,
            message: msg.message || msg.error || 'Prompt failed',
            pendingPromptMatched,
          },
        }));
      }
      return true;

    default:
      return false;
  }
}

/**
 * Reset stream state (called on reconnect from ws-client.ts).
 * Exported so the connection lifecycle can reset all keyed namespaces with
 * the equivalent whole-state-clear effect over the thread+turn registry.
 */
export function resetStreamState(): void {
  resetTerminalCompanions();
  resetAllNamespaces();
}
