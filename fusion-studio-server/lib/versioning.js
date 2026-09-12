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

function readGitDirectoryPointer(gitFile) {
  const raw = fs.readFileSync(gitFile, 'utf8').trim();
  const match = raw.match(/^gitdir:\s*(.+)$/i);
  if (!match || !match[1] || match[1].includes('\0')) {
    throw new Error('Invalid Git directory pointer');
  }
  return path.resolve(path.dirname(gitFile), match[1]);
}

function resolveExistingDirectory(candidate, label) {
  let real;
  try {
    real = fs.realpathSync(candidate);
  } catch {
    throw new Error(`${label} is unavailable`);
  }
  if (!fs.statSync(real).isDirectory()) throw new Error(`${label} is not a directory`);
  return real;
}

/**
 * Enumerate the actual repository destinations Git can mutate. Linked
 * worktrees and `git init --separate-git-dir` use a regular `.git` pointer;
 * linked worktree gitdirs can in turn name a separate common directory.
 */
function resolveGitMutationPaths(contentRoot) {
  const root = path.resolve(contentRoot);
  const dotGit = path.join(root, '.git');
  let dotGitStat;
  try {
    dotGitStat = fs.lstatSync(dotGit);
  } catch (error) {
    if (error?.code === 'ENOENT') return [dotGit];
    throw error;
  }

  const gitDirCandidate = dotGitStat.isFile()
    ? readGitDirectoryPointer(dotGit)
    : dotGit;
  const gitDir = resolveExistingDirectory(gitDirCandidate, 'Git directory');
  const commonPointer = path.join(gitDir, 'commondir');
  let commonDir = gitDir;
  try {
    const raw = fs.readFileSync(commonPointer, 'utf8').trim();
    if (!raw || raw.includes('\0')) throw new Error('Invalid Git common directory pointer');
    commonDir = resolveExistingDirectory(path.resolve(gitDir, raw), 'Git common directory');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  return [...new Set([
    dotGit,
    gitDir,
    path.join(gitDir, 'index'),
    path.join(gitDir, 'index.lock'),
    path.join(gitDir, 'HEAD'),
    path.join(gitDir, 'COMMIT_EDITMSG'),
    path.join(gitDir, 'config'),
    path.join(gitDir, 'config.lock'),
    commonDir,
    path.join(commonDir, 'objects'),
    path.join(commonDir, 'refs'),
    path.join(commonDir, 'logs'),
    path.join(commonDir, 'packed-refs'),
    path.join(commonDir, 'packed-refs.lock'),
  ])];
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

module.exports = { ensureRepo, commitIfChanged, resolveGitMutationPaths };
