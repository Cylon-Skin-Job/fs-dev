import { _electron as electron } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { runChatSendNativeScenario } from './chat-send-native-scenario.mjs';
import { runChatRecoveryNativeScenario } from './chat-recovery-native-scenario.mjs';

const clientRoot = path.resolve(import.meta.dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shell-auth-smoke-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shell-auth-workspace-'));
const projectPath = path.join(fixtureRoot, 'auth-workspace');
const require = createRequire(import.meta.url);
const Database = require('../../fusion-studio-server/node_modules/better-sqlite3');
// Migrations seed fs-dev into each new profile. Remove it before any server or
// Electron process starts, so this smoke can never mount the development tree.
const executablePath = process.env.FUSION_SMOKE_EXECUTABLE || undefined;
const launchOptions = {
  cwd: clientRoot,
  env: {
    ...process.env,
    FUSION_APP_USER_DATA: profile,
    FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
  },
  ...(executablePath
    ? { executablePath, args: [] }
    : { args: [path.join(clientRoot, 'electron', 'main.cjs')] }),
};

function findServerPid(electronPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' });
  for (const row of rows.split('\n')) {
    const match = row.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!match || Number(match[2]) !== electronPid) continue;
    if (/fusion-studio-server\/server\.js(?:\s|$)/.test(match[3])) return Number(match[1]);
  }
  throw new Error('server child not found');
}

async function waitForMessage(messages, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (messages.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

let app;
let replacementServerPid;
try {
  const previousProfile = process.env.FUSION_APP_USER_DATA;
  process.env.FUSION_APP_USER_DATA = profile;
  try {
    const { initDb, closeDb } = require('../../fusion-studio-server/lib/db.js');
    await initDb();
    await closeDb();
  } finally {
    if (previousProfile === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousProfile;
  }
  {
    const db = new Database(path.join(profile, 'server-data', 'fusion.db'));
    try {
      db.prepare("DELETE FROM workspaces WHERE id = 'fs-dev'").run();
      db.prepare("DELETE FROM system_config WHERE key = 'last_active_workspace_id'").run();
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count, 0);
    } finally {
      db.close();
    }
  }

  app = await electron.launch(launchOptions);
  if (process.env.FUSION_SMOKE_FORCE_FAILURE === '1') throw new Error('Forced isolated smoke failure');
  const messages = [];
  const attached = new WeakSet();
  const attach = (page) => {
    if (attached.has(page)) return;
    attached.add(page);
    page.on('console', (entry) => messages.push(entry.text()));
  };
  app.on('window', attach);
  const page = await app.firstWindow();
  attach(page);
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body && window.electronAPI, null, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.innerText.length > 0, null, { timeout: 30_000 });
  const first = await page.evaluate(() => window.electronAPI.getRuntimeDescriptor());
  if (!first || typeof first.generation !== 'string') throw new Error('initial runtime descriptor unavailable');
  await waitForMessage(messages, (value) => value.includes('[WS] Authenticated'));
  await waitForMessage(messages, (value) => value.includes('workspace:init'));
  if (!messages.some((value) => value.includes('[WS] Authenticated'))) throw new Error('initial shell authentication not observed');
  if (!messages.some((value) => value.includes('workspace:init'))) throw new Error('initial workspace hydration not observed');
  if (messages.findIndex((value) => value.includes('[WS] Authenticated'))
    > messages.findIndex((value) => value.includes('workspace:init'))) {
    throw new Error('workspace initialization was released before authentication');
  }
  if (messages.some((value) => value.includes('shell-auth:challenge') || value.includes('shell-auth:proof'))) {
    throw new Error('authentication material reached renderer logs');
  }

  // Install only a disposable workspace through the public shell action.
  await app.evaluate(({ Menu }) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    workspaces.submenu.items.find((item) => item.label === 'Create New Project...').click();
  });
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(projectPath);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill('Auth Smoke Fixture');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.rv-workspace-name')?.textContent?.includes('Auth Smoke Fixture'));
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
  try {
    const roots = db.prepare('SELECT repo_path FROM workspaces').all().map((row) => fs.realpathSync(row.repo_path));
    assert.deepEqual(roots, [fs.realpathSync(projectPath)]);
  } finally {
    db.close();
  }

  const initialInitCount = messages.filter((value) => value.includes('workspace:init')).length;
  const serverPid = findServerPid(app.process().pid);
  process.kill(serverPid, 'SIGKILL');
  await page.waitForFunction(async (generation) => {
    const descriptor = await window.electronAPI?.getRuntimeDescriptor();
    return descriptor && descriptor.generation !== generation;
  }, first.generation, { timeout: 45_000 });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline
    && messages.filter((value) => value.includes('[WS] Authenticated')).length < 2) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const authCount = messages.filter((value) => value.includes('[WS] Authenticated')).length;
  const initCount = messages.filter((value) => value.includes('workspace:init')).length;
  if (authCount !== 2 || initCount !== initialInitCount + 1) {
    throw new Error('restart reauthentication failed');
  }
  const second = await page.evaluate(() => window.electronAPI.getRuntimeDescriptor());
  replacementServerPid = findServerPid(app.process().pid);
  if (second.generation === first.generation || second.webSocketUrl === first.webSocketUrl) {
    throw new Error('runtime authority did not rotate');
  }
  await app.close();
  app = null;
  const c2 = await runChatSendNativeScenario();
  assert.deepEqual(c2, { prompts: 2, acknowledgements: 2, exchanges: 2, movedMembers: 2 });
  const c3 = await runChatRecoveryNativeScenario();
  assert.deepEqual(c3, { prompts: 2, receipts: 2, exchanges: 2, statusQueries: 2,
    definiteRefusals: 1, uncertainThrows: 1 });
  process.stdout.write('TRUSTED_SHELL_AUTH_SMOKE_OK\n');
} finally {
  if (app) await app.close().catch(() => {});
  try {
    if (replacementServerPid) {
      try { process.kill(replacementServerPid, 0); throw new Error('owned replacement server survived app close'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  } finally {
    try { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
    finally { fs.rmSync(profile, { recursive: true, force: true }); }
  }
}
