/**
 * path-service — exact operational paths plus stable dedup comparison keys.
 *
 * Resolve symlinks + ../ segments while keeping the filesystem's exact path
 * spelling for runtime use. Duplicate detection gets a separate comparison
 * key so macOS case-folding never leaks into paths sent to tools.
 *
 * Pure — no events, no DB, no bus. Throws if the path doesn't exist on disk.
 */

const fs = require('fs');
const path = require('path');

function restoreFilesystemCase(resolvedPath) {
  if (process.platform !== 'darwin') return resolvedPath;

  const parsed = path.parse(resolvedPath);
  const segments = resolvedPath.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;

  for (const segment of segments) {
    let actualSegment = segment;
    try {
      const entries = fs.readdirSync(current);
      actualSegment = entries.find((entry) => entry === segment)
        || entries.find((entry) => entry.toLowerCase() === segment.toLowerCase())
        || segment;
    } catch {
      actualSegment = segment;
    }
    current = path.join(current, actualSegment);
  }

  return current;
}

/**
 * @param {string} rawPath - user-supplied absolute or relative path
 * @returns {string} canonicalized absolute path
 * @throws {Error} if the path doesn't exist on disk (realpath fails)
 */
function canonicalize(rawPath) {
  return restoreFilesystemCase(fs.realpathSync(path.resolve(rawPath)));
}

/**
 * @param {string} canonicalPath - exact operational path
 * @returns {string} stable key for workspace deduplication
 */
function comparisonKey(canonicalPath) {
  const value = String(canonicalPath || '');
  return process.platform === 'darwin' ? value.toLowerCase() : value;
}

module.exports = { canonicalize, comparisonKey };
