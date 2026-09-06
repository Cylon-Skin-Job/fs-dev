'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const { createStableResourceRepository } = require('../../lib/file-mutations/stable-resource-repository');
const { MAX_SNAPSHOT_BYTES } = require('../../lib/file-mutations/file-version-repository');
const { createDb, migrate } = require('./test-db');

const FINGERPRINT_A = Object.freeze({ dev: 1, ino: 2, size: 3, birthtimeMs: 4 });
const FINGERPRINT_B = Object.freeze({ dev: 1, ino: 9, size: 3, birthtimeMs: 4 });

function ids(start) {
  const suffix = (offset) => String(start + offset).padStart(12, '0');
  return {
    operationId: `123e4567-e89b-42d3-a456-${suffix(0)}`,
    commandId: `123e4567-e89b-42d3-a456-${suffix(1)}`,
    commandAcceptedEventId: `123e4567-e89b-42d3-a456-${suffix(2)}`,
    resourceEventId: `123e4567-e89b-42d3-a456-${suffix(3)}`,
    fileVersionId: `123e4567-e89b-42d3-a456-${suffix(4)}`,
    resourceId: `123e4567-e89b-42d3-a456-${suffix(5)}`,
  };
}

function reservationInput(start, overrides = {}) {
  return {
    workspaceId: 'workspace-1',
    requestId: `request-${start}`,
    canonicalPath: 'docs/a.md',
    ingressPanel: 'file-viewer',
    ingressPath: 'docs/a.md',
    currentFingerprint: null,
    origin: { kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only' },
    saveReason: 'manual',
    acceptedAt: 1000 + start,
    intendedAfterSha256: String(start % 10).repeat(64),
    intendedAfterByteLength: start % 10,
    ...ids(start),
    ...overrides,
  };
}

async function expectSqlConstraint(query) {
  let failure;
  try {
    await query;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeDefined();
  expect(failure.message).toMatch(/CHECK constraint failed/u);
}

describe('file provenance repositories', () => {
  let db;

  afterEach(async () => {
    if (db) await db.destroy();
    db = null;
  });

  test('stores exact snapshot bytes/hash/length and a secret-free absent discriminant', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const created = await operations.reserve(reservationInput(10));
    const absent = await operations.prepare({
      operationId: created.operationId,
      preimage: { kind: 'absent' },
      intendedAfterSha256: created.intendedAfterSha256,
      intendedAfterByteLength: created.intendedAfterByteLength,
      preparedAt: 1100,
    });
    expect(absent).toMatchObject({ preimageKind: 'absent', preimageByteLength: 0, preimageSha256: null });
    expect(await operations.versions.readSnapshotBytes(created.fileVersionId)).toBeNull();

    await operations.markAttempted(created.operationId, 1150);
    await operations.markFailed({ operationId: created.operationId, failureCode: 'replace_failed', completedAt: 1200 });
    const modified = await operations.reserve(reservationInput(30, {
      canonicalPath: 'docs/b.md', ingressPath: 'docs/b.md', currentFingerprint: FINGERPRINT_A,
    }));
    const original = Buffer.from('before \ud83d\ude80', 'utf8');
    const prepared = await operations.prepare({
      operationId: modified.operationId,
      preimage: { kind: 'bytes', bytes: original },
      intendedAfterSha256: modified.intendedAfterSha256,
      intendedAfterByteLength: modified.intendedAfterByteLength,
      preparedAt: 1300,
    });
    expect(prepared).toMatchObject({
      preimageKind: 'bytes',
      preimageSha256: crypto.createHash('sha256').update(original).digest('hex'),
      preimageByteLength: original.length,
    });
    const read = await operations.versions.readSnapshotBytes(modified.fileVersionId);
    expect(read.equals(original)).toBe(true);
    read.fill(0);
    expect((await operations.versions.readSnapshotBytes(modified.fileVersionId)).equals(original)).toBe(true);
  });

  test('enforces the 10 MiB snapshot limit at the repository boundary', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const operation = await operations.reserve(reservationInput(50, { currentFingerprint: FINGERPRINT_A }));
    await expect(operations.prepare({
      operationId: operation.operationId,
      preimage: { kind: 'bytes', bytes: Buffer.alloc(MAX_SNAPSHOT_BYTES + 1) },
      intendedAfterSha256: operation.intendedAfterSha256,
      intendedAfterByteLength: operation.intendedAfterByteLength,
      preparedAt: 1500,
    })).rejects.toThrow(/exceeds/u);
    await expect(operations.getById(operation.operationId)).resolves.toMatchObject({ state: 'accepted' });
  });

  test('binds absent/bytes snapshots to create/modify reservations', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const create = await operations.reserve(reservationInput(60));
    await expect(operations.prepare({
      operationId: create.operationId,
      preimage: { kind: 'bytes', bytes: Buffer.from('invented') },
      intendedAfterSha256: create.intendedAfterSha256,
      intendedAfterByteLength: create.intendedAfterByteLength,
      preparedAt: 1601,
    })).rejects.toThrow(/does not match/u);
    await operations.markFailed({ operationId: create.operationId, failureCode: 'snapshot_failed', completedAt: 1602 });
    const modify = await operations.reserve(reservationInput(65, {
      canonicalPath: 'modify.md', ingressPath: 'modify.md', currentFingerprint: FINGERPRINT_A,
    }));
    await expect(operations.prepare({
      operationId: modify.operationId,
      preimage: { kind: 'absent' },
      intendedAfterSha256: modify.intendedAfterSha256,
      intendedAfterByteLength: modify.intendedAfterByteLength,
      preparedAt: 1603,
    })).rejects.toThrow(/does not match/u);
  });

  test('reuses a stable identity after restart only for an exact successful fingerprint', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-provenance-restart-'));
    const filename = path.join(tempRoot, 'fixture.db');
    try {
      db = await migrate(createDb(filename));
      let operations = createFileOperationRepository(db);
      const created = await operations.reserve(reservationInput(70));
      await operations.prepare({
        operationId: created.operationId, preimage: { kind: 'absent' },
        intendedAfterSha256: created.intendedAfterSha256,
        intendedAfterByteLength: created.intendedAfterByteLength,
        preparedAt: 1700,
      });
      await operations.markAttempted(created.operationId, 1750);
      await operations.markSucceeded({
        operationId: created.operationId, occurredAt: 1800, completedAt: 1800, fingerprint: FINGERPRINT_A,
      });
      const stableId = created.resourceId;
      await db.destroy();
      db = createDb(filename);
      operations = createFileOperationRepository(db);
      const same = await operations.reserve(reservationInput(90, { currentFingerprint: FINGERPRINT_A }));
      expect(same.resourceId).toBe(stableId);
      expect(same.mutationKind).toBe('modify');
      await operations.markFailed({
        operationId: same.operationId, failureCode: 'unsupported_preimage', completedAt: 1900,
      });

      const replacement = await operations.reserve(reservationInput(110, { currentFingerprint: FINGERPRINT_B }));
      expect(replacement.resourceId).not.toBe(stableId);
      const stale = await db('resource_registry').where({ resource_id: stableId }).first();
      expect(stale).toMatchObject({
        lifecycle_state: 'tombstoned', tombstone_reason: 'compatibility_relocated_or_replaced',
      });
    } finally {
      if (db) { await db.destroy(); db = null; }
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('concurrent absent reservations converge on one active resource identity', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-provenance-race-'));
    const filename = path.join(tempRoot, 'fixture.db');
    let rivalDb;
    try {
      db = await migrate(createDb(filename));
      rivalDb = createDb(filename);
      const leftRepository = createStableResourceRepository(db, { randomUuid: () => ids(210).resourceId });
      const rightRepository = createStableResourceRepository(rivalDb, { randomUuid: () => ids(220).resourceId });
      const input = {
        workspaceId: 'workspace-1', canonicalPath: 'docs/race.md', currentFingerprint: null, now: 2000,
      };
      const [left, right] = await Promise.all([
        leftRepository.reserve(input), rightRepository.reserve(input),
      ]);
      expect(left.resource.resourceId).toBe(right.resource.resourceId);
      expect(await db('resource_registry').whereNot({ lifecycle_state: 'tombstoned' }).count({ count: '*' }).first())
        .toMatchObject({ count: 1 });
    } finally {
      if (rivalDb) await rivalDb.destroy();
      if (db) { await db.destroy(); db = null; }
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('keeps a first-observed existing resource live after a failed modify', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const modified = await operations.reserve(reservationInput(230, {
      canonicalPath: 'existing.md', ingressPath: 'existing.md', currentFingerprint: FINGERPRINT_A,
    }));
    await expect(db('resource_registry').where({ resource_id: modified.resourceId }).first())
      .resolves.toMatchObject({ lifecycle_state: 'live', fingerprint_ino: '2' });
    await operations.markFailed({
      operationId: modified.operationId, failureCode: 'unsupported_preimage', completedAt: 2231,
    });
    await expect(db('resource_registry').where({ resource_id: modified.resourceId }).first())
      .resolves.toMatchObject({ lifecycle_state: 'live', fingerprint_ino: '2' });
  });

  test('concurrent replacement detection tombstones one stale fingerprint and converges on its successor', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-provenance-fingerprint-race-'));
    const filename = path.join(tempRoot, 'fixture.db');
    let rivalDb;
    try {
      db = await migrate(createDb(filename));
      const initial = createStableResourceRepository(db, { randomUuid: () => ids(700).resourceId });
      const original = await initial.reserve({
        workspaceId: 'workspace-1', canonicalPath: 'docs/replaced.md',
        currentFingerprint: FINGERPRINT_A, now: 2700,
      });
      rivalDb = createDb(filename);
      const left = createStableResourceRepository(db, { randomUuid: () => ids(710).resourceId });
      const right = createStableResourceRepository(rivalDb, { randomUuid: () => ids(720).resourceId });
      const replacement = {
        workspaceId: 'workspace-1', canonicalPath: 'docs/replaced.md',
        currentFingerprint: FINGERPRINT_B, now: 2701,
      };
      const [leftResult, rightResult] = await Promise.all([
        left.reserve(replacement), right.reserve(replacement),
      ]);
      expect(leftResult.resource.resourceId).toBe(rightResult.resource.resourceId);
      expect(leftResult.resource.resourceId).not.toBe(original.resource.resourceId);
      await expect(db('resource_registry').where({ resource_id: original.resource.resourceId }).first())
        .resolves.toMatchObject({
          lifecycle_state: 'tombstoned', tombstone_reason: 'compatibility_relocated_or_replaced',
        });
      expect(await db('resource_registry').whereNot({ lifecycle_state: 'tombstoned' }).count({ count: '*' }).first())
        .toMatchObject({ count: 1 });
    } finally {
      if (rivalDb) await rivalDb.destroy();
      if (db) { await db.destroy(); db = null; }
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('treats a request replay as exact-input idempotency and rejects a changed replay', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const original = reservationInput(235, { canonicalPath: 'replay.md', ingressPath: 'replay.md' });
    const first = await operations.reserve(original);
    const exact = await operations.reserve({ ...original, ...ids(999) });
    expect(exact.operationId).toBe(first.operationId);
    expect(exact.idempotentReplay).toBe(true);
    expect(first.requestBindingSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.requestBindingSha256).not.toBe(first.commandReservationSha256);
    await expect(operations.reserve({ ...original, saveReason: 'autosave', ...ids(998) }))
      .rejects.toThrow(/different durable input/u);
    await expect(operations.reserve({
      ...original,
      currentFingerprint: FINGERPRINT_A,
      ...ids(969),
    })).resolves.toMatchObject({ operationId: first.operationId, idempotentReplay: true });
    await expect(operations.reserve({
      ...original,
      acceptedAt: original.acceptedAt + 1,
      ...ids(968),
    })).resolves.toMatchObject({ operationId: first.operationId, idempotentReplay: true });
    await expect(operations.reserve({
      ...original,
      canonicalPath: 'Replay.md',
      acceptedAt: original.acceptedAt + 2,
      currentFingerprint: FINGERPRINT_A,
      ...ids(967),
    })).resolves.toMatchObject({ operationId: first.operationId, idempotentReplay: true });
    await expect(operations.reserve({
      ...original,
      intendedAfterSha256: 'f'.repeat(64),
      ...ids(997),
    })).rejects.toThrow(/different durable input/u);
    await expect(operations.reserve({
      ...original,
      intendedAfterByteLength: original.intendedAfterByteLength + 1,
      ...ids(996),
    })).rejects.toThrow(/different durable input/u);
    await expect(operations.prepare({
      operationId: first.operationId,
      preimage: { kind: 'absent' },
      intendedAfterSha256: 'e'.repeat(64),
      intendedAfterByteLength: first.intendedAfterByteLength,
      preparedAt: first.acceptedAt + 1,
    })).rejects.toThrow(/does not match the durable request binding/u);
    await expect(operations.reserve({
      ...original,
      origin: { ...original.origin, connectionId: 'connection-2' },
      ...ids(970),
    })).rejects.toMatchObject({ code: 'resource_operation_in_progress' });
  });

  test('retries two-connection operation contention and reclassifies exact and competing requests', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-operation-contention-'));
    const filename = path.join(tempRoot, 'fixture.db');
    let rivalDb;
    try {
      db = await migrate(createDb(filename));
      rivalDb = createDb(filename);
      const left = createFileOperationRepository(db);
      const right = createFileOperationRepository(rivalDb);
      const exactInput = reservationInput(800, {
        canonicalPath: 'contention/exact.md', ingressPath: 'contention/exact.md',
      });
      const [leftExact, rightExact] = await Promise.all([
        left.reserve(exactInput),
        right.reserve({ ...exactInput, ...ids(900) }),
      ]);
      expect(leftExact.operationId).toBe(rightExact.operationId);
      expect(await db('file_operations').where({ request_id: exactInput.requestId }).count({ count: '*' }).first())
        .toMatchObject({ count: 1 });

      const changedWinnerInput = reservationInput(810, {
        canonicalPath: 'contention/changed.md', ingressPath: 'contention/changed.md',
      });
      const changedWinnerOutcomes = await Promise.allSettled([
        left.reserve(changedWinnerInput),
        right.reserve({
          ...changedWinnerInput,
          intendedAfterSha256: 'e'.repeat(64),
          ...ids(910),
        }),
      ]);
      expect(changedWinnerOutcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(changedWinnerOutcomes.find((outcome) => outcome.status === 'rejected').reason)
        .toMatchObject({ message: expect.stringMatching(/different durable input/u) });

      const competingLeft = reservationInput(820, {
        canonicalPath: 'contention/different.md', ingressPath: 'contention/different.md',
      });
      const competingRight = reservationInput(840, {
        canonicalPath: 'contention/different.md', ingressPath: 'contention/different.md',
      });
      const outcomes = await Promise.allSettled([
        left.reserve(competingLeft), right.reserve(competingRight),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
      expect(rejected.reason).toMatchObject({ code: 'resource_operation_in_progress' });
      expect(String(rejected.reason.message)).not.toMatch(/SQLITE_BUSY|database is locked/u);

      const fingerprintLeft = reservationInput(860, {
        canonicalPath: 'contention/fingerprint.md', ingressPath: 'contention/fingerprint.md',
        currentFingerprint: FINGERPRINT_A,
      });
      const fingerprintRight = reservationInput(870, {
        canonicalPath: 'contention/fingerprint.md', ingressPath: 'contention/fingerprint.md',
        currentFingerprint: FINGERPRINT_B,
      });
      const fingerprintOutcomes = await Promise.allSettled([
        left.reserve(fingerprintLeft), right.reserve(fingerprintRight),
      ]);
      expect(fingerprintOutcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const fingerprintRejected = fingerprintOutcomes.find((outcome) => outcome.status === 'rejected');
      expect(fingerprintRejected.reason).toMatchObject({ code: 'resource_operation_in_progress' });
      expect(String(fingerprintRejected.reason.message)).not.toMatch(/SQLITE_BUSY|database is locked/u);
      await expect(db('file_operations')
        .where({ workspace_id: 'workspace-1', canonical_path: 'contention/fingerprint.md' })
        .whereIn('state', ['accepted', 'prepared'])
        .count({ count: '*' }).first()).resolves.toMatchObject({ count: 1 });
      await expect(db('resource_registry')
        .where({ workspace_id: 'workspace-1', canonical_path: 'contention/fingerprint.md' })
        .whereNot({ lifecycle_state: 'tombstoned' })
        .count({ count: '*' }).first()).resolves.toMatchObject({ count: 1 });
      await expect(db('resource_registry')
        .where({ workspace_id: 'workspace-1', canonical_path: 'contention/fingerprint.md' })
        .count({ count: '*' }).first()).resolves.toMatchObject({ count: 1 });
    } finally {
      if (rivalDb) await rivalDb.destroy();
      if (db) { await db.destroy(); db = null; }
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('enforces active operation uniqueness by canonical path across resource replacement history', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const first = await operations.reserve(reservationInput(875, {
      canonicalPath: 'path-unique.md', ingressPath: 'path-unique.md',
      currentFingerprint: FINGERPRINT_A,
    }));
    const firstRow = await db('file_operations').where({ operation_id: first.operationId }).first();
    await db('resource_registry').where({ resource_id: first.resourceId }).update({
      lifecycle_state: 'tombstoned',
      tombstone_reason: 'compatibility_relocated_or_replaced',
      tombstoned_at: first.acceptedAt + 1,
      updated_at: first.acceptedAt + 1,
    });
    const replacementId = ids(876).resourceId;
    await db('resource_registry').insert({
      resource_id: replacementId,
      workspace_id: 'workspace-1',
      kind: 'file',
      canonical_path: 'path-unique.md',
      lifecycle_state: 'live',
      fingerprint_dev: FINGERPRINT_B.dev,
      fingerprint_ino: FINGERPRINT_B.ino,
      fingerprint_size: FINGERPRINT_B.size,
      fingerprint_birthtime_ms: FINGERPRINT_B.birthtimeMs,
      created_at: first.acceptedAt + 1,
      updated_at: first.acceptedAt + 1,
    });
    const replacementIds = ids(895);
    let duplicateError;
    try {
      await db('file_operations').insert({
        ...firstRow,
        operation_id: replacementIds.operationId,
        request_id: 'path-unique-competing-request',
        command_id: replacementIds.commandId,
        command_accepted_event_id: replacementIds.commandAcceptedEventId,
        resource_event_id: replacementIds.resourceEventId,
        resource_id: replacementId,
        file_version_id: replacementIds.fileVersionId,
        origin_connection_id: 'path-unique-competitor',
      });
    } catch (error) {
      duplicateError = error;
    }
    expect(duplicateError).toBeDefined();
    expect(duplicateError.message).toMatch(/UNIQUE constraint failed/u);
  });

  test('rejects false chronology and phase-incompatible failure codes in repository and SQL', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const operation = await operations.reserve(reservationInput(880, {
      canonicalPath: 'chronology.md', ingressPath: 'chronology.md',
    }));
    await expect(operations.prepare({
      operationId: operation.operationId,
      preimage: { kind: 'absent' },
      intendedAfterSha256: operation.intendedAfterSha256,
      intendedAfterByteLength: operation.intendedAfterByteLength,
      preparedAt: operation.acceptedAt - 1,
    })).rejects.toThrow(/regress/u);
    await expect(operations.markFailed({
      operationId: operation.operationId,
      failureCode: 'replace_failed',
      completedAt: operation.acceptedAt + 1,
    })).rejects.toThrow(/incompatible/u);
    await expectSqlConstraint(db('file_operations').where({ operation_id: operation.operationId }).update({
      state: 'failed', failure_code: 'replace_failed',
      completed_at: operation.acceptedAt + 1, updated_at: operation.acceptedAt + 1,
    }));

    await operations.prepare({
      operationId: operation.operationId,
      preimage: { kind: 'absent' },
      intendedAfterSha256: operation.intendedAfterSha256,
      intendedAfterByteLength: operation.intendedAfterByteLength,
      preparedAt: operation.acceptedAt + 2,
    });
    await expect(operations.markFailed({
      operationId: operation.operationId,
      failureCode: 'replace_failed',
      completedAt: operation.acceptedAt + 3,
    })).rejects.toThrow(/attempt/u);
    await expect(operations.markAttempted(operation.operationId, operation.acceptedAt + 1))
      .rejects.toThrow(/regress/u);
    await operations.markAttempted(operation.operationId, operation.acceptedAt + 3);
    await expect(operations.markSucceeded({
      operationId: operation.operationId,
      occurredAt: operation.acceptedAt + 2,
      completedAt: operation.acceptedAt + 4,
      fingerprint: FINGERPRINT_A,
    })).rejects.toThrow(/regress/u);
    await expectSqlConstraint(db('file_operations').where({ operation_id: operation.operationId }).update({
      state: 'succeeded', resource_occurred_at: operation.acceptedAt + 2,
      completed_at: operation.acceptedAt + 4,
      resource_reservation_sha256: 'a'.repeat(64),
      succeeded_fingerprint_dev: '1', succeeded_fingerprint_ino: '2', succeeded_fingerprint_size: 3,
      updated_at: operation.acceptedAt + 4,
    }));
  });

  test('maps create failure and ambiguous create to distinct resource lifecycle states', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const failed = await operations.reserve(reservationInput(240, { canonicalPath: 'failed.md', ingressPath: 'failed.md' }));
    await operations.markFailed({
      operationId: failed.operationId, failureCode: 'interrupted_before_prepare', completedAt: 2240, reconciledAt: 2240,
    });
    await expect(db('resource_registry').where({ resource_id: failed.resourceId }).first())
      .resolves.toMatchObject({ lifecycle_state: 'tombstoned', tombstone_reason: 'create_failed_before_replace' });

    const unknown = await operations.reserve(reservationInput(260, { canonicalPath: 'unknown.md', ingressPath: 'unknown.md' }));
    await operations.prepare({
      operationId: unknown.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: unknown.intendedAfterSha256,
      intendedAfterByteLength: unknown.intendedAfterByteLength,
      preparedAt: 2261,
    });
    await operations.markOutcomeUnknown({
      operationId: unknown.operationId, completedAt: 2262,
      observedTargetState: 'bytes', observedTargetSha256: '2'.repeat(64), observedTargetByteLength: 2,
      reconciledAt: 2263,
    });
    await expect(db('resource_registry').where({ resource_id: unknown.resourceId }).first())
      .resolves.toMatchObject({ lifecycle_state: 'outcome_unknown' });
    await expect(operations.resources.reserve({
      workspaceId: 'workspace-1', canonicalPath: 'unknown.md', currentFingerprint: null, now: 2264,
    })).rejects.toMatchObject({ code: 'resource_outcome_unknown' });
  });

  test('persists independent state/fact/projection axes and restart reconciliation order', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const succeeded = await operations.reserve(reservationInput(300));
    await operations.prepare({
      operationId: succeeded.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: succeeded.intendedAfterSha256,
      intendedAfterByteLength: succeeded.intendedAfterByteLength,
      preparedAt: 2301,
    });
    await operations.markAttempted(succeeded.operationId, 2302);
    await operations.markSucceeded({
      operationId: succeeded.operationId, occurredAt: 2303, completedAt: 2303, fingerprint: FINGERPRINT_A,
    });
    await operations.markCommandFactAdmitted(succeeded.operationId, 2304);
    await operations.markResourceFactAdmitted(succeeded.operationId, 2305);
    await operations.markLedgerStored(succeeded.operationId, 2306);
    await operations.markTempCleanupComplete(succeeded.operationId, 2307);
    await expect(operations.getById(succeeded.operationId)).resolves.toMatchObject({
      state: 'succeeded', commandFactAdmissionState: 'admitted', factAdmissionState: 'admitted',
      ledgerProjectionState: 'stored',
    });

    const accepted = await operations.reserve(reservationInput(320, { canonicalPath: 'accepted.md', ingressPath: 'accepted.md' }));
    const failed = await operations.reserve(reservationInput(340, { canonicalPath: 'failed-pending.md', ingressPath: 'failed-pending.md' }));
    await operations.markFailed({
      operationId: failed.operationId, failureCode: 'interrupted_before_prepare',
      completedAt: 2341, reconciledAt: 2341,
    });
    const unknown = await operations.reserve(reservationInput(360, { canonicalPath: 'unknown-pending.md', ingressPath: 'unknown-pending.md' }));
    await operations.prepare({
      operationId: unknown.operationId, preimage: { kind: 'absent' },
      intendedAfterSha256: unknown.intendedAfterSha256,
      intendedAfterByteLength: unknown.intendedAfterByteLength,
      preparedAt: 2361,
    });
    await operations.markOutcomeUnknown({
      operationId: unknown.operationId, completedAt: 2362,
      observedTargetState: 'unreadable', reconciledAt: 2362,
    });
    const pending = await operations.listForReconciliation();
    expect(pending.map((operation) => operation.operationId)).toContain(accepted.operationId);
    expect(pending.map((operation) => operation.operationId)).toContain(failed.operationId);
    expect(pending.map((operation) => operation.operationId)).toContain(unknown.operationId);
    expect(pending.map((operation) => operation.operationId)).not.toContain(succeeded.operationId);
  });
});
