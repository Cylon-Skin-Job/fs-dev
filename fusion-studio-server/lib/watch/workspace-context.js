/**
 * Workspace file event context builders.
 *
 * Pure utility — no watcher logic, no imports from core.js.
 * Moved verbatim from lib/watcher/index.js.
 */

const fs = require('fs');
const path = require('path');

/**
 * Check whether a relative file path matches any exclusion pattern.
 */
function isExcluded(filePath, excludes) {
  for (const pattern of excludes) {
    if (pattern.startsWith('*')) {
      if (filePath.endsWith(pattern.slice(1))) return true;
    } else if (pattern.includes('*')) {
      const [prefix, suffix] = pattern.split('*');
      if (filePath.includes(prefix) && filePath.includes(suffix)) return true;
    } else {
      if (filePath.includes(pattern)) return true;
    }
  }
  return false;
}

/**
 * Stat a directory: count files and folders (non-recursive, one level).
 * Returns { files: 0, folders: 0 } on error.
 */
function statDir(absoluteDir) {
  try {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    let files = 0, folders = 0;
    for (const e of entries) {
      if (e.isDirectory()) folders++;
      else files++;
    }
    return { files, folders };
  } catch {
    return { files: 0, folders: 0 };
  }
}

/**
 * Count lines, words, and tokens for a file.
 * Uses gpt-tokenizer (cl100k_base) for real token counts.
 * Returns { lines: 0, words: 0, tokens: 0, size: 0 } for dirs or on error.
 */
function statFile(absolutePath) {
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) return { lines: 0, words: 0, tokens: 0, size: 0 };

    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(Boolean).length;

    const { countTokens } = require('../tokenizer');
    const tokens = countTokens(content);

    return { lines, words, tokens, size: stat.size };
  } catch {
    return { lines: 0, words: 0, tokens: 0, size: 0 };
  }
}

/**
 * Build the context object that accompanies every event.
 *
 * @param {string} projectRoot
 * @param {string} filePath - Relative path from project root
 * @param {string} event - 'create' | 'delete' | 'modify' | 'rename'
 * @returns {{ parentDir, type, ext, basename, delta, parentStats, fileStats }}
 */
function buildContext(projectRoot, filePath, event) {
  const parentDir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const ext = path.extname(filePath) || null;
  const absolutePath = path.join(projectRoot, filePath);
  const absoluteParent = path.join(projectRoot, parentDir);

  // Determine if this is a file or directory
  let type = 'file';
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) type = 'directory';
  } catch {
    type = 'file';
  }

  // Delta: +1 create, -1 delete, 0 modify/rename
  const deltaMap = { create: 1, delete: -1, modify: 0, rename: 0 };
  const delta = deltaMap[event] || 0;

  // Parent folder stats (current snapshot)
  const parentStats = statDir(absoluteParent);

  // File stats: lines, words, tokens, size (only for files that still exist)
  const fileStats = (event !== 'delete' && type === 'file')
    ? statFile(absolutePath)
    : { lines: 0, words: 0, tokens: 0, size: 0 };

  return { parentDir, type, ext, basename, delta, parentStats, fileStats };
}

module.exports = { isExcluded, buildContext, statDir, statFile };
