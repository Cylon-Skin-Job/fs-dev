'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPayloadValidator } = require('../../lib/event-registry/schema-validator');
const definition = require('../../lib/event-registry/schemas/resource-provenance-v1.json');
const aiPaths = require('../../lib/workspace/ai-paths');
const {
  ProvenanceQuerySelectorError,
  createProvenanceQueryPathNormalizer,
} = require('../../lib/ledger/provenance-query-paths');
const { createResourceProvenanceRoute } = require('../../lib/ws/resource-provenance-route');

const A1 = '00000000-0000-4000-8000-000000000001';
const B1 = '00000000-0000-4000-8000-000000000002';
const A2 = '00000000-0000-4000-8000-000000000003';

function activeSession(workspaceId = 'workspace-a', workspaceEpoch = A1) {
  return {
    workspaceBindingState: 'active', workspaceReplyFlushState: 'idle',
    currentWorkspaceId: workspaceId, workspaceEpoch,
  };
}

function query(overrides = {}) {
  return {
    type: 'resource:provenance:query', version: 1,
    requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const validate = createPayloadValidator(definition, 'resource:provenance');
  const replies = [];
  const repository = { query: jest.fn(async () => []) };
  const pathNormalizer = { normalize: jest.fn(async () => ({})) };
  const ws = { readyState: 1, send: jest.fn(), close: jest.fn() };
  const route = createResourceProvenanceRoute({
    registryAccess: {
      validatePayload: overrides.validatePayload || (async (_reference, value) => validate(value)),
    },
    repository: overrides.repository || repository,
    pathNormalizer: overrides.pathNormalizer || pathNormalizer,
    sendReply: async (_ws, _session, value) => { replies.push(value); return true; },
    writeDiagnostic: overrides.writeDiagnostic || jest.fn(),
  });
  return { route, replies, repository, pathNormalizer, ws };
}

function createV2Workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-query-route-v2-'));
  const viewsRoot = aiPaths.getMachineViewsRoot(root);
  const viewRoot = path.join(viewsRoot, '001-office-viewer');
  const manifestPath = path.join(viewRoot, 'manifest.md');
  fs.mkdirSync(path.join(viewRoot, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'office'), { recursive: true });
  fs.writeFileSync(manifestPath, [
    '---',
    'name: Office',
    'metadata:',
    '  view-id: office-viewer',
    '  view-type: document',
    '---',
  ].join('\n'));
  fs.writeFileSync(path.join(viewRoot, 'content.json'), JSON.stringify({
    root: { type: 'workspace-relative', path: 'office' },
  }));
  return { root, viewsRoot, manifestPath };
}

describe('resource provenance public route', () => {
  test.each([
    [{ type: 'resource:provenance:query', version: 1 }, undefined],
    [query({ requestId: '' }), undefined],
    [query({ requestId: 'x'.repeat(129) }), undefined],
    [query({ workspaceEpoch: 'not-a-uuid' }), 'request-1'],
  ])('rejects an invalid envelope without echoing invalid correlation', async (message, requestId) => {
    const harness = createHarness();
    await harness.route.handleQuery({ ws: harness.ws, session: activeSession(), message });
    expect(harness.replies).toEqual([{
      type: 'resource:provenance:error', version: 1, code: 'invalid_request',
      ...(requestId ? { requestId } : {}),
    }]);
    expect(harness.repository.query).not.toHaveBeenCalled();
  });

  test('rejects binding and stale-pair preconditions before selector/query work', async () => {
    const harness = createHarness();
    await harness.route.handleQuery({ ws: harness.ws, session: { workspaceBindingState: 'binding' }, message: query() });
    await harness.route.handleQuery({
      ws: harness.ws,
      session: activeSession('workspace-b', B1),
      message: query(),
    });
    expect(harness.replies).toEqual([
      { type: 'resource:provenance:error', version: 1, code: 'workspace_unavailable', requestId: 'request-1' },
      {
        type: 'resource:provenance:error', version: 1, code: 'stale_workspace',
        requestId: 'request-1', workspaceId: 'workspace-b', workspaceEpoch: B1,
      },
    ]);
    expect(harness.pathNormalizer.normalize).not.toHaveBeenCalled();
    expect(harness.repository.query).not.toHaveBeenCalled();
  });

  test('normalizes panel aliases and combines every selector with the captured workspace', async () => {
    const harness = createHarness({
      pathNormalizer: { normalize: jest.fn(async () => ({ canonicalPath: 'docs/a.md', folderPrefix: 'docs' })) },
    });
    const message = query({
      panel: 'file-viewer', path: 'docs/a.md', fileName: 'a.md', folderPrefix: 'docs',
      operationId: '00000000-0000-4000-8000-000000000004', since: 10, limit: 20,
    });
    await harness.route.handleQuery({ ws: harness.ws, session: activeSession(), message });
    expect(harness.repository.query).toHaveBeenCalledWith({
      workspaceId: 'workspace-a', canonicalPath: 'docs/a.md', folderPrefix: 'docs',
      fileName: 'a.md', operationId: message.operationId, since: 10, limit: 20,
    });
    expect(harness.replies).toEqual([{
      type: 'resource:provenance:result', version: 1, requestId: 'request-1',
      workspaceId: 'workspace-a', workspaceEpoch: A1, items: [],
    }]);
  });

  test.each(['../secret', '.', '..'])(
    'returns captured-pair invalid_request for invalid filename selector %j',
    async (fileName) => {
      const invalid = createHarness();
      await invalid.route.handleQuery({
        ws: invalid.ws, session: activeSession(), message: query({ fileName }),
      });
      expect(invalid.replies[0]).toEqual({
        type: 'resource:provenance:error', version: 1, code: 'invalid_request',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      });
      expect(invalid.repository.query).not.toHaveBeenCalled();
    },
  );

  test.each([Number.MAX_SAFE_INTEGER + 1, 1e20])(
    'returns captured-pair invalid_request for unsafe since selector %p without querying',
    async (since) => {
      const invalid = createHarness();
      await invalid.route.handleQuery({
        ws: invalid.ws, session: activeSession(), message: query({ since }),
      });
      expect(invalid.replies).toEqual([{
        type: 'resource:provenance:error', version: 1, code: 'invalid_request',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      }]);
      expect(invalid.pathNormalizer.normalize).not.toHaveBeenCalled();
      expect(invalid.repository.query).not.toHaveBeenCalled();
    },
  );

  test('returns fixed query_failed for repository errors', async () => {
    const writeDiagnostic = jest.fn();
    const failed = createHarness({
      repository: { query: jest.fn(async () => { throw new Error('SQL and snapshot secret'); }) },
      writeDiagnostic,
    });
    await failed.route.handleQuery({ ws: failed.ws, session: activeSession(), message: query() });
    expect(failed.replies[0]).toEqual({
      type: 'resource:provenance:error', version: 1, code: 'query_failed',
      requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
    });
    expect(JSON.stringify(failed.replies)).not.toContain('secret');
    expect(writeDiagnostic).toHaveBeenCalledWith('resource_provenance_query_failed');
  });

  test('distinguishes typed selector rejection from path-normalizer infrastructure failure', async () => {
    const selectorDiagnostic = jest.fn();
    const selector = createHarness({
      pathNormalizer: {
        normalize: jest.fn(async () => {
          throw new ProvenanceQuerySelectorError('path leaves its authority root');
        }),
      },
      writeDiagnostic: selectorDiagnostic,
    });
    await selector.route.handleQuery({
      ws: selector.ws, session: activeSession(), message: query({ panel: 'file-viewer', path: 'a.md' }),
    });
    expect(selector.replies).toEqual([{
      type: 'resource:provenance:error', version: 1, code: 'invalid_request',
      requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
    }]);
    expect(selectorDiagnostic).not.toHaveBeenCalled();
    expect(selector.repository.query).not.toHaveBeenCalled();

    const infrastructureDiagnostic = jest.fn();
    const infrastructure = createHarness({
      pathNormalizer: {
        normalize: jest.fn(async () => { throw new Error('registry and filesystem secret'); }),
      },
      writeDiagnostic: infrastructureDiagnostic,
    });
    await infrastructure.route.handleQuery({
      ws: infrastructure.ws,
      session: activeSession(),
      message: query({ panel: 'file-viewer', path: 'a.md' }),
    });
    expect(infrastructure.replies).toEqual([{
      type: 'resource:provenance:error', version: 1, code: 'query_failed',
      requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
    }]);
    expect(JSON.stringify(infrastructure.replies)).not.toContain('secret');
    expect(infrastructureDiagnostic).toHaveBeenCalledWith('resource_provenance_query_failed');
    expect(infrastructure.repository.query).not.toHaveBeenCalled();
  });

  test('production panel stat failure returns fixed query_failed and only its bounded diagnostic', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-query-route-stat-'));
    const statFailure = Object.assign(new Error('filesystem secret'), { code: 'EIO' });
    const stat = jest.spyOn(fs, 'statSync').mockImplementation(() => { throw statFailure; });
    try {
      const writeDiagnostic = jest.fn();
      const harness = createHarness({
        pathNormalizer: createProvenanceQueryPathNormalizer({
          getWorkspaceById: async () => ({ repoPath: root }),
        }),
        writeDiagnostic,
      });
      await harness.route.handleQuery({
        ws: harness.ws,
        session: activeSession(),
        message: query({ panel: '__apps__', path: 'a.md' }),
      });
      expect(harness.replies).toEqual([{
        type: 'resource:provenance:error', version: 1, code: 'query_failed',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      }]);
      expect(writeDiagnostic.mock.calls).toEqual([['resource_provenance_query_failed']]);
      expect(JSON.stringify(harness.replies)).not.toContain('secret');
      expect(harness.repository.query).not.toHaveBeenCalled();
    } finally {
      stat.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('production V2 manifest EIO returns fixed query_failed instead of unknown-panel rejection', async () => {
    const workspace = createV2Workspace();
    const readFileSync = fs.readFileSync.bind(fs);
    const manifestFailure = Object.assign(new Error('manifest filesystem secret'), { code: 'EIO' });
    const read = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...args) => {
      if (path.resolve(String(filePath)) === path.resolve(workspace.manifestPath)) throw manifestFailure;
      return readFileSync(filePath, ...args);
    });
    try {
      const writeDiagnostic = jest.fn();
      const harness = createHarness({
        pathNormalizer: createProvenanceQueryPathNormalizer({
          getWorkspaceById: async () => ({ repoPath: workspace.root }),
        }),
        writeDiagnostic,
      });
      await harness.route.handleQuery({
        ws: harness.ws,
        session: activeSession(),
        message: query({ panel: 'office-viewer', path: 'a.md' }),
      });
      expect(harness.replies).toEqual([{
        type: 'resource:provenance:error', version: 1, code: 'query_failed',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      }]);
      expect(writeDiagnostic.mock.calls).toEqual([['resource_provenance_query_failed']]);
      expect(JSON.stringify(harness.replies)).not.toContain('secret');
      expect(harness.repository.query).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      fs.rmSync(workspace.root, { recursive: true, force: true });
    }
  });

  test('production V2 Views-directory EIO returns fixed query_failed', async () => {
    const workspace = createV2Workspace();
    const readdirSync = fs.readdirSync.bind(fs);
    const directoryFailure = Object.assign(new Error('directory filesystem secret'), { code: 'EIO' });
    const readdir = jest.spyOn(fs, 'readdirSync').mockImplementation((directoryPath, ...args) => {
      if (path.resolve(String(directoryPath)) === path.resolve(workspace.viewsRoot)) throw directoryFailure;
      return readdirSync(directoryPath, ...args);
    });
    try {
      const writeDiagnostic = jest.fn();
      const harness = createHarness({
        pathNormalizer: createProvenanceQueryPathNormalizer({
          getWorkspaceById: async () => ({ repoPath: workspace.root }),
        }),
        writeDiagnostic,
      });
      await harness.route.handleQuery({
        ws: harness.ws,
        session: activeSession(),
        message: query({ panel: 'office-viewer', path: 'a.md' }),
      });
      expect(harness.replies).toEqual([{
        type: 'resource:provenance:error', version: 1, code: 'query_failed',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      }]);
      expect(writeDiagnostic.mock.calls).toEqual([['resource_provenance_query_failed']]);
      expect(JSON.stringify(harness.replies)).not.toContain('secret');
      expect(harness.repository.query).not.toHaveBeenCalled();
    } finally {
      readdir.mockRestore();
      fs.rmSync(workspace.root, { recursive: true, force: true });
    }
  });

  test('production V2 entry-classification EIO returns fixed query_failed', async () => {
    const workspace = createV2Workspace();
    const viewRoot = path.join(workspace.viewsRoot, '001-office-viewer');
    const lstatSync = fs.lstatSync.bind(fs);
    const classificationFailure = Object.assign(new Error('entry filesystem secret'), { code: 'EIO' });
    const lstat = jest.spyOn(fs, 'lstatSync').mockImplementation((entryPath, ...args) => {
      if (path.resolve(String(entryPath)) === path.resolve(viewRoot)) throw classificationFailure;
      return lstatSync(entryPath, ...args);
    });
    try {
      const writeDiagnostic = jest.fn();
      const harness = createHarness({
        pathNormalizer: createProvenanceQueryPathNormalizer({
          getWorkspaceById: async () => ({ repoPath: workspace.root }),
        }),
        writeDiagnostic,
      });
      await harness.route.handleQuery({
        ws: harness.ws,
        session: activeSession(),
        message: query({ panel: 'office-viewer', path: 'a.md' }),
      });
      expect(harness.replies).toEqual([{
        type: 'resource:provenance:error', version: 1, code: 'query_failed',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      }]);
      expect(writeDiagnostic.mock.calls).toEqual([['resource_provenance_query_failed']]);
      expect(JSON.stringify(harness.replies)).not.toContain('secret');
      expect(harness.repository.query).not.toHaveBeenCalled();
    } finally {
      lstat.mockRestore();
      fs.rmSync(workspace.root, { recursive: true, force: true });
    }
  });

  test('a truly unknown V2 panel remains invalid_request without an infrastructure diagnostic', async () => {
    const workspace = createV2Workspace();
    try {
      const writeDiagnostic = jest.fn();
      const harness = createHarness({
        pathNormalizer: createProvenanceQueryPathNormalizer({
          getWorkspaceById: async () => ({ repoPath: workspace.root }),
        }),
        writeDiagnostic,
      });
      await harness.route.handleQuery({
        ws: harness.ws,
        session: activeSession(),
        message: query({ panel: 'unknown-viewer', path: 'a.md' }),
      });
      expect(harness.replies).toEqual([{
        type: 'resource:provenance:error', version: 1, code: 'invalid_request',
        requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
      }]);
      expect(writeDiagnostic).not.toHaveBeenCalled();
      expect(harness.repository.query).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(workspace.root, { recursive: true, force: true });
    }
  });

  test('registry validation exception returns fixed query_failed without retry or route diagnostic', async () => {
    const validatePayload = jest.fn(async () => { throw new Error('registry secret'); });
    const writeDiagnostic = jest.fn();
    const harness = createHarness({ validatePayload, writeDiagnostic });
    await harness.route.handleQuery({
      ws: harness.ws, session: activeSession(), message: query(),
    });
    expect(harness.replies).toEqual([{
      type: 'resource:provenance:error', version: 1, code: 'query_failed',
      requestId: 'request-1', workspaceId: 'workspace-a', workspaceEpoch: A1,
    }]);
    expect(validatePayload).toHaveBeenCalledTimes(1);
    expect(writeDiagnostic.mock.calls).toEqual([['resource_provenance_query_failed']]);
    expect(JSON.stringify(harness.replies)).not.toContain('secret');
    expect(harness.ws.close).not.toHaveBeenCalled();
  });

  test.each([
    ['A to B', activeSession('workspace-b', B1)],
    ['A to B to A', activeSession('workspace-a', A2)],
  ])('binds a held %s query to the captured A1 pair', async (_label, replacement) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const validate = createPayloadValidator(definition, 'resource:provenance');
    let heldOnce = false;
    const harness = createHarness({
      validatePayload: async (_reference, value) => {
        if (value.type === 'resource:provenance:query' && !heldOnce) {
          heldOnce = true;
          await held;
        }
        return validate(value);
      },
    });
    const session = activeSession();
    const pending = harness.route.handleQuery({ ws: harness.ws, session, message: query() });
    await Promise.resolve();
    Object.assign(session, replacement);
    release();
    await pending;
    expect(harness.repository.query).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-a' }));
    expect(harness.replies[0]).toMatchObject({ workspaceId: 'workspace-a', workspaceEpoch: A1 });
  });
});
