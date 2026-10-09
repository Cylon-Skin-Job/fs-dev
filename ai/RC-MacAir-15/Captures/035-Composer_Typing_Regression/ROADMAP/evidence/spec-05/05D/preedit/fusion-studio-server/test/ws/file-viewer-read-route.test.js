'use strict';

const treeDefinition = require('../../lib/event-registry/schemas/file-tree-v1.json');
const contentDefinition = require('../../lib/event-registry/schemas/file-content-v1.json');
const { createPayloadValidator } = require('../../lib/event-registry/schema-validator');
const { createFileViewerReadRoute } = require('../../lib/ws/file-viewer-read-route');
const { beginWorkspaceBind, completeWorkspaceBind } = require('../../lib/ws/workspace-session');

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH_B = '123e4567-e89b-42d3-a456-426614174001';
const validators = {
  file_tree: createPayloadValidator(treeDefinition, 'file_tree'),
  file_content: createPayloadValidator(contentDefinition, 'file_content'),
};

function registryAccess() {
  return {
    async validatePayload(reference, value) {
      return validators[reference.schemaKey](value);
    },
  };
}

function socket() {
  return {
    readyState: 1,
    sent: [],
    closes: [],
    send(payload, callback) {
      this.sent.push(payload);
      callback?.();
    },
    close(code, reason) {
      this.closes.push([code, reason]);
      this.readyState = 3;
    },
  };
}

function activeSession() {
  return {
    currentWorkspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, workspaceBindingState: 'active',
    workspaceReplyFlushState: 'idle', workspaceReplyBuffer: [], workspaceReplyBufferBytes: 0,
  };
}

function request(kind, overrides = {}) {
  return {
    type: `file_${kind}_request`, version: 1, requestId: `${kind}-1`,
    workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, panel: 'file-viewer',
    path: kind === 'tree' ? '' : 'docs/a.md', ...overrides,
  };
}

describe('public File Viewer read v1 route', () => {
  test('validates a request and emits a schema-validated result with the captured pair', async () => {
    const readContent = jest.fn(async () => ({ content: 'hello 🦊', size: 10, lastModified: 5 }));
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(),
      readService: { readTree: jest.fn(), readContent },
    });
    const ws = socket();
    const session = activeSession();
    await route.handleContent({ ws, session, message: request('content') });
    expect(readContent).toHaveBeenCalledWith({ workspaceId: 'workspace-A', path: 'docs/a.md' });
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_content_response', version: 1, success: true, requestId: 'content-1',
      workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1, panel: 'file-viewer',
      path: 'docs/a.md', content: 'hello 🦊', size: 10, lastModified: 5,
    });
    expect(ws.closes).toEqual([]);
  });

  test('stale intent returns the current pair and performs no filesystem read, including A1 after A-B-A2', async () => {
    const readTree = jest.fn();
    const session = activeSession();
    session.workspaceEpoch = '123e4567-e89b-42d3-a456-426614174002';
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(), readService: { readTree, readContent: jest.fn() },
    });
    const ws = socket();
    await route.handleTree({ ws, session, message: request('tree') });
    expect(readTree).not.toHaveBeenCalled();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_tree_response', version: 1, success: false, code: 'stale_workspace',
      error: 'The workspace changed before this read was accepted.', requestId: 'tree-1',
      workspaceId: 'workspace-A', workspaceEpoch: session.workspaceEpoch,
    });
  });

  test('binding/no-active returns unavailable without I/O and queues behind the bind frame', async () => {
    const readTree = jest.fn();
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(), readService: { readTree, readContent: jest.fn() },
    });
    const ws = socket();
    const session = activeSession();
    const pair = beginWorkspaceBind(session, {
      workspaceId: 'workspace-A', repoPath: '/A', randomUuid: () => EPOCH_A1,
    });
    await route.handleTree({ ws, session, message: request('tree') });
    expect(ws.sent).toEqual([]);
    expect(readTree).not.toHaveBeenCalled();
    await completeWorkspaceBind(ws, session, { type: 'workspace:switched' }, pair);
    expect(ws.sent.map((item) => JSON.parse(item).type)).toEqual([
      'workspace:switched', 'file_tree_response',
    ]);
    expect(JSON.parse(ws.sent[1])).toMatchObject({ code: 'workspace_unavailable', requestId: 'tree-1' });
  });

  test('post-capture semantic rejection carries the captured pair without invalid panel or path', async () => {
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(), readService: { readTree: jest.fn(), readContent: jest.fn() },
    });
    const ws = socket();
    await route.handleTree({
      ws,
      session: activeSession(),
      message: request('tree', { panel: 'office', path: '../secret', includeHiddenFolders: null }),
    });
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_tree_response', version: 1, success: false, code: 'invalid_request',
      error: 'The file tree request is invalid.', requestId: 'tree-1',
      workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    });
  });

  test('envelope rejection has no pair and never reads', async () => {
    const readContent = jest.fn();
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(), readService: { readTree: jest.fn(), readContent },
    });
    const ws = socket();
    await route.handleContent({
      ws, session: activeSession(), message: request('content', { version: 2 }),
    });
    expect(readContent).not.toHaveBeenCalled();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_content_response', version: 1, success: false, code: 'invalid_request',
      error: 'The file content request is invalid.', requestId: 'content-1',
    });
  });

  test('accepted async reply retains its captured A1 pair after navigation activates B', async () => {
    let finish;
    const readTree = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(), readService: { readTree, readContent: jest.fn() },
    });
    const ws = socket();
    const session = activeSession();
    const pending = route.handleTree({ ws, session, message: request('tree') });
    await new Promise((resolve) => setImmediate(resolve));
    session.currentWorkspaceId = 'workspace-B';
    session.workspaceEpoch = EPOCH_B;
    finish({ nodes: [] });
    await pending;
    expect(JSON.parse(ws.sent[0])).toMatchObject({
      success: true, workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
    });
  });

  test('domain failures use fixed nonsecret text and retain the captured pair', async () => {
    const { FileViewerReadError } = require('../../lib/file-reads/file-viewer-read-service');
    const route = createFileViewerReadRoute({
      registryAccess: registryAccess(),
      readService: {
        readTree: jest.fn(async () => { throw new FileViewerReadError('too_many_entries'); }),
        readContent: jest.fn(),
      },
    });
    const ws = socket();
    await route.handleTree({ ws, session: activeSession(), message: request('tree') });
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_tree_response', version: 1, success: false, code: 'too_many_entries',
      requestId: 'tree-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
      panel: 'file-viewer', path: '', error: 'The folder contains too many entries.',
    });
  });

  test('inactive or drifted locked query authority fails closed before filesystem I/O', async () => {
    const readContent = jest.fn();
    const route = createFileViewerReadRoute({
      registryAccess: {
        validatePayload: jest.fn(async (_reference, value) => (
          value.type === 'file_content_request'
            ? { valid: false, errors: [{ code: 'schema_inactive' }] }
            : { valid: true, errors: [] }
        )),
      },
      readService: { readTree: jest.fn(), readContent },
    });
    const ws = socket();
    await route.handleContent({ ws, session: activeSession(), message: request('content') });
    expect(readContent).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([]);
    expect(ws.closes[0][0]).toBe(1011);
  });
});
