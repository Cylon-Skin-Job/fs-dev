'use strict';

describe('TRIGGERS.md cron scheduler compatibility', () => {
  let intervals;
  let timeouts;
  let runSafely;
  let createCronScheduler;
  let parseDuration;
  let parseSchedule;
  let consoleLog;
  let consoleWarn;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 29, 9, 0, 0, 0).getTime());
    intervals = [];
    timeouts = [];
    runSafely = jest.fn((_name, fn) => {
      try { return fn(); } catch (_error) { return null; }
    });
    jest.doMock('../../lib/background-services/safety', () => ({
      runSafely,
      setSafeInterval: jest.fn((name, fn, delay) => {
        intervals.push({ name, fn, delay });
        return intervals.length;
      }),
      setSafeTimeout: jest.fn((name, fn, delay) => {
        timeouts.push({ name, fn, delay });
        return timeouts.length;
      }),
    }));
    ({ createCronScheduler, parseDuration, parseSchedule } = require('../../lib/triggers/cron-scheduler'));
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog?.mockRestore();
    consoleWarn?.mockRestore();
    jest.useRealTimers();
    jest.dontMock('../../lib/background-services/safety');
  });

  test('keeps the existing daily/cron schedule and retry parsing contract', () => {
    expect(parseDuration('5s')).toBe(5_000);
    expect(parseDuration('30m')).toBe(1_800_000);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('invalid')).toBe(0);

    const daily = parseSchedule('daily 09:00');
    expect(daily.intervalMs).toBe(60_000);
    expect(daily.shouldFire()).toBe(true);
    expect(parseSchedule('*/5 * * * *').shouldFire()).toBe(true);
    expect(parseSchedule('not a schedule').intervalMs).toBe(0);
  });

  test('registers through safe timers, suppresses same-minute duplicates, and passes no governed power', () => {
    const createTicket = jest.fn();
    const scheduler = createCronScheduler(createTicket);
    scheduler.register({
      name: 'daily-check', schedule: '* * * * *', message: 'Daily check', prompt: 'PROMPT.md',
    }, 'helper');
    scheduler.start();

    expect(intervals).toEqual([expect.objectContaining({
      name: 'CronScheduler:daily-check', delay: 60_000,
    })]);
    intervals[0].fn();
    intervals[0].fn();

    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(createTicket).toHaveBeenCalledWith({
      title: 'Daily check',
      assignee: 'helper',
      body: 'Daily check',
      prompt: 'PROMPT.md',
    });
    const ticket = createTicket.mock.calls[0][0];
    expect(ticket.appendResourceFact).toBeUndefined();
    expect(ticket.publishResourceChanged).toBeUndefined();
    expect(ticket.writeDiagnostic).toBeUndefined();
    expect(runSafely).toHaveBeenCalledWith('CronScheduler:daily-check:fire', expect.any(Function));
  });

  test('retries a failed condition and isolates an action throw so later schedules still fire', () => {
    const conditionResults = [false, true, true];
    const evaluateCondition = jest.fn(() => conditionResults.shift());
    const createTicket = jest.fn()
      .mockImplementationOnce(() => { throw new Error('ticket failed'); })
      .mockImplementationOnce(() => ({ id: 'ticket-2' }));
    const scheduler = createCronScheduler(createTicket, { evaluateCondition });
    scheduler.register({
      name: 'retry-check', schedule: '* * * * *', condition: 'ready === true', retry: '5s',
    }, 'helper');
    scheduler.start();

    intervals[0].fn();
    expect(createTicket).not.toHaveBeenCalled();
    expect(timeouts).toEqual([expect.objectContaining({
      name: 'CronScheduler:retry-check:retry', delay: 5_000,
    })]);
    timeouts[0].fn();
    expect(createTicket).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date(2026, 7, 29, 9, 1, 0, 0).getTime());
    intervals[0].fn();
    expect(createTicket).toHaveBeenCalledTimes(2);
    expect(runSafely).toHaveBeenCalledTimes(2);
  });
});
