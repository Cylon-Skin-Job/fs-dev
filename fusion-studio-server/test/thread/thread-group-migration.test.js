'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const knex = require('knex');

const migration = require('../../lib/db/migrations/041_thread_group_foundation');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');

function createDb() {
  // A unique on-disk temp database per instance keeps FK/UNIQUE behavior
  // deterministic even when several suite files share one Jest worker process.
  const filename = path.join(
    os.tmpdir(),
    `fusion-tg-mig-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
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

async function seedWorkspaceAndThreads(db) {
  await db('workspaces').insert({
    id: 'ws-1', label: 'W', icon: 'folder', repo_path: '/tmp/w',
    sort_order: 1, type: 'code', ribbon_visible: 1, ribbon_sort_order: 1,
  });
  const now = Date.now();
  await db('threads').insert([
    {
      thread_id: 't-keep', workspace_id: 'ws-1', project_id: 'w', scope: 'project',
      view_id: null, name: 'Keep', created_at: new Date(now - 2000).toISOString(),
      message_count: 3, status: 'suspended', updated_at: now - 1000, harness_id: 'opencode',
      harness_config: JSON.stringify({
        model: 'm', pendingFork: { status: 'pending' }, opencodeSessionId: 'source-session',
      }),
    },
    {
      thread_id: 't-retire-null', workspace_id: null, project_id: 'w', scope: 'project',
      view_id: null, name: 'RetireNull', created_at: new Date(now - 3000).toISOString(),
      message_count: 0, status: 'suspended', updated_at: now - 2000, harness_id: 'kimi',
      harness_config: null,
    },
    {
      thread_id: 't-retire-unregistered', workspace_id: 'ws-gone', project_id: 'w', scope: 'project',
      view_id: null, name: 'RetireUnregistered', created_at: new Date(now - 3000).toISOString(),
      message_count: 0, status: 'suspended', updated_at: now - 2000, harness_id: 'kimi',
      harness_config: null,
    },
  ]);
  await db('exchanges').insert({
    thread_id: 't-retire-null', seq: 1, ts: now, user_input: 'u',
    assistant: JSON.stringify({ parts: [] }), metadata: '{}',
  });
}

async function runDataSteps(db) {
  await db.transaction(async (trx) => {
    await migration._internal.backfillGroups(trx);
    await migration._internal.normalizeForkEraConfig(trx);
    await migration._internal.retireUnregisteredRows(trx);
  });
}

describe('migration 041 thread group foundation', () => {
  let db;

  afterEach(async () => {
    if (db) {
      const filename = db._testFilename;
      await db.destroy();
      if (filename) fs.rmSync(filename, { force: true });
      db = null;
    }
  });

  test('applies after the full current migration set on a fresh database', async () => {
    db = createDb();
    const [batch, migrations] = await db.migrate.latest();
    expect(batch).toBe(1);
    expect(migrations.at(-1)).toMatch(/044_thread_group_placement_outbox\.js$/);
    for (const table of [
      'thread_groups', 'thread_group_members', 'thread_group_primary_events',
      'thread_group_activity_events', 'thread_group_action_results',
      'thread_group_mirror_recovery', 'thread_group_delete_tombstones',
      'thread_group_worksurface_cleanup',
    ]) {
      await expect(db.schema.hasTable(table)).resolves.toBe(true);
    }
  });

  test('backfills one group/member/primary/activity per retained registered session', async () => {
    db = createDb();
    await db.migrate.latest();
    await seedWorkspaceAndThreads(db);
    await runDataSteps(db);

    const groups = await db('thread_groups').select('*');
    expect(groups.map((row) => row.group_id)).toEqual(['t-keep']);
    const group = groups[0];
    expect(group.workspace_id).toBe('ws-1');
    expect(group.view_id).toBeNull();
    expect(group.current_primary_thread_id).toBe('t-keep');
    expect(group.name).toBe('Keep');

    const members = await db('thread_group_members').select('*');
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      group_id: 't-keep', thread_id: 't-keep', ordinal: 1, origin_kind: 'initial',
    });

    const primary = await db('thread_group_primary_events').select('*');
    expect(primary).toHaveLength(1);
    expect(primary[0]).toMatchObject({
      group_id: 't-keep', sequence: 1, previous_thread_id: null,
      next_thread_id: 't-keep', reason: 'initial',
    });

    const activity = await db('thread_group_activity_events').select('*');
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      event_key: 'initial:t-keep', group_id: 't-keep', thread_id: 't-keep',
      turn_id: null, kind: 'initial',
    });
  });

  test('preserves session bytes and normalizes stored Fork-era harness config', async () => {
    db = createDb();
    await db.migrate.latest();
    await seedWorkspaceAndThreads(db);
    await runDataSteps(db);

    const thread = await db('threads').where({ thread_id: 't-keep' }).first();
    expect(thread.message_count).toBe(3);
    expect(thread.status).toBe('suspended');
    expect(thread.harness_id).toBe('opencode');
    const config = JSON.parse(thread.harness_config);
    expect(config).toEqual({ model: 'm' });
    expect(config.pendingFork).toBeUndefined();
    expect(config.forkProvenance).toBeUndefined();
    expect(config.opencodeSessionId).toBeUndefined();
  });

  test('retires only unregistered/null-workspace rows and records bounded evidence', async () => {
    db = createDb();
    await db.migrate.latest();
    await seedWorkspaceAndThreads(db);
    await runDataSteps(db);

    const remaining = await db('threads').pluck('thread_id');
    expect(remaining).toEqual(['t-keep']);
    await expect(db('exchanges').where({ thread_id: 't-retire-null' })).resolves.toHaveLength(0);

    const record = await db('system_config')
      .where({ key: migration.RETIREMENT_CONFIG_KEY })
      .first();
    const parsed = JSON.parse(record.value);
    expect(parsed.threadCount).toBe(2);
    expect(parsed.exchangeCount).toBe(1);
    expect(parsed.threadIds.sort()).toEqual(['t-retire-null', 't-retire-unregistered']);
  });

  test('re-running the data steps is idempotent', async () => {
    db = createDb();
    await db.migrate.latest();
    await seedWorkspaceAndThreads(db);
    await runDataSteps(db);
    await runDataSteps(db);

    await expect(db('thread_groups')).resolves.toHaveLength(1);
    await expect(db('thread_group_members')).resolves.toHaveLength(1);
    await expect(db('thread_group_primary_events')).resolves.toHaveLength(1);
    await expect(db('thread_group_activity_events')).resolves.toHaveLength(1);
  });

  test('deferred composite foreign key rejects a non-member primary and allows the atomic cyclic insert', async () => {
    db = createDb();
    await db.migrate.latest();
    await db('workspaces').insert({
      id: 'ws-1', label: 'W', icon: 'folder', repo_path: '/tmp/w',
      sort_order: 1, type: 'code', ribbon_visible: 1, ribbon_sort_order: 1,
    });

    // A committed nonempty group may never name a non-member primary.
    const result = await db('thread_groups').insert({
      group_id: 'g-bad', workspace_id: 'ws-1', view_id: null, name: null,
      current_primary_thread_id: 'not-a-member', created_at: 1, updated_at: 1,
    }).then(() => 'COMMITTED').catch((error) => `rejected:${error.message}`);
    expect(result).toMatch(/^rejected/);
    expect(result).toMatch(/FOREIGN KEY|CHECK constraint/i);

    // The intended cycle commits when group and member land together.
    await db.transaction(async (trx) => {
      await trx('thread_groups').insert({
        group_id: 'g-good', workspace_id: 'ws-1', view_id: null, name: null,
        current_primary_thread_id: 'm-1', created_at: 1, updated_at: 1,
      });
      await trx('thread_group_members').insert({
        group_id: 'g-good', thread_id: 'm-1', ordinal: 1, origin_kind: 'initial', joined_at: 1,
      });
    });
    await expect(db('thread_group_members').where({ group_id: 'g-good' })).resolves.toHaveLength(1);
  });
});
