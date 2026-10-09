import { _electron as electron } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const clientRoot = path.resolve(import.meta.dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shell-auth-smoke-'));
const protectedDevelopmentFiles = [
  path.join(clientRoot, '..', 'ai', 'RC-MacAir-15', 'System', 'styles', 'themes.css'),
  path.join(clientRoot, '..', 'ai', 'RC-MacAir-15', 'System', 'config', 'cli.json'),
].map((filePath) => ({
  filePath,
  existed: fs.existsSync(filePath),
  bytes: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
}));
const executablePath = process.env.FUSION_SMOKE_EXECUTABLE || undefined;
const launchOptions = {
  cwd: clientRoot,
  env: {
    ...process.env,
    FUSION_APP_USER_DATA: profile,
    FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
  },
  ...(executablePath
    ? { executablePath, args: [] }
    : { args: [path.join(clientRoot, 'electron', 'main.cjs')] }),
};

function findServerPid(electronPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' });
  for (const row of rows.split('\n')) {
    const match = row.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!match || Number(match[2]) !== electronPid) continue;
    if (/fusion-studio-server\/server\.js(?:\s|$)/.test(match[3])) return Number(match[1]);
  }
  throw new Error('server child not found');
}

async function waitForMessage(messages, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (messages.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

let app;
try {
  app = await electron.launch(launchOptions);
  const messages = [];
  const attached = new WeakSet();
  const attach = (page) => {
    if (attached.has(page)) return;
    attached.add(page);
    page.on('console', (entry) => messages.push(entry.text()));
  };
  app.on('window', attach);
  const page = await app.firstWindow();
  attach(page);
  await page.waitForURL('fusion-shell://app/', { timeout: 30_000 });
  await page.waitForFunction(() => document.body && window.electronAPI, null, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.innerText.length > 0, null, { timeout: 30_000 });
  const first = await page.evaluate(() => window.electronAPI.getRuntimeDescriptor());
  if (!first || typeof first.generation !== 'string') throw new Error('initial runtime descriptor unavailable');
  await waitForMessage(messages, (value) => value.includes('[WS] Authenticated'));
  await waitForMessage(messages, (value) => value.includes('workspace:init'));
  if (!messages.some((value) => value.includes('[WS] Authenticated'))) throw new Error('initial shell authentication not observed');
  if (!messages.some((value) => value.includes('workspace:init'))) throw new Error('initial workspace hydration not observed');
  if (messages.findIndex((value) => value.includes('[WS] Authenticated'))
    > messages.findIndex((value) => value.includes('workspace:init'))) {
    throw new Error('workspace initialization was released before authentication');
  }
  if (messages.some((value) => value.includes('shell-auth:challenge') || value.includes('shell-auth:proof'))) {
    throw new Error('authentication material reached renderer logs');
  }

  const serverPid = findServerPid(app.process().pid);
  process.kill(serverPid, 'SIGKILL');
  await page.waitForFunction(async (generation) => {
    const descriptor = await window.electronAPI?.getRuntimeDescriptor();
    return descriptor && descriptor.generation !== generation;
  }, first.generation, { timeout: 45_000 });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline
    && messages.filter((value) => value.includes('[WS] Authenticated')).length < 2) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const authCount = messages.filter((value) => value.includes('[WS] Authenticated')).length;
  const initCount = messages.filter((value) => value.includes('workspace:init')).length;
  if (authCount < 2 || initCount < 2) {
    throw new Error('restart reauthentication failed');
  }
  const second = await page.evaluate(() => window.electronAPI.getRuntimeDescriptor());
  if (second.generation === first.generation || second.webSocketUrl === first.webSocketUrl) {
    throw new Error('runtime authority did not rotate');
  }
  process.stdout.write('TRUSTED_SHELL_AUTH_SMOKE_OK\n');
} finally {
  if (app) await app.close().catch(() => {});
  for (const snapshot of protectedDevelopmentFiles) {
    if (snapshot.existed) fs.writeFileSync(snapshot.filePath, snapshot.bytes);
    else if (fs.existsSync(snapshot.filePath)) fs.rmSync(snapshot.filePath, { force: true });
  }
  fs.rmSync(profile, { recursive: true, force: true });
}
