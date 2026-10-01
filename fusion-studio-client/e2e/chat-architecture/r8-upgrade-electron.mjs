import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { materializeF3Workspace, buildF2Exchanges } from './fixture-workloads.mjs';
import { cleanupFixture, closeOwnedApp, createProject, selectPanel, stageAndLaunch, waitFor, withDb } from './electron-case-helpers.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const workspaceId = 'upgrade-workspace';
const oldIds = ['upgrade-view-thread', 'upgrade-null-thread'];
const userText = 'Preserved pre-receipt deterministic user text';
const assistant = JSON.stringify(buildF2Exchanges().exchanges[0].assistant);
const metadata = JSON.stringify(buildF2Exchanges().exchanges[0].metadata);
let fixture; let runtime; let scaffoldFixture; let scaffoldRuntime; let failure; let cleanup; const lingering = [];
const evidence = { schema: {}, phases: [] };
const read = (fn) => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, fn);
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const history = () => read(db => db.prepare('SELECT * FROM exchanges WHERE thread_id IN (?, ?) ORDER BY id').all(...oldIds));
function observeTransport() {
  const Native = window.WebSocket;
  window.__upgrade = { sockets: [], frames: [] };
  window.__chatArchErrors = [];
  window.addEventListener('error', event => window.__chatArchErrors.push(event.message));
  window.addEventListener('unhandledrejection', event => window.__chatArchErrors.push(String(event.reason)));
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args); window.__upgrade.sockets.push(this);
      this.upgradeSent = [];
      const send = this.send.bind(this);
      this.send = payload => { try { this.upgradeSent.push(JSON.parse(payload)); } catch {} return send(payload); };
      this.addEventListener('message', event => { try { window.__upgrade.frames.push(JSON.parse(event.data)); } catch {} });
    }
  };
}
async function settlePanel() {
  let previous; let stable = 0; let samples = 0;
  await waitFor(runtime.page, async () => {
    const projection = await runtime.page.evaluate(() => ({
      requests: window.__upgrade.sockets.flatMap(socket => socket.upgradeSent.filter(frame => frame.type === 'set_panel')),
      responses: window.__upgrade.frames.filter(frame => frame.type === 'panel_changed').map(frame => frame.panel),
    }));
    const signature = JSON.stringify(projection); samples += 1;
    stable = signature === previous ? stable + 1 : 0; previous = signature;
    return projection.responses.at(-1) === 'capture-viewer' && stable >= 5;
  }, 'settled exact Capture panel binding');
  evidence.phases.push({ phase: 'panel-binding-settled', stableSamples: stable, samples, sampleIntervalMs: 100 });
}
async function request(frame, type) {
  await settlePanel();
  await runtime.page.evaluate(value => {
    const socket = [...window.__upgrade.sockets].reverse().find(item => item.readyState === WebSocket.OPEN
      && item.upgradeSent.some(frame => frame.type === 'set_panel' && frame.panel === 'capture-viewer'));
    if (!socket) throw new Error('authenticated upgrade socket unavailable');
    // Exercise the real queued duplicate-panel/read interleaving on every
    // history request, including the restored server generation.
    socket.send(JSON.stringify({ type: 'set_panel', panel: 'capture-viewer' }));
    socket.send(JSON.stringify(value));
  }, frame);
  await waitFor(runtime.page, () => runtime.page.evaluate(({ requestId, type }) =>
    window.__upgrade.frames.some(item => item.requestId === requestId && [type, 'error', 'thread:action:error'].includes(item.type)),
  { requestId: frame.requestId, type }), `${type} ${frame.requestId}`);
  return runtime.page.evaluate(({ requestId, type }) => window.__upgrade.frames.find(item => item.requestId === requestId && [type, 'error', 'thread:action:error'].includes(item.type)),
    { requestId: frame.requestId, type });
}
try {
  fixture = await stageAndLaunch({ repoRoot, tempRoot, token, evidenceRoot, casePrefix: 'r8-upgrade',
    preReceiptUpgrade: true, initScript: observeTransport, eventScript: { textFrames: 4, frameIntervalMs: 50 } });
  const project = path.join(fixture.workspaceRoot, 'historical-project');
  scaffoldFixture = await stageAndLaunch({ repoRoot, tempRoot, token, evidenceRoot, casePrefix: 'r8-upgrade-scaffold' });
  scaffoldRuntime = await scaffoldFixture.launch();
  const sourceProject = path.join(scaffoldFixture.workspaceRoot, 'historical-project');
  await createProject(scaffoldRuntime.app, scaffoldRuntime.page, sourceProject, 'Upgrade scaffold');
  lingering.push(...await closeOwnedApp(scaffoldRuntime)); scaffoldRuntime = null;
  fs.cpSync(sourceProject, project, { recursive: true });
  evidence.scaffoldCleanup = cleanupFixture(scaffoldFixture, token); scaffoldFixture = null;
  const f3 = materializeF3Workspace(project);
  evidence.fixture = { manifestHash: f3.manifestHash, counts: f3.counts };
  withDb(fixture.dbPath, {}, db => {
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='prompt_submission_receipts'").get().n, 0);
    evidence.schema.before = db.prepare('SELECT name FROM knex_migrations ORDER BY id').all().map(item => item.name);
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      db.prepare('INSERT INTO workspaces (id,label,icon,description,repo_path,sort_order) VALUES (?,?,?,?,?,?)')
        .run(workspaceId, '06A Upgrade', 'folder', 'Deterministic pre-receipt fixture', fs.realpathSync(project), 0);
      db.prepare('INSERT OR REPLACE INTO system_config (key,value,updated_at) VALUES (?,?,?)')
        .run('last_active_workspace_id', workspaceId, 1700000000000);
      for (const [index, id] of oldIds.entries()) {
        db.prepare(`INSERT INTO threads (thread_id,workspace_id,scope,view_id,name,created_at,message_count,status,updated_at,harness_id)
          VALUES (?,?,?,NULL,?,?,1,'suspended',?,'opencode')`)
          .run(id, workspaceId, 'project', `Historical ${index}`, '2023-11-14T22:13:20.000Z', 1700000000000);
        db.prepare('INSERT INTO thread_groups (group_id,workspace_id,view_id,name,current_primary_thread_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
          .run(id, workspaceId, index === 0 ? 'capture-viewer' : null, `Historical ${index}`, id, 1700000000000, 1700000000000);
        db.prepare("INSERT INTO thread_group_members (group_id,thread_id,ordinal,origin_kind,joined_at) VALUES (?,?,1,'initial',?)")
          .run(id, id, 1700000000000);
        db.prepare('INSERT INTO exchanges (thread_id,seq,ts,user_input,assistant,metadata) VALUES (?,1,?,?,?,?)')
          .run(id, 1700000000000, `${userText} ${index}`, assistant, metadata);
      }
    })();
  });
  const before = history();
  evidence.historicalDigest = digest(before);
  runtime = await fixture.launch();
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body.innerText.includes('Connected'));
  await runtime.page.waitForFunction(() => document.querySelector('.rv-workspace-name')?.textContent.includes('06A Upgrade'));
  await selectPanel(runtime.page, 'capture-viewer', 'Captures');
  await waitFor(runtime.page, () => runtime.page.evaluate(() => window.__upgrade.frames.some(frame =>
    frame.type === 'panel_changed' && frame.panel === 'capture-viewer')), 'server Capture manager ready');
  evidence.schema.after = read(db => db.prepare('SELECT name FROM knex_migrations ORDER BY id').all().map(item => item.name));
  assert.equal(evidence.schema.before.includes('045_prompt_submission_receipts.js'), false);
  assert.equal(evidence.schema.after.includes('045_prompt_submission_receipts.js'), true);
  assert.deepEqual(history(), before);
  assert.equal(read(db => db.prepare('SELECT count(*) n FROM prompt_submission_receipts').get().n), 0);
  for (const [index, id] of oldIds.entries()) {
    const opened = await request({ type: 'thread:open', scope: 'project', threadGroupId: id, threadId: id,
      historyOnly: true, requestId: `upgrade-history-${index}` }, 'thread:opened');
    assert.equal(opened.threadId, id);
    assert.equal(opened.viewId, index === 0 ? 'capture-viewer' : null);
    assert.ok(JSON.stringify(opened).includes(`${userText} ${index}`));
    evidence.phases.push({ phase: 'upgraded-public-history', threadId: id, viewId: opened.viewId, exactText: true });
  }
  const panel = await selectPanel(runtime.page, 'capture-viewer', 'Captures');
  const row = panel.locator(`.rv-chat-item[data-thread-group-id="${oldIds[0]}"]`);
  if (!(await row.isVisible())) await panel.getByRole('button', { name: 'Pin threads open' }).first().click();
  await row.click();
  await panel.locator('.rv-message-user-content', { hasText: `${userText} 0` }).waitFor();
  const composer = panel.locator('textarea.rv-chat-input').first();
  await composer.fill('06A upgraded public Send');
  await panel.getByRole('button', { name: 'Send message', exact: true }).click();
  await waitFor(runtime.page, () => read(db => db.prepare('SELECT count(*) n FROM prompt_submission_receipts WHERE thread_id=?').get(oldIds[0]).n) === 1,
    'upgraded durable receipt');
  await waitFor(runtime.page, () => read(db => db.prepare('SELECT count(*) n FROM exchanges WHERE thread_id=?').get(oldIds[0]).n) === 2,
    'upgraded exchange save');
  await waitFor(runtime.page, () => runtime.page.evaluate(() => window.__upgrade.frames.some(frame => frame.type === 'chat-turn:saved')), 'actual saved ACK');
  await panel.locator('button[title="Stop generating"]').waitFor({ state: 'hidden' });
  evidence.phases.push({ phase: 'upgraded-send', receipt: true, exchange: true, savedAck: true });
  const preservedAfterSend = history().filter(row => row.seq === 1);
  assert.deepEqual(preservedAfterSend, before);
  lingering.push(...await closeOwnedApp(runtime)); runtime = null;
  runtime = await fixture.launch();
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body.innerText.includes('Connected'));
  await selectPanel(runtime.page, 'capture-viewer', 'Captures');
  await waitFor(runtime.page, () => runtime.page.evaluate(() => window.__upgrade.frames.some(frame =>
    frame.type === 'panel_changed' && frame.panel === 'capture-viewer')), 'restarted server Capture manager ready');
  const reopened = await request({ type: 'thread:open', scope: 'project', threadGroupId: oldIds[0], threadId: oldIds[0],
    historyOnly: true, requestId: 'upgrade-restart' }, 'thread:opened');
  assert.ok(JSON.stringify(reopened).includes('06A upgraded public Send'));
  assert.deepEqual(history().filter(row => row.seq === 1), before);
  assert.equal(read(db => db.prepare('SELECT view_id FROM thread_groups WHERE group_id=?').get(oldIds[1]).view_id), null);
  assert.equal(read(db => db.prepare('SELECT count(*) n FROM prompt_submission_receipts').get().n), 1);
  evidence.routeSelection = 'observed authenticated Capture socket; each read immediately follows duplicate set_panel';
  evidence.phases.push({ phase: 'restart', historicalBytesPreserved: true, nullViewPreserved: true, oneReceipt: true });
  assert.ok(await runtime.page.evaluate(() => window.__upgrade.frames.some(frame => frame.type === 'shell-auth:authenticated')));
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  evidence.socketRoutes = await runtime?.page.evaluate(() => window.__upgrade.sockets.map(socket => ({ state: socket.readyState, sent: socket.upgradeSent.filter(frame => ['set_panel', 'thread:open'].includes(frame.type)) }))).catch(() => null);
  evidence.lastFrames = await runtime?.page.evaluate(() => window.__upgrade.frames.filter(frame => ['error', 'thread:opened', 'thread:list', 'workspace:init', 'panel_changed'].includes(frame.type)).map(({ type, requestId, code, message, threadId, viewId, panel }) => ({ type, requestId, code, message, threadId, viewId, panel }))).catch(() => null);
}
finally {
  lingering.push(...await closeOwnedApp(runtime));
  lingering.push(...await closeOwnedApp(scaffoldRuntime));
  if (scaffoldFixture) evidence.scaffoldCleanup = cleanupFixture(scaffoldFixture, token);
  if (fixture) cleanup = cleanupFixture(fixture, token);
  fs.writeFileSync(path.join(evidenceRoot, 'r8-upgrade-result.json'), JSON.stringify({ status: failure ? 'failed' : 'passed',
    evidence, failure, cleanup, lingering }, null, 2));
}
assert.deepEqual(lingering, []);
assert.equal(cleanup?.dbQuickCheck, 'ok');
assert.equal(cleanup?.fixtureRootsRemoved, true);
if (failure) throw new Error(failure.stack);
console.log('CHAT_ARCH_UPGRADE_OK');
