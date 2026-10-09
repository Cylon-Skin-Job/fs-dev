// Canonical restart coordinator; tests inject disposable boundary adapters.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assertLocalRuntime, assertNoLinks, cacheNames, launchEnvironment, resolveTarget, usage } from './fusion-restart-target.mjs';
import { sameProcess, selectOwnedProcesses, systemProcesses } from './fusion-restart-processes.mjs';
import { delay, loadChromium, verifyLive } from './fusion-restart-probe.mjs';

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
export async function stopOwned(records, inventory = systemProcesses, signal = process.kill, sleep = delay) {
  // Refuse PID reuse/drift before any signal. A disappeared process needs none.
  const current = inventory();
  for (const record of records) {
    const now = current.find((r) => r.pid === record.pid);
    if (now && !sameProcess(now, record)) throw new Error(`process changed before stop: ${record.pid}`);
  }
  const ids = new Set(records.map((r) => r.pid));
  const roots = records.filter((r) => !ids.has(r.ppid));
  const send = (record, kind) => {
    const now = inventory().find((r) => r.pid === record.pid);
    if (!now) return;
    // A surviving child can have been reparented when its owned root exited.
    if (now.start !== record.start || now.command !== record.command) throw new Error(`PID reused during stop: ${record.pid}`);
    try { signal(record.pid, kind); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  for (const record of roots) send(record, 'SIGTERM');
  for (let i = 0; i < 16; i += 1) {
    if (!inventory().some((r) => ids.has(r.pid))) return;
    await sleep(500);
  }
  for (const record of records) send(record, 'SIGTERM');
  await sleep(500);
  for (const record of records) send(record, 'SIGKILL');
  await sleep(500);
  if (inventory().some((r) => ids.has(r.pid))) throw new Error('owned process did not stop');
}
function build(target) {
  const result = spawnSync('npm', ['run', 'build'], { cwd: target.client, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('selected client build failed');
}
async function launch(target, temporary, logFile, debugPort) {
  const fd = fs.openSync(logFile, 'a');
  try {
    const child = spawn(target.bin, [target.main, `--user-data-dir=${target.profile}`,
      '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`], {
      cwd: target.client, env: launchEnvironment(target, temporary), detached: true, stdio: ['ignore', fd, fd],
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    return child.pid;
  } finally { fs.closeSync(fd); }
}
export async function restart(target, adapters = {}) {
  const ops = { inventory: systemProcesses, preflight: (t) => { assertLocalRuntime(t); loadChromium(t); },
    build, stop: stopOwned, launch, verify: verifyLive, freePort, ...adapters };
  ops.preflight(target);
  // Resolve ownership before build/cache/port/profile/log operations.
  selectOwnedProcesses(ops.inventory(), target);
  assertNoLinks(target.profile, target.runtime);
  const storageRoot = target.profileMode === 'default' ? target.repo : target.profile;
  assertNoLinks(storageRoot, target.database);
  assertNoLinks(storageRoot, target.serverLog);
  fs.mkdirSync(target.runtime, { recursive: true });
  const lock = path.join(target.runtime, 'restart.lock');
  try { fs.mkdirSync(lock); } catch { throw new Error(`profile restart already locked: ${lock}`); }
  let run;
  let mainPid;
  try {
    fs.writeFileSync(path.join(lock, 'owner.json'), `${JSON.stringify({ pid: process.pid, repo: target.repo, profile: target.profile, at: new Date().toISOString() })}\n`, { flag: 'wx' });
    run = fs.mkdtempSync(path.join(target.runtime, 'run-'));
    const temporary = path.join(run, 'tmp');
    fs.mkdirSync(temporary);
    const logFile = path.join(run, 'launch.log');
    fs.writeFileSync(path.join(run, 'target.json'), `${JSON.stringify(target, null, 2)}\n`);
    await ops.build(target);
    const selected = selectOwnedProcesses(ops.inventory(), target);
    await ops.stop(selected, ops.inventory);
    // No profile process may have appeared while stopping the selected tree.
    if (selectOwnedProcesses(ops.inventory(), target).length) throw new Error('selected profile still in use');
    for (const name of cacheNames) fs.rmSync(path.join(target.profile, name), { recursive: true, force: true });
    fs.rmSync(target.portFile, { force: true });
    const debugPort = await ops.freePort();
    mainPid = await ops.launch(target, temporary, logFile, debugPort);
    const live = await ops.verify(target, mainPid, debugPort);
    const result = { state: 'RUNTIME_VERIFIED', ...live, ...target, run, logFile,
      electronLog: path.join(temporary, 'fusion-electron.log'), rendererLog: path.join(temporary, 'electron-renderer.log') };
    fs.writeFileSync(path.join(run, 'verified.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } catch (error) {
    if (run) fs.writeFileSync(path.join(run, 'failure.json'), `${JSON.stringify({ state: 'UNMET_RUNTIME_CHECK', mainPid, error: error.message }, null, 2)}\n`);
    throw new Error(`${error.message}; readiness withheld; evidence: ${run || target.runtime}`);
  } finally { fs.rmSync(path.join(lock, 'owner.json'), { force: true }); fs.rmdirSync(lock); }
}
export async function main(argv = process.argv.slice(2)) {
  const target = resolveTarget(argv);
  if (target.help) { console.log(usage); return; }
  if (target.dryRun) {
    console.log(JSON.stringify({ state: 'DRY_RUN_ONLY', ...target }, null, 2));
    return;
  }
  if (process.platform !== 'darwin') throw new Error('this development Electron restart requires macOS');
  console.log(JSON.stringify(await restart(target), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
}
