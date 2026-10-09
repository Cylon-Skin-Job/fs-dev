#!/usr/bin/env node

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
  throw new Error('The built client is missing. Run npm run build before the agent live proof.');
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
  fs.writeFileSync(path.join(viewRoot, 'manifest.md'), '---\nname: Files\ndescription: Isolated agent provenance fixture.\nmetadata:\n  view-id: file-viewer\n  view-type: file-explorer\n  data-source: project-root\n  enabled: true\n---\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'content.json'), `${JSON.stringify({
    version: 1,
    dataSource: 'project-root',
    root: { type: 'project-root' },
    chat: { type: 'threaded', position: 'right' },
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'icon.md'), '---\nname: Files Icon\nmetadata:\n  icon-name: folder_code\n---\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'layout.css'), '.rv-file-explorer-layout{display:flex;height:100%;}.rv-file-explorer-main{flex:1;}.rv-file-tree-sidebar{width:260px;overflow:auto;}.rv-file-viewer{height:100%;display:flex;flex-direction:column;}.rv-file-viewer-content{flex:1;overflow:auto;}\n', 'utf8');
  fs.writeFileSync(path.join(viewRoot, 'state', 'state.json'), '{"activity":{"recents":[],"navigation":{"stack":[],"index":-1},"tabs":[],"activeTabId":null}}\n', 'utf8');
}

function createWorkspace(root, name, nonce) {
  const workspaceRoot = path.join(root, name);
  writeMarker(workspaceRoot, nonce);
  writeView(workspaceRoot);
  for (const relative of [
    'target',
    'ai/Test-Provenance/System/config',
    'ai/Test-Provenance/System/state',
    'ai/Test-Provenance/System/styles',
    'ai/Test-Provenance/Data',
  ]) fs.mkdirSync(path.join(workspaceRoot, relative), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, 'target', 'live.txt'), 'initial live state\n', 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'config', 'cli.json'), '{"defaultHarness":"opencode","harnesses":{"opencode":{"enabled":true}}}\n', 'utf8');
  fs.writeFileSync(path.join(workspaceRoot, 'ai', 'Test-Provenance', 'System', 'state', 'state.json'), '{}\n', 'utf8');
  return workspaceRoot;
}

function runPlaywright(environment) {
  const cli = path.join(clientRoot, 'node_modules', '@playwright', 'test', 'cli.js');
  if (!fs.existsSync(cli)) throw new Error('The local Playwright CLI is unavailable.');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'test', '--config=playwright.agent-tool.config.ts'], {
      cwd: clientRoot,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Agent-tool Playwright scenario failed (${signal || code}).`));
    });
  });
}

function readAudit(profile) {
  return JSON.parse(fs.readFileSync(path.join(profile, 'isolated-provenance-audit.json'), 'utf8'));
}

function assertAudit(audit, expectedPort, scenario, workspaces) {
  if (audit.port !== expectedPort || audit.scenario !== scenario || audit.dbExists !== true
    || audit.observationGuards?.installed !== true
    || audit.observationGuards?.attempts?.childProcess !== 0
    || audit.observationGuards?.attempts?.filesystemWatch !== 0) {
    throw new Error('The isolated agent-tool startup audit is incomplete.');
  }
  if (JSON.stringify(audit.registeredWorkspaces) !== JSON.stringify(
    workspaces.map(({ id, repoPath }) => ({ id, repoPath })),
  )) throw new Error('The isolated agent-tool workspace registry is unexpected.');
  if (!Array.isArray(audit.registryAuthority?.schemas)
    || !audit.registryAuthority.schemas.some((row) => row.schema_key === 'agent.tool_completed' && row.schema_version === 1)
    || !audit.registryAuthority.schemas.some((row) => row.schema_key === 'resource.state_observed' && row.schema_version === 1)
    || !audit.registryAuthority.schemas.some((row) => row.schema_key === 'resource:changed' && row.schema_version === 2)
    || !audit.registryAuthority.schemas.some((row) => row.schema_key === 'agent:activity' && row.schema_version === 1)
    || !audit.registryAuthority.subscriptions.some((row) => row.handler_key === 'system.agent-provenance-ledger')
    || !audit.registryAuthority.subscriptions.some((row) => row.handler_key === 'system.agent-resource-observer')) {
    throw new Error('The required Slice 01c-01e locked authority is absent.');
  }
}

function removeOwnedRoot(root, nonce) {
  const resolved = path.resolve(root);
  if (!resolved.startsWith(`${fs.realpathSync(os.tmpdir())}${path.sep}`)) {
    throw new Error('Refusing to clean a non-temporary agent proof root.');
  }
  if (fs.readFileSync(path.join(resolved, MARKER), 'utf8') !== `${nonce}\n`) {
    throw new Error('Refusing to clean an agent proof root without its ownership marker.');
  }
  fs.rmSync(resolved, { recursive: true, force: false });
}

const protectedBefore = {
  developmentDb: hashFile(developmentDb),
  normalProfileDb: hashFile(normalProfileDb),
  developerWorkspace: hashTree(developerWorkspace),
  repositoryPlaywrightOutput: hashTree(repositoryPlaywrightOutput),
};
const nonce = randomUUID();
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fusion-agent-tool-live-'));
fs.writeFileSync(path.join(root, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
const profile = path.join(root, 'profile');
const output = path.join(root, 'output');
writeMarker(profile, nonce);
writeMarker(output, nonce);
const workspaceA = createWorkspace(root, 'workspace-a', nonce);
const workspaceB = createWorkspace(root, 'workspace-b', nonce);
const workspaces = [
  { id: 'agent-proof-a', label: 'Agent Proof A', repoPath: workspaceA },
  { id: 'agent-proof-b', label: 'Agent Proof B', repoPath: workspaceB },
];
const ports = new Set();

try {
  const baseEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    FUSION_APP_USER_DATA: profile,
    FUSION_LOCAL_MACHINE: 'Test-Provenance',
    FUSION_PROVENANCE_TEST_MODE: 'isolated-v1',
    FUSION_PROVENANCE_TEST_NONCE: nonce,
    FUSION_PROVENANCE_TEST_ROOT: root,
    FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify(workspaces),
    FUSION_PROVENANCE_TEST_OUTPUT: output,
  };
  const firstPort = await reservePort();
  ports.add(firstPort);
  await runPlaywright({
    ...baseEnvironment,
    PORT: String(firstPort),
    FUSION_PROVENANCE_TEST_SCENARIO: 'agent-tool-live',
  });
  const firstAudit = readAudit(profile);
  assertAudit(firstAudit, firstPort, 'agent-tool-live', workspaces);

  const secondPort = await reservePort();
  if (ports.has(secondPort)) throw new Error('The restart reused its prior isolated port.');
  ports.add(secondPort);
  await runPlaywright({
    ...baseEnvironment,
    PORT: String(secondPort),
    FUSION_PROVENANCE_TEST_SCENARIO: 'agent-tool-restart',
  });
  const secondAudit = readAudit(profile);
  assertAudit(secondAudit, secondPort, 'agent-tool-restart', workspaces);
  if (JSON.stringify(secondAudit.registryAuthority) !== JSON.stringify(firstAudit.registryAuthority)) {
    throw new Error('Locked schema/subscription/grant authority drifted across same-database restart.');
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
    status: 'AGENT_TOOL_LIVE_PROVENANCE_OK',
    ports: [...ports],
    uniqueNonDevelopmentPorts: ports.size === 2 && !ports.has(3001),
    sameDatabaseRestartAuthorityStable: true,
    deterministicAdapter: 'OpenCodeJsonEventTranslator fixture',
    watchersAndExternalHarnesses: 'disabled-and-audited',
    protectedDeveloperStateUnchanged: true,
    cleanup: 'owned-marker-verified',
  }, null, 2));
} finally {
  removeOwnedRoot(root, nonce);
}
