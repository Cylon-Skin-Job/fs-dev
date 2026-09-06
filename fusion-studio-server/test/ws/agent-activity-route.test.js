'use strict';

const definition = require('../../lib/event-registry/schemas/agent-activity-v1.json');
const { createPayloadValidator } = require('../../lib/event-registry/schema-validator');
const { createAgentActivityRoute } = require('../../lib/ws/agent-activity-route');
const { ProvenanceQuerySelectorError } = require('../../lib/ledger/provenance-query-paths');

const A1 = '123e4567-e89b-42d3-a456-426614174001';
const A2 = '123e4567-e89b-42d3-a456-426614174002';
const B1 = '123e4567-e89b-42d3-a456-426614174003';

function activeSession(workspaceId = 'workspace-a', workspaceEpoch = A1) {
  return {
    currentWorkspaceId: workspaceId, workspaceEpoch, workspaceBindingState: 'active',
    workspaceReplyFlushState: 'idle', workspaceReplyBuffer: [], workspaceReplyBufferBytes: 0,
  };
}

function query(overrides = {}) {
  return {
    type: 'agent:activity:query', version: 1, requestId: 'request-1',
    workspaceId: 'workspace-a', workspaceEpoch: A1, subject: 'tool_calls',
    ...overrides,
  };
}

function harness(overrides = {}) {
  const validate = createPayloadValidator(definition, 'agent:activity');
  const replies = [];
  const repository = overrides.repository || { query: jest.fn(async () => ({ items: [] })) };
  const pathNormalizer = overrides.pathNormalizer || {
    normalize: jest.fn(async ({ path, folderPrefix }) => ({
      ...(path == null ? {} : { canonicalPath: `canonical/${path}` }),
      ...(folderPrefix == null ? {} : { folderPrefix: folderPrefix === '' ? '' : `canonical/${folderPrefix}` }),
    })),
  };
  const registryAccess = overrides.registryAccess || {
    validatePayload: jest.fn(async (_reference, value) => validate(value)),
  };
  const sendReply = jest.fn(async (_ws, _session, value) => { replies.push(value); return true; });
  const writeDiagnostic = jest.fn();
  const ws = { close: jest.fn(), readyState: 1 };
  const route = createAgentActivityRoute({ registryAccess, repository, pathNormalizer, sendReply, writeDiagnostic });
  return { pathNormalizer, registryAccess, replies, repository, route, sendReply, writeDiagnostic, ws };
}

describe('agent activity public WebSocket route', () => {
  test('normalizes selectors, queries only captured workspace authority, and returns exact subject result', async () => {
    const h = harness({ repository: { query: jest.fn(async () => ({ items: [], nextCursor: '9' })) } });
    await h.route.handleQuery({
      ws: h.ws,
      session: activeSession(),
      message: query({
        subject: 'resource_edges', panel: 'file-viewer', path: 'docs/a.txt', folderPrefix: '',
        fileName: 'a.txt', threadId: 'thread-1', statuses: ['completed'],
        accessFamilies: ['read', 'write'], changedOnly: false, cursor: '10', limit: 1,
      }),
    });
    expect(h.repository.query).toHaveBeenCalledWith({
      workspaceId: 'workspace-a', subject: 'resource_edges', path: 'canonical/docs/a.txt', folderPrefix: '',
      fileName: 'a.txt', threadId: 'thread-1', statuses: ['completed'],
      accessFamilies: ['read', 'write'], changedOnly: false, cursor: '10', limit: 1,
    });
    expect(h.replies).toEqual([{
      type: 'agent:activity:result', version: 1, requestId: 'request-1',
      workspaceId: 'workspace-a', workspaceEpoch: A1, subject: 'resource_edges', items: [], nextCursor: '9',
    }]);
  });

  test.each([
    [{ type: 'agent:activity:query', version: 1 }, undefined],
    [query({ version: 2 }), 'request-1'],
    [query({ workspaceEpoch: 'invalid' }), 'request-1'],
  ])('uses pair-free invalid-request for an invalid envelope', async (message, requestId) => {
    const h = harness();
    await h.route.handleQuery({ ws: h.ws, session: activeSession(), message });
    expect(h.repository.query).not.toHaveBeenCalled();
    expect(h.replies).toEqual([{
      type: 'agent:activity:error', version: 1, code: 'invalid_request',
      ...(requestId ? { requestId } : {}),
    }]);
  });

  test('distinguishes unavailable and stale workspace pairs before selector validation', async () => {
    const unavailable = harness();
    await unavailable.route.handleQuery({ ws: unavailable.ws, session: {}, message: query({ bogus: true }) });
    expect(unavailable.replies[0]).toEqual({
      type: 'agent:activity:error', version: 1, code: 'workspace_unavailable', requestId: 'request-1',
    });
    const stale = harness();
    await stale.route.handleQuery({ ws: stale.ws, session: activeSession('workspace-b', B1), message: query({ bogus: true }) });
    expect(stale.replies[0]).toEqual({
      type: 'agent:activity:error', version: 1, code: 'stale_workspace', requestId: 'request-1',
      workspaceId: 'workspace-b', workspaceEpoch: B1,
    });
  });

  test.each([
    { bogus: true }, { path: null }, { statuses: [] }, { statuses: ['completed', 'completed'] },
    { folderPrefix: '.' }, { folderPrefix: '/' }, { limit: 101 }, { since: 2, until: 1 },
    { cursor: '01' }, { cursor: '99999999999999999999' }, { fileName: 'docs/a.txt' },
  ])('rejects strict selector shape before repository query: %p', async (selector) => {
    const h = harness();
    await h.route.handleQuery({ ws: h.ws, session: activeSession(), message: query(selector) });
    expect(h.repository.query).not.toHaveBeenCalled();
    expect(h.replies[0]).toMatchObject({
      type: 'agent:activity:error', code: 'invalid_request',
      workspaceId: 'workspace-a', workspaceEpoch: A1,
    });
  });

  test('reports panel/path normalization rejection as invalid and authority failure as query_failed', async () => {
    const invalid = harness({ pathNormalizer: { normalize: jest.fn(async () => { throw new ProvenanceQuerySelectorError('bad'); }) } });
    await invalid.route.handleQuery({ ws: invalid.ws, session: activeSession(), message: query({ panel: 'file-viewer', path: 'a.txt' }) });
    expect(invalid.replies[0]).toMatchObject({ code: 'invalid_request' });
    const failed = harness({ pathNormalizer: { normalize: jest.fn(async () => { throw new Error('secret root'); }) } });
    await failed.route.handleQuery({ ws: failed.ws, session: activeSession(), message: query({ panel: 'file-viewer', path: 'a.txt' }) });
    expect(failed.replies[0]).toMatchObject({ code: 'query_failed' });
    expect(JSON.stringify(failed.replies)).not.toContain('secret root');
    expect(failed.writeDiagnostic).toHaveBeenCalledWith('agent_activity_query_failed');
  });

  test('query failure is fixed and value-free', async () => {
    const h = harness({ repository: { query: jest.fn(async () => { throw new Error('raw args: password'); }) } });
    await h.route.handleQuery({ ws: h.ws, session: activeSession(), message: query() });
    expect(h.replies[0]).toMatchObject({ code: 'query_failed', workspaceId: 'workspace-a', workspaceEpoch: A1 });
    expect(JSON.stringify(h.replies)).not.toContain('password');
  });

  test('inactive registered schema closes instead of running the query', async () => {
    const h = harness({ registryAccess: { validatePayload: jest.fn(async () => ({ valid: false, errors: [{ code: 'schema_inactive' }] })) } });
    await h.route.handleQuery({ ws: h.ws, session: activeSession(), message: query() });
    expect(h.repository.query).not.toHaveBeenCalled();
    expect(h.ws.close).toHaveBeenCalledWith(1011, 'agent activity authority unavailable');
  });

  test.each([
    ['A to B', activeSession('workspace-b', B1)],
    ['A to B to A', activeSession('workspace-a', A2)],
  ])('held %s query keeps the captured A1 authority and response pair', async (_label, replacement) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const h = harness({ repository: { query: jest.fn(async () => { await held; return { items: [] }; }) } });
    const session = activeSession();
    const pending = h.route.handleQuery({ ws: h.ws, session, message: query() });
    await Promise.resolve();
    Object.assign(session, replacement);
    release();
    await pending;
    expect(h.repository.query).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-a' }));
    expect(h.replies[0]).toMatchObject({ workspaceId: 'workspace-a', workspaceEpoch: A1 });
  });
});
