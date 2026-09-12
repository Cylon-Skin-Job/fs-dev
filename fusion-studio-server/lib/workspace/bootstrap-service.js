/**
 * bootstrap-service — fill the minimum V2 structure under an existing `ai/` tree.
 *
 * Add Project requires the repo to already contain `/ai`; the controller
 * enforces that before calling bootstrap(). This service may create missing
 * internal folders/files under that existing tree so views render. Chat does
 * not need bootstrap structure (RCC-0095). Idempotent — existing
 * folders/files are left alone. Pure filesystem, no events, no DB.
 */

const fs = require('fs');
const path = require('path');

const aiPaths = require('./ai-paths');
const { acquireViewReadinessLease } = require('../views/readiness-runtime');
const { ViewRelocationError } = require('../views/relocation-errors');

/**
 * Ensure the minimum structure exists under repoPath/ai. Only creates what's
 * missing below an existing ai/ directory — safe to call repeatedly.
 *
 * @param {string} repoPath - absolute, canonicalized
 */
function bootstrap(repoPath) {
  const lease = acquireViewReadinessLease({ projectRoot: repoPath });
  try {
    const expectedViewsRoot = path.resolve(aiPaths.getMachineViewsRoot(repoPath));
    if (typeof lease.viewsRoot !== 'string' || path.resolve(lease.viewsRoot) !== expectedViewsRoot) {
      throw new ViewRelocationError('view_registry_unavailable', undefined, { journalFailure: false });
    }
    const result = bootstrapUnchecked(repoPath);
    return result;
  } finally {
    lease.release();
  }
}

function bootstrapUnchecked(repoPath) {
  const aiDir = path.join(repoPath, 'ai');
  if (!fs.existsSync(aiDir) || !fs.statSync(aiDir).isDirectory()) {
    throw new Error('Add Project requires an existing /ai directory');
  }

  const machineRoot = aiPaths.getMachineAiRoot(repoPath);
  for (const full of [
    aiPaths.getMachineViewsRoot(repoPath),
    path.join(machineRoot, 'System', 'config'),
    path.join(machineRoot, 'System', 'state'),
    path.join(machineRoot, 'System', 'styles'),
    path.join(machineRoot, 'Data'),
  ]) {
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  }
}

/**
 * Does this repo have the minimum viable workspace structure? Used by the
 * launch availability audit and active workspace restore path.
 *
 * @param {string} repoPath
 * @returns {boolean}
 */
function isValidWorkspaceRoot(repoPath) {
  const aiDir = path.join(repoPath, 'ai');
  try {
    const hasV2Views = fs.existsSync(aiPaths.getMachineViewsRoot(repoPath));
    if (hasV2Views) return true;
    return fs.existsSync(path.join(aiDir, 'views')) ||
      fs.existsSync(path.join(aiDir, 'system', 'workspace', 'views.json'));
  } catch {
    return false;
  }
}

module.exports = { bootstrap, isValidWorkspaceRoot };
