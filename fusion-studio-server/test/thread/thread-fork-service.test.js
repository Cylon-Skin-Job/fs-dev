'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-thread-fork-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, getDb, closeDb } = require('../../lib/db');
const { ThreadManager } = require('../../lib/thread/ThreadManager');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const { createPendingForkThread } = require('../../lib/thread/thread-fork-service');

const WORKSPACE_ID = 'workspace-fork-test';

function makeManager() {
  return new ThreadManager({
    projectRoot: path.join(userDataDir, 'workspace'),
    workspaceId: WORKSPACE_ID,
  });
}

async function insertThread({
  threadId,
  name = 'Original Thread',
  workspaceId = WORKSPACE_ID,
  harnessId = 'opencode',
  harnessConfig = { opencodeSessionId: 'ses_source' },
  messageCount = 2,
} = {}) {
  const now = Date.now();
  await getDb()('threads').insert({
    thread_id: threadId,
    workspace_id: workspaceId,
    project_id: 'project-fork-test',
    scope: 'project',
    view_id: null,
    name,
    created_at: new Date(now).toISOString(),
    message_count: messageCount,
    status: 'suspended',
    updated_at: now,
    harness_id: harnessId,
    harness_config: harnessConfig ? JSON.stringify(harnessConfig) : null,
  });
}

async function insertExchange({
  threadId,
  seq,
  ts = Date.now(),
  user = `user ${seq}`,
  assistant = { parts: [{ type: 'text', content: `assistant ${seq}` }] },
  metadata = { bookmark: { title: `Bookmark ${seq}` }, note: `note ${seq}` },
}) {
  const inserted = await getDb()('exchanges').insert({
    thread_id: threadId,
    seq,
    ts,
    user_input: user,
    assistant: JSON.stringify(assistant),
    metadata: JSON.stringify(metadata),
  });
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

describe('thread fork service', () => {
  beforeEach(async () => {
    await initDb();
    threadRuntimeManager.runtimes.clear();
  });

  afterEach(async () => {
    await closeDb();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (previousUserDataDir === undefined) {
      delete process.env.FUSION_APP_USER_DATA;
    } else {
      process.env.FUSION_APP_USER_DATA = previousUserDataDir;
    }
  });

  test('creates a fork thread named from the source thread', async () => {
    await insertThread({ threadId: 'source-thread', name: 'Original Thread', messageCount: 2 });
    await insertExchange({ threadId: 'source-thread', seq: 1 });

    const result = await createPendingForkThread({
      manager: makeManager(),
      sourceThreadId: 'source-thread',
    });

    expect(result.threadId).toEqual(expect.any(String));
    expect(result.thread).toMatchObject({
      name: 'Fork: Original Thread',
      messageCount: 2,
      status: 'suspended',
      harnessId: 'opencode',
    });

    const row = await getDb()('threads').where('thread_id', result.threadId).first();
    expect(row.workspace_id).toBe(WORKSPACE_ID);
    expect(row.name).toBe('Fork: Original Thread');
    expect(row.harness_id).toBe('opencode');
    expect(row.message_count).toBe(2);
  });

  test('stores pendingFork without active opencodeSessionId', async () => {
    await insertThread({ threadId: 'source-thread', harnessConfig: { opencodeSessionId: 'ses_source', other: true } });
    await insertExchange({ threadId: 'source-thread', seq: 1 });

    const result = await createPendingForkThread({
      manager: makeManager(),
      sourceThreadId: 'source-thread',
    });

    expect(result.thread.harnessConfig.opencodeSessionId).toBeUndefined();
    expect(result.thread.harnessConfig.pendingFork).toMatchObject({
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId: 'source-thread',
      sourceThreadName: 'Original Thread',
      sourceExchangeSeq: 1,
      sourceOpenCodeSessionId: 'ses_source',
    });
    expect(result.thread.harnessConfig.forkProvenance).toMatchObject({
      status: 'pending',
      forkThreadId: result.threadId,
      sourceOpenCodeSessionId: 'ses_source',
    });
  });

  test('copies source exchanges with new ids and preserved visible content', async () => {
    await insertThread({ threadId: 'source-thread', messageCount: 4 });
    const firstSourceId = await insertExchange({
      threadId: 'source-thread',
      seq: 1,
      ts: 1001,
      user: 'hello',
      assistant: { parts: [{ type: 'text', content: 'hi' }] },
      metadata: { bookmark: { title: 'Keep' }, note: 'visible note' },
    });
    const secondSourceId = await insertExchange({
      threadId: 'source-thread',
      seq: 2,
      ts: 1002,
      user: 'next',
      assistant: { parts: [{ type: 'text', content: 'second' }] },
      metadata: { tags: ['second'] },
    });

    const result = await createPendingForkThread({
      manager: makeManager(),
      sourceThreadId: 'source-thread',
      sourceExchangeId: firstSourceId,
    });

    const forkRows = await getDb()('exchanges')
      .where('thread_id', result.threadId)
      .orderBy('seq', 'asc');

    expect(forkRows).toHaveLength(1);
    expect(forkRows[0].id).not.toBe(firstSourceId);
    expect(forkRows[0].id).not.toBe(secondSourceId);
    expect(forkRows[0]).toMatchObject({
      thread_id: result.threadId,
      seq: 1,
      ts: 1001,
      user_input: 'hello',
    });
    expect(JSON.parse(forkRows[0].assistant)).toEqual({ parts: [{ type: 'text', content: 'hi' }] });
    expect(JSON.parse(forkRows[0].metadata)).toEqual({
      bookmark: { title: 'Keep' },
      note: 'visible note',
    });
    expect(result.exchanges).toMatchObject([
      {
        seq: 1,
        ts: 1001,
        user: 'hello',
        assistant: { parts: [{ type: 'text', content: 'hi' }] },
        metadata: { bookmark: { title: 'Keep' }, note: 'visible note' },
      },
    ]);

    const chatFile = makeManager()._createChatFile(result.threadId);
    const parsed = await chatFile.read();
    expect(parsed.name).toBe('Fork: Original Thread');
    expect(parsed.messages).toMatchObject([
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content: 'hi',
        metadata: { bookmark: { title: 'Keep' }, note: 'visible note' },
      },
    ]);
  });

  test('rejects a source thread without a saved OpenCode session id', async () => {
    await insertThread({ threadId: 'source-thread', harnessConfig: {} });
    await insertExchange({ threadId: 'source-thread', seq: 1 });

    await expect(createPendingForkThread({
      manager: makeManager(),
      sourceThreadId: 'source-thread',
    })).rejects.toMatchObject({
      code: 'THREAD_FORK_MISSING_SOURCE_SESSION',
      recoverable: true,
    });
  });

  test('rejects a non-OpenCode source thread', async () => {
    await insertThread({
      threadId: 'source-thread',
      harnessId: 'kimi',
      harnessConfig: { opencodeSessionId: 'ses_source' },
    });
    await insertExchange({ threadId: 'source-thread', seq: 1 });

    await expect(createPendingForkThread({
      manager: makeManager(),
      sourceThreadId: 'source-thread',
    })).rejects.toMatchObject({
      code: 'THREAD_FORK_NON_OPENCODE',
      recoverable: true,
    });
  });

  test('rejects a source thread that is not idle', async () => {
    await insertThread({ threadId: 'source-thread' });
    threadRuntimeManager.markState({
      workspaceId: WORKSPACE_ID,
      scope: 'project',
      threadId: 'source-thread',
    }, RUNTIME_STATES.IN_FLIGHT);

    await expect(createPendingForkThread({
      manager: makeManager(),
      sourceThreadId: 'source-thread',
    })).rejects.toMatchObject({
      code: 'THREAD_FORK_SOURCE_BUSY',
      recoverable: true,
    });
  });
});
