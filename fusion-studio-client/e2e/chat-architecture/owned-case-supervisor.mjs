import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { assertDisposablePath } from './fixture-lifecycle.mjs';

const [token, ownerPidText, tempRoot, target, ...targetArgs] = process.argv.slice(2);
const ownerPid = Number(ownerPidText);
if (!token || !Number.isInteger(ownerPid) || ownerPid <= 1 || !tempRoot || !target) {
  throw new Error('owned case supervisor arguments are required');
}
assertDisposablePath(tempRoot, token);

const targetChild = spawn(process.execPath, [target, ...targetArgs], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
targetChild.stdout.pipe(process.stdout);
targetChild.stderr.pipe(process.stderr);
const targetExit = new Promise((resolve, reject) => {
  targetChild.once('error', reject);
  targetChild.once('exit', (code, signal) => resolve({ code, signal }));
});

function running(pid) {
  return spawnSync('ps', ['-p', String(pid), '-o', 'pid='], { encoding: 'utf8' }).stdout.trim() !== '';
}

function descendants(pid) {
  const direct = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }).stdout.trim();
  if (!direct) return [];
  return direct.split(/\s+/).map(Number).filter(Number.isInteger).flatMap((childPid) => [childPid, ...descendants(childPid)]);
}

let shutdownPromise = null;
function terminateTree(signal) {
  const pids = [targetChild.pid, ...descendants(targetChild.pid)].reverse();
  for (const pid of pids) {
    try { process.kill(pid, signal); } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
}

async function shutdown(reason, signal = 'SIGTERM') {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    terminateTree(signal);
    await Promise.race([
      targetExit,
      new Promise((resolve) => setTimeout(resolve, 4_000)),
    ]);
    const remaining = [targetChild.pid, ...descendants(targetChild.pid)].filter(running);
    if (remaining.length > 0) terminateTree('SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (fs.existsSync(tempRoot)) {
      assertDisposablePath(tempRoot, token);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    process.stderr.write(`[chat-architecture] supervisor cleanup reason=${reason}\n`);
  })();
  return shutdownPromise;
}

const ownerWatch = setInterval(() => {
  if (!running(ownerPid)) {
    clearInterval(ownerWatch);
    void shutdown('owner-lost').then(() => { process.exitCode = 143; });
  }
}, 100);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(ownerWatch);
    void shutdown(`signal-${signal}`, signal).then(() => { process.exitCode = signal === 'SIGINT' ? 130 : 143; });
  });
}

const result = await targetExit;
clearInterval(ownerWatch);
if (shutdownPromise) await shutdownPromise;
if (!shutdownPromise) process.exitCode = result.code ?? 1;
