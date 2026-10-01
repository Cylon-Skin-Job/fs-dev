// Test-owned server for the browser architecture lane. The production server
// is real; its profile and only registered workspace are disposable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.argv[2]);
assert.ok(Number.isInteger(port) && port > 1023 && port < 65536 && port !== 3001);
const clientRoot = path.resolve(import.meta.dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat-transport-profile-'));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chat-transport-workspace-'));
const projectPath = path.join(fs.realpathSync(fixtureRoot), 'fixture');
const require = createRequire(import.meta.url);
let child;

function cleanup() {
  try { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
  finally { fs.rmSync(profile, { recursive: true, force: true }); }
}

try {
  process.env.FUSION_APP_USER_DATA = profile;
  const { initDb, getDb, closeDb } = require('../../fusion-studio-server/lib/db.js');
  await initDb();
  const db = getDb();
  await db('workspaces').where({ id: 'fs-dev' }).del();
  await db('system_config').where({ key: 'last_active_workspace_id' }).del();
  const readiness = require('../../fusion-studio-server/lib/views/readiness-runtime.js');
  const { createViewReadinessCoordinator } = require('../../fusion-studio-server/lib/views/readiness-coordinator.js');
  const { createViewRelocationService } = require('../../fusion-studio-server/lib/views/relocation-service.js');
  readiness.installViewReadinessOwner(createViewReadinessCoordinator({
    migrationService: createViewRelocationService({ db }),
    machineIdentity: 'RC-MacAir-15',
  }));
  require('../../fusion-studio-server/lib/workspace/create-service.js').scaffoldProject({
    projectPath, machineName: 'RC-MacAir-15',
  });
  const root = fs.realpathSync(projectPath);
  await db('workspaces').insert({
    id: 'boot-fixture', label: 'Chat Transport Fixture', icon: 'folder',
    repo_path: process.platform === 'darwin' ? root.toLowerCase() : root,
    sort_order: 0, type: 'code', ribbon_visible: 1, ribbon_sort_order: 0,
  });
  await db('system_config').insert({
    key: 'last_active_workspace_id', value: 'boot-fixture', updated_at: Date.now(),
  });
  assert.deepEqual((await db('workspaces').select('id')).map((row) => row.id), ['boot-fixture']);
  await closeDb();
  child = spawn(process.execPath, [path.resolve(clientRoot, '../fusion-studio-server/server.js')], {
    cwd: clientRoot,
    env: { ...process.env, PORT: String(port), FUSION_LOCAL_MACHINE: 'RC-MacAir-15' },
    stdio: 'inherit',
  });
  const stop = () => child?.kill('SIGTERM');
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  cleanup();
}
