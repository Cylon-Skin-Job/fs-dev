'use strict';

/**
 * CHAT-03 / SPEC-03 §7, §11 — thread worksurface state integration.
 *
 * Proves the registered `state:worksurface_*` route family over a real temp
 * workspace + real view-state files: get/put, content CAS, lane-preserving
 * merge, the narrow managed-placement command, bounded limits/abuse rejects,
 * key isolation across views and workspaces, qualified lane-specific fan-out
 * with no `surfaceId`, and restart/readback of only acknowledged content.
 *
 * No dev database, owner workspace, or Alpha profile is touched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const MACHINE = 'Test-Machine';

function writeManifest(folder, viewId) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'manifest.md'), [
    '---',
    `name: ${viewId}`,
    'metadata:',
    `  view-id: ${viewId}`,
    '---',
    '',
  ].join('\n'));
}

function makeProjectRoot(label) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `fusion-worksurface-${label}-`)));
  const viewsRoot = path.join(root, 'ai', MACHINE, 'System', 'Views');
  writeManifest(path.join(viewsRoot, '001-file-viewer'), 'file-viewer');
  writeManifest(path.join(viewsRoot, '002-wiki-viewer'), 'wiki-viewer');
  return root;
}

function statePath(projectRoot, viewId) {
  const folder = `${viewId === 'file-viewer' ? '001-file-viewer' : '002-wiki-viewer'}`;
  return path.join(projectRoot, 'ai', MACHINE, 'System', 'Views', folder, 'state', 'state.json');
}

function createSocket() {
  return {
    readyState: 1,
    sent: [],
    send(message) { this.sent.push(JSON.parse(message)); },
  };
}

function createSession(projectRoot, workspaceId, role) {
  const session = { projectRoot, currentWorkspaceId: workspaceId };
  Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });
  return session;
}

const CONTENT = {
  schemaVersion: 1,
  tabs: [{ id: 'file-viewer:ai/Notes.md', panel: 'file-viewer', path: 'ai/Notes.md', title: 'Notes.md', kind: 'file', openedAt: 1 }],
  activeTabId: 'file-viewer:ai/Notes.md',
};

describe('thread worksurface state routes', () => {
  let projectRoot;
  let secondRoot;
  let previousMachine;
  let createWorkspaceRequestHandlers;
  let consoleErrorSpy;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    projectRoot = makeProjectRoot('primary');
    secondRoot = makeProjectRoot('secondary');
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.resetModules();
    const readiness = require('../../lib/views/readiness-runtime');
    const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
    const coordinator = createViewReadinessCoordinator({
      machineIdentity: MACHINE,
      migrationService: {
        ensureReady: async (request) => ({
          ...request,
          status: 'verified',
          destinationRoot: path.join(request.projectRoot, 'ai', MACHINE, 'System', 'Views'),
        }),
      },
    });
    readiness.installViewReadinessOwner(coordinator);
    await readiness.ensureWorkspaceViewReadiness({ workspaceId: 'workspace-a', projectRoot });
    await readiness.ensureWorkspaceViewReadiness({ workspaceId: 'workspace-b', projectRoot: secondRoot });
    ({ createWorkspaceRequestHandlers } = require('../../lib/ws/workspace-request-handlers'));
  });

  afterEach(() => {
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
    consoleErrorSpy.mockRestore();
    jest.resetModules();
  });

  function harness({
    role = 'trusted-shell',
    root = projectRoot,
    workspaceId = 'workspace-a',
    recipients = [],
  } = {}) {
    const ws = createSocket();
    ws.__wid = workspaceId;
    const session = createSession(root, workspaceId, role);
    const clients = [ws, ...recipients.map((r) => r.ws)];
    const handlers = createWorkspaceRequestHandlers({
      ws,
      session,
      getAllClients: (id) => clients.filter((client) => id === undefined || client.__wid === id),
    });
    return { ws, session, handlers, recipients };
  }

  function recipientSocket(workspaceId) {
    const ws = createSocket();
    ws.__wid = workspaceId;
    return { ws };
  }

  const putFrame = (overrides = {}) => ({
    type: 'state:worksurface_put',
    viewId: 'file-viewer',
    threadGroupId: 'group-1',
    requestId: 'put-1',
    expectedContentRevision: null,
    adapterId: 'file-viewer',
    adapterVersion: 1,
    content: CONTENT,
    ...overrides,
  });

  test('content PUT creates a capsule entry and GET reads it back with two empty/independent lanes', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const result = ws.sent[0];
    expect(result).toMatchObject({
      type: 'state:worksurface_result',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      workspaceId: 'workspace-a',
      requestId: 'put-1',
      lane: 'content',
      applied: true,
    });
    expect(result.contentRevision).toMatch(/^wsr_/);
    expect(result.placementRevision).toMatch(/^wsr_/);

    await handlers['state:worksurface_get']({
      type: 'state:worksurface_get', viewId: 'file-viewer', threadGroupId: 'group-1', requestId: 'get-1',
    });
    const read = ws.sent[1];
    expect(read).toMatchObject({
      type: 'state:worksurface_result',
      lane: 'content',
      requestId: 'get-1',
      contentRevision: result.contentRevision,
      placementRevision: result.placementRevision,
    });
    expect(read.entry).toMatchObject({
      schemaVersion: 1,
      adapterId: 'file-viewer',
      adapterVersion: 1,
      content: CONTENT,
      managedComponentPlacements: {},
    });
    expect(read.entry.updatedAt).toEqual(expect.any(String));

    // Persisted inside the view capsule state document, not a second store.
    const file = JSON.parse(fs.readFileSync(statePath(projectRoot, 'file-viewer'), 'utf8'));
    expect(file.threadWorksurfaces['group-1'].content).toEqual(CONTENT);
    // No chat/provenance/transient identity leaks into either lane.
    expect(JSON.stringify(file)).not.toContain('surfaceId');
    expect(JSON.stringify(file)).not.toContain('"threadId"');
  });

  test('stale content revision is rejected with the current revision and entry', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const first = ws.sent[0];
    ws.sent.length = 0;

    await handlers['state:worksurface_put'](putFrame({
      requestId: 'put-2',
      expectedContentRevision: null,
      content: { ...CONTENT, activeTabId: null },
    }));

    expect(ws.sent[0]).toMatchObject({
      type: 'state:worksurface_error',
      code: 'revision_conflict',
      lane: 'content',
      contentRevision: first.contentRevision,
    });
    expect(ws.sent[0].entry.content).toEqual(CONTENT);
    const file = JSON.parse(fs.readFileSync(statePath(projectRoot, 'file-viewer'), 'utf8'));
    expect(file.threadWorksurfaces['group-1'].contentRevision).toBe(first.contentRevision);
  });

  test('an identical capture acknowledges the current revision without a new write', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const first = ws.sent[0];
    ws.sent.length = 0;

    await handlers['state:worksurface_put'](putFrame({
      requestId: 'put-identical',
      expectedContentRevision: null,
    }));

    expect(ws.sent[0]).toMatchObject({
      type: 'state:worksurface_result',
      applied: false,
      acknowledged: true,
      contentRevision: first.contentRevision,
    });
  });

  test('content and placement lanes merge without erasing each other', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const contentAck = ws.sent[0];
    ws.sent.length = 0;

    await handlers['state:worksurface_placement']({
      type: 'state:worksurface_placement',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      requestId: 'place-1',
      placementId: 'placement-1',
      expectedPlacementRevision: contentAck.placementRevision,
      operation: 'upsert',
      descriptor: { kind: 'side-chat', threadId: 'thread-1' },
    });
    const placed = ws.sent[0];
    expect(placed).toMatchObject({ type: 'state:worksurface_result', lane: 'placement', applied: true });
    expect(placed.contentRevision).toBe(contentAck.contentRevision);
    expect(placed.placementRevision).not.toBe(contentAck.placementRevision);
    expect(placed.entry.managedComponentPlacements['placement-1']).toMatchObject({ disposition: 'open' });

    ws.sent.length = 0;
    await handlers['state:worksurface_put'](putFrame({
      requestId: 'put-2',
      expectedContentRevision: contentAck.contentRevision,
      content: { tabs: [], activeTabId: null },
    }));
    const contentB = ws.sent[0];
    expect(contentB.applied).toBe(true);
    expect(contentB.contentRevision).not.toBe(contentAck.contentRevision);
    // Content PUT preserved the service-owned placement lane and its revision.
    expect(contentB.placementRevision).toBe(placed.placementRevision);
    expect(contentB.entry.managedComponentPlacements['placement-1']).toMatchObject({ disposition: 'open' });
    expect(contentB.entry.content).toEqual({ tabs: [], activeTabId: null });
  });

  test('placement CAS rejects a stale revision and close stores a disposition', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const base = ws.sent[0];
    ws.sent.length = 0;
    const upsertFrame = {
      type: 'state:worksurface_placement',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      requestId: 'place-1',
      placementId: 'placement-1',
      expectedPlacementRevision: base.placementRevision,
      operation: 'upsert',
      descriptor: { kind: 'side-chat' },
    };
    await handlers['state:worksurface_placement'](upsertFrame);
    const placed = ws.sent[0];
    ws.sent.length = 0;

    await handlers['state:worksurface_placement']({ ...upsertFrame, requestId: 'place-stale', expectedPlacementRevision: null });
    expect(ws.sent[0]).toMatchObject({ code: 'revision_conflict', lane: 'placement' });

    ws.sent.length = 0;
    await handlers['state:worksurface_placement']({
      ...upsertFrame,
      requestId: 'place-close',
      expectedPlacementRevision: placed.placementRevision,
      operation: 'close',
      descriptor: undefined,
    });
    const closed = ws.sent[0];
    expect(closed).toMatchObject({ type: 'state:worksurface_result', applied: true });
    const record = closed.entry.managedComponentPlacements['placement-1'];
    expect(record).toMatchObject({ disposition: 'closed' });
    expect(record.descriptor).toMatchObject({ kind: 'side-chat' });

    ws.sent.length = 0;
    await handlers['state:worksurface_placement']({
      ...upsertFrame,
      requestId: 'place-close-missing',
      placementId: 'missing',
      expectedPlacementRevision: closed.placementRevision,
      operation: 'close',
      descriptor: undefined,
    });
    expect(ws.sent[0]).toMatchObject({ code: 'not_found', lane: 'placement' });
  });

  test('concurrent content and placement mutations preserve both lanes', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const base = ws.sent[0];
    ws.sent.length = 0;

    await Promise.all([
      handlers['state:worksurface_put'](putFrame({
        requestId: 'concurrent-content',
        expectedContentRevision: base.contentRevision,
        content: { tabs: [], activeTabId: null },
      })),
      handlers['state:worksurface_placement']({
        type: 'state:worksurface_placement',
        viewId: 'file-viewer',
        threadGroupId: 'group-1',
        requestId: 'concurrent-placement',
        placementId: 'placement-1',
        expectedPlacementRevision: base.placementRevision,
        operation: 'upsert',
        descriptor: { kind: 'side-chat' },
      }),
    ]);

    const applied = ws.sent.filter((message) => message.type === 'state:worksurface_result'
      && message.applied);
    expect(applied).toHaveLength(2);

    ws.sent.length = 0;
    await handlers['state:worksurface_get']({
      type: 'state:worksurface_get', viewId: 'file-viewer', threadGroupId: 'group-1', requestId: 'final',
    });
    expect(ws.sent[0].entry.content).toEqual({ tabs: [], activeTabId: null });
    expect(ws.sent[0].entry.managedComponentPlacements['placement-1']).toMatchObject({ disposition: 'open' });
  });

  test('a placement upsert creates an entry for an adapterless/never-changed group without an entry precondition', async () => {
    const { ws, handlers } = harness();
    const placementFrame = {
      type: 'state:worksurface_placement',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      requestId: 'place-1',
      placementId: 'placement-1',
      expectedPlacementRevision: null,
      operation: 'upsert',
      descriptor: { kind: 'side-chat' },
    };
    // No prior content PUT: SPEC-04 may place into a group that never had
    // adapter content (adapterless views / unchanged group).
    await handlers['state:worksurface_placement'](placementFrame);
    const created = ws.sent[0];
    expect(created).toMatchObject({ type: 'state:worksurface_result', lane: 'placement', applied: true });
    expect(created.entry).toMatchObject({ adapterId: 'service-managed', content: null });
    expect(created.entry.managedComponentPlacements['placement-1']).toMatchObject({ disposition: 'open' });

    // A later content PUT preserves the service-owned placement lane.
    ws.sent.length = 0;
    await handlers['state:worksurface_put'](putFrame({ expectedContentRevision: created.contentRevision }));
    const afterContent = ws.sent[0];
    expect(afterContent.entry.managedComponentPlacements['placement-1']).toMatchObject({ disposition: 'open' });

    // A close of a missing placement is bounded; an invalid descriptor is rejected.
    ws.sent.length = 0;
    await handlers['state:worksurface_placement']({
      ...placementFrame,
      requestId: 'close-missing',
      placementId: 'missing',
      expectedPlacementRevision: afterContent.placementRevision,
      operation: 'close',
      descriptor: undefined,
    });
    expect(ws.sent[0]).toMatchObject({ code: 'not_found', lane: 'placement' });

    ws.sent.length = 0;
    await handlers['state:worksurface_placement']({
      ...placementFrame,
      requestId: 'bad-descriptor',
      descriptor: { fn: () => 1 },
    });
    expect(ws.sent[0]).toMatchObject({ code: 'invalid_descriptor', lane: 'placement' });
  });

  test('bounded abuse rejects leave no effects', async () => {
    const { ws, handlers } = harness();
    const cases = [
      [{ adapterId: 'UPPER' }, 'invalid_adapter'],
      [{ adapterVersion: 0 }, 'invalid_adapter'],
      [{ content: { fn: () => 1 } }, 'content_invalid'],
      [{ content: { big: 'x'.repeat(256 * 1024 + 1) } }, 'content_too_large'],
      [{ viewId: null }, 'invalid_view'],
      [{ threadGroupId: '' }, 'invalid_request'],
    ];
    for (const [override, code] of cases) {
      ws.sent.length = 0;
      await handlers['state:worksurface_put'](putFrame({ ...override, requestId: `abuse-${code}` }));
      expect(ws.sent[0]).toMatchObject({ type: 'state:worksurface_error', code });
    }
    expect(fs.existsSync(statePath(projectRoot, 'file-viewer'))).toBe(false);
  });

  test('untrusted callers cannot mutate content or placement', async () => {
    const { ws, handlers } = harness({ role: 'untrusted' });
    await handlers['state:worksurface_put'](putFrame());
    expect(ws.sent[0]).toMatchObject({ type: 'error', code: 'VIEW_MUTATION_DENIED' });
    ws.sent.length = 0;
    await handlers['state:worksurface_placement']({
      type: 'state:worksurface_placement',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      requestId: 'place-1',
      placementId: 'placement-1',
      expectedPlacementRevision: null,
      operation: 'upsert',
      descriptor: { kind: 'side-chat' },
    });
    expect(ws.sent[0]).toMatchObject({ type: 'error', code: 'VIEW_MUTATION_DENIED' });
    expect(fs.existsSync(statePath(projectRoot, 'file-viewer'))).toBe(false);
  });

  test('the same group id cannot cross two views or two workspaces', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame({ content: { marker: 'file-viewer' } }));
    await handlers['state:worksurface_put'](putFrame({
      viewId: 'wiki-viewer', requestId: 'wiki-put', content: { marker: 'wiki-viewer' },
    }));
    const fileEntry = ws.sent[0];
    const wikiEntry = ws.sent[1];
    expect(fileEntry.viewId).toBe('file-viewer');
    expect(wikiEntry.viewId).toBe('wiki-viewer');

    const second = harness({ root: secondRoot, workspaceId: 'workspace-b' });
    await second.handlers['state:worksurface_put'](putFrame({ content: { marker: 'workspace-b' } }));
    expect(second.ws.sent[0]).toMatchObject({ workspaceId: 'workspace-b' });

    const fileState = JSON.parse(fs.readFileSync(statePath(projectRoot, 'file-viewer'), 'utf8'));
    const wikiState = JSON.parse(fs.readFileSync(statePath(projectRoot, 'wiki-viewer'), 'utf8'));
    const secondState = JSON.parse(fs.readFileSync(statePath(secondRoot, 'file-viewer'), 'utf8'));
    expect(fileState.threadWorksurfaces['group-1'].content).toEqual({ marker: 'file-viewer' });
    expect(wikiState.threadWorksurfaces['group-1'].content).toEqual({ marker: 'wiki-viewer' });
    expect(secondState.threadWorksurfaces['group-1'].content).toEqual({ marker: 'workspace-b' });
    expect(fileEntry.contentRevision).not.toBe(wikiEntry.contentRevision);
  });

  test('qualified lane-specific fan-out carries durable identities and revisions only', async () => {
    const peer = recipientSocket('workspace-a');
    const foreign = recipientSocket('workspace-b');
    const { ws, handlers } = harness({ recipients: [peer, foreign] });
    await handlers['state:worksurface_put'](putFrame());

    expect(peer.ws.sent).toHaveLength(1);
    expect(peer.ws.sent[0]).toEqual({
      type: 'state:worksurface_changed',
      workspaceId: 'workspace-a',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      lane: 'content',
      contentRevision: ws.sent[0].contentRevision,
      placementRevision: ws.sent[0].placementRevision,
    });
    expect(peer.ws.sent[0].entry).toBeUndefined();
    expect(foreign.ws.sent).toEqual([]);
    expect(JSON.stringify([...ws.sent, ...peer.ws.sent])).not.toContain('surfaceId');
    expect(JSON.stringify([...ws.sent, ...peer.ws.sent])).not.toContain('threadId');
  });

  test('the requester receives no changed fan-out for its own write; the broadcast is revision-qualified', async () => {
    const peer = recipientSocket('workspace-a');
    const { ws, handlers } = harness({ recipients: [peer] });
    await handlers['state:worksurface_put'](putFrame());
    // The originating connection receives only its correlated result.
    expect(ws.sent.filter((message) => message.type === 'state:worksurface_changed')).toHaveLength(0);
    const result = ws.sent[0];
    // A receiving window gets durable identities + lane revisions only.
    expect(peer.ws.sent[0]).toEqual({
      type: 'state:worksurface_changed',
      workspaceId: 'workspace-a',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      lane: 'content',
      contentRevision: result.contentRevision,
      placementRevision: result.placementRevision,
    });
    expect(peer.ws.sent[0].entry).toBeUndefined();
    expect(JSON.stringify(peer.ws.sent)).not.toContain('surfaceId');
  });

  test('a placement mutation broadcasts its own qualified lane and revisions', async () => {
    const peer = recipientSocket('workspace-a');
    const { ws, handlers } = harness({ recipients: [peer] });
    await handlers['state:worksurface_put'](putFrame());
    const base = ws.sent[0];
    ws.sent.length = 0;
    peer.ws.sent.length = 0;

    await handlers['state:worksurface_placement']({
      type: 'state:worksurface_placement',
      viewId: 'file-viewer',
      threadGroupId: 'group-1',
      requestId: 'place-fanout',
      placementId: 'placement-1',
      expectedPlacementRevision: base.placementRevision,
      operation: 'upsert',
      descriptor: { kind: 'side-chat' },
    });
    const placed = ws.sent[0];
    expect(peer.ws.sent[0]).toMatchObject({
      type: 'state:worksurface_changed',
      lane: 'placement',
      // A placement fan-out cannot acknowledge or replace the content lane.
      contentRevision: base.contentRevision,
      placementRevision: placed.placementRevision,
    });
    // The placement fan-out preserves the content revision untouched.
    expect(peer.ws.sent[0].contentRevision).toBe(placed.contentRevision);
    expect(peer.ws.sent[0].entry).toBeUndefined();
  });

  test('restart/readback restores only the acknowledged schema-valid content with no chat leakage', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_put'](putFrame());
    const acknowledged = ws.sent[0];

    // Fresh handler family (new "process") over the same on-disk workspace.
    const restarted = harness();
    await restarted.handlers['state:worksurface_get']({
      type: 'state:worksurface_get', viewId: 'file-viewer', threadGroupId: 'group-1', requestId: 'restart-get',
    });
    const read = restarted.ws.sent[0];
    expect(read.contentRevision).toBe(acknowledged.contentRevision);
    expect(read.entry.content).toEqual(CONTENT);
    const serialized = JSON.stringify(read.entry);
    for (const forbidden of ['surfaceId', 'threadId', 'transcript', 'messages', 'draft', 'attachments', 'runtime']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('absent entries read as null and Legacy produces no entry or write', async () => {
    const { ws, handlers } = harness();
    await handlers['state:worksurface_get']({
      type: 'state:worksurface_get', viewId: 'file-viewer', threadGroupId: 'missing', requestId: 'g',
    });
    expect(ws.sent[0]).toMatchObject({
      type: 'state:worksurface_result', entry: null, contentRevision: null, placementRevision: null,
    });
    expect(fs.existsSync(statePath(projectRoot, 'file-viewer'))).toBe(false);

    ws.sent.length = 0;
    await handlers['state:worksurface_put'](putFrame({ viewId: null }));
    expect(ws.sent[0]).toMatchObject({ type: 'state:worksurface_error', code: 'invalid_view' });
    expect(fs.existsSync(statePath(projectRoot, 'file-viewer'))).toBe(false);
  });
});
