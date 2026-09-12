'use strict';

const crypto = require('crypto');
const path = require('path');
const fsPromises = require('fs').promises;

const { ViewRelocationError } = require('./relocation-errors');

const MAX_INVENTORY_ENTRIES = 100_000;
const MAX_RELATIVE_PATH_BYTES = 4096;

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

async function captureSafeDirectoryChain(
  projectRoot,
  targetPath,
  fs = fsPromises,
  { allowMissing = false } = {},
) {
  if (!isInside(projectRoot, targetPath)) throw new ViewRelocationError('root_ancestor_invalid');
  const relative = path.relative(projectRoot, targetPath);
  const segments = relative ? relative.split(path.sep) : [];
  const snapshot = [];
  let cursor = projectRoot;
  for (const segment of ['', ...segments]) {
    if (segment) cursor = path.join(cursor, segment);
    let stat;
    try {
      stat = await fs.lstat(cursor, { bigint: true });
    } catch (error) {
      if (allowMissing && (error?.code === 'ENOENT' || error?.code === 'ENOTDIR')) break;
      throw new ViewRelocationError('root_ancestor_invalid');
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new ViewRelocationError('root_ancestor_invalid');
    }
    let physical;
    try {
      physical = path.resolve(await fs.realpath(cursor));
    } catch (_error) {
      throw new ViewRelocationError('root_ancestor_invalid');
    }
    if (physical !== path.resolve(cursor) || !isInside(projectRoot, physical)) {
      throw new ViewRelocationError('root_ancestor_invalid');
    }
    snapshot.push(Object.freeze({
      path: cursor,
      device: stat.dev.toString(),
      inode: stat.ino.toString(),
    }));
  }
  return Object.freeze(snapshot);
}

async function assertDirectoryChainStable(snapshot, fs = fsPromises) {
  for (const expected of snapshot) {
    let stat;
    try {
      stat = await fs.lstat(expected.path, { bigint: true });
    } catch (_error) {
      throw new ViewRelocationError('root_ancestor_changed');
    }
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || stat.dev.toString() !== expected.device
      || stat.ino.toString() !== expected.inode
    ) throw new ViewRelocationError('root_ancestor_changed');
  }
}

function normalizeRelativePath(value) {
  const normalized = value.split(path.sep).join('/');
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    || Buffer.byteLength(normalized, 'utf8') > MAX_RELATIVE_PATH_BYTES
  ) throw new ViewRelocationError('inventory_path_invalid');
  return normalized;
}

function decodeEntryName(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const decoded = bytes.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(bytes) || decoded.includes('\0')) {
    throw new ViewRelocationError('inventory_path_invalid');
  }
  return { bytes, decoded };
}

function addFrame(hash, label, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  hash.update(`${label}:${bytes.length}:`, 'utf8');
  hash.update(bytes);
  hash.update('\0', 'utf8');
}

function fileType(stat) {
  if (stat.isDirectory()) return 'directory';
  if (stat.isFile()) return 'file';
  if (stat.isSymbolicLink()) return 'symlink';
  throw new ViewRelocationError('special_file_unsupported');
}

function sameStat(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs;
}

async function readLinkTarget(linkPath, fs = fsPromises) {
  const bytes = await fs.readlink(linkPath, { encoding: 'buffer' });
  const value = bytes.toString('utf8');
  if (!Buffer.from(value, 'utf8').equals(bytes) || value.includes('\0')) {
    throw new ViewRelocationError('symlink_target_invalid');
  }
  return { bytes, value };
}

async function validateSymlink({
  linkPath,
  relativePath,
  sourceRoot,
  destinationRoot,
  fs = fsPromises,
}) {
  const target = await readLinkTarget(linkPath, fs);
  const projectedLink = path.join(destinationRoot, ...relativePath.split('/'));
  if (path.isAbsolute(target.value)) {
    const absoluteTarget = path.resolve(target.value);
    if (isInside(sourceRoot, absoluteTarget) || isInside(destinationRoot, absoluteTarget)) {
      throw new ViewRelocationError('symlink_absolute_internal');
    }
    let realTarget;
    try {
      realTarget = await fs.realpath(absoluteTarget);
    } catch (_error) {
      throw new ViewRelocationError('symlink_broken');
    }
    if (isInside(sourceRoot, realTarget) || isInside(destinationRoot, realTarget)) {
      throw new ViewRelocationError('symlink_absolute_internal');
    }
    throw new ViewRelocationError('symlink_escape');
  }

  const sourceReferent = path.resolve(path.dirname(linkPath), target.value);
  const projectedReferent = path.resolve(path.dirname(projectedLink), target.value);
  if (!isInside(sourceRoot, sourceReferent) || !isInside(destinationRoot, projectedReferent)) {
    throw new ViewRelocationError('symlink_escape');
  }
  const sourceRelative = path.relative(sourceRoot, sourceReferent).split(path.sep).join('/');
  const projectedRelative = path.relative(destinationRoot, projectedReferent).split(path.sep).join('/');
  if (sourceRelative !== projectedRelative) {
    throw new ViewRelocationError('symlink_projection_mismatch');
  }
  let realReferent;
  try {
    realReferent = await fs.realpath(sourceReferent);
  } catch (_error) {
    throw new ViewRelocationError('symlink_broken');
  }
  if (!isInside(sourceRoot, realReferent)) throw new ViewRelocationError('symlink_escape');
  return target.bytes;
}

async function collectInventory({ sourceRoot, destinationRoot, fs = fsPromises }) {
  const canonicalSource = path.resolve(sourceRoot);
  const canonicalDestination = path.resolve(destinationRoot);
  let rootStat;
  try {
    rootStat = await fs.lstat(canonicalSource, { bigint: true });
  } catch (_error) {
    throw new ViewRelocationError('root_missing');
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new ViewRelocationError('source_not_directory');
  }

  const entries = [];
  async function walk(directory, prefix = '') {
    let dirents;
    try {
      dirents = await fs.readdir(directory, { withFileTypes: true, encoding: 'buffer' });
    } catch (_error) {
      throw new ViewRelocationError('filesystem_error');
    }
    dirents.sort((left, right) => Buffer.compare(
      Buffer.isBuffer(left.name) ? left.name : Buffer.from(left.name, 'utf8'),
      Buffer.isBuffer(right.name) ? right.name : Buffer.from(right.name, 'utf8'),
    ));
    for (const dirent of dirents) {
      if (entries.length >= MAX_INVENTORY_ENTRIES) {
        throw new ViewRelocationError('inventory_limit_exceeded');
      }
      const name = decodeEntryName(dirent.name);
      const relativePath = normalizeRelativePath(prefix ? `${prefix}/${name.decoded}` : name.decoded);
      const entryPath = path.join(directory, name.decoded);
      const stat = await fs.lstat(entryPath, { bigint: true });
      const type = fileType(stat);
      const entry = { relativePath, type, mode: Number(stat.mode & 0o7777n).toString(8) };
      if (type === 'file') {
        const bytes = await fs.readFile(entryPath);
        const after = await fs.lstat(entryPath, { bigint: true });
        if (!sameStat(stat, after) || BigInt(bytes.length) !== stat.size) {
          throw new ViewRelocationError('inventory_changed');
        }
        entry.bytes = bytes;
      } else if (type === 'symlink') {
        entry.linkTarget = await validateSymlink({
          linkPath: entryPath,
          relativePath,
          sourceRoot: canonicalSource,
          destinationRoot: canonicalDestination,
          fs,
        });
        const after = await fs.lstat(entryPath, { bigint: true });
        if (!sameStat(stat, after)) throw new ViewRelocationError('inventory_changed');
      }
      entries.push(entry);
      if (type === 'directory') {
        await walk(entryPath, relativePath);
        const after = await fs.lstat(entryPath, { bigint: true });
        if (!sameStat(stat, after)) throw new ViewRelocationError('inventory_changed');
      }
    }
  }
  await walk(canonicalSource);

  const rootAfter = await fs.lstat(canonicalSource, { bigint: true });
  if (!sameStat(rootStat, rootAfter)) throw new ViewRelocationError('inventory_changed');

  const hash = crypto.createHash('sha256');
  hash.update('fusion-view-tree-inventory-v1\0', 'utf8');
  for (const entry of entries) {
    hash.update('entry\0', 'utf8');
    addFrame(hash, 'path', entry.relativePath);
    addFrame(hash, 'type', entry.type);
    addFrame(hash, 'mode', entry.mode);
    if (entry.type === 'file') addFrame(hash, 'bytes', entry.bytes);
    if (entry.type === 'symlink') addFrame(hash, 'target', entry.linkTarget);
  }
  return Object.freeze({
    digest: hash.digest('hex'),
    directoryDevice: rootStat.dev.toString(),
    directoryInode: rootStat.ino.toString(),
    entryCount: entries.length,
  });
}

module.exports = {
  MAX_INVENTORY_ENTRIES,
  MAX_RELATIVE_PATH_BYTES,
  assertDirectoryChainStable,
  captureSafeDirectoryChain,
  collectInventory,
  decodeEntryName,
  isInside,
  normalizeRelativePath,
};
