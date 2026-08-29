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
    // SPEC-03 Slice B pinned shape: non-error metadata has NO terminalError key.
    expect('terminalError' in JSON.parse(row.metadata)).toBe(false);
  });

  // ─── SPEC-03 Slice B: error-terminal durability ──────────────────────

  const HOSTILE = 'HOSTILE-STACK /tmp/home/secrets.env REDACTED-STDERR-TAIL';

  function safeEnvelope() {
    return {
      kind: 'runtime',
      code: 'MODEL_RESPONSE_FAILED',
      message: 'The model response failed before it completed.',
      recoverable: true,
    };
  }

  function authEnvelope() {
    return {
      kind: 'authentication',
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed. Check the configured harness credentials and try again.',
      recoverable: true,
    };
  }

  function emitErrorTurnEnd(eventBus, overrides = {}) {
    eventBus.emit('chat:turn_end', {
      workspace: 'workspace:audit',
      workspaceId: 'audit-workspace',
      projectRoot: path.join(tempRoot, 'workspace'),
      scope: 'project',
      threadId: 'audit-thread-err',
      turnId: 'turn-error-1',
      userInput: 'failing prompt',
      fullText: 'partial answer',
      hasToolCalls: false,
      parts: [{ type: 'text', content: 'partial answer' }],
      attachments: [],
      reason: 'error',
      partial: true,
      terminalError: { ...authEnvelope() },
      ...overrides,
    });
  }

  test('an error turn persists EXACTLY ONE exchange whose saved metadata carries ONLY the re-validated safe envelope', async () => {
    const projectRoot = path.join(tempRoot, 'workspace');
    const workspaceId = 'audit-workspace';
    const threadId = 'audit-thread-err';
    fs.mkdirSync(projectRoot, { recursive: true });

    const manager = new modules.ThreadManager({ projectRoot, workspaceId });
    await manager.createThread(threadId, 'Audit Thread', { harnessId: 'opencode' });

    modules.auditSubscriber.startAuditSubscriber();
    const savedPromise = waitForEvent(modules.eventBus.on, 'chat-turn:saved');

    // Bus payload arrives carrying hostile extras alongside a VALID envelope —
    // exactly what the canonical path never produces but a tampered publisher
    // could. Only the validated safe envelope may survive into metadata.
    emitErrorTurnEnd(modules.eventBus, {
      stack: HOSTILE,
      stderrExcerpt: HOSTILE,
      harnessError: { raw: HOSTILE },
    });

    const saved = await savedPromise;
    const db = modules.db.getDb();
    const rows = await db('exchanges').where('thread_id', threadId).select();

    // Exactly one exchange, exactly one save acknowledgement.
    expect(rows).toHaveLength(1);
    const metadata = JSON.parse(rows[0].metadata);

    // The persisted envelope contains ONLY the closed safe fields...
    expect(metadata.terminalError).toEqual(authEnvelope());
    expect(Object.keys(metadata.terminalError).sort()).toEqual([
      'code', 'kind', 'message', 'recoverable',
    ]);
    // ...and NO raw material anywhere in metadata or parts.
    const serializedRow = JSON.stringify(rows[0]);
    expect(serializedRow).not.toContain('HOSTILE');
    expect(serializedRow).not.toContain('stack');
    expect(serializedRow).not.toContain('stderrExcerpt');
    expect(serializedRow).not.toContain('harnessError');

    // Correlation fields on the save acknowledgement.
    expect(saved).toMatchObject({
      threadId,
      turnId: 'turn-error-1',
      seq: 1,
      partial: true,
      reason: 'error',
    });
    expect(saved.metadata.terminalError).toEqual(authEnvelope());
  });

  test('a TAMPERED error envelope (extra keys) is omitted entirely — nothing unsafe is persisted', async () => {
    const projectRoot = path.join(tempRoot, 'workspace');
    const workspaceId = 'audit-workspace';
    const threadId = 'audit-thread-tamper';
    fs.mkdirSync(projectRoot, { recursive: true });

    const manager = new modules.ThreadManager({ projectRoot, workspaceId });
    await manager.createThread(threadId, 'Audit Thread', { harnessId: 'opencode' });

    modules.auditSubscriber.startAuditSubscriber();
    const savedPromise = waitForEvent(modules.eventBus.on, 'chat-turn:saved');

    emitErrorTurnEnd(modules.eventBus, {
      threadId,
      turnId: 'turn-error-tamper',
      userInput: 'tamper probe',
      fullText: '',
      parts: [],
      terminalError: { ...safeEnvelope(), stack: HOSTILE },
    });

    await savedPromise;
    const db = modules.db.getDb();
    const row = await db('exchanges').where('thread_id', threadId).first();
    const metadata = JSON.parse(row.metadata);
    // Validator rejection ⇒ omit (never persist a partially-safe copy).
    expect('terminalError' in metadata).toBe(false);
    expect(JSON.stringify(row)).not.toContain('HOSTILE');
  });

  test('an error terminal carrying a diagnosticId persists it through the existing metadata spread (SPEC-03 Slice C)', async () => {
    const projectRoot = path.join(tempRoot, 'workspace');
    const workspaceId = 'audit-workspace';
    const threadId = 'audit-thread-diag';
    fs.mkdirSync(projectRoot, { recursive: true });

    const manager = new modules.ThreadManager({ projectRoot, workspaceId });
    await manager.createThread(threadId, 'Audit Thread', { harnessId: 'opencode' });

    modules.auditSubscriber.startAuditSubscriber();
    const savedPromise = waitForEvent(modules.eventBus.on, 'chat-turn:saved');

    const envelopeWithId = { ...authEnvelope(), diagnosticId: 'diag-meta-1' };
    emitErrorTurnEnd(modules.eventBus, {
      threadId,
      turnId: 'turn-error-diag',
      terminalError: envelopeWithId,
    });

    const saved = await savedPromise;
    const db = modules.db.getDb();
    const rows = await db('exchanges').where('thread_id', threadId).select();
    expect(rows).toHaveLength(1);
    // The optional opaque diagnosticId survives re-validation and lands in
    // persisted exchange metadata AND the save acknowledgement.
    expect(JSON.parse(rows[0].metadata).terminalError).toEqual(envelopeWithId);
    expect(saved.metadata.terminalError).toEqual(envelopeWithId);
    // The report itself is NOT here — metadata holds only the envelope + ID.
    expect(JSON.stringify(rows[0])).not.toContain('report');
  });

  test('save race: the retained error snapshot survives until the save acknowledgement merges durable identity', async () => {
    const projectRoot = path.join(tempRoot, 'workspace');
    const workspaceId = 'audit-workspace';
    const threadId = 'audit-thread-overlay';
    fs.mkdirSync(projectRoot, { recursive: true });

    const manager = new modules.ThreadManager({ projectRoot, workspaceId });
    await manager.createThread(threadId, 'Audit Thread', { harnessId: 'opencode' });

    // Real canonical chain in this fresh registry: claim → begin → partial
    // output → error turn_end through the SAME sequenced terminal path.
    const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
    const {
      createCanonicalDrainControl,
      createCanonicalRouteContext,
    } = require('../../lib/thread/canonical-drain-context');
    const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');
    let turnCounter = 0;
    const applier = createCanonicalChatEventApplier({
      emit: modules.eventBus.emit,
      checkSettingsBounce: () => null,
      generateTurnId: () => `server-turn-${++turnCounter}`,
    });

    modules.auditSubscriber.startAuditSubscriber();
    const savedPromise = waitForEvent(modules.eventBus.on, 'chat-turn:saved');

    const runtimeKey = { workspaceId, scope: 'project', threadId };
    const routeContext = createCanonicalRouteContext({
      workspaceId,
      workspace: `workspace:${workspaceId}`,
      projectRoot,
      scope: 'project',
      threadId,
      acceptedUserInput: 'race probe',
      attachments: [],
    });
    const control = createCanonicalDrainControl({
      drainId: 'drain-race',
      runtimeKey,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    });
    threadRuntimeManager.claimActiveDrain(runtimeKey, control, routeContext);
    const drainContext = { route: routeContext, control };
    // Bridge-shaped begin: apply, then bind-once on acceptance.
    const begun = applier.applyChatEvent({ type: 'turn_begin', payload: {} }, null, drainContext);
    expect(begun.accepted).toBe(true);
    expect(threadRuntimeManager.bindTurnToDrain(runtimeKey, control.drainId, begun.turnId)).toBe(true);
    applier.applyChatEvent({ type: 'content', payload: { text: 'partial answer' } }, null, drainContext);
    applier.applyChatEvent({
      type: 'turn_end',
      payload: { reason: 'error', partial: true, terminalError: safeEnvelope() },
    }, null, drainContext);

    // BEFORE the save lands: the retained runtime snapshot already exposes
    // status 'error' + terminalError (the thread:open overlay source).
    const overlayBeforeSave = threadRuntimeManager.getLiveTurn(runtimeKey);
    expect(overlayBeforeSave.status).toBe('error');
    expect(overlayBeforeSave.terminalError).toEqual(safeEnvelope());
    expect(overlayBeforeSave.fullText).toBe('partial answer');

    const saved = await savedPromise;

    // AFTER the acknowledgement: same single retained snapshot — R6 keeps the
    // error-terminal state through the durable-save race; no second exchange.
    const overlayAfterSave = threadRuntimeManager.getLiveTurn(runtimeKey);
    expect(overlayAfterSave.status).toBe('error');
    expect(overlayAfterSave.terminalError).toEqual(safeEnvelope());
    expect(overlayAfterSave.turnId).toBe(saved.turnId);

    const db = modules.db.getDb();
    const rows = await db('exchanges').where('thread_id', threadId).select();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].metadata).terminalError).toEqual(safeEnvelope());
    expect(saved.metadata.terminalError).toEqual(safeEnvelope());
  });
});
