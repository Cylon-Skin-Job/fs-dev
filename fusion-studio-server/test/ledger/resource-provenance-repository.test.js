'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const { createResourceProvenanceRepository } = require('../../lib/ledger/resource-provenance-repository');
const { createDb, migrate } = require('../resources/test-db');

const FINGERPRINT = Object.freeze({ dev: 7, ino: 8, size: 9, birthtimeMs: 10 });

function uuid(number) {
  return `123e4567-e89b-42d3-a456-${String(number).padStart(12, '0')}`;
}

function input(number, canonicalPath, acceptedAt) {
  return {
    workspaceId: 'workspace-1', requestId: `request-${number}`, canonicalPath,
    ingressPanel: number % 2 ? 'office' : 'file-viewer', ingressPath: canonicalPath,
    currentFingerprint: null,
    origin: { kind: 'local_client', connectionId: `connection-${number}`, assurance: 'transport_only' },
    saveReason: 'manual', acceptedAt,
    intendedAfterSha256: String(number % 10).repeat(64), intendedAfterByteLength: 3,
    operationId: uuid(number), commandId: uuid(number + 1),
    commandAcceptedEventId: uuid(number + 2), resourceEventId: uuid(number + 3),
    fileVersionId: uuid(number + 4), resourceId: uuid(number + 5),
  };
}

async function succeededOperation(operations, number, canonicalPath, acceptedAt, occurredAt, preimage) {
  const operation = await operations.reserve({
    ...input(number, canonicalPath, acceptedAt),
    currentFingerprint: preimage.kind === 'bytes'
      ? { ...FINGERPRINT, ino: number }
      : null,
  });
  await operations.prepare({
    operationId: operation.operationId,
    preimage,
    intendedAfterSha256: operation.intendedAfterSha256,
    intendedAfterByteLength: operation.intendedAfterByteLength,
    preparedAt: acceptedAt + 1,
  });
  await operations.markAttempted(operation.operationId, acceptedAt + 2);
  await operations.markSucceeded({
    operationId: operation.operationId,
    occurredAt,
    completedAt: occurredAt,
    fingerprint: { ...FINGERPRINT, ino: number },
  });
  return operations.getById(operation.operationId);
}

async function factFor(db, operations, operationId) {
  const row = await db('file_operations').where({ operation_id: operationId }).first();
  return {
    eventId: row.resource_event_id,
    eventType: 'resource.mutated',
    schemaVersion: 1,
    occurredAt: row.resource_occurred_at,
    workspaceId: row.workspace_id,
    operationId: row.operation_id,
    ...operations.buildResourceBody(row),
  };
}

describe('resource provenance ledger repository', () => {
  let db;

  afterEach(async () => {
    if (db) await db.destroy();
    db = null;
  });

  test('stores exact duplicates idempotently and refuses a conflicting established event ID', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const ledger = createResourceProvenanceRepository(db);
    const operation = await succeededOperation(
      operations, 100, 'docs/a.md', 1000, 2000, { kind: 'bytes', bytes: Buffer.from('secret-before') },
    );
    const fact = await factFor(db, operations, operation.operationId);
    await expect(ledger.appendResourceFact(fact, { projectedAt: 2001 }))
      .resolves.toEqual({ status: 'stored', eventId: fact.eventId });
    await operations.markResourceFactAdmitted(operation.operationId, 2200);
    await expect(ledger.appendResourceFact(JSON.parse(JSON.stringify(fact)), { projectedAt: 2002 }))
      .resolves.toEqual({ status: 'duplicate', eventId: fact.eventId });
    expect(await db('event_log').where({ event_id: fact.eventId }).count({ count: '*' }).first())
      .toMatchObject({ count: 1 });
    await expect(operations.getById(operation.operationId)).resolves.toMatchObject({ ledgerProjectionState: 'stored' });
    await expect(db('file_operations').where({ operation_id: operation.operationId }).first())
      .resolves.toMatchObject({ updated_at: 2200 });

    const conflictOperation = await succeededOperation(
      operations, 200, 'docs/b.md', 1100, 2100, { kind: 'absent' },
    );
    const conflictingFact = await factFor(db, operations, conflictOperation.operationId);
    await db('event_log').insert({
      event_id: conflictingFact.eventId, event_type: 'workspace:switched', actor_type: 'system',
      occurred_at: 1, summary: 'established truth', payload_json: '{}', created_at: 1,
    });
    await expect(ledger.appendResourceFact(conflictingFact, { projectedAt: 2101 }))
      .resolves.toEqual({ status: 'conflict', eventId: conflictingFact.eventId });
    await expect(db('event_log').where({ event_id: conflictingFact.eventId }).first())
      .resolves.toMatchObject({ summary: 'established truth' });
    await expect(operations.getById(conflictOperation.operationId))
      .resolves.toMatchObject({ ledgerProjectionState: 'conflict' });
  });

  test('queries AND-combined selectors with deterministic ordering/default/max limits and no bytes', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const ledger = createResourceProvenanceRepository(db);
    const fixtures = [
      [300, 'docs/sub/a.md', 1200, 3000, Buffer.from('private-a')],
      [400, 'docs/sub/a.md', 1201, 3000, Buffer.from('private-b')],
      [500, 'docs/sub/b.md', 1202, 2999, null],
      [600, 'other/a.md', 1203, 2998, Buffer.from('private-c')],
    ];
    const facts = [];
    for (const [number, canonicalPath, acceptedAt, occurredAt, bytes] of fixtures) {
      const operation = await succeededOperation(
        operations,
        number,
        canonicalPath,
        acceptedAt,
        occurredAt,
        bytes ? { kind: 'bytes', bytes } : { kind: 'absent' },
      );
      const fact = await factFor(db, operations, operation.operationId);
      facts.push(fact);
      await ledger.appendResourceFact(fact, { projectedAt: occurredAt + 10 });
    }

    const ordered = await ledger.query({ workspaceId: 'workspace-1' });
    expect(ordered.map((item) => item.eventId)).toEqual([
      facts[0].eventId, facts[1].eventId, facts[2].eventId, facts[3].eventId,
    ].sort((left, right) => {
      const leftFact = facts.find((fact) => fact.eventId === left);
      const rightFact = facts.find((fact) => fact.eventId === right);
      return rightFact.occurredAt - leftFact.occurredAt || (left < right ? -1 : left > right ? 1 : 0);
    }));
    const selected = await ledger.query({
      workspaceId: 'workspace-1', fileName: 'a.md', folderPrefix: 'docs', since: 3000, limit: 200,
    });
    expect(selected).toHaveLength(2);
    expect(selected.every((item) => item.canonicalPath === 'docs/sub/a.md')).toBe(true);
    expect(await ledger.query({
      workspaceId: 'workspace-1', canonicalPath: 'docs/sub/b.md', operationId: facts[2].operationId,
    })).toHaveLength(1);
    expect(await ledger.query({ workspaceId: 'workspace-1', folderPrefix: 'Docs' })).toHaveLength(0);
    await expect(ledger.query({ workspaceId: 'workspace-1', limit: 201 })).rejects.toThrow(/1 through 200/u);
    await expect(ledger.query({ workspaceId: 'workspace-1', fileName: '.' }))
      .rejects.toThrow(/normalized basename/u);
    await expect(ledger.query({ workspaceId: 'workspace-1', fileName: '..' }))
      .rejects.toThrow(/normalized basename/u);

    const serialized = JSON.stringify(ordered);
    expect(serialized).not.toContain('private-');
    expect(serialized).not.toContain('payload');
    expect(serialized).not.toContain('snapshot_bytes');
    expect(ordered.find((item) => item.eventId === facts[2].eventId).snapshot)
      .toEqual({ kind: 'absent', byteLength: 0, capturedAt: 1203 });
    expect(ordered.find((item) => item.eventId === facts[0].eventId).snapshot)
      .toMatchObject({ kind: 'bytes', byteLength: Buffer.byteLength('private-a'), sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  });

  test('defaults to 50 rows and permits the exact 200-row maximum', async () => {
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const ledger = createResourceProvenanceRepository(db);
    for (let index = 0; index < 51; index += 1) {
      const number = 1000 + (index * 10);
      const operation = await succeededOperation(
        operations,
        number,
        `bulk/${String(index).padStart(2, '0')}.md`,
        4000 + index,
        5000 + index,
        { kind: 'absent' },
      );
      await ledger.appendResourceFact(await factFor(db, operations, operation.operationId), {
        projectedAt: 6000 + index,
      });
    }
    await expect(ledger.query({ workspaceId: 'workspace-1' })).resolves.toHaveLength(50);
    await expect(ledger.query({ workspaceId: 'workspace-1', limit: 200 })).resolves.toHaveLength(51);
  });

  test('retries concurrent exact duplicate append across two connections without raw contention', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-ledger-contention-'));
    const filename = path.join(tempRoot, 'fixture.db');
    let rivalDb;
    try {
      db = await migrate(createDb(filename));
      const operations = createFileOperationRepository(db);
      const operation = await succeededOperation(
        operations, 1700, 'docs/concurrent.md', 7000, 7100, { kind: 'absent' },
      );
      const fact = await factFor(db, operations, operation.operationId);
      rivalDb = createDb(filename);
      const left = createResourceProvenanceRepository(db);
      const right = createResourceProvenanceRepository(rivalDb);
      const results = await Promise.all([
        left.appendResourceFact(fact, { projectedAt: 7200 }),
        right.appendResourceFact(JSON.parse(JSON.stringify(fact)), { projectedAt: 7201 }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual(['duplicate', 'stored']);
      expect(await db('event_log').where({ event_id: fact.eventId }).count({ count: '*' }).first())
        .toMatchObject({ count: 1 });
      const row = await db('file_operations').where({ operation_id: operation.operationId }).first();
      expect([7200, 7201]).toContain(row.updated_at);
    } finally {
      if (rivalDb) await rivalDb.destroy();
      if (db) { await db.destroy(); db = null; }
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
