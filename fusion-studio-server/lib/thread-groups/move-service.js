'use strict';

/**
 * @module thread-groups/move-service
 * @role The SPEC-04 `move_chat_to_side` group operation and its server-owned
 *       session-start policy resolution.
 *
 * Extracted verbatim from `./service` (04A-D9 / 04C-D13 carry, mechanical
 * split in Slice 04D). It runs against the owning `ThreadGroupService`
 * instance passed as the first argument, so every lease, replay, context, and
 * repository helper stays single-sourced on the service. The public
 * `ThreadGroupService` surface (`performAction` and the `moveChatToSide`
 * method) is unchanged.
 */

const repository = require('./repository');
const { canonicalTargetHash } = require('./action-identity');
const { groupMutationLeaseKey, withGroupMutationLease } = require('./group-mutation-lease');
const { isBoundedId } = require('./application-link');
const { mintSideChatPlacementId, mintThreadId } = require('./ids');
const { buildPlacementOutboxKey } = require('./placement-delivery');
const { isChatCapableView } = require('./chat-capable-views');
const { resolveCliPolicy } = require('../cli-config');
const { validatePortableSelection } = require('../thread/thread-harness-config-policy');

/**
 * Resolve the server-owned session-start policy `B` inherits from source `A`
 * (`SPEC-04 §5`, `CHAT-I-026/031`): the immutable stored harness binding plus
 * the last server-acknowledged portable `{model, variant}`. A client-supplied
 * harness, Move selection, or pending renderer intent is never read. When the
 * acknowledged model is no longer creatable under current policy the caller
 * receives an inert failure rather than a silently different session.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {string} sourceThreadId
 * @returns {Promise<{ ok: true, harnessId: string, harnessConfig: object }
 *   | { ok: false, code: string }>}
 */
async function resolveMoveSessionPolicy(service, sourceThreadId) {
  const source = await service.operations.getThread(sourceThreadId);
  const harnessId = source?.entry?.harnessId;
  if (!source || !harnessId) return { ok: false, code: 'not_found' };

  let policy;
  try {
    policy = await resolveCliPolicy(service.projectRoot);
  } catch (_error) {
    return { ok: false, code: 'selection_unavailable' };
  }
  if (!policy || !Array.isArray(policy.allowedHarnesses)
    || !policy.allowedHarnesses.includes(harnessId)) {
    return { ok: false, code: 'selection_unavailable' };
  }

  const portable = source.entry?.harnessConfig ?? {};
  if (!portable || typeof portable !== 'object' || !portable.model) {
    // No acknowledged portable selection yet: inherit only the binding.
    return { ok: true, harnessId, harnessConfig: {} };
  }
  const models = policy?.config?.[harnessId]?.models ?? null;
  const validated = validatePortableSelection({
    models,
    model: portable.model,
    variant: portable.variant ?? null,
  });
  if (!validated.ok) return { ok: false, code: 'selection_unavailable' };
  return {
    ok: true,
    harnessId,
    harnessConfig: {
      model: validated.model,
      ...(validated.variant !== null ? { variant: validated.variant } : {}),
    },
  };
}

/**
 * Move the current Main Chat `A` into a Side Chat tab and create a new empty
 * Main Chat `B` in the same group (`SPEC-04 §4/§5`, slice 04A).
 *
 * One group lease serializes Move against Rename/Delete. The whole durable
 * transition commits in one SQLite transaction: the new session row + mirror
 * instruction (ThreadManager-owned), the next peer membership, the appended
 * primary event, the transactional primary cache, one idempotent
 * `move:{requestId}` activity that advances group MRU exactly once, and the
 * bounded `open-side-chat-tab` placement instruction. Placement delivery is a
 * separate, retryable step that never rolls back the transition.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function moveChatToSide(service, {
  threadGroupId = null, threadId = null, expectedPrimarySequence = null,
  requestId = null, componentContext = null,
} = {}) {
  const activation = await service.activate();
  if (!activation.ok) {
    return {
      ok: false,
      code: 'view_id_preflight_repair_required',
      diagnostics: activation.diagnostics,
    };
  }
  if (!isBoundedId(threadGroupId) || !isBoundedId(threadId)) {
    return { ok: false, code: 'not_found' };
  }
  if (!Number.isInteger(expectedPrimarySequence) || expectedPrimarySequence < 0) {
    return { ok: false, code: 'invalid_request' };
  }

  const db = service.db;
  const hashInput = {
    action: 'move_chat_to_side', threadGroupId, threadId, expectedPrimarySequence,
  };
  const replayEarly = await service._replayIfPresent(requestId, hashInput);
  if (replayEarly) return replayEarly;

  const groupRow = await service._resolveOwnedGroup({ threadGroupId, threadId });
  if (!groupRow) return { ok: false, code: 'not_found' };
  const projection = await repository.getGroupProjection(db, groupRow.group_id);
  if (!projection) return { ok: false, code: 'not_found' };

  // Eligibility (`SPEC-04 §4`): view-bound main host, exact current primary
  // membership, exact observed sequence, terminal runtime, creatable policy.
  if (!projection.viewId) return { ok: false, code: 'not_found' };
  const viewTarget = service.resolveViewTarget(projection.viewId);
  if (!viewTarget.ok) return { ok: false, code: 'view_not_supported' };
  // SPEC-04 §6/§11 04B: the bridge-covered chat-capable view set is the only
  // Move-eligible population. A registered view outside it is explicitly
  // ineligible and rejects with the existing classified error BEFORE any
  // session/member/event/outbox/action-result row is created.
  if (!isChatCapableView(viewTarget.viewId)) return { ok: false, code: 'view_not_supported' };
  if (projection.currentPrimaryThreadId !== threadId) return { ok: false, code: 'not_primary' };
  if (Number(projection.currentPrimarySequence) !== expectedPrimarySequence) {
    return { ok: false, code: 'stale_primary' };
  }
  const busy = typeof service.operations.isMemberBusy === 'function'
    ? service.operations.isMemberBusy(threadId)
    : null;
  if (busy) return { ok: false, code: 'group_busy', busy: [{ threadId, state: busy }] };

  const policy = await resolveMoveSessionPolicy(service, threadId);
  if (!policy.ok) return { ok: false, code: policy.code };

  const targetHash = canonicalTargetHash(hashInput);
  const workspaceId = service.workspaceId;
  const viewId = projection.viewId;

  return withGroupMutationLease(
    groupMutationLeaseKey(workspaceId, groupRow.group_id),
    async () => {
      const replay = await service._replayIfPresent(requestId, hashInput);
      if (replay) return replay;

      // Revalidate under the lease: a peer Move/Delete may have committed.
      const currentGroup = await repository.getGroup(db, groupRow.group_id);
      if (!currentGroup || currentGroup.workspace_id !== workspaceId) {
        return { ok: false, code: 'not_found' };
      }
      const currentProjection = await repository.getGroupProjection(db, groupRow.group_id);
      if (!currentProjection || currentProjection.viewId !== viewId) {
        return { ok: false, code: 'not_found' };
      }
      if (currentProjection.currentPrimaryThreadId !== threadId) {
        return { ok: false, code: 'not_primary' };
      }
      if (Number(currentProjection.currentPrimarySequence) !== expectedPrimarySequence) {
        return { ok: false, code: 'stale_primary' };
      }
      const busyRecheck = typeof service.operations.isMemberBusy === 'function'
        ? service.operations.isMemberBusy(threadId)
        : null;
      if (busyRecheck) {
        return { ok: false, code: 'group_busy', busy: [{ threadId, state: busyRecheck }] };
      }

      const now = Date.now();
      const newMainThreadId = mintThreadId();
      const sideChatPlacementId = mintSideChatPlacementId();
      const nextOrdinal = await repository.nextOrdinal(db, groupRow.group_id);
      const nextSequence = Number(currentProjection.currentPrimarySequence) + 1;
      const idempotencyKey = buildPlacementOutboxKey({
        workspaceId, viewId, threadGroupId, threadId,
      });
      const durability = {
        threadGroupId,
        threadId,
        workspaceId,
        viewId,
        movedThreadId: threadId,
        newMainThreadId,
        currentPrimarySequence: nextSequence,
        sideChatPlacementId,
        placementStatus: 'pending',
      };

      try {
        await db.transaction(async (trx) => {
          await service.operations.stageNewSession(trx, {
            threadId: newMainThreadId,
            name: null,
            harnessId: policy.harnessId,
            harnessConfig: policy.harnessConfig,
            groupId: threadGroupId,
          });
          await repository.insertMember(trx, {
            groupId: threadGroupId,
            threadId: newMainThreadId,
            ordinal: nextOrdinal,
            originKind: 'move-to-side-chat-primary',
            joinedAt: now,
          });
          await repository.insertPrimaryEvent(trx, {
            groupId: threadGroupId,
            sequence: nextSequence,
            previousThreadId: threadId,
            nextThreadId: newMainThreadId,
            reason: 'move-to-side-chat',
            occurredAt: now,
          });
          await repository.setCurrentPrimary(trx, threadGroupId, newMainThreadId);
          await repository.recordActivityAndAdvance(trx, {
            eventKey: `move:${requestId}`,
            groupId: threadGroupId,
            threadId: newMainThreadId,
            turnId: null,
            kind: 'move-chat-to-side',
            occurredAt: now,
          });
          await repository.insertPlacementOutbox(trx, {
            sideChatPlacementId,
            idempotencyKey,
            workspaceId,
            viewId,
            groupId: threadGroupId,
            threadId,
            operation: 'open-side-chat-tab',
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          });
          await repository.insertActionResult(trx, {
            workspaceId,
            requestId,
            action: 'move_chat_to_side',
            targetHash,
            resultJson: JSON.stringify({
              ...durability,
              context: service._context({
                workspaceId,
                viewId,
                threadGroupId,
                threadId: newMainThreadId,
                componentContext,
              }),
            }),
            createdAt: now,
            updatedAt: now,
          });
        });
      } catch (error) {
        // Two concurrent requests cannot both insert one requestId; the
        // unique action-result constraint is the arbiter. Re-derive replay.
        const existing = await repository.getActionResult(db, workspaceId, requestId);
        if (existing) return service._replay(existing, hashInput);
        throw error;
      }

      // Post-commit mirror completion is recoverable and never rolls back.
      if (typeof service.operations.ensureSessionMirror === 'function') {
        await service.operations.ensureSessionMirror(newMainThreadId);
      }

      // Separate retryable placement delivery (SPEC-04 §7).
      let placement = { status: 'pending', attempts: 0 };
      if (typeof service.operations.retryPlacementDeliveryForGroup === 'function') {
        try {
          placement = await service.operations.retryPlacementDeliveryForGroup(threadGroupId);
        } catch (_error) {
          placement = { status: 'failed', attempts: 0, failureCode: 'view_state_unavailable' };
        }
      }

      const result = {
        ...durability,
        placementStatus: placement.status,
        placement,
        context: service._context({
          workspaceId,
          viewId,
          threadGroupId,
          threadId: newMainThreadId,
          componentContext,
        }),
      };
      // Refresh the recorded result so a replay never returns a stale
      // delivery status. The transition itself is already durable.
      try {
        await repository.updateActionResult(db, workspaceId, requestId, {
          resultJson: JSON.stringify(result),
          now: Date.now(),
        });
      } catch (_error) {
        // The recorded pre-delivery result remains a valid replay body.
      }
      return { ok: true, result, placement };
    },
  );
}

module.exports = {
  moveChatToSide,
  resolveMoveSessionPolicy,
};
