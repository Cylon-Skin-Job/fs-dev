'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-history-file-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, getDb, closeDb } = require('../../lib/db');
const { HistoryFile } = require('../../lib/thread/HistoryFile');

describe('HistoryFile', () => {
  beforeEach(async () => {
    await initDb();
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

  test('addExchange returns exchangeId and read returns the same exchangeId', async () => {
    const db = getDb();
    const threadId = 'history-file-thread-1';
    const now = Date.now();

    await db('threads').insert({
      thread_id: threadId,
      workspace_id: 'workspace-test',
      project_id: 'project-test',
      scope: 'project',
      view_id: null,
      name: null,
      created_at: new Date(now).toISOString(),
      message_count: 0,
      status: 'suspended',
      updated_at: now,
      harness_id: 'opencode',
      harness_config: null,
    });

    const historyFile = new HistoryFile(threadId);
    const saved = await historyFile.addExchange(
      threadId,
      'hello',
      [{ type: 'text', content: 'hi' }],
      { source: 'test' }
    );

    expect(saved.exchangeId).toEqual(expect.any(Number));

    const history = await historyFile.read();
    expect(history.exchanges).toHaveLength(1);
    expect(history.exchanges[0]).toMatchObject({
      exchangeId: saved.exchangeId,
      seq: saved.seq,
      user: 'hello',
      metadata: { source: 'test' },
    });
  });
});
