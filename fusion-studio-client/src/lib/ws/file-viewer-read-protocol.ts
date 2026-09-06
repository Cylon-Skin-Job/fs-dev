import type {
  FileContentRequestV1,
  FileContentResponseV1,
  FileTreeNodeV1,
  FileTreeRequestV1,
  FileTreeResponseV1,
} from '../../types/file-explorer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const encoder = new TextEncoder();

const ERRORS = {
  tree: {
    invalid_request: 'The file tree request is invalid.',
    workspace_unavailable: 'The workspace is not available.',
    stale_workspace: 'The workspace changed before this read was accepted.',
    path_not_allowed: 'The requested path is not allowed.',
    not_found: 'The requested folder was not found.',
    permission_denied: 'Permission was denied while reading the folder.',
    not_directory: 'The requested path is not a folder.',
    too_many_entries: 'The folder contains too many entries.',
    read_failed: 'The folder could not be read.',
  },
  content: {
    invalid_request: 'The file content request is invalid.',
    workspace_unavailable: 'The workspace is not available.',
    stale_workspace: 'The workspace changed before this read was accepted.',
    path_not_allowed: 'The requested path is not allowed.',
    not_found: 'The requested file was not found.',
    permission_denied: 'Permission was denied while reading the file.',
    is_directory: 'The requested path is a folder.',
    unsupported_text: 'Only supported UTF-8 text can be read.',
    read_failed: 'The file could not be read.',
  },
} as const;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function scalarWithin(value: unknown, maxBytes: number, allowEmpty = false): value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || encoder.encode(value).length > maxBytes) return false;
  if (value.includes('\u0000')) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function normalizedPath(value: unknown, allowEmpty: boolean): value is string {
  if (!scalarWithin(value, 4096, allowEmpty)) return false;
  if (value === '') return allowEmpty;
  if (value.startsWith('/') || value.endsWith('/') || value.includes('\\')) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function validPair(value: Record<string, unknown>): boolean {
  return scalarWithin(value.workspaceId, 128) && typeof value.workspaceEpoch === 'string'
    && UUID_PATTERN.test(value.workspaceEpoch);
}

function validSymlinkFields(value: Record<string, unknown>): boolean {
  const hasFlag = Object.prototype.hasOwnProperty.call(value, 'isSymlink');
  const hasTarget = Object.prototype.hasOwnProperty.call(value, 'symlinkTarget');
  return hasFlag === hasTarget
    && (!hasFlag || (value.isSymlink === true && scalarWithin(value.symlinkTarget, 4096)));
}

function validTreeNode(value: unknown): value is FileTreeNodeV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  if (!scalarWithin(node.name, 255) || !normalizedPath(node.path, false) || !validSymlinkFields(node)) return false;
  const symlinkKeys = node.isSymlink === true ? ['isSymlink', 'symlinkTarget'] : [];
  if (node.type === 'folder') {
    return exactKeys(node, ['name', 'path', 'type', 'hasChildren', ...symlinkKeys])
      && typeof node.hasChildren === 'boolean';
  }
  if (node.type !== 'file') return false;
  const hasExtension = Object.prototype.hasOwnProperty.call(node, 'extension');
  return exactKeys(node, ['name', 'path', 'type', ...(hasExtension ? ['extension'] : []), ...symlinkKeys])
    && (!hasExtension || scalarWithin(node.extension, Number.MAX_SAFE_INTEGER, true));
}

function validProtocolError(
  value: Record<string, unknown>,
  kind: 'tree' | 'content',
  responseType: 'file_tree_response' | 'file_content_response',
): boolean {
  if (value.type !== responseType || value.version !== 1 || value.success !== false || typeof value.code !== 'string') return false;
  const expected = ERRORS[kind][value.code as keyof typeof ERRORS[typeof kind]];
  if (value.error !== expected) return false;
  if (value.code === 'invalid_request' && !('workspaceId' in value) && !('workspaceEpoch' in value)) {
    const hasRequestId = Object.prototype.hasOwnProperty.call(value, 'requestId');
    return exactKeys(value, ['type', 'version', 'success', 'code', 'error', ...(hasRequestId ? ['requestId'] : [])])
      && (!hasRequestId || scalarWithin(value.requestId, 128));
  }
  if (value.code === 'workspace_unavailable') {
    return exactKeys(value, ['type', 'version', 'success', 'code', 'requestId', 'error'])
      && scalarWithin(value.requestId, 128);
  }
  return (value.code === 'invalid_request' || value.code === 'stale_workspace')
    && exactKeys(value, ['type', 'version', 'success', 'code', 'requestId', 'workspaceId', 'workspaceEpoch', 'error'])
    && scalarWithin(value.requestId, 128)
    && validPair(value);
}

export function createFileTreeRequestV1(input: {
  requestId?: string;
  workspaceId: string;
  workspaceEpoch: string;
  path: string;
  includeHiddenFolders?: boolean;
}): FileTreeRequestV1 {
  return {
    type: 'file_tree_request',
    version: 1,
    requestId: input.requestId ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    workspaceEpoch: input.workspaceEpoch,
    panel: 'file-viewer',
    path: input.path,
    ...(input.includeHiddenFolders === undefined ? {} : { includeHiddenFolders: input.includeHiddenFolders }),
  };
}

export function createFileContentRequestV1(input: {
  requestId?: string;
  workspaceId: string;
  workspaceEpoch: string;
  path: string;
}): FileContentRequestV1 {
  return {
    type: 'file_content_request',
    version: 1,
    requestId: input.requestId ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    workspaceEpoch: input.workspaceEpoch,
    panel: 'file-viewer',
    path: input.path,
  };
}

export function isFileTreeResponseV1(value: unknown): value is FileTreeResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (validProtocolError(item, 'tree', 'file_tree_response')) return true;
  if (
    item.type !== 'file_tree_response' || item.version !== 1 || !scalarWithin(item.requestId, 128)
    || !validPair(item) || item.panel !== 'file-viewer' || !normalizedPath(item.path, true)
  ) return false;
  const baseKeys = ['type', 'version', 'success', 'requestId', 'workspaceId', 'workspaceEpoch', 'panel', 'path'];
  if (item.success === false) {
    const code = item.code as keyof typeof ERRORS.tree;
    return ['path_not_allowed', 'not_found', 'permission_denied', 'not_directory', 'too_many_entries', 'read_failed'].includes(code)
      && item.error === ERRORS.tree[code]
      && exactKeys(item, [...baseKeys, 'code', 'error']);
  }
  if (item.success !== true || !Array.isArray(item.nodes) || item.nodes.length > 1000 || !item.nodes.every(validTreeNode)) return false;
  const symlinkKeys = item.isSymlink === true ? ['isSymlink', 'symlinkTarget'] : [];
  return validSymlinkFields(item) && exactKeys(item, [...baseKeys, 'nodes', ...symlinkKeys]);
}

export function isFileContentResponseV1(value: unknown): value is FileContentResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (validProtocolError(item, 'content', 'file_content_response')) return true;
  if (
    item.type !== 'file_content_response' || item.version !== 1 || !scalarWithin(item.requestId, 128)
    || !validPair(item) || item.panel !== 'file-viewer' || !normalizedPath(item.path, false)
  ) return false;
  const baseKeys = ['type', 'version', 'success', 'requestId', 'workspaceId', 'workspaceEpoch', 'panel', 'path'];
  if (item.success === false) {
    const code = item.code as keyof typeof ERRORS.content;
    return ['path_not_allowed', 'not_found', 'permission_denied', 'is_directory', 'unsupported_text', 'read_failed'].includes(code)
      && item.error === ERRORS.content[code]
      && exactKeys(item, [...baseKeys, 'code', 'error']);
  }
  if (
    item.success !== true || !scalarWithin(item.content, Number.MAX_SAFE_INTEGER, true)
    || !Number.isSafeInteger(item.size) || (item.size as number) < 0
    || encoder.encode(item.content).length !== item.size
    || !Number.isSafeInteger(item.lastModified) || (item.lastModified as number) < 0
    || !validSymlinkFields(item)
  ) return false;
  const symlinkKeys = item.isSymlink === true ? ['isSymlink', 'symlinkTarget'] : [];
  return exactKeys(item, [...baseKeys, 'content', 'size', 'lastModified', ...symlinkKeys]);
}
