#!/usr/bin/env node

import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const MARKER = '.fusion-provenance-test-owned';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..', '..');
const expectedCwd = fs.realpathSync(clientRoot);
const appRoot = path.join(clientRoot, 'release', 'mac-arm64', 'Fusion Studio.app');
const resourcesPath = path.join(appRoot, 'Contents', 'Resources');
const packagedServer = path.join(resourcesPath, 'fusion-studio-server', 'server.js');
const packagedAddon = path.join(
  resourcesPath,
  'fusion-studio-server',
  'native',
  'secure-file-observer',
  'build',
  'Release',
  'secure_file_observer.node',
);

if (fs.realpathSync(process.cwd()) !== expectedCwd) {
  throw new Error('Run this launcher from fusion-studio-client exactly.');
}
if (!fs.existsSync(packagedServer) || !fs.existsSync(packagedAddon)) {
  throw new Error('Packaged server/native observer is missing. Run npm run electron:pack first.');
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

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    if (child.exitCode != null) {
      if (child.exitCode === 0) resolve();
      else reject(new Error(`Packaged observer child exited ${child.exitCode}.`));
      return;
    }
    child.once('exit', (code, signal) => {
      if (code === 0 && signal == null) resolve();
      else reject(new Error(`Packaged observer child exited code=${code} signal=${signal}.`));
    });
    child.once('error', reject);
  });
}

function removeOwnedRoot(testRoot, nonce) {
  const resolved = path.resolve(testRoot);
  const prefix = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error('Refusing to clean a non-temporary smoke root.');
  const marker = fs.readFileSync(path.join(resolved, MARKER), 'utf8');
  if (marker !== `${nonce}\n`) throw new Error('Refusing to clean a root without its ownership marker.');
  fs.rmSync(resolved, { recursive: true, force: false });
}

const nonce = randomUUID();
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-packaged-observer-'));
fs.writeFileSync(path.join(testRoot, MARKER), `${nonce}\n`, { encoding: 'utf8', flag: 'wx' });
const profile = path.join(testRoot, 'profile');
const output = path.join(testRoot, 'output');
const workspaceA = path.join(testRoot, 'workspace-a');
const workspaceB = path.join(testRoot, 'workspace-b');
for (const owned of [profile, output, workspaceA, workspaceB]) writeMarker(owned, nonce);

try {
  const port = await reservePort();
  const workspaces = [
    { id: 'packaged-observer-a', label: 'Packaged Observer A', repoPath: workspaceA },
    { id: 'packaged-observer-b', label: 'Packaged Observer B', repoPath: workspaceB },
  ];
  const { spawnServer } = require('../../electron/server-spawn.cjs');
  const result = await spawnServer({
    resourcesPath,
    userDataPath: profile,
    port,
    nativeObserverHealthOnly: true,
    environment: {
      ...process.env,
      NODE_ENV: 'test',
      FUSION_LOCAL_MACHINE: 'Test-Provenance',
      FUSION_PROVENANCE_TEST_MODE: 'isolated-v1',
      FUSION_PROVENANCE_TEST_NONCE: nonce,
      FUSION_PROVENANCE_TEST_ROOT: testRoot,
      FUSION_PROVENANCE_TEST_WORKSPACES: JSON.stringify(workspaces),
      FUSION_PROVENANCE_TEST_OUTPUT: output,
      FUSION_SECURE_OBSERVER_SMOKE: 'descriptor-swap-v1',
      FUSION_SECURE_OBSERVER_SMOKE_HOOKS: '1',
    },
  });
  await waitForExit(result.process);
  if (result.nativeObserver?.platform !== 'darwin'
    || result.nativeObserver.arch !== process.arch
    || result.nativeObserver.moduleAbi !== Number(process.versions.modules)
    || result.nativeObserver.fixture !== 'descriptor-swap-v1') {
    throw new Error('Packaged child loaded an incompatible native observer.');
  }
  process.stdout.write(`PACKAGED_NATIVE_OBSERVER_OK:${result.nativeObserver.arch}:${result.nativeObserver.moduleAbi}\n`);
} finally {
  removeOwnedRoot(testRoot, nonce);
}
