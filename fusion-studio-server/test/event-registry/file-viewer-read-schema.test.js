'use strict';

const treeDefinition = require('../../lib/event-registry/schemas/file-tree-v1.json');
const contentDefinition = require('../../lib/event-registry/schemas/file-content-v1.json');
const { createPayloadValidator } = require('../../lib/event-registry/schema-validator');
const { SYSTEM_SCHEMA_SEEDS } = require('../../lib/event-registry/seed-catalog');
const { canonicalizeJson, sha256CanonicalJson } = require('../../lib/event-registry/canonical-json');

const EPOCH = '123e4567-e89b-42d3-a456-426614174000';
const validateTree = createPayloadValidator(treeDefinition, 'file_tree');
const validateContent = createPayloadValidator(contentDefinition, 'file_content');

function treeRequest(overrides = {}) {
  return {
    type: 'file_tree_request', version: 1, requestId: 'tree-1', workspaceId: 'workspace-A',
    workspaceEpoch: EPOCH, panel: 'file-viewer', path: '', ...overrides,
  };
}

function contentRequest(overrides = {}) {
  return {
    type: 'file_content_request', version: 1, requestId: 'content-1', workspaceId: 'workspace-A',
    workspaceEpoch: EPOCH, panel: 'file-viewer', path: 'docs/a.md', ...overrides,
  };
}

function paired(kind, overrides = {}) {
  return {
    type: `file_${kind}_response`, version: 1, requestId: `${kind}-1`, workspaceId: 'workspace-A',
    workspaceEpoch: EPOCH, panel: 'file-viewer', path: kind === 'tree' ? '' : 'docs/a.md',
    ...overrides,
  };
}

describe('locked File Viewer read query schemas', () => {
  test('catalog seeds are locked queries with canonical checksums', () => {
    for (const [key, definition] of [['file_tree', treeDefinition], ['file_content', contentDefinition]]) {
      const seed = SYSTEM_SCHEMA_SEEDS.find((item) => item.schemaKey === key);
      expect(seed).toMatchObject({ schemaVersion: 1, definitionKind: 'query' });
      expect(seed.definitionJson).toBe(canonicalizeJson(definition));
      expect(seed.definitionSha256).toBe(sha256CanonicalJson(definition));
    }
  });

  test('accepts each exact request, success, protocol-error, and domain-error branch', () => {
    expect(validateTree(treeRequest({ includeHiddenFolders: false })).valid).toBe(true);
    expect(validateContent(contentRequest()).valid).toBe(true);
    expect(validateTree(paired('tree', {
      success: true,
      nodes: [
        { name: 'docs', path: 'docs', type: 'folder', hasChildren: true },
        { name: 'a.md', path: 'a.md', type: 'file', extension: 'md', isSymlink: true, symlinkTarget: '/tmp/a.md' },
      ],
    })).valid).toBe(true);
    expect(validateContent(paired('content', {
      success: true, content: 'hello 🦊', size: Buffer.byteLength('hello 🦊'), lastModified: 1,
    })).valid).toBe(true);

    const protocol = [
      [{ type: 'file_tree_response', version: 1, success: false, code: 'invalid_request', error: 'The file tree request is invalid.' }, validateTree],
      [{ type: 'file_content_response', version: 1, success: false, code: 'workspace_unavailable', requestId: 'content-1', error: 'The workspace is not available.' }, validateContent],
      [{ type: 'file_tree_response', version: 1, success: false, code: 'stale_workspace', requestId: 'tree-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH, error: 'The workspace changed before this read was accepted.' }, validateTree],
      [{ type: 'file_content_response', version: 1, success: false, code: 'invalid_request', requestId: 'content-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH, error: 'The file content request is invalid.' }, validateContent],
    ];
    for (const [value, validate] of protocol) expect(validate(value).valid).toBe(true);

    const treeErrors = {
      path_not_allowed: 'The requested path is not allowed.',
      not_found: 'The requested folder was not found.',
      permission_denied: 'Permission was denied while reading the folder.',
      not_directory: 'The requested path is not a folder.',
      too_many_entries: 'The folder contains too many entries.',
      read_failed: 'The folder could not be read.',
    };
    const contentErrors = {
      path_not_allowed: 'The requested path is not allowed.',
      not_found: 'The requested file was not found.',
      permission_denied: 'Permission was denied while reading the file.',
      is_directory: 'The requested path is a folder.',
      unsupported_text: 'Only supported UTF-8 text can be read.',
      read_failed: 'The file could not be read.',
    };
    for (const [code, error] of Object.entries(treeErrors)) {
      expect(validateTree(paired('tree', { success: false, code, error })).valid).toBe(true);
    }
    for (const [code, error] of Object.entries(contentErrors)) {
      expect(validateContent(paired('content', { success: false, code, error })).valid).toBe(true);
    }
  });

  test.each([
    ['unknown request field', treeRequest({ unknown: true }), validateTree],
    ['null optional', treeRequest({ includeHiddenFolders: null }), validateTree],
    ['empty content path', contentRequest({ path: '' }), validateContent],
    ['unnormalized tree path', treeRequest({ path: '../secret' }), validateTree],
    ['uppercase epoch', contentRequest({ workspaceEpoch: EPOCH.toUpperCase() }), validateContent],
    ['byte-heavy request ID', treeRequest({ requestId: '🦊'.repeat(33) }), validateTree],
    ['byte-heavy workspace ID', contentRequest({ workspaceId: '🦊'.repeat(33) }), validateContent],
    ['too many nodes', paired('tree', { success: true, nodes: Array.from({ length: 1001 }, (_, i) => ({ name: `n${i}`, path: `n${i}`, type: 'file' })) }), validateTree],
    ['byte-heavy node name', paired('tree', { success: true, nodes: [{ name: '🦊'.repeat(64), path: 'a', type: 'file' }] }), validateTree],
    ['wrong exact UTF-8 size', paired('content', { success: true, content: '🦊', size: 2, lastModified: 1 }), validateContent],
    ['unsafe timestamp', paired('content', { success: true, content: '', size: 0, lastModified: Number.MAX_SAFE_INTEGER + 1 }), validateContent],
    ['content NUL', paired('content', { success: true, content: 'a\0b', size: 3, lastModified: 1 }), validateContent],
    ['symlink target alone', paired('tree', { success: true, nodes: [], symlinkTarget: '/tmp/a' }), validateTree],
    ['symlink flag alone', paired('content', { success: true, content: '', size: 0, lastModified: 1, isSymlink: true }), validateContent],
    ['false symlink', paired('tree', { success: true, nodes: [], isSymlink: false, symlinkTarget: '/tmp/a' }), validateTree],
    ['wrong fixed error', paired('tree', { success: false, code: 'read_failed', error: 'details' }), validateTree],
  ])('rejects %s', (_label, value, validate) => {
    expect(validate(value).valid).toBe(false);
  });

  test('all instance objects are closed JSON Schema 2020-12 objects', () => {
    function assertClosed(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object') expect(node.additionalProperties).toBe(false);
      for (const child of Object.values(node)) assertClosed(child);
    }
    for (const definition of [treeDefinition, contentDefinition]) {
      expect(definition.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      assertClosed(definition);
    }
  });
});
