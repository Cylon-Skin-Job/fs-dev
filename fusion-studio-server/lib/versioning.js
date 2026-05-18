/**
 * @module versioning
 * @role Lightweight Git versioning for office-viewer document store
 *
 * Maintains a shadow Git repository inside the office-viewer content directory.
 * Commits are triggered automatically by file saves with commit-worthy reasons
 * (session_end, checkpoint, milestone). A diff guard prevents empty commits.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Run a git command inside contentRoot.
 * @param {string} contentRoot
 * @param {string[]} args
 */
function runGit(contentRoot, args) {
  // Quote arguments that contain spaces or quotes
  const quoted = args.map((arg) => {
    if (/[\s"']/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  });
  const cmd = `git -C "${contentRoot}" ${quoted.join(' ')}`;
  return execAsync(cmd);
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
  const workspaceRoot = path.resolve(contentRoot, '..', '..', '..', '..');
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  const line = 'ai/views/office-viewer/content/';

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

/**
 * Stage a file and commit it if there are changes compared to HEAD.
 * Silently skipped if the file has no changes.
 *
 * @param {string} contentRoot — absolute path to office-viewer/content/
 * @param {string} relativePath — path relative to contentRoot, e.g. "specs/roadmap.md"
 * @param {string} message — commit message
 */
async function commitIfChanged(contentRoot, relativePath, message) {
  await ensureRepo(contentRoot);

  // Stage the file
  await runGit(contentRoot, ['add', relativePath]);

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
    return;
  }

  // Commit
  await runGit(contentRoot, ['commit', '-m', message, '--quiet']);
}

module.exports = { ensureRepo, commitIfChanged };
