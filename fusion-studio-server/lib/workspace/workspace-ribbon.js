/**
 * workspace-ribbon — workspace ribbon membership and ordering handlers.
 *
 * The workspace controller owns active workspace lifecycle state. This module
 * owns the focused ribbon mutations and reports active workspace changes back
 * through injected callbacks.
 */

function createWorkspaceRibbonHandlers({
  registry,
  stateCache,
  emit,
  getActiveWorkspaceId,
  setActiveWorkspace,
  writeLastActive,
}) {
  async function handleRibbonRemoveRequested(event) {
    const { workspaceId } = event;
    const target = await registry.getById(workspaceId);
    if (!target) {
      console.warn('[WorkspaceController] ribbon_remove_requested: unknown workspace (' + workspaceId + ')');
      return;
    }

    const activeWorkspaceId = getActiveWorkspaceId();
    const registered = await registry.list();
    const ribbonWorkspaces = toRibbonWorkspaces(registered);
    const wasActive = workspaceId === activeWorkspaceId;
    const from = activeWorkspaceId;
    let next = null;

    if (wasActive) {
      next = pickNextRibbonWorkspace(ribbonWorkspaces, workspaceId);
    }

    await registry.updateRibbonVisibility(workspaceId, false);
    emit('workspace:registry_changed', { workspaces: await registry.list() });

    if (!wasActive) {
      stateCache.invalidate(workspaceId);
      emit('workspace:ribbon_removed', { workspaceId });
      return;
    }

    const nextId = next ? next.id : null;
    setActiveWorkspace(nextId, next);
    await writeLastActive(nextId);
    emit('workspace:switched', {
      from,
      to: nextId,
      repoPath: next ? next.repo_path : null,
    });
    stateCache.invalidate(workspaceId);
    emit('workspace:ribbon_removed', { workspaceId });
  }

  async function handleRibbonAddRequested(event) {
    const { workspaceId } = event;
    const target = await registry.getById(workspaceId);
    if (!target) {
      console.warn('[WorkspaceController] ribbon_add_requested: unknown workspace (' + workspaceId + ')');
      return;
    }

    if (target.ribbonVisible !== false) {
      return;
    }

    const nextRibbonSortOrder = (await registry.maxRibbonSortOrder()) + 1;
    await registry.updateRibbonMembership(workspaceId, {
      visible: true,
      ribbonSortOrder: nextRibbonSortOrder,
    });

    const workspaces = await registry.list();
    emit('workspace:registry_changed', { workspaces });

    if (getActiveWorkspaceId() !== null) {
      return;
    }

    const restored =
      workspaces.find((workspace) => workspace.id === workspaceId) ||
      await registry.getById(workspaceId);
    setActiveWorkspace(workspaceId, restored);
    await writeLastActive(workspaceId);
    emit('workspace:switched', {
      from: null,
      to: workspaceId,
      repoPath: restored ? restored.repo_path : null,
    });
  }

  async function handleRibbonReorderRequested(event) {
    const { workspaceIds, connectionId } = event;
    if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) {
      rejectRibbonReorder(connectionId, 'Ribbon reorder requires workspaceIds.');
      return;
    }

    const uniqueIds = new Set(workspaceIds);
    if (uniqueIds.size !== workspaceIds.length || workspaceIds.some((id) => typeof id !== 'string' || id.trim() === '')) {
      rejectRibbonReorder(connectionId, 'Ribbon reorder workspaceIds must be unique non-empty strings.');
      return;
    }

    const registered = await registry.list();
    const currentRibbonIds = toRibbonWorkspaces(registered).map((workspace) => workspace.id);
    const currentRibbonIdSet = new Set(currentRibbonIds);

    if (workspaceIds.length !== currentRibbonIds.length || workspaceIds.some((id) => !currentRibbonIdSet.has(id))) {
      rejectRibbonReorder(connectionId, 'Ribbon reorder must include exactly the currently visible ribbon workspaces.');
      return;
    }

    await registry.updateRibbonSortOrders(workspaceIds);
    emit('workspace:registry_changed', { workspaces: await registry.list() });
  }

  function rejectRibbonReorder(connectionId, message) {
    console.warn('[WorkspaceController] ribbon_reorder_requested rejected: ' + message);
    emit('workspace:ribbon_reorder_rejected', { connectionId, message });
  }

  return {
    handleRibbonRemoveRequested,
    handleRibbonAddRequested,
    handleRibbonReorderRequested,
  };
}

function toRibbonWorkspaces(workspaces) {
  return workspaces
    .filter((workspace) => workspace.ribbonVisible !== false)
    .sort((a, b) => {
      const aOrder = a.ribbonSortOrder ?? a.sortOrder;
      const bOrder = b.ribbonSortOrder ?? b.sortOrder;
      return aOrder - bOrder;
    });
}

function pickNextRibbonWorkspace(ribbonWorkspaces, workspaceId) {
  const index = ribbonWorkspaces.findIndex((workspace) => workspace.id === workspaceId);
  if (index === -1) return null;

  const leftCount = index;
  const rightCount = ribbonWorkspaces.length - index - 1;
  if (leftCount === 0 && rightCount === 0) return null;

  if (rightCount >= leftCount) {
    return ribbonWorkspaces[index + 1] ?? null;
  }
  return ribbonWorkspaces[index - 1] ?? null;
}

module.exports = {
  createWorkspaceRibbonHandlers,
  toRibbonWorkspaces,
  pickNextRibbonWorkspace,
};
