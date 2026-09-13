'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const {
  durableHash,
  intentFromInput,
  originFromInput,
  requestBindingHash,
} = require('../../lib/file-mutations/fact-reservation-bindings');
const {
  REPORTED_UI_CONTEXT_DIAGNOSTICS,
  reportedUiContextFromRow,
  sanitizeReportedUiContext,
} = require('../../lib/file-mutations/reported-ui-context');
const { createFileSaveOwner } = require('../../lib/file-mutations/save-owner');
const { createPathAuthority } = require('../../lib/file-mutations/path-authority');
const { createDb, migrate } = require('./test-db');

const EPOCH = '123e4567-e89b-42d3-a456-426614174000';
const CONTEXT = Object.freeze({
  workspaceId: 'workspace-1',
  viewId: 'file-viewer',
  viewInstanceId: 'mount-1',
  tabId: 'tab-1',
  componentTypeId: 'file-viewer',
  componentInstanceId: 'component-1',
  presenterId: 'markdown',
  targetKey: 'docs/note.md',
});

function uuid(number) {
  return `123e4567-e89b-42d3-a456-${String(number).padStart(12, '0')}`;
}

function reservationInput(start, overrides = {}) {
  return {
    workspaceId: 'workspace-1',
    requestId: `request-${start}`,
    canonicalPath: 'docs/note.md',
    ingressPanel: 'file-viewer',
    ingressPath: 'docs/note.md',
    currentFingerprint: null,
    origin: {
      kind: 'local_client',
      connectionId: 'connection-1',
      assurance: 'transport_only',
      reportedUiContext: { ...CONTEXT },
    },
    saveReason: 'manual',
    acceptedAt: 1000 + start,
    intendedAfterSha256: String(start % 10).repeat(64),
    intendedAfterByteLength: start % 10,
    operationId: uuid(start),
    commandId: uuid(start + 1),
    commandAcceptedEventId: uuid(start + 2),
    resourceEventId: uuid(start + 3),
    fileVersionId: uuid(start + 4),
    resourceId: uuid(start + 5),
    ...overrides,
  };
}

async function succeed(operations, operation, occurredAt, preimage = { kind: 'absent' }) {
  await operations.prepare({
    operationId: operation.operationId,
    preimage,
    intendedAfterSha256: operation.intendedAfterSha256,
    intendedAfterByteLength: operation.intendedAfterByteLength,
    preparedAt: occurredAt - 2,
  });
  await operations.markAttempted(operation.operationId, occurredAt - 1);
  return operations.markSucceeded({
    operationId: operation.operationId,
    occurredAt,
    completedAt: occurredAt,
    fingerprint: { dev: 1, ino: 2, size: 3, birthtimeMs: 4 },
  });
}

describe('reported UI context sanitization and durable fact origin', () => {
  let db;

  afterEach(async () => {
    if (db) await db.destroy();
    db = null;
  });

  test('uses the server workspace, preserves bounds, and reports fixed diagnostics', () => {
    const happy = sanitizeReportedUiContext({ ...CONTEXT, workspaceId: 'workspace-1' }, 'workspace-1');
    expect(happy.diagnostic).toBeNull();
    expect(happy.context).toEqual(CONTEXT);

    const mismatch = sanitizeReportedUiContext({ ...CONTEXT, workspaceId: 'workspace-other' }, 'workspace-1');
    expect(mismatch.context).toBeUndefined();
    expect(mismatch.diagnostic).toBe(REPORTED_UI_CONTEXT_DIAGNOSTICS.workspaceMismatch);

    const unknown = sanitizeReportedUiContext({ ...CONTEXT, secret: 'nope' }, 'workspace-1');
    expect(unknown.diagnostic).toBe(REPORTED_UI_CONTEXT_DIAGNOSTICS.degraded);
    expect(unknown.context).toEqual(CONTEXT);

    const oversizedTarget = sanitizeReportedUiContext(
      { ...CONTEXT, targetKey: '\u{1f98a}'.repeat(200) },
      'workspace-1',
    );
    expect(oversizedTarget.diagnostic).toBe(REPORTED_UI_CONTEXT_DIAGNOSTICS.degraded);
    expect(oversizedTarget.context.targetKey).toBeUndefined();
    expect(oversizedTarget.context.viewId).toBe('file-viewer');

    const noView = sanitizeReportedUiContext({ workspaceId: 'workspace-1' }, 'workspace-1');
    expect(noView.context).toBeUndefined();
    expect(noView.diagnostic).toBe(REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted);

    expect(sanitizeReportedUiContext(undefined, 'workspace-1')).toEqual({ context: undefined, diagnostic: null });
    expect(sanitizeReportedUiContext('bad', 'workspace-1').context).toBeUndefined();
    expect(sanitizeReportedUiContext([], 'workspace-1').context).toBeUndefined();
  });

  test('originFromInput stays strict about base origin while degrading malformed context fail-open', () => {
    const diagnostics = [];
    const origin = originFromInput({
      kind: 'local_client',
      connectionId: 'connection-1',
      assurance: 'transport_only',
      reportedUiContext: 'not-an-object',
    }, 'workspace-1', (code) => diagnostics.push(code));
    expect(origin).toEqual({
      kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only',
    });
    expect(diagnostics).toEqual([REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted]);

    expect(() => originFromInput({ ...origin, kind: 'external' })).toThrow(/truthfully/u);
    expect(() => originFromInput({ ...origin, connectionId: '' })).toThrow(/connectionId/u);
  });

  test('persists both durable fact bodies with the validated context and stable bindings on replay', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const input = reservationInput(100);
    const reserved = await operations.reserve(input);
    const row = await db('file_operations').where({ operation_id: reserved.operationId }).first();

    const expectedOrigin = originFromInput(input.origin, input.workspaceId);
    const expectedRequestHash = requestBindingHash({
      workspaceId: input.workspaceId,
      requestId: input.requestId,
      ingressPanel: input.ingressPanel,
      ingressPath: input.ingressPath,
      origin: expectedOrigin,
      intent: intentFromInput(input),
      intendedAfterSha256: input.intendedAfterSha256,
      intendedAfterByteLength: input.intendedAfterByteLength,
    });
    expect(row.request_binding_sha256).toBe(expectedRequestHash);
    expect(reportedUiContextFromRow(row)).toEqual(CONTEXT);

    const commandBody = await operations.getCommandFactBody(reserved.operationId);
    expect(commandBody.origin.reportedUiContext).toEqual(CONTEXT);
    expect(row.command_reservation_sha256).toBe(durableHash({
      schemaKey: 'file.command_accepted',
      eventId: reserved.commandAcceptedEventId,
      occurredAt: reserved.acceptedAt,
      workspaceId: input.workspaceId,
      operationId: reserved.operationId,
      body: commandBody,
    }));

    const succeeded = await succeed(operations, reserved, 2000);
    const resourceBody = await operations.getResourceFactBody(reserved.operationId);
    expect(resourceBody.origin.reportedUiContext).toEqual(CONTEXT);
    const resourceRow = await db('file_operations').where({ operation_id: reserved.operationId }).first();
    expect(resourceRow.resource_reservation_sha256).toBe(durableHash({
      schemaKey: 'resource.mutated',
      eventId: succeeded.resourceEventId,
      occurredAt: 2000,
      workspaceId: input.workspaceId,
      operationId: reserved.operationId,
      body: resourceBody,
    }));

    const replay = await operations.reserve({ ...input });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.requestBindingSha256).toBe(row.request_binding_sha256);
    expect(replay.commandReservationSha256).toBe(row.command_reservation_sha256);
  });

  test('omits the context on renderer workspace mismatch without changing the accepted save', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const reserved = await operations.reserve(reservationInput(200, {
      origin: {
        kind: 'local_client',
        connectionId: 'connection-1',
        assurance: 'transport_only',
        reportedUiContext: { ...CONTEXT, workspaceId: 'workspace-other' },
      },
    }));
    const row = await db('file_operations').where({ operation_id: reserved.operationId }).first();
    expect(row.reported_view_id).toBeNull();
    expect(row.reported_tab_id).toBeNull();
    expect(row.request_binding_sha256).toMatch(/^[0-9a-f]{64}$/u);
    const commandBody = await operations.getCommandFactBody(reserved.operationId);
    expect(commandBody.origin.reportedUiContext).toBeUndefined();
  });

  test('the controller path never rejects or delays a save for malformed context', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-reported-ui-context-'));
    try {
      db = await migrate(createDb());
      const diagnostics = [];
      const owner = createFileSaveOwner({
        db,
        publishResourceRefreshRequired: async () => {},
        controllerOptions: {
          pathAuthority: createPathAuthority({
            getWorkspaceById: async () => ({ id: 'workspace-1', repoPath: root }),
            resolvePanelRoot: (workspaceRoot) => workspaceRoot,
          }),
          checkpoint: { async afterSave() { return 'not_requested'; } },
          writeDiagnostic: (code) => diagnostics.push(code),
        },
      });
      owner.installPublishers({
        async publishFileCommandAccepted({ body }) {
          return { admitted: true, eventId: body.eventId, deliveries: [] };
        },
        async publishResourceMutated({ body }) {
          return { admitted: true, eventId: body.eventId, deliveries: [] };
        },
      });
      const session = {
        connectionId: 'connection-1',
        workspaceBindingState: 'active',
        workspaceReplyFlushState: 'idle',
        currentWorkspaceId: 'workspace-1',
        workspaceEpoch: EPOCH,
        workspaceReplyBuffer: [],
        workspaceReplyBufferBytes: 0,
      };
      const malformed = [
        'not-an-object',
        { unknownField: true },
        { ...CONTEXT, targetKey: 'x'.repeat(600) },
        null,
      ];
      for (const [index, reportedUiContext] of malformed.entries()) {
        const reply = await owner.save({
          session,
          capturedWorkspacePair: { workspaceId: 'workspace-1', workspaceEpoch: EPOCH },
          intent: {
            requestId: `controller-${index}`,
            expectedWorkspaceId: 'workspace-1',
            expectedWorkspaceEpoch: EPOCH,
            panel: 'file-viewer',
            path: 'note.md',
            content: 'saved anyway',
            saveReason: 'manual',
            reportedUiContext,
          },
        });
        expect(reply).toMatchObject({ success: true, outcome: 'succeeded' });
      }
      expect(fs.readFileSync(path.join(root, 'note.md'), 'utf8')).toBe('saved anyway');
      const noContextRow = await db('file_operations')
        .where({ workspace_id: 'workspace-1' }).orderBy('accepted_at', 'desc').first();
      expect(noContextRow.reported_view_id).toBeNull();
      expect(diagnostics).toContain(REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
