'use strict';

const fs = require('fs');
const path = require('path');
const registryService = require('../workspace/registry-service');
const { getAuthoritativePanelPath } = require('../views/panel-paths');
const { isInside } = require('../file-mutations/path-authority');
const {
  assertNonemptyBoundedString,
  normalizeCanonicalPath,
  normalizeFolderPrefix,
} = require('../file-mutations/provenance-values');

const SELECTOR_PATH_CODES = new Set(['ENOENT', 'ENOTDIR', 'ELOOP']);

class ProvenanceQuerySelectorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProvenanceQuerySelectorError';
    this.code = 'invalid_selector';
  }
}

function invalidSelector(message) {
  return new ProvenanceQuerySelectorError(message);
}

function normalizeSelector(normalize) {
  try {
    return normalize();
  } catch (error) {
    if (error instanceof TypeError) throw invalidSelector(error.message);
    throw error;
  }
}

async function realpathSelector(fsPromises, target, label) {
  try {
    return await fsPromises.realpath(target);
  } catch (error) {
    if (SELECTOR_PATH_CODES.has(error?.code)) throw invalidSelector(`${label} is not available`);
    throw error;
  }
}

function toCanonical(workspaceReal, targetReal, label) {
  const relative = path.relative(workspaceReal, targetReal).split(path.sep).join('/');
  if (relative === '') return '';
  return normalizeSelector(() => normalizeCanonicalPath(relative, label));
}

function createProvenanceQueryPathNormalizer({
  getWorkspaceById = registryService.getById,
  resolvePanelRoot = (workspaceRoot, panel) => getAuthoritativePanelPath(
    workspaceRoot,
    panel,
    { strictFilesystemErrors: true },
  ),
  fsPromises = fs.promises,
} = {}) {
  async function panelContext(workspaceId, panel) {
    normalizeSelector(() => assertNonemptyBoundedString(panel, 128, 'panel'));
    // Registry and workspace-root failures are server-authority failures, not
    // caller selector errors. Leave them untyped so the route reports the
    // fixed query_failed result and diagnostic.
    const workspace = await getWorkspaceById(workspaceId);
    const declaredWorkspaceRoot = workspace?.repoPath || workspace?.repo_path;
    if (typeof declaredWorkspaceRoot !== 'string' || !path.isAbsolute(declaredWorkspaceRoot)) {
      throw new Error('workspace registry authority is unavailable');
    }
    const workspaceReal = await fsPromises.realpath(declaredWorkspaceRoot);
    const declaredPanelRoot = await Promise.resolve(resolvePanelRoot(declaredWorkspaceRoot, panel));
    if (typeof declaredPanelRoot !== 'string' || !path.isAbsolute(declaredPanelRoot)) {
      throw invalidSelector('panel is not recognized');
    }
    const panelReal = await realpathSelector(fsPromises, declaredPanelRoot, 'panel');
    if (!isInside(workspaceReal, panelReal)) throw invalidSelector('panel leaves the workspace');
    return Object.freeze({
      workspaceReal,
      declaredPanelRoot: path.resolve(declaredPanelRoot),
      panelReal,
    });
  }

  async function normalizeExact(context, selectedPath) {
    const normalized = normalizeSelector(() => normalizeCanonicalPath(selectedPath, 'path'));
    const logicalTarget = path.resolve(context.declaredPanelRoot, ...normalized.split('/'));
    if (!isInside(context.declaredPanelRoot, logicalTarget)) {
      throw invalidSelector('path leaves the panel root');
    }
    const parentReal = await realpathSelector(fsPromises, path.dirname(logicalTarget), 'path parent');
    if (!isInside(context.workspaceReal, parentReal) || !isInside(context.panelReal, parentReal)) {
      throw invalidSelector('resolved path parent leaves its authority root');
    }
    const parentStat = await fsPromises.lstat(parentReal);
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      throw invalidSelector('resolved path parent is not an authorized directory');
    }

    const targetPath = path.join(parentReal, path.basename(logicalTarget));
    let targetStat = null;
    try {
      targetStat = await fsPromises.lstat(targetPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        if (SELECTOR_PATH_CODES.has(error?.code)) throw invalidSelector('path is not available');
        throw error;
      }
    }
    if (targetStat?.isSymbolicLink() || (targetStat && !targetStat.isFile())) {
      throw invalidSelector('path is not a regular file selector');
    }
    if (!targetStat) return toCanonical(context.workspaceReal, targetPath, 'path');

    const targetReal = await fsPromises.realpath(targetPath);
    const finalStat = await fsPromises.lstat(targetReal);
    if (
      !isInside(context.workspaceReal, targetReal)
      || !isInside(context.panelReal, targetReal)
      || finalStat.isSymbolicLink()
      || !finalStat.isFile()
      || String(finalStat.dev) !== String(targetStat.dev)
      || String(finalStat.ino) !== String(targetStat.ino)
    ) throw invalidSelector('path identity changed during normalization');
    return toCanonical(context.workspaceReal, targetReal, 'path');
  }

  async function normalizeFolder(context, folderPrefix) {
    const normalized = normalizeSelector(() => normalizeFolderPrefix(folderPrefix));
    if (normalized === '') return toCanonical(context.workspaceReal, context.panelReal, 'folderPrefix');
    const logicalFolder = path.resolve(context.declaredPanelRoot, ...normalized.split('/'));
    if (!isInside(context.declaredPanelRoot, logicalFolder)) {
      throw invalidSelector('folderPrefix leaves the panel root');
    }
    const folderReal = await realpathSelector(fsPromises, logicalFolder, 'folderPrefix');
    if (!isInside(context.workspaceReal, folderReal) || !isInside(context.panelReal, folderReal)) {
      throw invalidSelector('resolved folderPrefix leaves its authority root');
    }
    const folderStat = await fsPromises.lstat(folderReal);
    if (folderStat.isSymbolicLink() || !folderStat.isDirectory()) {
      throw invalidSelector('folderPrefix is not an authorized directory');
    }
    return toCanonical(context.workspaceReal, folderReal, 'folderPrefix');
  }

  async function normalize({ workspaceId, panel, path: selectedPath, folderPrefix }) {
    if (panel == null) {
      return Object.freeze({
        ...(selectedPath == null ? {} : {
          canonicalPath: normalizeSelector(() => normalizeCanonicalPath(selectedPath, 'path')),
        }),
        ...(folderPrefix == null ? {} : {
          folderPrefix: normalizeSelector(() => normalizeFolderPrefix(folderPrefix)),
        }),
      });
    }
    const context = await panelContext(workspaceId, panel);
    return Object.freeze({
      ...(selectedPath == null ? {} : { canonicalPath: await normalizeExact(context, selectedPath) }),
      ...(folderPrefix == null ? {} : { folderPrefix: await normalizeFolder(context, folderPrefix) }),
    });
  }

  return Object.freeze({ normalize });
}

module.exports = {
  ProvenanceQuerySelectorError,
  createProvenanceQueryPathNormalizer,
};
