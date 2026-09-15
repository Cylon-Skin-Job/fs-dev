'use strict';

/**
 * @module thread-groups/selection-service
 * @role The `set_harness_selection` exact-member operation.
 *
 * Extracted verbatim from `./service` (04A-D9 / 04C-D13 carry; the recorded
 * 04D-D4 split plan, mechanical split in Slice 05B). It runs against the
 * owning `ThreadGroupService` instance passed as the first argument, so every
 * replay/context/repository helper stays single-sourced on the service. The
 * public `ThreadGroupService` surface (`performAction`, `setHarnessSelection`)
 * is unchanged.
 */

const repository = require('./repository');
const { canonicalTargetHash } = require('./action-identity');
const { resolveCliPolicy } = require('../cli-config');
const { validatePortableSelection } = require('../thread/thread-harness-config-policy');

/**
 * `set_harness_selection` — exact member. Accepts only portable
 * `{model, variant}`, validates both against the current server-owned policy,
 * and never accepts or changes the harness binding (`CHAT-I-026/031`). The
 * harness id is read only from server-owned session state. A rejection
 * leaves the prior value authoritative.
 *
 * @param {object} service owning `ThreadGroupService`
 * @param {object} params
 */
async function setHarnessSelection(service, {
  threadGroupId = null, threadId = null, model = null, variant = null,
  requestId = null, componentContext = null,
} = {}) {
  const expected = {
    action: 'set_harness_selection', threadGroupId, threadId, model, variant,
  };
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

  const thread = typeof service.manager.getThread === 'function'
    ? await service.manager.getThread(memberThreadId)
    : null;
  const harnessId = thread?.entry?.harnessId;
  if (!thread || !harnessId) return { ok: false, code: 'not_found' };

  let policy;
  try {
    policy = await resolveCliPolicy(service.manager.projectRoot);
  } catch (_error) {
    return { ok: false, code: 'selection_unavailable' };
  }
  const models = policy?.config?.[harnessId]?.models ?? null;
  const selection = validatePortableSelection({ models, model, variant });
  if (!selection.ok) return { ok: false, code: selection.code };

  if (typeof service.manager.updateHarnessConfig !== 'function') {
    return { ok: false, code: 'selection_unavailable' };
  }
  await service.manager.updateHarnessConfig(memberThreadId, {
    model: selection.model,
    variant: selection.variant,
  });
  const acknowledged = await service.manager.getThread(memberThreadId);
  const acknowledgedConfig = acknowledged?.entry?.harnessConfig ?? {};

  const result = {
    action: 'set_harness_selection',
    threadGroupId: projection.threadGroupId,
    threadId: memberThreadId,
    workspaceId: projection.workspaceId,
    viewId: projection.viewId ?? null,
    harnessId,
    model: acknowledgedConfig.model ?? selection.model,
    variant: acknowledgedConfig.variant === undefined ? selection.variant : acknowledgedConfig.variant,
    context: service._context({
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      threadGroupId: projection.threadGroupId,
      threadId: memberThreadId,
      componentContext,
    }),
  };
  await service._recordActionResult({
    action: 'set_harness_selection', requestId, targetHash, result,
  });
  return { ok: true, result };
}

module.exports = {
  setHarnessSelection,
};
