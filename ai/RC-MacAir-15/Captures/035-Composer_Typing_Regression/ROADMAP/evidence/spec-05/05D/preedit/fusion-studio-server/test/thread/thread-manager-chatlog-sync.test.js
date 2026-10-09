'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-chatlog-sync-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, closeDb } = require('../../lib/db');
const { HistoryFile } = require('../../lib/thread/HistoryFile');
const { ThreadManager } = require('../../lib/thread/ThreadManager');

describe('ThreadManager chatlog markdown sync', () => {
  let tempRoot;
  let previousMachine;
  let manager;

  async function createThread(threadId, name = 'Sync Thread') {
    await manager.createThread(threadId, name, { harnessId: 'opencode' });
    return manager._createChatFile(threadId);
  }

  async function addExchange(threadId, user, assistant, metadata = {}) {
    const historyFile = new HistoryFile(threadId);
    return historyFile.addExchange(
      threadId,
      user,
      [{ type: 'text', content: assistant }],
      metadata
    );
  }

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'RC MacAir 15';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chatlog-sync-workspace-'));
    await initDb();
    manager = new ThreadManager({
      projectRoot: tempRoot,
      workspaceId: 'workspace-chatlog-sync',
    });
  });

  afterEach(async () => {
    await closeDb();
    if (previousMachine === undefined) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = previousMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (previousUserDataDir === undefined) {
      delete process.env.FUSION_APP_USER_DATA;
    } else {
      process.env.FUSION_APP_USER_DATA = previousUserDataDir;
    }
  });

  test('creates a missing primary markdown mirror from SQLite history', async () => {
    const threadId = 'thread-create-mirror';
    const chatFile = await createThread(threadId, 'Created Mirror');
    fs.rmSync(chatFile.filePath, { force: true });

    const saved = await addExchange(threadId, 'hello', 'hi', {
      turnId: 'turn-create',
      source: 'test',
    });

    const result = await manager.syncChatlogMirrorFromHistory(threadId);
    const parsed = await chatFile.readPrimary();

    expect(result).toMatchObject({ updated: true, written: 2, reason: 'rewritten-from-sqlite' });
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]).toMatchObject({ role: 'user', content: 'hello' });
    expect(parsed.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'hi',
      metadata: {
        turnId: 'turn-create',
        source: 'test',
        chatMirror: {
          threadId,
          exchangeId: saved.exchangeId,
          seq: saved.seq,
          turnId: 'turn-create',
        },
      },
    });
    expect(chatFile.filePath).toContain(path.join('ai', 'RC-MacAir-15', 'Data', 'Chatlogs', 'threads'));
  });

  test('rewrites stale markdown from SQLite instead of appending one message', async () => {
    const threadId = 'thread-rewrite-stale';
    const chatFile = await createThread(threadId, 'Rewrite Stale');
    await chatFile.write('Append Assistant', [
      { role: 'user', content: 'question', hasToolCalls: false },
      { role: 'assistant', content: 'stale answer', hasToolCalls: false },
      { role: 'user', content: 'pending prompt not in sqlite', hasToolCalls: false },
    ]);

    const saved = await addExchange(threadId, 'question', 'answer', {
      turnId: 'turn-answer',
    });

    const result = await manager.syncChatlogMirrorFromHistory(threadId);
    const parsed = await chatFile.readPrimary();

    expect(result).toMatchObject({ updated: true, written: 2, reason: 'rewritten-from-sqlite' });
    expect(parsed.messages.map((message) => `${message.role}:${message.content}`)).toEqual([
      'user:question',
      'assistant:answer',
    ]);
    expect(parsed.messages[1].metadata).toMatchObject({
      turnId: 'turn-answer',
      chatMirror: {
        threadId,
        exchangeId: saved.exchangeId,
        seq: saved.seq,
        turnId: 'turn-answer',
      },
    });
  });

  test('addMessage records activity without writing chatlog markdown', async () => {
    const threadId = 'thread-activity-only';
    const chatFile = await createThread(threadId, 'Activity Only');

    await manager.addMessage(threadId, {
      role: 'user',
      content: 'not yet durable',
      hasToolCalls: false,
    });

    const parsed = await chatFile.readPrimary();
    const entry = await manager.index.get(threadId);

    expect(parsed.messages).toEqual([]);
    expect(entry.messageCount).toBe(1);
  });

  test('recordSavedExchange corrects message count from durable exchange sequence', async () => {
    const threadId = 'thread-count-correction';
    await createThread(threadId, 'Count Correction');

    await manager.addMessage(threadId, {
      role: 'user',
      content: 'pending prompt',
      hasToolCalls: false,
    });
    await manager.recordSavedExchange(threadId, 3);

    const entry = await manager.index.get(threadId);
    expect(entry.messageCount).toBe(6);
  });

  test.each(['ack', 'file-and-ack'])('committed creation survives %s failure and DB reopen repairs its mirror', async (fault) => {
    const repository = require('../../lib/thread-groups/repository');
    const { ChatFile } = require('../../lib/thread/ChatFile');
    const { getDb } = require('../../lib/db');
    const mark = jest.spyOn(repository, 'markMirrorRecovery').mockRejectedValue(new Error('ACK unavailable'));
    const write = fault === 'file-and-ack'
      ? jest.spyOn(ChatFile.prototype, 'write').mockRejectedValue(new Error('file unavailable')) : null;
    try {
      await expect(manager.createThread('fault-mirror', 'Committed', { harnessId: 'opencode' }))
        .resolves.toMatchObject({ threadId: 'fault-mirror' });
      expect(await getDb()('threads').where({ thread_id: 'fault-mirror' })).toHaveLength(1);
      expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('pending');
    } finally { mark.mockRestore(); write?.mockRestore(); }
    await closeDb();
    await initDb();
    const restarted = new ThreadManager({ projectRoot: tempRoot, workspaceId: 'workspace-chatlog-sync' });
    await restarted.ensureGroupsActivated();
    expect(await restarted.getHistory('fault-mirror')).toMatchObject({ name: 'Committed', messages: [] });
    expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('complete');
  });

  test('a queued late projection cannot recreate a deleted mirror', async () => {
    await createThread('late-mirror');
    const original = manager.getRichHistory.bind(manager);
    let release;
    let entered;
    const started = new Promise((resolve) => { entered = resolve; });
    manager.getRichHistory = async (id) => {
      entered();
      await new Promise((resolve) => { release = resolve; });
      return original(id);
    };
    const write = manager.syncChatlogMirrorFromHistory('late-mirror');
    await started;
    const deleting = manager.threadGroups.deleteGroup({ threadGroupId: 'late-mirror', requestId: 'delete-late' });
    manager.getRichHistory = original;
    release();
    await write;
    expect(await deleting).toMatchObject({ ok: true });
    expect(fs.existsSync(manager._createChatFile('late-mirror').filePath)).toBe(false);
    expect(await manager.syncChatlogMirrorFromHistory('late-mirror'))
      .toMatchObject({ updated: false, reason: 'thread-not-found' });
    expect(manager.chatlogMirror.pendingWrites.size).toBe(0);
  });

  test('a failed saved-exchange projection re-arms the write journal and restart exports exact history', async () => {
    const { ChatFile } = require('../../lib/thread/ChatFile');
    const { getDb } = require('../../lib/db');
    await createThread('saved-mirror');
    const saved = await addExchange('saved-mirror', 'durable question', 'durable answer', { turnId: 'saved-turn' });
    const write = jest.spyOn(ChatFile.prototype, 'write').mockRejectedValue(new Error('file unavailable'));
    try {
      await expect(manager.syncChatlogMirrorFromHistory('saved-mirror')).rejects.toThrow('file unavailable');
    } finally { write.mockRestore(); }
    expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('failed');
    await closeDb(); await initDb();
    const restarted = new ThreadManager({ projectRoot: tempRoot, workspaceId: 'workspace-chatlog-sync' });
    await restarted.ensureGroupsActivated();
    const history = await restarted.getHistory('saved-mirror');
    expect(history.messages.map((message) => message.content)).toEqual(['durable question', 'durable answer']);
    expect(history.messages[1].metadata.chatMirror).toMatchObject({ exchangeId: saved.exchangeId, seq: saved.seq, turnId: 'saved-turn' });
    expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('complete');
  });

  test('exchange commit before projection is durable across restart and journal failure rolls the exchange back', async () => {
    const { getDb } = require('../../lib/db');
    const journal = require('../../lib/thread/mirror-journal');
    await createThread('crash-mirror');
    const invalidate = jest.spyOn(journal, 'invalidate').mockRejectedValue(new Error('intent unavailable'));
    try {
      await expect(addExchange('crash-mirror', 'rolled back', 'never saved')).rejects.toThrow('intent unavailable');
    } finally { invalidate.mockRestore(); }
    expect(await getDb()('exchanges').where({ thread_id: 'crash-mirror' })).toHaveLength(0);
    await addExchange('crash-mirror', 'committed before crash', 'recovered answer');
    expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('pending');
    // No sync call: simulate process loss immediately after canonical commit.
    await closeDb(); await initDb();
    const restarted = new ThreadManager({ projectRoot: tempRoot, workspaceId: 'workspace-chatlog-sync' });
    await restarted.ensureGroupsActivated();
    expect((await restarted.getHistory('crash-mirror')).messages.map((m) => m.content))
      .toEqual(['committed before crash', 'recovered answer']);
  });

  test('an older export ACK cannot erase a newer exchange write intent', async () => {
    const { ChatFile } = require('../../lib/thread/ChatFile');
    const { getDb } = require('../../lib/db');
    await createThread('race-mirror');
    await addExchange('race-mirror', 'first', 'answer one');
    const original = ChatFile.prototype.write;
    const write = jest.spyOn(ChatFile.prototype, 'write').mockImplementationOnce(async function (...args) {
      await addExchange('race-mirror', 'second', 'answer two');
      return original.apply(this, args);
    });
    try { await manager.syncChatlogMirrorFromHistory('race-mirror'); }
    finally { write.mockRestore(); }
    expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('pending');
    await manager._retryPendingMirrorRecovery();
    expect((await manager.getHistory('race-mirror')).messages.map((m) => m.content))
      .toEqual(['first', 'answer one', 'second', 'answer two']);
    expect((await getDb()('thread_group_mirror_recovery').first()).status).toBe('complete');
  });

});
