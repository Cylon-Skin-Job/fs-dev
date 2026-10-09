import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFocusedBeforeTyping, establishFocusedWindow } from './window-focus.mjs';

test('focus establishment retries until the isolated window reports focused', async () => {
  const observations = [
    { focused: false, visible: true, title: 'staged' },
    { focused: true, visible: true, title: 'staged' },
  ];
  let clock = 0;
  const result = await establishFocusedWindow({
    observeAndFocus: async () => observations.shift(),
    wait: async (ms) => { clock += ms; },
    timeoutMs: 500,
    now: () => clock,
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.observation.focused, true);
  assert.equal(result.elapsedMs, 100);
});

test('focus establishment fails explicitly when focus remains unavailable', async () => {
  let clock = 0;
  await assert.rejects(
    establishFocusedWindow({
      observeAndFocus: async () => ({ focused: false, visible: true, title: 'staged' }),
      wait: async (ms) => { clock += ms; },
      timeoutMs: 200,
      now: () => clock,
    }),
    (error) => error.code === 'R1_FOCUS_UNAVAILABLE' && /focus unavailable/.test(error.message),
  );
});

test('pre-typing verification rejects a lost-focus observation', () => {
  assert.throws(
    () => assertFocusedBeforeTyping({ focused: false, visible: true }, 'R1-WARM trial 2'),
    (error) => error.code === 'R1_FOCUS_LOST_BEFORE_TYPING' && /immediately before typing/.test(error.message),
  );
});
