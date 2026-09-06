'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-history-file-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

const { initDb, getDb, closeDb } = require('../../lib/db');
const { HistoryFile, installAgentExchangeBinding } = require('../../lib/thread/HistoryFile');
const { createAgentExchangeBindRepository } = require('../../lib/agent-provenance/exchange-bind-repository');
const { insertTerminalActivity } = require('../agent-provenance/helpers');

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

  test('tool exchange and bind job commit together with distinct metadata/save/bind clocks', async () => {
    const db = getDb();
    const threadId = 'history-file-thread-bound';
    await db('threads').insert({
      thread_id: threadId, workspace_id: 'workspace-1', project_id: 'project-test', scope: 'project',
      view_id: null, name: null, created_at: new Date(1).toISOString(), message_count: 0,
      status: 'suspended', updated_at: 1, harness_id: 'opencode', harness_config: null,
    });
    await insertTerminalActivity(db, { threadId, turnId: 'turn-1' });
    await db('exchanges').insert({
      thread_id: threadId, seq: 1, ts: 50, user_input: 'historical',
      assistant: '{"parts":[]}', metadata: '{"savedAt":49}',
    });
    const signal = jest.fn();
    const repository = createAgentExchangeBindRepository(db, { now: () => 333 });
    installAgentExchangeBinding({ insertInTransaction: repository.insertInTransaction, signal });
    const now = jest.spyOn(Date, 'now').mockReturnValue(222);
    try {
      const saved = await new HistoryFile(threadId).addExchange(
        threadId,
        'tool prompt',
        [{
          type: 'tool_call', toolCallId: 'call-1',
          terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true,
        }],
        { savedAt: 111 },
        { workspaceId: 'workspace-1', turnId: 'turn-1' },
      );
      expect(saved).toMatchObject({ seq: 2, ts: 222 });
      expect(signal).toHaveBeenCalledTimes(1);
      expect(await db('agent_exchange_bind_jobs')).toEqual([
        expect.objectContaining({ exchange_id: saved.exchangeId, exchange_saved_at: 222, state: 'pending' }),
      ]);
      expect(JSON.parse((await db('exchanges').where({ id: saved.exchangeId }).first()).metadata)).toEqual({ savedAt: 111 });
      await expect(repository.bindNext()).resolves.toMatchObject({ state: 'applied', boundActivities: 1 });
      await expect(db('agent_tool_activities').first()).resolves.toMatchObject({
        exchange_id: saved.exchangeId, exchange_saved_at: 222, exchange_bound_at: 333,
      });
      expect(await db('agent_exchange_bind_jobs')).toHaveLength(1);

      await expect(new HistoryFile(threadId).addExchange(
        threadId, 'bad authority', [], {}, { workspaceId: '', turnId: 'turn-2' },
      )).rejects.toThrow();
      expect(await db('exchanges').where({ thread_id: threadId })).toHaveLength(2);
      expect(signal).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });
});
