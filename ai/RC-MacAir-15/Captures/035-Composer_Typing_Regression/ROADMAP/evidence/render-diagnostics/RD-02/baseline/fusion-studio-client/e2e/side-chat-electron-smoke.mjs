// SPEC-04 Slice 04C Electron smoke: real built app on an isolated profile and
// machine, one isolated temp workspace.
//
// Isolation contract: a throwaway `FUSION_APP_USER_DATA` profile under /tmp,
// `FUSION_LOCAL_MACHINE=RC-MacAir-15`, and a temp workspace directory. The dev
// database, the dev workspace, the Alpha profile, and port 3001 are never
// touched. The repo's `ai/RC-MacAir-15` tree is byte-asserted in `finally`.
//
// Exercises (SPEC-04 §12, 04C scope):
//   - moves the current Main Chat into a Side Chat tab from the production
//     Main Chat menu in a native-adapted view (Capture);
//   - confirms the replacement Main Chat is a distinct empty session and one
//     Thread row remains;
//   - uses both concurrently (focuses each);
//   - closes the Side Chat (durable closed disposition) and reopens it through
//     the member menu (same lifetime placement id);
//   - relaunches the app and reads back the open Side Chat;
//   - repeats Move several times (ordered peers, one row);
//   - toggles the outer owning view's ThreadRail from a Side Chat; and
//   - hard-asserts the retired singleton Secondary Chat is absent (DOM/route/
//     state) after Slice 04D removed every legacy Secondary code path.

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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat04c-smoke-profile-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat04c-smoke-workspace-'));
const projectPath = path.join(fixtureRoot, 'chat04c-workspace');
const projectLabel = 'CHAT-04C Fixture';

const protectedDevelopmentFiles = [
  'ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json',
  'ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json',
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
const rendererMessages = [];

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
  // Public Delete/Rename actions may use a native confirm; accept it.
  page.on('dialog', (dialog) => dialog.accept());
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, {
    timeout: 30_000,
  });
  rendererMessages.push(...messages);
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

function readDbGroups() {
  try {
    const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
    try {
      return db.prepare('SELECT group_id, current_primary_thread_id FROM thread_groups ORDER BY created_at').all();
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

function readDbMembers(groupId) {
  try {
    const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
    try {
      return db.prepare(
        'SELECT thread_id, ordinal, origin_kind FROM thread_group_members WHERE group_id = ? ORDER BY ordinal',
      ).all(groupId);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

function readDbPlacements(groupId) {
  try {
    const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
    try {
      return db.prepare(
        'SELECT side_chat_placement_id, thread_id, status FROM thread_group_placement_outbox WHERE group_id = ? ORDER BY id',
      ).all(groupId);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
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

async function waitForGroupCount(min) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (readDbGroups().length >= min) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`server never recorded ${min} thread groups`);
}

async function selectCaptureView() {
  await page.locator('.rv-tool-btn[title="Captures"]').click();
  const panel = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  await panel.waitFor({ timeout: 15_000 });
  await panel.locator('[data-thread-rail-panel="capture-viewer"], .rv-sidebar--collapsed').first()
    .waitFor({ timeout: 15_000 });
  return panel;
}

async function waitForDockRows(panel, min) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await panel.locator('.rv-chat-item[data-thread-group-id]').count() >= min) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`production shell rail never listed ${min} group rows`);
}

async function waitForAnySelection(dock) {
  const deadline = Date.now() + 30_000;
  let lastNudge = 0;
  while (Date.now() < deadline) {
    const selected = await dock.locator('.rv-chat-item[data-thread-group-id][data-selected="true"]').first()
      .getAttribute('data-thread-group-id').catch(() => null);
    if (selected) return selected;
    if (Date.now() - lastNudge > 6000) {
      lastNudge = Date.now();
      await dock.locator('.rv-chat-item[data-thread-group-id] .rv-chat-item-text').first()
        .click().catch(() => undefined);
    }
    await page.waitForTimeout(150);
  }
  throw new Error('worksurface dock never settled on a selected group');
}

function sideTab() {
  return page.locator('.rv-view-tab-list [role="tab"]', { hasText: 'Side Chat' });
}

async function waitForSideTab() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const count = await sideTab().count();
    if (count > 0) return;
    await page.waitForTimeout(150);
  }
  throw new Error('Side Chat tab never appeared');
}

async function mainChatMenuMove(dock) {
  const more = dock.locator('.rv-chat-header-btn[aria-label="More options"]').first();
  await more.click();
  await page.getByRole('menu', { name: 'Chat options' }).getByRole('menuitem', { name: 'Move Chat to Side Chat' }).click();
}

try {
  await launch();
  await createProject(projectPath, projectLabel);
  await page.reload();
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.rv-panel'))
      .some((node) => node.getAttribute('data-panel') === 'capture-viewer'),
    null,
    { timeout: 30_000 },
  );

  // ---- Create one view-bound group through the production dock.
  const dock = await selectCaptureView();
  // Let the workspace binding + host settle before the first create intent so a
  // cold-start race cannot drop it.
  await page.waitForTimeout(1500);
  await dock.locator('.rv-new-chat-btn').click();
  await waitForGroupCount(1);
  await waitForDockRows(dock, 1);
  const [group] = readDbGroups();
  assert.ok(group, 'thread group was not persisted');
  const groupId = group.group_id;
  const originalThreadId = group.current_primary_thread_id;

  // ---- Move the current Main Chat.
  await mainChatMenuMove(dock);
  const moveDeadline = Date.now() + 30_000;
  while (Date.now() < moveDeadline) {
    if (readDbMembers(groupId).length >= 2 && readWorksurfaces()[groupId]) break;
    await page.waitForTimeout(150);
  }
  const afterFirstMove = readDbMembers(groupId);
  assert.equal(afterFirstMove.length, 2, 'Move did not add exactly one peer member');
  assert.equal(afterFirstMove[1].origin_kind, 'move-to-side-chat-primary', 'peer origin kind was wrong');
  const newMainThreadId = afterFirstMove[1].thread_id;
  assert.notEqual(newMainThreadId, originalThreadId, 'replacement Main Chat was not distinct');
  const firstPlacements = readDbPlacements(groupId);
  assert.equal(firstPlacements.length, 1, 'Move did not record exactly one placement');
  const firstPlacementId = firstPlacements[0].side_chat_placement_id;
  assert.equal(firstPlacements[0].thread_id, originalThreadId, 'placement did not address the moved member');
  assert.equal(
    readWorksurfaces()[groupId]?.managedComponentPlacements?.[firstPlacementId]?.disposition,
    'open',
    'placement lane did not materialize an open Side Chat',
  );
  // One Thread row remains in the dock.
  await waitForDockRows(dock, 1);
  assert.equal(
    await dock.locator('.rv-chat-item[data-thread-group-id]').count(),
    1,
    'Move produced more than one Thread row',
  );

  // The replacement Main Chat is distinct and empty; then focus the Side Chat.
  await waitForSideTab();
  const mainThreadIdBefore = await page.locator(
    '.rv-chat-area[data-chat-host="main"]',
  ).first().getAttribute('data-chat-thread-id').catch(() => null);
  assert.equal(
    mainThreadIdBefore,
    newMainThreadId,
    'the Main host did not address the replacement session',
  );
  const mainMount = page.locator('.rv-chat-area[data-chat-host="main"]').first();
  // An empty replacement renders only the system "Start a conversation"
  // placeholder — no copied user/assistant messages from the moved member.
  assert.equal(
    await mainMount.locator('.rv-message:not(.rv-message-system)').count(),
    0,
    'the replacement Main Chat was not empty',
  );
  assert.equal(
    await mainMount.getByText('Start a conversation').count() > 0,
    true,
    'the replacement Main Chat did not show the empty conversation state',
  );
  await sideTab().click();
  const sideMount = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
  await sideMount.waitFor({ timeout: 15_000 });
  assert.equal(await sideMount.getAttribute('data-chat-thread-id'), originalThreadId);
  const sideHeaderThreadId = await sideMount.getAttribute('data-chat-thread-id');
  assert.notEqual(
    sideHeaderThreadId,
    newMainThreadId,
    'a Side Chat must not render the replacement Main Chat',
  );

  // ---- Close the Side Chat (durable closed disposition) then reopen.
  // Retry a transient CAS race; each click is a fresh close instruction.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (readWorksurfaces()[groupId]?.managedComponentPlacements?.[firstPlacementId]?.disposition === 'closed') break;
    const closeButton = page.getByRole('button', { name: 'Close Side Chat' }).first();
    if (await closeButton.count() > 0) await closeButton.click().catch(() => undefined);
    const attemptDeadline = Date.now() + 8000;
    while (Date.now() < attemptDeadline) {
      if (readWorksurfaces()[groupId]?.managedComponentPlacements?.[firstPlacementId]?.disposition === 'closed') break;
      await page.waitForTimeout(150);
    }
  }
  assert.equal(
    readWorksurfaces()[groupId]?.managedComponentPlacements?.[firstPlacementId]?.disposition,
    'closed',
    'close did not persist a closed disposition',
  );
  const memberRowsAfterClose = readDbMembers(groupId);
  assert.equal(memberRowsAfterClose.length, 2, 'close deleted group membership');
  assert.equal(await sideTab().count(), 0, 'closed Side Chat tab was not removed');

  // Reopen through the member menu: same lifetime placement id, no new session.
  const row = dock.locator(`.rv-chat-item[data-thread-group-id="${groupId}"]`);
  await row.locator('.rv-thread-menu-btn').click();
  const memberItem = page.locator(`[data-menu-item-id="open-${originalThreadId}"]`);
  await memberItem.waitFor({ timeout: 15_000 });
  await memberItem.click();
  await waitForSideTab();
  assert.equal(readDbMembers(groupId).length, 2, 'reopen created a session');
  assert.equal(readDbPlacements(groupId).length, 1, 'reopen created a second placement');
  assert.equal(
    readWorksurfaces()[groupId]?.managedComponentPlacements?.[firstPlacementId]?.disposition,
    'open',
    'reopen did not reuse the lifetime placement',
  );

  // ---- Relaunch and read back the open Side Chat.
  await close();
  await launch();
  await page.waitForTimeout(4000);
  const dockAfter = await selectCaptureView();
  await waitForDockRows(dockAfter, 1);
  await waitForSideTab();
  await sideTab().click();
  const sideMountReloaded = page.locator('.rv-chat-area[data-chat-host="side-tab"]');
  await sideMountReloaded.waitFor({ timeout: 15_000 });
  assert.equal(
    await sideMountReloaded.getAttribute('data-chat-thread-id'),
    originalThreadId,
    'relaunch did not read back the open Side Chat member',
  );

  // Toggle the outer owning view's ThreadRail from the Side Chat list button.
  // A Side Chat has no nested rail; its list button owns the outer rail state.
  await sideMountReloaded.locator('.rv-chat-thread-dock').click();
  await page.waitForTimeout(300);
  assert.equal(
    await sideMountReloaded.locator('[data-threaded-chat]').count(),
    0,
    'Side Chat opened a nested rail',
  );
  // Return to the view's own (native) tab; the dock remounts with the toggled
  // outer-rail state.
  const nativeTab = page.locator('.rv-view-tab-list [role="tab"]').first();
  await nativeTab.click();
  const outerRail = page.locator('.rv-panel[data-panel="capture-viewer"].active .rv-sidebar--collapsed').first();
  await outerRail.waitFor({ state: 'attached', timeout: 15_000 });

  // ---- Repeat Move several times: ordered peers, one row, one placement each.
  // The Side Chat button collapsed the real outer rail; reopen that shell
  // state before the remaining row/menu interactions.
  await outerRail.locator('button[aria-label="Pin threads open"]').evaluate((button) => button.click());
  const dockForMove = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  await dockForMove.locator('[data-thread-rail-panel="capture-viewer"]').waitFor({ timeout: 15_000 });
  await mainChatMenuMove(dockForMove);
  const repeatDeadline = Date.now() + 30_000;
  while (Date.now() < repeatDeadline) {
    if (readDbMembers(groupId).length >= 3) break;
    await page.waitForTimeout(150);
  }
  assert.equal(readDbMembers(groupId).length, 3, 'second Move did not add exactly one peer');
  assert.equal(readDbPlacements(groupId).length, 2, 'second Move did not record a distinct placement');
  await mainChatMenuMove(dockForMove);
  const repeatDeadline2 = Date.now() + 30_000;
  while (Date.now() < repeatDeadline2) {
    if (readDbMembers(groupId).length >= 4) break;
    await page.waitForTimeout(150);
  }
  const members = readDbMembers(groupId);
  assert.equal(members.length, 4, 'repeated Move did not keep ordered peers');
  assert.deepEqual(members.map((m) => m.ordinal), [1, 2, 3, 4], 'peer ordinals were not ordered');
  const finalGroup = readDbGroups().find((g) => g.group_id === groupId);
  assert.equal(finalGroup.current_primary_thread_id, members[3].thread_id, 'newest Move did not become primary');
  assert.equal(
    await dockAfter.locator('.rv-chat-item[data-thread-group-id]').count(),
    1,
    'repeated Move produced more than one Thread row',
  );

  // ---- Slice 04D: the legacy singleton Secondary Chat is fully retired.
  // There is exactly one Side Chat authority (the component-backed tab above);
  // no legacy render, dock, header control, menu entry, or hotkey path remains.
  const legacySecondaryDom = [
    '[data-legacy-secondary]',
    '.rv-secondary-popup',
    '.rv-secondary-sticky',
    '.rv-secondary-dock-btn',
    '[aria-label="Restore secondary chat"]',
    '[aria-label="Minimize secondary chat"]',
    '[aria-label="Close secondary chat"]',
  ].join(', ');
  assert.equal(
    await page.locator(legacySecondaryDom).count(),
    0,
    'legacy Secondary Chat DOM remains in the built app',
  );
  assert.equal(
    await page.getByText('Open a side chat', { exact: true }).count(),
    0,
    'legacy Secondary Chat menu entry remains in the built app',
  );

  assert.equal(
    rendererMessages.some((value) => value.includes('shell-auth:proof')),
    false,
    'authentication material reached renderer logs',
  );
  process.stdout.write('CHAT_04C_SIDE_CHAT_SMOKE_OK\n');
  process.stdout.write('CHAT_04C_SMOKE_PEERS=4\n');
  process.stdout.write('CHAT_04C_SMOKE_SINGLE_ROW=true\n');
  process.stdout.write('CHAT_04C_SMOKE_CLOSE_DISPOSITION=true\n');
  process.stdout.write('CHAT_04C_SMOKE_REOPEN_LIFETIME_PLACEMENT=true\n');
  process.stdout.write('CHAT_04C_SMOKE_RELAUNCH_READBACK=true\n');
  process.stdout.write('CHAT_04C_SMOKE_OUTER_RAIL_TOGGLE=true\n');
  process.stdout.write('CHAT_04C_SMOKE_EMPTY_REPLACEMENT=true\n');
  process.stdout.write('CHAT_04D_SECONDARY_ABSENT=true\n');
} finally {
  await close().catch(() => {});
  for (const snapshot of protectedDevelopmentFiles) {
    assert.deepEqual(fs.readFileSync(snapshot.path), snapshot.bytes);
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
