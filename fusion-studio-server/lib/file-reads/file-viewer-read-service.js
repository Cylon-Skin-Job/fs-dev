'use strict';

const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');
const registryService = require('../workspace/registry-service');
const { compareOrdinalStrings } = require('../event-registry/ordinal');
const { classifyEntry, isInsidePath } = require('../fs/dirents');
const { resolveSymlinkInfo } = require('../fs/symlinks');
const { assertScalarNulFreeString } = require('../file-mutations/text-codec');
const { getAuthoritativePanelPath } = require('../views/panel-paths');

const MAX_TREE_NODES = 1000;
const PANEL = 'file-viewer';

const ERROR_MESSAGES = Object.freeze({
  path_not_allowed: 'The requested path is not allowed.',
  not_found_tree: 'The requested folder was not found.',
  not_found_content: 'The requested file was not found.',
  permission_denied_tree: 'Permission was denied while reading the folder.',
  permission_denied_content: 'Permission was denied while reading the file.',
  not_directory: 'The requested path is not a folder.',
  too_many_entries: 'The folder contains too many entries.',
  is_directory: 'The requested path is a folder.',
  unsupported_text: 'Only supported UTF-8 text can be read.',
  read_failed_tree: 'The folder could not be read.',
  read_failed_content: 'The file could not be read.',
});

class FileViewerReadError extends Error {
  constructor(code) {
    super(code);
    this.name = 'FileViewerReadError';
    this.code = code;
  }
}

function extensionOf(name) {
  const index = name.lastIndexOf('.');
  return index > 0 && index < name.length - 1 ? name.slice(index + 1).toLowerCase() : undefined;
}

function validScalarBytes(value, maxBytes, { nonempty = true } = {}) {
  if (typeof value !== 'string' || (nonempty && value.length === 0)) return false;
  try {
    assertScalarNulFreeString(value);
  } catch (_error) {
    return false;
  }
  return Buffer.byteLength(value, 'utf8') <= maxBytes;
}

function assertResponseString(value, maxBytes) {
  if (!validScalarBytes(value, maxBytes)) throw new FileViewerReadError('read_failed');
  return value;
}

function decodeSupportedText(bytes) {
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    assertScalarNulFreeString(content);
  } catch (_error) {
    throw new FileViewerReadError('unsupported_text');
  }
  if (!Buffer.from(content, 'utf8').equals(bytes)) {
    throw new FileViewerReadError('unsupported_text');
  }
  return content;
}

function mapFilesystemError(error, kind) {
  if (error instanceof FileViewerReadError) return error;
  if (error?.code === 'ENOENT' || error?.code === 'ELOOP') {
    return new FileViewerReadError('not_found');
  }
  if (error?.code === 'EACCES' || error?.code === 'EPERM') {
    return new FileViewerReadError('permission_denied');
  }
  if (error?.code === 'ENOTDIR') {
    return new FileViewerReadError(kind === 'tree' ? 'not_directory' : 'not_found');
  }
  if (error?.code === 'EISDIR') return new FileViewerReadError('is_directory');
  return new FileViewerReadError('read_failed');
}

function createFileViewerReadService({
  getWorkspaceById = registryService.getById,
  resolvePanelRoot = (workspaceRoot) => getAuthoritativePanelPath(
    workspaceRoot,
    PANEL,
    { strictFilesystemErrors: true },
  ),
  fsPromises = fs.promises,
} = {}) {
  async function resolveTarget(workspaceId, requestPath) {
    const workspace = await getWorkspaceById(workspaceId);
    const workspaceRoot = workspace?.repoPath || workspace?.repo_path;
    if (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot)) {
      throw new FileViewerReadError('read_failed');
    }
    const panelRoot = await Promise.resolve(resolvePanelRoot(workspaceRoot));
    if (typeof panelRoot !== 'string' || !path.isAbsolute(panelRoot)) {
      throw new FileViewerReadError('read_failed');
    }
    const basePath = path.resolve(panelRoot);
    const targetPath = requestPath === ''
      ? basePath
      : path.resolve(basePath, ...requestPath.split('/'));
    if (!isInsidePath(basePath, targetPath)) throw new FileViewerReadError('path_not_allowed');
    return Object.freeze({ basePath, targetPath });
  }

  async function symlinkFields(basePath, targetPath) {
    const info = await resolveSymlinkInfo(basePath, targetPath);
    if (info.isSymlink !== true) return {};
    assertResponseString(info.symlinkTarget, 4096);
    return { isSymlink: true, symlinkTarget: info.symlinkTarget };
  }

  async function hasVisibleChildren(folderPath, includeHiddenFolders) {
    try {
      const children = await fsPromises.readdir(folderPath, { withFileTypes: true });
      for (const child of children) {
        if (child.name === 'node_modules') continue;
        const classified = await classifyEntry(folderPath, child);
        if (classified.isSymlink && classified.realPath === null) continue;
        if (!child.name.startsWith('.') || (includeHiddenFolders && classified.isDir)) return true;
      }
    } catch (_error) {}
    return false;
  }

  async function readTree({ workspaceId, path: requestPath, includeHiddenFolders = false }) {
    let target;
    try {
      target = await resolveTarget(workspaceId, requestPath);
      const entries = await fsPromises.readdir(target.targetPath, { withFileTypes: true });
      const nodes = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules') continue;
        const classified = await classifyEntry(target.targetPath, entry);
        if (classified.isSymlink && classified.realPath === null) continue;
        if (entry.name.startsWith('.') && (!includeHiddenFolders || !classified.isDir)) continue;
        assertResponseString(entry.name, 255);
        const entryPath = requestPath ? `${requestPath}/${entry.name}` : entry.name;
        assertResponseString(entryPath, 4096);
        const fullPath = path.join(target.targetPath, entry.name);
        if (classified.isDir) {
          nodes.push({
            name: entry.name,
            path: entryPath,
            type: 'folder',
            hasChildren: await hasVisibleChildren(fullPath, includeHiddenFolders),
            ...(classified.isSymlink
              ? { isSymlink: true, symlinkTarget: assertResponseString(classified.realPath, 4096) }
              : await symlinkFields(target.basePath, fullPath)),
          });
        } else if (classified.isFile) {
          const extension = extensionOf(entry.name);
          nodes.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
            ...(extension ? { extension: assertResponseString(extension, 255) } : {}),
            ...(classified.isSymlink
              ? { isSymlink: true, symlinkTarget: assertResponseString(classified.realPath, 4096) }
              : await symlinkFields(target.basePath, fullPath)),
          });
        }
        if (nodes.length > MAX_TREE_NODES) throw new FileViewerReadError('too_many_entries');
      }
      nodes.sort((left, right) => {
        if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
        return compareOrdinalStrings(left.name, right.name);
      });
      return Object.freeze({
        nodes: Object.freeze(nodes.map((node) => Object.freeze(node))),
        ...await symlinkFields(target.basePath, target.targetPath),
      });
    } catch (error) {
      throw mapFilesystemError(error, 'tree');
    }
  }

  async function readContent({ workspaceId, path: requestPath }) {
    let target;
    try {
      target = await resolveTarget(workspaceId, requestPath);
      const initialStat = await fsPromises.stat(target.targetPath);
      if (initialStat.isDirectory()) throw new FileViewerReadError('is_directory');
      if (!initialStat.isFile()) throw new FileViewerReadError('read_failed');
      const bytes = await fsPromises.readFile(target.targetPath);
      const content = decodeSupportedText(bytes);
      const finalStat = await fsPromises.stat(target.targetPath);
      const lastModified = Math.trunc(finalStat.mtimeMs);
      if (!Number.isSafeInteger(lastModified) || lastModified < 0) {
        throw new FileViewerReadError('read_failed');
      }
      return Object.freeze({
        content,
        size: bytes.length,
        lastModified,
        ...await symlinkFields(target.basePath, target.targetPath),
      });
    } catch (error) {
      throw mapFilesystemError(error, 'content');
    }
  }

  return Object.freeze({ readTree, readContent });
}

function errorMessage(kind, code) {
  const suffix = kind === 'tree' ? 'tree' : 'content';
  return ERROR_MESSAGES[`${code}_${suffix}`] || ERROR_MESSAGES[code] || ERROR_MESSAGES[`read_failed_${suffix}`];
}

module.exports = {
  ERROR_MESSAGES,
  FileViewerReadError,
  MAX_TREE_NODES,
  createFileViewerReadService,
  decodeSupportedText,
  errorMessage,
};
