'use strict';

jest.mock('../../lib/agent-provenance/turn-authority', () => ({
  createAgentTurnAuthorityRef: jest.fn(),
}));

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ThreadWebSocketHandler = require('../../lib/thread/ThreadWebSocketHandler');
const { createAgentTurnAuthorityRef } = require('../../lib/agent-provenance/turn-authority');
const {
  FIXTURES,
  createAgentToolFixtureRoute,
} = require('../../lib/testing/agent-tool-fixture-route');

test('agent fixture route is production-inert and exposes only the closed scenario catalog', () => {
  expect(createAgentToolFixtureRoute({ enabled: false })).toBeNull();
  expect(Object.keys(FIXTURES)).toEqual([
    'edit-first-a',
    'edit-return-a',
    'read-a',
    'error-partial',
    'interrupt-partial',
    'read-absent-first',
    'read-absent-unchanged',
  ]);
  expect(FIXTURES['read-a']).toMatchObject({ nativeTool: 'read', mutation: 'none' });
  expect(FIXTURES['error-partial']).toMatchObject({ nativeTool: 'edit', status: 'error' });
  expect(FIXTURES['interrupt-partial']).toMatchObject({ status: 'interrupted' });
  expect(Object.isFrozen(FIXTURES)).toBe(true);
});

test('enabled fixture route requires isolated database and ownership nonce', () => {
  expect(() => createAgentToolFixtureRoute({ enabled: true }))
    .toThrow('fixture route requires the isolated database');
  expect(() => createAgentToolFixtureRoute({ enabled: true, db: () => {} }))
    .toThrow('fixture route requires the isolated ownership nonce');
  expect(() => createAgentToolFixtureRoute({
    enabled: true,
    db: () => {},
    nonce: '00000000-0000-4000-8000-000000000000',
  })).toThrow('process-provisioned thread');
  expect(() => createAgentToolFixtureRoute({
    enabled: true,
    db: () => {},
    nonce: '00000000-0000-4000-8000-000000000000',
    threadId: 'isolated-agent-tool-fixture',
  })).toThrow('process-provisioned workspace');
});

test('public fixture route contains no durable thread-create dispatcher', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(
    __dirname,
    '../../lib/testing/agent-tool-fixture-route.js',
  ), 'utf8');
  expect(source).not.toContain('handleThreadOpenAssistant');
  expect(source).toContain('handleThreadOpen(ws');
  expect(source).toContain('threadId: provisionedThreadId');
});

test('completed workspace switch denies a stale fixture manager before every effect', async () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'agent-tool-binding-test-'));
  const rootA = path.join(root, 'workspace-a');
  const rootB = path.join(root, 'workspace-b');
  fs.mkdirSync(path.join(rootA, 'target'), { recursive: true });
  fs.mkdirSync(path.join(rootB, 'target'), { recursive: true });
  fs.writeFileSync(path.join(rootA, 'target', 'live.txt'), 'workspace A\n');
  fs.writeFileSync(path.join(rootB, 'target', 'live.txt'), 'workspace B\n');

  const ws = { send: jest.fn() };
  const staleManager = { workspaceId: 'A', projectRoot: rootA };
  ThreadWebSocketHandler._getWsState().set(ws, {
    threadId: 'isolated-agent-tool-fixture',
    activatedThreadId: null,
    threadManager: staleManager,
  });
  const session = {
    currentWorkspaceId: 'B',
    projectRoot: rootB,
    workspaceEpoch: '00000000-0000-4000-8000-000000000002',
    workspaceBindingState: 'active',
  };
  const db = jest.fn();
  const canonicalEvent = jest.fn();
  canonicalEvent.finalizeTurn = jest.fn();
  const open = jest.spyOn(ThreadWebSocketHandler, 'handleThreadOpen');
  const route = createAgentToolFixtureRoute({
    enabled: true,
    db,
    nonce: '00000000-0000-4000-8000-000000000000',
    threadId: 'isolated-agent-tool-fixture',
    workspaceId: 'A',
    projectRoot: rootA,
  });

  try {
    await route.handle({
      ws,
      session,
      message: {
        type: 'provenance:test:agent_tool',
        version: 1,
        requestId: 'after-switch',
        nonce: '00000000-0000-4000-8000-000000000000',
        fixture: 'edit-first-a',
      },
      handleCanonicalHarnessEvent: canonicalEvent,
    });

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
      type: 'error',
      message: 'No active workspace',
    });
    expect(open).not.toHaveBeenCalled();
    expect(createAgentTurnAuthorityRef).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
    expect(canonicalEvent).not.toHaveBeenCalled();
    expect(canonicalEvent.finalizeTurn).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(rootA, 'target', 'live.txt'), 'utf8')).toBe('workspace A\n');
    expect(fs.readFileSync(path.join(rootB, 'target', 'live.txt'), 'utf8')).toBe('workspace B\n');
  } finally {
    ThreadWebSocketHandler._getWsState().delete(ws);
    fs.rmSync(root, { recursive: true, force: false });
    jest.restoreAllMocks();
    createAgentTurnAuthorityRef.mockClear();
  }
});
