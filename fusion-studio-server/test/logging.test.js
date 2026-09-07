const fs = require('fs');
const os = require('os');
const path = require('path');

const { installLogTee, resolveServerLogPath } = require('../lib/logging');
const { clearThreadMode } = require('../lib/harness/feature-flags');
const { createHarnessWsHandlers } = require('../lib/ws/harness-ws-handlers');
const { runWithRequestDiagnosticBoundary } = require('../lib/ws/request-diagnostic-context');

describe('resolveServerLogPath', () => {
  test('keeps development logging beside the server without app user data', () => {
    expect(resolveServerLogPath({
      appUserData: undefined,
      serverDir: '/workspace/fusion-studio-server',
    })).toBe('/workspace/fusion-studio-server/server-live.log');
  });

  test('writes packaged logging into the isolated application profile', () => {
    expect(resolveServerLogPath({
      appUserData: '/Users/test/Library/Application Support/Fusion Studio Alpha',
      serverDir: '/Applications/Fusion Studio Alpha.app/Contents/Resources/fusion-studio-server',
    })).toBe(path.resolve(
      '/Users/test/Library/Application Support/Fusion Studio Alpha/server-live.log',
    ));
  });

  test('treats a blank app user data value as development mode', () => {
    expect(resolveServerLogPath({
      appUserData: '   ',
      serverDir: '/workspace/fusion-studio-server',
    })).toBe('/workspace/fusion-studio-server/server-live.log');
  });
});

describe('request diagnostic boundary', () => {
  test('minimizes arbitrary startup and background diagnostics at the installed sink', () => {
    const canary = 'REPOSITORY_PROMPT_PAYLOAD_CANARY_00B';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-global-log-'));
    const logPath = path.join(tmpDir, 'server-live.log');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let restoreLogTee;

    try {
      restoreLogTee = installLogTee(logPath);
      console.log('startup path', canary);
      console.warn('background warning', { payload: canary });
      console.error(new Error(canary));

      const consoleOutput = [logSpy, warnSpy, errorSpy]
        .flatMap((spy) => spy.mock.calls.flat())
        .map(String)
        .join('\n');
      const durableLog = fs.readFileSync(logPath, 'utf8');
      expect(consoleOutput).not.toContain(canary);
      expect(durableLog).not.toContain(canary);
      expect(logSpy).toHaveBeenCalledWith('[Server] diagnostic_log');
      expect(warnSpy).toHaveBeenCalledWith('[Server] diagnostic_warning');
      expect(errorSpy).toHaveBeenCalledWith('[Server] diagnostic_error');
    } finally {
      restoreLogTee?.();
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('minimizes real handler descendant logs without changing product routing', async () => {
    const canary = 'PROOF_NONCE_CANARY_00B';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-request-log-'));
    const logPath = path.join(tmpDir, 'server-live.log');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sent = [];
    let restoreLogTee;

    try {
      restoreLogTee = installLogTee(logPath);
      const handlers = createHarnessWsHandlers({
        ws: { send: (raw) => sent.push(JSON.parse(raw)) },
      });
      await runWithRequestDiagnosticBoundary(async () => {
        handlers['harness:set_mode']({ threadId: canary, mode: 'new' });
        await Promise.resolve();
        console.warn('nested warning', { payload: canary });
        console.error(new Error(canary));
      });

      expect(sent).toEqual([{
        type: 'harness:mode_changed',
        threadId: canary,
        mode: 'new',
      }]);
      const allConsoleArgs = [logSpy, warnSpy, errorSpy]
        .flatMap((spy) => spy.mock.calls.flat())
        .map(String)
        .join('\n');
      expect(allConsoleArgs).not.toContain(canary);
      expect(logSpy.mock.calls).toContainEqual(['[WS] request_log']);
      expect(warnSpy.mock.calls).toContainEqual(['[WS] request_warning']);
      expect(errorSpy.mock.calls).toContainEqual(['[WS] request_error']);
      const durableLog = fs.readFileSync(logPath, 'utf8');
      expect(durableLog).not.toContain(canary);
      expect(durableLog).toContain('[WS] request_log');
    } finally {
      restoreLogTee?.();
      clearThreadMode(canary);
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('background service diagnostic boundary', () => {
  let appendSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    appendSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.resetModules();
  });

  test('sync failures write only a fixed durable record and fixed console marker', () => {
    const canary = 'SHELL_AUTH_MASTER_GENERATION_PROOF_NONCE_CANARY';
    const { runSafely } = require('../lib/background-services/safety');
    const error = new Error(canary);
    error.code = canary;

    expect(runSafely(canary, () => { throw error; })).toBeNull();

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const durableRecord = appendSpy.mock.calls[0].join(' ');
    const consoleRecord = consoleErrorSpy.mock.calls.flat().join(' ');
    expect(durableRecord).toContain('background_service_failed');
    expect(durableRecord).not.toContain(canary);
    expect(consoleRecord).toContain('[Background] service_failed');
    expect(consoleRecord).not.toContain(canary);
  });

  test('async failures use the same fixed diagnostic projection', async () => {
    const canary = 'ASYNC_SHELL_AUTH_SECRET_CANARY';
    const { runSafely } = require('../lib/background-services/safety');

    runSafely(canary, () => Promise.reject(new Error(canary)));
    await new Promise((resolve) => setImmediate(resolve));

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy.mock.calls[0].join(' ')).not.toContain(canary);
    expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain(canary);
  });
});
