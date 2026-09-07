'use strict';

const { bus, drainEventEffects, emit, on } = require('../lib/event-bus');

afterEach(() => bus.removeAllListeners());

test('exact turn drain waits for dynamically chained asynchronous effects only for that identity', async () => {
  let releaseFirst;
  let releaseSecond;
  let secondStarted;
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  const second = new Promise((resolve) => { releaseSecond = resolve; });
  const started = new Promise((resolve) => { secondStarted = resolve; });
  const identity = {
    workspaceId: 'A', projectRoot: '/A', workspaceEpoch: 'epoch-a',
    threadId: 'same-id', turnId: 'turn-a',
  };
  on('chat:turn_end', async (event) => {
    await first;
    emit('thread:state_changed', { ...event, state: 'idle' });
  });
  on('thread:state_changed', async () => {
    secondStarted();
    await second;
  });

  emit('chat:turn_end', identity);
  let settled = false;
  const draining = drainEventEffects(identity, { timeoutMs: 1_000 })
    .then((result) => { settled = true; return result; });
  await Promise.resolve();
  expect(settled).toBe(false);
  releaseFirst();
  await started;
  expect(settled).toBe(false);
  releaseSecond();
  await expect(draining).resolves.toEqual({ drained: true });
});
