'use strict';

/**
 * Public chat-turn:diagnostic:get route integration tests
 * (RCC-0108 SPEC-03 Slice D; SPEC §6 public-route bullet).
 *
 * Real chain under test:
 *   client-message-router (chat-turn:diagnostic: dispatch, ahead of metadata)
 *     -> chat-turn-diagnostic-handlers (server-side workspace resolution)
 *       -> harness-diagnostic-service.getDiagnosticReport (real Slice C service)
 *         -> real migration-034 table in a real temp SQLite DB
 *
 * Mocked infrastructure edges ONLY (pattern:
 * test/ws/prompt-canonical-route.integration.test.js):
 *   - ThreadWebSocketHandler (per-connection state edge)
 *   - thread-ws-handlers (thread lifecycle edge)
 *   - exchange-metadata-update-service (metadata persistence edge; a spy
 *     proving diagnostic traffic never reaches metadata-update handling)
 */

jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({
  getState: jest.fn(),
  handleMessageSend: jest.fn(),
  getCurrentThreadManager: jest.fn(() => null),
  getCurrentThreadId: jest.fn(() => null),
}));

jest.mock('../../lib/ws/thread-ws-handlers', () => ({
  createThreadWsHandlers: jest.fn(() => ({})),
  spawnAndSetupWire: jest.fn(),
}));

jest.mock('../../lib/chat-metadata/exchange-metadata-update-service', () => ({
  updateExchangeMetadata: jest.fn(),
}));

// The 'uuid' package is ESM-only under Jest (see
// thread-runtime-controller's crypto.randomUUID precedent).
let mockIdCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `gen-${Math.random().toString(36).slice(2, 10)}-${++mockIdCounter}`,
}));

const fs = require('fs');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-diag-route-'));
const previousUserData = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = path.join(tempRoot, 'user-data');

const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { updateExchangeMetadata } = require('../../lib/chat-metadata/exchange-metadata-update-service');
const { createClientMessageRouter } = require('../../lib/ws/client-message-router');
const dbModule = require('../../lib/db');
const diagnosticService = require('../../lib/thread/harness-diagnostic-service');

const WORKSPACE_ID = 'ws-route';
const THREAD_ID = 'thread-route';
const TURN_ID = 'turn-route';
const CANARY = 'ROUTE-CANARY-REPORT-BODY-91c2';

function validCandidate(overrides = {}) {
  return {
    version: 1,
    harnessId: 'opencode',
    category: 'process_exit',
    exitCode: 1,
    message: CANARY,
    hadRenderableOutput: true,
    hadToolCalls: false,
    truncatedFields: [],
    ...overrides,
  };
}

describe('public chat-turn:diagnostic:get route (SPEC-03 Slice D)', () => {
  let ws;
  let router;
  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeAll(async () => {
    await dbModule.initDb();
  });

  afterAll(async () => {
    await dbModule.closeDb();
    if (previousUserData === undefined) {
      delete process.env.FUSION_APP_USER_DATA;
    } else {
      process.env.FUSION_APP_USER_DATA = previousUserData;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    ws = { readyState: 1, send: jest.fn() };
    const session = {
      connectionId: 'conn-diag-route',
      currentWorkspaceId: WORKSPACE_ID,
      projectRoot: '/tmp/diag-route-project',
      currentThreadId: null,
      currentScope: null,
      currentViewId: null,
      wire: null,
      buffer: '',
    };
    // Per-connection thread state: the thread manager carries the
    // server-authoritative workspace binding.
    ThreadWebSocketHandler.getState.mockReturnValue({
      panelId: 'panel-1',
      viewName: 'view-1',
      threadId: THREAD_ID,
      threadManager: { workspaceId: WORKSPACE_ID },
    });

    router = createClientMessageRouter({
      ws,
      session,
      connectionId: session.connectionId,
      projectRoot: session.projectRoot,
      fileExplorer: {},
      wireLifecycle: {
        awaitHarnessReady: jest.fn(),
        initializeWire: jest.fn(),
        setupWireHandlers: jest.fn(),
      },
      sessions: new Map([[ws, session]]),
      setSessionRoot: jest.fn(),
      clearSessionRoot: jest.fn(),
      getProjectRoot: () => session.projectRoot,
      getFusionHandlers: () => ({}),
      getClipboardHandlers: () => ({}),
      getBookmarksHandlers: () => ({}),
      getThemeHandlers: () => ({}),
      getSecretsHandlers: () => ({}),
      getScreenshotHandlers: () => ({}),
      handleCanonicalHarnessEvent: jest.fn(),
    });
  });

  afterEach(async () => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    await dbModule.getDb()(diagnosticService.TABLE).del();
  });

  async function send(payload) {
    await router.handleClientMessage(JSON.stringify(payload));
  }

  function sentMessages() {
    return ws.send.mock.calls.map((call) => JSON.parse(call[0]));
  }

  function getRequest(overrides = {}) {
    return {
      type: 'chat-turn:diagnostic:get',
      threadId: THREAD_ID,
      turnId: TURN_ID,
      diagnosticId: 'diag-x',
      ...overrides,
    };
  }

  async function seedReport(overrides = {}) {
    return diagnosticService.persistDiagnosticReport(
      { workspaceId: WORKSPACE_ID, threadId: THREAD_ID, turnId: TURN_ID },
      validCandidate(overrides),
    );
  }

  function consoleOutput() {
    return JSON.stringify([
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
  }

  test('(a)+(b) registered and routed: success through the real router/handler/service/DB boundary', async () => {
    const diagnosticId = await seedReport();
    expect(diagnosticId).toMatch(/^[0-9a-f-]{36}$/);

    await send(getRequest({ diagnosticId }));

    const messages = sentMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      type: 'chat-turn:diagnostic:report',
      threadId: THREAD_ID,
      turnId: TURN_ID,
      diagnosticId,
      report: validCandidate(),
    });
    // At most ONE validated ≤24 KiB report per request.
    expect(Buffer.byteLength(JSON.stringify(messages[0].report), 'utf8')).toBeLessThanOrEqual(24576);
    // Report contents never reach server logs (roadmap §5.5).
    expect(consoleOutput()).not.toContain(CANARY);
  });

  test('(c) missing and expired records yield the ONE fixed value-free unavailable response', async () => {
    const diagnosticId = await seedReport();
    // Expire the row directly (migration-real table, service-real seed).
    await dbModule.getDb()(diagnosticService.TABLE)
      .where('diagnostic_id', diagnosticId)
      .update({ expires_at: Date.now() - 1000 });

    await send(getRequest({ diagnosticId: 'does-not-exist' }));
    await send(getRequest({ diagnosticId })); // expired

    const messages = sentMessages();
    expect(messages).toEqual([
      { type: 'chat-turn:diagnostic:unavailable', threadId: THREAD_ID, turnId: TURN_ID, diagnosticId: 'does-not-exist' },
      { type: 'chat-turn:diagnostic:unavailable', threadId: THREAD_ID, turnId: TURN_ID, diagnosticId },
    ]);
    // Identical shape regardless of cause; no report content, no reason.
    for (const message of messages) {
      expect(Object.keys(message).sort()).toEqual(['diagnosticId', 'threadId', 'turnId', 'type']);
    }
    expect(JSON.stringify(messages)).not.toContain(CANARY);
  });

  test('(d) ownership-denied: cross-workspace/thread/turn/ID all yield the same fixed unavailable', async () => {
    const diagnosticId = await seedReport();

    await send(getRequest({ diagnosticId, workspaceId: 'ws-other' })); // client mismatch vs server-resolved
    await send(getRequest({ diagnosticId, threadId: 'thread-other' }));
    await send(getRequest({ diagnosticId, turnId: 'turn-other' }));
    await send(getRequest({ diagnosticId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }));

    const messages = sentMessages();
    expect(messages).toHaveLength(4);
    for (const message of messages) {
      expect(message.type).toBe('chat-turn:diagnostic:unavailable');
      expect(Object.keys(message).sort()).toEqual(['diagnosticId', 'threadId', 'turnId', 'type']);
    }
    expect(JSON.stringify(messages)).not.toContain(CANARY);
  });

  test('(e) malformed request returns the fixed unavailable and never reaches metadata-update handling', async () => {
    await send({ type: 'chat-turn:diagnostic:get' }); // every field missing
    await send({ type: 'chat-turn:diagnostic:get', threadId: THREAD_ID }); // partial

    const messages = sentMessages();
    expect(messages).toEqual([
      { type: 'chat-turn:diagnostic:unavailable', threadId: null, turnId: null, diagnosticId: null },
      { type: 'chat-turn:diagnostic:unavailable', threadId: THREAD_ID, turnId: null, diagnosticId: null },
    ]);
    expect(updateExchangeMetadata).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).not.toContain('metadata');
  });

  test('(f) unknown diagnostic and unknown chat-turn types return no report and no metadata handling', async () => {
    await seedReport();
    await send({ type: 'chat-turn:diagnostic:bogus', threadId: THREAD_ID, turnId: TURN_ID, diagnosticId: 'x' });
    await send({ type: 'chat-turn:unknown:thing', threadId: THREAD_ID });

    expect(sentMessages()).toEqual([]);
    expect(updateExchangeMetadata).not.toHaveBeenCalled();
    expect(consoleOutput()).not.toContain(CANARY);
  });

  test('regression: chat-turn:metadata:update still routes to the metadata handler', async () => {
    updateExchangeMetadata.mockResolvedValue({
      threadId: THREAD_ID,
      exchangeId: 'ex-1',
      metadata: { note: { body: 'hello' } },
    });

    await send({
      type: 'chat-turn:metadata:update',
      threadId: THREAD_ID,
      exchangeId: 'ex-1',
      patch: { note: { body: 'hello' } },
    });

    expect(updateExchangeMetadata).toHaveBeenCalledTimes(1);
    expect(sentMessages()).toEqual([{
      type: 'chat-turn:metadata:updated',
      threadId: THREAD_ID,
      exchangeId: 'ex-1',
      metadata: { note: { body: 'hello' } },
    }]);
  });

  test('structural: diagnostic dispatch precedes metadata dispatch; no metadata fallthrough vocabulary', () => {
    const routerSource = fs.readFileSync(
      path.join(__dirname, '../../lib/ws/client-message-router.js'), 'utf8',
    );
    const diagnosticAt = routerSource.indexOf("startsWith('chat-turn:diagnostic:')");
    const metadataAt = routerSource.indexOf("chatTurnMetadataHandlers[clientMsg.type]");
    expect(diagnosticAt).toBeGreaterThan(-1);
    expect(metadataAt).toBeGreaterThan(-1);
    expect(diagnosticAt).toBeLessThan(metadataAt);
  });

  test('absence sweep: no thread-open/history/lifecycle/metadata path reads the diagnostic table or service', () => {
    const files = [
      'lib/thread/thread-crud.js',
      'lib/thread/thread-messages.js',
      'lib/thread/ThreadWebSocketHandler.js',
      'lib/thread/live-turn-snapshot.js',
      'lib/audit/audit-subscriber.js',
      'lib/wire/wire-broadcaster.js',
      'lib/ws/chat-turn-metadata-handlers.js',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(codeOnly).not.toContain('harness_error_diagnostics');
      expect(codeOnly).not.toContain('harness-diagnostic-service');
      expect(codeOnly).not.toContain('getDiagnosticReport');
      expect(codeOnly).not.toContain('report_json');
      expect(codeOnly).not.toContain('diagnostic:report');
    }
  });
});
