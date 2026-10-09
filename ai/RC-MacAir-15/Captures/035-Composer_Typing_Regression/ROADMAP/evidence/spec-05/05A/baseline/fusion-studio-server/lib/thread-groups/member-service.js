'use strict';

/**
 * @module thread-groups/member-service
 * @role The SPEC-04 member-access operations: the qualified `thread:members`
 *       ordered read and the idempotent `open_member_in_side` action.
 *
 * Extracted verbatim from `./service` (04A-D9 / 04C-D13 carry, mechanical
 * split in Slice 04D). It runs against the owning `ThreadGroupService`
 * instance passed as the first argument, so every replay/context/repository
 * helper stays single-sourced on the service. The public
 * `ThreadGroupService` surface (`performAction`, `listGroupMembers`,
 * `openMemberInSide`) is unchanged.
 */

const repository = require('./repository');
const { canonicalTargetHash } = require('./action-identity');
const { isBoundedId } = require('./application-link');
const {
  buildPlacementOutboxKey,
  materializeMemberPlacement,
} = require('./placement-delivery');
const { isChatCapableView } = require('./chat-capable-views');

/** Bounded display label for one member projection (`SPEC-04 §8`). */
const MAX_MEMBER_LABEL_BYTES = 256;

/** Bound an adapter-free member display label without leaking content. */
function boundedMemberLabel(thread) {
  const raw = thread?.entry?.name;
  if (typeof raw !== 'string' || !raw) return '';
  let label = raw;
  while (Buffer.byteLength(label, 'utf8') > MAX_MEMBER_LABEL_BYTES) {
    label = label.slice(0, -1);
  }
  return label;
}

/**
 * `thread:members` — the qualified ordered-member read for one validated
 * group (`SPEC-04 §8`). Workspace comes from the bound connection and the
 * server returns the group's authoritative nullable view. Every projection
 * is durable identities + a bounded display label + the current placement
 * disposition from the SPEC-03 managed-placement lane. It never returns
 * transcript content. Unknown/foreign groups fail inertly; a Legacy group
 * (null view) still returns its members with `placementDisposition:'absent'`
 * because it can carry no placement lane (recorded interpretation).
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function listGroupMembers(service, { threadGroupId = null } = {}) {
  const activation = await service.activate();
  if (!activation.ok) {
    return {
      ok: false,
      code: 'view_id_preflight_repair_required',
      diagnostics: activation.diagnostics,
    };
  }
  if (!isBoundedId(threadGroupId)) return { ok: false, code: 'not_found' };
  const db = service.db;
  const groupRow = await repository.getGroup(db, threadGroupId);
  if (!groupRow || groupRow.workspace_id !== service.workspaceId) {
    return { ok: false, code: 'not_found' };
  }
  const projection = await repository.getGroupProjection(db, threadGroupId);
  if (!projection) return { ok: false, code: 'not_found' };

  let placementEntry = null;
  if (projection.viewId) {
    try {
      const { getThreadWorksurface } = require('../view-state/thread-worksurface');
      const summary = await getThreadWorksurface(
        service.manager.projectRoot,
        projection.viewId,
        threadGroupId,
      );
      placementEntry = summary.entry;
    } catch (_error) {
      placementEntry = null;
    }
  }

  const memberRows = await repository.listMembers(db, threadGroupId);
  const members = [];
  for (const row of memberRows) {
    const thread = typeof service.manager.getThread === 'function'
      ? await service.manager.getThread(row.thread_id)
      : null;
    let placementDisposition = 'absent';
    if (projection.viewId && placementEntry) {
      const outbox = await repository.getPlacementOutboxByIdempotencyKey(
        db,
        buildPlacementOutboxKey({
          workspaceId: service.workspaceId,
          viewId: projection.viewId,
          threadGroupId,
          threadId: row.thread_id,
        }),
      );
      const record = outbox
        ? placementEntry.managedComponentPlacements?.[outbox.sideChatPlacementId]
        : null;
      if (record && record.disposition === 'closed') placementDisposition = 'closed';
      else if (record && record.disposition === 'open') placementDisposition = 'open';
    }
    members.push({
      threadId: row.thread_id,
      ordinal: Number(row.ordinal),
      isPrimary: row.thread_id === projection.currentPrimaryThreadId,
      createdAt: thread?.entry?.createdAt ?? row.joined_at ?? null,
      label: boundedMemberLabel(thread),
      placementDisposition,
    });
  }

  return {
    ok: true,
    result: {
      threadGroupId,
      workspaceId: service.workspaceId,
      viewId: projection.viewId ?? null,
      members,
    },
  };
}

/**
 * `open_member_in_side` — idempotent explicit access to one non-primary group
 * member's lifetime Side Chat (`SPEC-04 §8`, CHAT-I-027/029).
 *
 * It validates the group/member ownership and a non-null authoritative view,
 * then reopens (if closed) or focuses (if open) the member's existing
 * `sideChatPlacementId` through the placement coordinator. It creates no
 * session, primary event, MRU activity, or transcript effect, and a
 * `requestId` replay returns the recorded result and performs nothing twice.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function openMemberInSide(service, {
  threadGroupId = null, threadId = null, requestId = null, componentContext = null,
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
  const expected = { action: 'open_member_in_side', threadGroupId, threadId };
  const targetHash = canonicalTargetHash(expected);
  const replay = await service._replayIfPresent(requestId, expected);
  if (replay) return replay;

  const groupRow = await service._resolveOwnedGroup({ threadGroupId, threadId });
  if (!groupRow) return { ok: false, code: 'not_found' };
  const projection = await repository.getGroupProjection(service.db, groupRow.group_id);
  if (!projection) return { ok: false, code: 'not_found' };
  // The member must be a genuine non-primary peer of the group; the current
  // Main Chat is never the target of member access.
  const member = await repository.getMember(service.db, groupRow.group_id, threadId);
  if (!member) return { ok: false, code: 'not_found' };
  if (threadId === projection.currentPrimaryThreadId) {
    return { ok: false, code: 'not_found' };
  }
  // No placement is possible without a durable view binding; a disabled or
  // non-chat-capable component is rejected by the same capability set that
  // gates Move (SPEC-04 §6).
  if (!projection.viewId) return { ok: false, code: 'member_unavailable' };
  const viewTarget = service.resolveViewTarget(projection.viewId);
  if (!viewTarget.ok || !isChatCapableView(viewTarget.viewId)) {
    return { ok: false, code: 'view_not_supported' };
  }
  const outbox = await repository.getPlacementOutboxByIdempotencyKey(
    service.db,
    buildPlacementOutboxKey({
      workspaceId: service.workspaceId,
      viewId: projection.viewId,
      threadGroupId: projection.threadGroupId,
      threadId,
    }),
  );
  // A member with no lifetime placement (never moved) has nothing to reopen.
  if (!outbox) return { ok: false, code: 'member_unavailable' };

  const opened = await materializeMemberPlacement(service.db, {
    workspaceId: service.workspaceId,
    projectRoot: service.manager.projectRoot,
    record: outbox,
  });
  if (!opened.ok) {
    return { ok: false, code: opened.code || 'placement_unavailable' };
  }

  const result = {
    action: 'open_member_in_side',
    threadGroupId: projection.threadGroupId,
    threadId,
    workspaceId: projection.workspaceId,
    viewId: projection.viewId ?? null,
    sideChatPlacementId: opened.placementId,
    placementStatus: 'applied',
    focused: Boolean(opened.focused),
    context: service._context({
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      threadGroupId: projection.threadGroupId,
      threadId,
      componentContext,
    }),
  };
  await service._recordActionResult({
    action: 'open_member_in_side', requestId, targetHash, result,
  });
  return { ok: true, result, placement: { status: 'applied' } };
}

module.exports = {
  MAX_MEMBER_LABEL_BYTES,
  boundedMemberLabel,
  listGroupMembers,
  openMemberInSide,
};
