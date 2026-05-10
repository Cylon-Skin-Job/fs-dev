/**
 * path-service — canonicalize repo paths for dedup comparison.
 *
 * One job: resolve symlinks + ../ segments and, on darwin's case-insensitive
 * filesystem, lowercase the result so two equivalent paths land on the same
 * key. Used by registry lookups and by the workspace controller when
 * accepting `workspace:add_requested` events.
 *
 * Pure — no events, no DB, no bus. Throws if the path doesn't exist on disk.
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {string} rawPath - user-supplied absolute or relative path
 * @returns {string} canonicalized absolute path
 * @throws {Error} if the path doesn't exist on disk (realpath fails)
 */
function canonicalize(rawPath) {
  const resolved = fs.realpathSync(path.resolve(rawPath));
  return process.platform === 'darwin' ? resolved.toLowerCase() : resolved;
}

module.exports = { canonicalize };
