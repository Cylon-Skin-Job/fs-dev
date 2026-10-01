import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { stageAndLaunch, createProject, createChat, selectPanel, waitFor, withDb,
  closeOwnedApp, cleanupFixture, descendants } from './electron-case-helpers.mjs';
import { commandFor, signalExactOwned } from './human-session-ownership.mjs';
import { assertDisposablePath } from './fixture-lifecycle.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
assertDisposablePath(tempRoot, token);
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const executable = path.join(tempRoot, 'native-opencode');
fs.writeFileSync(executable, `#!${process.execPath}\n${fs.readFileSync(path.join(import.meta.dirname, 'turn-outcome-native.cjs'), 'utf8')}`, { mode: 0o700 });
const records = [], frames = [];
let fixture, runtime, failure, cleanup;
async function readDb(read) {
  const deadline = Date.now() + 5000;
  for (;;) {
    try { return withDb(fixture.dbPath, { readonly: true, fileMustExist: true, timeout: 50 }, read); }
    catch (error) {
      if (error.code !== 'SQLITE_BUSY' || Date.now() >= deadline) {
        console.error('TO_READBACK_FAILED', error.code, error.message);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
const rows = threadId => readDb(db => db.prepare(
  'SELECT id,thread_id,seq,user_input,assistant,metadata FROM exchanges WHERE thread_id=? ORDER BY seq').all(threadId));
const latestThread = () => readDb(db => db.prepare(
  'SELECT g.group_id,t.thread_id FROM thread_groups g JOIN threads t ON t.thread_id=g.current_primary_thread_id ORDER BY g.rowid DESC LIMIT 1').get());
const safeMessage = 'The model process ended before the response completed.';
const heartbeat = setInterval(() => console.log('TO_OUTCOME_PROGRESS ' + records.length), 10000);
try {
  fixture = await stageAndLaunch({ repoRoot, tempRoot, token, casePrefix: 'turn-outcome', evidenceRoot,
    realServer: true, openCodePath: executable });
  const source = path.join(repoRoot, 'fusion-studio-server/lib/harness/opencode/index.js');
  assert.equal(fs.readFileSync(path.join(fixture.stagedServer, 'lib/harness/opencode/index.js'), 'utf8'), fs.readFileSync(source, 'utf8'));
  runtime = await fixture.launch();
  const { app, page } = runtime;
  const runtimeIdentity = await app.evaluate(({ app }) => ({ profile: app.getPath('userData'), electron: process.versions.electron }));
  assert.equal(path.resolve(runtimeIdentity.profile), path.resolve(fixture.profileRoot));
  fs.writeFileSync(path.join(evidenceRoot, 'turn-outcome-identity.json'), JSON.stringify({
    ...runtimeIdentity, electronPid: runtime.pid, children: descendants(runtime.pid), port: runtime.port,
    stageRoot: fixture.stageRoot, profileRoot: fixture.profileRoot, workspaceRoot: fixture.workspaceRoot,
    adapterSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    nativeFixtureSha256: crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),
    realAdapter: true, paidInference: false, canonicalFailureInjection: false,
  }, null, 2));
  page.on('websocket', socket => {
    for (const [event, direction] of [['framesent', 'out'], ['framereceived', 'in']]) socket.on(event, ({ payload }) => {
      try { const value = JSON.parse(String(payload));
        if (['prompt', 'message:sent', 'turn_end', 'chat-turn:saved', 'thread:opened', 'shell-auth:authenticated'].includes(value.type)) frames.push({ direction, ...value });
      } catch {}
    });
  });
  await createProject(app, page, path.join(fixture.workspaceRoot, 'Native-Outcome'), 'Native Outcome Fixture');
  await page.reload();
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'));
  let panel = await createChat(page, fixture.dbPath);
  const a = await latestThread();
  async function send(mode, reason, identity = a) {
    let stopProcess = null;
    await panel.locator(`[data-chat-thread-id="${identity.thread_id}"] textarea.rv-chat-input`).waitFor();
    const count = (await rows(identity.thread_id)).length;
    const priorErrors = (await rows(identity.thread_id)).filter(row => JSON.parse(row.metadata).reason === 'error').length;
    const composer = panel.locator('textarea.rv-chat-input').first();
    await waitFor(page, () => composer.isEnabled(), 'enabled next prompt');
    await composer.fill(`TO_CASE:${mode}`);
    await panel.getByRole('button', { name: 'Send message', exact: true }).click();
    if (mode === 'stop') {
      await panel.locator('.rv-message-assistant').filter({ hasText: 'Retained answer stop' }).waitFor();
      const invocations = fs.readFileSync(path.join(tempRoot, 'native-invocations.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
      stopProcess = { pid: invocations.at(-1).pid, requestedAt: Date.now() };
      assert.ok(commandFor(stopProcess.pid).includes(executable));
      await panel.locator('button[title="Stop generating"]').click();
      await waitFor(page, () => !commandFor(stopProcess.pid), 'Stop retired exact native child', 5000);
      stopProcess.absentAt = Date.now();
      await waitFor(page, () => composer.isEnabled(), 'Stop completed before readback');
    }
    await waitFor(page, async () => (await rows(identity.thread_id)).length === count + 1, `one saved ${mode}`);
    const row = (await rows(identity.thread_id)).at(-1);
    const metadata = JSON.parse(row.metadata), assistant = JSON.parse(row.assistant);
    assert.equal(metadata.reason, reason, mode);
    assert.equal(metadata.partial, ['error', 'interrupted'].includes(reason), mode);
    const receipt = await readDb(db => db.prepare(
      'SELECT request_id,turn_id,outcome FROM prompt_submission_receipts WHERE thread_id=? ORDER BY rowid DESC LIMIT 1').get(identity.thread_id));
    assert.equal(receipt.outcome, 'accepted');
    assert.equal(frames.filter(f => f.direction === 'out' && f.type === 'prompt'
      && f.threadId === identity.thread_id && f.requestId === receipt.request_id).length, 1);
    assert.equal(frames.filter(f => f.direction === 'in' && f.type === 'message:sent'
      && f.threadId === identity.thread_id && f.turnId === receipt.turn_id).length, 1);
    await waitFor(page, async () => !(await panel.locator('button[title="Stop generating"]').isVisible()), 'Stop cleared');
    await waitFor(page, () => composer.isEnabled(), 'composer released by terminal');
    const errors = panel.locator('.rv-chat-turn-error');
    await waitFor(page, async () => await errors.count() === priorErrors + (reason === 'error' ? 1 : 0), 'durable error count');
    if (reason === 'error') {
      assert.equal(metadata.terminalError.code, 'HARNESS_EXITED');
      assert.equal(metadata.terminalError.message, safeMessage);
      assert.equal(await errors.last().getAttribute('role'), 'alert');
      assert.equal(await errors.last().innerText(), `Response failed\nHARNESS_EXITED\n${safeMessage}`);
      assert.equal((await errors.last().innerText()).includes('NATIVE_PRIVATE_DENIAL'), false);
    }
    if (!['empty', 'reasoning', 'denied-only', 'compat-tool'].includes(mode)) {
      assert.ok(JSON.stringify(assistant).includes(`Retained answer ${mode}`));
      await panel.locator('.rv-message-assistant').filter({ hasText: `Retained answer ${mode}` }).last().waitFor();
    }
    if (mode === 'reasoning') assert.ok(JSON.stringify(assistant).includes('Retained fixture reasoning'));
    if (['denied', 'denied-only', 'recovered', 'success', 'compat-tool', 'tool-calls', 'stop'].includes(mode)) {
      assert.ok(assistant.parts.some(part => part.type === 'tool_call'), `tool history retained: ${mode}`);
    }
    await page.waitForTimeout(300);
    const terminals = frames.filter(f => f.direction === 'in' && f.type === 'turn_end' && f.turnId === receipt.turn_id);
    assert.equal(terminals.length, 1, `${mode}: single terminal frontier`);
    assert.equal(terminals[0].reason, reason);
    if (reason === 'error') {
      assert.deepEqual(terminals[0].terminalError, metadata.terminalError);
      assert.deepEqual(Object.keys(terminals[0].terminalError).sort(),
        ['code', 'diagnosticId', 'kind', 'message', 'recoverable'].sort());
      assert.ok(!JSON.stringify(terminals[0]).includes('NATIVE_PRIVATE_DENIAL'));
    }
    assert.ok(!(await panel.innerText()).includes('NATIVE_PRIVATE_DENIAL'), 'raw native detail must not enter ordinary presentation');
    assert.equal(frames.filter(f => f.direction === 'in' && f.type === 'chat-turn:saved' && f.turnId === receipt.turn_id).length, 1);
    assert.equal((await rows(identity.thread_id)).length, count + 1, 'no duplicate save');
    assert.ok(!JSON.stringify(assistant).includes('LATE_DUPLICATE_TEXT'));
    if (stopProcess) {
      await waitFor(page, () => !commandFor(stopProcess.pid), 'Stop retired exact native child', 5000);
      stopProcess.absentAt = Date.now();
      assert.ok(!JSON.stringify(assistant).includes('LATE_STOP_TEXT'));
    }
    records.push({ mode, identity, receipt, exchange: { ...row, metadata, assistant }, terminal: terminals[0], stopProcess, errorRows: await errors.count() });
    console.log('TO_OUTCOME_CASE_OK ' + mode);
  }
  await send('denied', 'error');
  await page.screenshot({ path: path.join(evidenceRoot, 'turn-outcome-live.png') });
  // Fresh document hydrates the exact durable failed exchange through thread:open.
  await page.reload();
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'));
  panel = await selectPanel(page, 'capture-viewer', 'Captures');
  await panel.locator(`[data-thread-group-id="${a.group_id}"]`).click();
  await panel.locator('.rv-chat-turn-error[data-error-code="HARNESS_EXITED"]').waitFor();
  assert.equal(await panel.locator('.rv-chat-turn-error').count(), 1);
  assert.equal(await panel.locator('.rv-chat-turn-error-message').innerText(), safeMessage);
  await panel.locator('.rv-message-assistant').filter({ hasText: 'Retained answer denied' }).waitFor();
  await page.screenshot({ path: path.join(evidenceRoot, 'turn-outcome-hydrated.png') });
  for (const [mode, reason] of [['success', 'stop'], ['recovered', 'stop'], ['denied-only', 'error'],
    ['tool-calls', 'error'], ['pending', 'error'], ['reasoning', 'error'], ['empty', 'error'],
    ['nonzero', 'error'], ['compat-text', 'complete'], ['compat-tool', 'complete'],
    ['terminal-nonzero', 'stop'], ['duplicate', 'stop'], ['stop', 'interrupted']]) await send(mode, reason);
  const aRows = await rows(a.thread_id);
  panel = await createChat(page, fixture.dbPath);
  const b = await latestThread(); assert.notEqual(b.thread_id, a.thread_id);
  await panel.locator(`[data-thread-group-id="${b.group_id}"]`).click();
  await send('success', 'stop', b);
  assert.equal(await panel.locator('.rv-chat-turn-error').count(), 0);
  assert.deepEqual(await rows(a.thread_id), aRows);
  await panel.locator(`[data-thread-group-id="${a.group_id}"]`).click();
  await panel.locator('.rv-chat-turn-error').first().waitFor();
  await send('success', 'stop');
  assert.equal((await rows(b.thread_id)).length, 1);
  assert.ok(frames.some(f => f.type === 'shell-auth:authenticated'));
  assert.equal(records.length, 16);
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  await runtime?.page.screenshot({ path: path.join(evidenceRoot, 'turn-outcome-failed.png') }).catch(() => {});
} finally {
  clearInterval(heartbeat);
  let lingering = await closeOwnedApp(runtime);
  if (lingering.length) {
    signalExactOwned(lingering, { token, root: tempRoot, signal: 'SIGTERM' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    lingering = lingering.filter(pid => commandFor(pid));
  }
  if (lingering.length) {
    signalExactOwned(lingering, { token, root: tempRoot, signal: 'SIGKILL' });
    await new Promise(resolve => setTimeout(resolve, 300));
    lingering = lingering.filter(pid => commandFor(pid));
  }
  if (fixture) cleanup = { lingering, ...cleanupFixture(fixture, token) };
  const invocations = path.join(tempRoot, 'native-invocations.ndjson');
  if (fs.existsSync(invocations)) fs.copyFileSync(invocations, path.join(evidenceRoot, 'turn-outcome-native-invocations.ndjson'));
  fs.writeFileSync(path.join(evidenceRoot, 'turn-outcome-result.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', records, frames, cleanup, failure }, null, 2));
}
assert.deepEqual(cleanup?.lingering, []);
assert.equal(cleanup?.dbQuickCheck, 'ok');
assert.equal(cleanup?.fixtureRootsRemoved, true);
if (failure) throw new Error(failure.stack);
console.log('TO_OUTCOME_ALL_OK');
