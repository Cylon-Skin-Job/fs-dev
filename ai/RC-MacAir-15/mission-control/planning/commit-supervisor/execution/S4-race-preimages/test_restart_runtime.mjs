// S4 disposable boundary tests. Injected facts are not live-app success evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');
const { resolveTarget, launchEnvironment, canonical, assertLocalRuntime } = await import(path.join(root, 'scripts/fusion-restart-target.mjs'));
const { selectOwnedProcesses, validateRuntime, systemProcesses, parseEnvironment } = await import(path.join(root, 'scripts/fusion-restart-processes.mjs'));
const { restart, stopOwned } = await import(path.join(root, 'scripts/fusion-restart.mjs'));
const { observeConnection } = await import(path.join(root, 'scripts/fusion-restart-probe.mjs'));
const baseArgs = ['--repo', root, '--machine', 'RC-MacAir-15'];
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-restart-S4-'));
  t.after(() => {
    if (process.env.FUSION_RESTART_TEST_EVIDENCE) {
      const files = [];
      const walk = (folder) => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
          const leaf = path.join(folder, entry.name);
          if (entry.isDirectory()) walk(leaf);
          else if (entry.isFile()) files.push({ path: path.relative(dir, leaf), bytes: fs.readFileSync(leaf, 'utf8') });
          else files.push({ path: path.relative(dir, leaf), link: fs.readlinkSync(leaf) });
        }
      };
      walk(dir); fs.mkdirSync(process.env.FUSION_RESTART_TEST_EVIDENCE, { recursive: true });
      fs.writeFileSync(path.join(process.env.FUSION_RESTART_TEST_EVIDENCE, `${t.name.replace(/[^A-Za-z0-9-]+/g, '_')}.json`), `${JSON.stringify({ test: t.name, fixture: canonical(dir), injected: true, files }, null, 2)}\n`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const profile = path.join(dir, 'selected profile');
  fs.mkdirSync(profile);
  const target = resolveTarget([...baseArgs, '--user-data', profile], {});
  return { dir: canonical(dir), target };
}
function facts(target) {
  const common = { uid: process.getuid(), start: 'fixture-start', cwd: target.client,
    env: { FUSION_APP_USER_DATA: target.profile, FUSION_LOCAL_MACHINE: target.machine } };
  return [
    { ...common, pid: 111, ppid: 1, command: `${target.bin} ${target.main}`, executables: [canonical(target.bin)] },
    { ...common, pid: 112, ppid: 111, command: `${process.execPath} ${target.server}`, executables: [canonical(process.execPath)] },
    { ...common, pid: 113, ppid: 111, command: `fixture-helper --type=renderer --user-data-dir=${target.profile} --lang=en`, executables: [target.bin] },
  ];
}
function dry(args, env = {}) {
  return spawnSync('bash', [path.join(root, 'restart-fusion.sh'), ...args, '--dry-run'], {
    env: { ...process.env, FUSION_APP_USER_DATA: '', FUSION_LOCAL_MACHINE: '', ...env }, encoding: 'utf8',
  });
}
test('canonical CLI preserves default DB; explicit and inherited profiles select server-data', (t) => {
  const { target } = fixture(t);
  const ordinary = dry(baseArgs); assert.equal(ordinary.status, 0, ordinary.stderr);
  const def = JSON.parse(ordinary.stdout);
  assert.equal(def.profileMode, 'default'); assert.equal(def.database, path.join(root, 'fusion-studio-server/data/fusion.db'));
  const explicit = dry([...baseArgs, '--user-data', target.profile]);
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.equal(JSON.parse(explicit.stdout).database, path.join(target.profile, 'server-data/fusion.db'));
  const inherited = dry(baseArgs, { FUSION_APP_USER_DATA: target.profile });
  assert.equal(inherited.status, 0, inherited.stderr); assert.equal(JSON.parse(inherited.stdout).profileMode, 'inherited');
  assert.equal(JSON.parse(inherited.stdout).profile, target.profile);
  const override = dry([...baseArgs, '--user-data', target.profile], { FUSION_APP_USER_DATA: '/unselected-profile' });
  assert.equal(JSON.parse(override.stdout).profile, target.profile);
  assert.deepEqual(fs.readdirSync(target.profile), []);
});
test('CLI rejects unsafe/Alpha/ambiguous arguments without profile changes', (t) => {
  const { target } = fixture(t);
  for (const args of [
    [...baseArgs, '--user-data', '/'], [...baseArgs, '--user-data', os.homedir()],
    [...baseArgs, '--user-data', root], [...baseArgs, '--user-data', 'relative'],
    [...baseArgs, '--user-data', path.join(os.homedir(), 'Library/Application Support/Fusion Studio Alpha')],
    [...baseArgs, '--machine', 'RC-Alpha'], [...baseArgs, '--machine', '../other'],
    [...baseArgs, '--user-data'], [...baseArgs, '--unknown'], ['--repo', path.join(root, 'fusion-studio-client')],
  ]) assert.notEqual(dry(args).status, 0, args.join(' '));
  assert.deepEqual(fs.readdirSync(target.profile), []);
});
test('launch environment preserves default DB mode and resolves selected profile/machine/TMPDIR', (t) => {
  const { target } = fixture(t);
  const env = launchEnvironment(target, '/selected/tmp', { FUSION_APP_USER_DATA: '/wrong', ELECTRON_RUN_AS_NODE: '1' });
  assert.equal(env.FUSION_APP_USER_DATA, target.profile); assert.equal(env.FUSION_LOCAL_MACHINE, target.machine);
  assert.equal(env.TMPDIR, '/selected/tmp/'); assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
  const ordinary = resolveTarget(baseArgs, {});
  assert.equal(launchEnvironment(ordinary, '/tmp/selected', { FUSION_APP_USER_DATA: '/wrong' }).FUSION_APP_USER_DATA, undefined);
});
test('selected-only tree includes children and preserves same-checkout other profile and Alpha', (t) => {
  const { target } = fixture(t); const selected = facts(target);
  const other = { ...selected[0], pid: 222, env: { ...selected[0].env, FUSION_APP_USER_DATA: '/other-profile' } };
  const alpha = { ...selected[0], pid: 333, command: '/Applications/Fusion Studio Alpha.app/Contents/MacOS/Fusion Studio', env: { FUSION_APP_USER_DATA: '/Alpha-profile' } };
  assert.deepEqual(selectOwnedProcesses([...selected, other, alpha], target).map((r) => r.pid), [111, 112, 113]);
  // Existing LaunchServices launches legitimately use cwd=/; absolute entries bind ownership.
  assert.deepEqual(selectOwnedProcesses(selected.map((r) => ({ ...r, cwd: '/' })), target).map((r) => r.pid), [111, 112, 113]);
});
test('foreign checkout/shared profile, wrong machine, orphan renderer, mode collision refuse before effects', async (t) => {
  const { target } = fixture(t); const records = facts(target);
  const variants = [
    [{ ...records[0], command: records[0].command.replace(target.main, `/other${target.main}`) }],
    [{ ...records[0], env: { ...records[0].env, FUSION_LOCAL_MACHINE: 'Other' } }],
    [records[2]],
    [{ ...records[0], env: { FUSION_LOCAL_MACHINE: target.machine } }],
  ];
  for (const rows of variants) {
    const selectedTarget = rows === variants[3] ? { ...target, profile: target.defaultProfile } : target;
    let builds = 0;
    await assert.rejects(restart(selectedTarget, { preflight() {}, inventory: () => rows, build() { builds += 1; } }));
    assert.equal(builds, 0); assert.deepEqual(fs.readdirSync(target.profile), []);
  }
});
test('runtime identity rejects wrong-path/profile/server/renderer instead of certifying a port', (t) => {
  const { target } = fixture(t); const good = facts(target);
  assert.equal(validateRuntime(good, target, 111, 5555, [112], 6666, [111]).serverPid, 112);
  for (const records of [
    good.map((r) => r.pid === 111 ? { ...r, command: r.command.replace(target.main, '/wrong/main.cjs') } : r),
    good.map((r) => r.pid === 111 ? { ...r, env: { ...r.env, FUSION_APP_USER_DATA: '/wrong' } } : r),
    good.filter((r) => r.pid !== 112),
    good.map((r) => r.pid === 112 ? { ...r, command: `${process.execPath} /wrong/server.js` } : r),
    good.map((r) => r.pid === 112 ? { ...r, env: { ...r.env, FUSION_APP_USER_DATA: '/wrong' } } : r),
    good.map((r) => r.pid === 113 ? { ...r, command: 'helper --type=renderer --user-data-dir=/wrong --lang=en' } : r),
  ]) assert.throws(() => validateRuntime(records, target, 111, 5555, [112], 6666, [111]));
  assert.throws(() => validateRuntime(good, target, 111, 5555, [999], 6666, [111]));
  assert.throws(() => validateRuntime(good, target, 111, 5555, [112], 6666, [999]));
});
test('exact renderer profile avoids Alpha prefix collision and CLI profile overrides absent environment', (t) => {
  const { target } = fixture(t); const selected = facts(target);
  const alphaRenderer = { ...selected[2], pid: 333, ppid: 332,
    command: `helper --type=renderer --user-data-dir=${target.profile} Alpha --lang=en`,
    env: { FUSION_APP_USER_DATA: `${target.profile} Alpha` } };
  assert.deepEqual(selectOwnedProcesses([...selected, alphaRenderer], target).map((r) => r.pid), [111, 112, 113]);
  const alternateMain = { ...selected[0], pid: 444,
    command: `${target.bin} ${target.main} --user-data-dir=${target.profile} Other --remote-debugging-port=1234`,
    env: { FUSION_LOCAL_MACHINE: target.machine } };
  assert.deepEqual(selectOwnedProcesses([alternateMain], target), []);
  const conflicting = { ...alternateMain, env: selected[0].env };
  assert.throws(() => selectOwnedProcesses([conflicting], target), /conflicting process profile/);
  const defaultTarget = { ...target, profile: target.defaultProfile, profileMode: 'default' };
  assert.throws(() => selectOwnedProcesses([alternateMain], defaultTarget), /database in use by another profile/);
  const conflictingRenderer = { ...selected[2], env: { FUSION_APP_USER_DATA: '/wrong' } };
  assert.throws(() => selectOwnedProcesses([selected[0], conflictingRenderer], target), /profile/);
  for (const suffix of ['--user-data-dir /tmp/other', '--user-data-dir', '--user-data-dir=', `--user-data-dir=${target.profile} --user-data-dir /tmp/other`]) {
    assert.throws(() => selectOwnedProcesses([{ ...selected[0], command: `${target.bin} ${target.main} ${suffix}`, env: { FUSION_LOCAL_MACHINE: target.machine } }], target), /profile/);
  }
});
test('read-only real-system selector identifies default app and excludes Alpha process tree', () => {
  const target = resolveTarget(baseArgs, {});
  const records = systemProcesses();
  const selected = selectOwnedProcesses(records, target);
  const sourceMain = records.find((r) => r.command.startsWith(`${target.bin} ${target.main}`));
  if (sourceMain) assert.equal(selected.some((r) => r.pid === sourceMain.pid), true);
  const alphaIds = records.filter((r) => r.command.startsWith('/Applications/Fusion Studio Alpha.app/')).map((r) => r.pid);
  assert.equal(selected.some((r) => alphaIds.includes(r.pid)), false);
});
test('renderer connection oracle requires initialized shell and sustained actual connected state', async () => {
  const good = { url: 'fusion-shell://app/', connected: 1, text: 'Connected' };
  const noWait = { sleep: async () => {}, samples: 3 };
  assert.equal((await observeConnection(async () => good, noWait)).connectedAfterWorkspaceInit, true);
  for (const sample of [{ ...good, url: 'http://localhost/' }, { ...good, connected: 0 }, { ...good, text: 'Connecting...' }]) {
    await assert.rejects(observeConnection(async () => sample, noWait));
  }
  let reads = 0;
  await assert.rejects(observeConnection(async () => ++reads === 2 ? { ...good, connected: 0 } : good, noWait));
});
test('injected post-launch failures withhold readiness, preserve DBs/unrelated caches, release lock', async (t) => {
  const { dir, target } = fixture(t);
  const database = path.join(target.profile, 'server-data/fusion.db'); fs.mkdirSync(path.dirname(database)); fs.writeFileSync(database, 'DB sentinel');
  const unrelated = path.join(dir, 'unrelated/Cache'); fs.mkdirSync(unrelated, { recursive: true }); fs.writeFileSync(path.join(unrelated, 'keep'), 'cache sentinel');
  for (const fault of ['wrong-path', 'wrong-profile', 'dead-server', 'disconnected-renderer']) {
    fs.mkdirSync(path.join(target.profile, 'Cache'), { recursive: true }); fs.writeFileSync(path.join(target.profile, 'Cache/stale'), 'stale');
    const records = facts(target);
    const verify = async () => {
      if (fault === 'wrong-path') records[0].command = 'wrong main path';
      if (fault === 'wrong-profile') records[0].env = { ...records[0].env, FUSION_APP_USER_DATA: '/wrong' };
      if (fault === 'dead-server') records.splice(1, 1);
      validateRuntime(records, target, 111, 5555, [112], 6666, [111]);
      await observeConnection(async () => ({ url: 'fusion-shell://app/', connected: 0, text: 'Disconnected' }), { sleep: async () => {} });
    };
    await assert.rejects(restart(target, { preflight() {}, inventory: () => [], build() {}, stop: async () => {},
      freePort: async () => 6666, launch: async () => 111, verify }), /readiness withheld/);
    assert.equal(fs.readFileSync(database, 'utf8'), 'DB sentinel');
    assert.equal(fs.readFileSync(path.join(unrelated, 'keep'), 'utf8'), 'cache sentinel');
    assert.equal(fs.existsSync(path.join(target.profile, 'Cache')), false);
    assert.equal(fs.existsSync(path.join(target.runtime, 'restart.lock')), false);
  }
  const runs = fs.readdirSync(target.runtime);
  assert.equal(runs.length, 4);
  for (const run of runs) {
    assert.equal(fs.existsSync(path.join(target.runtime, run, 'verified.json')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(target.runtime, run, 'failure.json'))).state, 'UNMET_RUNTIME_CHECK');
  }
});
test('borrowed Electron runtime and linked runtime storage refuse without effects', (t) => {
  const { target } = fixture(t);
  assert.throws(() => assertLocalRuntime({ ...target, bin: process.execPath }), /borrowed/);
  fs.symlinkSync('/tmp', target.runtime);
  return assert.rejects(restart(target, { preflight() {}, inventory: () => [] }), /symlink/);
});
test('linked profile database storage refuses before build/profile/cache mutation', async (t) => {
  const { dir, target } = fixture(t); const other = path.join(dir, 'unrelated-data'); fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'fusion.db'), 'unrelated DB');
  fs.symlinkSync(other, path.join(target.profile, 'server-data'));
  let builds = 0;
  await assert.rejects(restart(target, { preflight() {}, inventory: () => [], build() { builds += 1; } }), /symlink/);
  assert.equal(builds, 0); assert.equal(fs.existsSync(target.runtime), false);
  assert.equal(fs.readFileSync(path.join(other, 'fusion.db'), 'utf8'), 'unrelated DB');
});
test('actual disposable Node tree ownership/termination preserves another live profile', async (t) => {
  const { dir, target } = fixture(t);
  const main = path.join(dir, 'fusion-studio-client/electron/main.cjs');
  const server = path.join(dir, 'fusion-studio-server/server.js');
  fs.mkdirSync(path.dirname(main), { recursive: true }); fs.mkdirSync(path.dirname(server), { recursive: true });
  fs.writeFileSync(server, 'setInterval(() => {}, 1000);');
  fs.writeFileSync(main, `require('node:child_process').spawn(process.execPath, [${JSON.stringify(server)}], {stdio:'ignore'}); setInterval(() => {}, 1000);`);
  const env = { ...process.env, FUSION_APP_USER_DATA: target.profile, FUSION_LOCAL_MACHINE: target.machine };
  const owner = spawn(process.execPath, [main], { cwd: target.client, env, stdio: 'ignore' });
  const unrelated = spawn(process.execPath, [server], { cwd: target.client, env: { ...env, FUSION_APP_USER_DATA: path.join(dir, 'other') }, stdio: 'ignore' });
  const cleanup = () => { for (const child of [owner, unrelated]) try { child.kill('SIGKILL'); } catch {} };
  t.after(cleanup); await once(owner, 'spawn');
  await new Promise((resolve) => setTimeout(resolve, 250));
  const injectedTarget = { ...target, bin: process.execPath, main, server };
  const selected = selectOwnedProcesses(systemProcesses(), injectedTarget);
  assert.equal(selected.some((r) => r.pid === owner.pid), true);
  assert.equal(selected.some((r) => r.pid === unrelated.pid), false);
  assert.equal(selected.length, 2);
  await stopOwned(selected);
  assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
  assert.equal(systemProcesses().some((r) => r.pid === owner.pid), false);
});
test('PID reuse refuses all signals and ps environment parser retains spaced profile', async () => {
  const record = { pid: 444, ppid: 1, start: 'old', command: 'fixture' };
  const signals = [];
  await assert.rejects(stopOwned([record], () => [{ ...record, start: 'new' }], (...args) => signals.push(args), async () => {}));
  assert.deepEqual(signals, []);
  assert.equal(parseEnvironment('binary main FUSION_APP_USER_DATA=/tmp/profile with spaces FUSION_LOCAL_MACHINE=fixture HOME=/home').FUSION_APP_USER_DATA, '/tmp/profile with spaces');
});
