/**
 * Workspace state access.
 *
 * Workspace-owned shell state lives in:
 *   ai/<machine>/System/state/state.json
 *
 * This module intentionally stores only workspace-level shell fields, such as
 * the active view panel. Per-view UI state continues to use the view-state
 * resolver/writer.
 */

const fs = require('fs');
const path = require('path');
const aiPaths = require('./ai-paths');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAllowedViewIds(allowedViewIds) {
  if (!allowedViewIds) return null;
  return allowedViewIds instanceof Set ? allowedViewIds : new Set(allowedViewIds);
}

function sanitizeCurrentPanel(currentPanel, allowedViewIds) {
  if (typeof currentPanel !== 'string' || currentPanel.trim() === '') return undefined;
  const allowed = normalizeAllowedViewIds(allowedViewIds);
  if (allowed && !allowed.has(currentPanel)) return undefined;
  return currentPanel;
}

function stateFileForRepo(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') return null;
  return path.join(aiPaths.getSystemStateRoot(repoPath), 'state.json');
}

function readSystemState(repoPath) {
  const file = stateFileForRepo(repoPath);
  if (!file) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSystemState(repoPath, state) {
  const file = stateFileForRepo(repoPath);
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

function sanitizeState(state, options = {}) {
  if (!isPlainObject(state)) return {};
  const currentPanel = sanitizeCurrentPanel(state.currentPanel, options.allowedViewIds);
  return currentPanel ? { currentPanel } : {};
}

function getWorkspaceStateFromSystem(repoPath, options = {}) {
  const systemState = readSystemState(repoPath);
  const workspaceState = isPlainObject(systemState.workspace) ? systemState.workspace : {};
  return sanitizeState(workspaceState, options);
}

function save(_workspaceId, state, options = {}) {
  const repoPath = options.repoPath;
  if (!repoPath) return;

  const patch = sanitizeState(state, options);
  const systemState = readSystemState(repoPath);
  const workspaceState = isPlainObject(systemState.workspace)
    ? { ...systemState.workspace }
    : {};

  if (patch.currentPanel) {
    workspaceState.currentPanel = patch.currentPanel;
  } else {
    delete workspaceState.currentPanel;
  }

  writeSystemState(repoPath, {
    ...systemState,
    workspace: workspaceState,
  });
}

function get(_workspaceId, options = {}) {
  if (!options.repoPath) return null;
  const state = getWorkspaceStateFromSystem(options.repoPath, options);
  return Object.keys(state).length > 0 ? state : null;
}

function loadAll(workspaces = [], options = {}) {
  const states = {};
  for (const workspace of workspaces) {
    const workspaceId = workspace.id;
    const repoPath = workspace.repoPath || workspace.repo_path;
    if (!workspaceId || !repoPath) continue;
    const state = get(workspaceId, { ...options, repoPath });
    if (state) states[workspaceId] = state;
  }
  return states;
}

module.exports = { loadAll, save, get };
