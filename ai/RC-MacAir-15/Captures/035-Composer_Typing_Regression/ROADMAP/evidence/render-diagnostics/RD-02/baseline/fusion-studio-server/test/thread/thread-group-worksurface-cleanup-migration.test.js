'use strict';

/**
 * CHAT-03 / SPEC-03 §8, §10 03C — migration 043 shape and reversibility.
 *
 * Creates the durable group-deletion worksurface-cleanup projection/outbox:
 * bounded identity + delivery state only (no snapshot, no group FK), survives
 * the group, and drops cleanly on down. The migration performs no backfill and
 * never deletes a pre-existing worksurface entry.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const knex = require('knex');

const migration = require('../../lib/db/migrations/043_thread_group_worksurface_cleanup');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');

function createDb() {
  const filename = path.join(
    os.tmpdir(),
    `fusion-tg-wscleanup-mig-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
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

const IDENTITY = {
  idempotencyKey: 'remove-group-worksurface:ws-1:file-viewer:tg-1',
  workspaceId: 'ws-1',
  viewId: 'file-viewer',
  groupId: 'tg-1',
};

/**
 * Await a knex write and assert it rejects with a schema-boundary message.
 * Knex query builders are thenables; awaiting explicitly is more reliable than
 * `expect(...).rejects.toThrow` across a shared Jest worker process.
 */
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

describe('migration 043 group worksurface cleanup outbox', () => {
  let db;

  afterEach(async () => {
    if (db) {
      const filename = db._testFilename;
      await db.destroy();
      if (filename) fs.rmSync(filename, { force: true });
      db = null;
    }
  });

  test('migration 043 is applied before the current head and its table is bounded identity/delivery state only', async () => {
    db = createDb();
    const [batch, migrations] = await db.migrate.latest();
    expect(batch).toBe(1);
    // Receipt migration 045 is the current head; 043 remains applied.
    expect(migrations).toContain('043_thread_group_worksurface_cleanup.js');
    expect(migrations.at(-1)).toMatch(/045_prompt_submission_receipts\.js$/);
    await expect(db.schema.hasTable('thread_group_worksurface_cleanup')).resolves.toBe(true);

    const columns = await db('thread_group_worksurface_cleanup').columnInfo();
    expect(Object.keys(columns).sort()).toEqual([
      'applied_at', 'attempts', 'created_at', 'group_id', 'id',
      'idempotency_key', 'last_failure_code', 'status', 'updated_at', 'view_id',
      'workspace_id',
    ]);
    // No snapshot / transcript / transient identity columns.
    expect(Object.keys(columns)).not.toContain('content_json');
    expect(Object.keys(columns)).not.toContain('result_json');
    expect(Object.keys(columns)).not.toContain('thread_id');
    expect(migration._internal.CLEANUP_STATUSES).toEqual(['pending', 'applied', 'failed']);
  });

  test('rejects malformed or oversized values at the schema boundary', async () => {
    db = createDb();
    await db.migrate.latest();
    const now = Date.now();
    const base = {
      idempotency_key: IDENTITY.idempotencyKey,
      workspace_id: IDENTITY.workspaceId,
      view_id: IDENTITY.viewId,
      group_id: IDENTITY.groupId,
      status: 'pending',
      attempts: 0,
      last_failure_code: null,
      created_at: now,
      updated_at: now,
      applied_at: null,
    };
    await db('thread_group_worksurface_cleanup').insert(base);
    await expectRejects(
      () => db('thread_group_worksurface_cleanup').insert({
        ...base, idempotency_key: 'k-2', status: 'bogus',
      }),
      /CHECK/,
    );
    await expectRejects(
      () => db('thread_group_worksurface_cleanup').insert({
        ...base, idempotency_key: 'k-3', attempts: -1,
      }),
      /CHECK/,
    );
    await expectRejects(
      () => db('thread_group_worksurface_cleanup').insert({
        ...base, idempotency_key: 'k-4', workspace_id: '',
      }),
      /CHECK/,
    );
  });

  test('the instruction survives the group it describes (no cascade FK) and up is idempotent', async () => {
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
        current_primary_thread_id: 't-1',
        created_at: now, updated_at: now,
      });
      await trx('thread_group_members').insert({
        group_id: 'tg-1', thread_id: 't-1', ordinal: 1, origin_kind: 'initial', joined_at: now,
      });
    });
    await db('thread_group_worksurface_cleanup').insert({
      idempotency_key: IDENTITY.idempotencyKey,
      workspace_id: IDENTITY.workspaceId,
      view_id: IDENTITY.viewId,
      group_id: IDENTITY.groupId,
      status: 'pending',
      attempts: 0,
      last_failure_code: null,
      created_at: now,
      updated_at: now,
      applied_at: null,
    });

    // The group (and its member) may vanish without touching the instruction.
    await db.transaction(async (trx) => {
      await trx.raw('PRAGMA defer_foreign_keys = ON');
      await trx('thread_group_members').where({ group_id: 'tg-1' }).del();
      await trx('thread_groups').where({ group_id: 'tg-1' }).del();
    });
    const row = await db('thread_group_worksurface_cleanup')
      .where({ group_id: 'tg-1' }).first();
    expect(row).toBeTruthy();
    expect(row.status).toBe('pending');
    await expectRejects(
      () => db('thread_group_worksurface_cleanup').insert({
        idempotency_key: IDENTITY.idempotencyKey,
        workspace_id: IDENTITY.workspaceId,
        view_id: IDENTITY.viewId,
        group_id: IDENTITY.groupId,
        status: 'pending',
        attempts: 0,
        last_failure_code: null,
        created_at: now,
        updated_at: now,
        applied_at: null,
      }),
      /UNIQUE/,
    );
  });

  test('down removes only the cleanup table', async () => {
    db = createDb();
    await db.migrate.latest();
    // Roll back receipts and placement before proving 043's own down contract.
    await db.migrate.down();
    await db.migrate.down();
    await db.migrate.down();
    await expect(db.schema.hasTable('thread_group_worksurface_cleanup')).resolves.toBe(false);
    await expect(db.schema.hasTable('thread_group_delete_tombstones')).resolves.toBe(true);
    await expect(db.schema.hasTable('thread_groups')).resolves.toBe(true);
  });
});
