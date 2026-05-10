/**
 * Binary locator — filesystem-catalog lookup for CLI executables.
 *
 * Replaces `which <name>` for harness install-status probing. `which`
 * depends on the spawning process's PATH, which differs between shell
 * and launchd/daemon contexts. This walks a fixed catalog of
 * known-good install dirs (nvm, volta, npm prefixes, homebrew, etc.)
 * and returns the first executable match.
 *
 * Per-process cache: once a binary is resolved (or confirmed missing),
 * the result is memoized. Install state is considered stable for the
 * lifetime of the server process.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOME = os.homedir();
const IS_WINDOWS = os.platform() === 'win32';

const STATIC_DIRS = [
  path.join(HOME, '.volta', 'bin'),
  path.join(HOME, '.npm-global', 'bin'),
  path.join(HOME, '.yarn', 'bin'),
  path.join(HOME, '.bun', 'bin'),
  path.join(HOME, '.local', 'bin'),
  path.join(HOME, '.cargo', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
];

/** @type {Map<string, string|null>} */
const cache = new Map();

/** @type {string[]|null} */
let cachedDynamicDirs = null;

function isExecutable(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return false;
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function nvmBinDirs() {
  const root = path.join(HOME, '.nvm', 'versions', 'node');
  try {
    return fs
      .readdirSync(root)
      .map((v) => path.join(root, v, 'bin'))
      .filter((d) => {
        try { return fs.statSync(d).isDirectory(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

function dynamicDirs() {
  if (cachedDynamicDirs) return cachedDynamicDirs;
  const dirs = [];

  // npm prefix -g
  try {
    const r = spawnSync('npm', ['prefix', '-g'], { encoding: 'utf8', timeout: 1500 });
    const prefix = r.stdout && r.stdout.trim();
    if (prefix) dirs.push(path.join(prefix, 'bin'));
  } catch { /* npm unavailable */ }

  // brew --prefix
  try {
    const r = spawnSync('brew', ['--prefix'], { encoding: 'utf8', timeout: 1500 });
    const prefix = r.stdout && r.stdout.trim();
    if (prefix) dirs.push(path.join(prefix, 'bin'));
  } catch { /* brew unavailable */ }

  cachedDynamicDirs = dirs;
  return dirs;
}

/**
 * Find an absolute path to the named binary in the known install catalog.
 * Returns null on no match, including on Windows (fall back to `which`).
 *
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function findBinary(name) {
  if (!name) return null;
  if (IS_WINDOWS) return null;
  if (cache.has(name)) return cache.get(name);

  const candidates = [...nvmBinDirs(), ...STATIC_DIRS, ...dynamicDirs()];
  for (const dir of candidates) {
    const full = path.join(dir, name);
    if (isExecutable(full)) {
      cache.set(name, full);
      return full;
    }
  }
  cache.set(name, null);
  return null;
}

/** Clear the cache — test hook. Not used at runtime. */
function _resetCache() {
  cache.clear();
  cachedDynamicDirs = null;
}

module.exports = { findBinary, _resetCache };
