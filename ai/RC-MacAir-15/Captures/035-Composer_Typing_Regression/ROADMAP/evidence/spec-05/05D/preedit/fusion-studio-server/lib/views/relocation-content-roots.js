'use strict';

const path = require('path');
const fsPromises = require('fs').promises;

const { parseSimpleYaml } = require('./simple-yaml');
const { parseCanonicalViewId, assertUniqueCanonicalViewIds } = require('./view-id');
const {
  MAX_VIEW_CAPSULE_PROJECTION_ENTRIES,
  parseProjectionFolderName,
} = require('./view-capsules-projection');
const { ViewRelocationError } = require('./relocation-errors');
const { isInside } = require('./relocation-inventory');

const TOP_LEVEL_ROOTS = new Set(['Wiki', 'Captures', 'Issues', 'Agents', 'Office', 'Email']);
const FALLBACKS = Object.freeze({
  'capture-viewer': 'Captures',
  'wiki-viewer': 'Wiki',
  'issues-viewer': 'Issues',
  'agents-viewer': 'Agents',
  'office-viewer': 'Office',
  'email-viewer': 'Email',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(code) {
  throw new ViewRelocationError(code);
}

function expandVariables(value, { projectRoot, machineIdentity }) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail('content_root_invalid');
  }
  return value
    .replace(/\$\{machine\}/gu, machineIdentity)
    .replace(/\$\{workspace\}/gu, path.basename(projectRoot));
}

function resolveRelative(base, rawPath, context) {
  const expanded = expandVariables(rawPath, context);
  if (path.isAbsolute(expanded)) fail('content_root_invalid');
  const resolved = path.resolve(base, expanded);
  if (!isInside(base, resolved)) fail('content_root_invalid');
  return resolved;
}

function resolveDeclaredRoot(declaration, context) {
  if (typeof declaration === 'string') {
    const resolved = resolveRelative(context.projectRoot, declaration, context);
    return { external: true, current: resolved, projected: resolved };
  }
  if (!isPlainObject(declaration)) fail('content_root_invalid');
  const type = declaration.type === undefined ? 'workspace-relative' : declaration.type;
  if (typeof type !== 'string') fail('content_root_invalid');

  if (type === 'project-root') {
    return { external: true, current: context.projectRoot, projected: context.projectRoot };
  }
  if (type === 'workspace-relative') {
    const resolved = resolveRelative(context.projectRoot, declaration.path, context);
    return { external: true, current: resolved, projected: resolved };
  }
  if (type === 'machine-relative') {
    const resolved = resolveRelative(context.machineRoot, declaration.path, context);
    return { external: true, current: resolved, projected: resolved };
  }
  if (type === 'absolute') {
    const expanded = expandVariables(declaration.path, context);
    if (!path.isAbsolute(expanded)) fail('content_root_invalid');
    const resolved = path.resolve(expanded);
    return { external: true, current: resolved, projected: resolved };
  }
  if (type === 'selected-folder' && declaration.path != null) {
    const resolved = resolveRelative(context.projectRoot, declaration.path, context);
    return { external: true, current: resolved, projected: resolved };
  }
  if (type === 'view-relative') {
    return {
      external: false,
      current: resolveRelative(context.currentCapsule, declaration.path, context),
      projected: resolveRelative(context.projectedCapsule, declaration.path, context),
    };
  }
  if (
    (type === 'selected-folder' && declaration.path == null)
    || ((type === 'sqlite' || type === 'none') && declaration.path == null)
  ) {
    return {
      external: false,
      current: context.currentCapsule,
      projected: context.projectedCapsule,
    };
  }
  fail('content_root_invalid');
}

function resolveDefaultRoot(content, metadata, viewId, context) {
  const dataSource = typeof content.dataSource === 'string'
    ? content.dataSource
    : metadata['data-source'];
  if (dataSource === 'project-root' || viewId === 'file-viewer') {
    return { external: true, current: context.projectRoot, projected: context.projectRoot };
  }
  const topLevel = TOP_LEVEL_ROOTS.has(dataSource) ? dataSource : FALLBACKS[viewId];
  if (topLevel) {
    const resolved = path.join(context.machineRoot, topLevel);
    return { external: true, current: resolved, projected: resolved };
  }
  return {
    external: false,
    current: context.currentCapsule,
    projected: context.projectedCapsule,
  };
}

async function nearestExistingResolution(candidate, fs, visited = new Set()) {
  const remaining = [];
  let cursor = path.resolve(candidate);
  for (;;) {
    let stat;
    try {
      stat = await fs.lstat(cursor);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') fail('content_root_invalid');
      const parent = path.dirname(cursor);
      if (parent === cursor) fail('content_root_invalid');
      remaining.unshift(path.basename(cursor));
      cursor = parent;
      continue;
    }
    try {
      return path.resolve(await fs.realpath(cursor), ...remaining);
    } catch (error) {
      if (!stat.isSymbolicLink() || !['ENOENT', 'ENOTDIR'].includes(error?.code)) {
        fail('content_root_invalid');
      }
      const linkPath = path.resolve(cursor);
      if (visited.has(linkPath)) fail('content_root_invalid');
      const nextVisited = new Set(visited);
      nextVisited.add(linkPath);
      const target = await fs.readlink(linkPath);
      const projected = path.isAbsolute(target)
        ? path.resolve(target, ...remaining)
        : path.resolve(path.dirname(linkPath), target, ...remaining);
      return nearestExistingResolution(projected, fs, nextVisited);
    }
  }
}

async function validateResolvedRoot(resolved, context, fs) {
  if (resolved.external) {
    for (const candidate of [resolved.current, resolved.projected]) {
      if (isInside(context.sourceRoot, candidate) || isInside(context.destinationRoot, candidate)) {
        fail('relocation_dependent_content_root');
      }
      const physical = await nearestExistingResolution(candidate, fs);
      if (isInside(context.sourceRoot, physical) || isInside(context.destinationRoot, physical)) {
        fail('relocation_dependent_content_root');
      }
    }
    if (path.resolve(resolved.current) !== path.resolve(resolved.projected)) {
      fail('content_root_projection_mismatch');
    }
    return;
  }
  if (!isInside(context.currentCapsule, resolved.current)) fail('content_root_invalid');
  if (!isInside(context.projectedCapsule, resolved.projected)) fail('content_root_invalid');
  const currentRelative = path.relative(context.currentCapsule, resolved.current);
  const projectedRelative = path.relative(context.projectedCapsule, resolved.projected);
  if (currentRelative !== projectedRelative) fail('content_root_projection_mismatch');
}

async function readJsonObject(filePath, fs) {
  let bytes;
  try {
    bytes = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    fail('content_root_invalid');
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes);
  } catch (_error) {
    fail('content_root_invalid');
  }
  if (!isPlainObject(parsed)) fail('content_root_invalid');
  return parsed;
}

async function readManifest(capsuleRoot, fs) {
  let text;
  try {
    text = await fs.readFile(path.join(capsuleRoot, 'manifest.md'), 'utf8');
  } catch (_error) {
    fail('view_id_invalid');
  }
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/u);
  if (!match) fail('view_id_invalid');
  try {
    return parseSimpleYaml(match[1]);
  } catch (_error) {
    fail('view_id_invalid');
  }
}

async function validateCapsuleTree({
  projectRoot,
  machineIdentity,
  sourceRoot,
  destinationRoot,
  currentRoot,
  projectedRoot,
  fs = fsPromises,
}) {
  const machineRoot = path.join(projectRoot, 'ai', machineIdentity);
  let dirents;
  try {
    dirents = await fs.readdir(currentRoot, { withFileTypes: true });
  } catch (_error) {
    fail('root_missing');
  }
  const folders = [];
  for (const entry of dirents) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      folders.push(entry);
      continue;
    }
    // Ordinary strict discovery follows a top-level symlink whose referent is
    // a directory. Validate that same capsule surface here so the relocation
    // journal can never attest a tree that registry discovery later rejects.
    if (entry.isSymbolicLink()) {
      try {
        if ((await fs.stat(path.join(currentRoot, entry.name))).isDirectory()) folders.push(entry);
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) fail('view_folder_invalid');
      }
    }
  }
  if (folders.length > MAX_VIEW_CAPSULE_PROJECTION_ENTRIES) fail('view_capsule_limit_exceeded');
  folders.sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));

  const identities = [];
  for (const folder of folders) {
    let folderName;
    try {
      folderName = parseProjectionFolderName(folder.name);
    } catch (_error) {
      fail('view_folder_invalid');
    }
    const currentCapsule = path.join(currentRoot, folderName);
    const projectedCapsule = path.join(projectedRoot, folderName);
    const manifest = await readManifest(currentCapsule, fs);
    const metadata = Object.hasOwn(manifest, 'metadata') && isPlainObject(manifest.metadata)
      ? manifest.metadata
      : null;
    const manifestId = metadata && Object.hasOwn(metadata, 'view-id')
      ? metadata['view-id']
      : undefined;
    let id;
    try {
      id = parseCanonicalViewId(manifestId, `View capsule ${folderName}`);
    } catch (error) {
      throw new ViewRelocationError(error?.code || 'view_id_invalid');
    }
    const content = await readJsonObject(path.join(currentCapsule, 'content.json'), fs);
    const context = {
      projectRoot,
      machineIdentity,
      machineRoot,
      sourceRoot,
      destinationRoot,
      currentCapsule,
      projectedCapsule,
    };
    const resolved = content.root === undefined || content.root === null
      ? resolveDefaultRoot(content, metadata || Object.create(null), id, context)
      : resolveDeclaredRoot(content.root, context);
    await validateResolvedRoot(resolved, context, fs);
    identities.push({ id, folderName });
  }
  try {
    assertUniqueCanonicalViewIds(identities);
  } catch (error) {
    throw new ViewRelocationError(error?.code || 'view_id_duplicate');
  }
  return Object.freeze(identities.map((entry) => Object.freeze(entry)));
}

module.exports = {
  resolveDeclaredRoot,
  validateCapsuleTree,
};
