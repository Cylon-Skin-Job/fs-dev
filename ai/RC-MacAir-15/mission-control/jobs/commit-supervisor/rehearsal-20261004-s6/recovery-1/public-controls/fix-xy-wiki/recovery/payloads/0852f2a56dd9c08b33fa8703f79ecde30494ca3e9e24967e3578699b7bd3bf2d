// Resolve the development checkout/profile without changing runtime state.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const cacheNames = ['Cache', 'Code Cache', 'GPUCache', 'Local Storage', 'Session Storage'];
export const usage = 'Usage: restart-fusion.sh [--repo /absolute/repository/path] [--machine machine-id] [--user-data /absolute/profile] [--dry-run]';
export function canonical(value) {
  let cursor = path.resolve(value);
  const missing = [];
  while (!fs.existsSync(cursor)) {
    missing.unshift(path.basename(cursor));
    cursor = path.dirname(cursor);
  }
  return path.join(fs.realpathSync(cursor), ...missing);
}
export function contains(parent, child) {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}
function absolute(value, label) {
  if (!value || !path.isAbsolute(value) || /[\x00-\x1f\x7f]|\s[A-Za-z_][A-Za-z0-9_]*=|\s--/.test(value)) {
    throw new Error(`${label} must be an unambiguous absolute path`);
  }
  return canonical(value);
}
export function resolveTarget(argv, env = process.env, home = os.homedir()) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--dry-run') opts.dryRun = true;
    else if (key === '--help' || key === '-h') return { help: true };
    else if (['--repo', '--script-repo', '--machine', '--user-data'].includes(key)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--') || opts[key] !== undefined) {
        throw new Error(`missing or duplicate value for ${key}`);
      }
      opts[key] = argv[++i];
    } else throw new Error(`unknown argument: ${key}`);
  }
  const repo = absolute(opts['--repo'] || opts['--script-repo'], '--repo');
  const gitRoot = execFileSync('git', ['-C', repo, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  if (canonical(gitRoot) !== repo) throw new Error('--repo must name the resolved Git worktree root');
  const client = path.join(repo, 'fusion-studio-client');
  const server = path.join(repo, 'fusion-studio-server', 'server.js');
  const main = path.join(client, 'electron', 'main.cjs');
  for (const file of [main, server, path.join(repo, 'restart-fusion.sh')]) {
    if (!fs.statSync(file).isFile() || !contains(repo, fs.realpathSync(file))) {
      throw new Error(`selected checkout file unavailable: ${file}`);
    }
  }
  const machine = opts['--machine'] || env.FUSION_LOCAL_MACHINE || 'RC-MacAir-15';
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(machine) || machine === 'RC-Alpha') {
    throw new Error('invalid or Alpha machine identity');
  }
  if (!fs.existsSync(path.join(repo, 'ai', machine, 'System'))) throw new Error(`machine System tree not found: ${machine}`);
  const defaultProfile = canonical(path.join(home, 'Library', 'Application Support', 'Fusion Studio'));
  const profileMode = opts['--user-data'] ? 'explicit' : env.FUSION_APP_USER_DATA ? 'inherited' : 'default';
  const profile = absolute(opts['--user-data'] || env.FUSION_APP_USER_DATA || defaultProfile, '--user-data');
  const alphaProfile = canonical(path.join(home, 'Library', 'Application Support', 'Fusion Studio Alpha'));
  const alphaSource = canonical(path.join(home, 'Applications', 'Fusion-Studio-Alpha-Source'));
  if (contains(alphaSource, repo) || /fusion[ -]studio[ -]alpha/i.test(repo) ||
      contains(alphaProfile, profile) || contains(profile, alphaProfile) ||
      /fusion[ -]studio[ -]alpha/i.test(profile)) throw new Error('Alpha checkout/app/profile is excluded');
  if (profile === path.parse(profile).root || contains(profile, canonical(home)) ||
      contains(profile, repo) || contains(repo, profile)) throw new Error('unsafe profile overlaps home or checkout');
  if (fs.existsSync(profile) && !fs.statSync(profile).isDirectory()) throw new Error('profile must be a directory');
  const bin = path.join(client, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
  const runtime = path.join(profile, 'fusion-restart');
  return { repo, client, main, server, machine, profile, profileMode, defaultProfile, bin,
    runtime, portFile: path.join(profile, 'server.port'), dryRun: Boolean(opts.dryRun),
    database: profileMode === 'default' ? path.join(repo, 'fusion-studio-server', 'data', 'fusion.db') : path.join(profile, 'server-data', 'fusion.db'),
    serverLog: profileMode === 'default' ? path.join(repo, 'fusion-studio-server', 'server-live.log') : path.join(profile, 'server-live.log') };
}
export function assertLocalRuntime(target) {
  fs.accessSync(target.bin, fs.constants.X_OK);
  if (!contains(target.repo, fs.realpathSync(target.bin))) throw new Error('borrowed Electron runtime is excluded');
}
export function assertNoLinks(root, leaf) {
  for (let cursor = leaf; contains(root, cursor); cursor = path.dirname(cursor)) {
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`runtime parent symlink: ${cursor}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (cursor === root) break;
  }
}
export function launchEnvironment(target, temporary, env = process.env) {
  const next = { ...env, FUSION_LOCAL_MACHINE: target.machine, TMPDIR: `${temporary}${path.sep}` };
  delete next.ELECTRON_RUN_AS_NODE;
  delete next.FUSION_APP_PACKAGED;
  delete next.FUSION_RESOURCES_PATH;
  if (target.profileMode === 'default') delete next.FUSION_APP_USER_DATA;
  else next.FUSION_APP_USER_DATA = target.profile;
  return next;
}
