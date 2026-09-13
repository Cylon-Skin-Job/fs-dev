'use strict';

/**
 * SPEC-01 §8.5 search group join.
 *
 * Search stays exchange/session-backed: it returns the exact `threadId` and
 * `exchangeId` and additionally joins membership/group ownership for the
 * `threadGroupId`, visible group name, and authoritative group view binding.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-tg-search-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, closeDb, getDb } = require('../../lib/db');
const { ThreadManager } = require('../../lib/thread/ThreadManager');
const { search } = require('../../lib/thread/chat-search');

const MACHINE = 'Fixture-Machine';
const WORKSPACE_ID = 'workspace-search';

describe('chat search group join', () => {
  let projectRoot;
  let previousMachine;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-tg-search-ws-'));
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

  test('returns exact exchange/session identity plus group ownership context', async () => {
    const manager = new ThreadManager({ projectRoot, workspaceId: WORKSPACE_ID });
    await manager.createThread('t-view', 'View Thread', {
      harnessId: 'opencode', groupId: 'tg-view', viewId: 'capture-viewer',
    });
    await manager.createThread('t-legacy', 'Legacy Thread', {
      harnessId: 'opencode', groupId: 'tg-legacy', viewId: null,
    });

    const db = getDb();
    await db('exchanges').insert({
      thread_id: 't-view', seq: 1, ts: Date.now(), user_input: 'needle alpha',
      assistant: JSON.stringify({ parts: [{ type: 'text', content: 'reply alpha' }] }),
      metadata: '{}',
    });
    await db('exchanges').insert({
      thread_id: 't-legacy', seq: 1, ts: Date.now(), user_input: 'needle legacy',
      assistant: JSON.stringify({ parts: [{ type: 'text', content: 'reply legacy' }] }),
      metadata: '{}',
    });

    const { total, results } = await search({
      workspaceId: WORKSPACE_ID, query: 'needle', limit: 10, offset: 0,
    });
    expect(total).toBe(2);

    const byThread = new Map(results.map((row) => [row.threadId, row]));
    const view = byThread.get('t-view');
    expect(view).toMatchObject({
      threadId: 't-view',
      threadName: 'View Thread',
      threadGroupId: 'tg-view',
      threadGroupName: 'View Thread',
      groupViewId: 'capture-viewer',
    });
    expect(typeof view.exchangeId).not.toBeUndefined();

    const legacy = byThread.get('t-legacy');
    expect(legacy).toMatchObject({
      threadId: 't-legacy',
      threadGroupId: 'tg-legacy',
      threadGroupName: 'Legacy Thread',
      groupViewId: null,
    });
    // Group identity never replaces the exact exchange identity.
    expect(legacy.exchangeId).not.toBe(view.exchangeId);
    expect(JSON.stringify(results)).not.toContain('surfaceId');
  });

  test('a session without a group still searches with null group context', async () => {
    const db = getDb();
    await db('threads').insert({
      thread_id: 't-ungrouped', workspace_id: WORKSPACE_ID, project_id: 'w', scope: 'project',
      view_id: null, name: 'Ungrouped', created_at: new Date().toISOString(),
      message_count: 0, status: 'suspended', updated_at: Date.now(), harness_id: 'opencode',
      harness_config: null,
    });
    await db('exchanges').insert({
      thread_id: 't-ungrouped', seq: 1, ts: Date.now(), user_input: 'needle orphan',
      assistant: '{}', metadata: '{}',
    });

    const { results } = await search({ workspaceId: WORKSPACE_ID, query: 'needle' });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      threadId: 't-ungrouped',
      threadGroupId: null,
      threadGroupName: null,
      groupViewId: null,
    });
  });
});
