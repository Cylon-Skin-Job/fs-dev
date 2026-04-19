/**
 * bootstrap-service — scaffold the minimum `ai/` tree for a new workspace.
 *
 * When a repo is added via `workspace:add_requested` and doesn't already have
 * the expected layout, we create the bare minimum so views render and chat
 * has somewhere to write threads. Idempotent — existing folders/files are
 * left alone. Pure filesystem, no events, no DB.
 */

const fs = require('fs');
const path = require('path');

const DIRS = [
  'ai',
  'ai/views',
  'ai/views/chat',
  'ai/views/chat/threads',
];

const FILES = {
  'ai/views/index.json': JSON.stringify(
    {
      views: [
        { id: 'code-viewer', label: 'Code', icon: 'code', rank: 0 },
      ],
    },
    null,
    2
  ),
};

/**
 * Ensure the minimum ai/ structure exists at repoPath. Only creates what's
 * missing — safe to call repeatedly.
 *
 * @param {string} repoPath - absolute, canonicalized
 */
function bootstrap(repoPath) {
  for (const dir of DIRS) {
    const full = path.join(repoPath, dir);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
    }
  }
  for (const [rel, content] of Object.entries(FILES)) {
    const full = path.join(repoPath, rel);
    if (!fs.existsSync(full)) {
      fs.writeFileSync(full, content, 'utf8');
    }
  }
}

/**
 * Does this repo have the minimum viable workspace structure? Used by the
 * launch validator to decide whether to cull a stored workspace.
 *
 * @param {string} repoPath
 * @returns {boolean}
 */
function isValidWorkspaceRoot(repoPath) {
  return fs.existsSync(path.join(repoPath, 'ai', 'views', 'index.json'));
}

module.exports = { bootstrap, isValidWorkspaceRoot };
