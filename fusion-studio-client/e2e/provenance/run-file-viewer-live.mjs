#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MARKER = '.fusion-provenance-test-owned';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..', '..');
const repositoryRoot = path.resolve(clientRoot, '..');
const expectedCwd = fs.realpathSync(clientRoot);
const normalProfileDb = path.join(os.homedir(), 'Library', 'Application Support', 'Fusion Studio', 'server-data', 'fusion.db');
const developmentDb = path.join(repositoryRoot, 'fusion-studio-server', 'data', 'fusion.db');
const developerWorkspace = path.join(repositoryRoot, 'ai', 'RC-MacAir-15');
const repositoryPlaywrightOutput = path.join(clientRoot, 'test-results');

if (fs.realpathSync(process.cwd()) !== expectedCwd) {
  throw new Error('Run this launcher from fusion-studio-client exactly.');
}
if (!fs.existsSync(path.join(clientRoot, 'dist', 'index.html'))) {
  throw new Error('The built client is missing. Run npm run build before the live proof.');
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      const port = typeof address === 'object' && address ? address.port : null;
      socket.close((error) => {
        if (error) reject(error);
        else if (!Number.isSafeInteger(port) || port === 3001) reject(new Error('Unable to reserve an isolated port.'));
        else resolve(port);
      });
    });
  });
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return 'missing';
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function hashTree(root) {
  if (!fs.existsSync(root)) return 'missing';
  const digest = createHash('sha256');
  function visit(directory, relative = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full, rel);
      else if (entry.isFile()) {
        digest.update(rel).update('\0').update(fs.readFileSync(full)).update('\0');
      } else {
        digest.update(rel).update('\0non-regular\0');
      }
    }
  }
  visit(root);
  return digest.digest('hex');
}

function writeOwnedMarker(directory, nonce) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
}

function writeView(workspaceRoot, folder, { id, name, type, dataSource, root }) {
  const viewRoot = path.join(workspaceRoot, 'ai', 'Test-Provenance', 'Views', folder);
  fs.mkdirSync(path.join(viewRoot, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(viewRoot, 'state'), { recursive: true });
  fs.writeFileSync(path.join(viewRoot, 'manifest.md'), `---\nname: ${name}\ndescription: Isolated provenance fixture.\nmetadata:\n  view-id: ${id}\n  view-type: ${type}\n  data-source: ${dataSource}\n  enabled: true\n---\n`, 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'content.json'), `${JSON.stringify({
    version: 1,
    dataSource,
    root,
    chat: { type: 'threaded', position: 'right' },
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'icon.md'), `---\nname: ${name} Icon\nmetadata:\n  icon-name: folder_code\n---\n`, 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'layout.css'), '.rv-file-explorer-layout{display:flex;height:100%;}.rv-file-explorer-main{flex:1;}.rv-file-tree-sidebar{width:260px;overflow:auto;}.rv-file-viewer{height:100%;display:flex;flex-direction:column;}.rv-file-viewer-content{flex:1;overflow:auto;}\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'state', 'state.json'), '{"activity":{"recents":[],"navigation":{"stack":[],"index":-1},"tabs":[],"activeTabId":null}}\n', 'utf8');
}

function createWorkspace(root, name, nonce, initialText) {
  const workspaceRoot = path.join(root, name);
  writeOwnedMarker(workspaceRoot, nonce);
  writeView(workspaceRoot, '001-file-viewer', {
    id: 'file-viewer', name: 'Files', type: 'file-explorer', dataSource: 'project-root', root: { type: 'project-root' },
  });
  writeView(workspaceRoot, '002-office-viewer', {
    id: 'office-viewer', name: 'Office', type: 'office', dataSource: 'Office', root: { type: 'machine-relative', path: 'Office' },
  });
  for (const relative of [
    'target',
    'other',
    'ai/Test-Provenance/Office',
    'ai/Test-Provenance/System/config',
    'ai/Test-Provenance/System/state',
    'ai/Test-Provenance/System/styles',
    'ai/Test-Provenance/Data',
  ]) {
    fs.mkdirSync(path.join(workspaceRoot, relative), { recursive: true });
  }
  fs.writeFileSync(path.join(workspaceRoot, 'target', 'live.txt'), initialText, 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'other', 'untouched.txt'), `untouched ${name}\n`, 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'Office', 'shared.md'), `shared ${name}\n`, 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'config', 'cli.json'), '{"defaultHarness":"opencode","harnesses":{"opencode":{"enabled":true}}}\n', 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'state', 'state.json'), '{}\n', 'utf8');
  return workspaceRoot;
}

function removeOwnedRoot(root, nonce) {
  const marker = path.join(root, MARKER);
  if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== `${nonce}\n`) {
    throw new Error(`Refusing to clean unowned provenance directory: ${root}`);
  }
  fs.rmSync(root, { recursive: true, force: false });
}

async function runPlaywright(environment) {
  const cli = path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  if (!fs.existsSync(cli)) throw new Error('The local Playwright CLI is unavailable.');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', '--config=playwright.provenance.config.ts'], {
      cwd: clientRoot,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright provenance scenario failed (${signal || code}).`));
    });
  });
}

async function runScenario(scenario, usedPorts) {
  const nonce = randomUUID();
  const tempBase = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempBase, 'fusion-provenance-live-'));
  fs.writeFileSync(path.join(root, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
  const appData = path.join(root, 'app-data');
  writeOwnedMarker(appData, nonce);
  const workspaceA = createWorkspace(root, 'workspace-a', nonce, 'version one Ω\n');
  const workspaceB = createWorkspace(root, 'workspace-b', nonce, 'workspace B\n');
  const port = await reservePort();
  if (usedPorts.has(port)) throw new Error('The isolated port was reused.');
  usedPorts.add(port);
  const workspaces = [
    { id: 'provenance-a', label: 'Provenance A', repoPath: workspaceA },
    { id: 'provenance-b', label: 'Provenance B', repoPath: workspaceB },
  ];
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    FUSION_APP_USER_DATA: appData,
    FUSION_LOCAL_MACHINE: 'Test-Provenance',
    FUSION_PROVENANCE_TEST_MODE: 'isolated-v1',
    FUSION_PROVENANCE_TEST_NONCE: nonce,
    FUSION_PROVENANCE_TEST_ROOT: root,
    FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify(workspaces),
    FUSION_PROVENANCE_TEST_SCENARIO: scenario,
  };
  try {
    await runPlaywright(environment);
    const auditPath = path.join(appData, 'isolated-provenance-audit.json');
    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    const observedAttempts = audit.observationGuards?.attempts;
    const unsafeStartupEffect = !Array.isArray(audit.startupEffects) || audit.startupEffects.some((effect) => (
      effect.startRequests !== 1
      || effect.blockedRequests !== 1
      || effect.prohibitedAttempts !== 0
      || effect.factoryInvocations !== 0
    ));
    const harnessRuntimeEffect = Array.isArray(audit.runtimeEffects)
      ? audit.runtimeEffects.find((effect) => effect.name === 'harness-http-revalidation')
      : null;
    const unsafeRuntimeEffect = !harnessRuntimeEffect
      || harnessRuntimeEffect.startRequests < 1
      || harnessRuntimeEffect.blockedRequests !== harnessRuntimeEffect.startRequests
      || harnessRuntimeEffect.prohibitedAttempts !== 0
      || harnessRuntimeEffect.factoryInvocations !== 0;
    if (audit.port !== port
      || audit.dbExists !== true
      || audit.observationGuards?.installed !== true
      || observedAttempts?.childProcess !== 0
      || observedAttempts?.filesystemWatch !== 0
      || unsafeStartupEffect
      || unsafeRuntimeEffect) {
      throw new Error('The isolated server startup audit is incomplete.');
    }
    if (JSON.stringify(audit.registeredWorkspaces) !== JSON.stringify(workspaces.map(({ id, repoPath }) => ({ id, repoPath })))) {
      throw new Error('The isolated workspace registry contains unexpected entries.');
    }
    return { scenario, port, audit };
  } finally {
    removeOwnedRoot(root, nonce);
  }
}

const protectedBefore = {
  developmentDb: hashFile(developmentDb),
  normalProfileDb: hashFile(normalProfileDb),
  developerWorkspace: hashTree(developerWorkspace),
  repositoryPlaywrightOutput: hashTree(repositoryPlaywrightOutput),
};
const usedPorts = new Set();
const results = [];
for (const scenario of ['normal', 'fact-publish-failure']) {
  results.push(await runScenario(scenario, usedPorts));
}
const protectedAfter = {
  developmentDb: hashFile(developmentDb),
  normalProfileDb: hashFile(normalProfileDb),
  developerWorkspace: hashTree(developerWorkspace),
  repositoryPlaywrightOutput: hashTree(repositoryPlaywrightOutput),
};
if (JSON.stringify(protectedAfter) !== JSON.stringify(protectedBefore)) {
  throw new Error('A protected developer database, profile, workspace, or repository test output changed during the live proof.');
}

console.log(JSON.stringify({
  status: 'FILE_VIEWER_LIVE_PROVENANCE_OK',
  scenarios: results.map(({ scenario, port }) => ({ scenario, port })),
  uniqueNonDevelopmentPorts: usedPorts.size === results.length && !usedPorts.has(3001),
  protectedDeveloperStateUnchanged: true,
  cleanup: 'owned-marker-verified',
}, null, 2));
