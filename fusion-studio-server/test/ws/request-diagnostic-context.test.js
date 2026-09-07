'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('uuid', () => ({ v4: jest.fn(() => 'request-diagnostic-id') }));

const { clearThreadMode } = require('../../lib/harness/feature-flags');
const { ThreadWebSocketHandler } = require('../../lib/thread');
const { installLogTee } = require('../../lib/logging');
const { createClientMessageRouter } = require('../../lib/ws/client-message-router');

function createRouter(ws) {
  const session = {
    connectionId: 'connection-00b',
    currentWorkspaceId: null,
    wire: null,
  };
  return createClientMessageRouter({
    ws,
    session,
    connectionId: session.connectionId,
    projectRoot: process.cwd(),
    fileExplorer: {},
    wireLifecycle: {
      awaitHarnessReady: async () => {},
      initializeWire: async () => {},
      setupWireHandlers: () => {},
    },
    sessions: new Map([[ws, session]]),
    setSessionRoot: () => {},
    clearSessionRoot: () => {},
    getProjectRoot: () => process.cwd(),
    getFusionHandlers: () => ({}),
    getClipboardHandlers: () => ({}),
    getBookmarksHandlers: () => ({}),
    getEmojiRecentsHandlers: () => ({}),
    getThemeHandlers: () => ({}),
    getSecretsHandlers: () => ({}),
    getScreenshotHandlers: () => ({}),
  });
}

describe('production client-message diagnostic boundary', () => {
  test('minimizes real routed descendant logs before console and durable output', async () => {
    const canary = 'ROUTED_PROMPT_PROOF_NONCE_CANARY_00B';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-routed-log-'));
    const logPath = path.join(tmpDir, 'server-live.log');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sent = [];
    const ws = {
      send: (raw) => sent.push(JSON.parse(raw)),
      close: jest.fn(),
    };
    let restoreLogTee;

    try {
      restoreLogTee = installLogTee(logPath);
      const router = createRouter(ws);
      await router.handleClientMessage(JSON.stringify({
        type: 'harness:set_mode',
        threadId: canary,
        mode: 'new',
        payload: { neutral: canary },
      }));

      expect(sent).toEqual([{
        type: 'harness:mode_changed',
        threadId: canary,
        mode: 'new',
      }]);
      expect(ws.close).not.toHaveBeenCalled();
      const allConsoleArgs = [logSpy, warnSpy, errorSpy]
        .flatMap((spy) => spy.mock.calls.flat())
        .map(String)
        .join('\n');
      const durableLog = fs.readFileSync(logPath, 'utf8');
      expect(allConsoleArgs).not.toContain(canary);
      expect(durableLog).not.toContain(canary);
      expect(durableLog).toContain('[WS] request_log');
      expect(logSpy.mock.calls.every((args) => (
        args.length === 1 && args[0] === '[WS] request_log'
      ))).toBe(true);
    } finally {
      restoreLogTee?.();
      clearThreadMode(canary);
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('awaits close cleanup while minimizing asynchronous lifecycle values', async () => {
    const canary = 'THREAD_CLOSE_PAYLOAD_CANARY_00B';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-close-log-'));
    const logPath = path.join(tmpDir, 'server-live.log');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const cleanupSpy = jest.spyOn(ThreadWebSocketHandler, 'cleanup').mockImplementation(async () => {
      await Promise.resolve();
      console.log('[ThreadWS] Closed thread', canary);
    });
    let restoreLogTee;

    try {
      restoreLogTee = installLogTee(logPath);
      const ws = { send: jest.fn(), close: jest.fn() };
      const router = createRouter(ws);
      await router.handleClientClose();

      const durableLog = fs.readFileSync(logPath, 'utf8');
      const consoleOutput = logSpy.mock.calls.flat().map(String).join('\n');
      expect(cleanupSpy).toHaveBeenCalledWith(ws);
      expect(consoleOutput).not.toContain(canary);
      expect(durableLog).not.toContain(canary);
      expect(durableLog).toContain('[WS] request_log');
    } finally {
      restoreLogTee?.();
      cleanupSpy.mockRestore();
      logSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
