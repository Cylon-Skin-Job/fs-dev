'use strict';

const knex = require('knex');
const migration = require('../../lib/db/migrations/034_event_registry_authority');
const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { SYSTEM_SCHEMA_SEEDS } = require('../../lib/event-registry/seed-catalog');

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const UUID_2 = '123e4567-e89b-42d3-a456-426614174001';
const UUID_3 = '123e4567-e89b-42d3-a456-426614174002';
const UUID_4 = '123e4567-e89b-42d3-a456-426614174003';
const UUID_5 = '123e4567-e89b-42d3-a456-426614174004';

function createDb() {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });
}

function origin() {
  return {
    kind: 'local_client',
    connectionId: 'connection-1',
    assurance: 'transport_only',
    reportedUiContext: { viewId: 'view-1', viewInstanceId: 'instance-1' },
  };
}

function resource() {
  return {
    resourceId: UUID_4,
    kind: 'file',
    path: 'ai/Shared/note.md',
    access: { panel: 'office-viewer', path: 'note.md' },
  };
}

function commandAccepted() {
  return {
    eventId: UUID,
    eventType: 'file.command_accepted',
    schemaVersion: 1,
    occurredAt: 0,
    workspaceId: 'workspace-1',
    operationId: UUID_2,
    commandId: UUID_3,
    origin: origin(),
    resource: resource(),
    intent: { kind: 'save', saveReason: 'manual', clientActionId: 'action-1' },
  };
}

function resourceMutated() {
  return {
    eventId: UUID,
    eventType: 'resource.mutated',
    schemaVersion: 1,
    occurredAt: 1,
    workspaceId: 'workspace-1',
    operationId: UUID_2,
    commandId: UUID_3,
    commandAcceptedEventId: UUID_5,
    origin: origin(),
    resource: resource(),
    mutation: { kind: 'modify', saveReason: 'manual' },
    fileVersionId: UUID_5,
  };
}

function resourceChanged() {
  return {
    type: 'resource:changed',
    version: 1,
    eventId: UUID,
    operationId: UUID_2,
    workspaceId: 'workspace-1',
    resourceId: UUID_4,
    resourceKind: 'file',
    operation: 'modify',
    panel: 'file-viewer',
    path: 'ai/Shared/note.md',
    occurredAt: 1,
    workspaceEpoch: UUID_5,
  };
}

function refreshRequired() {
  return {
    type: 'resource:refresh_required',
    version: 1,
    workspaceId: 'workspace-1',
    panel: 'file-viewer',
    path: 'ai/Shared/note.md',
    operationId: UUID_2,
    workspaceEpoch: UUID_5,
    reason: 'projection_failed',
  };
}

function fileSaveRequest() {
  return {
    type: 'file_save',
    version: 1,
    requestId: 'save-request-1',
    workspaceId: 'workspace-1',
    workspaceEpoch: UUID,
    panel: 'office-viewer',
    path: 'notes/note.md',
    content: 'hello',
    reason: 'manual',
  };
}

function acceptedSaveIdentity() {
  return {
    type: 'file_save_response',
    version: 1,
    requestId: 'save-request-1',
    workspaceId: 'workspace-1',
    workspaceEpoch: UUID,
    panel: 'office-viewer',
    path: 'notes/note.md',
    operationId: UUID,
    commandId: UUID_2,
    commandAcceptedEventId: UUID_3,
    resourceEventId: UUID_4,
    resourceId: UUID_5,
    fileVersionId: '123e4567-e89b-42d3-a456-426614174005',
    canonicalPath: 'ai/Shared/notes/note.md',
  };
}

describe('literal MVP JSON Schema 2020-12 documents and semantic bounds', () => {
  let db;
  let registry;

  beforeAll(async () => {
    db = createDb();
    await migration.up(db);
    registry = (await createInitializedEventRegistry(db, { now: () => 1_000 })).access;
  });

  afterAll(async () => {
    await db.destroy();
  });

  async function validate(schemaKey, definitionKind, payload) {
    return registry.validatePayload({ schemaKey, schemaVersion: 1, definitionKind }, payload);
  }

  test('accepts all four exact normative shapes and keeps identity separate from ingress access', async () => {
    await expect(validate('file.command_accepted', 'event', commandAccepted()))
      .resolves.toMatchObject({ valid: true, errors: [] });
    await expect(validate('resource.mutated', 'event', resourceMutated()))
      .resolves.toMatchObject({ valid: true, errors: [] });
    await expect(validate('resource:changed', 'projection', resourceChanged()))
      .resolves.toMatchObject({ valid: true, errors: [] });
    await expect(validate('resource:refresh_required', 'projection', refreshRequired()))
      .resolves.toMatchObject({ valid: true, errors: [] });

    const alternateAccess = resourceMutated();
    alternateAccess.resource.access = { panel: 'email-viewer', path: 'messages/note.md' };
    expect((await validate('resource.mutated', 'event', alternateAccess)).valid).toBe(true);
    expect(alternateAccess.resource.resourceId).toBe(resourceMutated().resource.resourceId);
    expect(alternateAccess.resource.path).toBe(resourceMutated().resource.path);
  });

  test('projection schemas enforce exact type/version, operations/reasons, and file-viewer panel', async () => {
    for (const payload of [
      { ...resourceChanged(), panel: 'office-viewer' },
      { ...resourceChanged(), type: 'file_changed' },
      { ...resourceChanged(), version: 2 },
      { ...resourceChanged(), operation: 'delete' },
      { ...refreshRequired(), panel: 'office-viewer' },
      { ...refreshRequired(), reason: 'arbitrary' },
    ]) {
      const key = payload.type === 'resource:refresh_required'
        ? 'resource:refresh_required'
        : 'resource:changed';
      expect((await validate(key, 'projection', payload)).valid).toBe(false);
    }
  });

  test('file_save@1 accepts the exact request and every response union branch', async () => {
    const accepted = acceptedSaveIdentity();
    const variants = [
      fileSaveRequest(),
      {
        type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
        errorCode: 'invalid_request', error: 'The save request is invalid.', retrySafe: true,
      },
      {
        type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
        errorCode: 'stale_workspace', requestId: 'save-request-1', workspaceId: 'workspace-1',
        workspaceEpoch: UUID, error: 'The workspace changed before this save was accepted.', retrySafe: true,
      },
      {
        type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
        errorCode: 'workspace_unavailable', requestId: 'save-request-1',
        error: 'The workspace is not available.', retrySafe: true,
      },
      {
        type: 'file_save_response', version: 1, success: false, outcome: 'rejected',
        errorCode: 'path_not_allowed', requestId: 'save-request-1', workspaceId: 'workspace-1',
        workspaceEpoch: UUID, panel: 'office-viewer', path: 'notes/note.md',
        error: 'The requested path is not allowed.', retrySafe: true,
      },
      {
        ...accepted, success: false, outcome: 'failed_before_replace', errorCode: 'replace_failed',
        error: 'The file could not be replaced.', retrySafe: true, commandFactState: 'admitted',
        resourceFactState: 'not_emitted', ledgerState: 'not_applicable',
      },
      {
        ...accepted, success: false, outcome: 'outcome_unknown', errorCode: 'mutation_outcome_unknown',
        error: 'The save outcome is uncertain and requires reconciliation.', retrySafe: false,
        commandFactState: 'pending', resourceFactState: 'not_emitted', ledgerState: 'not_applicable',
      },
      {
        ...accepted, success: true, outcome: 'succeeded', commandFactState: 'admitted',
        resourceFactState: 'admitted', ledgerState: 'stored', provenanceState: 'complete',
        checkpointState: 'not_requested',
      },
      {
        ...accepted, success: true, outcome: 'succeeded', commandFactState: 'pending',
        resourceFactState: 'pending', ledgerState: 'pending', provenanceState: 'pending_reconciliation',
        checkpointState: 'failed', warningCodes: ['checkpoint_failed', 'provenance_pending'],
      },
    ];
    for (const variant of variants) {
      const result = await validate('file_save', 'command', variant);
      expect(result).toMatchObject({ valid: true, errors: [] });
    }
  });

  test('file_save@1 rejects drift, unknown/null optionals, invalid bounds, and reason/milestone mismatch', async () => {
    const cases = [
      { ...fileSaveRequest(), version: 2 },
      { ...fileSaveRequest(), saveReason: 'manual' },
      { ...fileSaveRequest(), reason: null },
      { ...fileSaveRequest(), milestone: 'release' },
      { ...fileSaveRequest(), reason: 'milestone' },
      { ...fileSaveRequest(), requestId: '' },
      { ...fileSaveRequest(), requestId: '🦊'.repeat(40) },
      { ...fileSaveRequest(), workspaceEpoch: UUID.toUpperCase() },
      { ...fileSaveRequest(), path: '../secret.md' },
      { ...fileSaveRequest(), content: 'bad\0text' },
      { ...fileSaveRequest(), content: '\uD800' },
      { ...fileSaveRequest(), reportedUiContext: null },
    ];
    for (const value of cases) {
      expect((await validate('file_save', 'command', value)).valid).toBe(false);
    }

    const milestone = { ...fileSaveRequest(), reason: 'milestone', milestone: 'release' };
    expect((await validate('file_save', 'command', milestone)).valid).toBe(true);
    expect((await validate('file_save', 'command', {
      ...fileSaveRequest(), reason: 'milestone', milestone: '',
    })).valid).toBe(true);
    expect((await validate('file_save', 'command', {
      ...fileSaveRequest(), reportedUiContext: {},
    })).valid).toBe(true);
  });

  test('file_save@1 reserves all accepted identifiers and enforces warning order/omission', async () => {
    const accepted = {
      ...acceptedSaveIdentity(), success: true, outcome: 'succeeded', commandFactState: 'pending',
      resourceFactState: 'pending', ledgerState: 'pending', provenanceState: 'pending_reconciliation',
      checkpointState: 'failed', warningCodes: ['checkpoint_failed', 'provenance_pending'],
    };
    for (const key of [
      'operationId', 'commandId', 'commandAcceptedEventId', 'resourceEventId',
      'resourceId', 'fileVersionId',
    ]) {
      const missing = { ...accepted };
      delete missing[key];
      expect((await validate('file_save', 'command', missing)).valid).toBe(false);
    }
    expect((await validate('file_save', 'command', {
      ...accepted, warningCodes: ['provenance_pending', 'checkpoint_failed'],
    })).valid).toBe(false);
    expect((await validate('file_save', 'command', {
      ...accepted, checkpointState: 'committed', warningCodes: ['checkpoint_failed', 'provenance_pending'],
    })).valid).toBe(false);
    const complete = {
      ...accepted, commandFactState: 'admitted', resourceFactState: 'admitted', ledgerState: 'stored',
      provenanceState: 'complete', checkpointState: 'committed',
    };
    delete complete.warningCodes;
    expect((await validate('file_save', 'command', complete)).valid).toBe(true);
  });

  test('rejects null optionals and unknown fields at every payload object boundary', async () => {
    const nullOptional = commandAccepted();
    nullOptional.intent.clientActionId = null;
    expect((await validate('file.command_accepted', 'event', nullOptional)).valid).toBe(false);

    const nullContext = commandAccepted();
    nullContext.origin.reportedUiContext = null;
    expect((await validate('file.command_accepted', 'event', nullContext)).valid).toBe(false);

    const topUnknown = { ...resourceMutated(), unknown: true };
    expect((await validate('resource.mutated', 'event', topUnknown)).valid).toBe(false);
    const nestedUnknown = resourceMutated();
    nestedUnknown.resource.access.unknown = true;
    expect((await validate('resource.mutated', 'event', nestedUnknown)).valid).toBe(false);
  });

  test.each([
    ['file.command_accepted', 'event', commandAccepted, 'intent'],
    ['resource.mutated', 'event', resourceMutated, 'mutation'],
  ])('enforces milestone iff saveReason is milestone for %s', async (key, kind, build, field) => {
    const missing = build();
    missing[field] = { ...missing[field], saveReason: 'milestone' };
    delete missing[field].milestone;
    expect((await validate(key, kind, missing)).valid).toBe(false);

    const forbidden = build();
    forbidden[field] = { ...forbidden[field], saveReason: 'manual', milestone: 'release' };
    expect((await validate(key, kind, forbidden)).valid).toBe(false);

    const valid = build();
    valid[field] = { ...valid[field], saveReason: 'milestone', milestone: '' };
    expect((await validate(key, kind, valid)).valid).toBe(true);
  });

  test('supplements character-count schemas with UTF-8 byte caps and scalar validation', async () => {
    const byteHeavyId = resourceChanged();
    byteHeavyId.workspaceId = '🦊'.repeat(40);
    const byteResult = await validate('resource:changed', 'projection', byteHeavyId);
    expect(byteResult.valid).toBe(false);
    expect(byteResult.errors).toContainEqual(expect.objectContaining({
      instancePath: '/workspaceId', code: 'utf8_bytes_exceed_128',
    }));

    const unpaired = commandAccepted();
    unpaired.origin.connectionId = '\uD800';
    const scalarResult = await validate('file.command_accepted', 'event', unpaired);
    expect(scalarResult.valid).toBe(false);
    expect(scalarResult.errors).toContainEqual(expect.objectContaining({
      instancePath: '/origin/connectionId', code: 'unicode_scalar_required',
    }));

    const milestone = commandAccepted();
    milestone.intent = { kind: 'save', saveReason: 'milestone', milestone: '🦊'.repeat(65) };
    expect((await validate('file.command_accepted', 'event', milestone)).valid).toBe(false);
  });

  test.each(['../secret.md', '/absolute.md', 'folder//file.md', 'folder/./file.md', 'folder\\file.md', 'folder/'])
  ('rejects non-normalized workspace-relative and ingress paths: %s', async (invalidPath) => {
    const canonical = resourceChanged();
    canonical.path = invalidPath;
    expect((await validate('resource:changed', 'projection', canonical)).valid).toBe(false);

    const ingress = commandAccepted();
    ingress.resource.access.path = invalidPath;
    expect((await validate('file.command_accepted', 'event', ingress)).valid).toBe(false);
  });

  test('rejects noncanonical UUIDs and nonnegative-integer timestamp violations', async () => {
    expect((await validate('resource:changed', 'projection', {
      ...resourceChanged(), eventId: UUID.toUpperCase(),
    })).valid).toBe(false);
    expect((await validate('resource:changed', 'projection', {
      ...resourceChanged(), occurredAt: -1,
    })).valid).toBe(false);
    expect((await validate('resource:changed', 'projection', {
      ...resourceChanged(), occurredAt: 1.5,
    })).valid).toBe(false);
  });

  test('literal documents retain the exact SPEC field sets and object closure', () => {
    const byKey = new Map(SYSTEM_SCHEMA_SEEDS.map((seed) => [
      `${seed.schemaKey}@${seed.schemaVersion}`,
      seed.definition,
    ]));
    expect(Object.keys(byKey.get('file.command_accepted@1').properties).sort()).toEqual([
      'commandId', 'eventId', 'eventType', 'intent', 'occurredAt', 'operationId',
      'origin', 'resource', 'schemaVersion', 'workspaceId',
    ]);
    expect(Object.keys(byKey.get('resource.mutated@1').properties).sort()).toEqual([
      'commandAcceptedEventId', 'commandId', 'eventId', 'eventType', 'fileVersionId',
      'mutation', 'occurredAt', 'operationId', 'origin', 'resource', 'schemaVersion', 'workspaceId',
    ]);
    expect(Object.keys(byKey.get('resource:changed@1').properties).sort()).toEqual([
      'eventId', 'occurredAt', 'operation', 'operationId', 'panel', 'path', 'resourceId',
      'resourceKind', 'type', 'version', 'workspaceEpoch', 'workspaceId',
    ]);
    expect(Object.keys(byKey.get('resource:refresh_required@1').properties).sort()).toEqual([
      'operationId', 'panel', 'path', 'reason', 'type', 'version', 'workspaceEpoch', 'workspaceId',
    ]);
    function assertObjectClosure(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object') expect(node.additionalProperties).toBe(false);
      for (const value of Object.values(node)) assertObjectClosure(value);
    }

    for (const [key, definition] of byKey.entries()) {
      expect(definition.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      if (!['file_save@1', 'resource:provenance@1', 'agent:activity@1', 'file_tree@1', 'file_content@1'].includes(key)) {
        expect(definition.additionalProperties).toBe(false);
      }
      assertObjectClosure(definition);
    }
  });
});
