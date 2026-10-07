'use strict';

const knex = require('knex');
const { emit } = require('../../lib/event-bus');
const initialMigration = require('../../lib/db/migrations/001_initial');
const ledgerMigration = require('../../lib/db/migrations/029_event_ledger');
const { recordEvent, listRecentEvents } = require('../../lib/ledger/event-ledger');
const {
  drainEventLedgerWrites,
  startEventLedgerSubscriber,
} = require('../../lib/ledger/event-ledger-subscriber');

function createDb() {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      afterCreate(conn, done) {
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
  });
}

async function setupDb() {
  const db = createDb();
  await initialMigration.up(db);
  await ledgerMigration.up(db);
  await db('system_config').insert([
    {
      key: 'local_machine_name',
      value: 'RC-MacAir-15',
      updated_at: Date.now(),
    },
  ]);
  return db;
}

function flushAsync() {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

describe('event ledger', () => {
  let db;
  let stopSubscriber;

  afterEach(async () => {
    if (stopSubscriber) {
      stopSubscriber();
      stopSubscriber = null;
    }
    if (db) {
      await db.destroy();
      db = null;
    }
  });

  test('records workspace switch events with machine identity', async () => {
    db = await setupDb();

    const result = await recordEvent(db, {
      type: 'workspace:switched',
      timestamp: 1781335000000,
      from: 'old-workspace',
      to: 'new-workspace',
      repoPath: '/tmp/new-workspace',
    });

    expect(result.eventId).toBeTruthy();
    const row = await db('event_log').where({ event_id: result.eventId }).first();
    expect(row.event_type).toBe('workspace:switched');
    expect(row.workspace_id).toBe('new-workspace');
    expect(row.machine_id).toBeNull();
    expect(row.machine_name).toBe('RC-MacAir-15');
    expect(row.summary).toBe('Workspace switched from old-workspace to new-workspace');

    const tags = await db('event_tags').where({ event_id: result.eventId }).pluck('tag');
    expect(tags).toEqual(['workspace']);
  });

  test('direct recording ignores file changes without writing ledger projections', async () => {
    db = await setupDb();

    const result = await recordEvent(db, {
      type: 'file:changed',
      timestamp: 1781335000100,
      workspaceId: 'fs-dev',
      filePath: 'docs/example.md',
      event: 'modify',
      content: 'do not persist full content',
      context: {
        type: 'file',
        ext: '.md',
        basename: 'example.md',
      },
    });

    expect(result).toBeNull();
    await expect(db('event_log').count('* as count').first()).resolves.toMatchObject({ count: 0 });
    await expect(db('event_resource_edges').count('* as count').first()).resolves.toMatchObject({ count: 0 });
    await expect(db('event_tags').count('* as count').first()).resolves.toMatchObject({ count: 0 });
  });

  test('records thread state changes and keeps only supported types whitelisted', async () => {
    db = await setupDb();

    const result = await recordEvent(db, {
      type: 'thread:state_changed',
      timestamp: 1781335000150,
      workspaceId: 'fs-dev',
      threadId: 'thread-1',
      state: 'idle',
    });

    expect(result.eventId).toBeTruthy();
    expect(await db('event_log').where({ event_id: result.eventId }).first()).toMatchObject({
      event_type: 'thread:state_changed',
      workspace_id: 'fs-dev',
      summary: 'Thread thread-1 changed state to idle',
    });
    expect(await db('event_tags').where({ event_id: result.eventId }).pluck('tag')).toEqual(['thread']);
    expect(await recordEvent(db, { type: 'settings:enforcement_changed' })).toBeNull();
  });

  test('subscriber mirrors recorded bus events and ignores unrelated events', async () => {
    db = await setupDb();
    const logger = { log: jest.fn(), warn: jest.fn() };
    stopSubscriber = startEventLedgerSubscriber({ getDb: () => db, logger });

    emit('workspace:switched', {
      from: 'fs-dev',
      to: 'fusion-home',
      repoPath: '/tmp/fusion-home',
    });
    emit('thread:state_changed', {
      workspaceId: 'fusion-home', threadId: 'thread-1', state: 'idle',
    });
    emit('file:changed', {
      workspaceId: 'fusion-home', filePath: 'docs/example.md', event: 'modify',
    });
    emit('settings:enforcement_changed', {
      key: 'something',
      value: 1,
    });

    await flushAsync();

    const rows = await listRecentEvents(db, { limit: 10 });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.event_type).sort()).toEqual([
      'thread:state_changed', 'workspace:switched',
    ]);
    expect(rows.every((row) => row.workspace_id === 'fusion-home')).toBe(true);
    expect(await db('event_resource_edges').count('* as count').first()).toMatchObject({ count: 0 });
    expect(await db('event_tags').count('* as count').first()).toMatchObject({ count: 2 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('shutdown drain owns a held legacy ledger write before database close', async () => {
    let releaseWrite;
    let writeStarted;
    const started = new Promise((resolve) => { writeStarted = resolve; });
    const logger = { log: jest.fn(), warn: jest.fn() };
    const heldDb = jest.fn(() => ({
      where: () => ({
        first: async () => {
          writeStarted();
          await new Promise((resolve) => { releaseWrite = resolve; });
          throw new Error('intentional held write failure');
        },
      }),
    }));
    stopSubscriber = startEventLedgerSubscriber({
      getDb: () => heldDb,
      logger,
    });
    emit('thread:state_changed', {
      workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-1', state: 'idle',
    });
    await started;
    let settled = false;
    const draining = drainEventLedgerWrites({ timeoutMs: 1_000 })
      .then((result) => { settled = true; return result; });
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseWrite();
    await expect(draining).resolves.toEqual({ drained: true });
    expect(logger.warn).toHaveBeenCalledWith(
      '[EventLedger] write failed:', 'intentional held write failure',
    );
  });
});
