'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { canonicalizeJson, sha256CanonicalJson } = require('../../lib/event-registry/canonical-json');
const { createFileSaveOwner } = require('../../lib/file-mutations/save-owner');
const { createPathAuthority } = require('../../lib/file-mutations/path-authority');
const { createFileSaveRoute } = require('../../lib/ws/file-save-route');
const { beginWorkspaceBind, completeWorkspaceBind } = require('../../lib/ws/workspace-session');
const { createDb, migrate } = require('../resources/test-db');

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH_B = '123e4567-e89b-42d3-a456-426614174001';
const EPOCH_A2 = '123e4567-e89b-42d3-a456-426614174002';

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

function activeSession(epoch = EPOCH_A1) {
  return {
    connectionId: 'connection-1',
    currentWorkspaceId: 'workspace-A',
    workspaceEpoch: epoch,
    projectRoot: '/untrusted',
    workspaceBindingState: 'active',
    workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [],
    workspaceReplyBufferBytes: 0,
  };
}

function request(overrides = {}) {
  return {
    type: 'file_save',
    version: 1,
    requestId: 'save-request-1',
    workspaceId: 'workspace-A',
    workspaceEpoch: EPOCH_A1,
    panel: 'file-viewer',
    path: 'note.md',
    content: 'new text',
    reason: 'manual',
    ...overrides,
  };
}

function exactSuccess(message) {
  return {
    type: 'file_save_response', version: 1, success: true, outcome: 'succeeded',
    requestId: message.requestId, workspaceId: message.workspaceId,
    workspaceEpoch: message.workspaceEpoch, panel: message.panel, path: message.path,
    operationId: '123e4567-e89b-42d3-a456-426614174010',
    commandId: '123e4567-e89b-42d3-a456-426614174011',
    commandAcceptedEventId: '123e4567-e89b-42d3-a456-426614174012',
    resourceEventId: '123e4567-e89b-42d3-a456-426614174013',
    resourceId: '123e4567-e89b-42d3-a456-426614174014',
    fileVersionId: '123e4567-e89b-42d3-a456-426614174015',
    canonicalPath: message.path,
    commandFactState: 'admitted', resourceFactState: 'admitted', ledgerState: 'stored',
    provenanceState: 'complete', checkpointState: 'not_requested',
  };
}

function exactSuccessFromIntent(intent) {
  return exactSuccess({
    requestId: intent.requestId,
    workspaceId: intent.expectedWorkspaceId,
    workspaceEpoch: intent.expectedWorkspaceEpoch,
    panel: intent.panel,
    path: intent.path,
  });
}

describe('public schema-owned file_save@1 route', () => {
  let db;
  let registry;

  beforeEach(async () => {
    db = await migrate(createDb());
    registry = (await createInitializedEventRegistry(db, { now: () => 1_000 })).access;
  });

  afterEach(async () => {
    if (db) await db.destroy();
  });

  test('validates the public request, maps reason to saveReason, and emits an exact response', async () => {
    const seen = [];
    const route = createFileSaveRoute({
      registryAccess: registry,
      fileSaveOwner: {
        async save(input) {
          seen.push(input);
          return exactSuccess(request());
        },
      },
    });
    const ws = socket();
    const session = activeSession();
    const original = request({ content: 'exact \u{1f98a} bytes' });
    await route.handleFileSave({ ws, session, message: original });

    expect(seen).toEqual([{
      session,
      capturedWorkspacePair: { workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1 },
      intent: {
        requestId: 'save-request-1', expectedWorkspaceId: 'workspace-A',
        expectedWorkspaceEpoch: EPOCH_A1, panel: 'file-viewer', path: 'note.md',
        content: 'exact \u{1f98a} bytes', saveReason: 'manual', milestone: undefined,
        clientActionId: undefined, reportedUiContext: undefined,
      },
    }]);
    expect(JSON.parse(ws.sent[0])).toEqual(exactSuccess(request()));
    expect(ws.closes).toEqual([]);
  });

  test('accepts an empty milestone while preserving the reason/milestone coupling', async () => {
    const save = jest.fn(async ({ intent }) => exactSuccess({
      requestId: intent.requestId,
      workspaceId: intent.expectedWorkspaceId,
      workspaceEpoch: intent.expectedWorkspaceEpoch,
      panel: intent.panel,
      path: intent.path,
    }));
    const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: { save } });
    const ws = socket();
    await route.handleFileSave({
      ws,
      session: activeSession(),
      message: request({ reason: 'milestone', milestone: '' }),
    });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      intent: expect.objectContaining({ saveReason: 'milestone', milestone: '' }),
    }));
    expect(JSON.parse(ws.sent[0])).toMatchObject({ success: true, outcome: 'succeeded' });
  });

  test.each([
    ['NUL', 'before\u0000after'],
    ['lone high surrogate', '\ud800'],
    ['lone low surrogate', '\udc00'],
  ])('maps unsupported %s content through the public route before mutation', async (_label, content) => {
    const save = jest.fn();
    const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: { save } });
    const ws = socket();
    await route.handleFileSave({ ws, session: activeSession(), message: request({ content }) });
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
      errorCode: 'unsupported_text', error: 'Only supported UTF-8 text can be saved.', retrySafe: true,
      requestId: 'save-request-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
      panel: 'file-viewer', path: 'note.md',
    });
  });

  test('maps content exceeding 10 MiB of encoded UTF-8 to too_large before mutation', async () => {
    const save = jest.fn();
    const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: { save } });
    const ws = socket();
    await route.handleFileSave({
      ws,
      session: activeSession(),
      message: request({ content: '\u{1f98a}'.repeat(2_621_441) }),
    });
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
      errorCode: 'too_large', error: 'The file exceeds the 10 MiB limit.', retrySafe: true,
      requestId: 'save-request-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
      panel: 'file-viewer', path: 'note.md',
    });
  });

  test.each([
    ['unknown field', { unknown: true }],
    ['null optional', { reason: null }],
    ['wire saveReason', { saveReason: 'manual' }],
    ['missing milestone', { reason: 'milestone' }],
    ['forbidden milestone', { reason: 'manual', milestone: 'release' }],
    ['invalid version', { version: 2 }],
    ['unnormalized path', { path: '../secret.md' }],
  ])('rejects %s before owner mutation', async (_label, change) => {
    const save = jest.fn();
    const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: { save } });
    const ws = socket();
    await route.handleFileSave({ ws, session: activeSession(), message: request(change) });
    expect(save).not.toHaveBeenCalled();
    const response = JSON.parse(ws.sent[0]);
    expect(response).toMatchObject({
      type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
      errorCode: 'invalid_request', error: 'The save request is invalid.', retrySafe: true,
      requestId: 'save-request-1',
    });
    if (_label === 'invalid version') {
      expect(response.workspaceId).toBeUndefined();
      expect(response.workspaceEpoch).toBeUndefined();
    } else {
      expect(response).toMatchObject({ workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1 });
    }
  });

  test('invalid envelope is rejected without relying on request fields for correlation', async () => {
    const save = jest.fn();
    const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: { save } });
    const ws = socket();
    await route.handleFileSave({ ws, session: activeSession(), message: {
      type: 'file_save', version: 1, requestId: null, content: 'secret',
    } });
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
      errorCode: 'invalid_request', error: 'The save request is invalid.', retrySafe: true,
    });
  });

  test('binding, A -> B, and A -> B -> A reject stale intent before owner/path I/O', async () => {
    const save = jest.fn();
    const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: { save } });

    const bindingSession = activeSession();
    beginWorkspaceBind(bindingSession, {
      workspaceId: 'workspace-B', repoPath: '/B', randomUuid: () => EPOCH_B,
    });
    const bindingWs = socket();
    await route.handleFileSave({ ws: bindingWs, session: bindingSession, message: request() });
    expect(JSON.parse(bindingWs.sent[0])).toMatchObject({
      errorCode: 'workspace_unavailable', requestId: 'save-request-1',
    });

    const switched = activeSession(EPOCH_B);
    switched.currentWorkspaceId = 'workspace-B';
    const switchedWs = socket();
    await route.handleFileSave({ ws: switchedWs, session: switched, message: request() });
    expect(JSON.parse(switchedWs.sent[0])).toMatchObject({
      errorCode: 'stale_workspace', workspaceId: 'workspace-B', workspaceEpoch: EPOCH_B,
    });

    const rebound = activeSession(EPOCH_A2);
    const reboundWs = socket();
    await route.handleFileSave({ ws: reboundWs, session: rebound, message: request() });
    expect(JSON.parse(reboundWs.sent[0])).toMatchObject({
      errorCode: 'stale_workspace', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A2,
    });
    expect(save).not.toHaveBeenCalled();
  });

  test('locked schema checksum drift fails closed before mutation', async () => {
    const row = await db('event_schema_registry').where({ schema_key: 'file_save' }).first();
    const drift = { type: 'object', additionalProperties: true };
    await db('event_schema_registry').where({ schema_id: row.schema_id }).update({
      definition_json: canonicalizeJson(drift),
      definition_sha256: sha256CanonicalJson(drift),
    });
    const save = jest.fn();
    const diagnostics = [];
    const route = createFileSaveRoute({
      registryAccess: registry, fileSaveOwner: { save }, writeDiagnostic: (code) => diagnostics.push(code),
    });
    const ws = socket();
    await route.handleFileSave({ ws, session: activeSession(), message: request() });
    expect(save).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([]);
    expect(ws.closes[0][0]).toBe(1011);
    expect(diagnostics).toEqual(['file_save_schema_unavailable']);
  });

  test('owner exceptions and response drift close with fixed diagnostics and never serialize request content', async () => {
    for (const owner of [
      { async save() { throw new Error('secret-content-owner-error'); } },
      { async save(message) { return { ...exactSuccessFromIntent(message.intent), content: 'secret-content-response' }; } },
    ]) {
      const diagnostics = [];
      const ws = socket();
      const route = createFileSaveRoute({
        registryAccess: registry, fileSaveOwner: owner, writeDiagnostic: (code) => diagnostics.push(code),
      });
      await route.handleFileSave({ ws, session: activeSession(), message: request({ content: 'secret-content' }) });
      expect(ws.sent.join('')).not.toContain('secret-content');
      expect(ws.closes[0][0]).toBe(1011);
      expect(diagnostics.length).toBeGreaterThan(0);
    }
  });

  test('direct composition writes through the mediated controller without the retired save broadcast', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-file-save-route-'));
    const facts = [];
    try {
      const owner = createFileSaveOwner({
        db,
        publishResourceRefreshRequired: async () => {},
        controllerOptions: {
          pathAuthority: createPathAuthority({
            getWorkspaceById: async () => ({ id: 'workspace-A', repoPath: root }),
            resolvePanelRoot: (workspaceRoot) => workspaceRoot,
          }),
          checkpoint: { async afterSave() { return 'not_requested'; } },
        },
      });
      owner.installPublishers({
        async publishFileCommandAccepted({ body }) {
          facts.push(body);
          return { admitted: true, eventId: body.eventId, deliveries: [] };
        },
        async publishResourceMutated({ body }) {
          facts.push(body);
          return { admitted: true, eventId: body.eventId, deliveries: [] };
        },
      });
      const route = createFileSaveRoute({ registryAccess: registry, fileSaveOwner: owner });
      const ws = socket();
      await route.handleFileSave({
        ws,
        session: activeSession(),
        message: request({ reason: 'milestone', milestone: 'Release 1' }),
      });
      const response = JSON.parse(ws.sent[0]);
      expect(response).toMatchObject({
        type: 'file_save_response', version: 1, success: true, outcome: 'succeeded',
        requestId: 'save-request-1', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
        panel: 'file-viewer', path: 'note.md', checkpointState: 'not_requested',
      });
      expect(fs.readFileSync(path.join(root, 'note.md'), 'utf8')).toBe('new text');
      expect(facts).toHaveLength(2);
      expect(facts[0].intent).toEqual({ kind: 'save', saveReason: 'milestone', milestone: 'Release 1' });

      const rejectedWs = socket();
      await route.handleFileSave({
        ws: rejectedWs, session: activeSession(), message: request({ requestId: 'bad-path', path: 'missing/note.md' }),
      });
      expect(JSON.parse(rejectedWs.sent[0])).toMatchObject({ success: false, errorCode: 'path_not_allowed' });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('completed paired route reply is held behind an in-progress bind frame', async () => {
    const state = activeSession();
    const ws = socket();
    const pair = beginWorkspaceBind(state, {
      workspaceId: 'workspace-A', repoPath: '/A', randomUuid: () => EPOCH_A2,
    });
    const route = createFileSaveRoute({
      registryAccess: registry,
      fileSaveOwner: { async save(message) { return exactSuccessFromIntent(message.intent); } },
    });
    // A request during binding is rejected immediately and does not become a
    // paired reply. Complete the bind, then verify a current request is paired.
    await route.handleFileSave({ ws, session: state, message: request({ workspaceEpoch: EPOCH_A2 }) });
    await completeWorkspaceBind(ws, state, { type: 'workspace:switched' }, pair);
    await route.handleFileSave({ ws, session: state, message: request({ workspaceEpoch: EPOCH_A2 }) });
    expect(ws.sent.map((item) => JSON.parse(item).type)).toEqual([
      'file_save_response', 'workspace:switched', 'file_save_response',
    ]);
  });

  test.each([
    ['A -> B', false],
    ['A -> B -> A', true],
  ])('a request captured before held schema validation remains truthful but closes on superseded A1 reply across %s', async (_label, rebound) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-file-save-captured-pair-'));
    let releaseValidation;
    let markValidationStarted;
    const validationGate = new Promise((resolve) => { releaseValidation = resolve; });
    const validationStarted = new Promise((resolve) => { markValidationStarted = resolve; });
    let held = false;
    const heldRegistry = {
      async validatePayload(reference, value) {
        if (!held && value?.type === 'file_save') {
          held = true;
          markValidationStarted();
          await validationGate;
        }
        return registry.validatePayload(reference, value);
      },
    };
    try {
      const owner = createFileSaveOwner({
        db,
        publishResourceRefreshRequired: async () => {},
        controllerOptions: {
          pathAuthority: createPathAuthority({
            getWorkspaceById: async (workspaceId) => (
              workspaceId === 'workspace-A' ? { id: workspaceId, repoPath: root } : null
            ),
            resolvePanelRoot: (workspaceRoot) => workspaceRoot,
          }),
          checkpoint: { async afterSave() { return 'not_requested'; } },
        },
      });
      owner.installPublishers({
        async publishFileCommandAccepted({ eventId }) {
          return { admitted: true, eventId, deliveries: [] };
        },
        async publishResourceMutated({ eventId }) {
          return { admitted: true, eventId, deliveries: [] };
        },
      });
      const route = createFileSaveRoute({ registryAccess: heldRegistry, fileSaveOwner: owner });
      const ws = socket();
      const session = activeSession();
      const routed = route.handleFileSave({ ws, session, message: request() });
      await validationStarted;

      const pairB = beginWorkspaceBind(session, {
        workspaceId: 'workspace-B', repoPath: '/B', randomUuid: () => EPOCH_B,
      });
      if (rebound) {
        await completeWorkspaceBind(ws, session, { type: 'workspace:switched', to: 'workspace-B' }, pairB);
        const pairA2 = beginWorkspaceBind(session, {
          workspaceId: 'workspace-A', repoPath: root, randomUuid: () => EPOCH_A2,
        });
        releaseValidation();
        await routed;
        expect(session.workspaceReplyBuffer).toHaveLength(1);
        await expect(completeWorkspaceBind(
          ws,
          session,
          { type: 'workspace:switched', to: 'workspace-A' },
          pairA2,
        )).resolves.toBe(false);
      } else {
        releaseValidation();
        await routed;
        expect(session.workspaceReplyBuffer).toHaveLength(1);
        await expect(completeWorkspaceBind(
          ws,
          session,
          { type: 'workspace:switched', to: 'workspace-B' },
          pairB,
        )).resolves.toBe(false);
      }

      expect(fs.readFileSync(path.join(root, 'note.md'), 'utf8')).toBe('new text');
      const frames = ws.sent.map((serialized) => JSON.parse(serialized));
      expect(frames.every((frame) => frame.type === 'workspace:switched')).toBe(true);
      expect(frames).toHaveLength(rebound ? 2 : 1);
      expect(ws.closes.at(-1)[0]).toBe(1011);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
