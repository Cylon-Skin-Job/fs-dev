'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function waitForEvent(on, type) {
  let unsubscribe = () => {};
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${type}`));
    }, 5000);
    unsubscribe = on(type, (event) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(event);
    });
  });
}

async function waitForCondition(fn, label) {
  const deadline = Date.now() + 5000;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await fn();
    if (lastValue) return lastValue;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

describe('audit subscriber chatlog finalization', () => {
  let tempRoot;
  let modules;
  let previousUserData;
  let previousMachine;

  beforeEach(async () => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-audit-chatlog-finalize-'));
    previousUserData = process.env.FUSION_APP_USER_DATA;
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_APP_USER_DATA = path.join(tempRoot, 'user-data');
    process.env.FUSION_LOCAL_MACHINE = 'Audit Machine';

    modules = {
      db: require('../../lib/db'),
      eventBus: require('../../lib/event-bus'),
      auditSubscriber: require('../../lib/audit/audit-subscriber'),
      ThreadManager: require('../../lib/thread/ThreadManager').ThreadManager,
    };
    await modules.db.initDb();
  });

  afterEach(async () => {
    modules?.auditSubscriber.stopAuditSubscriber();
    modules?.eventBus.bus.removeAllListeners();
    await modules?.db.closeDb();
    if (previousUserData === undefined) {
      delete process.env.FUSION_APP_USER_DATA;
    } else {
      process.env.FUSION_APP_USER_DATA = previousUserData;
    }
    if (previousMachine === undefined) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = previousMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  test('turn_end saves SQLite exchange, corrects message count, and rewrites markdown mirror', async () => {
    const projectRoot = path.join(tempRoot, 'workspace');
    const workspaceId = 'audit-workspace';
    const threadId = 'audit-thread-1';
    fs.mkdirSync(projectRoot, { recursive: true });

    const manager = new modules.ThreadManager({ projectRoot, workspaceId });
    await manager.createThread(threadId, 'Audit Thread', { harnessId: 'opencode' });
    const chatFile = manager._createChatFile(threadId);
    await chatFile.write('Audit Thread', [
      { role: 'user', content: 'stale markdown', hasToolCalls: false },
    ]);

    modules.auditSubscriber.startAuditSubscriber();
    const savedPromise = waitForEvent(modules.eventBus.on, 'chat-turn:saved');

    modules.eventBus.emit('chat:status_update', {
      workspace: 'workspace:audit',
      workspaceId,
      projectRoot,
      scope: 'project',
      threadId,
      messageId: 'msg-audit',
      planMode: true,
      contextUsage: 42,
      tokenUsage: { output: 5 },
    });

    modules.eventBus.emit('chat:turn_end', {
      workspace: 'workspace:audit',
      workspaceId,
      projectRoot,
      scope: 'project',
      threadId,
      turnId: 'turn-audit',
      userInput: 'real prompt',
      fullText: 'real answer',
      hasToolCalls: false,
      parts: [{ type: 'text', content: 'real answer' }],
      attachments: [],
      reason: 'complete',
      partial: false,
    });

    const saved = await savedPromise;

    const db = modules.db.getDb();
    const row = await db('exchanges').where('thread_id', threadId).first();
    const entry = await waitForCondition(async () => {
      const nextEntry = await manager.index.get(threadId);
      return nextEntry.messageCount === 2 ? nextEntry : null;
    }, 'message count correction');
    const parsed = await waitForCondition(async () => {
      const nextParsed = await chatFile.readPrimary();
      return nextParsed?.messages?.length === 2 ? nextParsed : null;
    }, 'chatlog mirror rewrite');

    expect(saved).toMatchObject({
      threadId,
      turnId: 'turn-audit',
      seq: 1,
      partial: false,
      reason: 'complete',
    });
    expect(row).toMatchObject({
      thread_id: threadId,
      seq: 1,
      user_input: 'real prompt',
    });
    expect(JSON.parse(row.metadata)).toMatchObject({
      messageId: 'msg-audit',
      planMode: true,
      contextUsage: 42,
      tokenUsage: { output: 5 },
      turnId: 'turn-audit',
      reason: 'complete',
      partial: false,
    });
    expect(entry.messageCount).toBe(2);
    expect(parsed.messages.map((message) => `${message.role}:${message.content}`)).toEqual([
      'user:real prompt',
      'assistant:real answer',
    ]);
    expect(parsed.messages[1].metadata).toMatchObject({
      turnId: 'turn-audit',
      chatMirror: {
        threadId,
        exchangeId: row.id,
        seq: 1,
        turnId: 'turn-audit',
      },
    });
  });
});
