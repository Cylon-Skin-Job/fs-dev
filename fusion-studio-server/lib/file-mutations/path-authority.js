'use strict';

const fs = require('fs');
const path = require('path');
const registryService = require('../workspace/registry-service');
const { getAuthoritativePanelPath } = require('../views/panel-paths');
const { normalizeCanonicalPath } = require('./provenance-values');

class PathAuthorityError extends Error {
  constructor(message, code = 'path_not_allowed') {
    super(message);
    this.name = 'PathAuthorityError';
    this.code = code;
  }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function fingerprint(stat) {
  return Object.freeze({
    dev: String(stat.dev),
    ino: String(stat.ino),
    size: stat.size,
    birthtimeMs: Number.isFinite(stat.birthtimeMs) && stat.birthtimeMs >= 0
      ? Math.trunc(stat.birthtimeMs)
      : null,
  });
}

function toggleFirstAsciiLetter(value) {
  const index = value.search(/[A-Za-z]/u);
  if (index < 0) return null;
  const unit = value[index];
  const toggled = unit === unit.toLowerCase() ? unit.toUpperCase() : unit.toLowerCase();
  return `${value.slice(0, index)}${toggled}${value.slice(index + 1)}`;
}

async function detectsCaseInsensitivePath(candidate, candidateStat, fsPromises) {
  let current = candidate;
  let currentStat = candidateStat;
  for (;;) {
    const parent = path.dirname(current);
    if (parent === current) return false;
    const toggledName = toggleFirstAsciiLetter(path.basename(current));
    if (toggledName) {
      try {
        const aliasStat = await fsPromises.lstat(path.join(parent, toggledName));
        return String(aliasStat.dev) === String(currentStat.dev)
          && String(aliasStat.ino) === String(currentStat.ino);
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    }
    current = parent;
    currentStat = await fsPromises.lstat(current);
  }
}

function createPathAuthority({
  getWorkspaceById = registryService.getById,
  resolvePanelRoot = getAuthoritativePanelPath,
  fsPromises = fs.promises,
} = {}) {
  async function getWorkspace(workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);
    const workspaceRoot = workspace?.repoPath || workspace?.repo_path;
    if (!workspace || typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot)) {
      throw new PathAuthorityError('Workspace is unavailable.');
    }
    let workspaceReal;
    try {
      workspaceReal = await fsPromises.realpath(workspaceRoot);
    } catch (_error) {
      throw new PathAuthorityError('Workspace is unavailable.');
    }
    return { workspace, workspaceRoot: path.resolve(workspaceRoot), workspaceReal };
  }

  async function resolve({ workspaceId, panel, ingressPath }) {
    normalizeCanonicalPath(ingressPath, 'path');
    const { workspaceRoot, workspaceReal } = await getWorkspace(workspaceId);
    let declaredPanelRoot;
    try {
      declaredPanelRoot = resolvePanelRoot(workspaceRoot, panel);
    } catch (_error) {
      throw new PathAuthorityError('Panel path is not allowed.');
    }
    if (typeof declaredPanelRoot !== 'string' || !path.isAbsolute(declaredPanelRoot)) {
      throw new PathAuthorityError('Panel path is not allowed.');
    }
    let panelReal;
    try {
      panelReal = await fsPromises.realpath(declaredPanelRoot);
    } catch (_error) {
      throw new PathAuthorityError('Panel path is not allowed.');
    }
    if (!isInside(workspaceReal, panelReal)) throw new PathAuthorityError('Panel root leaves the workspace.');

    const logicalTarget = path.resolve(declaredPanelRoot, ...ingressPath.split('/'));
    if (!isInside(path.resolve(declaredPanelRoot), logicalTarget)) {
      throw new PathAuthorityError('Path leaves the panel root.');
    }
    const parentLogical = path.dirname(logicalTarget);
    let parentReal;
    try {
      parentReal = await fsPromises.realpath(parentLogical);
    } catch (_error) {
      throw new PathAuthorityError('Target parent is unavailable.');
    }
    if (!isInside(workspaceReal, parentReal) || !isInside(panelReal, parentReal)) {
      throw new PathAuthorityError('Resolved parent leaves its authority root.');
    }
    let parentStat;
    try {
      parentStat = await fsPromises.lstat(parentReal);
    } catch (_error) {
      throw new PathAuthorityError('Target parent cannot be inspected.');
    }
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      throw new PathAuthorityError('Target parent is not an authorized directory.');
    }
    let caseInsensitive;
    try {
      caseInsensitive = await detectsCaseInsensitivePath(parentReal, parentStat, fsPromises);
    } catch (_error) {
      throw new PathAuthorityError('Target parent filesystem semantics are unavailable.');
    }
    let targetPath = path.join(parentReal, path.basename(logicalTarget));
    let targetLstat = null;
    try {
      targetLstat = await fsPromises.lstat(targetPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw new PathAuthorityError('Target cannot be inspected.');
    }
    if (targetLstat?.isSymbolicLink()) throw new PathAuthorityError('Symbolic-link targets are not supported.');
    if (targetLstat && !targetLstat.isFile()) throw new PathAuthorityError('Target is not a regular file.');
    if (targetLstat) {
      let finalReal;
      let finalStat;
      try {
        // On case-insensitive filesystems realpath supplies the directory-entry
        // spelling, so case aliases converge before mutex/resource identity.
        finalReal = await fsPromises.realpath(targetPath);
        finalStat = await fsPromises.lstat(finalReal);
      } catch (_error) {
        throw new PathAuthorityError('Target identity changed during resolution.');
      }
      if (
        !isInside(workspaceReal, finalReal)
        || !isInside(panelReal, finalReal)
        || finalStat.isSymbolicLink()
        || !finalStat.isFile()
        || String(finalStat.dev) !== String(targetLstat.dev)
        || String(finalStat.ino) !== String(targetLstat.ino)
      ) throw new PathAuthorityError('Target identity changed during resolution.');
      targetPath = finalReal;
      targetLstat = finalStat;
    }
    const canonicalNative = path.relative(workspaceReal, targetPath);
    const canonicalPath = normalizeCanonicalPath(canonicalNative.split(path.sep).join('/'));
    const canonicalParent = path.posix.dirname(canonicalPath);
    const targetFingerprint = targetLstat ? fingerprint(targetLstat) : null;
    return Object.freeze({
      workspaceRoot,
      workspaceReal,
      panelRoot: path.resolve(declaredPanelRoot),
      panelReal,
      parentReal,
      parentFingerprint: fingerprint(parentStat),
      targetPath,
      canonicalPath,
      // Do not approximate filesystem Unicode/case equivalence in JavaScript.
      // On case-insensitive volumes all saves in one physical parent share a
      // conservative lock; queued aliases then re-resolve the winning entry.
      lockPath: caseInsensitive ? `${canonicalParent}\u0000case-insensitive-parent` : canonicalPath,
      caseInsensitive,
      exists: Boolean(targetLstat),
      fingerprint: targetFingerprint,
    });
  }

  async function resolveCanonical({ workspaceId, canonicalPath }) {
    normalizeCanonicalPath(canonicalPath);
    const { workspaceRoot, workspaceReal } = await getWorkspace(workspaceId);
    const logicalTarget = path.resolve(workspaceRoot, ...canonicalPath.split('/'));
    if (!isInside(workspaceRoot, logicalTarget)) throw new PathAuthorityError('Canonical path leaves the workspace.');
    let parentReal;
    try {
      parentReal = await fsPromises.realpath(path.dirname(logicalTarget));
    } catch (_error) {
      throw new PathAuthorityError('Canonical parent is unavailable.');
    }
    if (!isInside(workspaceReal, parentReal)) throw new PathAuthorityError('Canonical parent leaves the workspace.');
    let parentStat;
    try {
      parentStat = await fsPromises.lstat(parentReal);
    } catch (_error) {
      throw new PathAuthorityError('Canonical parent cannot be inspected.');
    }
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      throw new PathAuthorityError('Canonical parent is not an authorized directory.');
    }
    return Object.freeze({
      workspaceRoot,
      workspaceReal,
      panelReal: workspaceReal,
      parentReal,
      parentFingerprint: fingerprint(parentStat),
      targetPath: path.join(parentReal, path.basename(logicalTarget)),
      canonicalPath,
    });
  }

  return Object.freeze({ resolve, resolveCanonical });
}

module.exports = { PathAuthorityError, createPathAuthority, fingerprint, isInside };
