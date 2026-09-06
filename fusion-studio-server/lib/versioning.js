/**
 * @module versioning
 * @role Lightweight Git versioning for office-viewer document store
 *
 * Maintains a shadow Git repository inside the office-viewer content directory.
 * Commits are triggered automatically by file saves with commit-worthy reasons
 * (session_end, checkpoint, milestone). A diff guard prevents empty commits.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Run a git command inside contentRoot.
 * @param {string} contentRoot
 * @param {string[]} args
 */
function runGit(contentRoot, args) {
  return execFileAsync('git', ['-C', contentRoot, ...args]);
}

/**
 * Ensure the content directory is a Git repository.
 * If missing, initializes it and sets default user config.
 * If the workspace root has its own .git, auto-adds the content
 * directory to workspace .gitignore to avoid nested repo issues.
 *
 * @param {string} contentRoot — absolute path to office-viewer/content/
 */
async function ensureRepo(contentRoot) {
  const gitDir = path.join(contentRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    await runGit(contentRoot, ['init']);
    await runGit(contentRoot, ['config', 'user.name', 'Fusion Studio']);
    await runGit(contentRoot, ['config', 'user.email', 'fusion@localhost']);
  }

  // Auto-guard: keep outer repo clean if one exists
  const workspaceRoot = findWorkspaceRoot(contentRoot);
  if (!workspaceRoot) return;
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  const line = path.relative(workspaceRoot, contentRoot).split(path.sep).join('/') + '/';

  if (fs.existsSync(path.join(workspaceRoot, '.git'))) {
    let contents = '';
    try {
      contents = fs.readFileSync(gitignorePath, 'utf8');
    } catch {
      // .gitignore may not exist yet
    }
    if (!contents.includes(line)) {
      fs.appendFileSync(
        gitignorePath,
        `\n# Fusion Studio document versions\n${line}\n`
      );
    }
  }
}

function findWorkspaceRoot(startPath) {
  let current = path.resolve(startPath);
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    current = path.dirname(current);
  }
  return null;
}

/**
 * Stage a file and commit it if there are changes compared to HEAD.
 * Silently skipped if the file has no changes.
 *
 * @param {string} contentRoot — absolute path to office-viewer/content/
 * @param {string} relativePath — path relative to contentRoot, e.g. "002-SPECs/roadmap.md"
 * @param {string} message — commit message
 */
async function commitIfChanged(contentRoot, relativePath, message) {
  await ensureRepo(contentRoot);

  // Stage the file
  await runGit(contentRoot, ['add', '--', relativePath]);

  // Diff guard: skip if nothing changed
  let hasChanges = false;
  try {
    await runGit(contentRoot, ['diff', '--cached', '--quiet']);
  } catch (err) {
    if (err.code === 1) {
      hasChanges = true;
    } else {
      throw err;
    }
  }

  if (!hasChanges) {
    return false;
  }

  // Commit
  await runGit(contentRoot, ['commit', '-m', message, '--quiet']);
  return true;
}

module.exports = { ensureRepo, commitIfChanged };
