import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanupFixture, closeOwnedApp, createChat, createProject, selectPanel,
  stageAndLaunch, waitFor, withDb } from './electron-case-helpers.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
const repoRoot = path.resolve(import.meta.dirname, '../../..');
let fixture; let runtime; let failure; let cleanup; let lingering = [];
const evidence = { flows: {}, screenshots: [], frameCounts: {}, errors: [], consoleErrors: [] };
const readDb = (fn) => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, fn);
const prompt = '05D public UI exact partial persistence';
try {
  fixture = await stageAndLaunch({ repoRoot, token, tempRoot, evidenceRoot, casePrefix: 'r8-ui',
    eventScript: { frameIntervalMs: 50, textFrames: 200 } });
  runtime = await fixture.launch();
  const { page, app } = runtime;
  page.setDefaultTimeout(30_000);
  page.on('dialog', dialog => dialog.accept());
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
  // Observation only: production sockets retain the real Electron proof.
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    try { const frame = JSON.parse(String(payload)); const { type } = frame;
      if (type === 'error' || type === 'state:error' || type === 'thread:action:error') evidence.errors.push(frame);
      evidence.frameCounts[type] = (evidence.frameCounts[type] || 0) + 1;
    } catch {}
  }));
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Connected'));
  const project = path.join(fixture.workspaceRoot, 'ui-lifecycle');
  await createProject(app, page, project, '05D Lifecycle');
  // Match the established isolated cases: hydrate the newly created workspace
  // through a fresh authenticated connection before exercising its views.
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Connected'));
  const panel = await createChat(page, fixture.dbPath);
  const group = readDb(db => db.prepare('SELECT * FROM thread_groups').get());
  const original = group.current_primary_thread_id;
  assert.equal(group.view_id, 'capture-viewer');
  const mirrors = path.join(project, 'ai/RC-MacAir-15/Data/Chatlogs/threads');
  assert.ok(fs.existsSync(path.join(mirrors, `${original}.md`)));
  evidence.flows.create = { groupId: group.group_id, threadId: original, mirror: true };
  const composer = panel.locator('textarea.rv-chat-input').first();
  await waitFor(page, () => composer.isEnabled(), 'eager New Chat readiness');
  await composer.fill(prompt);
  await panel.getByRole('button', { name: 'Send message', exact: true }).click();
  await panel.locator('.rv-message-user-content', { hasText: prompt }).waitFor();
  await panel.locator('.rv-message-assistant', { hasText: 'Deterministic fixture reply' }).waitFor();
  await panel.locator('button[title="Stop generating"]').click();
  await waitFor(page, () => readDb(db => db.prepare('SELECT count(*) n FROM exchanges').get().n) === 1, 'Stop partial exchange');
  await panel.locator('button[title="Stop generating"]').waitFor({ state: 'hidden' });
  await waitFor(page, () => evidence.frameCounts['chat-turn:saved'] === 1, 'Stop saved acknowledgement');
  const exchange = readDb(db => db.prepare('SELECT * FROM exchanges').get());
  assert.equal(exchange.thread_id, original);
  assert.equal(exchange.user_input, prompt);
  assert.equal(JSON.parse(exchange.metadata).partial, true);
  assert.equal(JSON.parse(exchange.metadata).reason, 'interrupted');
  const receipt = readDb(db => db.prepare('SELECT * FROM prompt_submission_receipts').get());
  assert.equal(receipt.thread_id, original);
  evidence.flows.send = { accepted: true, receipt: true, exchangeId: exchange.id };
  evidence.flows.stop = { partial: true, reason: 'interrupted', threadId: original };
  await waitFor(page, () => evidence.frameCounts.wire_disconnected === 1, 'Stop provider retirement');
  // Public Main Chat menu commits Move; no direct test route or store mutation.
  await panel.locator('.rv-chat-header-btn[aria-label="More options"]').first().click();
  await page.getByRole('menu', { name: 'Chat options' }).getByRole('menuitem', { name: 'Move Chat to Side Chat' }).click();
  await waitFor(page, () => readDb(db => db.prepare('SELECT count(*) n FROM thread_group_members').get().n) === 2, 'Move membership');
  await page.locator('.rv-view-tab-list [role="tab"]', { hasText: 'Side Chat' }).waitFor();
  const moved = readDb(db => db.prepare('SELECT * FROM thread_groups').get());
  const newMain = moved.current_primary_thread_id;
  assert.notEqual(newMain, original);
  assert.equal(readDb(db => db.prepare('SELECT count(*) n FROM exchanges WHERE thread_id = ?').get(newMain).n), 0);
  const viewsRoot = path.join(project, 'ai/RC-MacAir-15/System/Views');
  const viewFolder = fs.readdirSync(viewsRoot).find(name => name.endsWith('-capture-viewer'));
  const stateFile = path.join(viewsRoot, viewFolder, 'state/state.json');
  const readState = () => JSON.parse(fs.readFileSync(stateFile, 'utf8')).threadWorksurfaces || {};
  await waitFor(page, () => JSON.stringify(readState()[group.group_id]).includes(original), 'Move file projection');
  evidence.flows.move = { original, newMain, memberCount: 2, sourceHistoryRetained: true, fileReadback: true };
  const shot = path.join(evidenceRoot, 'r8-ui-moved.png');
  await page.screenshot({ path: shot, fullPage: true }); evidence.screenshots.push(shot);
  // Same profile reconnect hydrates the committed group and exact Side history.
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Connected'));
  await selectPanel(page, 'capture-viewer', 'Captures');
  const sideTab = page.locator('.rv-view-tab-list [role="tab"]', { hasText: 'Side Chat' });
  await sideTab.waitFor(); await sideTab.click();
  await page.locator('.rv-message-user-content', { hasText: prompt }).waitFor();
  assert.equal(readDb(db => db.prepare('SELECT count(*) n FROM exchanges').get().n), 1);
  evidence.flows.reconnect = { authenticatedHydration: true, sourcePromptVisible: true, oneExchange: true };
  const restoredShot = path.join(evidenceRoot, 'r8-ui-restored.png');
  await page.screenshot({ path: restoredShot, fullPage: true }); evidence.screenshots.push(restoredShot);
  // Delete the same group through its real rail menu, including both peers.
  const row = page.locator(`.rv-panel.active .rv-chat-item[data-thread-group-id="${group.group_id}"]`);
  await row.locator('.rv-thread-menu-btn').click();
  await page.getByRole('menu', { name: 'Thread options' }).getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await waitFor(page, () => readDb(db => db.prepare('SELECT count(*) n FROM thread_groups').get().n) === 0, 'Delete SQL commit');
  await row.waitFor({ state: 'detached' });
  for (const table of ['threads', 'thread_group_members', 'exchanges', 'prompt_submission_receipts']) {
    assert.equal(readDb(db => db.prepare(`SELECT count(*) n FROM ${table}`).get().n), 0, table);
  }
  await waitFor(page, () => !readState()[group.group_id], 'Delete worksurface file cleanup');
  await waitFor(page, () => [original, newMain].every(id => !fs.existsSync(path.join(mirrors, `${id}.md`))), 'Delete mirrors');
  evidence.flows.delete = { groupAndBothPeersRemoved: true, receiptsRemoved: true, mirrorsRemoved: true, worksurfaceRemoved: true };
  assert.ok(evidence.frameCounts['shell-auth:authenticated'] >= 2);
  assert.equal(evidence.frameCounts['message:sent'], 1);
  assert.equal(evidence.frameCounts.turn_end, 1);
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  if (fixture && /locked/i.test(error.message)) {
    evidence.lockDiagnostic = { at: new Date().toISOString(),
      holders: spawnSync('lsof', ['-Fpcn', fixture.dbPath], { encoding: 'utf8' }).stdout,
      files: fs.readdirSync(path.dirname(fixture.dbPath)),
      serverTail: fs.existsSync(path.join(fixture.profileRoot, 'server-live.log'))
        ? fs.readFileSync(path.join(fixture.profileRoot, 'server-live.log'), 'utf8').slice(-16384) : null };
  }
  await runtime?.page.screenshot({ path: path.join(evidenceRoot, 'r8-ui-failure.png'), fullPage: true }).catch(() => {});
} finally {
  lingering = await closeOwnedApp(runtime);
  if (fixture) cleanup = cleanupFixture(fixture, token);
  fs.writeFileSync(path.join(evidenceRoot, 'r8-ui-result.json'), JSON.stringify({
    status: failure ? 'failed' : 'passed', ...evidence, failure, lingering, cleanup,
  }, null, 2));
}
assert.deepEqual(lingering, []);
assert.equal(cleanup?.dbQuickCheck, 'ok');
assert.equal(cleanup?.fixtureRootsRemoved, true);
if (failure) throw new Error(failure.stack);
console.log('CHAT_ARCH_R8_UI_OK');
