// Inspect actual macOS process ownership; never trust a global pidfile/pattern.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { canonical, contains } from './fusion-restart-target.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
export function parseEnvironment(command) {
  const markers = [...command.matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=/g)];
  const env = {};
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const key = marker[1];
    if (['FUSION_APP_USER_DATA', 'FUSION_LOCAL_MACHINE'].includes(key)) {
      if (Object.hasOwn(env, key)) throw new Error('ambiguous process environment');
      env[key] = command.slice(marker.index + marker[0].length, markers[i + 1]?.index).trim();
    }
  }
  return env;
}
const processFields = 'pid=,ppid=,uid=,stat=,lstart=,command=';
function parseProcess(line) {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.*)$/);
  if (!match) throw new Error('unsupported process inventory');
  return { pid: Number(match[1]), ppid: Number(match[2]), uid: Number(match[3]), state: match[4], start: match[5], command: match[6] };
}
const terminal = (record) => /^[ZX]/.test(record.state);
const emptyExit = (error) => error.status === 1 && !error.code && !error.signal &&
  !String(error.stdout ?? '').trim() && !String(error.stderr ?? '').trim();
function reobserve(record, execute) {
  let output;
  try { output = execute('ps', ['-p', String(record.pid), '-o', processFields]).trim(); }
  catch (error) { if (emptyExit(error)) return null; throw error; }
  if (!output) return null;
  const current = parseProcess(output);
  if (current.pid !== record.pid || current.uid !== record.uid || current.start !== record.start) {
    throw new Error(`process identity changed: ${record.pid}`);
  }
  // A zombie may expose <defunct> instead of its former command. It cannot run.
  if (terminal(current)) return null;
  if (current.command !== record.command) throw new Error(`process identity changed: ${record.pid}`);
  return current;
}
export function systemProcesses(execute = run) {
  const lines = execute('ps', ['-axo', processFields]).trim().split('\n').filter(Boolean);
  const records = lines.map(parseProcess).filter((record) => !terminal(record));
  const active = [];
  for (const record of records) {
    if (record.uid === process.getuid() && /fusion-studio-(client\/electron\/main\.cjs|server\/server\.js)|Fusion Studio.*Contents\/MacOS|Electron\.app\/.*--type=renderer/.test(record.command)) {
      let files;
      let command;
      try { files = execute('lsof', ['-a', '-p', String(record.pid), '-d', 'cwd,txt', '-Fn']); }
      catch (error) {
        if (!emptyExit(error) || reobserve(record, execute)) throw error;
        continue;
      }
      try { command = execute('ps', ['eww', '-p', String(record.pid), '-o', 'command=']).trim(); }
      catch (error) {
        if (!emptyExit(error) || reobserve(record, execute)) throw error;
        continue;
      }
      const current = reobserve(record, execute);
      if (!current) continue;
      if (!files.trim() || !command.startsWith(record.command)) throw new Error(`unverified live process inspection: ${record.pid}`);
      record.ppid = current.ppid;
      record.cwd = files.match(/^n(.+)$/m)?.[1];
      record.executables = files.split('\n').filter((line) => line.startsWith('n')).slice(1).map((line) => line.slice(1));
      record.env = parseEnvironment(command);
    }
    active.push(record);
  }
  return active;
}
export function processProfile(record, target) {
  if (!record.env) throw new Error(`unverified profile ownership: ${record.pid}`);
  if (record.env.FUSION_APP_USER_DATA && !path.isAbsolute(record.env.FUSION_APP_USER_DATA)) throw new Error(`ambiguous relative process profile: ${record.pid}`);
  const argument = profileArgument(record.command);
  const environment = record.env.FUSION_APP_USER_DATA ? canonical(record.env.FUSION_APP_USER_DATA) : null;
  if (environment && argument && environment !== argument) throw new Error(`conflicting process profile evidence: ${record.pid}`);
  return environment || argument || target.defaultProfile;
}
export function profileArgument(command) {
  const matches = [...command.matchAll(/(?:^| )--user-data-dir=(.*?)(?= --[A-Za-z]|$)/g)];
  const markers = [...command.matchAll(/(?:^| )--user-data-dir(?:=| |$)/g)];
  if (markers.length !== matches.length) throw new Error('unsupported or malformed process profile syntax');
  if (matches.length > 1) throw new Error('ambiguous duplicate process profile');
  if (!matches.length) return null;
  const value = matches[0][1];
  if (!path.isAbsolute(value)) throw new Error('ambiguous process profile argument');
  return canonical(value);
}
export function isMain(record, target) {
  return record.command.startsWith(`${target.bin} ${target.main}`) &&
    (record.command.length === target.bin.length + target.main.length + 1 || record.command[target.bin.length + target.main.length + 1] === ' ') &&
    record.executables?.[0] === canonical(target.bin);
}
export function isServer(record, target) {
  // Node is resolved by the selected app's existing server-spawn owner.
  const node = record.command.match(/^(\/\S+) /)?.[1];
  return Boolean(node && record.command === `${node} ${target.server}` &&
    record.executables?.[0] === canonical(node));
}
export function descendants(records, parent) {
  const ids = new Set([parent]);
  for (let changed = true; changed;) {
    changed = false;
    for (const record of records) if (ids.has(record.ppid) && !ids.has(record.pid)) { ids.add(record.pid); changed = true; }
  }
  return records.filter((record) => ids.has(record.pid));
}
export function selectOwnedProcesses(records, target) {
  const roots = [];
  for (const record of records) {
    if (record.uid !== process.getuid()) continue;
    const mainLike = /\/fusion-studio-client\/electron\/main\.cjs(?: |$)|Fusion Studio.*Contents\/MacOS/.test(record.command);
    const serverLike = /\/fusion-studio-server\/server\.js(?: |$)/.test(record.command);
    if (!mainLike && !serverLike) continue;
    const profile = processProfile(record, target);
    if (profile !== target.profile) {
      if (mainLike && isMain(record, target) && !record.env.FUSION_APP_USER_DATA && target.profileMode === 'default') {
        throw new Error(`development database in use by another profile: ${record.pid}`);
      }
      continue;
    }
    if ((mainLike && !isMain(record, target)) || (serverLike && !isServer(record, target))) {
      throw new Error(`profile in use by another or ambiguous checkout: ${record.pid}`);
    }
    if (record.env.FUSION_LOCAL_MACHINE !== target.machine) throw new Error(`profile machine mismatch: ${record.pid}`);
    const defaultDb = !record.env.FUSION_APP_USER_DATA;
    if (defaultDb !== (target.profileMode === 'default')) throw new Error(`profile database mode mismatch: ${record.pid}`);
    roots.push(record.pid);
  }
  const selected = new Map();
  for (const root of roots) for (const record of descendants(records, root)) selected.set(record.pid, record);
  for (const record of selected.values()) {
    if (/Fusion[ -]Studio[ -]Alpha/i.test(record.command)) throw new Error(`Alpha descendant is excluded: ${record.pid}`);
    if (record.command.includes('--type=renderer') &&
        (profileArgument(record.command) !== target.profile || processProfile(record, target) !== target.profile)) {
      throw new Error(`conflicting renderer profile in selected tree: ${record.pid}`);
    }
  }
  for (const record of records) {
    if (record.uid !== process.getuid() || !record.command.includes('--type=renderer')) continue;
    if (profileArgument(record.command) === target.profile && !selected.has(record.pid)) {
      throw new Error(`profile renderer has unverified ancestry: ${record.pid}`);
    }
  }
  return [...selected.values()];
}
export function sameProcess(a, b) {
  return a && b && a.pid === b.pid && a.ppid === b.ppid && a.start === b.start && a.command === b.command;
}
export function listenerPids(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid selected port');
  try { return run('lsof', ['-n', '-a', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).trim().split('\n').filter(Boolean).map(Number); }
  catch (error) { if (error.status === 1) return []; throw error; }
}
export function validateRuntime(records, target, mainPid, serverPort, owners, debugPort, debugOwners) {
  const main = records.find((r) => r.pid === mainPid);
  if (!main || !isMain(main, target) || processProfile(main, target) !== target.profile || main.env.FUSION_LOCAL_MACHINE !== target.machine) throw new Error('wrong main path/profile/machine');
  if (canonical(main.cwd) !== target.client) throw new Error('wrong launched main cwd');
  if ((!main.env.FUSION_APP_USER_DATA) !== (target.profileMode === 'default')) throw new Error('wrong main database mode');
  if (debugOwners.length !== 1 || debugOwners[0] !== mainPid) throw new Error('unowned renderer probe port');
  const servers = records.filter((r) => r.ppid === mainPid && isServer(r, target));
  if (servers.length !== 1 || owners.length !== 1 || owners[0] !== servers[0].pid) throw new Error('dead or wrong server path/ancestry/listener');
  const server = servers[0];
  if (canonical(server.cwd) !== target.client) throw new Error('wrong launched server cwd');
  if (processProfile(server, target) !== target.profile || server.env.FUSION_LOCAL_MACHINE !== target.machine ||
      ((!server.env.FUSION_APP_USER_DATA) !== (target.profileMode === 'default'))) throw new Error('wrong server profile/machine/database mode');
  const renderers = descendants(records, mainPid).filter((r) => r.command.includes('--type=renderer'));
  const electronApp = canonical(path.dirname(path.dirname(path.dirname(target.bin))));
  if (!renderers.some((r) => profileArgument(r.command) === target.profile && processProfile(r, target) === target.profile &&
      r.executables?.[0] && contains(electronApp, canonical(r.executables[0])))) throw new Error('wrong renderer path/profile/ancestry');
  return { mainPid, serverPid: server.pid, rendererPids: renderers.map((r) => r.pid), serverPort, debugPort,
    mainExecutable: main.executables[0], mainEntry: target.main, mainCwd: main.cwd,
    serverExecutable: server.executables[0], serverEntry: target.server, serverCwd: server.cwd,
    rendererExecutables: renderers.map((r) => r.executables?.[0]), profile: target.profile, machine: target.machine,
    serverUserData: server.env.FUSION_APP_USER_DATA || null };
}
