const { createShutdownHandler } = require('../lib/shutdown');

function createHarness(overrides = {}) {
  const exits = [];
  const logs = [];
  const ws = { terminate: jest.fn() };
  const sessions = new Map([[ws, {}]]);
  const server = {
    close: jest.fn(),
    closeIdleConnections: jest.fn(),
    closeAllConnections: jest.fn(),
  };
  const closeWatchers = jest.fn().mockResolvedValue(undefined);
  const closeDatabase = jest.fn().mockResolvedValue(undefined);
  const logger = {
    log: jest.fn((message) => logs.push(message)),
    error: jest.fn((message) => logs.push(message)),
  };
  const requestShutdown = createShutdownHandler({
    server,
    sessions,
    closeWatchers,
    closeDatabase,
    exit: (code) => exits.push(code),
    logger,
    forceAfterMs: 100,
    ...overrides,
  });
  return { requestShutdown, server, sessions, ws, closeWatchers, closeDatabase, exits, logs };
}

test('shutdown closes network clients, watchers, and database before exiting', async () => {
  const harness = createHarness();

  await harness.requestShutdown('SIGTERM');

  expect(harness.server.close).toHaveBeenCalledTimes(1);
  expect(harness.server.closeIdleConnections).toHaveBeenCalledTimes(1);
  expect(harness.server.closeAllConnections).toHaveBeenCalledTimes(1);
  expect(harness.ws.terminate).toHaveBeenCalledTimes(1);
  expect(harness.sessions.size).toBe(0);
  expect(harness.closeWatchers).toHaveBeenCalledTimes(1);
  expect(harness.closeDatabase).toHaveBeenCalledTimes(1);
  expect(harness.exits).toEqual([0]);
  expect(harness.logs).toContain('[Shutdown] cleanup complete');
});

test('shutdown is idempotent when multiple signals arrive', async () => {
  const harness = createHarness();

  const first = harness.requestShutdown('SIGTERM');
  const second = harness.requestShutdown('SIGINT');
  await Promise.all([first, second]);

  expect(first).toBe(second);
  expect(harness.closeDatabase).toHaveBeenCalledTimes(1);
  expect(harness.exits).toEqual([0]);
});

test('shutdown reports cleanup failure and exits nonzero', async () => {
  const closeDatabase = jest.fn().mockRejectedValue(new Error('database busy'));
  const harness = createHarness({ closeDatabase });

  await harness.requestShutdown('SIGTERM');

  expect(harness.exits).toEqual([1]);
  expect(harness.logs).toContain('[Shutdown] cleanup failed: database busy');
});

test('shutdown forces an exit when cleanup exceeds its deadline', async () => {
  jest.useFakeTimers();
  try {
    const closeDatabase = jest.fn(() => new Promise(() => {}));
    const harness = createHarness({ closeDatabase, forceAfterMs: 25 });

    harness.requestShutdown('SIGTERM');
    await jest.advanceTimersByTimeAsync(25);

    expect(harness.exits).toEqual([1]);
    expect(harness.logs).toContain('[Shutdown] cleanup exceeded 25ms; forcing exit');
  } finally {
    jest.useRealTimers();
  }
});
