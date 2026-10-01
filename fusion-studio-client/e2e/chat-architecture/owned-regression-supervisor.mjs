import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { assertDisposablePath } from './fixture-lifecycle.mjs';

// 01C-specific parent-loss supervision. It keeps the accepted 01A/01B
// supervisor bytes untouched, while treating a SIGKILLed but unreaped parent
// as lost (macOS ps still lists such a process with state Z).
const [token, ownerPidText, tempRoot, target, ...targetArgs] = process.argv.slice(2);
const ownerPid = Number(ownerPidText);
if (!token || !Number.isInteger(ownerPid) || ownerPid <= 1 || !tempRoot || !target) {
  throw new Error('owned regression supervisor arguments are required');
}
assertDisposablePath(tempRoot, token);

// The launcher's stdout/stderr pipes close abruptly on SIGKILL. They are
// observability channels, not lifecycle authorities; an EPIPE must not kill
// this guardian before its parent-loss watch has cleaned the owned tree.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error) => {
    if (error?.code === 'EPIPE') stream.destroy();
    else throw error;
  });
}

const targetChild = spawn(process.execPath, [target, ...targetArgs], {
  cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
targetChild.stdout.pipe(process.stdout);
targetChild.stderr.pipe(process.stderr);
const targetExit = new Promise((resolve, reject) => {
  targetChild.once('error', reject);
  targetChild.once('exit', (code, signal) => resolve({ code, signal }));
});

function running(pid) {
  const state = spawnSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' }).stdout.trim();
  return Boolean(state) && !state.startsWith('Z');
}

function descendants(pid) {
  const direct = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }).stdout.trim();
  if (!direct) return [];
  return direct.split(/\s+/).map(Number).filter(Number.isInteger).flatMap((childPid) => [childPid, ...descendants(childPid)]);
}

function terminateTree(signal) {
  for (const pid of [targetChild.pid, ...descendants(targetChild.pid)].reverse()) {
    try { process.kill(pid, signal); } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
}

let shutdownPromise = null;
function shutdown(reason, signal = 'SIGTERM') {
  shutdownPromise ||= (async () => {
    terminateTree(signal);
    await Promise.race([targetExit, new Promise((resolve) => setTimeout(resolve, 4_000))]);
    const remaining = [targetChild.pid, ...descendants(targetChild.pid)].filter(running);
    if (remaining.length) terminateTree('SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (fs.existsSync(tempRoot)) {
      assertDisposablePath(tempRoot, token);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    process.stderr.write(`[chat-architecture] regression supervisor cleanup reason=${reason}\n`);
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
