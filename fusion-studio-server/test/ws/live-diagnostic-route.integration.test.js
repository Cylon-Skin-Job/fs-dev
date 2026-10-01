'use strict';
jest.mock('../../lib/thread/ThreadWebSocketHandler', () => ({
  captureActivationBinding: jest.fn(), isActivationBindingCurrent: jest.fn(), cleanup: jest.fn(),
  getState: jest.fn(), getCurrentThreadManager: jest.fn(), getCurrentThreadId: jest.fn(),
}));
jest.mock('../../lib/ws/thread-ws-handlers', () => ({ createThreadWsHandlers: () => ({}) }));
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));
const fs = require('fs');
const os = require('os');
const path = require('path');
const Thread = require('../../lib/thread/ThreadWebSocketHandler');
const { createClientMessageRouter } = require('../../lib/ws/client-message-router');
const { beginDiagnosticTurn } = require('../../lib/thread/live-diagnostic-service');
const { OpenCodeHarness } = require('../../lib/harness/opencode');
const { OpenCodeJsonEventTranslator } = require('../../lib/harness/opencode/json-event-translator');
const { createNativeDiagnosticTap } = require('../../lib/harness/opencode/native-diagnostic-tap');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const route = { workspaceId: 'ws', projectRoot: '/fixture', workspaceEpoch: 'epoch', threadId: 'thread' };
let owned = [];
function connection({ epoch = route.workspaceEpoch, trusted = true, getThread = async id => id === 'thread' ? { threadId: id } : null } = {}) {
  const frames = [];
  const ws = { readyState: 1, bufferedAmount: 0, send: jest.fn(raw => frames.push(JSON.parse(raw))) };
  const session = { connectionId: 'diag', currentWorkspaceId: route.workspaceId, projectRoot: route.projectRoot,
    workspaceEpoch: epoch, workspaceBindingState: 'active' };
  if (trusted) Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell' });
  const binding = { ...route, workspaceEpoch: epoch, state: { threadManager: { getThread } }, session };
  ws.binding = binding;
  const router = createClientMessageRouter({ ws, session, connectionId: 'diag', projectRoot: route.projectRoot,
    sessions: new Map([[ws, session]]), fileExplorer: {}, wireLifecycle: {}, setSessionRoot() {}, clearSessionRoot() {},
    getProjectRoot: () => route.projectRoot, getFusionHandlers: () => ({}), getClipboardHandlers: () => ({}),
    getBookmarksHandlers: () => ({}), getEmojiRecentsHandlers: () => ({}), getThemeHandlers: () => ({}),
    getSecretsHandlers: () => ({}), getScreenshotHandlers: () => ({}) });
  const send = (type, extra = {}) => router.handleClientMessage(JSON.stringify({
    type: `chat-turn:diagnostic:${type}`, workspaceId: 'ws', threadId: 'thread', subscriptionId: 'sub', ...extra }));
  const result = { ws, session, router, frames, send }; owned.push(result); return result;
}
const event = text => ({ text, sourceUnits: text.length, sourceBytes: Buffer.byteLength(text), count: 1 });
const begin = (turnId = 'A') => beginDiagnosticTurn(route, { turnId, drainId: 'drain-' + turnId, isCurrent: () => true });
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  Thread.captureActivationBinding.mockImplementation(ws => ws.binding);
  Thread.isActivationBindingCurrent.mockImplementation((ws, b) => ws.binding === b && b.session.currentWorkspaceId === b.workspaceId && b.session.workspaceEpoch === b.workspaceEpoch);
});
afterEach(async () => { for (const c of owned) await c.router.handleClientClose(); owned = []; jest.restoreAllMocks(); });
test('public trusted subscription shares exact native turn, resets every turn and rejects retired emitters', async () => {
  const c = connection(); await c.send('subscribe');
  expect(c.frames[0]).toMatchObject({ availability: 'idle', reset: true });
  const a = begin(); a.available(); a.emit(event('<thinking>**raw**</thinking>'));
  await sleep(120);
  expect(c.frames.at(-1)).toMatchObject({ turnId: 'A', reset: true, events: [expect.objectContaining({ seq: 1 })] });
  const b = begin('B'); b.available(); a.emit(event('OLD')); b.emit(event('NEW'));
  await sleep(120);
  expect(c.frames.at(-1)).toMatchObject({ turnId: 'B', reset: true, events: [expect.objectContaining({ text: 'NEW', seq: 1 })] });
  expect(JSON.stringify(c.frames)).not.toContain('OLD'); b.finish();
  await c.send('unsubscribe'); expect(b.isObserved()).toBe(false);
});
test('untrusted, wrong workspace, foreign thread cannot subscribe or observe', async () => {
  const c = connection({ trusted: false }); await c.send('subscribe');
  const d = connection(); await d.send('subscribe', { workspaceId: 'foreign' }); await d.send('subscribe', { threadId: 'foreign' });
  expect([...c.frames, ...d.frames].every(f => f.availability === 'unavailable')).toBe(true);
  const a = begin(); expect(a.isObserved()).toBe(false); a.finish();
});
test('pending unsubscribe/replacement/close is fenced before installing an observer', async () => {
  let release; const c = connection({ getThread: () => new Promise(r => { release = r; }) });
  const pending = c.send('subscribe'); await sleep(0); await c.send('unsubscribe'); release({}); await pending;
  const a = begin(); expect(a.isObserved()).toBe(false);
  const next = c.send('subscribe'); await sleep(0); await c.router.handleClientClose(); release({}); await next;
  expect(a.isObserved()).toBe(false); a.finish();
});
test('workspace replacement and closed/throwing/slow sockets dispose or bound observations independently', async () => {
  const healthy = connection(), slow = connection(), throwing = connection();
  await Promise.all([healthy.send('subscribe'), slow.send('subscribe'), throwing.send('subscribe')]);
  slow.ws.bufferedAmount = 300000; throwing.ws.send.mockImplementation(() => { throw Error('closed'); });
  const a = begin(); a.available();
  for (let i = 0; i < 300; i++) a.emit(event('x'.repeat(2048)));
  await sleep(120);
  expect(healthy.frames.at(-1).dropped).toBeGreaterThan(0);
  expect(healthy.frames.at(-1).events.length).toBeLessThanOrEqual(64);
  slow.ws.bufferedAmount = 0; await sleep(120);
  expect(slow.frames.at(-1).dropped).toBeGreaterThan(0);
  healthy.session.currentWorkspaceId = 'next'; slow.ws.readyState = 3; await sleep(120);
  expect(a.isObserved()).toBe(false); a.finish();
});
test('concurrent public subscriptions respect the limit after serialized lookup', async () => {
  const c = connection(); await Promise.all(Array.from({ length: 20 }, (_, i) => c.send('subscribe', { subscriptionId: `s${i}` })));
  expect(c.frames.filter(f => f.availability === 'unavailable')).toHaveLength(4);
});
test('single real subprocess/parser/translation with two public subscribers and configured secret redaction', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-native-diag-'));
  const cli = path.join(tmp, 'fixture.cjs'), starts = path.join(tmp, 'starts');
  const secret = 'secret-with-"quotes"\\slash\nand-newline';
  const native = [
    { type: 'step_start', sessionID: 'ses_test', part: { type: 'step-start' } },
    { type: 'reasoning', sessionID: 'ses_test', part: { type: 'reasoning', text: '<thinking>**raw**</thinking>' } },
    { type: 'text', sessionID: 'ses_test', part: { type: 'text', text: 'VISIBLE' }, extra: secret, password: 'unknown-credential' },
    { type: 'tool_use', sessionID: 'ses_test', part: { type: 'tool', tool: 'read', callID: 'call1', state: { status: 'completed', input: { filePath: 'a.md' }, output: 'RESULT' } } },
    { type: 'step_finish', sessionID: 'ses_test', part: { type: 'step-finish', reason: 'stop' } },
  ];
  fs.writeFileSync(cli, `#!/usr/bin/env node\nrequire('fs').appendFileSync(${JSON.stringify(starts)}, 'start\\n');\nconst events=${JSON.stringify(native)};\nfor(const event of events) console.log(JSON.stringify(event));\n`); fs.chmodSync(cli, 0o755);
  const c = connection(), d = connection({ epoch: 'second-window-epoch' }); await c.send('subscribe'); await d.send('subscribe');
  const observer = begin('process');
  const translate = jest.spyOn(OpenCodeJsonEventTranslator.prototype, 'translate');
  const harness = new OpenCodeHarness(); await harness.initialize({ cliPath: cli, getConfiguredSecrets: async () => [secret] });
  const session = await harness.startThread('thread', tmp);
  const canonical = [];
  for await (const value of session.sendMessage('test', { nativeDiagnostic: observer, pollIntervalMs: 1 })) canonical.push(value);
  await sleep(130);
  expect(fs.readFileSync(starts, 'utf8')).toBe('start\n'); expect(translate).toHaveBeenCalledTimes(native.length);
  expect(canonical.filter(e => e.type === 'content')).toHaveLength(1);
  for (const connection of [c, d]) {
    const events = connection.frames.flatMap(f => f.events ?? []);
    expect(events).toHaveLength(native.length);
    const text = events.map(e => e.text).join('\n');
    expect(text).toContain('<thinking>**raw**</thinking>'); expect(text).toContain('RESULT');
    expect(text).not.toContain('unknown-credential'); expect(text).not.toContain('quotes'); expect(text).toContain('[REDACTED]');
  }
  await harness.dispose(); fs.rmSync(tmp, { recursive: true, force: true });
});
test('tap callback throws are isolated and no-observer completion skips configured-secret lookup', async () => {
  const calls = jest.fn(async () => []);
  const none = createNativeDiagnosticTap(undefined, { getConfiguredSecrets: calls }); none.push('ignored'); none.finish();
  await sleep(5); expect(calls).not.toHaveBeenCalled();
  const emit = jest.fn(() => { throw Error('observer'); });
  const tap = createNativeDiagnosticTap({ isObserved: () => true, available() { throw Error('observer'); }, emit },
    { getConfiguredSecrets: async () => [], workspaceRoot: '', homePath: '' });
  expect(() => tap.push('{"text":"valid"}')).not.toThrow(); await sleep(10); expect(emit).toHaveBeenCalledTimes(1);
});
test('pending redaction is bounded and discarded on closed observation and turn replacement', async () => {
  const c = connection(); await c.send('subscribe'); const a = begin();
  let resolve; const secrets = new Promise(r => { resolve = r; });
  const tap = createNativeDiagnosticTap(a, { getConfiguredSecrets: () => secrets, workspaceRoot: '', homePath: '' });
  tap.push('OLD RAW'); await sleep(5); const b = begin('later'); resolve([]); await sleep(120);
  expect(JSON.stringify(c.frames)).not.toContain('OLD RAW'); await c.send('unsubscribe'); expect(b.isObserved()).toBe(false); b.finish();
});
test('actual adapter finishes canonical output while configured-secret lookup is stalled or observer delivery never resolves', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-native-nonblocking-'));
  const cli = path.join(tmp, 'fixture.cjs');
  fs.writeFileSync(cli, '#!/usr/bin/env node\nconsole.log(JSON.stringify({type:"text",sessionID:"s",part:{text:"canonical"}}));\n'); fs.chmodSync(cli, 0o755);
  for (const stalledSecrets of [true, false]) {
    let release; const pending = new Promise(r => { release = r; });
    const harness = new OpenCodeHarness();
    await harness.initialize({ cliPath: cli, getConfiguredSecrets: () => stalledSecrets ? pending : Promise.resolve([]) });
    const session = await harness.startThread('nonblocking', tmp);
    const translated = jest.spyOn(OpenCodeJsonEventTranslator.prototype, 'translate');
    const observer = { isObserved: () => true, available() {}, emit: () => pending, finish() {} };
    const events = [];
    let timeout;
    await Promise.race([(async () => { for await (const e of session.sendMessage('test', { nativeDiagnostic: observer, pollIntervalMs: 1 })) events.push(e); })(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('canonical stalled')), 1500); })]);
    clearTimeout(timeout);
    expect(events.map(e => e.type)).toEqual(['turn_begin', 'content', 'turn_end']);
    expect(translated).toHaveBeenCalledTimes(1); translated.mockRestore(); release([]);
    await sleep(10); await harness.dispose();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('midturn subscriber does not receive pre-open native lines still awaiting redaction', async () => {
  const c = connection(); await c.send('subscribe'); const a = begin('midturn');
  let release; const secrets = new Promise(r => { release = r; });
  const tap = createNativeDiagnosticTap(a, { getConfiguredSecrets: () => secrets, workspaceRoot: '', homePath: '' });
  tap.push('BEFORE SECOND OPEN'); await sleep(5);
  const d = connection({ epoch: 'another-epoch' }); await d.send('subscribe');
  tap.push('AFTER SECOND OPEN'); release([]); tap.finish(); await sleep(130);
  expect(c.frames.flatMap(f => f.events ?? []).map(e => e.text)).toEqual(['BEFORE SECOND OPEN', 'AFTER SECOND OPEN']);
  expect(d.frames.flatMap(f => f.events ?? []).map(e => e.text)).toEqual(['AFTER SECOND OPEN']);
});
