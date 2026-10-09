/**
 * @module chatActivityState
 * @role Observable transient Working-activity state for the panel store
 *       (RCC-0108 SPEC-05 Slice A; parent §4.1/§4.2/§4.9).
 *
 * One job: own the TRANSIENT per-thread `PanelState.activity` projection plus
 * its pure transition decisions. Working is keyed by threadId+turnId, never
 * enters StreamSegment/AssistantPart/durable messages, and is never rendered
 * by history (InstantSegmentRenderer). `activityRevision` orders ONLY
 * Working-state transitions — `streamSeq` remains the sole whole-turn order
 * (roadmap §5.2).
 *
 * Gate rules implemented here (the ONLY acceptance direction is strictly
 * greater, parent §4.9):
 *  - SET: a step's activity projection is accepted only when its server
 *    `activityRevision` is STRICTLY GREATER than the current activity's
 *    revision; equal/lower cannot set, change, or resurrect Working.
 *  - RENDERABLE CLEAR: the first renderable thinking/content/tool_call clears
 *    non-null Working only under the same strictly-greater rule. The
 *    renderable output itself is applied by the dispatcher UNCONDITIONALLY —
 *    this gate never suppresses or reorders valid output.
 *  - TERMINAL CLEAR: turn_end (any reason), new-turn resets, and
 *    terminalization-equivalent installs clear Working unconditionally so no
 *    terminal path can strand it.
 *
 * Layering: the transport-side duplicate gate, seen-identity ledger, and step
 * cursor live in the ws registry (`stream-helper-registry`) and are mirrored
 * by the focused handler (`activity-stream-handler`), which pre-gates every
 * call here against the local revision mirror. The store-level checks below
 * are the observable-side guard for the same rule.
 */

import type { TurnActivity } from '../../types';
import type { AppState } from '../panelStoreTypes';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;

/** Tolerated-safe step fields of a routed/validated `step_begin` projection. */
export interface IncomingStepActivity {
  identity: string;
  startedAt: number;
  activityRevision: number;
  stepId?: string;
  messageId?: string;
}

/**
 * STRICTLY-GREATER revision gate (parent §4.1/§4.9): returns true only for a
 * finite incoming revision strictly above `currentRevision`. Equal/lower (and
 * missing/non-numeric) revisions can never set, change, clear, or resurrect
 * observable activity.
 */
export function isStrictlyGreaterRevision(
  currentRevision: number,
  incomingRevision: unknown,
): incomingRevision is number {
  return (
    typeof incomingRevision === 'number' &&
    Number.isFinite(incomingRevision) &&
    incomingRevision > currentRevision
  );
}

/**
 * Build the observable `TurnActivity` for the addressed turn. Server values
 * (`identity`, `startedAt`, `activityRevision`) are authoritative and pass
 * through verbatim; optional identifiers are attached only when present.
 */
export function buildTurnActivity(turnId: string, step: IncomingStepActivity): TurnActivity {
  return {
    kind: 'working',
    turnId,
    identity: step.identity,
    startedAt: step.startedAt,
    activityRevision: step.activityRevision,
    ...(step.stepId !== undefined ? { stepId: step.stepId } : {}),
    ...(step.messageId !== undefined ? { messageId: step.messageId } : {}),
  };
}

/**
 * Truthful WHOLE elapsed seconds since the server-authoritative start,
 * computed as a clock delta (parent §4.10) — never an incrementing counter,
 * so a backgrounded tab resyncs to the truthful value instead of drifting.
 */
export function wholeElapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * Write the `activity` field of the addressed thread slot. Returns null when
 * the slot is absent (no chat state may be created by an activity write).
 */
function writeActivity(
  state: AppState,
  threadId: string,
  activity: TurnActivity | null,
): Partial<AppState> | null {
  const cs = state.projectChats[threadId];
  if (!cs) return null;
  return { projectChats: { ...state.projectChats, [threadId]: { ...cs, activity } } };
}

export function createChatActivitySlice(set: Set) {
  return {
    /**
     * Project a step's observable Working activity. Store-side guard: a
     * strictly-greater revision is required whenever a current activity
     * exists (the transport mirror gate runs earlier in the handler).
     */
    setTurnActivity: (threadId: string, activity: TurnActivity) => set((state) => {
      const current = state.projectChats[threadId]?.activity ?? null;
      if (current && !isStrictlyGreaterRevision(current.activityRevision, activity.activityRevision)) {
        return state; // equal/lower cannot set, change, or resurrect Working
      }
      return writeActivity(state, threadId, activity) ?? state;
    }),

    /**
     * turn_end / terminalization equivalence / new-turn reset: clear Working
     * UNCONDITIONALLY (any reason) so no terminal path can strand it.
     */
    clearTurnActivity: (threadId: string) => set((state) => {
      const cs = state.projectChats[threadId];
      if (!cs || !cs.activity) return state;
      return writeActivity(state, threadId, null) ?? state;
    }),

    /**
     * First renderable thinking/content/tool_call clear: accepted only when
     * the frame's revision is strictly greater than the current activity's.
     * An equal/lower (or missing ⇒ NaN) revision is a no-op here and NEVER
     * suppresses the renderable output the dispatcher already applied.
     */
    clearTurnActivityIfNewer: (threadId: string, activityRevision: number) => set((state) => {
      const current = state.projectChats[threadId]?.activity ?? null;
      if (!current || !isStrictlyGreaterRevision(current.activityRevision, activityRevision)) {
        return state;
      }
      return writeActivity(state, threadId, null) ?? state;
    }),
  };
}
