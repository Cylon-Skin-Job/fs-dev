// Composer keystroke-latency probe — owner report 2026-09-19.
//
// Launches the built dev app on an isolated profile + temp workspace and
// measures chat-composer typing latency objectively:
//   - wall time for N synthetic keystrokes at a fixed delay;
//   - per-key keydown -> input latency histogram;
//   - long-task (blocking) totals during the typing window.
//
// Isolation mirrors the repo smokes: throwaway FUSION_APP_USER_DATA profile,
// FUSION_LOCAL_MACHINE=RC-MacAir-15, temp workspace; dev DB/Alpha/3001 untouched.

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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-latency-probe-profile-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-latency-probe-workspace-'));
const projectPath = path.join(fixtureRoot, 'latency-probe');
const projectLabel = 'Latency Probe Fixture';

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
  } finally {
    seedDb.close();
  }
}

let app = null;
let page = null;

function readGroupCount() {
  const db = new Database(path.join(profile, 'server-data', 'fusion.db'), { readonly: true });
  try {
    return db.prepare('SELECT COUNT(*) AS count FROM thread_groups').get().count;
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
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
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

async function installObservers() {
  await page.evaluate(() => {
    const state = {
      keys: [],
      longTasks: [],
      inputEventLatency: [],
    };
    window.__composerProbe = state;
    const ta = document.querySelector('.rv-panel.active .rv-chat-area textarea.rv-chat-input');
    if (!ta) throw new Error('composer textarea not found');
    ta.addEventListener('keydown', (event) => {
      const t0 = performance.now();
      const done = () => {
        ta.removeEventListener('input', done);
        state.keys.push({ key: event.key, ms: performance.now() - t0, valueLen: ta.value.length });
      };
      ta.addEventListener('input', done, { once: true });
      setTimeout(() => ta.removeEventListener('input', done), 2000);
    });
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
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });

  await page.locator('.rv-tool-btn[title="Captures"]').click();
  await page.locator('.rv-panel[data-panel="capture-viewer"].active').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.locator('.rv-panel[data-panel="capture-viewer"].active .rv-sidebar .rv-new-chat-btn').click();
  await waitFor(() => readGroupCount() === 1, 30_000, 'group never created');
  await waitFor(
    async () => await page.locator('.rv-panel[data-panel="capture-viewer"].active .rv-chat-item[data-thread-group-id][data-selected="true"]').count() === 1,
    30_000,
    'rail never selected the group',
  );

  const composer = page.locator('.rv-panel[data-panel="capture-viewer"].active textarea.rv-chat-input');
  await composer.waitFor({ timeout: 15_000 });
  await composer.click();
  await page.waitForTimeout(300);

  const text = 'the quick brown fox jumps over the lazy dog and then types some more';
  const wallStart = Date.now();
  await installObservers();
  await page.keyboard.type(text, { delay: 25 });
  const wallMs = Date.now() - wallStart;
  const probe = await readProbe();

  const loadAvg = os.loadavg()[0];
  const report = { wallMs, chars: text.length, delayMs: 25, loadAvg1m: loadAvg, ...probe };
  process.stdout.write(`COMPOSER_LATENCY ${JSON.stringify(report)}\n`);
} finally {
  await close().catch(() => {});
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
