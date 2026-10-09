// SPEC-02 Slice 02C Electron smoke: real built app on an isolated profile and
// machine, one isolated temp workspace.
//
// Isolation contract: a throwaway `FUSION_APP_USER_DATA` profile under /tmp,
// `FUSION_LOCAL_MACHINE=RC-MacAir-15`, and a temp workspace directory. The dev
// database, the dev workspace, the Alpha profile, and port 3001 are never
// touched. The repo's `ai/RC-MacAir-15` tree is only byte-asserted in `finally`.
//
// Exercises (SPEC-02 §11 whole-SPEC scenario):
//   - open two thread groups and open each one in the Main Chat;
//   - Send in each group through the real UI + real server (outbound prompt
//     frames are captured from the renderer WebSocket prototype);
//   - Stop in EACH group: a per-group cycle selects the group, sends a long
//     harmless workspace-local prompt, polls for that group's Stop control,
//     clicks it, asserts the exact-thread `turn:stop` frame, and asserts the
//     turn terminalizes. Stop is HARD-asserted per group; the smoke fails
//     loudly if an active turn cannot be stopped (no soft skip).
//   - toggle Threads and Chat/content independently;
//   - enter/exit the chat+content full-screen arrangement;
//   - verify focus/menu accessibility of the chat header.

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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat02c-smoke-profile-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat02c-smoke-workspace-'));
const projectPath = path.join(fixtureRoot, 'chat02c-workspace');
const projectLabel = 'CHAT-02C Fixture';

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

async function installFrameCapture() {
  await page.evaluate(() => {
    window.__chat02cFrames = [];
    const originalSend = WebSocket.prototype.send;
    if (!window.__chat02cPatched) {
      window.__chat02cPatched = true;
      WebSocket.prototype.send = function patchedSend(data) {
        try { window.__chat02cFrames.push(JSON.parse(data)); } catch { /* non-JSON frame */ }
        return originalSend.call(this, data);
      };
    }
  });
}

async function frames() {
  return page.evaluate(() => window.__chat02cFrames.slice());
}

function activeSidebar(selector) {
  return page.locator(`.rv-panel.active .rv-sidebar ${selector}`);
}

function activeChat(selector = '') {
  return page.locator(`.rv-panel.active .rv-chat-area${selector}`);
}

function railRows() {
  return activeSidebar('.rv-chat-item[data-thread-group-id]');
}

async function createGroup() {
  await activeSidebar('.rv-new-chat-btn').click();
}

try {
  const messages = await launch();
  assert.equal(
    messages.some((value) => value.includes('shell-auth:proof')),
    false,
    'authentication material reached renderer logs',
  );

  await createProject(projectPath, projectLabel);
  await installFrameCapture();

  // ---- Open two thread groups through the real UI.
  await createGroup();
  await railRows().nth(0).waitFor({ timeout: 30_000 });
  await createGroup();
  await page.waitForFunction(
    () => document.querySelectorAll('.rv-panel.active .rv-sidebar .rv-chat-item[data-thread-group-id]').length >= 2,
    null,
    { timeout: 30_000 },
  );
  assert.ok((await railRows().count()) >= 2, 'two thread groups were not listed');

  // Open each group and confirm the Main Chat follows the explicit selection.
  const groupIds = await railRows().evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute('data-thread-group-id'))
  ));
  await railRows().nth(0).locator('.rv-chat-item-text').click();
  await page.waitForFunction(
    (groupId) => document.querySelector(`.rv-panel.active .rv-sidebar .rv-chat-item[data-thread-group-id="${groupId}"]`)?.getAttribute('data-selected') === 'true',
    groupIds[0],
    { timeout: 15_000 },
  );
  await railRows().nth(1).locator('.rv-chat-item-text').click();
  await page.waitForFunction(
    (groupId) => document.querySelector(`.rv-panel.active .rv-sidebar .rv-chat-item[data-thread-group-id="${groupId}"]`)?.getAttribute('data-selected') === 'true',
    groupIds[1],
    { timeout: 15_000 },
  );
  const chatThreadId = await activeChat().getAttribute('data-chat-thread-id');
  assert.ok(chatThreadId, 'Main Chat did not resolve an explicit threadId');

  // ---- Deterministic per-group Send + Stop cycle through the real UI.
  // A long, harmless workspace-local instruction keeps the real provider turn
  // active while the smoke polls (~100ms) for the Stop control and stops it.
  const LONG_PROMPT = 'Write a very long plain-text workspace reference document: describe at least 4000 words about the files in this project. Keep writing until told to stop.';
  const selectGroup = async (groupId) => {
    await page.locator(
      `.rv-panel.active .rv-sidebar .rv-chat-item[data-thread-group-id="${groupId}"] .rv-chat-item-text`,
    ).click();
    await page.waitForFunction(
      (id) => document.querySelector(`.rv-panel.active .rv-sidebar .rv-chat-item[data-thread-group-id="${id}"]`)?.getAttribute('data-selected') === 'true',
      groupId,
      { timeout: 15_000 },
    );
  };
  const sendAndStopInGroup = async (index) => {
    const groupId = groupIds[index];
    await selectGroup(groupId);
    const threadId = await activeChat().getAttribute('data-chat-thread-id');
    assert.ok(threadId, `group ${index + 1} did not resolve an explicit threadId`);

    const promptText = `${LONG_PROMPT} SMOKE-${index + 1}`;
    await activeChat(' textarea.rv-chat-input').fill(promptText);
    await activeChat(' textarea.rv-chat-input').press('Enter');
    await page.waitForFunction(
      (id) => window.__chat02cFrames.some(
        (frame) => frame.type === 'prompt' && frame.threadId === id,
      ),
      threadId,
      { timeout: 20_000 },
    );
    const prompt = (await frames()).find(
      (frame) => frame.type === 'prompt' && frame.threadId === threadId,
    );
    assert.equal(prompt.user_input, promptText);

    // Poll fast for the Stop control while THIS group stays selected.
    const deadline = Date.now() + 30_000;
    let stopVisible = false;
    while (Date.now() < deadline) {
      stopVisible = await activeChat(' .rv-stop-btn').isVisible().catch(() => false);
      if (stopVisible) break;
      await page.waitForTimeout(100);
    }
    assert.ok(stopVisible, `Stop control did not appear for active turn ${threadId}`);

    let clickError = null;
    try {
      await activeChat(' .rv-stop-btn').click({ timeout: 5_000 });
    } catch (error) {
      clickError = error;
    }
    assert.equal(clickError, null, `Stop could not be clicked for ${threadId}: ${clickError?.message}`);

    await page.waitForFunction(
      (id) => window.__chat02cFrames.some(
        (frame) => frame.type === 'turn:stop' && frame.threadId === id,
      ),
      threadId,
      { timeout: 15_000 },
    );
    // Terminalization: the turn is no longer active and the composer returns
    // to the Send control for this exact surface.
    await page.waitForFunction(() => {
      const area = document.querySelector('.rv-panel.active .rv-chat-area');
      return Boolean(area && !area.querySelector('.rv-stop-btn') && area.querySelector('.rv-send-btn-main'));
    }, null, { timeout: 30_000 });
    return threadId;
  };

  const threadOne = await sendAndStopInGroup(0);
  const threadTwo = await sendAndStopInGroup(1);
  assert.notEqual(threadOne, threadTwo, 'the two Send frames did not target distinct sessions');
  const stopFrames = (await frames()).filter((frame) => frame.type === 'turn:stop');
  assert.ok(
    stopFrames.some((frame) => frame.threadId === threadOne)
      && stopFrames.some((frame) => frame.threadId === threadTwo),
    'both groups must have captured a turn:stop frame',
  );

  // ---- Toggle Threads and Chat/content independently.
  await activeSidebar('.rv-sidebar-peek-dock').click();
  await page.locator('.rv-panel.active .rv-sidebar--collapsed')
    .waitFor({ state: 'attached', timeout: 10_000 });
  // The collapsed rail's own peek dock restores Threads (the collapsed peek
  // overlay can intercept pointer events aimed at the chat header control).
  await page.locator('.rv-panel.active .rv-sidebar--collapsed .rv-sidebar-peek-dock')
    .dispatchEvent('click');
  await page.locator('.rv-panel.active .rv-sidebar--project')
    .waitFor({ state: 'attached', timeout: 10_000 });

  await page.locator('button[aria-label="Expand content"]').click();
  await page.locator('.rv-panel.active .rv-chat-area--collapsed')
    .waitFor({ state: 'attached', timeout: 10_000 });
  await page.locator('button[aria-label="Reduce content"]').click();
  await page.locator('.rv-panel.active .rv-chat-area:not(.rv-chat-area--collapsed)')
    .waitFor({ state: 'attached', timeout: 10_000 });

  // ---- Focus/menu accessibility of the chat header.
  const more = activeChat(' .rv-chat-header [aria-label="More options"]');
  await more.focus();
  assert.equal(await more.evaluate((node) => document.activeElement === node), true, 'more-options control did not take focus');
  await page.keyboard.press('Enter');
  await page.getByRole('menu', { name: 'Chat options' }).waitFor({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await page.getByRole('menu', { name: 'Chat options' }).waitFor({ state: 'detached', timeout: 10_000 });

  assert.equal(
    messages.some((value) => value.includes('shell-auth:proof')),
    false,
    'authentication material reached renderer logs',
  );
  process.stdout.write('CHAT_SURFACE_CONCURRENCY_SMOKE_OK\n');
  process.stdout.write('CHAT_02C_SMOKE_STOP_EXERCISED=true\n');
  process.stdout.write(`CHAT_02C_SMOKE_STOP_FRAMES=${stopFrames.length}\n`);
} finally {
  await close().catch(() => {});
  for (const snapshot of protectedDevelopmentFiles) {
    assert.deepEqual(fs.readFileSync(snapshot.path), snapshot.bytes);
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
