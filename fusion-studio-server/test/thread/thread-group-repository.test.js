'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const knex = require('knex');

const repository = require('../../lib/thread-groups/repository');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');

function createDb() {
  const filename = path.join(
    os.tmpdir(),
    `fusion-tg-repo-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
  );
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection, done) {
        connection.pragma('foreign_keys = ON');
        done(null, connection);
      },
    },
    migrations: { directory: MIGRATIONS_DIRECTORY },
  });
  db._testFilename = filename;
  return db;
}

async function seedSession(db, threadId, name, updatedAt) {
  await db('threads').insert({
    thread_id: threadId,
    workspace_id: 'ws-1',
    project_id: 'w',
    scope: 'project',
    view_id: null,
    name,
    created_at: new Date(Math.max(0, updatedAt - 1000)).toISOString(),
    message_count: 0,
    status: 'suspended',
    updated_at: updatedAt,
    harness_id: 'opencode',
    harness_config: null,
  });
}

async function createLegacyGroup(db, groupId, threadId, name, updatedAt, viewId = null) {
  await seedSession(db, threadId, name, updatedAt);
  await db.transaction(async (trx) => {
    await repository.insertGroup(trx, {
      groupId, workspaceId: 'ws-1', viewId, name,
      currentPrimaryThreadId: threadId, createdAt: Math.max(0, updatedAt - 1000), updatedAt,
    });
    await repository.insertMember(trx, {
      groupId, threadId, ordinal: 1, originKind: 'initial', joinedAt: Math.max(0, updatedAt - 1000),
    });
    await repository.insertPrimaryEvent(trx, {
      groupId, sequence: 1, previousThreadId: null, nextThreadId: threadId,
      reason: 'initial', occurredAt: Math.max(0, updatedAt - 1000),
    });
    await repository.insertActivityEvent(trx, {
      eventKey: `initial:${groupId}`, groupId, threadId, turnId: null,
      kind: 'initial', occurredAt: Math.max(0, updatedAt - 1000),
    });
  });
}

describe('thread group repository', () => {
  let db;

  beforeEach(async () => {
    db = createDb();
    await db.migrate.latest();
    await db('workspaces').insert({
      id: 'ws-1', label: 'W', icon: 'folder', repo_path: '/tmp/w',
      sort_order: 1, type: 'code', ribbon_visible: 1, ribbon_sort_order: 1,
    });
  });

  afterEach(async () => {
    if (db) {
      const filename = db._testFilename;
      await db.destroy();
      if (filename) fs.rmSync(filename, { force: true });
      db = null;
    }
  });

  test('lists one exact population ordered by updated_at DESC, group_id ASC', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    await createLegacyGroup(db, 'g-b', 't-b', 'B', 300);
    await createLegacyGroup(db, 'g-c', 't-c', 'C', 300);

    const legacy = await repository.listGroupProjections(db, { workspaceId: 'ws-1', viewId: null });
    expect(legacy.map((row) => row.threadGroupId)).toEqual(['g-b', 'g-c', 'g-a']);
    expect(legacy[0]).toMatchObject({
      workspaceId: 'ws-1',
      viewId: null,
      currentPrimaryThreadId: 't-b',
      currentPrimarySequence: 1,
      memberCount: 1,
      updatedAt: 300,
    });
    expect(legacy[0].entry).toMatchObject({ name: 'B', status: 'suspended' });

    const viewBound = await repository.listGroupProjections(db, { workspaceId: 'ws-1', viewId: 'capture-viewer' });
    expect(viewBound).toEqual([]);
  });

  test('a session belongs to exactly one group', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    const duplicateMember = await db('thread_group_members').insert({
      group_id: 'g-a', thread_id: 't-a', ordinal: 2, origin_kind: 'initial', joined_at: 1,
    }).then(() => 'INSERTED').catch((error) => `rejected:${error.message}`);
    expect(duplicateMember).toMatch(/^rejected/);
    expect(duplicateMember).toMatch(/UNIQUE/i);
    expect(await repository.hasGroupForThread(db, 't-a')).toBe(true);
    expect(await repository.hasGroupForThread(db, 't-missing')).toBe(false);
  });

  test('resolves group ownership by thread and verifies members', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    const group = await repository.getGroupForThread(db, 't-a');
    expect(group.group_id).toBe('g-a');
    expect(await repository.getMember(db, 'g-a', 't-a')).toBeTruthy();
    expect(await repository.getMember(db, 'g-a', 't-x')).toBeUndefined();
  });

  test('activity insert is idempotent and MRU is explicit', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    const inserted = await repository.insertActivityEvent(db, {
      eventKey: 'initial:g-a', groupId: 'g-a', threadId: 't-a', turnId: null,
      kind: 'initial', occurredAt: 100,
    });
    expect(inserted).toBe(false);

    const promptInserted = await repository.insertActivityEvent(db, {
      eventKey: 'prompt:t-a:turn-1', groupId: 'g-a', threadId: 't-a', turnId: 'turn-1',
      kind: 'prompt-accepted', occurredAt: 200,
    });
    expect(promptInserted).toBe(true);
    await repository.advanceGroupUpdatedAt(db, 'g-a', 200);
    const group = await repository.getGroup(db, 'g-a');
    expect(group.updated_at).toBe(200);
  });

  test('rename updates the title without advancing the MRU clock', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    await repository.renameGroup(db, 'g-a', 'Renamed');
    const group = await repository.getGroup(db, 'g-a');
    expect(group.name).toBe('Renamed');
    expect(group.updated_at).toBe(100);
  });

  test('delete removes group, members, and events without a foreign-key violation', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    await expect(repository.deleteGroup(db, 'g-a')).resolves.toBe(1);
    await expect(db('thread_groups')).resolves.toHaveLength(0);
    await expect(db('thread_group_members')).resolves.toHaveLength(0);
    await expect(db('thread_group_primary_events')).resolves.toHaveLength(0);
    await expect(db('thread_group_activity_events')).resolves.toHaveLength(0);
  });

  test('stores durable action results keyed by workspace and request', async () => {
    await repository.insertActionResult(db, {
      workspaceId: 'ws-1', requestId: 'req-1', action: 'create',
      targetHash: 'g-a', resultJson: JSON.stringify({ ok: true }),
      createdAt: 1, updatedAt: 1,
    });
    const stored = await repository.getActionResult(db, 'ws-1', 'req-1');
    expect(stored).toMatchObject({ action: 'create', targetHash: 'g-a' });
    expect(JSON.parse(stored.resultJson)).toEqual({ ok: true });
    const duplicateResult = await db('thread_group_action_results').insert({
      workspace_id: 'ws-1', request_id: 'req-1', action: 'create', target_hash: 'x',
      result_json: '{}', created_at: 1, updated_at: 1,
    }).then(() => 'INSERTED').catch((error) => `rejected:${error.message}`);
    expect(duplicateResult).toMatch(/^rejected/);
    expect(duplicateResult).toMatch(/UNIQUE/i);
  });

  test('mirror recovery records transition pending to complete', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    await repository.insertMirrorRecovery(db, {
      workspaceId: 'ws-1', groupId: 'g-a', threadId: 't-a', mirrorKey: 'chatlog:t-a',
      operation: 'create', status: 'pending', createdAt: 1, updatedAt: 1,
    });
    await expect(repository.listPendingMirrorRecovery(db, 'ws-1')).resolves.toHaveLength(1);
    await repository.markMirrorRecovery(db, {
      workspaceId: 'ws-1', mirrorKey: 'chatlog:t-a', operation: 'create', status: 'complete', now: 2,
    });
    await expect(repository.listPendingMirrorRecovery(db, 'ws-1')).resolves.toHaveLength(0);
  });

  test('lists ungrouped sessions only', async () => {
    await createLegacyGroup(db, 'g-a', 't-a', 'A', 100);
    await seedSession(db, 't-ungrouped', 'U', 50);
    const rows = await repository.listThreadIdsWithoutGroup(db, 'ws-1');
    expect(rows.map((row) => row.thread_id)).toEqual(['t-ungrouped']);
  });
});
