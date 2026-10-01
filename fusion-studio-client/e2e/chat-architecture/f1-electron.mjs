import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from '@playwright/test';
import { assertDisposablePath, assertSafePort, isPidRunning } from './fixture-lifecycle.mjs';
import { stageFixture } from './stage-fixture.mjs';

const require = createRequire(import.meta.url);
const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
if (!token || !evidenceRoot || !tempRoot) throw new Error('F1 scenario arguments are required');

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const stageRoot = path.join(tempRoot, 'stage');
const profileRoot = path.join(tempRoot, 'profile');
const workspaceRoot = path.join(tempRoot, 'workspace');
const projectPath = path.join(workspaceRoot, 'f1-empty-capture');
const projectLabel = `F1 Empty Capture ${token.slice(-8)}`;
const promptText = 'F1 empty Capture composer typing';
const adapterLog = path.join(evidenceRoot, 'adapter-events.ndjson');
const eventLog = path.join(evidenceRoot, 'scenario-events.ndjson');
const resultPath = path.join(evidenceRoot, 'f1-result.json');
fs.mkdirSync(evidenceRoot, { recursive: true });

function emit(type, details = {}) {
  const row = { at: Date.now(), type, ...details };
  fs.appendFileSync(eventLog, `${JSON.stringify(row)}\n`);
  process.stdout.write(`CHAT_ARCH_EVENT ${JSON.stringify(row)}\n`);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function descendants(pid) {
  const found = [];
  const visit = (parent) => {
    const output = spawnSync('pgrep', ['-P', String(parent)], { encoding: 'utf8' }).stdout.trim();
    if (!output) return;
    for (const value of output.split(/\s+/)) {
      const child = Number(value);
      if (!Number.isInteger(child) || found.includes(child)) continue;
      found.push(child);
      visit(child);
    }
  };
  visit(pid);
  return found;
}

function withDb(dbPath, fn) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try { return fn(db); } finally { db.close(); }
}

async function waitFor(predicate, timeoutMs, label, page) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function clickWorkspaceMenu(app, label) {
  await app.evaluate(({ Menu }, target) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    const item = workspaces?.submenu?.items.find((candidate) => candidate.label === target);
    if (!item) throw new Error(`workspace menu item unavailable: ${target}`);
    item.click();
  }, label);
}

async function createProject(app, page) {
  await clickWorkspaceMenu(app, 'Create New Project...');
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(projectPath);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill(projectLabel);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForFunction(
    (label) => document.querySelector('.rv-workspace-name')?.textContent?.includes(label),
    projectLabel,
    { timeout: 30_000 },
  );
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
}

async function selectCapture(page) {
  const active = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  if (await active.count() === 0) await page.locator('.rv-tool-btn[title="Captures"]').click();
  await active.waitFor({ timeout: 15_000 });
  return active;
}

let app = null;
let page = null;
let electronPid = null;
let launchTree = [];
let dbPath = null;
let scenarioResult = null;
let cleanupResult = null;
let failure = null;

try {
  const staged = await stageFixture({ repoRoot, stageRoot, profileRoot, workspaceRoot, token });
  dbPath = staged.dbPath;
  const sourceIdentity = {
    head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim(),
    files: [
      'fusion-studio-client/electron/main.cjs',
      'fusion-studio-client/electron/server-spawn.cjs',
      'fusion-studio-client/dist/index.html',
      'fusion-studio-server/server.js',
      'fusion-studio-server/lib/harness/registry.js',
      'fusion-studio-server/lib/db/migrations/044_thread_group_placement_outbox.js',
      'fusion-studio-client/e2e/chat-architecture/deterministic-opencode-adapter.cjs',
    ].map((relativePath) => ({ relativePath, sha256: sha256(path.join(repoRoot, relativePath)) })),
  };
  fs.writeFileSync(path.join(evidenceRoot, 'source-identity.json'), `${JSON.stringify(sourceIdentity, null, 2)}\n`);
  emit('fixture-staged', { stageRoot, profileRoot, workspaceRoot, dbPath });

  app = await electron.launch({
    cwd: staged.stagedClient,
    args: [path.join(staged.stagedClient, 'electron', 'main.cjs'), `--chat-architecture-token=${token}`],
    env: {
      ...process.env,
      FUSION_APP_USER_DATA: profileRoot,
      FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
      FUSION_CHAT_ARCH_ADAPTER_LOG: adapterLog,
      FUSION_CHAT_ARCH_FAULT_SCHEDULE: process.env.FUSION_CHAT_ARCH_FAULT_SCHEDULE || '{}',
    },
  });
  electronPid = app.process().pid;
  page = await app.firstWindow();
  const wsCounts = {};
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      try {
        const type = JSON.parse(String(payload)).type || 'unknown';
        wsCounts[type] = (wsCounts[type] || 0) + 1;
      } catch { wsCounts.unparsed = (wsCounts.unparsed || 0) + 1; }
    });
  });
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  const port = Number(fs.readFileSync(path.join(profileRoot, 'server.port'), 'utf8'));
  assertSafePort(port);
  assert.notEqual(port, 0, 'Electron server did not publish an ephemeral port');
  launchTree = descendants(electronPid);
  const runtime = await app.evaluate(({ BrowserWindow, app: electronApp }) => ({
    electron: process.versions.electron,
    node: process.versions.node,
    focused: BrowserWindow.getAllWindows()[0]?.isFocused() === true,
    visible: BrowserWindow.getAllWindows()[0]?.isVisible() === true,
    profile: electronApp.getPath('userData'),
  }));
  const browser = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    visibilityState: document.visibilityState,
    performanceObserver: typeof PerformanceObserver === 'function',
  }));
  assert.equal(path.resolve(runtime.profile), path.resolve(profileRoot));
  fs.writeFileSync(path.join(evidenceRoot, 'process-inventory.json'), `${JSON.stringify({
    token, electronPid, descendants: launchTree, port, runtime, browser,
    profileRoot, workspaceRoot, stageRoot, externalProviderProcess: false,
  }, null, 2)}\n`);
  emit('process-inventory', { electronPid, descendants: launchTree, port, runtime, browser });

  await createProject(app, page);
  await page.reload();
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  const panel = await selectCapture(page);
  assert.equal(await panel.locator('.rv-chat-item[data-thread-group-id]').count(), 0);
  await panel.locator('.rv-sidebar .rv-new-chat-btn').click();
  await waitFor(
    () => withDb(dbPath, (db) => db.prepare('SELECT COUNT(*) AS n FROM thread_groups').get().n === 1),
    30_000,
    'public New Chat persistence',
    page,
  );
  const identity = withDb(dbPath, (db) => db.prepare(`
    SELECT g.group_id AS threadGroupId, g.view_id AS viewId,
           g.current_primary_thread_id AS threadId, t.harness_id AS harnessId
      FROM thread_groups g JOIN threads t ON t.thread_id = g.current_primary_thread_id
  `).get());
  assert.equal(identity.viewId, 'capture-viewer');
  assert.equal(identity.harnessId, 'opencode');
  const textarea = panel.locator('textarea.rv-chat-input');
  await textarea.waitFor({ state: 'visible', timeout: 30_000 });
  await waitFor(() => textarea.isEnabled(), 30_000, 'composer enable after authenticated activation', page);
  await textarea.pressSequentially(promptText, { delay: 12 });
  assert.equal(await textarea.inputValue(), promptText);
  emit('composer-typed', { characters: promptText.length, exactRetention: true });

  await panel.getByRole('button', { name: 'Send message' }).click();
  await panel.locator('.rv-message-user-content', { hasText: promptText }).waitFor({ timeout: 30_000 });
  const stop = panel.locator('button[title="Stop generating"]');
  await stop.waitFor({ state: 'visible', timeout: 30_000 });
  await stop.click();
  await waitFor(
    () => withDb(dbPath, (db) => db.prepare('SELECT COUNT(*) AS n FROM exchanges').get().n === 1),
    30_000,
    'interrupted exchange readback',
    page,
  );
  await page.locator('button[title="Stop generating"]').waitFor({ state: 'hidden', timeout: 30_000 });
  const exchange = withDb(dbPath, (db) => db.prepare(
    'SELECT id, thread_id AS threadId, seq, user_input AS userInput, assistant, metadata FROM exchanges',
  ).get());
  assert.equal(exchange.threadId, identity.threadId);
  assert.equal(exchange.userInput, promptText);
  const assistant = JSON.parse(exchange.assistant);
  const metadata = JSON.parse(exchange.metadata);
  assert.ok(assistant.parts.some((part) => part.type === 'text' && part.content.includes('Deterministic fixture reply')));
  assert.equal(metadata.reason, 'interrupted');
  assert.equal(metadata.partial, true);

  await page.reload();
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  const reloadedPanel = await selectCapture(page);
  await reloadedPanel.locator('.rv-chat-item[data-thread-group-id]').first().click();
  await reloadedPanel.locator('.rv-message-user-content', { hasText: promptText }).waitFor({ timeout: 30_000 });
  await reloadedPanel.locator('.rv-message-assistant').filter({ hasText: 'Deterministic fixture reply' }).waitFor({ timeout: 30_000 });
  assert.ok(wsCounts['shell-auth:authenticated'] >= 1, 'trusted shell authentication did not complete');
  assert.equal(wsCounts['message:sent'], 1, 'server acceptance did not publish exactly one message:sent');
  assert.equal(wsCounts.turn_end, 1, 'server-owned Stop did not publish exactly one turn_end');
  scenarioResult = {
    status: 'passed', caseId: 'F1-PUBLIC-ROUTE', identity,
    exchange: { ...exchange, assistant, metadata },
    uiReadback: true, authenticatedShell: true, wsFrameCounts: wsCounts,
  };
  emit('f1-passed', { identity, exchangeId: exchange.id, wsFrameCounts: wsCounts });
} catch (error) {
  failure = error;
  if (page) await page.screenshot({ path: path.join(evidenceRoot, 'failure.png'), fullPage: true }).catch(() => {});
  emit('f1-failed', { message: error.message });
} finally {
  const beforeCloseTree = electronPid ? [electronPid, ...descendants(electronPid)] : [];
  if (app) await app.close().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 300));
  const lingering = beforeCloseTree.filter(isPidRunning);
  let dbQuickCheck = null;
  if (dbPath && fs.existsSync(dbPath)) {
    dbQuickCheck = withDb(dbPath, (db) => db.pragma('quick_check', { simple: true }));
  }
  const portFileRemoved = !fs.existsSync(path.join(profileRoot, 'server.port'));
  cleanupResult = { lingering, dbQuickCheck, portFileRemoved };
  for (const root of [stageRoot, profileRoot, workspaceRoot]) {
    if (fs.existsSync(root)) {
      assertDisposablePath(root, token);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  cleanupResult.fixtureRootsRemoved = [stageRoot, profileRoot, workspaceRoot].every((root) => !fs.existsSync(root));
  fs.writeFileSync(resultPath, `${JSON.stringify({
    ...scenarioResult,
    cleanup: cleanupResult,
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null,
  }, null, 2)}\n`);
}

assert.deepEqual(cleanupResult.lingering, [], 'owned Electron/server process remained after cleanup');
assert.equal(cleanupResult.dbQuickCheck, 'ok');
assert.equal(cleanupResult.portFileRemoved, true);
assert.equal(cleanupResult.fixtureRootsRemoved, true);
if (failure) throw failure;
process.stdout.write('CHAT_ARCH_F1_OK\n');
