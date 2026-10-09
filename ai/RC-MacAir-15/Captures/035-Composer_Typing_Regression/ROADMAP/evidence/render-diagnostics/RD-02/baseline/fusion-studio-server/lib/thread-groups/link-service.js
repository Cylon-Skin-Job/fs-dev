'use strict';

/**
 * @module thread-groups/link-service
 * @role The canonical link operations: `copy_link`, `resolve_link`, and
 *       `view_markdown`.
 *
 * Extracted verbatim from `./service` (04A-D9 / 04C-D13 carry; the recorded
 * 04D-D4 split plan, mechanical split in Slice 05B). It runs against the
 * owning `ThreadGroupService` instance passed as the first argument, so every
 * replay/context/repository helper stays single-sourced on the service. The
 * public `ThreadGroupService` surface (`performAction`, `copyLink`,
 * `resolveLink`, `viewMarkdown`) is unchanged.
 */

const repository = require('./repository');
const { canonicalTargetHash } = require('./action-identity');
const { buildGroupLink, parseGroupLink } = require('./application-link');
const {
  buildPlacementOutboxKey,
  materializeMemberPlacement,
} = require('./placement-delivery');

/**
 * `copy_link` — group scope. Returns the versioned application URI for the
 * authoritative group with the validated sole/current member. SPEC-04
 * exclusively adds non-primary member link production (`CHAT-I-029`).
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function copyLink(service, {
  threadGroupId = null, threadId = null, requestId = null, componentContext = null,
} = {}) {
  const expected = { action: 'copy_link', threadGroupId, threadId };
  const targetHash = canonicalTargetHash(expected);
  const replay = await service._replayIfPresent(requestId, expected);
  if (replay) return replay;

  const groupRow = await service._resolveOwnedGroup({ threadGroupId, threadId });
  if (!groupRow) return { ok: false, code: 'not_found' };
  const projection = await repository.getGroupProjection(service.db, groupRow.group_id);
  if (!projection) return { ok: false, code: 'not_found' };

  // SPEC-04 §8 (`CHAT-I-029`): a link may name any validated member of the
  // group, not only the current primary. Group-only scope still targets the
  // authoritative current primary. The URI carries no placement authority.
  const memberThreadId = threadId || projection.currentPrimaryThreadId;
  const member = await repository.getMember(service.db, groupRow.group_id, memberThreadId);
  if (!member) return { ok: false, code: 'not_found' };

  const link = buildGroupLink({
    workspaceId: projection.workspaceId,
    threadGroupId: projection.threadGroupId,
    viewId: projection.viewId ?? null,
    threadId: memberThreadId,
  });
  if (!link) return { ok: false, code: 'not_found' };

  const result = {
    action: 'copy_link',
    threadGroupId: projection.threadGroupId,
    threadId: memberThreadId,
    workspaceId: projection.workspaceId,
    viewId: projection.viewId ?? null,
    link,
    context: service._context({
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      threadGroupId: projection.threadGroupId,
      threadId: memberThreadId,
      componentContext,
    }),
  };
  await service._recordActionResult({ action: 'copy_link', requestId, targetHash, result });
  return { ok: true, result };
}

/**
 * `resolve_link` — group or optional exact current-member target. Validates
 * the URI/ids and resolves to the authoritative group + current primary.
 * Opens Main Chat either way and applies no member-placement semantics, so
 * Legacy links resolve to the workspace Legacy host and never borrow the
 * active view (`SPEC-01 §9`, `CHAT-I-029`).
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function resolveLink(service, {
  threadGroupId = null, threadId = null, uri = null,
  requestId = null, componentContext = null,
} = {}) {
  const expected = {
    action: 'resolve_link', threadGroupId, threadId, uri: uri ?? null,
  };
  const targetHash = canonicalTargetHash(expected);
  const replay = await service._replayIfPresent(requestId, expected);
  if (replay) return replay;

  let resolvedWorkspaceId = null;
  let resolvedGroupId = threadGroupId;
  let resolvedViewId = undefined;
  let resolvedMemberId = threadId;
  if (uri !== null && uri !== undefined) {
    const parsed = parseGroupLink(uri);
    if (!parsed) return { ok: false, code: 'invalid_link' };
    resolvedWorkspaceId = parsed.workspaceId;
    // The URI is only ever resolved inside the bound workspace; it is never
    // authority to switch workspaces.
    if (resolvedWorkspaceId !== service.workspaceId) return { ok: false, code: 'not_found' };
    resolvedGroupId = parsed.threadGroupId;
    resolvedViewId = parsed.viewId;
    resolvedMemberId = parsed.threadId;
  }

  const groupRow = resolvedGroupId
    ? await repository.getGroup(service.db, resolvedGroupId)
    : (resolvedMemberId
      ? await repository.getGroupForThread(service.db, resolvedMemberId)
      : null);
  if (!groupRow || groupRow.workspace_id !== service.workspaceId) {
    return { ok: false, code: 'not_found' };
  }
  const projection = await repository.getGroupProjection(service.db, groupRow.group_id);
  if (!projection) return { ok: false, code: 'not_found' };

  // A URI's encoded view must match the authoritative group binding; a stale
  // or foreign view never retargets the link, and Legacy is the explicit
  // null-view population.
  if (uri !== null && uri !== undefined && (resolvedViewId ?? null) !== (projection.viewId ?? null)) {
    return { ok: false, code: 'not_found' };
  }
  // SPEC-04 §8: an optional exact member must belong to the group. When it
  // is a non-primary member with a lifetime placement, resolution reopens/
  // focuses that member's Side Chat through the placement coordinator without
  // promoting it or advancing MRU. A group-only URI (or the current primary)
  // continues to open the authoritative Main Chat.
  let targetMemberThreadId = null;
  let sideChatPlacementId = null;
  let placementStatus = null;
  if (resolvedMemberId) {
    const member = await repository.getMember(service.db, groupRow.group_id, resolvedMemberId);
    if (!member) return { ok: false, code: 'not_found' };
    if (resolvedMemberId !== projection.currentPrimaryThreadId) {
      if (!projection.viewId) return { ok: false, code: 'not_found' };
      const outbox = await repository.getPlacementOutboxByIdempotencyKey(
        service.db,
        buildPlacementOutboxKey({
          workspaceId: service.workspaceId,
          viewId: projection.viewId,
          threadGroupId: projection.threadGroupId,
          threadId: resolvedMemberId,
        }),
      );
      if (!outbox) return { ok: false, code: 'member_unavailable' };
      const opened = await materializeMemberPlacement(service.db, {
        workspaceId: service.workspaceId,
        projectRoot: service.projectRoot,
        record: outbox,
      });
      if (!opened.ok) return { ok: false, code: opened.code };
      targetMemberThreadId = resolvedMemberId;
      sideChatPlacementId = opened.placementId;
      placementStatus = 'applied';
    }
  }

  const result = {
    action: 'resolve_link',
    threadGroupId: projection.threadGroupId,
    threadId: projection.currentPrimaryThreadId,
    workspaceId: projection.workspaceId,
    viewId: projection.viewId ?? null,
    resolved: true,
    ...(targetMemberThreadId ? { targetMemberThreadId } : {}),
    ...(sideChatPlacementId ? { sideChatPlacementId } : {}),
    ...(placementStatus ? { placementStatus } : {}),
    context: service._context({
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      threadGroupId: projection.threadGroupId,
      threadId: projection.currentPrimaryThreadId,
      componentContext,
    }),
  };
  await service._recordActionResult({ action: 'resolve_link', requestId, targetHash, result });
  return { ok: true, result };
}

/**
 * `view_markdown` — exact member. Returns the validated exact-member mirror
 * path resolved through ThreadManager's canonical
 * `Data/Chatlogs/threads/<threadId>.md` owner; never an arbitrary path.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function viewMarkdown(service, {
  threadGroupId = null, threadId = null, requestId = null, componentContext = null,
} = {}) {
  const expected = { action: 'view_markdown', threadGroupId, threadId };
  const targetHash = canonicalTargetHash(expected);
  const replay = await service._replayIfPresent(requestId, expected);
  if (replay) return replay;

  const groupRow = await service._resolveOwnedGroup({ threadGroupId, threadId });
  if (!groupRow) return { ok: false, code: 'not_found' };
  const projection = await repository.getGroupProjection(service.db, groupRow.group_id);
  if (!projection) return { ok: false, code: 'not_found' };

  const memberThreadId = threadId || projection.currentPrimaryThreadId;
  const member = await repository.getMember(service.db, groupRow.group_id, memberThreadId);
  if (!member) return { ok: false, code: 'not_found' };

  const thread = typeof service.operations.getThread === 'function'
    ? await service.operations.getThread(memberThreadId)
    : null;
  if (!thread || typeof thread.filePath !== 'string' || !thread.filePath) {
    return { ok: false, code: 'not_found' };
  }

  const result = {
    action: 'view_markdown',
    threadGroupId: projection.threadGroupId,
    threadId: memberThreadId,
    workspaceId: projection.workspaceId,
    viewId: projection.viewId ?? null,
    markdownPath: thread.filePath,
    context: service._context({
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      threadGroupId: projection.threadGroupId,
      threadId: memberThreadId,
      componentContext,
    }),
  };
  await service._recordActionResult({ action: 'view_markdown', requestId, targetHash, result });
  return { ok: true, result };
}

module.exports = {
  copyLink,
  resolveLink,
  viewMarkdown,
};
