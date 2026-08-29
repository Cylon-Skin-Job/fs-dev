/**
 * @module stream-helper-registry
 * @role Thread+turn-keyed holder for live stream helper namespaces
 *       (RCC-0108 parent §4.12) plus the dispatch-side frontier seam for
 *       Slice C.
 *
 * Replaces the former module-global singletons (tool argument buffers,
 * tool grouper, subagent streams). Every entry point accepts BOTH keys
 * explicitly and initializes/resets/releases ONLY the addressed namespace —
 * nothing is inferred from selected workspace/thread UI state.
 *
 * Namespace lifecycle:
 *   - turn_begin (addressed pair initializes its namespace: null/same/different
 *     rules live in turn-lifecycle.ts; the registry only clears/creates the pair)
 *   - every model step and tool cycle in that turn reuses the SAME instance;
 *     `step_begin` never resets it
 *   - terminalization (`turn_end`) or a newer-turn supersede releases ONLY
 *     this pair — thread A's turn_end can never clear thread B's namespace
 *   - reconnect calls resetStreamState() → resetAllNamespaces() for the
 *     equivalent whole-state-clear effect
 *
 * SLICE C FRONTIER SEAM — IMPLEMENTED (see ./snapshot-restore.ts for the
 * install orchestrator and stream-handlers.ts for the gated dispatcher):
 *   The per-namespace `frontier: TurnFrontier` record is owned by the pure
 *   primitives in ./frontier.ts. This module exposes thin wrappers so the
 *   install/drain TRIGGERS ride the existing routing instead of rewriting it:
 *
 *     1. Monotone snapshot authority (objective 1b): an installed/accepted
 *        snapshot may only ADVANCE the pair's baseline. The
 *        `installedSnapshotBaselines` ledger below records the highest
 *        accepted snapshot sequence PER PAIR and — unlike namespaces —
 *        SURVIVES namespace release, so a delayed OLDER terminal/in-flight
 *        snapshot arriving after terminalization still cannot regress
 *        anything. Residency: one number per snapshot-bearing thread+turn
 *        pair; cleared by resetAllNamespaces() (reconnect semantics).
 *
 *     2. On an accepted in-flight snapshot at sequence N:
 *        acceptFrontierBaselineAt(threadId, turnId, N)  // atomic baseline + ≤N buffer drop
 *     3. Enter/leave the buffering window (inside the single synchronous
 *        install task):
 *        setNamespaceHydrating(threadId, turnId, true/false)
 *        While hydrating=true, resolveLiveRoute() in stream-handlers.ts buffers
 *        above-baseline events via bufferFrontierEvent() instead of applying.
 *     4. After hydration completes (hydrating=false), drain exactly once,
 *        SYNCHRONOUSLY, applying each taken event through the normal gated
 *        dispatch so the baseline advances only on real application:
 *
 *          const events = takeContiguousDrain(threadId, turnId);
 *          for (const e of events) handleStreamMessage(e.message);
 *
 *        Exactly-once holds by construction: `take` is the single owner that
 *        removes events from the buffer, and until it does, the hydration
 *        window owns them; after it, replay through the gate is their only
 *        path and the advancing baseline then rejects any duplicate arrival.
 *
 *   Baseline writers are exactly three MONOTONE ones — snapshot-install
 *   (acceptFrontierBaselineAt / claimInstalledSnapshotBaseline),
 *   live application (advanceLiveFrontier), and contiguous drain
 *   (drainContiguousEvents via takeContiguousDrain, restored then re-owned by
 *   the replayed applications). No second whole-turn counter exists (roadmap
 *   §5.2 standing ban); activityRevision never participates in any
 *   order/suppress decision anywhere in this module — it is mirrored verbatim
 *   as transport bookkeeping only (SPEC-05 owns presentation).
 */

import type { LiveTurnSnapshot, TurnStepCursor } from '../../types';
import { createToolGrouper } from '../tool-grouper';
import type { ToolGrouper } from '../tool-grouper';
import { createSubagentStreamBookkeeping } from './subagent-stream';
import type { SubagentStreamBookkeeping } from './subagent-stream';
import {
  acceptFrontierBaseline,
  drainContiguousEvents,
  frontierKeyOf,
} from './frontier';
import type { BufferedFrontierEvent, TurnFrontier } from './frontier';

/** One live turn's complete helper namespace. */
export interface StreamHelperNamespace {
  readonly threadId: string;
  readonly turnId: string;
  /** Accumulated `tool_call_args` byte chunks, keyed by toolCallId. */
  readonly toolArgBuffers: Map<string, string>;
  /** Two-layer grouping/correlation state for this turn. */
  readonly grouper: ToolGrouper;
  /** Subagent intro/tool-line bookkeeping for this turn. */
  readonly subagentStreams: SubagentStreamBookkeeping;
  /** Defensive seen-step-identity ledger — client equivalent set (§4.7/§4.9). */
  readonly seenStepIdentities: Set<string>;
  /** Transport-level activity-revision bookkeeping (server value mirrored; SPEC-05 owns presentation). */
  activityRevision: number;
  /** Transport-level step cursor bookkeeping ({ identity, startedAt }). */
  stepCursor: TurnStepCursor | null;
  /** Frontier record mutated exclusively through ./frontier.ts primitives. */
  readonly frontier: TurnFrontier;
}

const namespaces = new Map<string, StreamHelperNamespace>();

/**
 * Highest ACCEPTED snapshot per `threadId + turnId` pair (Slice C,
 * objective 1b — monotone baseline installs). Deliberately SEPARATE from the
 * per-namespace frontier: this ledger must survive releaseNamespace() so a
 * delayed OLDER snapshot arriving after that pair terminalized (namespace
 * gone) still cannot regress anything, and so an OPEN-RACE duplicate frame
 * (thread:opened clears the chat slot BEFORE its own overlay attempt) that
 * gets REFUSED here can rebuild the newest authoritative projection instead
 * of leaving a wiped slot empty (see snapshot-restore.ts). Residency: one
 * serializable-snapshot reference per snapshot-bearing thread+turn pair;
 * cleared by resetAllNamespaces() (reconnect semantics).
 */
export interface InstalledSnapshotRecord {
  /** Highest accepted snapshot sequence for this pair. */
  seq: number;
  /** Newest accepted projection; set by rememberAcceptedSnapshot after the claim. */
  snapshot?: LiveTurnSnapshot;
}

const installedSnapshots = new Map<string, InstalledSnapshotRecord>();

export function getNamespace(
  threadId: string,
  turnId: string,
): StreamHelperNamespace | undefined {
  return namespaces.get(frontierKeyOf(threadId, turnId));
}

function createNamespace(threadId: string, turnId: string): StreamHelperNamespace {
  const ns: StreamHelperNamespace = {
    threadId,
    turnId,
    toolArgBuffers: new Map<string, string>(),
    grouper: createToolGrouper(),
    subagentStreams: createSubagentStreamBookkeeping(),
    seenStepIdentities: new Set<string>(),
    activityRevision: 0,
    stepCursor: null,
    frontier: { baselineStreamSeq: 0, hydrating: false, buffered: [] },
  };
  namespaces.set(frontierKeyOf(threadId, turnId), ns);
  return ns;
}

/**
 * Create-or-return the addressed namespace without disturbing any other
 * pair. Used by live event paths once route identity has been validated.
 */
export function ensureNamespace(threadId: string, turnId: string): StreamHelperNamespace {
  return getNamespace(threadId, turnId) ?? createNamespace(threadId, turnId);
}

/**
 * Freshly initialize the addressed namespace (turn_begin path): drops any
 * stale record for THIS pair only and starts empty — empty seen-step ledger,
 * activityRevision 0 bookkeeping, fresh grouper/subagent/arg-buffer state,
 * zeroed frontier. Optionally seeds the initial sequence carried by the
 * accepted `turn_begin` (transport-level baseline; §5.2).
 */
export function initializeNamespace(
  threadId: string,
  turnId: string,
  options?: { initialStreamSeq?: number },
): StreamHelperNamespace {
  releaseNamespace(threadId, turnId);
  const ns = createNamespace(threadId, turnId);
  const initial = options?.initialStreamSeq;
  if (typeof initial === 'number' && Number.isSafeInteger(initial) && initial >= 1) {
    ns.frontier.baselineStreamSeq = initial;
  }
  return ns;
}

/**
 * Release ONLY the addressed namespace (terminalization / newer-turn
 * supersede). One turn's release can never touch another pair's state.
 */
export function releaseNamespace(threadId: string, turnId: string): void {
  namespaces.delete(frontierKeyOf(threadId, turnId));
}

/**
 * Clear ALL namespaces (reconnect semantics — ws-client.ts resetStreamState).
 * Equivalent whole-state-clear effect over the former global resets. Also
 * clears the snapshot-installed-baseline ledger: after a transport reset the
 * next authoritative snapshot may re-install from zero.
 */
export function resetAllNamespaces(): void {
  namespaces.clear();
  installedSnapshots.clear();
}

// ─────────────────────────────────────────────────────────────
// Slice C frontier seam wrappers (see module docblock for protocol)
// ─────────────────────────────────────────────────────────────

/** Install an authoritative already-revealed baseline at N for this pair. */
export function acceptFrontierBaselineAt(
  threadId: string,
  turnId: string,
  n: number,
): void {
  const ns = ensureNamespace(threadId, turnId);
  acceptFrontierBaseline(ns.frontier, n);
}

/** Enter/exit this pair's hydration buffering window. */
export function setNamespaceHydrating(
  threadId: string,
  turnId: string,
  hydrating: boolean,
): void {
  const ns = ensureNamespace(threadId, turnId);
  ns.frontier.hydrating = hydrating;
}

/**
 * Take the contiguous drained run starting at baseline+1 (ascending order).
 *
 * Advancement ownership: this function does NOT leave the shared baseline
 * advanced. It snapshots the starting expectation, uses the pure
 * ./frontier.ts drain algorithm over the SAME record (single §5.3 logic
 * source), then restores `baselineStreamSeq` to its pre-drain value before
 * returning. Each returned message therefore still satisfies the live gate
 * (`seq > baseline`) when replayed via handleStreamMessage, and the baseline
 * advances through advanceLiveFrontier exactly as each replay actually
 * applies — that makes the whole cycle exactly-once by construction:
 *
 *   const events = takeContiguousDrain(threadId, turnId);
 *   // MUST be applied synchronously right after taking (no awaits between):
 *   for (const e of events) handleStreamMessage(e.message);
 *
 * The synchronous take→apply loop guarantees no fresh arrival can double-
 * apply: until `take` splices an event out of the buffer the hydration
 * window owns it; after the splice, replay is the only path to it.
 */
export function takeContiguousDrain(
  threadId: string,
  turnId: string,
): BufferedFrontierEvent[] {
  const ns = ensureNamespace(threadId, turnId);
  const restoreTo = ns.frontier.baselineStreamSeq;
  const drained = drainContiguousEvents(ns.frontier);
  ns.frontier.baselineStreamSeq = restoreTo;
  return drained;
}

/**
 * Advance the live baseline after a successful in-place application.
 * Called by the dispatcher only AFTER all gates passed AND the store/helper
 * work completed. Monotone: drain can also advance the record; Math.max
 * keeps both writers consistent.
 */
export function advanceLiveFrontier(ns: StreamHelperNamespace, streamSeq: number): void {
  if (streamSeq > ns.frontier.baselineStreamSeq) {
    ns.frontier.baselineStreamSeq = streamSeq;
  }
}

/** Test/evidence helper for the documented seam: latest contiguous expectation. */
export function peekFrontierState(threadId: string, turnId: string): TurnFrontier | undefined {
  return getNamespace(threadId, turnId)?.frontier;
}

/**
 * Monotone snapshot-authority gate (Slice C objective 1b). Returns TRUE iff
 * `n` strictly exceeds this pair's previously installed snapshot baseline
 * (or no snapshot was installed yet), records it, and installs N as the pair's
 * authoritative already-revealed frontier baseline (dropping buffered ≤ N).
 * Returns FALSE for an equal-or-older snapshot — the caller must treat that
 * as a mutation NO-OP unless it is the open-race rebuild case (see
 * recallAcceptedSnapshot; snapshot-restore.ts owns that policy).
 *
 * Single-threaded JS makes read→compare→record atomic within one task; all
 * callers run inside one synchronous install.
 */
export function claimInstalledSnapshotBaseline(
  threadId: string,
  turnId: string,
  n: number,
): boolean {
  const key = frontierKeyOf(threadId, turnId);
  let record = installedSnapshots.get(key);
  if (!record) {
    record = { seq: n };
    installedSnapshots.set(key, record);
  } else if (n <= record.seq) {
    return false;
  } else {
    record.seq = n;
  }
  acceptFrontierBaselineAt(threadId, turnId, n);
  return true;
}

/** Record the full accepted projection for open-race rebuilds (call ONLY after a successful claim). */
export function rememberAcceptedSnapshot(
  threadId: string,
  turnId: string,
  seq: number,
  snapshot: LiveTurnSnapshot,
): void {
  const key = frontierKeyOf(threadId, turnId);
  const record = installedSnapshots.get(key);
  if (!record) return;
  // Attach/refresh the projection at the CURRENT claimed seq (equal is the
  // normal just-claimed case); never regress an older one.
  if (seq > record.seq) record.seq = seq;
  record.snapshot = snapshot;
}

/** Newest accepted snapshot for the pair, or undefined when none exists. */
export function recallAcceptedSnapshot(
  threadId: string,
  turnId: string,
): InstalledSnapshotRecord | undefined {
  return installedSnapshots.get(frontierKeyOf(threadId, turnId));
}

/**
 * Ledger-only peek: highest accepted snapshot sequence for the pair, or
 * undefined when no snapshot was ever accepted. Evidence/smoke helper and a
 * guard input for restoration paths that must not consult live namespaces
 * (which release on terminalization).
 */
export function readInstalledSnapshotBaseline(
  threadId: string,
  turnId: string,
): number | undefined {
  return installedSnapshots.get(frontierKeyOf(threadId, turnId))?.seq;
}
