'use strict';

// Real SQLite migration, receipt, group activity, and recovery boundary. The
// Electron R3/R4 suite exercises these same owners through authenticated WS.
const fs = require('fs');
const os = require('os');
const path = require('path');

let root;
let db;
let closeDb;
let submission;
let groups;
const workspaceId = 'workspace-receipt';
const threadId = 'thread-receipt';
const groupId = 'group-receipt';
const input = { user_input: 'private synthetic fixture text', attachments: [], harnessConfig: {} };
const identity = (requestId) => ({ workspaceId, threadId, requestId });

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-receipt-test-'));
  process.env.FUSION_APP_USER_DATA = root;
  const database = require('../../lib/db');
  db = await database.initDb();
  closeDb = database.closeDb;
  submission = require('../../lib/thread/prompt-submission-service');
  const { createThreadGroupService } = require('../../lib/thread-groups/service');
  groups = createThreadGroupService({ manager: {
    workspaceId, projectRoot: root, ensureGroupsActivated: async () => ({ ok: true }),
  } });
  await db('threads').insert({ thread_id: threadId, view_id: null, project_id: 'receipt-fixture',
    workspace_id: workspaceId, scope: 'project', name: 'Receipt',
    created_at: new Date().toISOString(), updated_at: Date.now() });
  await db.transaction(async (trx) => {
    await trx.raw('PRAGMA defer_foreign_keys = ON');
    await trx('thread_groups').insert({ group_id: groupId, workspace_id: workspaceId,
      view_id: null, name: 'Receipt', current_primary_thread_id: threadId,
      created_at: Date.now(), updated_at: Date.now() });
    await trx('thread_group_members').insert({ group_id: groupId, thread_id: threadId,
      ordinal: 1, origin_kind: 'initial', joined_at: Date.now() });
  });
});

afterAll(async () => {
  if (closeDb) await closeDb();
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

test('fresh and copied pre-receipt upgrade preserve thread and exchange', async () => {
  expect(await db.schema.hasTable('prompt_submission_receipts')).toBe(true);
  await db('exchanges').insert({ thread_id: threadId, seq: 1, ts: Date.now(),
    user_input: 'pre-receipt saved prompt', assistant: '{"parts":[]}', metadata: '[]' });
  const BetterSqlite3 = require('better-sqlite3');
  const knex = require('knex');
  const source = new BetterSqlite3(path.join(root, 'server-data', 'fusion.db'), { readonly: true });
  const preReceiptPath = path.join(root, 'pre-receipt.db');
  await source.backup(preReceiptPath);
  source.close();
  const openCopy = (filename) => knex({ client: 'better-sqlite3',
    connection: { filename }, useNullAsDefault: true,
    pool: { afterCreate: (connection, done) => {
      connection.pragma('foreign_keys = ON'); done(null, connection);
    } },
    migrations: { directory: path.join(__dirname, '../../lib/db/migrations') },
  });
  const preReceipt = openCopy(preReceiptPath);
  const migration = require('../../lib/db/migrations/045_prompt_submission_receipts');
  await migration.down(preReceipt);
  await preReceipt('knex_migrations').where({ name: '045_prompt_submission_receipts.js' }).del();
  expect(await preReceipt.schema.hasTable('prompt_submission_receipts')).toBe(false);
  await preReceipt.destroy();
  const upgradePath = path.join(root, 'copied-pre-receipt.db');
  fs.copyFileSync(preReceiptPath, upgradePath);
  const upgraded = openCopy(upgradePath);
  await upgraded.migrate.latest();
  expect(await upgraded.schema.hasTable('prompt_submission_receipts')).toBe(true);
  expect(await upgraded('exchanges').where({ thread_id: threadId }).count('* as n').first())
    .toMatchObject({ n: 1 });
  expect(await upgraded('prompt_submission_receipts').count('* as n').first()).toMatchObject({ n: 0 });
  await upgraded.destroy();
});

test('absent status durably fences delayed original and belongs to exact workspace', async () => {
  const key = identity('attempt-absent-status');
  const recovered = await submission.status(key);
  expect(recovered.receipt.outcome).toBe('cancelled');
  expect((await submission.begin(key, input)).code).toBe('cancelled');
  expect((await submission.status({ ...key, workspaceId: 'foreign-workspace' })).ok).toBe(false);
  expect(await db('thread_group_activity_events').where({ thread_id: threadId }).count('* as n').first())
    .toMatchObject({ n: 0 });
});

test('accepted receipt and group activity commit together, replay and claim once', async () => {
  const key = identity('attempt-accepted-one');
  expect((await submission.begin(key, input)).receipt.outcome).toBe('reserved');
  const accepted = await submission.accept(key, 'turn-accepted-one', groups);
  expect(accepted.receipt.outcome).toBe('accepted');
  expect(accepted.receipt.turnId).toBe('turn-accepted-one');
  expect((await submission.begin(key, input)).receipt.turnId).toBe('turn-accepted-one');
  expect((await submission.begin(key, { ...input, user_input: 'different' })).code).toBe('request_mismatch');
  expect((await submission.status(key)).receipt.execution).toBe('not_dispatched');
  expect(await submission.claimDispatch(key)).toBe(true);
  expect(await submission.claimDispatch(key)).toBe(false);
  expect(await submission.noteClaimedFailure(key, 'provider_failed')).toBe(true);
  expect((await submission.status(key)).receipt.execution).toBe('unknown_after_dispatch_claim');
  expect((await submission.status(key)).receipt.reason).toBe('provider_failed');
  const activities = await db('thread_group_activity_events').where({ thread_id: threadId,
    turn_id: 'turn-accepted-one' });
  expect(activities).toHaveLength(1);
  expect(await db('prompt_submission_receipts').where({ request_id: key.requestId })).toHaveLength(1);
});

test('failed activity rolls back; restart cancels reservations and interrupts unclaimed acceptance', async () => {
  const key = identity('attempt-rollback-one');
  await submission.begin(key, input);
  await expect(submission.accept(key, 'turn-rollback-one', {
    recordPromptAccepted: async ({ db: trx }) => {
      await trx('thread_group_activity_events').insert({ event_key: 'prompt:rollback',
        group_id: groupId, thread_id: threadId, turn_id: 'turn-rollback-one',
        kind: 'prompt-accepted', occurred_at: Date.now() });
      throw new Error('injected transaction failure');
    },
  })).rejects.toThrow('injected transaction failure');
  expect(await db('thread_group_activity_events').where({ turn_id: 'turn-rollback-one' })).toHaveLength(0);
  expect((await submission.status(key)).receipt.outcome).toBe('reserved');
  const unclaimed = identity('attempt-unclaimed-one');
  await submission.begin(unclaimed, input);
  await submission.accept(unclaimed, 'turn-unclaimed-one', groups);
  const failed = identity('attempt-failed-before-claim');
  await submission.begin(failed, input);
  await submission.accept(failed, 'turn-failed-before-claim', groups);
  expect(await submission.failBeforeDispatch(failed, 'metadata_helper_failed')).toBe(true);
  expect(await submission.claimDispatch(failed)).toBe(false);
  expect((await submission.status(failed)).receipt).toMatchObject({ outcome: 'accepted',
    execution: 'failed_before_dispatch', reason: 'metadata_helper_failed',
    turnId: 'turn-failed-before-claim' });
  await closeDb();
  db = await require('../../lib/db').initDb();
  // The production startup calls this before admitting any sockets.
  await submission.recoverInterrupted();
  expect((await submission.status(key)).receipt.outcome).toBe('cancelled');
  expect((await submission.status(identity('attempt-accepted-one'))).receipt.outcome).toBe('accepted');
  expect((await submission.status(unclaimed)).receipt).toMatchObject({ outcome: 'accepted',
    execution: 'interrupted_before_dispatch', reason: 'server_restart',
    turnId: 'turn-unclaimed-one' });
  expect((await submission.status(failed)).receipt).toMatchObject({ outcome: 'accepted',
    execution: 'failed_before_dispatch', reason: 'metadata_helper_failed',
    turnId: 'turn-failed-before-claim' });
  expect(await submission.claimDispatch(unclaimed)).toBe(false);
});

test('same-key status waits for delayed admission; session deletion removes receipts', async () => {
  const key = identity('attempt-delayed-one');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const original = submission.withAttemptLock(key, async () => {
    await gate;
    await submission.begin(key, input);
    return submission.accept(key, 'turn-delayed-one', groups);
  });
  const status = submission.status(key);
  release();
  expect((await original).ok).toBe(true);
  expect((await status).receipt.turnId).toBe('turn-delayed-one');
  await db('threads').where({ thread_id: threadId }).del();
  expect(await db('prompt_submission_receipts').where({ thread_id: threadId })).toHaveLength(0);
});
