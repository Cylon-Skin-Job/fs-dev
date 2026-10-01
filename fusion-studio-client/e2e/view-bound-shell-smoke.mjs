// View-bound production shell smoke — owner direction 2026-09-19.
//
// Proves the production shell chat and rail are the ACTIVE VIEW's own
// population, on a real built app, isolated profile, and temp workspace:
//   - a fresh Capture family is empty and the shell chat/rail are bound to
//     `capture-viewer` (data attributes + server `view_id`);
//   - the shell rail + creates a Capture-bound group (never a null-view one);
//   - Move Chat to Side Chat works from the shell Main Chat and lands the
//     Side Chat tab in the Capture view;
//   - Office shows a different (empty) family, and Capture's family returns
//     unchanged when switching back;
//   - no `view_id NULL` groups exist anywhere.
//
// Isolation contract mirrors `side-chat-electron-smoke.mjs`: throwaway
// `FUSION_APP_USER_DATA` profile, `FUSION_LOCAL_MACHINE=RC-MacAir-15`, temp
// workspace; dev DB, Alpha profile, and port 3001 are never touched.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { _electron as electron } from '@playwright/test';

const clientRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const machine = 'RC-MacAir-15';
const require = createRequire(import.meta.url);
const Database = require('../../fusion-studio-server/node_modules/better-sqlite3');

const profile = process.env.FUSION_CHAT_ARCH_SHELL_PROFILE
  || fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shellsmoke-profile-'));
const fixtureRoot = process.env.FUSION_CHAT_ARCH_SHELL_WORKSPACE
  || fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shellsmoke-workspace-'));
const ownerToken = process.env.FUSION_CHAT_ARCH_OWNER_TOKEN || null;
for (const ownedRoot of [profile, fixtureRoot]) {
  if (!ownerToken) continue;
  const marker = JSON.parse(fs.readFileSync(path.join(ownedRoot, '.chat-architecture-owned.json'), 'utf8'));
  assert.equal(marker.sentinel, ownerToken, `runner ownership mismatch for ${ownedRoot}`);
}
const projectPath = path.join(fixtureRoot, 'view-bound-shell');
const projectLabel = 'View-Bound Shell Fixture';

const protectedDevelopmentFiles = [
  'ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json',
  'ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json',
  'ai/RC-MacAir-15/System/config/cli.json',
].map((relativePath) => ({
  path: path.join(repoRoot, relativePath),
  bytes: fs.readFileSync(path.join(repoRoot, relativePath)),
}));

process.env.FUSION_APP_USER_DATA = profile;
const { initDb, closeDb } = require('../../fusion-studio-server/lib/db.js');
await initDb();
await closeDb();
delete process.env.FUSION_APP_USER_DATA;
{
  const seedDb = new Database(path.join(profile, 'server-data', 'fusion.db'));
  try {
    seedDb.prepare("DELETE FROM workspaces WHERE id = 'fs-dev'").run();
    seedDb.prepare("DELETE FROM system_config WHERE key = 'last_active_workspace_id'").run();
    assert.equal(seedDb.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count, 0);
  } finally {
    seedDb.close();
  }
}

let app = null;
let page = null;

function withDb(fn) {
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function readGroups() {
  return withDb((db) => db.prepare(
    'SELECT group_id, view_id, current_primary_thread_id FROM thread_groups ORDER BY created_at',
  ).all());
}

function readMembers(groupId) {
  return withDb((db) => db.prepare(
    'SELECT thread_id, ordinal FROM thread_group_members WHERE group_id = ? ORDER BY ordinal',
  ).all(groupId));
}

function readNullViewCount() {
  return withDb((db) => db.prepare(
    'SELECT COUNT(*) AS count FROM thread_groups WHERE view_id IS NULL',
  ).get().count);
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`timed out waiting: ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

async function launch() {
  app = await electron.launch({
    cwd: clientRoot,
    args: [path.join(clientRoot, 'electron', 'main.cjs')],
    env: {
      ...process.env,
      FUSION_APP_USER_DATA: profile,
      FUSION_LOCAL_MACHINE: machine,
    },
  });
  await app.context().addInitScript(() => {
    window.__viewBoundShellFrames = [];
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      send(data) {
        try { window.__viewBoundShellFrames.push(JSON.parse(data)); } catch { /* non-JSON frame */ }
        return super.send(data);
      }
    };
  });
  page = await app.firstWindow();
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, {
    timeout: 30_000,
  });
  const port = Number(fs.readFileSync(path.join(profile, 'server.port'), 'utf8'));
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  assert.notEqual(port, 3001, 'shell smoke must not use the owner development port');
  if (process.env.FUSION_CHAT_ARCH_EVIDENCE_ROOT) {
    fs.writeFileSync(
      path.join(process.env.FUSION_CHAT_ARCH_EVIDENCE_ROOT, 'shell-owned-inventory.json'),
      `${JSON.stringify({
        ownerToken,
        profile,
        workspace: fixtureRoot,
        projectPath,
        port,
        electronPid: app.process().pid,
      }, null, 2)}\n`,
      { flag: 'wx' },
    );
  }
}

async function close() {
  if (app) await app.close();
  app = null;
  page = null;
}

async function clickMenu(label) {
  await app.evaluate(({ Menu }, menuLabel) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    workspaces.submenu.items.find((item) => item.label === menuLabel).click();
  }, label);
}

async function waitForWorkspaceTitle(label) {
  await page.waitForFunction(
    (expected) => document.querySelector('.rv-workspace-name')?.textContent?.includes(expected),
    label,
    { timeout: 30_000 },
  );
}

async function createProject(project, label) {
  await clickMenu('Create New Project...');
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(project);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill(label);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await waitForWorkspaceTitle(label);
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, {
    timeout: 30_000,
  });
}

async function selectPanel(viewId, title) {
  await page.locator(`.rv-tool-btn[title="${title}"]`).click();
  await page.locator(`.rv-panel[data-panel="${viewId}"].active`).waitFor({ timeout: 15_000 });
  // Let the active host issue its qualified list and settle.
  await page.waitForTimeout(1200);
  return page.locator(`.rv-panel[data-panel="${viewId}"].active`);
}

try {
  await launch();
  await createProject(projectPath, projectLabel);
  await page.reload();
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, {
    timeout: 30_000,
  });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.rv-panel'))
      .some((node) => node.getAttribute('data-panel') === 'capture-viewer'),
    null,
    { timeout: 30_000 },
  );

  // ---- Startup owns exactly one active-view population. Historical null-view
  // data has no hidden production host and therefore cannot list/open itself.
  await waitFor(
    async () => await page.evaluate(() => window.__viewBoundShellFrames
      .some((frame) => frame.type === 'thread:list')),
    30_000,
    'active shell host never requested its qualified population',
  );
  await page.waitForTimeout(500);
  const startupActiveView = await page.locator('.rv-panel.active').getAttribute('data-panel');
  const startupFrames = await page.evaluate(() => window.__viewBoundShellFrames.slice());
  const startupLists = startupFrames.filter((frame) => frame.type === 'thread:list');
  assert.equal(
    startupLists.length,
    1,
    `startup emitted redundant thread population lists: ${JSON.stringify(startupLists)}`,
  );
  assert.equal(startupLists[0].viewId, startupActiveView, 'startup list did not address the active view');
  assert.notEqual(startupLists[0].viewId, null, 'startup emitted a hidden null-view list');
  assert.equal(
    startupFrames.some((frame) => frame.type === 'thread:open'),
    false,
    'fresh startup emitted a hidden thread open',
  );

  // ---- Capture: fresh family is empty and the shell surface is view-bound.
  const capturePanel = await selectPanel('capture-viewer', 'Captures');
  assert.equal(
    await capturePanel.locator('.rv-chat-item[data-thread-group-id]').count(),
    0,
    'Capture family was not empty on a fresh workspace',
  );
  assert.equal(
    await capturePanel.locator('.rv-chat-area[data-chat-view-id="capture-viewer"]').count(),
    1,
    'shell chat is not bound to capture-viewer',
  );
  assert.equal(
    await capturePanel.locator('.rv-chat-area[data-chat-host="main"]').count(),
    1,
    'shell chat is not the view-bound main host',
  );

  // ---- The shell rail + creates a Capture-bound group.
  await capturePanel.locator('.rv-sidebar .rv-new-chat-btn').click();
  await waitFor(() => readGroups().length === 1, 30_000, 'server never recorded the shell-created group');
  const [group] = readGroups();
  assert.equal(group.view_id, 'capture-viewer', 'shell create did not bind the group to the active view');
  await waitFor(
    async () => await capturePanel.locator('.rv-chat-item[data-thread-group-id]').count() === 1,
    30_000,
    'capture rail never listed the created row',
  );
  await waitFor(
    async () => await capturePanel.locator('.rv-chat-item[data-thread-group-id][data-selected="true"]').count() === 1,
    30_000,
    'capture rail never selected the created row',
  );

  // ---- Move works from the shell Main Chat and lands the Side Chat tab.
  const more = capturePanel.locator('.rv-chat-header-btn[aria-label="More options"]').first();
  await more.click();
  // The shared menu tree is rendered in its document-level portal rather than
  // beneath the panel observation boundary.
  const moveItem = page.getByRole('menuitem', { name: 'Move Chat to Side Chat' });
  await moveItem.waitFor({ state: 'visible', timeout: 15_000 });
  await waitFor(async () => await moveItem.isEnabled(), 15_000, 'Move item never enabled in the shell chat');
  await moveItem.click();
  await waitFor(
    async () => await capturePanel.locator('.rv-view-tab-list [role="tab"]', { hasText: 'Side Chat' }).count() > 0,
    30_000,
    'Side Chat tab never appeared after the shell Move',
  );
  const movedGroup = readGroups().find((row) => row.group_id === group.group_id);
  assert.equal(readMembers(group.group_id).length, 2, 'shell Move did not add exactly one peer');
  assert.notEqual(
    movedGroup.current_primary_thread_id,
    group.current_primary_thread_id,
    'shell Move did not make the new empty Main Chat primary',
  );

  // ---- Another view shows a different family; Capture's family survives the switch.
  const otherTitle = await page.locator('.rv-tool-btn[title]').evaluateAll(
    (nodes, captureTitle) => nodes
      .map((node) => node.getAttribute('title'))
      .find((title) => title && title !== captureTitle),
    'Captures',
  );
  assert.ok(otherTitle, 'no second view exists to switch to');
  await page.locator(`.rv-tool-btn[title="${otherTitle}"]`).click();
  await page.locator('.rv-panel.active').waitFor({ timeout: 15_000 });
  const otherViewId = await page.locator('.rv-panel.active').getAttribute('data-panel');
  assert.ok(otherViewId && otherViewId !== 'capture-viewer', 'did not switch to another view');
  await page.waitForTimeout(1200);
  const otherPanel = page.locator(`.rv-panel[data-panel="${otherViewId}"].active`);
  assert.equal(
    await otherPanel.locator('.rv-chat-item[data-thread-group-id]').count(),
    0,
    `${otherViewId} listed Capture rows; view populations are not isolated`,
  );
  assert.equal(
    await otherPanel.locator(`.rv-chat-area[data-chat-view-id="${otherViewId}"]`).count(),
    1,
    `${otherViewId} shell chat is not bound to its own view`,
  );
  await selectPanel('capture-viewer', 'Captures');
  await waitFor(
    async () => await page.locator('.rv-panel[data-panel="capture-viewer"].active .rv-chat-item[data-thread-group-id]').count() === 1,
    30_000,
    'Capture family did not return after switching back',
  );

  // ---- No null-view groups anywhere under the new standard.
  assert.equal(readNullViewCount(), 0, 'null-view groups exist after the wipe + flip');

  process.stdout.write('VIEW_BOUND_SHELL_SMOKE_OK\n');
  process.stdout.write('VIEW_BOUND_SHELL_CAPTURE_FAMILY=1\n');
  process.stdout.write('VIEW_BOUND_SHELL_SHELL_CREATE_BOUND=true\n');
  process.stdout.write('VIEW_BOUND_SHELL_MOVE_FROM_SHELL=true\n');
  process.stdout.write(`VIEW_BOUND_SHELL_OTHER_VIEW=${otherViewId}\n`);
  process.stdout.write('VIEW_BOUND_SHELL_OTHER_FAMILY=0\n');
  process.stdout.write('VIEW_BOUND_SHELL_NULL_VIEW_GROUPS=0\n');
  process.stdout.write('VIEW_BOUND_SHELL_STARTUP_LISTS=1\n');
  process.stdout.write('VIEW_BOUND_SHELL_STARTUP_NULL_LISTS=0\n');
  process.stdout.write('VIEW_BOUND_SHELL_STARTUP_OPENS=0\n');
} finally {
  await close().catch(() => {});
  for (const snapshot of protectedDevelopmentFiles) {
    assert.deepEqual(fs.readFileSync(snapshot.path), snapshot.bytes);
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
