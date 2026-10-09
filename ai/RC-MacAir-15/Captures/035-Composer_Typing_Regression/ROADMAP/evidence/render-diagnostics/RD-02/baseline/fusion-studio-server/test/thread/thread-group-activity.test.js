'use strict';

/**
 * SPEC-01 §5.4/§7 prompt-accepted activity and group MRU.
 *
 * Real ThreadManager + real Thread Group service over a temporary SQLite
 * database: the prompt-accepted activity and the group `updated_at` advance are
 * one idempotent transaction, and no passive/open/warm path may advance the
 * visible-list MRU clock.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-tg-activity-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, closeDb, getDb } = require('../../lib/db');
const { ThreadManager } = require('../../lib/thread/ThreadManager');

const MACHINE = 'Fixture-Machine';
const WORKSPACE_ID = 'workspace-activity';

function makeManager(projectRoot) {
  return new ThreadManager({ projectRoot, workspaceId: WORKSPACE_ID });
}

describe('thread group prompt activity and MRU', () => {
  let projectRoot;
  let previousMachine;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-tg-activity-ws-'));
    fs.mkdirSync(path.join(projectRoot, 'ai', MACHINE, 'System', 'Views'), { recursive: true });
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (previousUserDataDir === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousUserDataDir;
  });

  async function groupRow(groupId) {
    return getDb()('thread_groups').where({ group_id: groupId }).first();
  }

  test('one accepted prompt writes one activity row and advances the group clock once', async () => {
    const manager = makeManager(projectRoot);
    await manager.createThread('t-1', 'Alpha', { harnessId: 'opencode', groupId: 'tg-1' });
    const before = (await groupRow('tg-1')).updated_at;

    await new Promise((resolve) => setTimeout(resolve, 3));
    const accepted = await manager.threadGroups.recordPromptAccepted({
      threadId: 't-1', turnId: 'turn-1',
    });
    expect(accepted).toMatchObject({ ok: true, advanced: true });

    const db = getDb();
    expect(await db('thread_group_activity_events').where({ event_key: 'prompt:t-1:turn-1' })).toHaveLength(1);
    expect((await groupRow('tg-1')).updated_at).toBeGreaterThan(before);
  });

  test('a retry of the same thread/turn never advances MRU twice', async () => {
    const manager = makeManager(projectRoot);
    await manager.createThread('t-1', 'Alpha', { harnessId: 'opencode', groupId: 'tg-1' });

    const first = await manager.threadGroups.recordPromptAccepted({ threadId: 't-1', turnId: 'turn-1' });
    const afterFirst = (await groupRow('tg-1')).updated_at;
    await new Promise((resolve) => setTimeout(resolve, 3));
    const retry = await manager.threadGroups.recordPromptAccepted({ threadId: 't-1', turnId: 'turn-1' });

    expect(first.advanced).toBe(true);
    expect(retry).toMatchObject({ ok: true, advanced: false });
    expect((await groupRow('tg-1')).updated_at).toBe(afterFirst);
    expect(await getDb()('thread_group_activity_events').where({ event_key: 'prompt:t-1:turn-1' })).toHaveLength(1);
  });

  test('concurrent retries of the same thread/turn converge on one advance', async () => {
    const manager = makeManager(projectRoot);
    await manager.createThread('t-1', 'Alpha', { harnessId: 'opencode', groupId: 'tg-1' });

    const results = await Promise.all([
      manager.threadGroups.recordPromptAccepted({ threadId: 't-1', turnId: 'turn-1' }),
      manager.threadGroups.recordPromptAccepted({ threadId: 't-1', turnId: 'turn-1' }),
    ]);
    expect(results.filter((entry) => entry.advanced).length).toBe(1);
    expect(await getDb()('thread_group_activity_events').where({ event_key: 'prompt:t-1:turn-1' })).toHaveLength(1);
  });

  test('distinct accepted turns advance MRU monotonically and reorder the population', async () => {
    const manager = makeManager(projectRoot);
    await manager.createThread('t-old', 'Old', { harnessId: 'opencode', groupId: 'tg-old' });
    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.createThread('t-new', 'New', { harnessId: 'opencode', groupId: 'tg-new' });

    let listed = await manager.listGroups(null);
    expect(listed.groups.map((row) => row.threadGroupId)).toEqual(['tg-new', 'tg-old']);

    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.threadGroups.recordPromptAccepted({ threadId: 't-old', turnId: 'turn-old' });
    listed = await manager.listGroups(null);
    expect(listed.groups.map((row) => row.threadGroupId)).toEqual(['tg-old', 'tg-new']);

    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.threadGroups.recordPromptAccepted({ threadId: 't-new', turnId: 'turn-new' });
    listed = await manager.listGroups(null);
    expect(listed.groups.map((row) => row.threadGroupId)).toEqual(['tg-new', 'tg-old']);
  });

  test('list/open/rename never advance the group clock', async () => {
    const manager = makeManager(projectRoot);
    await manager.createThread('t-1', 'Alpha', { harnessId: 'opencode', groupId: 'tg-1' });
    const before = (await groupRow('tg-1')).updated_at;

    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.listGroups(null);
    await manager.threadGroups.resolveOpenTarget({ threadGroupId: 'tg-1' });
    await manager.renameThread('t-1', 'Renamed');

    expect((await groupRow('tg-1')).updated_at).toBe(before);
  });

  test('a prompt activity for an unknown session is rejected and never creates', async () => {
    const manager = makeManager(projectRoot);
    const result = await manager.threadGroups.recordPromptAccepted({
      threadId: 't-missing', turnId: 'turn-1',
    });
    expect(result).toMatchObject({ ok: false, code: 'not_found' });
    expect(await getDb()('thread_group_activity_events')).toHaveLength(0);
  });

  test('Legacy prompt activity advances the explicit null-view population deterministically', async () => {
    const manager = makeManager(projectRoot);
    // Legacy groups are the explicit `viewId: null` population.
    await manager.createThread('t-legacy', 'Legacy', { harnessId: 'opencode', groupId: 'tg-legacy' });
    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.createThread('t-other', 'Other', {
      harnessId: 'opencode', groupId: 'tg-other', viewId: null,
    });

    let listed = await manager.listGroups(null);
    expect(listed.groups.map((row) => row.threadGroupId)).toEqual(['tg-other', 'tg-legacy']);

    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.threadGroups.recordPromptAccepted({ threadId: 't-legacy', turnId: 'turn-legacy' });
    listed = await manager.listGroups(null);
    expect(listed.groups.map((row) => row.threadGroupId)).toEqual(['tg-legacy', 'tg-other']);
    expect(listed.groups[0].viewId).toBeNull();
  });

  test('activity inserts are bounded to the immutable thread/turn identity', async () => {
    const manager = makeManager(projectRoot);
    await manager.createThread('t-1', 'Alpha', { harnessId: 'opencode', groupId: 'tg-1' });
    const tooLong = 'x'.repeat(129);
    await expect(manager.threadGroups.recordPromptAccepted({
      threadId: 't-1', turnId: tooLong,
    })).resolves.toMatchObject({ ok: false, code: 'request_invalid' });
  });
});
