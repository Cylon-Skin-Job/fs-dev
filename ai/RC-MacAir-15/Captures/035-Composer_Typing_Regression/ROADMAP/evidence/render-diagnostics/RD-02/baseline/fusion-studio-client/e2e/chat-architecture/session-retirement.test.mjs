import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { OpenCodeHarness } = require('../../../fusion-studio-server/lib/harness/opencode');
test('real adapter retires 20 unique idle sessions without retaining registry entries', async () => {
  const harness = new OpenCodeHarness();
  for (let i = 0; i < 20; i++) {
    const session = await harness.startThread(`retire-${i}`, '/tmp', {}, { sessionKey: `owner-${i}` });
    await session.stop('SIGTERM');
    assert.equal(harness.sessions.size, 0);
  }
});
test('late stop of old session cannot evict its replacement', async () => {
  const harness = new OpenCodeHarness();
  const old = await harness.startThread('same', '/tmp', {}, { sessionKey: 'owner' });
  const current = await harness.startThread('same', '/tmp', {}, { sessionKey: 'owner' });
  await old.stop('SIGTERM');
  assert.equal(harness.getSession('owner'), current);
  await current.stop('SIGTERM');
  assert.equal(harness.sessions.size, 0);
});
test('active session remains registered until actual process close', async () => {
  const harness = new OpenCodeHarness();
  const session = await harness.startThread('active', '/tmp');
  let close;
  session.activeProcessClose = new Promise(resolve => { close = resolve; });
  session.activeProcess = { kill() {} };
  const stopping = session.stop('SIGTERM');
  await Promise.resolve();
  assert.equal(harness.getSession('active'), session);
  close();
  await stopping;
  assert.equal(harness.sessions.size, 0);
});

test('delayed old-process close preserves a replacement under the same scoped key', async () => {
  const harness = new OpenCodeHarness();
  const old = await harness.startThread('same', '/tmp', {}, { sessionKey: 'owner' });
  let close;
  old.activeProcess = { kill() {} };
  old.activeProcessClose = new Promise(resolve => { close = resolve; });
  const stopping = old.stop('SIGTERM');
  const current = await harness.startThread('same', '/tmp', {}, { sessionKey: 'owner' });
  close(); await stopping;
  assert.equal(harness.getSession('owner'), current);
  await current.stop('SIGTERM');
});
