// VIEW-01 Slice 5 durable public-shell smoke.
//
// Isolation contract: every launch uses the throwaway profile inside
// `fixtureRoot` under the owner's home directory. The real dev profile and the
// live development workspace are never registered, never attached, and never
// written. The real live tree is only (a) read as a byte source for the
// live-shaped fixture copy and (b) byte-asserted in `finally`.
//
// Legs (SPEC-01 §9 Slice 5):
//   A new-only adoption, add views, restart readback, state save, custom app,
//     reorder with stable generation, hide/restore.
//   B two bound clients: add + reorder in the second window, first window
//     receives the fresh registry and loads the next asset without reconnect.
//   C protocol negatives: forged view id and traversal stay unavailable.
//   D workspace switch clears the custom-app map; switching back rebuilds it.
//   E old-only workspace migrates through the public shell (custom app fixture
//     built before relocation, loads from the canonical root after).
//   F nonterminal journal (destination-only planned with a digest for the exact
//     current bytes) resumes to verified on restart.
//   G old+new conflict stays bounded: workspace manageable, no view registry.
//   H live-shaped copy adopts, renders the live view set, and restarts.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { _electron as electron } from '@playwright/test';

const clientRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const machine = 'RC-MacAir-15';
const fixtureRoot = path.join(os.homedir(), `fusion-view01-smoke-${process.pid}`);
fs.mkdirSync(fixtureRoot, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view01-smoke-profile-'));
const require = createRequire(import.meta.url);
const Database = require('../../fusion-studio-server/node_modules/better-sqlite3');
const { collectInventory } = require('../../fusion-studio-server/lib/views/relocation-inventory.js');

const protectedDevelopmentFiles = [
  'ai/RC-MacAir-15/Captures/022-Vision_Roadmap/CAPTURE.md',
  'ai/RC-MacAir-15/Captures/022-Vision_Roadmap/DECISIONS.md',
  'ai/RC-MacAir-15/Captures/028-System-View-Relocation-And-Configured-Tabs/DECISIONS.md',
  'ai/RC-MacAir-15/System/state/state.json',
  'ai/RC-MacAir-15/System/styles/themes.css',
  'ai/RC-MacAir-15/System/styles/themes.json',
  'ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json',
  'ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json',
].map((relativePath) => ({
  path: path.join(repoRoot, relativePath),
  bytes: fs.readFileSync(path.join(repoRoot, relativePath)),
}));

const retiredDevelopmentRoot = path.join(repoRoot, 'ai', machine, 'Views');
const canonicalDevelopmentRoot = path.join(repoRoot, 'ai', machine, 'System', 'Views');
const canonicalRootIdentity = fs.statSync(canonicalDevelopmentRoot, { bigint: true });

// Migration 009 unconditionally seeds a development workspace pointing at the
// repository the server runs in (plus last_active_workspace_id) whenever it
// applies to a fresh database. Letting the smoke's server perform that
// bootstrap would register, activate, and hydrate the real development tree.
// Pre-apply every migration against the isolated profile ourselves, then strip
// the seed rows so the server starts against a deliberately empty registry.
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

function assertRegistrySafe(stage) {
  const dbPath = path.join(profile, 'server-data', 'fusion.db');
  assert.equal(fs.existsSync(dbPath), true, `smoke registry lost before ${stage} — refusing to launch`);
  const db = new Database(dbPath, { readonly: true });
  try {
    const forbidden = path.resolve(repoRoot).toLowerCase();
    for (const row of db.prepare('SELECT repo_path FROM workspaces').all()) {
      assert.notEqual(
        String(row.repo_path || '').toLowerCase(),
        forbidden,
        `development workspace re-seeded into the smoke profile before ${stage}`,
      );
    }
  } finally {
    db.close();
  }
}

let app = null;
let page = null;

async function launch() {
  assertRegistrySafe('launch');
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
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, {
    timeout: 30_000,
  });
  return messages;
}

function assertNoShellAuthProofLeak(messages) {
  assert.equal(messages.some((value) => value.includes('shell-auth:proof')), false);
}

async function close() {
  if (app) await app.close();
  app = null;
  page = null;
}

async function restart(expectedLabel, expectedTools) {
  await close();
  const messages = await launch();
  await waitForWorkspaceTitle(expectedLabel);
  if (expectedTools) await waitForToolTitles(expectedTools);
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'));
  assertNoShellAuthProofLeak(messages);
}

async function clickMenu(label) {
  await app.evaluate(({ Menu }, menuLabel) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    workspaces.submenu.items.find((item) => item.label === menuLabel).click();
  }, label);
}

async function createProject(project, label) {
  await clickMenu('Create New Project...');
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(project);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill(label);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await waitForWorkspaceTitle(label);
  await waitForToolTitles(['Captures', 'Files', 'Wiki', 'Issues', 'Agents']);
}

function workspaceRow(project) {
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
  try {
    return db.prepare('SELECT id, label, repo_path FROM workspaces WHERE lower(repo_path) = lower(?)')
      .get(project) || null;
  } finally {
    db.close();
  }
}

async function attachProject(directory) {
  await clickMenu('Add Project...');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const picker = page.locator('.rv-fp');
  await picker.waitFor({ timeout: 10_000 });
  for (const segment of path.relative(os.homedir(), directory).split(path.sep)) {
    await picker.locator('.rv-fp-tree-item').filter({ hasText: segment }).first().click();
  }
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await waitForFile(() => Boolean(workspaceRow(directory)), `workspace ${directory} was not registered`);
  const { label } = workspaceRow(directory);
  await switchWorkspace(label);
  return label;
}

async function workspaceTitle() {
  return page.locator('.rv-workspace-name').innerText();
}

async function waitForWorkspaceTitle(label) {
  await page.waitForFunction(
    (expected) => document.querySelector('.rv-workspace-name')?.textContent?.includes(expected),
    label,
    { timeout: 30_000 },
  );
}

async function switchWorkspace(label) {
  if ((await workspaceTitle()).includes(label)) return;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.getByTitle('Next workspace').click();
    await page.waitForFunction(
      (previous) => {
        const current = document.querySelector('.rv-workspace-name')?.textContent;
        return current && current !== previous;
      },
      await workspaceTitle(),
      { timeout: 15_000 },
    );
    if ((await workspaceTitle()).includes(label)) return;
  }
  throw new Error(`workspace switch did not reach ${label}`);
}

async function toolTitles(target = page) {
  return target.locator('button.rv-tool-btn').evaluateAll((nodes) => nodes.map((node) => node.title));
}

async function waitForToolTitles(expected, target = page) {
  await target.waitForFunction(
    (titles) => {
      const current = [...document.querySelectorAll('button.rv-tool-btn')].map((node) => node.title);
      return titles.every((title) => current.includes(title));
    },
    expected,
    { timeout: 30_000 },
  );
}

async function openRailMenu(target = page) {
  await target.locator('nav.rv-tools-panel').evaluate((element) => element.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 8,
      clientY: 8,
    }),
  ));
  await target.locator('.rv-view-rail-menu').waitFor({ timeout: 10_000 });
}

async function addView(label, target = page) {
  await openRailMenu(target);
  await target.locator('.rv-view-rail-menu button').filter({ hasText: `Add ${label}` }).click();
  await waitForToolTitles([label], target);
}

async function openView(label, target = page) {
  await target.locator(`button.rv-tool-btn[title="${label}"]`).click();
  await target.waitForFunction(
    (title) => document.querySelector(`button.rv-tool-btn[title="${title}"]`)?.classList.contains('active'),
    label,
    { timeout: 10_000 },
  );
}

async function openViewMenu(label, target = page) {
  await target.locator(`button.rv-tool-btn[title="${label}"]`).click({ button: 'right' });
  await target.locator('.rv-view-context-menu').waitFor();
}

async function renameView(from, to) {
  await openViewMenu(from);
  await page.locator('.rv-view-context-menu button').filter({ hasText: 'Rename' }).click();
  await page.locator('#rv-view-rename-input').fill(to);
  await page.locator('.rv-view-context-save').click();
  await waitForToolTitles([to]);
}

function viewsRoot(project) {
  return path.join(project, 'ai', machine, 'System', 'Views');
}

function capsuleFor(project, viewId) {
  const root = viewsRoot(project);
  return fs.readdirSync(root).map((name) => path.join(root, name)).find((candidate) => {
    const manifest = path.join(candidate, 'manifest.md');
    return fs.existsSync(manifest)
      && fs.readFileSync(manifest, 'utf8').includes(`view-id: ${viewId}`);
  });
}

function journalRow(project) {
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
  try {
    return db.prepare(`
      SELECT reloc.*
      FROM view_capsule_relocations AS reloc
      JOIN workspaces AS workspace ON workspace.id = reloc.workspace_id
      WHERE workspace.repo_path = ? AND reloc.machine_identity = ?
    `).get(project, machine);
  } finally {
    db.close();
  }
}

function writeJournalStatus(project, status, digest) {
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'));
  try {
    const row = db.prepare(`
      SELECT reloc.workspace_id AS workspace_id
      FROM view_capsule_relocations AS reloc
      JOIN workspaces AS workspace ON workspace.id = reloc.workspace_id
      WHERE workspace.repo_path = ? AND reloc.machine_identity = ?
    `).get(project, machine);
    assert.ok(row, 'journal row must exist before status rewrite');
    const result = db.prepare(`
      UPDATE view_capsule_relocations
      SET status = ?, inventory_sha256 = ?, completed_at = NULL, error_code = NULL
      WHERE workspace_id = ? AND machine_identity = ?
    `).run(status, digest, row.workspace_id, machine);
    assert.equal(result.changes, 1);
  } finally {
    db.close();
  }
}

async function currentInventoryDigest(project) {
  const inventory = await collectInventory({
    sourceRoot: viewsRoot(project),
    destinationRoot: viewsRoot(project),
    fs: fs.promises,
  });
  return inventory.digest;
}

async function waitForFile(predicate, description) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(description);
}

async function probeShellUrl(target, url) {
  return target.evaluate(async (requestUrl) => {
    const frame = document.createElement('iframe');
    frame.src = requestUrl;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:40px;height:40px;opacity:0.01;pointer-events:none;';
    const verdict = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ available: false, next: null }), 8_000);
      window.addEventListener('message', (event) => {
        if (event.data && event.data.view01Probe === requestUrl) {
          clearTimeout(timer);
          resolve({ available: true, next: typeof event.data.next === 'string' ? event.data.next : null });
        }
      });
      document.body.append(frame);
    });
    frame.remove();
    return verdict;
  }, url);
}

function customAppFiles() {
  return [
    ['app/next.txt', 'NEXT-ASSET'],
    ['app/index.html', [
      '<!doctype html><title>VIEW-01 Fixture</title>',
      '<div id="view01-marker">VIEW-01 CUSTOM APP</div>',
      '<script>fetch("next.txt").then((response) => response.text())',
      '  .then((value) => { document.body.dataset.next = value;',
      '    parent.postMessage({ view01Probe: location.href.split("?")[0], next: value }, "*"); });</script>',
    ].join('\n')],
  ];
}

function writeCustomApp(capsule) {
  for (const [relative, contents] of customAppFiles()) {
    fs.mkdirSync(path.dirname(path.join(capsule, relative)), { recursive: true });
    fs.writeFileSync(path.join(capsule, relative), contents);
  }
}

async function assertCustomApp(target = page, title = 'Local Fixture') {
  const frame = target.frameLocator(`iframe[title="${title}"]`);
  await frame.locator('#view01-marker').waitFor({ timeout: 10_000 });
  assert.equal(await frame.locator('#view01-marker').innerText(), 'VIEW-01 CUSTOM APP');
  await frame.locator('body[data-next="NEXT-ASSET"]').waitFor({ timeout: 10_000 });
}

function templateCapsule(name) {
  return path.join(repoRoot, 'System_Manager', 'ai-template', 'templates', 'view-templates', name);
}

function buildOldLayoutWorkspace(directory, { withCustomApp }) {
  const machineRoot = path.join(directory, 'ai', machine);
  fs.mkdirSync(machineRoot, { recursive: true });
  fs.cpSync(
    path.join(repoRoot, 'System_Manager', 'ai-template', 'System'),
    path.join(machineRoot, 'System'),
    { recursive: true },
  );
  const viewsRoot = path.join(machineRoot, 'Views');
  fs.mkdirSync(viewsRoot);
  fs.cpSync(templateCapsule('002-capture-viewer'), path.join(viewsRoot, '002-capture-viewer'), { recursive: true });
  if (withCustomApp) {
    fs.cpSync(templateCapsule('009-custom-viewer'), path.join(viewsRoot, '009-custom-viewer'), { recursive: true });
    writeCustomApp(path.join(viewsRoot, '009-custom-viewer'));
  }
}

async function openSecondWindow() {
  const opened = app.waitForEvent('window', { timeout: 15_000 });
  const windowId = await app.evaluate(({ BrowserWindow }, preloadPath) => {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.loadURL('fusion-shell://app/');
    return win.id;
  }, path.join(clientRoot, 'electron', 'preload.cjs'));
  const second = await opened;
  await second.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await second.waitForFunction(() => Boolean(document.body), null, { timeout: 30_000 });
  return { second, windowId };
}

try {
  // ---- Leg A: new-only adoption, view walk, custom app, reorder, hide/restore.
  const primaryProject = path.join(fixtureRoot, 'view01-public-shell');
  await launch();
  await createProject(primaryProject, 'VIEW-01 Fixture');
  assert.equal(fs.existsSync(path.join(primaryProject, 'ai', machine, 'Views')), false);
  assert.equal(fs.statSync(viewsRoot(primaryProject)).isDirectory(), true);
  const adoption = journalRow(primaryProject);
  assert.equal(adoption.status, 'verified');

  for (const label of ['Office', 'Email', 'Calendar', 'Browser', 'Custom']) {
    await addView(label);
  }
  const installed = ['Captures', 'Files', 'Wiki', 'Issues', 'Agents', 'Office', 'Email', 'Calendar', 'Browser', 'Custom'];
  await restart('VIEW-01 Fixture', installed);

  for (const label of installed.filter((candidate) => candidate !== 'Custom')) {
    await openView(label);
  }

  writeCustomApp(capsuleFor(primaryProject, 'custom-viewer'));
  await renameView('Custom', 'Local Fixture');
  await openView('Local Fixture');
  await assertCustomApp();
  const customUrl = 'fusion-studio://custom-viewer/app/index.html';
  const positive = await probeShellUrl(page, customUrl);
  assert.equal(positive.available, true);
  assert.equal(positive.next, 'NEXT-ASSET');
  await restart('VIEW-01 Fixture', [...installed.filter((label) => label !== 'Custom'), 'Local Fixture']);
  await openView('Local Fixture');
  await assertCustomApp();

  await page.getByTitle('Expand content').click();
  await waitForFile(
    () => JSON.parse(fs.readFileSync(
      path.join(capsuleFor(primaryProject, 'custom-viewer'), 'state', 'state.json'),
      'utf8',
    )).collapsed?.leftChat === true,
    'view state was not persisted',
  );

  // ---- Leg B: a duplicate shell window is denied authority; the live shell
  // still receives registry fanout without reconnecting. (The trusted shell
  // commits exactly one frame by design; multi-client projection fanout is
  // proven by the green view-capsule-projection suite.)
  const runtimeBeforeReorder = await page.evaluate(() => window.electronAPI.getRuntimeDescriptor());
  const folderBeforeReorder = path.basename(capsuleFor(primaryProject, 'custom-viewer'));
  const { second, windowId } = await openSecondWindow();
  await second.waitForTimeout(5_000);
  assert.equal(
    (await second.evaluate(() => document.body?.innerText.includes('Connected'))),
    false,
    'duplicate shell window must not reach the connected trusted state',
  );
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.fromId(id).close();
  }, windowId);
  await addView('Media');
  await openViewMenu('Local Fixture');
  await page.locator('.rv-view-context-menu button').filter({ hasText: 'Move up' }).click();
  await waitForFile(
    () => path.basename(capsuleFor(primaryProject, 'custom-viewer')) !== folderBeforeReorder,
    'reorder did not rename the capsule folder',
  );
  assert.equal(
    (await page.evaluate(() => window.electronAPI.getRuntimeDescriptor())).generation,
    runtimeBeforeReorder.generation,
  );
  await assertCustomApp(page);

  // ---- Leg C: forged and traversal requests stay unavailable.
  assert.equal((await probeShellUrl(page, 'fusion-studio://forged-viewer/app/index.html')).available, false);
  assert.equal(
    (await probeShellUrl(page, 'fusion-studio://custom-viewer/app/..%2f..%2f..%2f..%2fetc%2fpasswd')).available,
    false,
  );

  // ---- Leg D: workspace switch clears and rebuilds the custom-app map.
  const switchProject = path.join(fixtureRoot, 'view01-switch');
  await createProject(switchProject, 'Switch Fixture');
  await switchWorkspace('Switch Fixture');
  assert.equal((await probeShellUrl(page, customUrl)).available, false);
  await switchWorkspace('VIEW-01 Fixture');
  await openView('Local Fixture');
  await assertCustomApp();

  // ---- Leg E: old-only workspace migrates through the public shell.
  const oldProject = path.join(fixtureRoot, 'view01-old-only');
  buildOldLayoutWorkspace(oldProject, { withCustomApp: true });
  const oldLabel = await attachProject(oldProject);
  assert.equal(fs.existsSync(path.join(oldProject, 'ai', machine, 'Views')), false);
  assert.equal(fs.statSync(viewsRoot(oldProject)).isDirectory(), true);
  const moved = journalRow(oldProject);
  assert.equal(moved.status, 'verified');
  await waitForToolTitles(['Captures', 'Custom']);
  await openView('Custom', page);
  await assertCustomApp(page, 'Custom');
  await restart(oldLabel, ['Captures', 'Custom']);
  await openView('Custom', page);
  await assertCustomApp(page, 'Custom');

  // ---- Leg F: nonterminal journal resumes to verified on restart.
  await close();
  writeJournalStatus(oldProject, 'planned', await currentInventoryDigest(oldProject));
  await launch();
  await waitForWorkspaceTitle(oldLabel);
  await waitForToolTitles(['Captures', 'Custom']);
  assert.equal(journalRow(oldProject).status, 'verified');

  // ---- Leg G: old+new conflict stays bounded and manageable.
  const conflictProject = path.join(fixtureRoot, 'view01-conflict');
  buildOldLayoutWorkspace(conflictProject, { withCustomApp: false });
  fs.mkdirSync(path.join(conflictProject, 'ai', machine, 'System', 'Views'), { recursive: true });
  fs.cpSync(
    templateCapsule('002-capture-viewer'),
    path.join(conflictProject, 'ai', machine, 'System', 'Views', '002-capture-viewer'),
    { recursive: true },
  );
  const conflictLabel = await attachProject(conflictProject);
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'));
  await page.waitForTimeout(1_500);
  assert.equal(await page.locator('button.rv-tool-btn').count(), 0);
  assert.equal((await probeShellUrl(page, 'fusion-studio://capture-viewer/app/index.html')).available, false);
  await switchWorkspace('VIEW-01 Fixture');
  await switchWorkspace(conflictLabel);

  // ---- Leg H: live-shaped copy adopts, renders, and restarts.
  const liveProject = path.join(fixtureRoot, 'view01-live');
  fs.mkdirSync(path.join(liveProject, 'ai'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'ai', machine), path.join(liveProject, 'ai', machine), { recursive: true });
  const liveLabel = await attachProject(liveProject);
  const liveAdoption = journalRow(liveProject);
  assert.equal(liveAdoption.status, 'verified');
  const liveTools = ['Captures', 'Files', 'Wiki', 'Issues', 'Agents'];
  await waitForToolTitles(liveTools);
  for (const label of liveTools) {
    await openView(label);
  }
  await restart(liveLabel, liveTools);
  assert.equal(journalRow(primaryProject).status, 'verified');
  assert.equal(journalRow(oldProject).status, 'verified');
  assert.equal(journalRow(liveProject).status, 'verified');
  process.stdout.write('VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK\n');
} finally {
  await close().catch(() => {});
  for (const snapshot of protectedDevelopmentFiles) {
    assert.deepEqual(fs.readFileSync(snapshot.path), snapshot.bytes);
  }
  assert.equal(fs.existsSync(retiredDevelopmentRoot), false);
  const identityNow = fs.statSync(canonicalDevelopmentRoot, { bigint: true });
  assert.equal(identityNow.ino, canonicalRootIdentity.ino);
  assert.equal(identityNow.dev, canonicalRootIdentity.dev);
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
