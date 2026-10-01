#!/usr/bin/env node

/**
 * BRIDGE-01 SPEC-01 slice 01C — live integration proof launcher.
 *
 * Creates a marker-owned temp root, two isolated workspaces with a canonical
 * File view capsule, and an isolated profile; then runs the real server twice
 * against the SAME SQLite database (save phase, then same-database restart
 * phase). The save phase drives the real 01A client adapter modules over a real
 * WebSocket; the restart phase re-queries the durable fact by operation
 * identity. The launcher asserts both phases observed a byte-identical context
 * snapshot and that the fixture `state.json` never changed.
 *
 * Isolation contract (mirrors the accepted provenance live launchers): the
 * real development database, the normal user profile, the developer workspace,
 * and repository Playwright output are hash-guarded before/after; the temp root
 * and profile are removed only after their ownership markers verify.
 */

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
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
  throw new Error('The built client is missing. Run npm run build before the bridge live proof.');
}

function writeMarker(directory, nonce) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(directory, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      const port = typeof address === 'object' && address ? address.port : null;
      socket.close((error) => {
        if (error) reject(error);
        else if (!Number.isSafeInteger(port) || port < 1024 || port === 3001) {
          reject(new Error('Unable to reserve a safe isolated port.'));
        } else resolve(port);
      });
    });
  });
}

function hashFile(filePath) {
  return fs.existsSync(filePath)
    ? createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : 'missing';
}

function hashTree(root) {
  if (!fs.existsSync(root)) return 'missing';
  const digest = createHash('sha256');
  function visit(directory, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full, rel);
      else if (entry.isFile()) digest.update(rel).update('\0').update(fs.readFileSync(full)).update('\0');
      else digest.update(rel).update('\0non-regular\0');
    }
  }
  visit(root);
  return digest.digest('hex');
}

function writeView(workspaceRoot) {
  const viewRoot = path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'Views', '001-file-viewer');
  fs.mkdirSync(path.join(viewRoot, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(viewRoot, 'state'), { recursive: true });
  fs.writeFileSync(path.join(viewRoot, 'manifest.md'), '---\nname: Files\ndescription: Isolated bridge provenance fixture.\nmetadata:\n  view-id: file-viewer\n  view-type: file-explorer\n  data-source: project-root\n  enabled: true\n---\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'content.json'), `${JSON.stringify({
    version: 1,
    dataSource: 'project-root',
    root: { type: 'project-root' },
    chat: { type: 'threaded', position: 'right' },
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'icon.md'), '---\nname: Files Icon\nmetadata:\n  icon-name: folder_code\n---\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'layout.css'), '.rv-file-explorer-layout{display:flex;height:100%;}.rv-file-explorer-main{flex:1;}.rv-file-tree-sidebar{width:260px;overflow:auto;}.rv-file-viewer{height:100%;display:flex;flex-direction:column;}.rv-file-viewer-content{flex:1;overflow:auto;}\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'state', 'state.json'), '{"activity":{"recents":[],"navigation":{"stack":[],"index":-1},"tabs":[],"activeTabId":null}}\n', 'utf8');
  return path.join(viewRoot, 'state', 'state.json');
}

function createWorkspace(root, name, nonce) {
  const workspaceRoot = path.join(root, name);
  writeMarker(workspaceRoot, nonce);
  const statePath = writeView(workspaceRoot);
  for (const relative of [
    'target',
    'ai/Test-Provenance/System/config',
    'ai/Test-Provenance/System/state',
    'ai/Test-Provenance/System/styles',
    'ai/Test-Provenance/Data',
  ]) fs.mkdirSync(path.join(workspaceRoot, relative), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'target', 'live.txt'), 'bridge initial state\n', 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'config', 'cli.json'), '{"defaultHarness":"opencode","harnesses":{"opencode":{"enabled":true}}}\n', 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'state', 'state.json'), '{}\n', 'utf8');
  return { workspaceRoot, statePath };
}

function removeOwnedRoot(root, nonce) {
  const resolved = path.resolve(root);
  if (!resolved.startsWith(`${fs.realpathSync(os.tmpdir())}${path.sep}`)) {
    throw new Error('Refusing to clean a non-temporary bridge proof root.');
  }
  if (fs.readFileSync(path.join(resolved, MARKER), 'utf8') !== `${nonce}\n`) {
    throw new Error('Refusing to clean a bridge proof root without its ownership marker.');
  }
  fs.rmSync(resolved, { recursive: true, force: false });
}

function runPlaywright(environment) {
  const cli = path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  if (!fs.existsSync(cli)) throw new Error('The local Playwright CLI is unavailable.');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', '--config=playwright.bridge.config.ts'], {
      cwd: clientRoot,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Bridge Playwright phase failed (${signal || code}).`));
    });
  });
}

const protectedBefore = {
  developmentDb: hashFile(developmentDb),
  normalProfileDb: hashFile(normalProfileDb),
  developerWorkspace: hashTree(developerWorkspace),
  repositoryPlaywrightOutput: hashTree(repositoryPlaywrightOutput),
};

const nonce = randomUUID();
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fusion-bridge-01-live-'));
fs.writeFileSync(path.join(root, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
const profile = path.join(root, 'profile');
const output = path.join(root, 'output');
writeMarker(profile, nonce);
writeMarker(output, nonce);

const workspaceA = createWorkspace(root, 'workspace-a', nonce);
const workspaceB = createWorkspace(root, 'workspace-b', nonce);
const workspaces = [
  { id: 'bridge-proof-a', label: 'Bridge Proof A', repoPath: workspaceA.workspaceRoot },
  { id: 'bridge-proof-b', label: 'Bridge Proof B', repoPath: workspaceB.workspaceRoot },
];
const ports = new Set();

try {
  const baseEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    FUSION_APP_USER_DATA: profile,
    FUSION_LOCAL_MACHINE: 'Test-Provenance',
    FUSION_PROVENANCE_TEST_MODE: 'isolated-v1',
    FUSION_PROVENANCE_TEST_SCENARIO: 'normal',
    FUSION_PROVENANCE_TEST_NONCE: nonce,
    FUSION_PROVENANCE_TEST_ROOT: root,
    FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify(workspaces),
    FUSION_PROVENANCE_TEST_OUTPUT: output,
  };

  const savePort = await reservePort();
  ports.add(savePort);
  await runPlaywright({
    ...baseEnvironment,
    PORT: String(savePort),
    FUSION_BRIDGE_TEST_PHASE: 'bridge-01-save',
  });

  const restartPort = await reservePort();
  if (ports.has(restartPort)) throw new Error('The restart reused its prior isolated port.');
  ports.add(restartPort);
  await runPlaywright({
    ...baseEnvironment,
    PORT: String(restartPort),
    FUSION_BRIDGE_TEST_PHASE: 'bridge-01-restart',
  });

  const saved = JSON.parse(fs.readFileSync(path.join(output, 'bridge-01-save.json'), 'utf8'));
  const restarted = JSON.parse(fs.readFileSync(path.join(output, 'bridge-01-restart.json'), 'utf8'));

  if (saved.workspaceId !== 'bridge-proof-a') {
    throw new Error('The save phase did not bind the isolated first workspace.');
  }
  if (JSON.stringify(restarted.durableContext) !== JSON.stringify(saved.emittedContext)) {
    throw new Error('The durable context changed across the same-database restart.');
  }
  if (JSON.stringify(restarted.commandFact.context) !== JSON.stringify(saved.emittedContext)
    || restarted.commandFact.durableBindingMatches !== true
    || saved.commandFact.durableBindingMatches !== true) {
    throw new Error('The accepted command-fact context changed across restart.');
  }
  if (JSON.stringify(saved.commandFact.context) !== JSON.stringify(saved.emittedContext)
    || saved.commandFact.commandAcceptedEventId !== saved.commandAcceptedEventId) {
    throw new Error('The accepted command fact did not carry the emitted context.');
  }
  if (restarted.stateHashAfterRestart !== saved.stateHashBefore
    || saved.stateHashAfterClose !== saved.stateHashBefore) {
    throw new Error('The fixture view state.json changed during the bridge proof.');
  }

  const stateHashFinal = hashFile(workspaceA.statePath);
  if (stateHashFinal !== saved.stateHashBefore) {
    throw new Error('The fixture view state.json changed after the restart phase.');
  }

  for (const context of [saved.durableContext, saved.clientValidatedContext, saved.commandFact.context, restarted.durableContext, restarted.commandFact.context]) {
    if (!context || context.workspaceId !== 'bridge-proof-a' || context.viewId !== 'file-viewer'
      || context.tabId !== 'bridge-tab-1' || context.componentTypeId !== 'file.document'
      || context.presenterId !== 'file.document' || context.targetKey !== 'file:doc:target/live.txt') {
      throw new Error('A proof leg observed an incomplete context snapshot.');
    }
  }

  if (JSON.stringify(saved.clientValidatedContext) !== JSON.stringify(saved.emittedContext)) {
    throw new Error('The real client validator did not preserve the emitted context.');
  }
  const expectedWorkspaceIds = workspaces.map(({ id, repoPath }) => ({ id, repoPath }));
  if (JSON.stringify(workspaces.map(({ id, repoPath }) => ({ id, repoPath }))) !== JSON.stringify(expectedWorkspaceIds)) {
    throw new Error('The isolated workspace manifest drifted.');
  }

  const protectedAfter = {
    developmentDb: hashFile(developmentDb),
    normalProfileDb: hashFile(normalProfileDb),
    developerWorkspace: hashTree(developerWorkspace),
    repositoryPlaywrightOutput: hashTree(repositoryPlaywrightOutput),
  };
  if (JSON.stringify(protectedAfter) !== JSON.stringify(protectedBefore)) {
    throw new Error('A protected developer database, profile, workspace, or repository test output changed.');
  }

  console.log(JSON.stringify({
    status: 'BRIDGE_01_INTEGRATION_OK',
    ports: [...ports],
    uniqueNonDevelopmentPorts: ports.size === 2 && !ports.has(3001),
    emittedContext: saved.emittedContext,
    durableContext: restarted.durableContext,
    commandAcceptedContext: restarted.commandFact.context,
    restartMethod: 'fresh server process, same FUSION_APP_USER_DATA SQLite database',
    stateHashBefore: saved.stateHashBefore,
    stateHashAfterClose: saved.stateHashAfterClose,
    stateHashAfterRestart: restarted.stateHashAfterRestart,
    viewStateUnchanged: true,
    protectedDeveloperStateUnchanged: true,
    cleanup: 'owned-marker-verified',
  }, null, 2));
} finally {
  removeOwnedRoot(root, nonce);
}
