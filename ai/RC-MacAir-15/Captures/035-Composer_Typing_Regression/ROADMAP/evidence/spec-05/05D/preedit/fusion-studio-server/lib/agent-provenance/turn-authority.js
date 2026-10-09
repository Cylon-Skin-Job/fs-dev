'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const liveAuthorities = new Map();

function sha256Utf8(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function authorityKey(identity) {
  if (!identity || typeof identity !== 'object') return null;
  const { workspaceId, threadId, turnId } = identity;
  if (![workspaceId, threadId, turnId].every(value => typeof value === 'string' && value.length > 0)) return null;
  return JSON.stringify([workspaceId, threadId, turnId]);
}

function getAgentTurnAuthorityRef(identity) {
  const key = authorityKey(identity);
  return key ? liveAuthorities.get(key) || null : null;
}

function releaseAgentTurnAuthorityRef(authority) {
  const key = authorityKey(authority);
  if (key && liveAuthorities.get(key) === authority) liveAuthorities.delete(key);
}

async function createAgentTurnAuthorityRef({
  workspaceId,
  threadId,
  turnId,
  harnessId,
  provider,
  workspaceRoot,
}) {
  const canonicalRoot = await fs.realpath(path.resolve(workspaceRoot));
  const stat = await fs.stat(canonicalRoot, { bigint: true });
  const hasIdentity = stat.dev != null && stat.ino != null;
  const authority = Object.freeze({
    workspaceId,
    threadId,
    turnId,
    harnessId,
    provider,
    canonicalRoot,
    authorityRootSha256: sha256Utf8(canonicalRoot),
    authorityRootDevice: hasIdentity ? stat.dev.toString(10) : null,
    authorityRootInode: hasIdentity ? stat.ino.toString(10) : null,
  });
  liveAuthorities.set(authorityKey(authority), authority);
  return authority;
}

module.exports = {
  createAgentTurnAuthorityRef,
  getAgentTurnAuthorityRef,
  releaseAgentTurnAuthorityRef,
  sha256Utf8,
};
