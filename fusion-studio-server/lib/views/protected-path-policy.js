'use strict';

const fs = require('fs');
const path = require('path');
const workspaceRegistry = require('../workspace/registry-service');

class ProtectedViewPathError extends Error {
  constructor() {
    super('Protected view path');
    this.name = 'ProtectedViewPathError';
    this.code = 'PROTECTED_VIEW_PATH';
  }
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function pathVariants(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new ProtectedViewPathError();
  }
  const variants = new Set([value]);
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      variants.add(next);
      decoded = next;
    } catch {
      break;
    }
  }
  for (const candidate of [...variants]) variants.add(candidate.replace(/\\/g, '/'));
  return [...variants];
}

function isProtectedAiNamespace(aiRoot, candidate) {
  if (!isInside(aiRoot, candidate)) return false;
  const relative = path.relative(path.resolve(aiRoot), path.resolve(candidate));
  const segments = relative.split(path.sep).filter(Boolean).map((part) => part.toLowerCase());
  if (segments.length < 2) return false;
  return segments[1] === 'views'
    || (segments[1] === 'system' && segments[2] === 'views');
}

function isProtectedNamespace(workspaceRoot, candidate) {
  return isProtectedAiNamespace(path.join(workspaceRoot, 'ai'), candidate);
}

async function nearestExistingResolution(candidate, fsPromises, visitedLinks = new Set()) {
  const remaining = [];
  let cursor = path.resolve(candidate);
  for (;;) {
    let stat;
    try {
      stat = await fsPromises.lstat(cursor);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      remaining.unshift(path.basename(cursor));
      cursor = parent;
      continue;
    }
    try {
      const real = await fsPromises.realpath(cursor);
      return path.resolve(real, ...remaining);
    } catch (error) {
      if (!stat.isSymbolicLink() || (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR')) {
        throw error;
      }
      const key = path.resolve(cursor);
      if (visitedLinks.has(key)) {
        throw Object.assign(new Error('Symlink cycle'), { code: 'ELOOP' });
      }
      const nextVisited = new Set(visitedLinks);
      nextVisited.add(key);
      const linkTarget = await fsPromises.readlink(cursor);
      const projectedTarget = path.isAbsolute(linkTarget)
        ? path.resolve(linkTarget, ...remaining)
        : path.resolve(path.dirname(cursor), linkTarget, ...remaining);
      return nearestExistingResolution(projectedTarget, fsPromises, nextVisited);
    }
  }
}

async function protectedRootInventory(workspaceRoot, fsPromises) {
  const declaredRoots = [];
  const projectedAiRoots = [];
  const projectedRealRoots = [];
  const realRoots = [];
  const aiRoot = path.join(workspaceRoot, 'ai');
  // The machine segment is intentionally open-ended. Retain the physical ai
  // root even when it is a symlink and has no machine entries yet, so a
  // generic writer cannot create a brand-new protected machine namespace by
  // addressing the symlink target directly.
  projectedAiRoots.push(path.resolve(aiRoot));
  try {
    projectedAiRoots.push(await nearestExistingResolution(aiRoot, fsPromises));
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
  }
  let machineEntries = [];
  try {
    machineEntries = await fsPromises.readdir(aiRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
  }
  for (const entry of machineEntries) {
    const machineRoot = path.join(aiRoot, entry.name);
    const candidateRoots = [
      path.resolve(machineRoot, 'Views'),
      path.resolve(machineRoot, 'System', 'Views'),
    ];
    // Preserve the actual directory-entry spelling as well. The policy treats
    // namespace segments case-insensitively even on a case-sensitive host, so
    // ancestor checks must not depend on canonical spelling.
    let machineChildren = [];
    try {
      machineChildren = await fsPromises.readdir(machineRoot, { withFileTypes: true });
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
    for (const child of machineChildren) {
      if (child.name.toLowerCase() === 'views') {
        candidateRoots.push(path.resolve(machineRoot, child.name));
      }
      if (child.name.toLowerCase() !== 'system') continue;
      const actualSystemRoot = path.resolve(machineRoot, child.name);
      let systemChildren = [];
      try {
        systemChildren = await fsPromises.readdir(actualSystemRoot, { withFileTypes: true });
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      }
      for (const systemChild of systemChildren) {
        if (systemChild.name.toLowerCase() === 'views') {
          candidateRoots.push(path.resolve(actualSystemRoot, systemChild.name));
        }
      }
    }
    // This security inventory deliberately covers every on-disk machine
    // namespace, including names that the current-machine path owner would
    // sanitize. It is not an ordinary view-root consumer or fallback.
    for (const root of candidateRoots) {
      // Keep the declared root even when it is absent or a symlink. Ancestor
      // operations mutate the namespace entry itself, not only its real target.
      declaredRoots.push(root);
      try {
        projectedRealRoots.push(await nearestExistingResolution(root, fsPromises));
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      }
      try {
        realRoots.push(await fsPromises.realpath(root));
      } catch (error) {
        if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      }
    }
  }
  return {
    declaredRoots: [...new Set(declaredRoots)],
    projectedAiRoots: [...new Set(projectedAiRoots)],
    projectedRealRoots: [...new Set(projectedRealRoots)],
    realRoots: [...new Set(realRoots)],
  };
}

async function collectProtectedReachability(roots, fsPromises) {
  const identities = new Set();
  const referentRoots = new Set();
  const pending = [...roots];
  const visitedDirectories = new Set();
  const visitedLinks = new Set();
  while (pending.length) {
    const current = pending.pop();
    let stat;
    try {
      stat = await fsPromises.lstat(current);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      const linkPath = path.resolve(current);
      if (visitedLinks.has(linkPath)) continue;
      visitedLinks.add(linkPath);
      let linkTarget;
      try {
        linkTarget = await fsPromises.readlink(linkPath);
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'EINVAL') continue;
        throw error;
      }
      const declaredTarget = path.isAbsolute(linkTarget)
        ? path.resolve(linkTarget)
        : path.resolve(path.dirname(linkPath), linkTarget);
      referentRoots.add(declaredTarget);
      // A link to the filesystem root already protects every candidate by
      // containment; recursively walking the whole host would add no security.
      if (path.dirname(declaredTarget) !== declaredTarget) pending.push(declaredTarget);
      try {
        const projectedTarget = await nearestExistingResolution(declaredTarget, fsPromises);
        referentRoots.add(projectedTarget);
        if (
          projectedTarget !== declaredTarget
          && path.dirname(projectedTarget) !== projectedTarget
        ) pending.push(projectedTarget);
      } catch (error) {
        // The declared target remains protected even when the link is broken
        // or cyclic. Other filesystem failures make inventory fail closed.
        if (!['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error?.code)) throw error;
      }
      continue;
    }
    if (stat.isFile()) {
      identities.add(`${stat.dev}:${stat.ino}`);
      continue;
    }
    if (!stat.isDirectory()) continue;
    const directoryIdentity = `${stat.dev}:${stat.ino}`;
    if (visitedDirectories.has(directoryIdentity)) continue;
    visitedDirectories.add(directoryIdentity);
    const entries = await fsPromises.readdir(current);
    for (const entry of entries) pending.push(path.join(current, entry));
  }
  return { identities, referentRoots };
}

async function collectTreePaths(root, fsPromises) {
  const paths = [];
  const pending = [path.resolve(root)];
  const visitedDirectories = new Set();
  while (pending.length) {
    const current = pending.pop();
    let stat;
    try {
      stat = await fsPromises.lstat(current);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
      throw error;
    }
    paths.push(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) continue;
    const identity = `${stat.dev}:${stat.ino}`;
    if (visitedDirectories.has(identity)) continue;
    visitedDirectories.add(identity);
    const entries = await fsPromises.readdir(current);
    for (const entry of entries) pending.push(path.join(current, entry));
  }
  return paths;
}

async function collectProjectedTreePaths(sourceRoot, destinationRoot, fsPromises) {
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const projectedPaths = [];

  async function inspect(
    backingPath,
    futurePath,
    exposedPath,
    ancestorDirectories,
    ancestorLinks,
    recordPath = true,
  ) {
    let stat;
    try {
      stat = await fsPromises.lstat(backingPath);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return;
      throw error;
    }
    if (recordPath) projectedPaths.push(exposedPath);

    if (stat.isSymbolicLink()) {
      const linkState = `${path.resolve(backingPath)}\0${path.resolve(futurePath)}`;
      if (ancestorLinks.has(linkState)) return;
      const nextLinks = new Set(ancestorLinks);
      nextLinks.add(linkState);
      let linkTarget;
      try {
        linkTarget = await fsPromises.readlink(backingPath);
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'EINVAL') return;
        throw error;
      }
      const futureTarget = path.isAbsolute(linkTarget)
        ? path.resolve(linkTarget)
        : path.resolve(path.dirname(futurePath), linkTarget);
      projectedPaths.push(futureTarget);
      let futureBacking;
      if (path.isAbsolute(linkTarget)) {
        // An absolute link into the moved source becomes broken because its
        // stored bytes are not rewritten by rename.
        if (isInside(source, linkTarget) && !isInside(destination, linkTarget)) return;
        futureBacking = futureTarget;
      } else {
        futureBacking = isInside(destination, futureTarget)
          ? path.resolve(source, path.relative(destination, futureTarget))
          : futureTarget;
      }
      await inspect(
        futureBacking,
        futureTarget,
        exposedPath,
        ancestorDirectories,
        nextLinks,
        false,
      );
      return;
    }

    if (!stat.isDirectory()) return;
    const identity = `${stat.dev}:${stat.ino}`;
    if (ancestorDirectories.has(identity)) return;
    const nextAncestors = new Set(ancestorDirectories);
    nextAncestors.add(identity);
    const entries = await fsPromises.readdir(backingPath);
    for (const entry of entries) {
      await inspect(
        path.join(backingPath, entry),
        path.join(futurePath, entry),
        path.join(exposedPath, entry),
        nextAncestors,
        ancestorLinks,
      );
    }
  }

  await inspect(source, destination, destination, new Set(), new Set());
  return projectedPaths;
}

async function assertGenericViewMutationAllowed({
  projectRoot,
  paths,
  pathMappings = [],
  workspaceRoots = null,
  fsPromises = fs.promises,
}) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) {
    throw new ProtectedViewPathError();
  }
  const declaredWorkspaceRoot = path.resolve(projectRoot);
  let registeredRoots = workspaceRoots;
  if (!Array.isArray(registeredRoots)) {
    try {
      registeredRoots = (await workspaceRegistry.list()).map((workspace) => (
        workspace?.repoPath ?? workspace?.repo_path
      ));
    } catch (error) {
      // Unit owners and early startup can call the policy before the registry
      // is initialized. The initiating root remains mandatory below; resolved
      // protected namespace shapes still fail closed across other roots.
      if (!String(error?.message || '').startsWith('DB not initialized')) {
        throw new ProtectedViewPathError();
      }
      registeredRoots = [];
    }
  }
  const candidateWorkspaceRoots = [...new Set([
    declaredWorkspaceRoot,
    ...registeredRoots
      .filter((root) => typeof root === 'string' && path.isAbsolute(root))
      .map((root) => path.resolve(root)),
  ])];
  const workspaceProtections = [];
  for (const workspaceRoot of candidateWorkspaceRoots) {
    let workspaceReal;
    try {
      workspaceReal = await fsPromises.realpath(workspaceRoot);
    } catch (error) {
      if (workspaceRoot === declaredWorkspaceRoot) throw new ProtectedViewPathError();
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
      throw new ProtectedViewPathError();
    }
    workspaceProtections.push({
      declaredWorkspaceRoot: workspaceRoot,
      realWorkspaceRoot: workspaceReal,
      ...await protectedRootInventory(workspaceRoot, fsPromises),
    });
  }
  const declaredRoots = workspaceProtections.flatMap((item) => item.declaredRoots);
  const projectedAiRoots = workspaceProtections.flatMap((item) => item.projectedAiRoots);
  const projectedRealRoots = workspaceProtections.flatMap((item) => item.projectedRealRoots);
  const realRoots = workspaceProtections.flatMap((item) => item.realRoots);
  const protectedReachability = await collectProtectedReachability(realRoots, fsPromises);
  const protectedIdentities = protectedReachability.identities;
  const protectedReferentRoots = [...protectedReachability.referentRoots];
  const targets = Array.isArray(paths) ? paths : [paths];

  async function assertTargetAllowed(target) {
    for (const variant of pathVariants(target)) {
      const logical = path.isAbsolute(variant)
        ? path.resolve(variant)
        : path.resolve(declaredWorkspaceRoot, variant);
      if (
        workspaceProtections.some((item) => (
          isProtectedNamespace(item.declaredWorkspaceRoot, logical)
          || isProtectedNamespace(item.realWorkspaceRoot, logical)
        ))
      ) throw new ProtectedViewPathError();

      let resolved;
      try {
        resolved = await nearestExistingResolution(logical, fsPromises);
      } catch {
        throw new ProtectedViewPathError();
      }
      if (
        workspaceProtections.some((item) => (
          isProtectedNamespace(item.declaredWorkspaceRoot, resolved)
          || isProtectedNamespace(item.realWorkspaceRoot, resolved)
        ))
        || projectedAiRoots.some((aiRoot) => isProtectedAiNamespace(aiRoot, resolved))
        || declaredRoots.some((root) => isInside(root, logical) || isInside(logical, root))
        || projectedRealRoots.some((root) => isInside(root, resolved) || isInside(resolved, root))
        || realRoots.some((root) => isInside(root, resolved) || isInside(resolved, root))
        || protectedReferentRoots.some((root) => (
          isInside(root, logical)
          || isInside(logical, root)
          || isInside(root, resolved)
          || isInside(resolved, root)
        ))
      ) throw new ProtectedViewPathError();

      try {
        const stat = await fsPromises.lstat(logical);
        if (stat.isFile() && protectedIdentities.has(`${stat.dev}:${stat.ino}`)) {
          throw new ProtectedViewPathError();
        }
      } catch (error) {
        if (error instanceof ProtectedViewPathError) throw error;
        if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
          throw new ProtectedViewPathError();
        }
      }
    }
  }

  for (const target of targets) {
    await assertTargetAllowed(target);
    // Compound directory mutations operate on every descendant. Inspect the
    // complete current tree so a nested protected path or hard-link identity
    // cannot ride through an otherwise ordinary ancestor.
    for (const descendant of await collectTreePaths(target, fsPromises)) {
      if (path.resolve(descendant) !== path.resolve(target)) {
        await assertTargetAllowed(descendant);
      }
    }
  }

  for (const mapping of pathMappings) {
    const source = path.resolve(mapping?.source || '');
    const destination = path.resolve(mapping?.destination || '');
    // Projection follows each symlink as it will resolve after the rename,
    // including relative-link rebasing, while bounding directory cycles by
    // identity. This prevents a symlinked subtree from installing a reachable
    // protected namespace even when no literal Views entry is in the source.
    for (const projectedPath of await collectProjectedTreePaths(source, destination, fsPromises)) {
      await assertTargetAllowed(projectedPath);
    }
  }
  return true;
}

module.exports = {
  ProtectedViewPathError,
  assertGenericViewMutationAllowed,
  isProtectedNamespace,
  resolveRealMutationTarget: nearestExistingResolution,
};
