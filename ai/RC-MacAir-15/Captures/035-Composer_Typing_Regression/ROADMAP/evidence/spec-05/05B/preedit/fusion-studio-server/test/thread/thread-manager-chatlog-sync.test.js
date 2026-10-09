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
});
