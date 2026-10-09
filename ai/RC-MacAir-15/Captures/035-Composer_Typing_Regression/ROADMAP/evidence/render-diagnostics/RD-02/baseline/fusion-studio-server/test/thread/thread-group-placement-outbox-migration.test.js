'use strict';

/**
 * SPEC-04 slice 04A — migration 044 shape and reversibility.
 *
 * Creates the durable Side Chat placement outbox: bounded identity +
 * idempotency + delivery state only (stable `side_chat_placement_id`, no
 * snapshot/descriptor/`surfaceId`, no group FK), survives the group, and drops
 * cleanly on down. The migration performs no backfill and is create-only.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const knex = require('knex');

const migration = require('../../lib/db/migrations/044_thread_group_placement_outbox');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');

function createDb() {
  const filename = path.join(
    os.tmpdir(),
    `fusion-tg-placement-mig-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
  );
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
    migrations: { directory: MIGRATIONS_DIRECTORY },
  });
  db._testFilename = filename;
  return db;
}

async function expectRejects(operation, pattern) {
  let error = null;
  try {
    await operation();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeTruthy();
  expect(String(error && error.message)).toMatch(pattern);
}

const IDENTITY = {
  sideChatPlacementId: 'scp-1',
  idempotencyKey: 'open-side-chat-tab:ws-1:file-viewer:tg-1:t-1',
  workspaceId: 'ws-1',
  viewId: 'file-viewer',
  groupId: 'tg-1',
  threadId: 't-1',
};

function baseRow(now) {
  return {
    side_chat_placement_id: IDENTITY.sideChatPlacementId,
    idempotency_key: IDENTITY.idempotencyKey,
    workspace_id: IDENTITY.workspaceId,
    view_id: IDENTITY.viewId,
    group_id: IDENTITY.groupId,
    thread_id: IDENTITY.threadId,
    operation: 'open-side-chat-tab',
    status: 'pending',
    attempts: 0,
    last_failure_code: null,
    created_at: now,
    updated_at: now,
    applied_at: null,
  };
}

describe('migration 044 Side Chat placement outbox', () => {
  let db;

  afterEach(async () => {
    if (db) {
      const filename = db._testFilename;
      await db.destroy();
      if (filename) fs.rmSync(filename, { force: true });
      db = null;
    }
  });

  test('migration 044 remains applied below the current head and the table is bounded identity/delivery state only', async () => {
    db = createDb();
    const [batch, migrations] = await db.migrate.latest();
    expect(batch).toBe(1);
    expect(migrations.at(-1)).toMatch(/045_prompt_submission_receipts\.js$/);
    await expect(db.schema.hasTable('thread_group_placement_outbox')).resolves.toBe(true);

    const columns = await db('thread_group_placement_outbox').columnInfo();
    expect(Object.keys(columns).sort()).toEqual([
      'applied_at', 'attempts', 'created_at', 'group_id', 'id', 'idempotency_key',
      'last_failure_code', 'operation', 'side_chat_placement_id', 'status',
      'thread_id', 'updated_at', 'view_id', 'workspace_id',
    ]);
    // No snapshot / descriptor / transient identity columns.
    expect(Object.keys(columns)).not.toContain('content_json');
    expect(Object.keys(columns)).not.toContain('descriptor_json');
    expect(Object.keys(columns)).not.toContain('surface_id');
    expect(migration._internal.PLACEMENT_STATUSES).toEqual(['pending', 'applied', 'failed']);
    expect(migration._internal.PLACEMENT_OPERATIONS).toEqual(['open-side-chat-tab']);
  });

  test('rejects malformed or oversized values at the schema boundary', async () => {
    db = createDb();
    await db.migrate.latest();
    const now = Date.now();
    await db('thread_group_placement_outbox').insert(baseRow(now));
    await expectRejects(
      () => db('thread_group_placement_outbox').insert({
        ...baseRow(now), side_chat_placement_id: 'scp-2', idempotency_key: 'k-2', status: 'bogus',
      }),
      /CHECK/,
    );
    await expectRejects(
      () => db('thread_group_placement_outbox').insert({
        ...baseRow(now), side_chat_placement_id: 'scp-3', idempotency_key: 'k-3', operation: 'close-side-chat-tab',
      }),
      /CHECK/,
    );
    await expectRejects(
      () => db('thread_group_placement_outbox').insert({
        ...baseRow(now), side_chat_placement_id: 'scp-4', idempotency_key: 'k-4', attempts: -1,
      }),
      /CHECK/,
    );
    await expectRejects(
      () => db('thread_group_placement_outbox').insert({
        ...baseRow(now), side_chat_placement_id: 'scp-5', idempotency_key: 'k-5', workspace_id: '',
      }),
      /CHECK/,
    );
  });

  test('the instruction survives the group it describes (no cascade FK) and is unique per key', async () => {
    db = createDb();
    await db.migrate.latest();
    await db('workspaces').insert({
      id: 'ws-1', label: 'W', icon: 'folder', repo_path: '/tmp/w',
      sort_order: 1, type: 'code', ribbon_visible: 1, ribbon_sort_order: 1,
    });
    const now = Date.now();
    await db('threads').insert({
      thread_id: 't-1', workspace_id: 'ws-1', project_id: 'w', scope: 'project',
      view_id: 'file-viewer', name: 'Alpha', created_at: new Date(now).toISOString(),
      message_count: 0, status: 'suspended', updated_at: now, harness_id: 'opencode',
      harness_config: null,
    });
    await db.transaction(async (trx) => {
      await trx.raw('PRAGMA defer_foreign_keys = ON');
      await trx('thread_groups').insert({
        group_id: 'tg-1', workspace_id: 'ws-1', view_id: 'file-viewer', name: 'Alpha',
        current_primary_thread_id: 't-1', created_at: now, updated_at: now,
      });
      await trx('thread_group_members').insert({
        group_id: 'tg-1', thread_id: 't-1', ordinal: 1, origin_kind: 'initial', joined_at: now,
      });
    });
    await db('thread_group_placement_outbox').insert(baseRow(now));

    await db.transaction(async (trx) => {
      await trx.raw('PRAGMA defer_foreign_keys = ON');
      await trx('thread_group_members').where({ group_id: 'tg-1' }).del();
      await trx('thread_groups').where({ group_id: 'tg-1' }).del();
    });
    const row = await db('thread_group_placement_outbox').where({ group_id: 'tg-1' }).first();
    expect(row).toBeTruthy();
    expect(row.status).toBe('pending');
    await expectRejects(
      () => db('thread_group_placement_outbox').insert(baseRow(now)),
      /UNIQUE/,
    );
    await expectRejects(
      () => db('thread_group_placement_outbox').insert({
        ...baseRow(now), side_chat_placement_id: 'scp-other',
      }),
      /UNIQUE/,
    );
  });

  test('down removes only the placement outbox table', async () => {
    db = createDb();
    await db.migrate.latest();
    await db.migrate.down(); // receipt migration 045
    await db.migrate.down();
    await expect(db.schema.hasTable('thread_group_placement_outbox')).resolves.toBe(false);
    await expect(db.schema.hasTable('thread_group_worksurface_cleanup')).resolves.toBe(true);
    await expect(db.schema.hasTable('thread_groups')).resolves.toBe(true);
  });
});
