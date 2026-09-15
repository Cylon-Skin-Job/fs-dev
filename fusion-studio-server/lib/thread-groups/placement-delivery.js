'use strict';

/**
 * @module thread-groups/placement-delivery
 * @role Trusted in-process delivery consumer for the durable
 *       `open-side-chat-tab` placement outbox (`SPEC-04 §6/§7`).
 *
 * The Move transaction atomically records one bounded placement instruction
 * with the committed group transition (no descriptor snapshot). After commit,
 * or on restart/recovery, this consumer drains unapplied instructions:
 *
 *   - it derives the workspace/project root from the owning server service
 *     (never from the record content);
 *   - it converts the durable record into the accepted Generic Host
 *     `ComponentDescriptor` shape (`fusion.chat-surface`, durable identities
 *     only, no `surfaceId`) and persists it through SPEC-03's narrow
 *     `mutateManagedPlacement` service lane;
 *   - it acknowledges (`applied`) or records a bounded failure (`failed`,
 *     attempts, timestamp) that stays observable and retryable;
 *   - a delivery failure never rolls back the already committed group
 *     transition, and a repeated delivery acknowledges/focuses the existing
 *     placement instead of creating a duplicate.
 *
 * Idempotency: the stable `sideChatPlacementId` is the durable placement key
 * and the lane's `upsert` is a single-slot write, so a repeated delivery lands
 * on the same record. The outbox status guards re-application.
 */

const repository = require('./repository');
const { componentInstanceIdForPlacement } = require('./ids');
const {
  getThreadWorksurface,
  mutateManagedPlacement,
} = require('../view-state/thread-worksurface');

const PLACEMENT_PREFIX = 'open-side-chat-tab';
const CHAT_SURFACE_COMPONENT_TYPE = 'fusion.chat-surface';
const SIDE_TAB_HOST = 'side-tab';

/** Stable per-member idempotency key for the open instruction. */
function buildPlacementOutboxKey({ workspaceId, viewId, threadGroupId, threadId }) {
  return `${PLACEMENT_PREFIX}:${workspaceId}:${viewId}:${threadGroupId}:${threadId}`;
}

/**
 * The exact accepted Generic Host descriptor for one Side Chat placement.
 * Durable identities only: `workspaceId`, `viewId`, `threadGroupId`,
 * `threadId`, `host`. `sideChatPlacementId` is the placement lane key and the
 * derived stable `componentInstanceId`, never a descriptor input field
 * (`BRIDGE-02-CONFORMANCE-OVERLAY.md` §4.3).
 */
function buildSideChatDescriptor(record) {
  return {
    schemaVersion: 1,
    componentTypeId: CHAT_SURFACE_COMPONENT_TYPE,
    componentInstanceId: componentInstanceIdForPlacement(record.sideChatPlacementId),
    targetKey: record.sideChatPlacementId,
    input: {
      workspaceId: record.workspaceId,
      viewId: record.viewId,
      threadGroupId: record.groupId,
      threadId: record.threadId,
      host: SIDE_TAB_HOST,
    },
  };
}

function sameDescriptor(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (a.componentTypeId !== b.componentTypeId) return false;
  if (a.componentInstanceId !== b.componentInstanceId) return false;
  if ((a.targetKey ?? null) !== (b.targetKey ?? null)) return false;
  const ai = a.input || {};
  const bi = b.input || {};
  return ai.workspaceId === bi.workspaceId
    && (ai.viewId ?? null) === (bi.viewId ?? null)
    && ai.threadGroupId === bi.threadGroupId
    && ai.threadId === bi.threadId
    && ai.host === bi.host;
}

/** Observable delivery state for one instruction. */
function placementResult(record) {
  if (!record) return { status: 'not_applicable', attempts: 0 };
  return {
    status: record.status,
    attempts: Number(record.attempts || 0),
    ...(record.failureCode ? { failureCode: record.failureCode } : {}),
  };
}

/** Bounded, classified failure code stored on the instruction. */
function classifyFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (/^[a-z0-9_]{1,64}$/.test(code)) return code;
  return 'view_state_unavailable';
}

async function acknowledge(db, record, { alreadyMaterialized }) {
  const now = Date.now();
  await repository.markPlacementOutbox(db, {
    idempotencyKey: record.idempotencyKey,
    status: 'applied',
    failureCode: null,
    appliedAt: now,
    now,
  });
  return {
    ...placementResult({ ...record, status: 'applied', attempts: record.attempts + 1 }),
    applied: true,
    alreadyMaterialized: Boolean(alreadyMaterialized),
  };
}

/**
 * Consume exactly one instruction. Failure-isolated: a delivery failure is
 * recorded and reported, never thrown at the committed Move.
 */
async function consumePlacementOutbox(db, { workspaceId, projectRoot, record }) {
  if (!record) return placementResult(null);
  if (record.workspaceId !== workspaceId) return placementResult(null);
  if (record.status === 'applied') return placementResult(record);

  const descriptor = buildSideChatDescriptor(record);
  try {
    const current = await getThreadWorksurface(
      projectRoot,
      record.viewId,
      record.groupId,
    );
    const existing = current.entry?.managedComponentPlacements?.[record.sideChatPlacementId];
    // SPEC-04 §7: a persisted `closed` disposition prevents restart/outbox
    // replay from reopening the tab. Ordinary delivery intent acknowledges the
    // committed instruction without resurrecting an intentionally closed
    // placement; only an explicit member action may reopen it.
    if (existing && existing.disposition === 'closed') {
      return acknowledge(db, record, { alreadyMaterialized: false, closed: true });
    }
    if (existing && existing.disposition === 'open' && sameDescriptor(existing.descriptor, descriptor)) {
      return acknowledge(db, record, { alreadyMaterialized: true });
    }
    await mutateManagedPlacement(projectRoot, record.viewId, record.groupId, {
      placementId: record.sideChatPlacementId,
      operation: 'upsert',
      descriptor,
      expectedPlacementRevision: current.placementRevision ?? null,
    });
    return acknowledge(db, record, { alreadyMaterialized: false });
  } catch (error) {
    const failureCode = classifyFailure(error);
    try {
      await repository.markPlacementOutbox(db, {
        idempotencyKey: record.idempotencyKey,
        status: 'failed',
        failureCode,
        appliedAt: null,
        now: Date.now(),
      });
    } catch (_markError) {
      // The delivery attempt is best-effort; a failed status write still leaves
      // the instruction durable and retryable.
    }
    return {
      ...placementResult({
        ...record, status: 'failed', attempts: record.attempts + 1, failureCode,
      }),
      applied: false,
    };
  }
}

/** Retry one group's unapplied instruction by its idempotency key. */
async function consumePlacementOutboxForGroup(db, { workspaceId, projectRoot, groupId }) {
  const record = await repository.getPlacementOutboxForGroup(db, groupId);
  if (!record || record.workspaceId !== workspaceId) return placementResult(null);
  return consumePlacementOutbox(db, { workspaceId, projectRoot, record });
}

/**
 * Explicit member access (`SPEC-04 §8`): reopen (if closed) or focus (if open)
 * one member's *lifetime* `sideChatPlacementId`. Unlike ordinary outbox
 * delivery, this is the sanctioned reopen path and may materialize a placement
 * whose durable disposition is `closed`. It creates no session, primary event,
 * MRU activity, or transcript effect — it only writes the managed placement
 * lane and returns the observable outcome. A bounded CAS retry keeps the
 * operation non-destructive under a concurrent lane write.
 *
 * @returns {Promise<{ ok: boolean, code?: string, placementId?: string,
 *   disposition?: 'open', focused?: boolean, created?: boolean }>}
 */
async function materializeMemberPlacement(db, { workspaceId, projectRoot, record }) {
  if (!record || record.workspaceId !== workspaceId) return { ok: false, code: 'not_found' };
  const descriptor = buildSideChatDescriptor(record);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const current = await getThreadWorksurface(
        projectRoot,
        record.viewId,
        record.groupId,
      );
      const existing = current.entry?.managedComponentPlacements?.[record.sideChatPlacementId];
      if (existing && existing.disposition === 'open' && sameDescriptor(existing.descriptor, descriptor)) {
        return {
          ok: true,
          placementId: record.sideChatPlacementId,
          disposition: 'open',
          focused: true,
          created: false,
        };
      }
      await mutateManagedPlacement(projectRoot, record.viewId, record.groupId, {
        placementId: record.sideChatPlacementId,
        operation: 'upsert',
        descriptor,
        expectedPlacementRevision: current.placementRevision ?? null,
      });
      return {
        ok: true,
        placementId: record.sideChatPlacementId,
        disposition: 'open',
        focused: false,
        created: !existing,
      };
    } catch (error) {
      if (error?.code === 'revision_conflict' && attempt < 2) continue;
      const code = error?.code === 'not_found' || error?.code === 'invalid_view'
        ? 'placement_unavailable'
        : classifyFailure(error);
      return { ok: false, code };
    }
  }
  return { ok: false, code: 'placement_unavailable' };
}

/** Restart/recovery sweep: drain every unapplied instruction for one workspace. */
async function consumePendingPlacementOutbox(db, { workspaceId, projectRoot }) {
  const records = await repository.listUnappliedPlacementOutbox(db, workspaceId);
  const outcomes = [];
  for (const record of records) {
    outcomes.push(await consumePlacementOutbox(db, { workspaceId, projectRoot, record }));
  }
  return outcomes;
}

module.exports = {
  CHAT_SURFACE_COMPONENT_TYPE,
  SIDE_TAB_HOST,
  buildPlacementOutboxKey,
  buildSideChatDescriptor,
  classifyFailure,
  consumePendingPlacementOutbox,
  consumePlacementOutbox,
  consumePlacementOutboxForGroup,
  materializeMemberPlacement,
  placementResult,
};
