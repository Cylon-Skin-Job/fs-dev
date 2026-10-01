/** Construct and compare exact runtime/resource identities. */
const path = require('path');
const SCOPE = 'project';

function getRuntimeKey(manager, threadId, workspaceEpoch) {
  return Object.freeze({
    workspaceId: manager.workspaceId,
    projectRoot: manager.projectRoot,
    workspaceEpoch,
    scope: SCOPE,
    threadId,
  });
}


function normalizeRuntimeRoot(key) {
  return typeof key?.projectRoot === 'string' && key.projectRoot
    ? path.resolve(key.projectRoot) : `legacy-root:${key?.workspaceId}`;
}
function serializeRuntimeKey(key) {
  if (!key?.workspaceId || !key?.threadId) throw new Error('Thread runtime key requires workspaceId and threadId');
  if (key.scope !== 'project') throw new Error(`Unsupported thread runtime scope: ${key.scope}`);
  const root = normalizeRuntimeRoot(key);
  const epoch = typeof key.workspaceEpoch === 'string' && key.workspaceEpoch
    ? key.workspaceEpoch : `legacy-epoch:${root}`;
  return JSON.stringify(['project', key.workspaceId, root, epoch, key.threadId]);
}
function sameRuntimeResource(left, right) {
  return left.workspaceId === right?.workspaceId && left.threadId === right?.threadId
    && normalizeRuntimeRoot(left) === normalizeRuntimeRoot(right);
}

module.exports = { getRuntimeKey, serializeRuntimeKey, sameRuntimeResource, normalizeRuntimeRoot };
