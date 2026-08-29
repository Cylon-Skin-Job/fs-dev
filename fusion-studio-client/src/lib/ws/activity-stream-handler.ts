/**
 * @module activity-stream-handler
 * @role Focused handler for the routed step-activity state machine
 *       (RCC-0108 SPEC-05 Slice A; parent §4.1/§4.7/§4.9). One job: complete
 *       activity/cursor/seen-ledger/revision transitions for the typed
 *       SPEC-04 transport and project the OBSERVABLE transient Working state.
 *
 * Two entry points, both running INSIDE an already-validated route/turn gate
 * (dispatcher `routeAndApply` for live frames; the snapshot install task for
 * restorations):
 *
 *  1. handleStepBegin — one live `step_begin`:
 *     - reject an identity already in THIS turn's seen ledger (defensive
 *       client gate; identity arrives verbatim from the wire and is never
 *       reconstructed client-side, §4.7);
 *     - accept a NEW identity by unioning the ledger, then — and only when
 *       the server `activityRevision` is STRICTLY GREATER than the local
 *       mirror — advance the mirror, set the step cursor, and project the
 *       observable activity `{identity, startedAt, activityRevision, turnId}`
 *       with the server-authoritative `startedAt`. Equal/lower revisions are
 *       no-ops for activity/cursor/revision bookkeeping.
 *     - never resets tool/subagent/grouping state (§4.12).
 *
 *  2. restoreSnapshotActivity — the in-flight snapshot's transport + activity
 *     restoration (§4.9): union snapshot identities into the local ledger,
 *     then a strictly-greater snapshot revision replaces the local
 *     activity/cursor/revision — installing the served observable activity
 *     with its ORIGINAL server `startedAt`, or clearing any local activity it
 *     supersedes. An equal-or-lower snapshot cannot alter local
 *     activity/cursor/revision: no regression behind a newer step and no
 *     resurrection after newer renderable output cleared Working.
 *
 * Clearing on the first renderable output and on turn_end is wired through
 * the store actions in `chatActivityState.ts` from the dispatcher /
 * turn-lifecycle; this module owns only the step-set and snapshot-restore
 * transitions.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  buildTurnActivity,
  isStrictlyGreaterRevision,
} from '../../state/slices/chatActivityState';
import type { LiveTurnSnapshot, WebSocketMessage } from '../../types';
import { ensureNamespace, getNamespace } from './stream-helper-registry';
import type { StreamHelperNamespace } from './stream-helper-registry';

/** Tolerated-safe shape of a routed `step_begin` frame's activity fields. */
interface StepBeginActivityFrame {
  identity?: unknown;
  startedAt?: unknown;
  activityRevision?: unknown;
  stepId?: unknown;
  messageId?: unknown;
}

/** Non-empty-string coercion for optional wire identifiers. */
function asIdentifier(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Tolerant revision read for the strictly-greater clear gate. A missing/
 * non-numeric revision yields NaN, which can never satisfy the rule — the
 * clear then declines while the renderable output still applies.
 */
function activityRevisionOf(msg: WebSocketMessage): number {
  const revision = (msg as { activityRevision?: unknown }).activityRevision;
  return typeof revision === 'number' ? revision : Number.NaN;
}

/**
 * First renderable thinking/content/tool_call event clears observable
 * Working — ONLY when the frame's revision is strictly greater than the
 * current activity's revision (parent §4.1/§4.2). On success the transport
 * mirror advances to the clearing revision so a later equal-revision
 * snapshot cannot resurrect Working (§4.9: equal/lower revisions cannot
 * alter local activity/cursor/revision). The renderable output itself is
 * applied by the dispatcher UNCONDITIONALLY — this gate never suppresses or
 * reorders valid output.
 *
 * Called from the dispatcher's content/thinking/tool_call bodies with the
 * already-resolved namespace.
 */
export function clearActivityOnRenderable(
  msg: WebSocketMessage,
  threadId: string,
  ns: StreamHelperNamespace,
): void {
  const revision = activityRevisionOf(msg);
  const current = usePanelStore.getState().projectChats[threadId]?.activity ?? null;
  if (!current || !isStrictlyGreaterRevision(current.activityRevision, revision)) return;
  ns.activityRevision = Math.max(ns.activityRevision, revision);
  usePanelStore.getState().clearTurnActivityIfNewer(threadId, revision);
}

/**
 * Routed `step_begin` — defensive duplicate gate + transport ledger +
 * strictly-greater OBSERVABLE Working projection. The server remains the
 * authoritative lifetime dedupe gate; the client rejects an explicit
 * server-issued identity already present in THIS turn's seen set as a
 * defensive gate for duplicate delivery and snapshot/live races.
 */
export function handleStepBegin(
  msg: WebSocketMessage & StepBeginActivityFrame,
  threadId: string,
): void {
  const currentTurn = usePanelStore.getState().projectChats[threadId]?.currentTurn;
  if (!currentTurn) return; // dispatcher gate already matched; re-read defensively

  const ns = getNamespace(threadId, currentTurn.id);
  if (!ns) return;

  const identity = asIdentifier(msg.identity);
  if (!identity) {
    // No identity → nothing dedupeable; tolerated-safe ignore. The existing
    // orb-until-output behavior remains the fallback (parent §4.7).
    return;
  }
  if (ns.seenStepIdentities.has(identity)) {
    // ALREADY-SEEN server identity: defensive drop — never resets elapsed
    // time or source-of-truth bookkeeping (parent §4.7).
    console.warn('[WS] step_begin dropped: duplicate step identity', {
      threadId: threadId.slice(0, 8),
    });
    return;
  }

  // Union the ledger FIRST: the identity was delivered, so it must stay seen
  // regardless of any later gate outcome (parent §4.7/§4.9).
  ns.seenStepIdentities.add(identity);

  // STRICTLY-GREATER projection gate: only a revision strictly above the
  // local mirror may advance activity/cursor/revision bookkeeping (equal/
  // lower frames are no-ops for all three — parent §4.9 discipline applied
  // to the live path).
  if (!isStrictlyGreaterRevision(ns.activityRevision, msg.activityRevision)) return;
  ns.activityRevision = msg.activityRevision;

  const startedAt = typeof msg.startedAt === 'number' && Number.isFinite(msg.startedAt)
    ? msg.startedAt
    : null;
  if (startedAt !== null) {
    // Server `startedAt` is authoritative; the cursor survives activity
    // clears so reveal order stays stable (§4.1).
    ns.stepCursor = { identity, startedAt };
  }

  // Observable Working projection — only with a truthful server start time
  // (the elapsed label computes from it). The store re-checks the same
  // strictly-greater rule against the current activity as defense-in-depth.
  if (startedAt === null) return;
  usePanelStore.getState().setTurnActivity(threadId, buildTurnActivity(currentTurn.id, {
    identity,
    startedAt,
    activityRevision: msg.activityRevision,
    stepId: asIdentifier(msg.stepId),
    messageId: asIdentifier(msg.messageId),
  }));
}

/**
 * In-flight snapshot restoration of the route/turn activity state (parent
 * §4.9): union the seen-step ledger, then compare revisions — a strictly
 * greater snapshot replaces local activity/cursor/revision (including the
 * observable projection with its ORIGINAL server `startedAt`); an equal or
 * lower snapshot cannot alter local activity/cursor/revision.
 *
 * Called from snapshot-restore's `restoreInFlightTransportState` inside the
 * single synchronous install task for `status === 'in_flight'` snapshots.
 */
export function restoreSnapshotActivity(threadId: string, snap: LiveTurnSnapshot): void {
  // Create-or-return the addressed namespace (prior mechanical contract of
  // the install task; the claim step normally created it already).
  const ns = ensureNamespace(threadId, snap.turnId);

  // Union seen-step identities into the pair's ledger — never evict during
  // an active turn (parent §4.9). Happens BEFORE the revision comparison.
  for (const identity of Array.isArray(snap.seenStepIdentities) ? snap.seenStepIdentities : []) {
    if (typeof identity === 'string' && identity !== '') {
      ns.seenStepIdentities.add(identity);
    }
  }

  // Strictly-greater gate vs the LOCAL mirror: equal/lower snapshots cannot
  // alter local activity/cursor/revision (§4.9).
  if (!isStrictlyGreaterRevision(ns.activityRevision, snap.activityRevision)) return;
  ns.activityRevision = snap.activityRevision;

  if (
    snap.stepCursor &&
    typeof snap.stepCursor.identity === 'string' &&
    typeof snap.stepCursor.startedAt === 'number'
  ) {
    ns.stepCursor = { identity: snap.stepCursor.identity, startedAt: snap.stepCursor.startedAt };
  }

  const store = usePanelStore.getState();
  if (
    snap.activity &&
    typeof snap.activity.identity === 'string' &&
    snap.activity.identity !== '' &&
    typeof snap.activity.startedAt === 'number' &&
    Number.isFinite(snap.activity.startedAt)
  ) {
    // Restore the observable Working activity with its ORIGINAL server
    // startedAt (parent §4.9 — reconnect keeps the truthful elapsed time).
    store.setTurnActivity(threadId, buildTurnActivity(snap.turnId, {
      identity: snap.activity.identity,
      startedAt: snap.activity.startedAt,
      activityRevision: snap.activityRevision,
      stepId: snap.activity.stepId,
      messageId: snap.activity.messageId,
    }));
    return;
  }

  // The newer snapshot carries NO active Working (e.g. newer renderable
  // output already cleared it server-side): clear any local activity it
  // supersedes so the projection cannot resurrect.
  store.clearTurnActivity(threadId);
}
