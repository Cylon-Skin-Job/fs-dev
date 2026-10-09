import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertDisposablePath } from './fixture-lifecycle.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, '../../..');
const evidenceBase = path.join(repoRoot, 'ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-01/01C');
const launcher = path.join(directory, 'owned-regression-launcher.mjs');

function tokenPids(token) {
  return spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' }).stdout
    .split('\n').flatMap((line) => {
      const match = line.trim().match(/^(\d+)\s+(.*)$/);
      return match && match[2].includes(token) ? [Number(match[1])] : [];
    });
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function findOwnedManifest(ownerPid, kind) {
  for (const name of fs.readdirSync(evidenceBase)) {
    if (!name.startsWith(`${kind}-`)) continue;
    const file = path.join(evidenceBase, name, 'launcher-manifest.json');
    if (!fs.existsSync(file)) continue;
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (manifest.ownerPid === ownerPid) return { ...manifest, evidenceRoot: path.dirname(file) };
  }
  return null;
}

test('owned boot regression supervisor removes its detached server and root after parent SIGKILL', { timeout: 45_000 }, async () => {
  const child = spawn(process.execPath, [launcher, 'boot', '--working-return'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  child.stderr.resume();
  let manifest = null;
  try {
    manifest = await waitFor(() => findOwnedManifest(child.pid, 'boot'), 10_000, 'boot launcher manifest');
    assertDisposablePath(manifest.tempRoot, manifest.token);
    await waitFor(() => {
      const log = path.join(manifest.evidenceRoot, 'server.log');
      return fs.existsSync(log) && /SERVER_READY:\d+/.test(fs.readFileSync(log, 'utf8'));
    }, 20_000, 'staged server ready');
    assert.ok(tokenPids(manifest.token).length >= 2, 'supervisor and worker/server are running');
    process.kill(child.pid, 'SIGKILL');
    await waitFor(() => !fs.existsSync(manifest.tempRoot), 12_000, 'supervisor-owned root removal');
    await waitFor(() => tokenPids(manifest.token).length === 0, 12_000, 'owned process teardown');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(child.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    if (manifest) {
      for (const pid of tokenPids(manifest.token)) {
        try { process.kill(pid, 'SIGKILL'); } catch (error) {
          if (error?.code !== 'ESRCH') throw error;
        }
      }
      if (fs.existsSync(manifest.tempRoot)) {
        assertDisposablePath(manifest.tempRoot, manifest.token);
        fs.rmSync(manifest.tempRoot, { recursive: true, force: true });
      }
    }
  }
});

test('owned focused-server regression supervisor removes its test process and root after parent SIGKILL', { timeout: 45_000 }, async () => {
  const child = spawn(process.execPath, [launcher, 'server-focused'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  child.stderr.resume();
  let manifest = null;
  try {
    manifest = await waitFor(() => findOwnedManifest(child.pid, 'server-focused'), 10_000, 'focused launcher manifest');
    assertDisposablePath(manifest.tempRoot, manifest.token);
    await waitFor(() => fs.existsSync(path.join(manifest.evidenceRoot, 'focused-tests.log')), 20_000, 'focused test process start');
    assert.ok(tokenPids(manifest.token).length >= 2, 'supervisor and worker/test are running');
    process.kill(child.pid, 'SIGKILL');
    await waitFor(() => !fs.existsSync(manifest.tempRoot), 12_000, 'supervisor-owned root removal');
    await waitFor(() => tokenPids(manifest.token).length === 0, 12_000, 'owned test process teardown');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(child.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    if (manifest) {
      for (const pid of tokenPids(manifest.token)) {
        try { process.kill(pid, 'SIGKILL'); } catch (error) {
          if (error?.code !== 'ESRCH') throw error;
        }
      }
      if (fs.existsSync(manifest.tempRoot)) {
        assertDisposablePath(manifest.tempRoot, manifest.token);
        fs.rmSync(manifest.tempRoot, { recursive: true, force: true });
      }
    }
  }
});
