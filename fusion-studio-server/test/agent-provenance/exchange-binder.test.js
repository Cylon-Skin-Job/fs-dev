'use strict';

const { createAgentExchangeBinder } = require('../../lib/agent-provenance/exchange-binder');

function flush() { return new Promise((resolve) => setImmediate(resolve)); }

function timers() {
  const entries = [];
  return {
    entries,
    setTimer(fn, delay) {
      const timer = { delay, cleared: false, unref: jest.fn() };
      timer.fn = () => { timer.cleared = true; fn(); };
      entries.push(timer);
      return timer;
    },
    clearTimer(timer) { timer.cleared = true; },
  };
}

describe('AgentExchangeBinder', () => {
  test('startup caps dispositions at 100 and yielded continuation drains the remainder', async () => {
    const pending = Array.from({ length: 101 }, (_, index) => index + 1);
    const repository = {
      listNext: jest.fn(async ({ excludedExchangeIds = [] } = {}) => {
        const id = pending.find((candidate) => !excludedExchangeIds.includes(candidate));
        return id == null ? null : { exchange_id: id };
      }),
      bindExchange: jest.fn(async (id) => {
        pending.splice(pending.indexOf(id), 1);
        return { exchangeId: id, state: 'applied' };
      }),
    };
    const binder = createAgentExchangeBinder(repository);
    const startup = await binder.start();
    expect(startup.dispositions).toBe(100);
    expect(pending).toEqual([101]);
    await flush();
    await flush();
    expect(pending).toEqual([]);
    await expect(binder.shutdown()).resolves.toEqual({ drained: true });
  });

  test('one-second startup budget leaves durable work for a yielded continuation', async () => {
    const pending = [1, 2];
    let monotonic = 0;
    const repository = {
      listNext: jest.fn(async () => pending.length ? { exchange_id: pending[0] } : null),
      bindExchange: jest.fn(async (id) => {
        pending.shift();
        monotonic = 1_000;
        return { exchangeId: id, state: 'applied' };
      }),
    };
    const binder = createAgentExchangeBinder(repository, { monotonicNow: () => monotonic });
    await expect(binder.start()).resolves.toMatchObject({ dispositions: 1, eligibleRemaining: true });
    await flush();
    await flush();
    expect(pending).toEqual([]);
    await binder.shutdown();
  });

  test('first retryable exhaustion delays exact ID, drains unrelated work, then suppresses after one delayed retry', async () => {
    const clock = timers();
    let now = 0;
    const pending = [1, 2];
    const attempts = new Map();
    const diagnostic = jest.fn();
    const repository = {
      listNext: jest.fn(async ({ excludedExchangeIds = [] } = {}) => {
        const id = pending.find((candidate) => !excludedExchangeIds.includes(candidate));
        return id == null ? null : { exchange_id: id };
      }),
      bindExchange: jest.fn(async (id) => {
        attempts.set(id, (attempts.get(id) || 0) + 1);
        if (id === 1) {
          const error = new Error('locked'); error.code = 'agent_exchange_bind_failed'; throw error;
        }
        pending.splice(pending.indexOf(id), 1);
        return { exchangeId: id, state: 'applied' };
      }),
    };
    const binder = createAgentExchangeBinder(repository, {
      writeDiagnostic: diagnostic, wallClock: () => now,
      setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    });
    await binder.start();
    await flush();
    await flush();
    expect(pending).toEqual([1]);
    expect(attempts.get(1)).toBe(1);
    expect(attempts.get(2)).toBe(1);
    expect(clock.entries.filter((entry) => !entry.cleared)).toHaveLength(1);
    expect(clock.entries[0].delay).toBe(1_000);
    now = 1_000;
    clock.entries[0].fn();
    await flush();
    await flush();
    expect(attempts.get(1)).toBe(2);
    expect(diagnostic).toHaveBeenCalledTimes(1);
    expect(clock.entries.filter((entry) => !entry.cleared)).toHaveLength(0);
    binder.signal();
    await flush();
    expect(attempts.get(1)).toBe(2);
    await binder.shutdown();

    const restartedRepository = {
      listNext: jest.fn(async () => pending.length ? { exchange_id: pending[0] } : null),
      bindExchange: jest.fn(async (id) => {
        pending.splice(pending.indexOf(id), 1);
        return { exchangeId: id, state: 'applied' };
      }),
    };
    const restarted = createAgentExchangeBinder(restartedRepository);
    await expect(restarted.start()).resolves.toMatchObject({ dispositions: 1 });
    expect(pending).toEqual([]);
    await restarted.shutdown();
  });

  test('non-retryable failure suppresses immediately without a timer or hot loop', async () => {
    const clock = timers();
    const repository = {
      listNext: jest.fn(async ({ excludedExchangeIds = [] } = {}) => (
        excludedExchangeIds.includes(1) ? null : { exchange_id: 1 }
      )),
      bindExchange: jest.fn(async () => { const error = new Error('broken'); error.code = 'SQLITE_IOERR'; throw error; }),
    };
    const diagnostic = jest.fn();
    const binder = createAgentExchangeBinder(repository, {
      writeDiagnostic: diagnostic, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    });
    await binder.start();
    await flush();
    expect(repository.bindExchange).toHaveBeenCalledTimes(1);
    expect(diagnostic).toHaveBeenCalledWith('agent_exchange_bind_failed');
    expect(clock.entries).toHaveLength(0);
    await binder.shutdown();
  });

  test('post-commit signal arriving during the final eligibility read is not lost', async () => {
    let pending = false;
    let listCalls = 0;
    let releaseCapturedEmpty;
    let markFinalReadStarted;
    const finalReadStarted = new Promise((resolve) => { markFinalReadStarted = resolve; });
    const repository = {
      listNext: jest.fn(async () => {
        listCalls += 1;
        if (listCalls === 1) return null;
        if (listCalls === 2) {
          markFinalReadStarted();
          return new Promise((resolve) => { releaseCapturedEmpty = () => resolve(null); });
        }
        return pending ? { exchange_id: 1 } : null;
      }),
      bindExchange: jest.fn(async (id) => {
        pending = false;
        return { exchangeId: id, state: 'applied' };
      }),
    };
    const binder = createAgentExchangeBinder(repository);
    binder.signal();
    await finalReadStarted;
    pending = true;
    binder.signal();
    releaseCapturedEmpty();
    await flush();
    await flush();
    await flush();
    expect(repository.bindExchange).toHaveBeenCalledTimes(1);
    await binder.shutdown();
  });

  test('shutdown cancels unstarted delayed retry and starts no further job', async () => {
    const clock = timers();
    const repository = {
      listNext: jest.fn(async ({ excludedExchangeIds = [] } = {}) => (
        excludedExchangeIds.includes(1) ? null : { exchange_id: 1 }
      )),
      bindExchange: jest.fn(async () => { const error = new Error('busy'); error.code = 'SQLITE_BUSY'; throw error; }),
    };
    const binder = createAgentExchangeBinder(repository, { setTimer: clock.setTimer, clearTimer: clock.clearTimer });
    await binder.start();
    expect(clock.entries).toHaveLength(1);
    await expect(binder.shutdown()).resolves.toEqual({ drained: true });
    expect(clock.entries[0].cleared).toBe(true);
    clock.entries[0].fn();
    await flush();
    expect(repository.bindExchange).toHaveBeenCalledTimes(1);
  });

  test('shutdown bounds its wait for an active operation and admits no following job', async () => {
    const clock = timers();
    const pending = [1, 2];
    let releaseFirst;
    let markFirstStarted;
    const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
    const repository = {
      listNext: jest.fn(async () => pending.length ? { exchange_id: pending[0] } : null),
      bindExchange: jest.fn(async (id) => {
        if (id === 1) {
          markFirstStarted();
          await new Promise((resolve) => { releaseFirst = resolve; });
        }
        pending.splice(pending.indexOf(id), 1);
        return { exchangeId: id, state: 'applied' };
      }),
    };
    const binder = createAgentExchangeBinder(repository, {
      monotonicNow: () => 0,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    binder.signal();
    await firstStarted;
    const shutdown = binder.shutdown({ timeoutMs: 25 });
    expect(clock.entries.at(-1).delay).toBe(25);
    clock.entries.at(-1).fn();
    await expect(shutdown).resolves.toEqual({ drained: false });
    releaseFirst();
    await flush();
    await flush();
    expect(repository.bindExchange).toHaveBeenCalledTimes(1);
    expect(pending).toEqual([2]);
  });
});
