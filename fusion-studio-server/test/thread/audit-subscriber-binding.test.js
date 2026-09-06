'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function waitForEvent(on, type) {
  let unsubscribe = () => {};
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${type}`));
    }, 5_000);
    unsubscribe = on(type, (event) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(event);
    });
  });
}

describe('audit subscriber exchange-binding adapter', () => {
  let root;
  let previousUserData;
  let dbModule;
  let eventBus;
  let auditSubscriber;

  beforeEach(async () => {
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-audit-binding-'));
    previousUserData = process.env.FUSION_APP_USER_DATA;
    process.env.FUSION_APP_USER_DATA = path.join(root, 'user-data');
    dbModule = require('../../lib/db');
    eventBus = require('../../lib/event-bus');
    auditSubscriber = require('../../lib/audit/audit-subscriber');
    await dbModule.initDb();
    await dbModule.getDb()('threads').insert({
      thread_id: 'thread-1', workspace_id: 'workspace-1', project_id: 'project-1', scope: 'project',
      view_id: null, name: 'Thread', created_at: new Date(1).toISOString(), message_count: 0,
      status: 'suspended', updated_at: 1, harness_id: 'opencode', harness_config: null,
    });
  });

  afterEach(async () => {
    auditSubscriber?.stopAuditSubscriber();
    eventBus?.bus.removeAllListeners();
    await dbModule?.closeDb();
    if (previousUserData === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousUserData;
    fs.rmSync(root, { recursive: true, force: true });
    jest.resetModules();
  });

  function emitTurn(overrides = {}) {
    eventBus.emit('chat:turn_end', {
      workspace: 'workspace:1', projectRoot: null, scope: 'project', threadId: 'thread-1',
      turnId: 'turn-1', userInput: 'prompt', parts: [{ type: 'text', content: 'answer' }],
      reason: 'complete', partial: false, ...overrides,
    });
  }

  test('enabled binding preserves a legacy exchange that has no workspace authority', async () => {
    auditSubscriber.startAuditSubscriber({ enableAgentExchangeBinding: true });
    const saved = waitForEvent(eventBus.on, 'chat-turn:saved');
    emitTurn({ workspaceId: undefined });
    await expect(saved).resolves.toMatchObject({ threadId: 'thread-1', turnId: 'turn-1' });
    await expect(dbModule.getDb()('exchanges')).resolves.toHaveLength(1);
    await expect(dbModule.getDb()('agent_exchange_bind_jobs')).resolves.toHaveLength(0);
  });

  test('enabled binding inserts a durable job when canonical workspace/turn authority is present', async () => {
    const repository = require('../../lib/agent-provenance/exchange-bind-repository')
      .createAgentExchangeBindRepository(dbModule.getDb());
    const signal = jest.fn();
    require('../../lib/thread/HistoryFile').installAgentExchangeBinding({
      insertInTransaction: repository.insertInTransaction,
      signal,
    });
    auditSubscriber.startAuditSubscriber({ enableAgentExchangeBinding: true });
    const saved = waitForEvent(eventBus.on, 'chat-turn:saved');
    emitTurn({ workspaceId: 'workspace-1' });
    const event = await saved;
    await expect(dbModule.getDb()('agent_exchange_bind_jobs')).resolves.toEqual([
      expect.objectContaining({
        exchange_id: event.exchangeId, workspace_id: 'workspace-1', thread_id: 'thread-1',
        turn_id: 'turn-1', state: 'pending',
      }),
    ]);
    expect(signal).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['normal', { reason: 'complete', partial: false }],
    ['interrupted', { reason: 'interrupted', partial: true }],
  ])('drain owns a held real %s exchange transaction through its late binder signal', async (_label, turn) => {
    const repository = require('../../lib/agent-provenance/exchange-bind-repository')
      .createAgentExchangeBindRepository(dbModule.getDb());
    const binder = require('../../lib/agent-provenance/exchange-binder')
      .createAgentExchangeBinder(repository);
    await binder.start();
    let releaseWriter;
    let markWriterStarted;
    const writerStarted = new Promise((resolve) => { markWriterStarted = resolve; });
    const signal = jest.fn(() => binder.signal());
    require('../../lib/thread/HistoryFile').installAgentExchangeBinding({
      async insertInTransaction(trx, input) {
        markWriterStarted();
        await new Promise((resolve) => { releaseWriter = resolve; });
        return repository.insertInTransaction(trx, input);
      },
      signal,
    });
    auditSubscriber.startAuditSubscriber({ enableAgentExchangeBinding: true });
    const saved = waitForEvent(eventBus.on, 'chat-turn:saved');
    emitTurn({ workspaceId: 'workspace-1', ...turn });
    await writerStarted;
    let drainSettled = false;
    const drain = auditSubscriber.drainAuditSaves({ timeoutMs: 1_000 })
      .then((result) => { drainSettled = true; return result; });
    await Promise.resolve();
    expect(drainSettled).toBe(false);
    expect(signal).not.toHaveBeenCalled();
    releaseWriter();
    await expect(drain).resolves.toEqual({ drained: true });
    await expect(saved).resolves.toMatchObject(turn);
    expect(signal).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await expect(dbModule.getDb()('agent_exchange_bind_jobs')).resolves.toEqual([
      expect.objectContaining({ state: 'applied' }),
    ]);
    await binder.shutdown();

    let closed = false;
    let postCloseSql = 0;
    const countLateSql = () => { if (closed) postCloseSql += 1; };
    dbModule.getDb().on('query', countLateSql);
    closed = true;
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    dbModule.getDb().removeListener('query', countLateSql);
    expect(postCloseSql).toBe(0);
  });

  test('drain timeout remains non-success until the held save settles', async () => {
    let releaseSave;
    let markSaveStarted;
    const saveStarted = new Promise((resolve) => { markSaveStarted = resolve; });
    const HistoryFile = require('../../lib/thread/HistoryFile').HistoryFile;
    jest.spyOn(HistoryFile.prototype, 'addExchange').mockImplementation(async () => {
      markSaveStarted();
      await new Promise((resolve) => { releaseSave = resolve; });
      return { exchangeId: 1, seq: 1, ts: 1 };
    });
    auditSubscriber.startAuditSubscriber({ enableAgentExchangeBinding: true });
    emitTurn({ workspaceId: 'workspace-1' });
    await saveStarted;
    const timers = [];
    const drain = auditSubscriber.drainAuditSaves({
      timeoutMs: 1,
      monotonicNow: () => 0,
      setTimer(callback) {
        const timer = { callback, unref: jest.fn() };
        timers.push(timer);
        return timer;
      },
      clearTimer: jest.fn(),
    });
    timers[0].callback();
    await expect(drain).resolves.toEqual({ drained: false });
    releaseSave();
    await new Promise((resolve) => setImmediate(resolve));
    await expect(auditSubscriber.drainAuditSaves({ timeoutMs: 1_000 })).resolves.toEqual({ drained: true });
  });

  test('save failure is retained and rejects the shutdown drain', async () => {
    const failure = new Error('exchange write failed');
    const HistoryFile = require('../../lib/thread/HistoryFile').HistoryFile;
    jest.spyOn(HistoryFile.prototype, 'addExchange').mockRejectedValue(failure);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      auditSubscriber.startAuditSubscriber({ enableAgentExchangeBinding: true });
      emitTurn({ workspaceId: 'workspace-1' });
      await new Promise((resolve) => setImmediate(resolve));
      await expect(auditSubscriber.drainAuditSaves({ timeoutMs: 1_000 })).rejects.toBe(failure);
    } finally {
      errorLog.mockRestore();
    }
  });
});
