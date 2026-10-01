import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const LIVE_PATHS = [
  path.resolve('/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/data/fusion.db'),
  path.resolve('/Users/rccurtrightjr./Library/Application Support/Fusion Studio'),
  path.resolve('/Users/rccurtrightjr./Library/Application Support/Fusion Studio Alpha'),
];

export function assertSafePort(port) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`invalid port: ${port}`);
  }
  if (port === 3001) throw new Error('port 3001 is reserved for the owner development runtime');
}

export function assertDisposablePath(candidate, sentinel) {
  const resolved = path.resolve(candidate);
  for (const live of LIVE_PATHS) {
    if (resolved === live || resolved.startsWith(`${live}${path.sep}`) || live.startsWith(`${resolved}${path.sep}`)) {
      throw new Error(`refusing live path: ${resolved}`);
    }
  }
  const marker = path.join(resolved, '.chat-architecture-owned.json');
  if (!fs.existsSync(marker)) throw new Error(`missing fixture ownership marker: ${resolved}`);
  const owner = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (owner.sentinel !== sentinel) throw new Error(`fixture ownership mismatch: ${resolved}`);
  return resolved;
}

export function markOwnedDirectory(directory, sentinel, kind) {
  fs.mkdirSync(directory, { recursive: true });
  const entries = fs.readdirSync(directory);
  if (entries.length > 0) throw new Error(`refusing non-empty fixture directory: ${directory}`);
  fs.writeFileSync(path.join(directory, '.chat-architecture-owned.json'), `${JSON.stringify({ sentinel, kind })}\n`);
  return assertDisposablePath(directory, sentinel);
}

function processCommand(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return '';
  return spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout.trim();
}

function processGroupMembers(processGroupId) {
  const rows = spawnSync('ps', ['-axo', 'pid=,pgid='], { encoding: 'utf8' }).stdout.split('\n');
  return rows.flatMap((row) => {
    const match = row.trim().match(/^(\d+)\s+(\d+)$/);
    if (!match || Number(match[2]) !== processGroupId) return [];
    return [Number(match[1])];
  });
}

export function assertOwnedPid(pid, token) {
  const command = processCommand(pid);
  if (!command) throw new Error(`owned process ${pid} is not running`);
  if (!command.includes(token)) throw new Error(`refusing unrelated pid ${pid}`);
  return command;
}

export function isPidRunning(pid) {
  return processCommand(pid).length > 0;
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      resolve(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onExit);
  });
}

async function waitForProcessGroupExit(processGroupId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processGroupMembers(processGroupId).length === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return processGroupMembers(processGroupId).length === 0;
}

export async function terminateOwnedProcess(child, token, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  assertOwnedPid(child.pid, token);
  try { process.kill(-child.pid, signal); } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  await waitForExit(child, 4_000);
  if (await waitForProcessGroupExit(child.pid, 1_000)) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  await waitForProcessGroupExit(child.pid, 2_000);
}

export async function runOwnedCommand({
  command,
  args,
  cwd,
  env,
  token,
  logPath,
  deadlineMs,
  signal,
  onStart = () => {},
  progressMs = 30_000,
}) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = fs.createWriteStream(logPath, { flags: 'wx' });
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const startedAt = Date.now();
  let timedOut = false;
  let interrupted = false;
  let terminationPromise = null;
  const terminate = (terminationSignal = 'SIGTERM') => {
    terminationPromise ||= terminateOwnedProcess(child, token, terminationSignal);
    return terminationPromise;
  };
  const forward = (chunk) => {
    log.write(chunk);
    process.stdout.write(chunk);
  };
  child.stdout.on('data', forward);
  child.stderr.on('data', forward);
  assertOwnedPid(child.pid, token);
  onStart({ pid: child.pid, command: [command, ...args], startedAt });

  const deadline = setTimeout(() => {
    timedOut = true;
    void terminate();
  }, deadlineMs);
  const progress = setInterval(() => {
    const record = `[chat-architecture] progress pid=${child.pid} elapsedMs=${Date.now() - startedAt}\n`;
    log.write(record);
    process.stdout.write(record);
  }, progressMs);
  const abort = () => {
    interrupted = true;
    void terminate('SIGINT');
  };
  signal?.addEventListener('abort', abort, { once: true });

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, exitSignal) => resolve({ code, signal: exitSignal }));
  }).finally(() => {
    clearTimeout(deadline);
    clearInterval(progress);
    signal?.removeEventListener('abort', abort);
    log.end();
  });
  if (terminationPromise) await terminationPromise;
  const leakedOwnedPids = processGroupMembers(child.pid);
  if (leakedOwnedPids.length > 0) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
    await waitForProcessGroupExit(child.pid, 2_000);
  }
  return {
    ...result,
    pid: child.pid,
    timedOut,
    interrupted,
    leakedOwnedPids,
    elapsedMs: Date.now() - startedAt,
  };
}
