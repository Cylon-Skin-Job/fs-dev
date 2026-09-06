'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAtomicWriter } = require('../../lib/file-mutations/atomic-writer');
const { createDurableReservationAuthority } = require('../../lib/file-mutations/durable-reservations');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const { createPathAuthority, fingerprint } = require('../../lib/file-mutations/path-authority');
const { createFileSaveReconciler } = require('../../lib/file-mutations/reconciliation');
const { createFileSaveOwner } = require('../../lib/file-mutations/save-owner');
const { sha256 } = require('../../lib/file-mutations/text-codec');
const { createDb, migrate } = require('./test-db');

function uuid(number) {
  return `123e4567-e89b-42d3-a456-${String(number).padStart(12, '0')}`;
}

describe('file-save restart reconciliation', () => {
  let tempRoot;
  let workspaceRoot;
  let dbPath;
  let db;
  let operations;
  let reservations;
  let now;

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-save-restart-'));
    workspaceRoot = path.join(tempRoot, 'workspace');
    fs.mkdirSync(workspaceRoot);
    dbPath = path.join(tempRoot, 'fixture.db');
    db = await migrate(createDb(dbPath));
    operations = createFileOperationRepository(db);
    reservations = createDurableReservationAuthority(db);
    now = 1000;
  });

  afterEach(async () => {
    if (db) await db.destroy();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const clock = () => { now += 1; return now; };
  function input(number, canonicalPath, currentFingerprint = null) {
    return {
      workspaceId: 'workspace-1', requestId: `request-${number}`, canonicalPath,
      ingressPanel: 'file-viewer', ingressPath: canonicalPath, currentFingerprint,
      origin: { kind: 'local_client', connectionId: `connection-${number}`, assurance: 'transport_only' },
      saveReason: 'manual', acceptedAt: clock(), intendedAfterSha256: sha256(Buffer.from('after')),
      intendedAfterByteLength: 5, operationId: uuid(number), commandId: uuid(number + 1),
      commandAcceptedEventId: uuid(number + 2), resourceEventId: uuid(number + 3),
      fileVersionId: uuid(number + 4), resourceId: uuid(number + 5),
    };
  }
  function authority() {
    return createPathAuthority({
      getWorkspaceById: async () => ({ id: 'workspace-1', repoPath: workspaceRoot }),
      resolvePanelRoot: (root) => root,
    });
  }
  function publishers(calls) {
    return {
      async publishFileCommandAccepted({ body }) {
        calls.push(['command', body.commandId]);
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: true, eventId: row.command_accepted_event_id, deliveries: [] };
      },
      async publishResourceMutated({ body }) {
        calls.push(['resource', body.commandId]);
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: true, eventId: row.resource_event_id, deliveries: [] };
      },
    };
  }

  test('after a real SQLite reopen, accepted fails, prepared becomes unknown, and succeeded replays without writing', async () => {
    const accepted = await operations.reserve(input(10, 'accepted.md'));
    const acceptedAfterCommand = await operations.reserve(input(15, 'accepted-after-command.md'));
    await operations.markCommandFactAdmitted(acceptedAfterCommand.operationId, clock());

    const prepared = await operations.reserve(input(20, 'prepared.md'));
    await operations.prepare({
      operationId: prepared.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: prepared.intendedAfterSha256,
      intendedAfterByteLength: prepared.intendedAfterByteLength, preparedAt: clock(),
    });
    await operations.markAttempted(prepared.operationId, clock());
    fs.writeFileSync(path.join(workspaceRoot, 'prepared.md'), 'after');

    fs.writeFileSync(path.join(workspaceRoot, 'succeeded.md'), 'after');
    const succeededStat = fs.statSync(path.join(workspaceRoot, 'succeeded.md'));
    const succeeded = await operations.reserve(input(30, 'succeeded.md', fingerprint(succeededStat)));
    await operations.prepare({
      operationId: succeeded.operationId, preimage: { kind: 'bytes', bytes: Buffer.from('before') },
      intendedAfterSha256: succeeded.intendedAfterSha256,
      intendedAfterByteLength: succeeded.intendedAfterByteLength, preparedAt: clock(),
    });
    await operations.markAttempted(succeeded.operationId, clock());
    await operations.markSucceeded({
      operationId: succeeded.operationId, occurredAt: clock(), completedAt: clock(),
      fingerprint: fingerprint(succeededStat),
    });

    const preparedTarget = await authority().resolveCanonical({ workspaceId: 'workspace-1', canonicalPath: 'prepared.md' });
    const tempPath = createAtomicWriter().tempPathFor(preparedTarget, prepared.operationId);
    fs.writeFileSync(tempPath, 'operation temp');

    await db.destroy();
    db = createDb(dbPath);
    operations = createFileOperationRepository(db);
    reservations = createDurableReservationAuthority(db);
    const calls = [];
    const recoveries = [];
    let writes = 0;
    const writer = {
      ...createAtomicWriter(),
      replace: async () => { writes += 1; throw new Error('must not write'); },
    };
    const reconciler = createFileSaveReconciler({
      operations, reservations, publishers: publishers(calls), pathAuthority: authority(),
      atomicWriter: writer, clock,
      publishResourceRefreshRequired: async (message) => { recoveries.push(message); },
    });
    const results = await reconciler.reconcile();

    expect(results).toHaveLength(4);
    await expect(operations.getById(accepted.operationId)).resolves.toMatchObject({
      state: 'failed', failureCode: 'interrupted_before_prepare', commandFactAdmissionState: 'admitted',
    });
    await expect(operations.getById(acceptedAfterCommand.operationId)).resolves.toMatchObject({
      state: 'failed', failureCode: 'interrupted_before_prepare', commandFactAdmissionState: 'admitted',
    });
    await expect(operations.getById(prepared.operationId)).resolves.toMatchObject({
      state: 'outcome_unknown', observedTarget: {
        state: 'bytes', sha256: sha256(Buffer.from('after')), byteLength: 5,
      }, commandFactAdmissionState: 'admitted',
    });
    await expect(operations.getById(succeeded.operationId)).resolves.toMatchObject({
      state: 'succeeded', commandFactAdmissionState: 'admitted', factAdmissionState: 'admitted',
      ledgerProjectionState: 'pending',
    });
    expect(calls.filter(([kind]) => kind === 'command')).toHaveLength(3);
    expect(calls).not.toContainEqual(['command', acceptedAfterCommand.commandId]);
    expect(calls.filter(([kind]) => kind === 'resource')).toHaveLength(1);
    expect(recoveries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'mutation_outcome_unknown', operationId: prepared.operationId,
        workspaceId: 'workspace-1', panel: 'file-viewer', path: 'prepared.md',
      }),
      expect.objectContaining({
        reason: 'projection_unavailable', operationId: succeeded.operationId,
        workspaceId: 'workspace-1', panel: 'file-viewer', path: 'succeeded.md',
      }),
    ]));
    expect(writes).toBe(0);
    expect(fs.existsSync(tempPath)).toBe(false);
    expect(fs.readFileSync(path.join(workspaceRoot, 'prepared.md'), 'utf8')).toBe('after');
    expect(fs.readFileSync(path.join(workspaceRoot, 'succeeded.md'), 'utf8')).toBe('after');
  });

  test('replays a succeeded admitted fact while ledger remains pending and keeps the same event identity', async () => {
    fs.writeFileSync(path.join(workspaceRoot, 'doc.md'), 'after');
    const stat = fs.statSync(path.join(workspaceRoot, 'doc.md'));
    let operation = await operations.reserve(input(100, 'doc.md', fingerprint(stat)));
    await operations.prepare({
      operationId: operation.operationId, preimage: { kind: 'bytes', bytes: Buffer.from('before') },
      intendedAfterSha256: operation.intendedAfterSha256,
      intendedAfterByteLength: operation.intendedAfterByteLength, preparedAt: clock(),
    });
    await operations.markAttempted(operation.operationId, clock());
    operation = await operations.markSucceeded({
      operationId: operation.operationId, occurredAt: clock(), completedAt: clock(), fingerprint: fingerprint(stat),
    });
    await operations.markCommandFactAdmitted(operation.operationId, clock());
    await operations.markResourceFactAdmitted(operation.operationId, clock());
    const calls = [];
    await createFileSaveReconciler({
      operations, reservations, publishers: publishers(calls), pathAuthority: authority(), clock,
    }).reconcile();
    expect(calls).toEqual([['resource', operation.commandId]]);
    await expect(operations.getById(operation.operationId)).resolves.toMatchObject({
      resourceEventId: operation.resourceEventId, factAdmissionState: 'admitted', ledgerProjectionState: 'pending',
    });
  });

  test('does not recover a prepared pre-replace operation or an attempted operation without postimage evidence', async () => {
    const prepared = await operations.reserve(input(110, 'prepared-before-replace.md'));
    await operations.prepare({
      operationId: prepared.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: prepared.intendedAfterSha256,
      intendedAfterByteLength: prepared.intendedAfterByteLength, preparedAt: clock(),
    });

    const attempted = await operations.reserve(input(115, 'attempted-without-postimage.md'));
    await operations.prepare({
      operationId: attempted.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: attempted.intendedAfterSha256,
      intendedAfterByteLength: attempted.intendedAfterByteLength, preparedAt: clock(),
    });
    await operations.markAttempted(attempted.operationId, clock());

    const recoveries = [];
    const calls = [];
    const results = await createFileSaveReconciler({
      operations, reservations, publishers: publishers(calls), pathAuthority: authority(), clock,
      publishResourceRefreshRequired: async (message) => { recoveries.push(message); },
    }).reconcile();

    expect(results).toHaveLength(2);
    await expect(operations.getById(prepared.operationId)).resolves.toMatchObject({
      state: 'failed', attemptedAt: null, failureCode: 'write_prepare_failed',
      commandFactAdmissionState: 'admitted',
    });
    await expect(operations.getById(attempted.operationId)).resolves.toMatchObject({
      state: 'outcome_unknown', observedTarget: { state: 'absent' },
      commandFactAdmissionState: 'admitted',
    });
    expect(calls.filter(([kind]) => kind === 'command')).toHaveLength(2);
    expect(recoveries).toEqual([]);
  });

  test('retries terminal temp cleanup after SQLite reopen without repeating the write', async () => {
    let operation = await operations.reserve(input(120, 'failed.md'));
    operation = await operations.prepare({
      operationId: operation.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: operation.intendedAfterSha256,
      intendedAfterByteLength: operation.intendedAfterByteLength, preparedAt: clock(),
    });
    operation = await operations.markAttempted(operation.operationId, clock());
    operation = await operations.markFailed({
      operationId: operation.operationId, failureCode: 'replace_failed', completedAt: clock(),
    });
    operation = await operations.markCommandFactAdmitted(operation.operationId, clock());
    const target = await authority().resolveCanonical({
      workspaceId: operation.workspaceId, canonicalPath: operation.canonicalPath,
    });
    const tempPath = createAtomicWriter().tempPathFor(target, operation.operationId);
    fs.writeFileSync(tempPath, 'intended bytes awaiting cleanup');

    await db.destroy();
    db = createDb(dbPath);
    operations = createFileOperationRepository(db);
    reservations = createDurableReservationAuthority(db);
    let writes = 0;
    const results = await createFileSaveReconciler({
      operations, reservations, publishers: publishers([]), pathAuthority: authority(), clock,
      atomicWriter: {
        ...createAtomicWriter(),
        replace: async () => { writes += 1; throw new Error('must not write'); },
      },
    }).reconcile();

    expect(results).toHaveLength(1);
    expect(writes).toBe(0);
    expect(fs.existsSync(tempPath)).toBe(false);
    await expect(operations.getById(operation.operationId)).resolves.toMatchObject({
      state: 'failed', tempCleanupState: 'complete', commandFactAdmissionState: 'admitted',
    });
  });

  test('owner accepts one exact publisher injection without exposing publisher closures', async () => {
    const calls = [];
    const owner = createFileSaveOwner({
      db,
      publishResourceRefreshRequired: async () => {},
      controllerOptions: { pathAuthority: authority(), clock },
      reconcilerOptions: { pathAuthority: authority(), clock },
    });
    const exactPublishers = publishers(calls);
    owner.installPublishers(exactPublishers);
    expect(() => owner.installPublishers(exactPublishers)).toThrow(/already installed/u);
    expect(owner.publishFileCommandAccepted).toBeUndefined();
    expect(owner.publishResourceMutated).toBeUndefined();
    expect(owner.publishResourceRefreshRequired).toBeUndefined();
    expect(Object.values(owner)).not.toContain(exactPublishers.publishFileCommandAccepted);
    const result = await owner.save({
      session: {
        connectionId: 'owner-connection', currentWorkspaceId: 'workspace-1',
        workspaceEpoch: '123e4567-e89b-42d3-a456-000000000999',
      },
      intent: {
        requestId: 'owner-save', expectedWorkspaceId: 'workspace-1',
        expectedWorkspaceEpoch: '123e4567-e89b-42d3-a456-000000000999',
        panel: 'file-viewer', path: 'owner.md', content: 'owner bytes', saveReason: 'manual',
      },
    });
    expect(result).toMatchObject({ success: true, canonicalPath: 'owner.md' });
    expect(calls.map(([kind]) => kind)).toEqual(['command', 'resource']);
  });
});
