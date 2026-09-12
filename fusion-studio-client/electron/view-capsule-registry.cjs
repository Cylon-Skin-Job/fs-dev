'use strict';

const fsPromises = require('node:fs').promises;
const path = require('node:path');

const MAX_VIEW_CAPSULES = 256;
const VIEW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MACHINE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isCanonicalViewId(value) {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 128 && VIEW_ID_PATTERN.test(value);
}

function isCanonicalMachineIdentity(value) {
  return typeof value === 'string' && value !== '.' && value !== '..'
    && Buffer.byteLength(value, 'utf8') <= 128 && MACHINE_ID_PATTERN.test(value);
}

function isFolderBasename(value) {
  return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..'
    && Buffer.byteLength(value, 'utf8') <= 255 && path.basename(value) === value
    && !value.includes('/') && !value.includes('\\') && !value.includes('\0');
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function parseYamlScalar(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      if (typeof decoded === 'string') return decoded;
    } catch {
      // Match the server's bounded fallback for manually authored strings.
    }
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const signedRadix = value.match(/^([+-]?)(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+)$/);
  if (signedRadix) {
    const sign = signedRadix[1] === '-' ? -1 : 1;
    return sign * Number(signedRadix[2].replace(/_/g, ''));
  }
  if (/^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?$/.test(value)) {
    return Number(value.replace(/_/g, ''));
  }
  return value;
}

function parseStrictSimpleYaml(source) {
  const result = Object.create(null);
  const stack = [{ indent: -1, childIndent: null, value: result }];
  for (const rawLine of String(source || '').split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indentation = rawLine.match(/^\s*/)[0];
    if (indentation.includes('\t')) return null;
    const indent = indentation.length;
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key) return null;
    const rawValue = line.slice(separator + 1).trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parentFrame = stack[stack.length - 1];
    if (parentFrame.childIndent === null) parentFrame.childIndent = indent;
    if (parentFrame.childIndent !== indent || Object.hasOwn(parentFrame.value, key)) return null;
    if (rawValue === '') {
      const child = Object.create(null);
      parentFrame.value[key] = child;
      stack.push({ indent, childIndent: null, value: child });
    } else {
      parentFrame.value[key] = parseYamlScalar(rawValue);
    }
  }
  return result;
}

function parseManifestViewId(source) {
  if (typeof source !== 'string') return null;
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const parsed = parseStrictSimpleYaml(match[1]);
  if (!parsed || !Object.hasOwn(parsed, 'metadata')) return null;
  const metadata = parsed.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
    || !Object.hasOwn(metadata, 'view-id')) return null;
  return isCanonicalViewId(metadata['view-id']) ? metadata['view-id'] : null;
}

function parseViewCapsulesProjection(value) {
  if (!hasExactKeys(value, ['entries', 'machineIdentity', 'version', 'workspaceId']) || value.version !== 1) return null;
  if (typeof value.workspaceId !== 'string' || value.workspaceId.length === 0
    || Buffer.byteLength(value.workspaceId, 'utf8') > 256 || /[\u0000-\u001f\u007f]/.test(value.workspaceId)
    || !isCanonicalMachineIdentity(value.machineIdentity) || !Array.isArray(value.entries)
    || value.entries.length > MAX_VIEW_CAPSULES) return null;
  const viewIds = new Set();
  const folderNames = new Set();
  const entries = [];
  for (const entry of value.entries) {
    if (!hasExactKeys(entry, ['folderName', 'viewId']) || !isCanonicalViewId(entry.viewId)
      || !isFolderBasename(entry.folderName) || viewIds.has(entry.viewId) || folderNames.has(entry.folderName)) return null;
    viewIds.add(entry.viewId);
    folderNames.add(entry.folderName);
    entries.push(Object.freeze({ viewId: entry.viewId, folderName: entry.folderName }));
  }
  return Object.freeze({ version: 1, workspaceId: value.workspaceId, machineIdentity: value.machineIdentity, entries: Object.freeze(entries) });
}

function commitWorkspaceRootForBindingResult(acceptedBinding, currentBinding, setWorkspaceRoot) {
  const acceptedIsCurrent = Boolean(acceptedBinding && currentBinding
    && acceptedBinding.workspaceId === currentBinding.workspaceId
    && acceptedBinding.repoPath === currentBinding.repoPath);
  if (acceptedIsCurrent) {
    setWorkspaceRoot(acceptedBinding.repoPath);
    return true;
  }
  // A superseded async binding result must not clear a newer binding's
  // workspace-scoped authorities. A current clear or malformed binding does.
  if (!currentBinding) setWorkspaceRoot(null);
  return false;
}

function createViewCapsuleRegistryOwner({ getRuntimeGeneration, fs = fsPromises }) {
  let workspaceBinding = null;
  let bindingVersion = 0;
  let projectionVersion = 0;
  let current = null;
  function clearCurrent() { current = null; }
  function clear() {
    projectionVersion += 1;
    clearCurrent();
  }

  function isCurrentGeneration(expectedGeneration) {
    return typeof expectedGeneration === 'string'
      && expectedGeneration.length > 0
      && getRuntimeGeneration() === expectedGeneration;
  }

  function retire() {
    bindingVersion += 1;
    workspaceBinding = null;
    clear();
  }

  function clearForGeneration(expectedGeneration) {
    if (!isCurrentGeneration(expectedGeneration)) return false;
    clear();
    return true;
  }

  function clearWorkspaceBindingForGeneration(expectedGeneration) {
    if (!isCurrentGeneration(expectedGeneration)) return false;
    bindingVersion += 1;
    workspaceBinding = null;
    clear();
    return true;
  }

  async function setWorkspaceBinding(value, expectedGeneration) {
    if (!isCurrentGeneration(expectedGeneration)) return null;
    bindingVersion += 1;
    const version = bindingVersion;
    clear();
    if (!hasExactKeys(value, ['repoPath', 'workspaceId'])) { workspaceBinding = null; return null; }
    if (value.workspaceId === null && value.repoPath === null) { workspaceBinding = null; return null; }
    if (typeof value.workspaceId !== 'string' || !value.workspaceId || typeof value.repoPath !== 'string' || !path.isAbsolute(value.repoPath)) {
      workspaceBinding = null; return null;
    }
    const declaredRoot = path.resolve(value.repoPath);
    try {
      const realRoot = path.resolve(await fs.realpath(declaredRoot));
      const stat = await fs.lstat(declaredRoot);
      if (version !== bindingVersion || !isCurrentGeneration(expectedGeneration)
        || realRoot !== declaredRoot || stat.isSymbolicLink() || !stat.isDirectory()) return null;
      workspaceBinding = Object.freeze({
        workspaceId: value.workspaceId,
        repoPath: realRoot,
        runtimeGeneration: expectedGeneration,
      });
      return Object.freeze({ workspaceId: value.workspaceId, repoPath: realRoot });
    } catch {
      if (version === bindingVersion) workspaceBinding = null;
      return null;
    }
  }

  async function replace(value, expectedGeneration) {
    if (!isCurrentGeneration(expectedGeneration)) return false;
    projectionVersion += 1;
    const operationVersion = projectionVersion;
    const parsed = parseViewCapsulesProjection(value);
    const binding = workspaceBinding;
    const version = bindingVersion;
    if (!parsed || !binding || binding.runtimeGeneration !== expectedGeneration
      || parsed.workspaceId !== binding.workspaceId) {
      clearCurrent(); return false;
    }
    try {
      const declaredViewsRoot = path.join(binding.repoPath, 'ai', parsed.machineIdentity, 'System', 'Views');
      const realViewsRoot = path.resolve(await fs.realpath(declaredViewsRoot));
      const viewsStat = await fs.lstat(declaredViewsRoot);
      if (viewsStat.isSymbolicLink() || !viewsStat.isDirectory() || !isInside(binding.repoPath, realViewsRoot)) throw new Error('invalid views root');
      const capsules = new Map();
      for (const entry of parsed.entries) {
        const declaredCapsule = path.join(declaredViewsRoot, entry.folderName);
        const capsuleStat = await fs.lstat(declaredCapsule);
        const realCapsule = path.resolve(await fs.realpath(declaredCapsule));
        if (capsuleStat.isSymbolicLink() || !capsuleStat.isDirectory() || !isInside(realViewsRoot, realCapsule)) throw new Error('invalid capsule');
        const manifestPath = path.join(realCapsule, 'manifest.md');
        const manifestStat = await fs.lstat(manifestPath);
        if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) throw new Error('invalid manifest');
        if (parseManifestViewId(await fs.readFile(manifestPath, 'utf8')) !== entry.viewId) throw new Error('manifest mismatch');
        capsules.set(entry.viewId, realCapsule);
      }
      if (operationVersion !== projectionVersion
        || version !== bindingVersion || workspaceBinding !== binding
        || !isCurrentGeneration(expectedGeneration)) throw new Error('stale projection');
      current = Object.freeze({
        projection: parsed,
        workspaceRoot: binding.repoPath,
        viewsRoot: realViewsRoot,
        runtimeGeneration: expectedGeneration,
        capsules,
      });
      return true;
    } catch {
      if (operationVersion === projectionVersion
        && isCurrentGeneration(expectedGeneration)
        && version === bindingVersion
        && workspaceBinding === binding) clearCurrent();
      return false;
    }
  }

  function getCurrent() {
    const generation = getRuntimeGeneration();
    if (!current || current.runtimeGeneration !== generation) { clear(); return null; }
    return current;
  }
  function getWorkspaceBinding() {
    if (!workspaceBinding || !isCurrentGeneration(workspaceBinding.runtimeGeneration)) return null;
    return Object.freeze({ workspaceId: workspaceBinding.workspaceId, repoPath: workspaceBinding.repoPath });
  }
  return Object.freeze({
    setWorkspaceBinding,
    replace,
    clear,
    clearForGeneration,
    clearWorkspaceBindingForGeneration,
    retire,
    getCurrent,
    getWorkspaceBinding,
  });
}

module.exports = {
  MAX_VIEW_CAPSULES,
  parseManifestViewId,
  parseViewCapsulesProjection,
  createViewCapsuleRegistryOwner,
  commitWorkspaceRootForBindingResult,
};
