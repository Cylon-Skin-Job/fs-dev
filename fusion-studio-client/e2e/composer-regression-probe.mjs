// Composer regression probe — investigation 2026-09-19.
// COMPOSER_CLIENT_ROOT: built client checkout (default current checkout).
// COMPOSER_HISTORY=N: copied backup exchanges; COMPOSER_REAL_THREAD=1 selects
// the largest actual backup conversation instead of combining N exchanges.
// COMPOSER_WORKSPACE_SOURCE: optional workspace-content copy, excluding runtime
// policy/state, dependencies, binaries and unsafe symlinks. Never live DBs.
// COMPOSER_SETTLE_MS: wait after focus; COMPOSER_DURATION_MS: typing duration.
// COMPOSER_LABEL: experiment label. Redirect each run to a unique log.
// frameP95/frameMax measure keydown-handler -> next rAF callback, NOT actual
// screen presentation or OS-input queueing. Wall time and long tasks must also
// be considered. Startup/hydration/focus are outside the measurement window.
// All samples use CDP keyboard events, not physical/OS input. No prompt is sent.
//
// Launches the built dev app on an isolated profile + temp workspace and
// measures chat-composer typing latency objectively:
//   - wall time for N synthetic keystrokes at a fixed delay;
//   - per-key keydown -> input latency histogram;
//   - long-task (blocking) totals during the typing window.
//
// Isolation mirrors the repo smokes: throwaway FUSION_APP_USER_DATA profile,
// FUSION_LOCAL_MACHINE=RC-MacAir-15, temp workspace; dev DB/Alpha/3001 untouched.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { _electron as electron } from '@playwright/test';

const clientRoot = process.env.COMPOSER_CLIENT_ROOT || path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const machine = 'RC-MacAir-15';
const require = createRequire(import.meta.url);
const Database = require('../../fusion-studio-server/node_modules/better-sqlite3');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-latency-probe-profile-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-latency-probe-workspace-'));
const projectPath = path.join(fixtureRoot, 'latency-probe');
const projectLabel = 'Latency Probe Fixture';

process.env.FUSION_APP_USER_DATA = profile;
const { initDb, closeDb } = require(path.join(repoRoot, 'fusion-studio-server/lib/db.js'));
await initDb();
await closeDb();
delete process.env.FUSION_APP_USER_DATA;
{
  const seedDb = new Database(path.join(profile, 'server-data', 'fusion.db'));
  try {
    seedDb.prepare("DELETE FROM workspaces WHERE id = 'fs-dev'").run();
    seedDb.prepare("DELETE FROM system_config WHERE key = 'last_active_workspace_id'").run();
  } finally {
    seedDb.close();
  }
}

let app = null;
let page = null;

function readThreadCount() {
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
  try {
    return db.prepare('SELECT COUNT(*) AS count FROM threads').get().count;
  } finally {
    db.close();
  }
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`timed out waiting: ${label}`);
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
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    const Native = window.WebSocket;
    window.__probeSockets = [];
    window.WebSocket = class extends Native { constructor(...args) { super(...args); window.__probeSockets.push(this); } };
  });
  await page.waitForURL(url => url.protocol === 'fusion-shell:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
}

async function close() {
  if (app) {
    const ownedApp = app;
    const timer = setTimeout(() => ownedApp.process().kill('SIGTERM'), 5000);
    try { await ownedApp.close(); } finally { clearTimeout(timer); }
  }
  app = null;
  page = null;
}

async function clickMenu(label) {
  await app.evaluate(({ Menu }, menuLabel) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    workspaces.submenu.items.find((item) => item.label === menuLabel).click();
  }, label);
}

async function installObservers() {
  await page.evaluate(() => {
    const state = {
      keys: [], wsSent: 0, wsReceived: 0, wsTypes: {},
      longTasks: [],
      frames: [], mutations: 0,
    };
    window.__composerProbe = state;
    for (const socket of window.__probeSockets || []) {
      socket.addEventListener('message', event => { state.wsReceived++; try { const type=JSON.parse(event.data).type; state.wsTypes[type]=(state.wsTypes[type] || 0)+1; } catch {} });
      const send = socket.send.bind(socket);
      socket.send = (...args) => { state.wsSent++; return send(...args); };
    }
    const ta = document.querySelector('.rv-panel.active .rv-chat-area textarea.rv-chat-input');
    if (!ta) throw new Error('composer textarea not found');
    ta.addEventListener('keydown', (event) => {
      const t0 = performance.now();
      requestAnimationFrame(() => state.frames.push(performance.now() - t0));
      const done = () => {
        ta.removeEventListener('input', done);
        state.keys.push({ key: event.key, ms: performance.now() - t0, valueLen: ta.value.length });
      };
      ta.addEventListener('input', done, { once: true });
      setTimeout(() => ta.removeEventListener('input', done), 2000);
    });
    new MutationObserver(records => { state.mutations += records.length; }).observe(document.querySelector('.rv-panel.active'), {subtree:true, childList:true, attributes:true, characterData:true});
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
      }).observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask unsupported; leave empty
    }
  });
}

async function readProbe() {
  return page.evaluate(() => {
    const state = window.__composerProbe ?? { keys: [], longTasks: [] };
    const latencies = state.keys.map((k) => k.ms).sort((a, b) => a - b);
    const pct = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] : null);
    return {
      frameP95: state.frames.sort((a,b)=>a-b)[Math.floor(state.frames.length * .95)] ?? null,
      frameMax: Math.max(0,...state.frames), mutations: state.mutations,
      heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
      wsSent: state.wsSent, wsReceived: state.wsReceived, wsTypes: state.wsTypes,
      keyCount: state.keys.length,
      p50: pct(50),
      p95: pct(95),
      max: latencies[latencies.length - 1] ?? null,
      longTaskCount: state.longTasks.length,
      longTaskTotalMs: state.longTasks.reduce((a, b) => a + b, 0),
      longTaskMaxMs: state.longTasks.length ? Math.max(...state.longTasks) : 0,
    };
  });
}

try {
  await launch();
  await clickMenu('Create New Project...');
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(projectPath);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill(projectLabel);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await page.reload();
  await page.waitForURL(url => url.protocol === 'fusion-shell:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });

  await page.locator('.rv-tool-btn[title="Captures"]').click();
  await page.locator('.rv-panel[data-panel="capture-viewer"].active').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.locator('.rv-panel[data-panel="capture-viewer"].active .rv-sidebar .rv-new-chat-btn').click();
  await waitFor(() => readThreadCount() === 1, 30_000, 'group never created');
  await waitFor(
    async () => await page.locator('.rv-panel[data-panel="capture-viewer"].active .rv-chat-item[data-selected="true"], .rv-panel[data-panel="capture-viewer"].active .rv-chat-item.active').count() >= 1,
    30_000,
    'rail never selected the group',
  );

  const historyCount = Number(process.env.COMPOSER_HISTORY || 0);
  if (historyCount) {
    // Copy exchange payloads only into the fixture's new session. No backup
    // workspace paths or live registry are loaded into the isolated instance.
    await close();
    if (process.env.COMPOSER_WORKSPACE_SOURCE) {
      execFileSync('rsync', ['-a', '--safe-links', '--exclude=.git', '--exclude=node_modules', '--exclude=release', '--exclude=data', '--exclude=.versions', '--exclude=Data', '--exclude=dist', '--exclude=resources', '--exclude=System', '--exclude=*.bin', '--exclude=.worktrees', process.env.COMPOSER_WORKSPACE_SOURCE.replace(/\/$/, '') + '/', projectPath + '/']);
    }
    const db = new Database(path.join(profile, 'server-data', 'fusion.db'));
    const backup = new Database(path.resolve(import.meta.dirname, '../../fusion-studio-server/data/backups/fusion.db.20260919-074207'), {readonly:true});
    const rows = process.env.COMPOSER_REAL_THREAD === '1'
      ? backup.prepare('SELECT user_input, assistant FROM exchanges WHERE thread_id=(SELECT thread_id FROM exchanges GROUP BY thread_id ORDER BY SUM(length(assistant)) DESC LIMIT 1) ORDER BY seq').all()
      : backup.prepare('SELECT user_input, assistant FROM exchanges ORDER BY id').all();
    backup.close();
    const thread = db.prepare('SELECT thread_id FROM threads LIMIT 1').get();
    const insert = db.prepare('INSERT INTO exchanges (thread_id,seq,ts,user_input,assistant,metadata) VALUES (?,?,?,?,?,?)');
    db.transaction(() => {
      for(let i=0;i<(process.env.COMPOSER_REAL_THREAD === '1' ? rows.length : historyCount);i++) {
        const row = rows[i % rows.length];
        insert.run(thread.thread_id,i+1,Date.now()+i,row.user_input,row.assistant,'[]');
      }
      db.prepare('UPDATE threads SET message_count=? WHERE thread_id=?').run(historyCount,thread.thread_id);
    })();
    db.close();
    await launch();
    await page.locator('.rv-tool-btn[title="Captures"]').click();
    await page.reload();
    await page.waitForFunction(() => window.__probeSockets?.some(s => s.readyState === 1));
    await page.waitForTimeout(1000);
    await page.evaluate(threadId => { window.__probeSockets.find(s => s.readyState === 1).send(JSON.stringify({type:'thread:open',threadId})); }, thread.thread_id);
    await page.waitForFunction(() => document.querySelectorAll('.rv-panel.active .rv-message-assistant').length > 0);
    await page.locator('.rv-tool-btn[title="Captures"]').click();
    await page.waitForTimeout(1500);
  }

  const composer = page.locator('.rv-panel[data-panel="capture-viewer"].active textarea.rv-chat-input');
  await composer.waitFor({ timeout: 15_000 });
  process.stdout.write('COMPOSER_STAGE focus\n');
  await composer.focus({timeout:60000});
  process.stdout.write('COMPOSER_STAGE focused\n');
  await page.waitForTimeout(Number(process.env.COMPOSER_SETTLE_MS || 300));

  const text = 'the quick brown fox jumps over the lazy dog and then types some more';
  const wallStart = Date.now();
  await installObservers();
  process.stdout.write('COMPOSER_STAGE typing\n');
  const durationMs = Number(process.env.COMPOSER_DURATION_MS || 0);
  let repetitions = 0;
  do {
    let typingTimer;
    try {
      await Promise.race([page.keyboard.type(text, { delay: 25 }),new Promise((_,reject) => { typingTimer=setTimeout(()=>reject(new Error('Typing batch exceeded 90 seconds')),90000); })]);
    } finally { clearTimeout(typingTimer); }
    repetitions++;
    if(repetitions % 5 === 0) process.stdout.write(`COMPOSER_PROGRESS ${JSON.stringify({elapsedMs:Date.now()-wallStart,repetitions})}\n`);
  } while (Date.now() - wallStart < durationMs);
  const wallMs = Date.now() - wallStart;
  await page.waitForTimeout(100);
  const probe = await readProbe();

  const loadAvg = os.loadavg()[0];
  const report = { timestamp: new Date().toISOString(), label: process.env.COMPOSER_LABEL || null, commit:execFileSync('git',['-C',repoRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim(), clientRoot, realThread: process.env.COMPOSER_REAL_THREAD === '1', workspaceCopy: Boolean(process.env.COMPOSER_WORKSPACE_SOURCE), historyCount, renderedMessages: await page.locator('.rv-panel.active .rv-message').count(), wallMs, chars: text.length * repetitions, repetitions, finalDraftLength: (await composer.inputValue()).length, delayMs: 25, loadAvg1m: loadAvg, ...probe };
  if (await composer.inputValue() !== text.repeat(repetitions)) throw new Error('Composer draft did not retain the exact typed text');
  process.stdout.write(`COMPOSER_LATENCY ${JSON.stringify(report)}\n`);
} catch (error) {
  if (page && !page.isClosed()) console.error('PROBE_FAILURE_STATE', await Promise.race([page.evaluate(() => ({url:location.href, text:document.body.innerText.slice(0,1200), panels:[...document.querySelectorAll('.rv-panel')].map(p=>({panel:p.dataset.panel,cls:p.className})), textareas:[...document.querySelectorAll('textarea')].map(t=>({cls:t.className,rect:t.getBoundingClientRect().toJSON()}))})), new Promise(resolve=>setTimeout(()=>resolve('renderer did not answer within 2 seconds'),2000))]).catch(() => null));
  throw error;
} finally {
  await close().catch(() => {});
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
