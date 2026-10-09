// Create one disposable workspace through the existing public Electron shell.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { candidate, profile, machine } = config;
const workspace = path.join(candidate, 'rehearsal-workspace');
const client = path.join(candidate, 'fusion-studio-client');
const require = createRequire(path.join(client, 'package.json'));
const { _electron: electron } = require('@playwright/test');
const Database = require(path.join(candidate, 'fusion-studio-server/node_modules/better-sqlite3'));
assert(candidate.startsWith('/private/tmp/mc-s6-'));
assert(profile.startsWith('/private/tmp/mc-s6-'));
assert(!fs.existsSync(workspace), 'one-time bootstrap refuses an existing workspace');
assert(!fs.existsSync(path.join(profile, 'server-data/fusion.db')), 'never replace an existing profile database');
fs.mkdirSync(profile, { recursive: true });

// Existing public-shell smoke bootstrap: apply the candidate migrations in a
// brand-new profile, remove migration 009's automatic dev seed before launch.
process.env.FUSION_APP_USER_DATA = profile;
const { initDb, getDb, closeDb } = require(path.join(candidate, 'fusion-studio-server/lib/db.js'));
await initDb();
await require(path.join(candidate, 'fusion-studio-server/lib/workspace/ai-paths.js'))
  .setLocalMachineName(machine, { db: getDb() });
await closeDb();
delete process.env.FUSION_APP_USER_DATA;
const database = path.join(profile, 'server-data/fusion.db');
const db = new Database(database);
try {
  db.prepare("DELETE FROM workspaces WHERE id = 'fs-dev'").run();
  db.prepare("DELETE FROM system_config WHERE key = 'last_active_workspace_id'").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n, 0);
} finally { db.close(); }

const temporary = path.join(profile, 'bootstrap-tmp');
fs.mkdirSync(temporary);
let app;
const evidence = { kind: 'PREPARATION_PUBLIC_BOOTSTRAP_ONLY', candidate, profile, machine, workspace, database };
try {
  app = await electron.launch({
    executablePath: path.join(client, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
    cwd: client, args: [path.join(client, 'electron/main.cjs')],
    env: { ...process.env, FUSION_APP_USER_DATA: profile, FUSION_LOCAL_MACHINE: machine, TMPDIR: `${temporary}/` },
  });
  const page = await app.firstWindow();
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.locator('.rv-connection-status.connected').waitFor({ timeout: 30_000 });
  await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu().items.find((item) => item.label === 'Workspaces');
    menu.submenu.items.find((item) => item.label === 'Create New Project...').click();
  });
  await page.locator('input[placeholder="/Users/name/projects/my-project"]').fill(workspace);
  await page.locator('input[placeholder="Derived from folder name if blank"]').fill('S6 Checklist');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.rv-workspace-name')?.textContent?.includes('S6 Checklist'));
  await page.locator('nav.rv-tools-panel').evaluate((element) => element.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: 8, clientY: 8,
  })));
  await page.locator('.rv-view-rail-menu button').filter({ hasText: 'Add Custom' }).click();
  await page.locator('button.rv-tool-btn[title="Custom"]').waitFor();
  await page.locator('button.rv-tool-btn[title="Custom"]').click({ button: 'right' });
  await page.locator('.rv-view-context-menu button').filter({ hasText: 'Rename' }).click();
  await page.locator('#rv-view-rename-input').fill('Checklist');
  await page.locator('.rv-view-context-save').click();
  await page.locator('button.rv-tool-btn[title="Checklist"]').waitFor();
  evidence.tools = await page.locator('button.rv-tool-btn').evaluateAll((nodes) => nodes.map((node) => node.title));
  evidence.runtime = await page.evaluate(() => window.electronAPI.getRuntimeDescriptor());
  const read = new Database(database, { readonly: true });
  try {
    evidence.workspaces = read.prepare('SELECT id, label, repo_path FROM workspaces').all();
    assert.equal(evidence.workspaces.length, 1);
    assert.equal(evidence.workspaces[0].repo_path, workspace.toLowerCase());
    assert(!evidence.workspaces.some((row) => row.repo_path === '/users/rccurtrightjr./projects/fs-dev'));
  } finally { read.close(); }
  fs.writeFileSync(config.bootstrapEvidence, `${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  if (app) await app.close();
}
