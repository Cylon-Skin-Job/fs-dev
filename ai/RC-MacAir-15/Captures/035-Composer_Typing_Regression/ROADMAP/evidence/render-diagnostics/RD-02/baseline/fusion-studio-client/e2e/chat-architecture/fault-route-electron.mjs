import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from '@playwright/test';
import { assertDisposablePath, assertSafePort, isPidRunning } from './fixture-lifecycle.mjs';
import { stageFixture } from './stage-fixture.mjs';

const require = createRequire(import.meta.url);
const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
const [token, evidenceRoot, tempRoot, mode] = process.argv.slice(2);
if (!token || !evidenceRoot || !tempRoot || !['server-admission', 'transport-ack', 'save-ack'].includes(mode)) {
  throw new Error('fault route scenario requires server-admission, transport-ack, or save-ack');
}

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const prefix = `fault-${mode}`;
const stageRoot = path.join(tempRoot, `${prefix}-stage`);
const profileRoot = path.join(tempRoot, `${prefix}-profile`);
const workspaceRoot = path.join(tempRoot, `${prefix}-workspace`);
const projectPath = path.join(workspaceRoot, 'fresh-project');
const projectLabel = `${mode} ${token.slice(-8)}`;
const promptText = `${mode} public route proof`;
const adapterLog = path.join(evidenceRoot, `${prefix}-events.ndjson`);
const resultPath = path.join(evidenceRoot, `${prefix}-result.json`);
const schedule = mode === 'server-admission'
  ? { 'before-admission': { action: 'throw', occurrence: 1 } }
  : mode === 'transport-ack'
    ? { 'before-ack': { action: 'drop', occurrence: 1 } }
    : { 'after-save-ack': { action: 'drop', occurrence: 1 } };

function descendants(pid) {
  const output = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }).stdout.trim();
  if (!output) return [];
  return output.split(/\s+/).map(Number).flatMap((pid) => [pid, ...descendants(pid)]);
}

function readDb(dbPath, sql) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try { return db.prepare(sql).all(); } finally { db.close(); }
}

async function waitFor(page, predicate, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function createProject(app, page) {
  await app.evaluate(({ Menu }, label) => {
    const root = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    const item = root?.submenu?.items.find((candidate) => candidate.label === label);
    if (!item) throw new Error(`workspace menu item unavailable: ${label}`);
    item.click();
  }, 'Create New Project...');
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(projectPath);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill(projectLabel);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForFunction(
    (label) => document.querySelector('.rv-workspace-name')?.textContent?.includes(label),
    projectLabel,
    { timeout: 30_000 },
  );
}

let app = null;
let page = null;
let dbPath = null;
let electronPid = null;
let failure = null;
let proof = null;
let cleanup = null;

try {
  const staged = await stageFixture({ repoRoot, stageRoot, profileRoot, workspaceRoot, token });
  dbPath = staged.dbPath;
  app = await electron.launch({
    cwd: staged.stagedClient,
    args: [path.join(staged.stagedClient, 'electron', 'main.cjs'), `--chat-architecture-token=${token}`],
    env: {
      ...process.env,
      FUSION_APP_USER_DATA: profileRoot,
      FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
      FUSION_CHAT_ARCH_ADAPTER_LOG: adapterLog,
      FUSION_CHAT_ARCH_FAULT_SCHEDULE: JSON.stringify(schedule),
      FUSION_CHAT_ARCH_EVENT_SCRIPT: JSON.stringify({ frameIntervalMs: 50, textFrames: 3 }),
    },
  });
  electronPid = app.process().pid;
  page = await app.firstWindow();
  const frameCounts = {};
  const importantFrames = [];
  page.on('websocket', (socket) => socket.on('framereceived', ({ payload }) => {
    try {
      const parsed = JSON.parse(String(payload));
      const type = parsed.type || 'unknown';
      frameCounts[type] = (frameCounts[type] || 0) + 1;
      if (importantFrames.length < 64 && ['shell-auth:authenticated', 'error', 'message:sent', 'turn_begin', 'turn_end'].includes(type)) {
        importantFrames.push({ type, message: parsed.message || null });
      }
    } catch { frameCounts.unparsed = (frameCounts.unparsed || 0) + 1; }
  }));
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  const port = Number(fs.readFileSync(path.join(profileRoot, 'server.port'), 'utf8'));
  assertSafePort(port);
  assert.notEqual(port, 0);
  await createProject(app, page);
  await page.reload();
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  const panel = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  if (await panel.count() === 0) await page.locator('.rv-tool-btn[title="Captures"]').click();
  await panel.waitFor({ timeout: 15_000 });
  await panel.locator('.rv-sidebar .rv-new-chat-btn').click();
  await waitFor(page, () => readDb(dbPath, 'SELECT group_id FROM thread_groups').length === 1, 'thread creation');
  const textarea = panel.locator('textarea.rv-chat-input');
  await textarea.waitFor({ state: 'visible', timeout: 30_000 });
  await waitFor(page, () => textarea.isEnabled(), 'composer activation');
  await textarea.pressSequentially(promptText, { delay: 5 });
  assert.equal(await textarea.inputValue(), promptText);
  await panel.getByRole('button', { name: 'Send message' }).click();

  if (mode === 'server-admission') {
    await waitFor(page, () => importantFrames.some((frame) => frame.type === 'error' && frame.message === 'Message could not be accepted'), 'server rejection');
    assert.equal(frameCounts['message:sent'] || 0, 0);
    assert.equal(readDb(dbPath, 'SELECT id FROM exchanges').length, 0);
    assert.equal(readDb(dbPath, "SELECT id FROM thread_group_activity_events WHERE kind = 'prompt-accepted'").length, 0);
    const events = fs.readFileSync(adapterLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(events.some((event) => event.gate === 'before-admission' && event.owner === 'server'));
    assert.ok(!events.some((event) => event.gate === 'before-dispatch'));
    proof = { mode, authenticated: true, serverRejected: true, adapterNotDispatched: true, port, frameCounts, importantFrames };
  } else if (mode === 'transport-ack') {
    await waitFor(page, () => fs.existsSync(adapterLog)
      && fs.readFileSync(adapterLog, 'utf8').includes('"gate":"before-dispatch"'), 'adapter dispatch');
    await waitFor(page, () => readDb(dbPath, 'SELECT id FROM exchanges').length === 1, 'durable exchange');
    assert.equal(frameCounts['message:sent'] || 0, 0);
    const events = fs.readFileSync(adapterLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(events.some((event) => event.gate === 'before-ack' && event.owner === 'transport'));
    assert.ok(events.some((event) => event.gate === 'before-dispatch' && event.owner === 'adapter'));
    proof = { mode, authenticated: true, ackDropped: true, adapterDispatched: true, exchangeCount: 1, port, frameCounts, importantFrames };
  } else {
    await waitFor(page, () => readDb(dbPath, 'SELECT id FROM exchanges').length === 1, 'durable exchange');
    await waitFor(page, () => (frameCounts.turn_end || 0) === 1, 'terminal frame');
    await page.waitForTimeout(300);
    assert.equal(frameCounts['message:sent'], 1);
    assert.equal(frameCounts['chat-turn:saved'] || 0, 0);
    assert.equal(frameCounts.turn_end, 1);
    const events = fs.readFileSync(adapterLog, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(events.some((event) => event.gate === 'before-save-ack' && event.owner === 'server'));
    assert.ok(events.some((event) => event.gate === 'after-save-ack' && event.owner === 'transport'));
    proof = { mode, authenticated: true, saveAckDropped: true, turnEndPreserved: true,
      exchangeCount: 1, port, frameCounts, importantFrames };
  }
  assert.ok((frameCounts['shell-auth:authenticated'] || 0) >= 1);
} catch (error) {
  failure = error;
  if (page) await page.screenshot({ path: path.join(evidenceRoot, `${prefix}-failure.png`), fullPage: true }).catch(() => {});
} finally {
  const tree = electronPid ? [electronPid, ...descendants(electronPid)] : [];
  if (app) await app.close().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 300));
  const lingering = tree.filter(isPidRunning);
  let dbQuickCheck = null;
  if (dbPath && fs.existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try { dbQuickCheck = db.pragma('quick_check', { simple: true }); } finally { db.close(); }
  }
  for (const root of [stageRoot, profileRoot, workspaceRoot]) {
    if (fs.existsSync(root)) {
      assertDisposablePath(root, token);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  cleanup = {
    lingering,
    dbQuickCheck,
    portFileRemoved: !fs.existsSync(path.join(profileRoot, 'server.port')),
    fixtureRootsRemoved: [stageRoot, profileRoot, workspaceRoot].every((root) => !fs.existsSync(root)),
  };
  fs.writeFileSync(resultPath, `${JSON.stringify({ status: failure ? 'failed' : 'passed', proof, cleanup,
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null }, null, 2)}\n`);
}

assert.deepEqual(cleanup.lingering, []);
assert.equal(cleanup.dbQuickCheck, 'ok');
assert.equal(cleanup.portFileRemoved, true);
assert.equal(cleanup.fixtureRootsRemoved, true);
if (failure) throw failure;
process.stdout.write(`CHAT_ARCH_FAULT_ROUTE_OK ${mode}\n`);
