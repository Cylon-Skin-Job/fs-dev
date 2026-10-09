/**
 * @module ws/frontier
 * @role Stream-frontier bookkeeping keyed by `threadId + turnId` (roadmap §5.3).
 *
 * Slice A establishes the typed state-machine surface only: a per-key record
 * holding the installed baseline sequence, the hydration flag, and the
 * buffered above-baseline event queue, plus pure actions over that record.
 * Slices B/C wire dispatch/hydration into these actions; this module performs
 * no store mutations, no logging, no DOM/timer work — every exported action
 * is synchronous, deterministic, and free of external side effects.
 *
 * Invariants implemented here (roadmap §5.3 / parent §4.9.1):
 * - 1  An accepted snapshot at N installs atomically as an already-revealed
 *      baseline (`acceptFrontierBaseline`) and drops buffered events ≤ N.
 * - 2  Events at or below the baseline are already represented (never replayed).
 * - 3  Events above the baseline arriving during hydration are buffered by
 *      sequence value; they are never reordered, renumbered, or time-sorted.
 * - 4  Drain emits exactly once, in ascending contiguous order from N + 1.
 * - 5  Gaps are never guessed across; a missing sequence keeps later events
 *      buffered until it arrives or a newer baseline advances past it.
 * - 6  Every key isolates one thread/turn; acting on one key cannot touch
 *      another ledger entry.
 *
 * `streamSeq` is the sole whole-turn order. `activityRevision` never takes
 * part in any decision in this module.
 */

import type { ChatInFlightWireMessage } from '../../types';

/** Opaque composite ledger key; NUL separator prevents key-component collisions. */
export function frontierKeyOf(threadId: string, turnId: string): string {
  return `${threadId}\u0000${turnId}`;
}

/** True iff `value` satisfies the REQUIRED positive-integer sequencing contract. */
export function isValidStreamSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/** A sequenced in-flight wire event held until its contiguous drain slot. */
export interface BufferedFrontierEvent {
  readonly streamSeq: number;
  readonly message: ChatInFlightWireMessage;
}

/** Per-thread/turn frontier record. */
export interface TurnFrontier {
  /** Highest sequence installed as an already-revealed baseline (snapshot N, or last drained M). */
  baselineStreamSeq: number;
  /** True while a snapshot install → buffer-drain cycle is in progress. */
  hydrating: boolean;
  /** Above-baseline events awaiting contiguous drain; arrival order preserved. */
  buffered: BufferedFrontierEvent[];
}

/** Frontiers for all live thread/turn pairs. */
export type TurnFrontierLedger = Record<string, TurnFrontier>;

export function createFrontierLedger(): TurnFrontierLedger {
  return {};
}

/** Return the addressed frontier, creating an empty record when absent. */
export function ensureFrontier(
  ledger: TurnFrontierLedger,
  threadId: string,
  turnId: string,
): TurnFrontier {
  const key = frontierKeyOf(threadId, turnId);
  let frontier = ledger[key];
  if (!frontier) {
    frontier = { baselineStreamSeq: 0, hydrating: false, buffered: [] };
    ledger[key] = frontier;
  }
  return frontier;
}

/** Remove one thread/turn namespace entirely (terminal/superseded cleanup). */
export function releaseFrontier(
  ledger: TurnFrontierLedger,
  threadId: string,
  turnId: string,
): void {
  delete ledger[frontierKeyOf(threadId, turnId)];
}

/**
 * Install a new authoritative baseline atomically (snapshot at N, or an
 * advanced snapshot through a gap): sets `baselineStreamSeq = n` in one
 * synchronous action and drops already-represented buffered events ≤ n.
 */
export function acceptFrontierBaseline(frontier: TurnFrontier, n: number): void {
  frontier.baselineStreamSeq = n;
  if (frontier.buffered.length > 0) {
    frontier.buffered = frontier.buffered.filter((e) => e.streamSeq > n);
  }
}

/** True when an event at `streamSeq` is beyond the installed baseline (must buffer/replay). */
export function isBeyondBaseline(frontier: TurnFrontier, streamSeq: number): boolean {
  return streamSeq > frontier.baselineStreamSeq;
}

/** Buffer one above-baseline event verbatim (caller validated `isBeyondBaseline`). */
export function bufferFrontierEvent(
  frontier: TurnFrontier,
  message: ChatInFlightWireMessage,
): void {
  frontier.buffered.push({ streamSeq: message.streamSeq, message });
}

/** Lowest buffered sequence, or null when nothing is buffered. */
export function lowestBufferedSeq(frontier: TurnFrontier): number | null {
  let lowest: number | null = null;
  for (const e of frontier.buffered) {
    if (lowest === null || e.streamSeq < lowest) lowest = e.streamSeq;
  }
  return lowest;
}

/** True when buffered events exist but the next expected sequence is still missing (roadmap §5.3 rule 5). */
export function hasUnsatisfiedGap(frontier: TurnFrontier): boolean {
  const lowest = lowestBufferedSeq(frontier);
  return lowest !== null && lowest !== frontier.baselineStreamSeq + 1;
}

/**
 * Take the contiguous run starting at `baselineStreamSeq + 1`, removing those
 * events and advancing the baseline past them. Returns them in ascending
 * sequence order. Events above the first gap stay buffered untouched. The
 * search scans in place — events are never renumbered or reordered.
 */
export function drainContiguousEvents(frontier: TurnFrontier): BufferedFrontierEvent[] {
  const drained: BufferedFrontierEvent[] = [];
  let expected = frontier.baselineStreamSeq + 1;
  for (;;) {
    const index = frontier.buffered.findIndex((e) => e.streamSeq === expected);
    if (index === -1) break;
    const [event] = frontier.buffered.splice(index, 1);
    drained.push(event);
    expected += 1;
    frontier.baselineStreamSeq = expected - 1;
  }
  return drained;
}
