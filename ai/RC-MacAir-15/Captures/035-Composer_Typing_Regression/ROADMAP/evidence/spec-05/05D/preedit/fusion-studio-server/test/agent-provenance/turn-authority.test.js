'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  createAgentTurnAuthorityRef,
  getAgentTurnAuthorityRef,
  releaseAgentTurnAuthorityRef,
} = require('../../lib/agent-provenance/turn-authority');

describe('prompt-accepted agent turn authority', () => {
  let temporaryRoot;

  afterEach(async () => {
    if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
    temporaryRoot = null;
  });

  test('captures immutable server-resolved identity and the canonical root inode', async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fusion-agent-authority-'));
    const realRoot = path.join(temporaryRoot, 'real');
    const aliasRoot = path.join(temporaryRoot, 'alias');
    await fs.mkdir(realRoot);
    await fs.symlink(realRoot, aliasRoot);

    const authority = await createAgentTurnAuthorityRef({
      workspaceId: 'workspace-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      harnessId: 'opencode',
      provider: 'opencode',
      workspaceRoot: aliasRoot,
    });
    const canonicalRoot = await fs.realpath(realRoot);
    const stat = await fs.stat(canonicalRoot, { bigint: true });

    expect(Object.isFrozen(authority)).toBe(true);
    expect(authority).toEqual({
      workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-1',
      harnessId: 'opencode', provider: 'opencode', canonicalRoot,
      authorityRootSha256: crypto.createHash('sha256').update(canonicalRoot, 'utf8').digest('hex'),
      authorityRootDevice: stat.dev.toString(10), authorityRootInode: stat.ino.toString(10),
    });
    expect(() => { authority.threadId = 'thread-2'; }).toThrow(TypeError);
    expect(getAgentTurnAuthorityRef(authority)).toBe(authority);
    releaseAgentTurnAuthorityRef(authority);
    expect(getAgentTurnAuthorityRef(authority)).toBeNull();
  });
});
