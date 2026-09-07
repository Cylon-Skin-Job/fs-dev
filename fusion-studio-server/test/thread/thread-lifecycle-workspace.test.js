'use strict';

const mockListeners = new Map();
const mockEmit = jest.fn();

jest.mock('../../lib/event-bus', () => ({
  on: jest.fn((type, handler) => {
    mockListeners.set(type, handler);
    return () => mockListeners.delete(type);
  }),
  emit: (...args) => mockEmit(...args),
}));
jest.mock('../../lib/background-services/safety', () => ({
  setSafeTimeout: jest.fn(() => ({ unref() {} })),
}));

const lifecycle = require('../../lib/thread/thread-lifecycle-controller');
const { RUNTIME_STATES, threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');

afterEach(() => {
  threadRuntimeManager.runtimes.clear();
});

test('same thread ids in different exact workspace bindings retain independent lifecycle owners', () => {
  lifecycle.startThreadLifecycle({ idleTimeoutMinutes: 45 });
  const base = {
    threadId: 'same-id', turnId: 'turn-a', workspaceEpoch: 'epoch-a',
    workspace: 'workspace:A', workspaceId: 'A', projectRoot: '/A',
  };
  mockListeners.get('chat:turn_begin')(base);
  mockListeners.get('chat:turn_begin')({
    ...base, workspace: 'workspace:B', workspaceId: 'B', projectRoot: '/B',
    workspaceEpoch: 'epoch-b', turnId: 'turn-b',
  });
  mockListeners.get('chat:turn_end')({
    ...base, workspace: 'workspace:B', workspaceId: 'B', projectRoot: '/B',
    workspaceEpoch: 'epoch-b', turnId: 'turn-b',
  });

  expect(lifecycle.getThreadState('A', 'same-id')).toMatchObject({
    state: 'in_flight', projectRoot: '/A', turnId: 'turn-a',
  });
  expect(lifecycle.getThreadState('B', 'same-id')).toMatchObject({
    state: 'idle', projectRoot: '/B', turnId: 'turn-b',
  });
  expect(mockEmit.mock.calls.filter(([type]) => type === 'thread:state_changed'))
    .toEqual(expect.arrayContaining([
      ['thread:state_changed', expect.objectContaining({ workspaceId: 'A', state: 'in_flight' })],
      ['thread:state_changed', expect.objectContaining({ workspaceId: 'B', state: 'idle' })],
    ]));
});

test('same workspace and thread ids remain isolated across roots and connection epochs', () => {
  lifecycle.startThreadLifecycle({ idleTimeoutMinutes: 45 });
  const base = {
    workspace: 'workspace:shared', workspaceId: 'shared', threadId: 'collision-id',
  };
  const rootA = {
    ...base, projectRoot: '/root/A', workspaceEpoch: 'epoch-a', turnId: 'turn-a',
  };
  const rootB = {
    ...base, projectRoot: '/root/B', workspaceEpoch: 'epoch-b', turnId: 'turn-b',
  };
  mockListeners.get('chat:turn_begin')(rootA);
  mockListeners.get('chat:turn_begin')(rootB);
  mockListeners.get('chat:turn_end')(rootB);

  expect(lifecycle.getThreadState('shared', 'collision-id', '/root/A', 'epoch-a'))
    .toMatchObject({ state: 'in_flight', turnId: 'turn-a' });
  expect(lifecycle.getThreadState('shared', 'collision-id', '/root/B', 'epoch-b'))
    .toMatchObject({ state: 'idle', turnId: 'turn-b' });
  expect(lifecycle.getThreadState('shared', 'collision-id')).toBeNull();
  expect(lifecycle.getThreadState('shared', 'collision-id', '/root/A', 'epoch-b')).toBeNull();
});

test('runtime readiness crosses an epoch only through explicit idle-owner adoption', () => {
  const original = {
    workspaceId: 'shared', projectRoot: '/root/A', workspaceEpoch: 'epoch-a',
    scope: 'project', threadId: 'collision-runtime',
  };
  const replacementEpoch = { ...original, workspaceEpoch: 'epoch-b' };
  const differentRoot = { ...replacementEpoch, projectRoot: '/root/B' };
  threadRuntimeManager.markReady(original);

  expect(threadRuntimeManager.getRuntimeState(replacementEpoch)).toBe(RUNTIME_STATES.COLD);
  expect(threadRuntimeManager.getRuntimeState(differentRoot)).toBe(RUNTIME_STATES.COLD);
  expect(threadRuntimeManager.adoptRuntimeIdentity(replacementEpoch)).toMatchObject({
    state: RUNTIME_STATES.READY,
    key: replacementEpoch,
  });
  expect(threadRuntimeManager.getRuntimeState(original)).toBe(RUNTIME_STATES.COLD);
  expect(threadRuntimeManager.getRuntimeState(differentRoot)).toBe(RUNTIME_STATES.COLD);
});
