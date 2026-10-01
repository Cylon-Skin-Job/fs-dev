import {earlyLifecycleOptions,markEarly,withEarlyLaunchCleanup} from './early-lifecycle-driver.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from '@playwright/test';
import { assertDisposablePath, assertSafePort, isPidRunning } from './fixture-lifecycle.mjs';
import { stageFixture } from './stage-fixture.mjs';

const require = createRequire(import.meta.url);
const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');

export function descendants(pid) {
  const output = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }).stdout.trim();
  if (!output) return [];
  return output.split(/\s+/).map(Number).flatMap((child) => [child, ...descendants(child)]);
}

export function withDb(dbPath, options, fn) {
  const db = new Database(dbPath, options);
  try { return fn(db); } finally { db.close(); }
}

export async function waitFor(page, predicate, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

export async function clickWorkspaceMenu(app, label) {
  await app.evaluate(({ Menu }, target) => {
    const workspaces = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    const item = workspaces?.submenu?.items.find((candidate) => candidate.label === target);
    if (!item) throw new Error(`workspace menu item unavailable: ${target}`);
    item.click(item);
  }, label);
}

export async function createProject(app, page, projectPath, label) {
  await clickWorkspaceMenu(app, 'Create New Project...');
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(projectPath);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill(label);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForFunction(
    (name) => document.querySelector('.rv-workspace-name')?.textContent?.includes(name), label, { timeout: 30_000 },
  );
  await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
}

export async function selectPanel(page, panelId, title) {
  const panel = page.locator(`.rv-panel[data-panel="${panelId}"].active`);
  if (await panel.count() === 0) {
    const requested = page.locator(`.rv-tool-btn[title="${title}"]`);
    // `Connected` can precede the asynchronous workspace capsule projection.
    // Snapshotting the rail once and cycling its then-current buttons misses a
    // later-arriving view and leaves whichever fallback button was last active.
    try {
      await requested.waitFor({ state: 'visible', timeout: 15_000 });
    } catch (error) {
      const projection = await page.evaluate(() => ({
        workspaceLabel: document.querySelector('.rv-workspace-name')?.textContent || null,
        connected: document.body?.innerText.includes('Connected') || false,
        railTitles: [...document.querySelectorAll('.rv-tool-btn')].map((button) => button.getAttribute('title')),
      })).catch(() => null);
      throw new Error(`fixture view ${panelId} was not projected to renderer rail: ${JSON.stringify(projection)}`, { cause: error });
    }
    await requested.click();
  }
  await panel.waitFor({ state: 'visible', timeout: 15_000 });
  return panel;
}

export async function createChat(page, dbPath, panelId = 'capture-viewer', title = 'Captures') {
  const before = withDb(dbPath, { readonly: true, fileMustExist: true }, (db) => db.prepare('SELECT COUNT(*) AS n FROM thread_groups').get().n);
  const panel = await selectPanel(page, panelId, title);
  const create = panel.locator('.rv-sidebar .rv-new-chat-btn');
  if (!(await create.isVisible())) {
    const pinThreads = panel.getByRole('button', { name: 'Pin threads open' }).first();
    if (await pinThreads.count() && await pinThreads.isVisible()) await pinThreads.click();
    else {
      const showThreads = panel.getByRole('button', { name: 'Show threads' }).first();
      if (await showThreads.count()) await showThreads.evaluate((button) => button.click());
    }
  }
  await create.click();
  await waitFor(page, () => withDb(dbPath, { readonly: true, fileMustExist: true },
    (db) => db.prepare('SELECT COUNT(*) AS n FROM thread_groups').get().n > before), 'public New Chat');
  return panel;
}

export async function stageAndLaunch({ repoRoot, tempRoot, token, casePrefix, evidenceRoot, faultSchedule = {}, eventScript = null, initScript = null, preReceiptUpgrade = false, realServer = false, openCodePath = null }) {
  const stageRoot = path.join(tempRoot, `${casePrefix}-stage`);
  const profileRoot = path.join(tempRoot, `${casePrefix}-profile`);
  const workspaceRoot = path.join(tempRoot, `${casePrefix}-workspace`);
  const staged = await stageFixture({ repoRoot, stageRoot, profileRoot, workspaceRoot, token, preReceiptUpgrade, realServer });
  const adapterLog = path.join(evidenceRoot, `${casePrefix}-adapter.ndjson`);
  let launchNumber=0,earlyLifecycleConfig=null;
  const launch = async ({earlyLifecycle=false}={}) => {
    const entry=path.join(staged.stagedClient,'electron','main.cjs');
    const early=earlyLifecycleOptions({launchNumber:++launchNumber,enabled:earlyLifecycle,entry,cwd:staged.stagedClient,stageRoot,token,evidenceRoot});
    if(early)earlyLifecycleConfig=early.config;
    const app = await electron.launch({
      cwd: staged.stagedClient,
      args: early?.args??[entry, `--chat-architecture-token=${token}`],
      env: {
        ...process.env,
        ...(early?.env??{}),
        FUSION_APP_USER_DATA: profileRoot,
        FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
        ...(openCodePath ? { OPENCODE_PATH: openCodePath } : {}),
        FUSION_CHAT_ARCH_ADAPTER_LOG: adapterLog,
        FUSION_CHAT_ARCH_FAULT_SCHEDULE: JSON.stringify(faultSchedule),
        ...(eventScript ? { FUSION_CHAT_ARCH_EVENT_SCRIPT: JSON.stringify(eventScript) } : {}),
      },
    });
    const complete=async()=>{
    const pid = app.process().pid;
    if(early)markEarly(early.config,'electron-launch-return',{ownedPid:pid});
    if (initScript) await app.context().addInitScript(initScript);
    const page = await app.firstWindow();
    if(early)markEarly(early.config,'firstWindow-return',{ownedPid:pid});
    await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
    const launchErrors = [];
    if(!early){
    page.on('pageerror', error => { if (launchErrors.length < 100) launchErrors.push(error.message); });
    page.on('console', message => { if (message.type() === 'error' && launchErrors.length < 100) launchErrors.push(message.text()); });
    }
    try {
    await page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
    if(early)markEarly(early.config,'renderer-Connected',{ownedPid:pid});
    } catch (error) {
      if(early)throw error;
      if(!early){
      await page.screenshot({ path: path.join(evidenceRoot, `${casePrefix}-launch-failure.png`) }).catch(() => {});
      fs.writeFileSync(path.join(evidenceRoot, `${casePrefix}-launch-failure.json`), JSON.stringify({
        message: error.message, body: await page.locator('body').innerText().catch(() => ''),
        launchErrors, html: await page.locator('body').innerHTML().catch(() => ''),
        errors: await page.evaluate(() => window.__chatArchErrors || []).catch(() => []),
      }, null, 2));
      }
      await app.close().catch(() => {});
      throw error;
    }
    const port = Number(fs.readFileSync(path.join(profileRoot, 'server.port'), 'utf8'));
    assertSafePort(port);
    assert.notEqual(port, 0);
    return { app, page, pid, port, ...(early?{earlyLifecycle:early.config}:{}) };
    };
    return early?withEarlyLaunchCleanup(early.config,complete,()=>closeOwnedApp({app,pid:app.process().pid})):complete();
  };
  return { ...staged, stageRoot, profileRoot, workspaceRoot, adapterLog, launch, evidenceRoot, casePrefix, get earlyLifecycleConfig(){return earlyLifecycleConfig;} };
}

export async function closeOwnedApp(runtime) {
  if (!runtime?.app) return [];
  const tree = [runtime.pid, ...descendants(runtime.pid)];
  await runtime.app.close().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 300));
  return tree.filter(isPidRunning);
}

export function cleanupFixture(fixture, token) {
  const log = path.join(fixture.profileRoot, 'server-live.log');
  if (fixture.evidenceRoot && fs.existsSync(log)) {
    const bytes = fs.readFileSync(log);
    fs.writeFileSync(path.join(fixture.evidenceRoot, `${fixture.casePrefix}-server-live.log`), bytes.subarray(-2 * 1024 * 1024));
  }
  const dbQuickCheck = fs.existsSync(fixture.dbPath)
    ? withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => db.pragma('quick_check', { simple: true }))
    : null;
  for (const root of [fixture.stageRoot, fixture.profileRoot, fixture.workspaceRoot]) {
    if (!fs.existsSync(root)) continue;
    assertDisposablePath(root, token);
    fs.rmSync(root, { recursive: true, force: true });
  }
  return {
    dbQuickCheck,
    portFileRemoved: !fs.existsSync(path.join(fixture.profileRoot, 'server.port')),
    fixtureRootsRemoved: [fixture.stageRoot, fixture.profileRoot, fixture.workspaceRoot].every((root) => !fs.existsSync(root)),
  };
}
