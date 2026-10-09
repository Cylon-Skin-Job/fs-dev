'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-thread-group-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, closeDb, getDb } = require('../../lib/db');
const { ThreadManager } = require('../../lib/thread/ThreadManager');
const { runStableViewIdPreflight } = require('../../lib/views/stable-view-id-preflight');

const MACHINE = 'Fixture-Machine';
const WORKSPACE_ID = 'workspace-thread-groups';

function writeCapsule(root, folderName, viewId) {
  const capsule = path.join(root, 'ai', MACHINE, 'System', 'Views', folderName);
  fs.mkdirSync(path.join(capsule, 'state'), { recursive: true });
  const lines = ['---', 'name: Capsule', 'metadata:'];
  if (viewId !== undefined) lines.push(`  view-id: ${viewId}`);
  lines.push('---', '');
  fs.writeFileSync(path.join(capsule, 'manifest.md'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(capsule, 'state', 'state.json'), '{}\n', 'utf8');
}

describe('thread group lifecycle', () => {
  let projectRoot;
  let previousMachine;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-thread-group-workspace-'));
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

  function makeManager() {
    return new ThreadManager({ projectRoot, workspaceId: WORKSPACE_ID });
  }

  test('creation commits session, group, member, primary, activity, and mirror recovery together', async () => {
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', {
      harnessId: 'opencode', groupId: 'tg-1',
    });
    const db = getDb();

    const groups = await db('thread_groups');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      group_id: 'tg-1',
      workspace_id: WORKSPACE_ID,
      view_id: null,
      current_primary_thread_id: 't-1',
      name: 'Alpha',
    });
    expect(await db('thread_group_members')).toHaveLength(1);
    expect(await db('thread_group_primary_events')).toHaveLength(1);
    expect(await db('thread_group_activity_events').where({ event_key: 'initial:tg-1' })).toHaveLength(1);
    const recovery = await db('thread_group_mirror_recovery').first();
    expect(recovery).toMatchObject({ operation: 'create', status: 'complete', mirror_key: 'chatlog:t-1' });

    const listed = await manager.listGroups(null);
    expect(listed.groups).toHaveLength(1);
    expect(listed.groups[0]).toMatchObject({
      threadGroupId: 'tg-1',
      currentPrimaryThreadId: 't-1',
      memberCount: 1,
      currentPrimarySequence: 1,
      viewId: null,
    });
  });

  test.each([
    'threads', 'thread_groups', 'thread_group_members', 'thread_group_primary_events',
    'thread_group_activity_events', 'thread_group_mirror_recovery', 'thread_group_action_results',
  ])('creation rolls back every row when %s insert fails', async (table) => {
    const db = getDb();
    await db.raw(`CREATE TEMP TRIGGER fail_insert BEFORE INSERT ON ${table}
      BEGIN SELECT RAISE(ABORT, 'injected creation failure'); END`);
    const manager = makeManager();
    await expect(manager.createThread('fault-session', 'Fault', {
      groupId: 'fault-group', requestId: 'fault-request', action: 'create',
    })).rejects.toMatchObject({ message: expect.stringContaining('injected creation failure') });
    for (const name of ['threads', 'thread_groups', 'thread_group_members',
      'thread_group_primary_events', 'thread_group_activity_events',
      'thread_group_mirror_recovery', 'thread_group_action_results']) {
      expect(await db(name)).toHaveLength(0);
    }
    expect(fs.existsSync(manager._createChatFile('fault-session').filePath)).toBe(false);
  });

  test.each(['activate', 'resume'])('failed %s metadata leaves a suspended durable row and no provider owner', async (step) => {
    const manager = makeManager();
    await manager.createThread('activation-session', 'Cold', { groupId: 'activation-group' });
    const db = getDb();
    const beforeGroup = await db('thread_groups').first();
    const clause = step === 'activate' ? "status ON threads WHEN NEW.status = 'active'" : 'resumed_at ON threads';
    await db.raw(`CREATE TEMP TRIGGER fail_activation BEFORE UPDATE OF ${clause}
      BEGIN SELECT RAISE(ABORT, 'injected activation failure'); END`);
    const { EventEmitter } = require('events');
    const wire = new EventEmitter();
    wire.killed = false;
    wire.kill = jest.fn((signal) => {
      wire.killed = true;
      queueMicrotask(() => wire.emit('close', null, signal));
    });
    await expect(manager.openSession('activation-session', wire, {}))
      .rejects.toMatchObject({ message: expect.stringContaining('injected activation failure') });
    expect(manager.getSession('activation-session')).toBeUndefined();
    expect(wire.kill).toHaveBeenCalledTimes(1);
    expect(await db('threads').first()).toMatchObject({ status: 'suspended', resumed_at: null });
    expect((await db('thread_groups').first()).updated_at).toBe(beforeGroup.updated_at);
  });

  test.each(['journal', 'session', 'group'])('singleton deletion rolls back at %s failure', async (step) => {
    const manager = makeManager();
    await manager.createThread('delete-session', 'Retained', { groupId: 'delete-group' });
    const db = getDb();
    const table = { journal: 'thread_group_mirror_recovery', session: 'threads', group: 'thread_groups' }[step];
    const operation = step === 'journal' ? 'INSERT' : 'DELETE';
    await db.raw(`CREATE TEMP TRIGGER fail_delete BEFORE ${operation} ON ${table}
      BEGIN SELECT RAISE(ABORT, 'injected deletion failure'); END`);
    await expect(manager.deleteThread('delete-session')).rejects.toMatchObject({ message: expect.stringContaining('injected deletion failure') });
    expect(await db('threads')).toHaveLength(1);
    expect(await db('thread_groups')).toHaveLength(1);
    expect(await db('thread_group_members')).toHaveLength(1);
    expect(await db('thread_group_mirror_recovery').where({ operation: 'delete' })).toHaveLength(0);
    expect(fs.existsSync(manager._createChatFile('delete-session').filePath)).toBe(true);
  });

  test('duplicate concurrent create and singleton delete mutate exactly once', async () => {
    const manager = makeManager();
    const create = () => manager.createThread('same-session', 'Same', { groupId: 'same-group' });
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await getDb()('threads')).toHaveLength(1);
    expect(await getDb()('thread_groups')).toHaveLength(1);
    expect(await getDb()('thread_group_activity_events')).toHaveLength(1);
    const deleted = await Promise.all([manager.deleteThread('same-session'), manager.deleteThread('same-session')]);
    expect(deleted.sort()).toEqual([false, true]);
    expect(await getDb()('threads')).toHaveLength(0);
    expect(await getDb()('thread_groups')).toHaveLength(0);
    expect(await getDb()('thread_group_mirror_recovery').where({ operation: 'delete' })).toHaveLength(1);
  });

  test('resolveOpenTarget resolves the group, verifies membership, and never invents a replacement', async () => {
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', { groupId: 'tg-1' });

    const byGroup = await manager.threadGroups.resolveOpenTarget({ threadGroupId: 'tg-1' });
    expect(byGroup.target.threadId).toBe('t-1');
    const byThread = await manager.threadGroups.resolveOpenTarget({ threadId: 't-1' });
    expect(byThread.target.projection.threadGroupId).toBe('tg-1');
    const unknownGroup = await manager.threadGroups.resolveOpenTarget({ threadGroupId: 'tg-missing' });
    expect(unknownGroup.target).toBeNull();
    const notMember = await manager.threadGroups.resolveOpenTarget({ threadGroupId: 'tg-1', threadId: 't-other' });
    expect(notMember.target).toBeNull();
    expect(await getDb()('threads')).toHaveLength(1);
  });

  test('reconciles a pre-existing ungrouped session and is restart-safe', async () => {
    const db = getDb();
    await db('threads').insert({
      thread_id: 't-legacy', workspace_id: WORKSPACE_ID, project_id: 'w', scope: 'project',
      view_id: null, name: 'Legacy', created_at: new Date(1000).toISOString(),
      message_count: 0, status: 'suspended', updated_at: 1000, harness_id: 'opencode',
      harness_config: null,
    });

    const manager = makeManager();
    const listed = await manager.listGroups(null);
    expect(listed.groups.map((row) => row.threadGroupId)).toEqual(['t-legacy']);

    // A second manager (fresh window / restart) hydrates the same durable state.
    const secondWindow = makeManager();
    const secondList = await secondWindow.listGroups(null);
    expect(secondList.groups.map((row) => row.threadGroupId)).toEqual(['t-legacy']);
    expect(await db('thread_group_members').where({ thread_id: 't-legacy' })).toHaveLength(1);
  });

  test('rename changes the title without advancing the visible MRU clock', async () => {
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', { groupId: 'tg-1' });
    const before = (await getDb()('thread_groups').where({ group_id: 'tg-1' }).first()).updated_at;
    await new Promise((resolve) => setTimeout(resolve, 3));
    await manager.renameThread('t-1', 'Renamed');
    const after = await getDb()('thread_groups').where({ group_id: 'tg-1' }).first();
    expect(after.name).toBe('Renamed');
    expect(after.updated_at).toBe(before);
  });

  test('delete retires the group, session, and mirror without orphaning the group', async () => {
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', { groupId: 'tg-1' });
    const db = getDb();
    expect(await db('thread_groups')).toHaveLength(1);

    await expect(manager.deleteThread('t-1')).resolves.toBe(true);
    expect(await db('thread_groups')).toHaveLength(0);
    expect(await db('thread_group_members')).toHaveLength(0);
    expect(await db('threads').where({ thread_id: 't-1' })).toHaveLength(0);
    const listed = await manager.listGroups(null);
    expect(listed.groups).toHaveLength(0);
  });

  test('retries a pending mirror instruction after a simulated crash', async () => {
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', { groupId: 'tg-1' });
    const db = getDb();
    await db('thread_group_mirror_recovery')
      .where({ mirror_key: 'chatlog:t-1', operation: 'create' })
      .update({ status: 'failed', failure_code: 'mirror_write_failed' });

    await manager._retryPendingMirrorRecovery();
    const recovery = await db('thread_group_mirror_recovery')
      .where({ mirror_key: 'chatlog:t-1', operation: 'create' })
      .first();
    expect(recovery.status).toBe('complete');
    expect(recovery.failure_code).toBeNull();
  });

  test('stable view-ID preflight assigns a missing ID and activation succeeds', async () => {
    writeCapsule(projectRoot, '001-capture-viewer', undefined);
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', { groupId: 'tg-1' });
    const listed = await manager.listGroups(null);
    expect(listed.ok).toBe(true);

    const manifest = fs.readFileSync(
      path.join(projectRoot, 'ai', MACHINE, 'System', 'Views', '001-capture-viewer', 'manifest.md'),
      'utf8',
    );
    expect(manifest).toMatch(/view-id:\s*"view-[0-9a-f-]{36}"/);
  });

  test('stable view-ID preflight duplicate stops group-backed activation', async () => {
    writeCapsule(projectRoot, '001-one', 'dup-viewer');
    writeCapsule(projectRoot, '002-two', 'dup-viewer');
    const manager = makeManager();
    const listed = await manager.listGroups(null);
    expect(listed.ok).toBe(false);
    expect(listed.diagnostics.some((entry) => /Duplicate metadata\.view-id/.test(entry.message))).toBe(true);
  });

  test('stable view-ID preflight invalid-present ID stops group-backed activation', async () => {
    writeCapsule(projectRoot, '001-bad', 'Bad_ID');
    const manager = makeManager();
    await manager.createThread('t-1', 'Alpha', { groupId: 'tg-1' });
    const listed = await manager.listGroups(null);
    expect(listed.ok).toBe(false);
    expect(listed.diagnostics.some((entry) => /Invalid metadata\.view-id/.test(entry.message))).toBe(true);
    // No group binding is visible while preflight is stopped.
    expect(listed.groups).toBeUndefined();
  });

  test('registry resolves a retained exact view binding only when it exists', async () => {
    writeCapsule(projectRoot, '001-capture-viewer', 'capture-viewer');
    const db = getDb();
    await db('threads').insert([
      {
        thread_id: 't-known', workspace_id: WORKSPACE_ID, project_id: 'w', scope: 'project',
        view_id: 'capture-viewer', name: 'Known', created_at: new Date(1000).toISOString(),
        message_count: 0, status: 'suspended', updated_at: 2000, harness_id: 'opencode',
        harness_config: null,
      },
      {
        thread_id: 't-unknown', workspace_id: WORKSPACE_ID, project_id: 'w', scope: 'project',
        view_id: 'missing-view', name: 'Unknown', created_at: new Date(1000).toISOString(),
        message_count: 0, status: 'suspended', updated_at: 1000, harness_id: 'opencode',
        harness_config: null,
      },
    ]);

    const manager = makeManager();
    await manager.listGroups(null);
    const known = await db('thread_groups').where({ group_id: 't-known' }).first();
    const unknown = await db('thread_groups').where({ group_id: 't-unknown' }).first();
    expect(known.view_id).toBe('capture-viewer');
    expect(unknown.view_id).toBeNull();
  });

  test('preflight is a no-op when the Views root is absent', () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-no-views-'));
    const result = runStableViewIdPreflight(emptyRoot);
    expect(result.ok).toBe(true);
    expect(result.assigned).toEqual([]);
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  });
});
