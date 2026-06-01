'use strict';

const { SessionManager } = require('../../lib/thread/session-manager');

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

  test('touchSession resets idle timeout', (done) => {
    const mockProcess = { killed: false, kill: jest.fn() };
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
    const mockProcess = { killed: false, kill: jest.fn() };
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
});
