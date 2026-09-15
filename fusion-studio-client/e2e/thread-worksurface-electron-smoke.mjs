// CHAT-03 / SPEC-03 §11 Electron smoke: real built app on an isolated profile
// and machine, one isolated temp workspace.
//
// Isolation contract: a throwaway `FUSION_APP_USER_DATA` profile under /tmp,
// `FUSION_LOCAL_MACHINE=RC-MacAir-15`, and a temp workspace directory. The dev
// database, the dev workspace, the Alpha profile, and port 3001 are never
// touched. The repo's `ai/RC-MacAir-15` tree is only byte-asserted in `finally`.
//
// Exercises (SPEC-03 §11 whole-SPEC scenario):
//   - opens the Capture Viewer (a 03D participating built-in view) and creates
//     two view-bound thread groups through the production group-selection dock;
//   - changes content in each group (classic capture section/mode navigation)
//     and confirms the exact acknowledged entry is written to the isolated
//     workspace's view-state file;
//   - switches views (Files <-> Captures) and groups repeatedly;
//   - relaunches the app and verifies exact acknowledged restoration per group;
//   - deletes one group and confirms only its worksurface entry is removed
//     while the surviving group's worksurface entry (chat content) stays intact.

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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat03-smoke-profile-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat03-smoke-workspace-'));
const projectPath = path.join(fixtureRoot, 'chat03-workspace');
const projectLabel = 'CHAT-03 Fixture';

const protectedDevelopmentFiles = [
  'ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json',
  'ai/RC-MacAir-15/System/config/cli.json',
].map((relativePath) => ({
  path: path.join(repoRoot, relativePath),
  bytes: fs.readFileSync(path.join(repoRoot, relativePath)),
}));

// Pre-apply every migration against the isolated profile, then strip the
// development-workspace seed so the smoke server never registers the real repo.
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

async function launch() {
  const messages = [];
  app = await electron.launch({
    cwd: clientRoot,
    args: [path.join(clientRoot, 'electron', 'main.cjs')],
    env: {
      ...process.env,
      FUSION_APP_USER_DATA: profile,
      FUSION_LOCAL_MACHINE: machine,
    },
  });
  app.on('window', (candidate) => {
    candidate.on('console', (entry) => messages.push(entry.text()));
  });
  page = await app.firstWindow();
  page.on('console', (entry) => messages.push(entry.text()));
  // The public Delete action is guarded by a native confirm; accept it.
  page.on('dialog', (dialog) => dialog.accept());
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, {
    timeout: 30_000,
  });
  return messages;
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

function readGroupIds() {
  try {
    const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
    try {
      return db.prepare('SELECT group_id FROM thread_groups ORDER BY created_at').all()
        .map((row) => row.group_id);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

async function waitForGroupCount(min) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (readGroupIds().length >= min) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server never recorded ${min} thread groups`);
}

function captureStateFile() {
  const viewsRoot = path.join(projectPath, 'ai', machine, 'System', 'Views');
  const folder = fs.readdirSync(viewsRoot).find((name) => name.endsWith('-capture-viewer'));
  assert.ok(folder, 'capture-viewer view folder was not scaffolded');
  return path.join(viewsRoot, folder, 'state', 'state.json');
}

function readWorksurfaces() {
  try {
    const doc = JSON.parse(fs.readFileSync(captureStateFile(), 'utf8'));
    return doc.threadWorksurfaces ?? {};
  } catch {
    return {};
  }
}

async function waitForWorksurfaceContent(groupId, expectedMode) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const entry = readWorksurfaces()[groupId];
    if (entry?.content?.mode === expectedMode) return entry;
    await page.waitForTimeout(100);
  }
  throw new Error(`worksurface entry for ${groupId} never reached mode ${expectedMode}`);
}

async function selectCaptureView() {
  await page.locator('.rv-tool-btn[title="Captures"]').click();
  await page.locator('.rv-panel[data-panel="capture-viewer"].active').waitFor({ timeout: 15_000 });
  const toggle = page.locator(
    '.rv-panel[data-panel="capture-viewer"].active [data-worksurface-dock="capture-viewer"] .rv-worksurface-dock-toggle',
  );
  const dock = page.locator(
    '.rv-panel[data-panel="capture-viewer"].active [data-worksurface-dock="capture-viewer"]',
  );
  // Force a fresh mount so the view host re-issues its qualified `thread:list`
  // (a dock that mounted before the workspace/registry settled would otherwise
  // keep an empty cached population).
  if (await dock.getAttribute('data-open') === 'true') {
    await toggle.click();
    await page.waitForTimeout(250);
  }
  await toggle.click();
  await page.locator('.rv-panel[data-panel="capture-viewer"].active [data-threaded-chat]').first()
    .waitFor({ timeout: 15_000 });
  return dock;
}

async function waitForAnySelection(dock) {
  const deadline = Date.now() + 30_000;
  let lastNudge = 0;
  while (Date.now() < deadline) {
    const selected = await dock.locator('.rv-chat-item[data-thread-group-id][data-selected="true"]').first()
      .getAttribute('data-thread-group-id').catch(() => null);
    if (selected) return selected;
    // A remounted host may have missed its auto-MRU pass; nudge the first row.
    if (Date.now() - lastNudge > 6000) {
      lastNudge = Date.now();
      await dock.locator('.rv-chat-item[data-thread-group-id] .rv-chat-item-text').first()
        .click().catch(() => undefined);
    }
    await page.waitForTimeout(150);
  }
  throw new Error('worksurface dock never settled on a selected group');
}

async function waitForModeSelected(label) {
  await page.waitForFunction(
    (text) => Array.from(document.querySelectorAll(
      '.rv-panel[data-panel="capture-viewer"].active [aria-label="Capture sections"] button',
    )).find((button) => button.textContent?.trim() === text)?.getAttribute('aria-selected') === 'true',
    label,
    { timeout: 15_000 },
  );
}

async function waitForDockRows(dock, min) {
  const deadline = Date.now() + 45_000;
  let lastRefresh = 0;
  while (Date.now() < deadline) {
    if (await dock.locator('.rv-chat-item[data-thread-group-id]').count() >= min) return;
    // A dock that mounted before the workspace/population settled can cache an
    // empty list; force a fresh host mount periodically.
    if (Date.now() - lastRefresh > 6000) {
      lastRefresh = Date.now();
      const toggle = dock.locator('.rv-worksurface-dock-toggle');
      await toggle.click().catch(() => undefined);
      await page.waitForTimeout(250);
      await toggle.click().catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(150);
  }
  const count = await dock.locator('.rv-chat-item[data-thread-group-id]').count().catch(() => -1);
  const allRows = await dock.locator('.rv-chat-item').count().catch(() => -1);
  throw new Error(`worksurface dock never listed ${min} group rows (groupRows=${count} allRows=${allRows})`);
}

async function dismissConflict(dock) {
  const banner = dock.locator('.rv-worksurface-conflict');
  if (await banner.count() === 0) return false;
  const retry = banner.getByRole('button', { name: /Retry saving/i });
  if (await retry.count() > 0) {
    await retry.first().click().catch(() => undefined);
    return true;
  }
  return false;
}

async function selectGroup(dock, groupId) {
  const row = dock.locator(`.rv-chat-item[data-thread-group-id="${groupId}"]`);
  await row.locator('.rv-chat-item-text').click();
  const deadline = Date.now() + 20_000;
  let lastRetry = 0;
  while (Date.now() < deadline) {
    const selected = await row.getAttribute('data-selected').catch(() => null);
    if (selected === 'true') return;
    if (Date.now() - lastRetry > 2000) {
      lastRetry = Date.now();
      await dismissConflict(dock);
    }
    await page.waitForTimeout(150);
  }
  const rows = await dock.locator('.rv-chat-item[data-thread-group-id]').evaluateAll(
    (nodes) => nodes.map((node) => ({
      id: node.getAttribute('data-thread-group-id'),
      selected: node.getAttribute('data-selected'),
    })),
  );
  const conflicts = await dock.locator('.rv-worksurface-conflict').count();
  throw new Error(`group ${groupId} was not selected in the worksurface dock; conflicts=${conflicts}; rows=${JSON.stringify(rows)}`);
}

function captureModeButton(label) {
  return page.locator(
    '.rv-panel[data-panel="capture-viewer"].active [aria-label="Capture sections"] button',
    { hasText: label },
  );
}

async function selectCaptureMode(label, dock) {
  await captureModeButton(label).click();
  if (dock) await dismissConflict(dock);
  await page.waitForFunction(
    (text) => {
      const buttons = Array.from(document.querySelectorAll(
        '.rv-panel[data-panel="capture-viewer"].active [aria-label="Capture sections"] button',
      ));
      const target = buttons.find((button) => button.textContent?.trim() === text);
      return target?.getAttribute('aria-selected') === 'true';
    },
    label,
    { timeout: 15_000 },
  );
}

try {
  const messages = await launch();
  await createProject(projectPath, projectLabel);
  // A freshly-created workspace can discover its views before the registry is
  // readable, falling back to prefixed folder ids; reload once so panel ids are
  // the canonical view ids (the production built-in view mapping).
  await page.reload();
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.rv-panel'))
      .some((node) => node.getAttribute('data-panel') === 'capture-viewer'),
    null,
    { timeout: 30_000 },
  );

  // ---- Create two view-bound groups through the production dock.
  let dock = await selectCaptureView();
  // Let the workspace binding + host settle before the first create intent so a
  // cold-start race cannot drop it.
  await page.waitForTimeout(1500);
  await dock.locator('.rv-new-chat-btn').click();
  await waitForGroupCount(1);
  await dock.locator('.rv-new-chat-btn').click();
  await waitForGroupCount(2);
  await waitForDockRows(dock, 2);
  const groupIds = readGroupIds();
  assert.equal(groupIds.length, 2, 'two thread groups were not persisted');
  const [firstGroupId, secondGroupId] = groupIds;

  // ---- Change content in group 1 (Archive) and group 2 (Recent).
  await selectGroup(dock, firstGroupId);
  await selectCaptureMode('Archive', dock);
  await waitForWorksurfaceContent(firstGroupId, 'archive');

  await selectGroup(dock, secondGroupId);
  await selectCaptureMode('Recent', dock);
  await waitForWorksurfaceContent(secondGroupId, 'recent');

  // ---- Switch views repeatedly; the outgoing bound key flushes on view change.
  await selectGroup(dock, firstGroupId);
  await page.waitForFunction(
    (text) => Array.from(document.querySelectorAll(
      '.rv-panel[data-panel="capture-viewer"].active [aria-label="Capture sections"] button',
    )).find((button) => button.textContent?.trim() === text)?.getAttribute('aria-selected') === 'true',
    'Archive',
    { timeout: 15_000 },
  );
  await page.locator('.rv-tool-btn[title="Files"]').click();
  await page.locator('.rv-panel[data-panel="file-viewer"].active').waitFor({ timeout: 15_000 });
  dock = await selectCaptureView();
  await selectGroup(dock, secondGroupId);
  await page.waitForFunction(
    (text) => Array.from(document.querySelectorAll(
      '.rv-panel[data-panel="capture-viewer"].active [aria-label="Capture sections"] button',
    )).find((button) => button.textContent?.trim() === text)?.getAttribute('aria-selected') === 'true',
    'Recent',
    { timeout: 15_000 },
  );

  // ---- Relaunch and verify exact acknowledged restoration per group.
  await close();
  await launch();
  // Give the relaunched shell time to complete workspace hydration before the
  // view host issues its qualified population request.
  await page.waitForTimeout(4000);
  dock = await selectCaptureView();
  await waitForDockRows(dock, 2);
  // Exact acknowledged restoration: the relaunched renderer restores each
  // group's persisted mode; assert both entries are intact and that the
  // auto-restored (MRU) group's live capture section matches its entry.
  const selectedGroupId = await waitForAnySelection(dock);
  const restored = readWorksurfaces();
  assert.equal(restored[firstGroupId]?.content?.mode, 'archive', 'group 1 restoration was not archived');
  assert.equal(restored[secondGroupId]?.content?.mode, 'recent', 'group 2 restoration was not recent');
  const restoredMode = restored[selectedGroupId]?.content?.mode;
  assert.ok(restoredMode === 'archive' || restoredMode === 'recent', 'selected group had no restored mode');
  await waitForModeSelected(restoredMode === 'archive' ? 'Archive' : 'Recent');

  // ---- Delete the OTHER group through the public rail menu; only its entry
  // is removed while the restored/surviving group's entry stays intact.
  const victimGroupId = selectedGroupId === firstGroupId ? secondGroupId : firstGroupId;
  const victimRow = dock.locator(`.rv-chat-item[data-thread-group-id="${victimGroupId}"]`);
  await victimRow.locator('.rv-thread-menu-btn').click();
  await victimRow.locator('.rv-dropdown-item', { hasText: 'Delete' }).click();
  const deleteDeadline = Date.now() + 20_000;
  while (Date.now() < deleteDeadline) {
    if (await victimRow.count() === 0) break;
    await page.waitForTimeout(100);
  }
  assert.equal(await victimRow.count(), 0, 'deleted group row was not removed from the worksurface dock');
  const afterDelete = readWorksurfaces();
  assert.equal(afterDelete[victimGroupId], undefined, 'deleted group worksurface entry was not removed');
  assert.ok(afterDelete[selectedGroupId], 'surviving group worksurface entry was removed');
  assert.equal(
    afterDelete[selectedGroupId].content.mode,
    restoredMode,
    'surviving group content changed on delete',
  );
  // Chat/content intact: the surviving group still restores its mode.
  await waitForModeSelected(restoredMode === 'archive' ? 'Archive' : 'Recent');

  assert.equal(
    messages.some((value) => value.includes('shell-auth:proof')),
    false,
    'authentication material reached renderer logs',
  );
  process.stdout.write('CHAT_03_THREAD_WORKSURFACE_SMOKE_OK\n');
  process.stdout.write('CHAT_03_SMOKE_GROUPS=2\n');
  process.stdout.write('CHAT_03_SMOKE_DELETE_ISOLATED=true\n');
  process.stdout.write('CHAT_03_SMOKE_RELAUNCH_RESTORED=true\n');
} finally {
  await close().catch(() => {});
  for (const snapshot of protectedDevelopmentFiles) {
    assert.deepEqual(fs.readFileSync(snapshot.path), snapshot.bytes);
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
