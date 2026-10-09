'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-tg-delete-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, closeDb, getDb } = require('../../lib/db');
const { ThreadManager } = require('../../lib/thread/ThreadManager');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  withGroupMutationLease,
} = require('../../lib/thread-groups/group-mutation-lease');
const {
  createCanonicalChatTerminalEvents,
} = require('../../lib/wire/canonical-chat-terminal-events');
const { insertTerminalActivity, IDS } = require('../agent-provenance/helpers');

const MACHINE = 'Fixture-Machine';
const WORKSPACE_ID = 'workspace-thread-groups';
const EPOCH = 'workspace-epoch-1';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('thread group delete recovery', () => {
  let projectRoot;
  let previousMachine;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-tg-delete-root-'));
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

  async function seed(manager, { threadId = 't-1', groupId = 'tg-1', name = 'Alpha' } = {}) {
    await manager.createThread(threadId, name, { harnessId: 'opencode', groupId });
    return { threadId, groupId };
  }

  async function insertExchange(threadId, seq = 1) {
    await getDb()('exchanges').insert({
      thread_id: threadId,
      seq,
      ts: 1_000 + seq,
      user_input: 'question',
      assistant: JSON.stringify({ parts: [{ type: 'text', content: 'answer' }] }),
      metadata: '[]',
    });
    return getDb()('exchanges').where({ thread_id: threadId, seq }).first();
  }

  test('the group mutation lease serializes one group and survives rejection', async () => {
    const order = [];
    const first = withGroupMutationLease('ws\u0000tg', async () => {
      order.push('a-start');
      await delay(15);
      order.push('a-end');
    });
    const second = withGroupMutationLease('ws\u0000tg', async () => {
      order.push('b-start');
      order.push('b-end');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);

    const rejecting = withGroupMutationLease('ws\u0000tg', async () => {
      await delay(5);
      throw new Error('expected');
    });
    const following = withGroupMutationLease('ws\u0000tg', async () => 'ran');
    await expect(rejecting).rejects.toThrow('expected');
    await expect(following).resolves.toBe('ran');
  });

  test('concurrent deletes serialize: one deletes, the other recovers the tombstone', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    await insertExchange(threadId);

    const [first, second] = await Promise.all([
      manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'req-a' }),
      manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'req-b' }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const results = [first, second];
    expect(results.some((entry) => entry.recovered === true)).toBe(true);

    const db = getDb();
    expect(await db('thread_groups').where({ group_id: groupId })).toHaveLength(0);
    const resultsRows = await db('thread_group_action_results')
      .whereIn('request_id', ['req-a', 'req-b']);
    expect(resultsRows).toHaveLength(2);
    const deleteMirrors = await db('thread_group_mirror_recovery')
      .where({ group_id: groupId, operation: 'delete' });
    expect(deleteMirrors).toHaveLength(1);
  });

  test('group_busy is returned without mutation while a member runtime is in flight', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    await insertExchange(threadId);
    const runtimeKey = {
      workspaceId: WORKSPACE_ID,
      projectRoot: manager.projectRoot,
      workspaceEpoch: EPOCH,
      scope: 'project',
      threadId,
    };
    threadRuntimeManager.markInFlight(runtimeKey);

    const result = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-busy',
    });
    expect(result).toMatchObject({ ok: false, code: 'group_busy' });
    expect(result.busy[0]).toMatchObject({ threadId, state: 'active' });

    const db = getDb();
    expect(await db('thread_groups').where({ group_id: groupId })).toHaveLength(1);
    expect(await db('threads').where({ thread_id: threadId })).toHaveLength(1);
    expect(await db('exchanges').where({ thread_id: threadId })).toHaveLength(1);
    threadRuntimeManager.fenceResource({
      workspaceId: WORKSPACE_ID, projectRoot: manager.projectRoot, threadId,
    });
  });

  test('rename replays same request and rejects different-input reuse', async () => {
    const manager = makeManager();
    const { groupId } = await seed(manager);

    const first = await manager.threadGroups.renameGroup({
      threadGroupId: groupId, name: 'Renamed One', requestId: 'req-r',
    });
    expect(first.ok).toBe(true);
    expect(first.result.name).toBe('Renamed One');
    expect(first.result).not.toHaveProperty('surfaceId');
    expect(first.result.context).toMatchObject({
      workspaceId: WORKSPACE_ID, threadGroupId: groupId, threadId: 't-1', viewId: null,
    });
    expect(JSON.stringify(first.result)).not.toContain('surfaceId');

    const replay = await manager.threadGroups.renameGroup({
      threadGroupId: groupId, name: 'Renamed One', requestId: 'req-r',
    });
    expect(replay).toMatchObject({ ok: true, replayed: true });

    const mismatch = await manager.threadGroups.renameGroup({
      threadGroupId: groupId, name: 'Different Name', requestId: 'req-r',
    });
    expect(mismatch).toMatchObject({ ok: false, code: 'request_mismatch' });

    const db = getDb();
    expect((await db('thread_groups').where({ group_id: groupId }).first()).name).toBe('Renamed One');
  });

  test('rename does not advance the visible-list MRU clock', async () => {
    const manager = makeManager();
    const { groupId } = await seed(manager);
    const before = (await getDb()('thread_groups').where({ group_id: groupId }).first()).updated_at;
    await delay(3);
    await manager.threadGroups.renameGroup({ threadGroupId: groupId, name: 'Later', requestId: 'req-mru' });
    const after = await getDb()('thread_groups').where({ group_id: groupId }).first();
    expect(after.name).toBe('Later');
    expect(after.updated_at).toBe(before);
  });

  test('a new request ID resolves the retained tombstone aggregate and records durably', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    await insertExchange(threadId);

    const deleted = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-1',
    });
    expect(deleted.ok).toBe(true);
    expect(deleted.result).toMatchObject({ threadGroupId: groupId, threadId, deleted: true });

    const recovered = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-2',
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.recovered).toBe(true);
    expect(recovered.result.threadGroupId).toBe(groupId);
    expect(recovered.result.cleanup.status).toBe('complete');
    expect(JSON.stringify(recovered.result)).not.toContain('surfaceId');

    const db = getDb();
    const record = await db('thread_group_action_results')
      .where({ request_id: 'req-2' }).first();
    expect(record).toBeTruthy();
    expect(record.action).toBe('delete');
    expect(JSON.parse(record.result_json).threadGroupId).toBe(groupId);

    // The tombstone survived the group, members, sessions, and exchanges.
    const tombstone = await db('thread_group_delete_tombstones')
      .where({ group_id: groupId }).first();
    expect(tombstone.workspace_id).toBe(WORKSPACE_ID);
  });

  test('replay of the new request ID survives tombstone expiry; an unseen request does not', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    await insertExchange(threadId);
    await manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'req-live' });
    await manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'req-recovered' });

    const db = getDb();
    await db('thread_group_delete_tombstones')
      .where({ group_id: groupId })
      .update({ expires_at: Date.now() - 1 });

    const replay = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-recovered',
    });
    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(replay.result.threadGroupId).toBe(groupId);

    const unseen = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-never-seen',
    });
    expect(unseen).toMatchObject({ ok: false, code: 'not_found' });
    expect(await db('thread_groups').where({ group_id: groupId })).toHaveLength(0);
  });

  test('failed mirror cleanup is retained and a restart resumes idempotent repair', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager, { threadId: 't-clean', groupId: 'tg-clean' });
    await insertExchange(threadId);

    const fsPromises = require('fs').promises;
    const originalRm = fsPromises.rm;
    fsPromises.rm = async () => { throw new Error('injected mirror failure'); };
    let failed;
    try {
      failed = await manager.threadGroups.deleteGroup({
        threadGroupId: groupId, requestId: 'req-clean-1',
      });
    } finally {
      fsPromises.rm = originalRm;
    }
    expect(failed.ok).toBe(true);
    expect(failed.result.cleanup.status).toBe('failed');
    expect(failed.result.cleanup.mirrors[0].status).toBe('failed');

    const db = getDb();
    const failedTombstone = await db('thread_group_delete_tombstones')
      .where({ group_id: groupId }).first();
    expect(JSON.parse(failedTombstone.cleanup_json).status).toBe('failed');

    // Restart: a fresh manager replays the pending delete instruction and a
    // new request ID returns the repaired aggregate.
    const restarted = makeManager();
    await restarted.ensureGroupsActivated();

    const recovered = await restarted.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-clean-2',
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.recovered).toBe(true);
    expect(recovered.result.cleanup.status).toBe('complete');
    expect(await db('thread_group_action_results').where({ request_id: 'req-clean-2' })).toHaveLength(1);
  });

  test('a late turn_end frame cannot recreate exchanges or runtime state', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager, { threadId: 't-late', groupId: 'tg-late' });
    await insertExchange(threadId);

    const deleted = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-late',
    });
    expect(deleted.ok).toBe(true);

    const db = getDb();
    expect(await db('exchanges').where({ thread_id: threadId })).toHaveLength(0);

    const resourceKey = {
      workspaceId: WORKSPACE_ID, projectRoot: manager.projectRoot, threadId,
    };
    expect(threadRuntimeManager.getRuntimeForResource(resourceKey)).toBeNull();

    const runtimeKey = { ...resourceKey, workspaceEpoch: EPOCH, scope: 'project' };
    expect(threadRuntimeManager.applyLiveMutation(
      runtimeKey,
      { drainId: 'stale-drain', turnId: 'stale-turn' },
      () => { throw new Error('late mutation must not run'); },
    )).toBeNull();
    expect(threadRuntimeManager.terminalizeTurn(
      runtimeKey,
      { drainId: 'stale-drain', turnId: 'stale-turn' },
    )).toBe(false);

    const emitted = [];
    const terminalEvents = createCanonicalChatTerminalEvents({
      emit: (...args) => emitted.push(args),
    });
    terminalEvents.handleTurnEnd({
      payload: { reason: 'complete' },
      route: { threadId, workspaceId: WORKSPACE_ID },
      control: { runtimeKey, drainId: 'stale-drain' },
    });
    const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');
    const applier = createCanonicalChatEventApplier({ emit: (...args) => emitted.push(args),
      checkSettingsBounce: () => null, generateTurnId: () => 'late-generated' });
    applier.applyChatEvent({ type: 'status_update', payload: { tokenUsage: 100 } }, null, {
      route: { threadId, workspaceId: WORKSPACE_ID },
      control: { runtimeKey, drainId: 'stale-drain', touchThreadSession: () => manager.touchSession(threadId) },
    });
    expect(threadRuntimeManager.getRuntimeForResource(resourceKey)).toBeNull();
    expect(emitted).toHaveLength(0);
    expect(await db('exchanges').where({ thread_id: threadId })).toHaveLength(0);
  });

  test('deleting the group retains Provenance facts and clears only the exchange binding', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager, { threadId: 't-prov', groupId: 'tg-prov' });
    const exchange = await insertExchange(threadId);
    const db = getDb();
    await insertTerminalActivity(db, {
      workspaceId: WORKSPACE_ID,
      threadId,
      turnId: 'turn-prov',
      activityId: '11111111-1111-4111-8111-111111111111',
      eventId: '22222222-2222-4222-8222-222222222222',
    });
    await db('agent_tool_activities')
      .where({ activity_id: IDS.activity })
      .update({ exchange_id: exchange.id, exchange_saved_at: 10, exchange_bound_at: 10 });
    expect((await db('agent_tool_activities').where({ activity_id: IDS.activity }).first()).exchange_id)
      .toBe(exchange.id);

    const deleted = await manager.threadGroups.deleteGroup({
      threadGroupId: groupId, requestId: 'req-prov',
    });
    expect(deleted.ok).toBe(true);

    const activities = await db('agent_tool_activities').where({ thread_id: threadId });
    expect(activities).toHaveLength(1);
    expect(activities[0].exchange_id).toBeNull();
    expect(activities[0].exchange_saved_at).toBeNull();
    expect(activities[0].exchange_bound_at).toBeNull();
    expect(await db('exchanges').where({ thread_id: threadId })).toHaveLength(0);
  });

  test('a raw session delete still retires its group and never orphans it', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager, { threadId: 't-raw', groupId: 'tg-raw' });

    await expect(manager.deleteThread(threadId)).resolves.toBe(true);

    const db = getDb();
    expect(await db('thread_groups').where({ group_id: groupId })).toHaveLength(0);
    expect(await db('thread_group_members').where({ thread_id: threadId })).toHaveLength(0);
    expect(await db('threads').where({ thread_id: threadId })).toHaveLength(0);
  });

  test('delete journal insertion failure rolls back sessions, history and receipt; retry cascades the receipt', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    await insertExchange(threadId);
    const db = getDb();
    await db('prompt_submission_receipts').insert({ workspace_id: WORKSPACE_ID, thread_id: threadId,
      request_id: 'accepted-before-delete', generation: EPOCH, outcome: 'accepted', execution: 'completed',
      created_at: 1, updated_at: 1 });
    const repo = require('../../lib/thread-groups/repository');
    const stage = jest.spyOn(repo, 'insertMirrorRecovery').mockRejectedValue(new Error('journal unavailable'));
    try {
      await expect(manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'journal-fail' }))
        .rejects.toThrow('journal unavailable');
    } finally { stage.mockRestore(); }
    for (const table of ['threads', 'exchanges', 'prompt_submission_receipts']) {
      expect(await db(table).where({ thread_id: threadId })).toHaveLength(1);
    }
    expect(await db('thread_group_delete_tombstones')).toHaveLength(0);
    expect(await manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'journal-retry' }))
      .toMatchObject({ ok: true });
    expect(await db('prompt_submission_receipts').where({ thread_id: threadId })).toHaveLength(0);
  });

  test('failed drain retirement or provider close rejects deletion before SQL mutation', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    const retire = jest.spyOn(threadRuntimeManager, 'retireResourceDrains').mockRejectedValue(new Error('drain failed'));
    try {
      await expect(manager.threadGroups.deleteGroup({ threadGroupId: groupId })).rejects.toThrow('drain failed');
    } finally { retire.mockRestore(); }
    const session = jest.spyOn(manager.sessionManager, 'getSession').mockReturnValue({ state: 'active' });
    const close = jest.spyOn(manager.sessionLifecycle, 'closeSession').mockRejectedValue(new Error('close failed'));
    try {
      await expect(manager.threadGroups.deleteGroup({ threadGroupId: groupId })).rejects.toThrow('close failed');
    } finally { session.mockRestore(); close.mockRestore(); }
    expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(1);
    expect(await getDb()('thread_group_delete_tombstones')).toHaveLength(0);
  });

  test('delete file ACK failure remains recoverable after SQLite close and reopen', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    const repo = require('../../lib/thread-groups/repository');
    const mark = jest.spyOn(repo, 'markMirrorRecovery').mockRejectedValue(new Error('ACK unavailable'));
    try {
      expect(await manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'delete-ack' }))
        .toMatchObject({ ok: true, result: { deleted: true, cleanup: { status: 'pending' } } });
    } finally { mark.mockRestore(); }
    expect(fs.existsSync(manager.chatlogMirror.file(threadId).filePath)).toBe(false);
    await closeDb(); await initDb();
    const restarted = makeManager();
    await restarted.ensureGroupsActivated();
    expect(await restarted.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'delete-ack-retry' }))
      .toMatchObject({ ok: true, result: { cleanup: { status: 'complete' } } });
    expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(0);
  });

  test('a cold passive epoch cannot hide another epoch busy during Delete', async () => {
    const manager = makeManager();
    const { threadId, groupId } = await seed(manager);
    const resource = { workspaceId: WORKSPACE_ID, projectRoot, threadId, scope: 'project' };
    threadRuntimeManager.markInFlight({ ...resource, workspaceEpoch: 'active-epoch' });
    threadRuntimeManager.ensureRuntime({ ...resource, workspaceEpoch: 'passive-epoch' });
    try {
      expect(await manager.threadGroups.deleteGroup({ threadGroupId: groupId, requestId: 'busy-epochs' }))
        .toMatchObject({ ok: false, code: 'group_busy' });
      expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(1);
      expect(threadRuntimeManager.getRuntimeState({ ...resource, workspaceEpoch: 'active-epoch' })).toBe('in_flight');
    } finally { threadRuntimeManager.fenceResource(resource); }
  });

});
