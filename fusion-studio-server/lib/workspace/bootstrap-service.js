/**
 * bootstrap-service — fill the minimum structure under an existing `ai/` tree.
 *
 * Add Project requires the repo to already contain `/ai`; the controller
 * enforces that before calling bootstrap(). This service may create missing
 * internal folders/files under that existing tree so views render. Chat does
 * not need bootstrap structure (RCC-0095). Idempotent — existing
 * folders/files are left alone. Pure filesystem, no events, no DB.
 */

const fs = require('fs');
const path = require('path');

// RCC-0095: ai/views/chat/threads is no longer bootstrapped — ChatFile
// creates the chat storage parents on demand at first thread write.
const DIRS = [
  'ai/views',
  'ai/system/workspace',
];

const FILES = {
  'ai/system/workspace/views.json': JSON.stringify(
    {
      version: 1,
      sort: 'ranked',
      views: [
        {
          id: 'file-viewer',
          baseViewId: 'file-viewer',
          label: 'Code',
          icon: 'code',
          rank: 0,
          enabled: true,
          source: 'default',
          viewPath: 'ai/views/file-viewer',
        },
      ],
    },
    null,
    2
  ),
};

/**
 * Ensure the minimum structure exists under repoPath/ai. Only creates what's
 * missing below an existing ai/ directory — safe to call repeatedly.
 *
 * @param {string} repoPath - absolute, canonicalized
 */
function bootstrap(repoPath) {
  const aiDir = path.join(repoPath, 'ai');
  if (!fs.existsSync(aiDir) || !fs.statSync(aiDir).isDirectory()) {
    throw new Error('Add Project requires an existing /ai directory');
  }

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
  return fs.existsSync(path.join(repoPath, 'ai', 'system', 'workspace', 'views.json'))
    || fs.existsSync(path.join(repoPath, 'ai', 'views', 'index.json'));
}

module.exports = { bootstrap, isValidWorkspaceRoot };
