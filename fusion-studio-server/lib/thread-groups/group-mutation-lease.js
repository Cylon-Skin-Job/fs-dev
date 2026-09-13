'use strict';

/**
 * @module thread-groups/group-mutation-lease
 * @role Per-group exclusive mutation serialization for the Thread Group domain.
 *
 * One group lease serializes every durable group mutation (Rename/Delete now;
 * Move in SPEC-04) so a Delete cannot interleave with a peer mutation on the
 * same group (`CHAT-I-021`). This is deliberately NOT a runtime model: the
 * runtime generation/fence owners remain `threadRuntimeManager`,
 * `thread-runtime-controller`, `session-manager`, and
 * `ThreadWebSocketHandler`. The lease only orders group-scoped operations.
 */

const tails = new Map();

function groupMutationLeaseKey(workspaceId, groupId) {
  return `${workspaceId}\u0000${groupId}`;
}

/**
 * Run `operation` after every previously admitted operation for the same
 * group key settles. Rejections do not poison the chain.
 *
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} operation
 * @returns {Promise<T>}
 */
function withGroupMutationLease(key, operation) {
  const previous = tails.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  tails.set(key, current);
  return current.finally(() => {
    if (tails.get(key) === current) tails.delete(key);
  });
}

module.exports = { groupMutationLeaseKey, withGroupMutationLease };
