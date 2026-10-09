'use strict';

/**
 * Per-connection workspace-operation lease.
 *
 * Privileged thread work and workspace binding share this queue. Whichever is
 * enqueued first owns the connection until its bounded admission completes:
 * an accepted thread mutation cannot be cut in half by a workspace switch,
 * and a mutation queued behind a bind must revalidate the new live binding
 * before it can reach an owner.
 */
const operationTails = new WeakMap();

class WorkspaceOperationLeaseError extends Error {
  constructor() {
    super('Workspace operation lease unavailable');
    this.name = 'WorkspaceOperationLeaseError';
    this.code = 'WORKSPACE_OPERATION_LEASE_UNAVAILABLE';
  }
}

function serializeWorkspaceOperation(ws, operation) {
  const previous = operationTails.get(ws) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  operationTails.set(ws, current);
  return current.finally(() => {
    if (operationTails.get(ws) === current) operationTails.delete(ws);
  });
}

function runWorkspaceOperation(ws, isCurrent, operation) {
  return serializeWorkspaceOperation(ws, async () => {
    if (!isCurrent()) throw new WorkspaceOperationLeaseError();
    return operation();
  });
}

function beginWorkspaceTransition(ws, begin) {
  return serializeWorkspaceOperation(ws, begin);
}

function isWorkspaceOperationLeaseError(error) {
  return error?.code === 'WORKSPACE_OPERATION_LEASE_UNAVAILABLE';
}

module.exports = {
  beginWorkspaceTransition,
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
};
