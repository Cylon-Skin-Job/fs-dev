'use strict';

const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const { createDurableReservationAuthority } = require('../../lib/file-mutations/durable-reservations');
const { createDb, migrate } = require('./test-db');

function reservationInput() {
  return {
    workspaceId: 'workspace-1', requestId: 'request-reservation', canonicalPath: 'notes/a.md',
    ingressPanel: 'file-viewer', ingressPath: 'notes/a.md', currentFingerprint: null,
    origin: { kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only' },
    saveReason: 'manual', acceptedAt: 1234,
    intendedAfterSha256: '4'.repeat(64), intendedAfterByteLength: 4,
    operationId: '123e4567-e89b-42d3-a456-426614174001',
    commandId: '123e4567-e89b-42d3-a456-426614174002',
    commandAcceptedEventId: '123e4567-e89b-42d3-a456-426614174003',
    resourceEventId: '123e4567-e89b-42d3-a456-426614174004',
    fileVersionId: '123e4567-e89b-42d3-a456-426614174005',
    resourceId: '123e4567-e89b-42d3-a456-426614174006',
  };
}

describe('durable reservation authority compatibility', () => {
  let db;

  afterAll(async () => {
    if (db) await db.destroy();
  });

  test('admits exact durable input, rejects changed input, and reissues after authority restart', async () => {
    jest.resetModules();
    db = await migrate(createDb());
    const operations = createFileOperationRepository(db);
    const operation = await operations.reserve(reservationInput());
    const row = await db('file_operations').where({ operation_id: operation.operationId }).first();
    const body = operations.buildCommandBody(row);
    let authority = createDurableReservationAuthority(db);
    const reservation = await authority.issue({
      operationId: operation.operationId, schemaKey: 'file.command_accepted',
    });
    expect(Object.keys(reservation)).toEqual([]);
    expect(JSON.stringify(reservation)).toBe('{}');

    const registryAccess = (await createInitializedEventRegistry(db, { now: () => 10 })).access;
    let publishers;
    const admitted = [];
    const { bootstrapGovernedEventBus } = require('../../lib/subscriptions/host-bootstrap');
    bootstrapGovernedEventBus({
      registryAccess,
      verifyReservation: authority.verify,
      deliverAdmittedFact: async (fact) => { admitted.push(fact); return []; },
      writeDiagnostic: () => {},
      installFileSavePublishers: (value) => { publishers = value; },
    });
    await expect(publishers.publishFileCommandAccepted({ reservation, body }))
      .resolves.toMatchObject({ admitted: true, eventId: operation.commandAcceptedEventId });
    await expect(publishers.publishFileCommandAccepted({
      reservation,
      body: { ...body, intent: { kind: 'save', saveReason: 'autosave' } },
    })).resolves.toEqual({ admitted: false, eventId: null, deliveries: [] });
    expect(admitted).toHaveLength(1);

    await operations.prepare({
      operationId: operation.operationId,
      preimage: { kind: 'absent' },
      intendedAfterSha256: operation.intendedAfterSha256,
      intendedAfterByteLength: operation.intendedAfterByteLength,
      preparedAt: 1235,
    });
    await operations.markAttempted(operation.operationId, 1236);
    await operations.markSucceeded({
      operationId: operation.operationId,
      occurredAt: 1236,
      completedAt: 1236,
      fingerprint: { dev: 1, ino: 2, size: 4, birthtimeMs: 3 },
    });
    const resourceReservation = await authority.issue({
      operationId: operation.operationId, schemaKey: 'resource.mutated',
    });
    const resourceBody = await operations.getResourceFactBody(operation.operationId);
    await expect(publishers.publishResourceMutated({
      reservation: resourceReservation, body: resourceBody,
    })).resolves.toMatchObject({ admitted: true, eventId: operation.resourceEventId });
    expect(admitted).toHaveLength(2);

    authority = createDurableReservationAuthority(db);
    const reissued = await authority.issue({
      operationId: operation.operationId, schemaKey: 'file.command_accepted',
    });
    await expect(authority.verify({
      reservation: reissued,
      producerId: 'system.file-save-controller',
      schemaKey: 'file.command_accepted',
      schemaVersion: 1,
    })).resolves.toMatchObject({
      eventId: operation.commandAcceptedEventId,
      canonicalHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    await expect(authority.verify({
      reservation,
      producerId: 'system.file-save-controller',
      schemaKey: 'file.command_accepted',
      schemaVersion: 1,
    })).rejects.toThrow(/unknown reservation/u);
  });
});
