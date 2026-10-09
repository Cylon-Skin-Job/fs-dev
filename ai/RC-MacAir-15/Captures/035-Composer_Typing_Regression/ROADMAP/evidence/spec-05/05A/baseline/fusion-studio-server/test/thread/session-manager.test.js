'use strict';

const { EventEmitter } = require('events');
const { SessionManager } = require('../../lib/thread/session-manager');
const { ThreadManager } = require('../../lib/thread/ThreadManager');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const {
  _getProjectThreadManagers,
  shutdownThreadManagers,
} = require('../../lib/thread/thread-manager-registry');

function makeAutoClosingProcess() {
  const process = new EventEmitter();
  process.killed = false;
  process.kill = jest.fn((signal) => {
    process.killed = true;
    queueMicrotask(() => process.emit('close', null, signal));
    return true;
  });
  return process;
}

describe('SessionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager({ idleTimeoutMinutes: 0.01 }); // ~600ms for fast tests
  });

  afterEach(() => {
    // Clean up any remaining timeouts
    for (const [threadId] of manager.activeSessions) {
      manager.closeSession(threadId);
    }
  });

  test('openSession creates a session and sets idle timeout', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    const session = manager.openSession('thread-1', 'panel-1', mockProcess);

    expect(session.threadId).toBe('thread-1');
    expect(session.panelId).toBe('panel-1');
    expect(session.state).toBe('active');
    expect(manager.isActive('thread-1')).toBe(true);
  });

  test('openSession rejects a competing provider without replacing its owner', () => {
    const firstProcess = { killed: false, kill: jest.fn() };
    const secondProcess = { killed: false, kill: jest.fn() };
    const firstWs = {};
    const first = manager.openSession('thread-1', 'panel-1', firstProcess, firstWs);

    expect(() => manager.openSession('thread-1', 'panel-2', secondProcess, {}))
      .toThrow('A live provider already owns this thread');
    expect(manager.getSession('thread-1')).toBe(first);
    expect(manager.getSession('thread-1')).toMatchObject({ wireProcess: firstProcess, ws: firstWs });
  });

  test('openSession transfers an exact provider to a replacement client atomically', () => {
    const process = { killed: false, kill: jest.fn() };
    const replacement = {};
    const first = manager.openSession('thread-1', 'panel-1', process, {});

    const transferred = manager.openSession('thread-1', 'panel-2', process, replacement);

    expect(transferred).toBe(first);
    expect(transferred).toMatchObject({ panelId: 'panel-2', wireProcess: process, ws: replacement });
  });

  test('a stopping owner cannot be overwritten before actual provider exit', async () => {
    const process = new EventEmitter();
    process.killed = false;
    process.kill = jest.fn(() => {
      process.killed = true;
      return true;
    });
    manager.openSession('thread-1', 'panel-1', process, {});
    const closing = manager.closeSessionAndWait('thread-1');
    await new Promise(resolve => setImmediate(resolve));

    expect(() => manager.openSession('thread-1', 'panel-2', {}, {}))
      .toThrow('Provider termination is still pending');
    expect(manager.getSession('thread-1').state).toBe('stopping');

    process.emit('close', null, 'SIGTERM');
    await expect(closing).resolves.toBe(true);
  });

  test('touchSession resets idle timeout', (done) => {
    const mockProcess = makeAutoClosingProcess();
    const onClose = jest.fn();
    const mgr = new SessionManager({ idleTimeoutMinutes: 0.01 }, onClose);

    mgr.openSession('thread-1', 'panel-1', mockProcess);

    // Touch session after 300ms (before 600ms timeout)
    setTimeout(() => {
      mgr.touchSession('thread-1');
    }, 300);

    // If touchSession works, onClose should NOT be called at 600ms
    setTimeout(() => {
      expect(onClose).not.toHaveBeenCalled();
    }, 500);

    // But it SHOULD be called after the extended timeout (~900ms total)
    setTimeout(() => {
      expect(onClose).toHaveBeenCalledWith('thread-1');
      mgr.closeSession('thread-1');
      done();
    }, 1200);
  });

  test('closeSession kills process and removes session', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    manager.openSession('thread-1', 'panel-1', mockProcess);

    const closed = manager.closeSession('thread-1');

    expect(closed).toBe(true);
    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(manager.isActive('thread-1')).toBe(false);
  });

  test('closeSession returns false for non-existent session', () => {
    const closed = manager.closeSession('non-existent');
    expect(closed).toBe(false);
  });

  test('closeSessionAndWait does not resolve before an evented provider closes', async () => {
    const mockProcess = new EventEmitter();
    mockProcess.killed = false;
    mockProcess.kill = jest.fn((signal) => {
      mockProcess.killed = true;
      mockProcess.signal = signal;
      return true;
    });
    manager.openSession('thread-1', 'panel-1', mockProcess);

    let settled = false;
    const closing = manager.closeSessionAndWait('thread-1').then((value) => {
      settled = true;
      return value;
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settled).toBe(false);
    expect(manager.isActive('thread-1')).toBe(true);
    expect(manager.getSession('thread-1').state).toBe('stopping');

    mockProcess.emit('close', null, 'SIGTERM');
    await expect(closing).resolves.toBe(true);
    expect(manager.isActive('thread-1')).toBe(false);
  });

  test('closeSessionAndWait prefers the harness termination contract over early process events', async () => {
    const mockProcess = new EventEmitter();
    let finishProviderStop;
    const providerStopped = new Promise(resolve => { finishProviderStop = resolve; });
    mockProcess.killed = false;
    mockProcess.kill = jest.fn(() => {
      mockProcess.killed = true;
      mockProcess.emit('exit', null, 'SIGTERM');
      return true;
    });
    mockProcess._waitForTermination = jest.fn(() => providerStopped);
    manager.openSession('thread-1', 'panel-1', mockProcess);

    let settled = false;
    const closing = manager.closeSessionAndWait('thread-1').then((value) => {
      settled = true;
      return value;
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(settled).toBe(false);

    finishProviderStop();
    await expect(closing).resolves.toBe(true);
  });

  test('closeSessionAndWait escalates to SIGKILL and releases only after actual close', async () => {
    const mockProcess = new EventEmitter();
    mockProcess.killed = false;
    mockProcess.kill = jest.fn((signal) => {
      mockProcess.killed = true;
      if (signal === 'SIGKILL') mockProcess.emit('close', null, signal);
      return true;
    });
    const mgr = new SessionManager({
      idleTimeoutMinutes: 1,
      providerCloseGraceMs: 10,
      providerCloseForceMs: 50,
    });
    mgr.openSession('thread-1', 'panel-1', mockProcess);

    await expect(mgr.closeSessionAndWait('thread-1')).resolves.toBe(true);
    expect(mockProcess.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
    expect(mgr.isActive('thread-1')).toBe(false);
  });

  test('closeSessionAndWait retains the stopping owner when hard-stop confirmation times out', async () => {
    const mockProcess = new EventEmitter();
    mockProcess.killed = false;
    mockProcess.kill = jest.fn((signal) => {
      mockProcess.killed = true;
      return signal === 'SIGTERM' || signal === 'SIGKILL';
    });
    const mgr = new SessionManager({
      idleTimeoutMinutes: 1,
      providerCloseGraceMs: 5,
      providerCloseForceMs: 5,
    });
    const owner = mgr.openSession('thread-1', 'panel-1', mockProcess);

    await expect(mgr.closeSessionAndWait('thread-1')).rejects.toThrow(
      'Provider process did not close during workspace retirement',
    );
    expect(mockProcess.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
    expect(mgr.getSession('thread-1')).toBe(owner);
    expect(owner.state).toBe('stopping');
    expect(() => mgr.closeSession('thread-1')).toThrow(
      'Provider termination is still pending',
    );
    expect(mgr.getSession('thread-1')).toBe(owner);
  });

  test('getSession returns active session', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    manager.openSession('thread-1', 'panel-1', mockProcess);

    const session = manager.getSession('thread-1');
    expect(session).toBeDefined();
    expect(session.threadId).toBe('thread-1');
  });

  test('getSession returns undefined for non-existent session', () => {
    const session = manager.getSession('non-existent');
    expect(session).toBeUndefined();
  });

  test('attachWebSocket updates session ws', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    const mockWs = {};
    manager.openSession('thread-1', 'panel-1', mockProcess);

    manager.attachWebSocket('thread-1', mockWs);

    const session = manager.getSession('thread-1');
    expect(session.ws).toBe(mockWs);
  });

  test('detachWebSocket removes ws from session', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    const mockWs = {};
    manager.openSession('thread-1', 'panel-1', mockProcess, mockWs);

    manager.detachWebSocket('thread-1');

    const session = manager.getSession('thread-1');
    expect(session.ws).toBeNull();
  });

  test('idle timeout fires after configured duration', (done) => {
    const mockProcess = makeAutoClosingProcess();
    const onClose = jest.fn();
    const mgr = new SessionManager({ idleTimeoutMinutes: 0.005 }, onClose); // ~300ms

    mgr.openSession('thread-1', 'panel-1', mockProcess);

    setTimeout(() => {
      expect(onClose).toHaveBeenCalledWith('thread-1');
      expect(mgr.isActive('thread-1')).toBe(false);
      done();
    }, 600);
  });

  test('touchSession updates lastActivity', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    manager.openSession('thread-1', 'panel-1', mockProcess);

    const before = manager.getSession('thread-1').lastActivity;

    // Wait a tiny bit
    const start = Date.now();
    while (Date.now() - start < 10) {} // busy-wait 10ms

    manager.touchSession('thread-1');

    const after = manager.getSession('thread-1').lastActivity;
    expect(after).toBeGreaterThan(before);
  });

  test('constructor validates idleTimeoutMinutes', () => {
    expect(() => new SessionManager({ idleTimeoutMinutes: 0 })).toThrow(
      'idleTimeoutMinutes must be a positive number'
    );
    expect(() => new SessionManager({ idleTimeoutMinutes: -1 })).toThrow(
      'idleTimeoutMinutes must be a positive number'
    );
    expect(() => new SessionManager({ idleTimeoutMinutes: 'invalid' })).toThrow(
      'idleTimeoutMinutes must be a positive number'
    );
  });

  test('getActiveSessionCount returns correct count', () => {
    const mockProcess = { killed: false, kill: jest.fn() };
    expect(manager.getActiveSessionCount()).toBe(0);

    manager.openSession('thread-1', 'panel-1', mockProcess);
    expect(manager.getActiveSessionCount()).toBe(1);

    manager.openSession('thread-2', 'panel-1', mockProcess);
    expect(manager.getActiveSessionCount()).toBe(2);

    manager.closeSession('thread-1');
    expect(manager.getActiveSessionCount()).toBe(1);
  });

  test('retirement reservation blocks same-wire ownership transfer before async teardown', () => {
    const wire = { killed: false, kill: jest.fn() };
    const wsA = {};
    const wsB = {};
    manager.openSession('thread-1', 'panel-1', wire, wsA);

    const reserved = manager.beginSessionRetirement('thread-1', wsA);

    expect(reserved).toMatchObject({ wireProcess: wire, ws: wsA, state: 'stopping' });
    expect(() => manager.openSession('thread-1', 'panel-1', wire, wsB))
      .toThrow('Provider termination is still pending');
    expect(manager.beginSessionRetirement('thread-1', wsB)).toBeNull();

    manager.activeSessions.delete('thread-1');
  });

  test('completed bound stop forgets only the exact reserved provider', () => {
    const wire = { killed: true, kill: jest.fn() };
    const otherWire = { killed: true, kill: jest.fn() };
    const ws = {};
    manager.openSession('thread-1', 'panel-1', wire, ws);
    manager.beginSessionRetirement('thread-1', ws);

    expect(manager.completeStoppedSession('thread-1', otherWire)).toBe(false);
    expect(manager.getSession('thread-1')).toMatchObject({ wireProcess: wire, state: 'stopping' });
    expect(manager.completeStoppedSession('thread-1', wire)).toBe(true);
    expect(manager.getSession('thread-1')).toBeUndefined();
    expect(wire.kill).not.toHaveBeenCalled();
  });
});

describe('ThreadManager provider exit ownership', () => {
  afterEach(() => {
    threadRuntimeManager.runtimes.clear();
  });

  test('duplicate provider claim fails before capacity enforcement or predecessor teardown', async () => {
    const threadManager = Object.create(ThreadManager.prototype);
    threadManager.workspaceId = 'workspace-1';
    threadManager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
    threadManager.index = {
      activate: jest.fn(async () => {}),
      markResumed: jest.fn(async () => {}),
      suspend: jest.fn(async () => {}),
    };
    threadManager._enforceSessionLimit = jest.fn(async () => {});
    const currentWire = new EventEmitter();
    currentWire.killed = false;
    currentWire.kill = jest.fn(() => true);
    const challenger = new EventEmitter();
    challenger.killed = false;
    challenger.kill = jest.fn(() => true);
    const ws = {};

    await threadManager.openSession('thread-1', currentWire, ws);
    threadManager._enforceSessionLimit.mockClear();

    await expect(threadManager.openSession('thread-1', challenger, ws))
      .rejects.toThrow('A live provider already owns this thread');

    expect(threadManager._enforceSessionLimit).not.toHaveBeenCalled();
    expect(threadManager.getSession('thread-1')).toMatchObject({
      wireProcess: currentWire,
      ws,
    });
    expect(currentWire.kill).not.toHaveBeenCalled();
    expect(challenger.kill).not.toHaveBeenCalled();

    threadManager.sessionManager.closeSession('thread-1');
  });

  test('natural provider exit removes only its exact session before replacement', async () => {
    const threadManager = Object.create(ThreadManager.prototype);
    threadManager.workspaceId = 'workspace-1';
    threadManager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
    threadManager.index = {
      activate: jest.fn(async () => {}),
      markResumed: jest.fn(async () => {}),
      suspend: jest.fn(async () => {}),
    };
    threadManager._enforceSessionLimit = jest.fn(async () => {});
    const wire = new EventEmitter();
    wire.killed = false;
    wire.kill = jest.fn(() => true);

    await threadManager.openSession('thread-1', wire, {});
    wire.exitCode = 0;
    wire.emit('exit', 0, null);
    await new Promise(resolve => setImmediate(resolve));

    expect(threadManager.getSession('thread-1')).toBeUndefined();
    expect(threadManager.index.suspend).toHaveBeenCalledWith('thread-1');
    expect(wire.kill).not.toHaveBeenCalled();
  });

  test('former-owner retirement wins an in-progress same-wire transfer when metadata fails', async () => {
    const threadManager = Object.create(ThreadManager.prototype);
    threadManager.workspaceId = 'workspace-1';
    threadManager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
    let rejectTransferMetadata;
    let markTransferMetadataStarted;
    const transferMetadataStarted = new Promise(resolve => {
      markTransferMetadataStarted = resolve;
    });
    const transferMetadata = new Promise((_, reject) => {
      rejectTransferMetadata = reject;
    });
    threadManager.index = {
      activate: jest.fn(async () => {}),
      markResumed: jest.fn(async () => {}),
      suspend: jest.fn(async () => {}),
    };
    threadManager._enforceSessionLimit = jest.fn(async () => {});
    const wire = makeAutoClosingProcess();
    const wsA = { name: 'A' };
    const wsB = { name: 'B' };

    await threadManager.openSession('thread-1', wire, wsA);
    threadManager.index.markResumed.mockImplementationOnce(async () => {
      markTransferMetadataStarted();
      return transferMetadata;
    });

    const transferring = threadManager.openSession('thread-1', wire, wsB);
    await transferMetadataStarted;
    const reserved = threadManager.beginSessionRetirement('thread-1', wsA);
    expect(reserved).toMatchObject({ ws: wsA, state: 'stopping', wireProcess: wire });

    let retirementResolved = false;
    const retiring = threadManager.closeSessionAndWait('thread-1').then(value => {
      retirementResolved = true;
      return value;
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(retirementResolved).toBe(false);
    expect(wire.kill).not.toHaveBeenCalled();

    rejectTransferMetadata(new Error('metadata failed'));
    await expect(transferring).rejects.toThrow('metadata failed');
    await expect(retiring).resolves.toBe(true);

    expect(wire.kill).toHaveBeenCalledWith('SIGTERM');
    expect(threadManager.getSession('thread-1')).toBeUndefined();
    expect(threadManager.index.suspend).toHaveBeenCalledWith('thread-1');
  });

  test('bound stop completion waits for transfer metadata then suspends before releasing owner', async () => {
    const threadManager = Object.create(ThreadManager.prototype);
    threadManager.workspaceId = 'workspace-1';
    threadManager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
    let finishTransfer;
    const transferCompletion = new Promise(resolve => { finishTransfer = resolve; });
    threadManager.index = { suspend: jest.fn(async () => {}) };
    const wire = { killed: true, kill: jest.fn() };
    const wsA = {};
    const wsB = {};
    const session = threadManager.sessionManager.openSession(
      'thread-1', 'panel-1', wire, wsA,
      { activationToken: 'transfer', activationCompletion: transferCompletion },
    );
    session.pendingActivation.previousWs = wsA;
    session.pendingActivation.nextWs = wsB;
    session.pendingActivation.hadExistingOwner = true;
    session.ws = wsB;
    threadManager.beginSessionRetirement('thread-1', wsA);

    let completed = false;
    const completion = threadManager.completeStoppedSession('thread-1', wire)
      .then(value => { completed = value; });
    await new Promise(resolve => setImmediate(resolve));
    expect(completed).toBe(false);
    expect(threadManager.index.suspend).not.toHaveBeenCalled();

    finishTransfer();
    await completion;
    expect(completed).toBe(true);
    expect(threadManager.index.suspend).toHaveBeenCalledWith('thread-1');
    expect(threadManager.getSession('thread-1')).toBeUndefined();
  });

  test('central close awaits canonical drain quiescence before provider exit and suspension', async () => {
    const threadManager = Object.create(ThreadManager.prototype);
    threadManager.workspaceId = 'workspace-1';
    threadManager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
    threadManager.index = {
      activate: jest.fn(async () => {}),
      markResumed: jest.fn(async () => {}),
      suspend: jest.fn(async () => {}),
    };
    threadManager._enforceSessionLimit = jest.fn(async () => {});
    const wire = makeAutoClosingProcess();
    await threadManager.openSession('thread-1', wire, {});
    const runtimeKey = { workspaceId: 'workspace-1', scope: 'project', threadId: 'thread-1' };
    let finishDrain;
    const drainCompletion = new Promise(resolve => { finishDrain = resolve; });
    const retire = jest.fn(async () => true);
    threadRuntimeManager.markInFlight(runtimeKey);
    threadRuntimeManager.claimActiveDrain(runtimeKey, {
      drainId: 'central-close-drain',
    });
    threadRuntimeManager.bindActiveDrainLifecycle(runtimeKey, 'central-close-drain', {
      completion: drainCompletion,
      retire,
    });

    let closeResolved = false;
    const closing = threadManager.closeSession('thread-1').then(value => {
      closeResolved = true;
      return value;
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(retire).toHaveBeenCalledTimes(1);
    expect(closeResolved).toBe(false);
    expect(wire.kill).not.toHaveBeenCalled();
    expect(threadManager.index.suspend).not.toHaveBeenCalled();

    finishDrain();
    await expect(closing).resolves.toBe(true);
    expect(wire.kill).toHaveBeenCalledWith('SIGTERM');
    expect(threadManager.index.suspend).toHaveBeenCalledWith('thread-1');
  });

  test('process shutdown retires completed READY headless providers from every manager', async () => {
    const threadManager = Object.create(ThreadManager.prototype);
    threadManager.workspaceId = 'workspace-headless';
    threadManager.sessionManager = new SessionManager({ idleTimeoutMinutes: 5 });
    threadManager.index = {
      activate: jest.fn(async () => {}),
      markResumed: jest.fn(async () => {}),
      suspend: jest.fn(async () => {}),
    };
    threadManager._enforceSessionLimit = jest.fn(async () => {});
    const wire = makeAutoClosingProcess();
    await threadManager.openSession('thread-headless', wire, null);
    threadRuntimeManager.markReady({
      workspaceId: 'workspace-headless',
      scope: 'project',
      threadId: 'thread-headless',
    });
    const managers = _getProjectThreadManagers();
    managers.set('workspace-headless', threadManager);

    try {
      await expect(shutdownThreadManagers({ timeoutMs: 100 }))
        .resolves.toBe(true);
      expect(wire.kill).toHaveBeenCalledWith('SIGTERM');
      expect(threadManager.getSession('thread-headless')).toBeUndefined();
      expect(threadManager.index.suspend).toHaveBeenCalledWith('thread-headless');
    } finally {
      managers.delete('workspace-headless');
    }
  });
});
