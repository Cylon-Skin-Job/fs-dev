'use strict';

/**
 * Handler-level tests for chat-turn:diagnostic:get
 * (RCC-0108 SPEC-03 Slice D; parent §4.13.1; SPEC §6 Slice-D bullets).
 *
 * The focused handler module is exercised directly with injected
 * getThreadState/getReport seams. Routing through the real client message
 * router and the real handler/service/DB boundary is covered by
 * test/ws/chat-turn-diagnostic-route.integration.test.js.
 */

const { createChatTurnDiagnosticHandlers } = require('../../lib/ws/chat-turn-diagnostic-handlers');

const WORKSPACE_ID = 'ws-server';
const THREAD_ID = 'thread-1';
const TURN_ID = 'turn-1';
const DIAGNOSTIC_ID = 'diag-1';

const CANARY = 'CANARY-REPORT-BODY-7f3d';

function validReport() {
  return Object.freeze({
    version: 1,
    harnessId: 'opencode',
    category: 'process_exit',
    exitCode: 1,
    message: CANARY,
    hadRenderableOutput: true,
    hadToolCalls: false,
    truncatedFields: Object.freeze([]),
  });
}

function makeHarness(options = {}) {
  const ws = { readyState: 1, send: jest.fn() };
  const reportStub = options.getReport || jest.fn(async () => Object.freeze({ status: 'unavailable' }));
  const hasState = Object.prototype.hasOwnProperty.call(options, 'state');
  const stateStub = jest.fn(() => (hasState ? options.state : { threadManager: { workspaceId: WORKSPACE_ID } }));
  const handlers = createChatTurnDiagnosticHandlers({
    ws,
    getThreadState: stateStub,
    getReport: reportStub,
  });
  return { ws, handlers, reportStub, stateStub };
}

function sentMessages(ws) {
  return ws.send.mock.calls.map((call) => JSON.parse(call[0]));
}

function getRequest(overrides = {}) {
  return {
    type: 'chat-turn:diagnostic:get',
    threadId: THREAD_ID,
    turnId: TURN_ID,
    diagnosticId: DIAGNOSTIC_ID,
    ...overrides,
  };
}

describe('chat-turn diagnostic handlers (SPEC-03 Slice D)', () => {
  test('exposes a type-keyed handler map for chat-turn:diagnostic:get only', () => {
    const { handlers } = makeHarness();
    expect(Object.keys(handlers)).toEqual(['chat-turn:diagnostic:get']);
  });

  test('success returns exactly one response carrying the validated report with route echoes', async () => {
    const report = validReport();
    const reportJson = JSON.stringify(report);
    const { ws, handlers, reportStub } = makeHarness({
      getReport: jest.fn(async () => Object.freeze({ status: 'available', report, reportJson })),
    });

    await handlers['chat-turn:diagnostic:get'](getRequest());

    expect(reportStub).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID, // server-resolved, not client-supplied
      threadId: THREAD_ID,
      turnId: TURN_ID,
      diagnosticId: DIAGNOSTIC_ID,
    });
    const messages = sentMessages(ws);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      type: 'chat-turn:diagnostic:report',
      threadId: THREAD_ID,
      turnId: TURN_ID,
      diagnosticId: DIAGNOSTIC_ID,
      report: validReport(),
    });
    expect(Buffer.byteLength(JSON.stringify(messages[0].report), 'utf8')).toBeLessThanOrEqual(24576);
  });

  test('a client-supplied workspaceId that agrees with the server-resolved value is accepted', async () => {
    const { ws, handlers, reportStub } = makeHarness();
    await handlers['chat-turn:diagnostic:get'](getRequest({ workspaceId: WORKSPACE_ID }));
    expect(reportStub).toHaveBeenCalled();
    expect(sentMessages(ws)).toEqual([{
      type: 'chat-turn:diagnostic:unavailable',
      threadId: THREAD_ID,
      turnId: TURN_ID,
      diagnosticId: DIAGNOSTIC_ID,
    }]);
  });

  const fixedUnavailable = {
    type: 'chat-turn:diagnostic:unavailable',
    threadId: THREAD_ID,
    turnId: TURN_ID,
    diagnosticId: DIAGNOSTIC_ID,
  };

  test.each([
    ['cross-workspace client mismatch', getRequest({ workspaceId: 'ws-other' }), false],
    ['non-string client workspaceId', getRequest({ workspaceId: 42 }), false],
    ['null client workspaceId', getRequest({ workspaceId: null }), false],
    ['service unavailable outcome', getRequest(), true],
  ])('denial: %s → ONE fixed value-free unavailable response', async (label, request, callsService) => {
    const { ws, handlers, reportStub } = makeHarness();
    await handlers['chat-turn:diagnostic:get'](request);

    const messages = sentMessages(ws);
    expect(messages).toEqual([fixedUnavailable]);
    // Identical shape regardless of cause: no reason/code/detail fields.
    expect(Object.keys(messages[0]).sort()).toEqual(['diagnosticId', 'threadId', 'turnId', 'type']);
    expect(JSON.stringify(messages[0])).not.toContain(CANARY);
    expect(reportStub.mock.calls.length > 0).toBe(callsService);
  });

  test.each([
    ['missing threadId', { threadId: undefined }],
    ['missing turnId', { turnId: undefined }],
    ['missing diagnosticId', { diagnosticId: undefined }],
    ['empty threadId', { threadId: '' }],
    ['non-string turnId', { turnId: 7 }],
  ])('malformed request (%s) → fixed unavailable, service never called', async (label, patch) => {
    const { ws, handlers, reportStub } = makeHarness();
    const request = getRequest(patch);
    for (const key of Object.keys(patch)) {
      if (patch[key] === undefined) delete request[key];
    }
    await handlers['chat-turn:diagnostic:get'](request);

    expect(reportStub).not.toHaveBeenCalled();
    const messages = sentMessages(ws);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      type: 'chat-turn:diagnostic:unavailable',
      threadId: typeof request.threadId === 'string' && request.threadId ? request.threadId : null,
      turnId: typeof request.turnId === 'string' && request.turnId ? request.turnId : null,
      diagnosticId: typeof request.diagnosticId === 'string' && request.diagnosticId ? request.diagnosticId : null,
    });
  });

  test.each([
    ['no connection state', undefined],
    ['no thread manager', { threadManager: null }],
    ['manager without workspaceId', { threadManager: {} }],
  ])('unresolvable server workspace (%s) → fixed unavailable, service never called', async (label, state) => {
    const { ws, handlers, reportStub } = makeHarness({ state });
    await handlers['chat-turn:diagnostic:get'](getRequest());

    expect(reportStub).not.toHaveBeenCalled();
    expect(sentMessages(ws)).toEqual([fixedUnavailable]);
  });

  test('service failure (throw) collapses to the same fixed unavailable response', async () => {
    const { ws, handlers } = makeHarness({
      getReport: jest.fn(async () => { throw new Error(`db exploded with ${CANARY}`); }),
    });
    await handlers['chat-turn:diagnostic:get'](getRequest());

    const messages = sentMessages(ws);
    expect(messages).toEqual([fixedUnavailable]);
    expect(JSON.stringify(messages[0])).not.toContain(CANARY);
    expect(JSON.stringify(messages[0])).not.toContain('db exploded');
  });

  test('no report content or raw material appears in any unavailable response', async () => {
    const { ws, handlers } = makeHarness();
    await handlers['chat-turn:diagnostic:get'](getRequest({ workspaceId: 'ws-other' }));
    await handlers['chat-turn:diagnostic:get'](getRequest({ threadId: 'other' }));
    const wire = JSON.stringify(sentMessages(ws));
    for (const banned of ['report', 'message', 'stderr', 'stack', 'reason', 'error', 'prompt', 'secret']) {
      expect(wire).not.toContain(`"${banned}"`);
    }
  });

  test('thread state is resolved per request (workspace switch is honored)', async () => {
    let workspaceId = 'ws-a';
    const { ws, handlers, reportStub } = makeHarness({
      getReport: jest.fn(async () => Object.freeze({ status: 'unavailable' })),
    });
    // Rebuild with a live state reader.
    const liveHandlers = createChatTurnDiagnosticHandlers({
      ws,
      getThreadState: () => ({ threadManager: { workspaceId } }),
      getReport: reportStub,
    });
    void handlers;
    await liveHandlers['chat-turn:diagnostic:get'](getRequest());
    workspaceId = 'ws-b';
    await liveHandlers['chat-turn:diagnostic:get'](getRequest());
    expect(reportStub.mock.calls[0][0].workspaceId).toBe('ws-a');
    expect(reportStub.mock.calls[1][0].workspaceId).toBe('ws-b');
  });

  test('structural: handler module never touches the DB, event bus, or logging of report contents', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../lib/ws/chat-turn-diagnostic-handlers.js'), 'utf8',
    );
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toContain("require('../db')");
    expect(codeOnly).not.toContain('event-bus');
    expect(codeOnly).not.toContain('harness_error_diagnostics');
    expect(codeOnly).not.toContain('console.');
    expect(codeOnly).not.toContain('emit(');
    expect(codeOnly).not.toContain('event_log');
    // No fallthrough vocabulary: the handler owns exactly one message type.
    expect(codeOnly).not.toContain('metadata');
  });
});
