'use strict';

const crypto = require('crypto');
const { createDb, migrate } = require('../resources/test-db');
const { insertTerminalActivity } = require('./helpers');
const { createAgentActivityQueryRepository } = require('../../lib/agent-provenance/query-repository');
const { createPayloadValidator } = require('../../lib/event-registry/schema-validator');
const { rejectedCandidateSha256 } = require('../../lib/agent-provenance/candidate-fingerprints');
const definition = require('../../lib/event-registry/schemas/agent-activity-v1.json');

function uuid(number) {
  const suffix = String(number).padStart(12, '0');
  return `${String(number).padStart(8, '0')}-1111-4111-8111-${suffix}`;
}

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

describe('agent activity query filters and summaries', () => {
  let db;
  let query;
  beforeEach(async () => {
    db = await migrate(createDb());
    query = createAgentActivityQueryRepository(db);
  });
  afterEach(async () => db.destroy());

  async function seed(number, overrides = {}) {
    const record = await insertTerminalActivity(db, {
      activityId: uuid(number), eventId: uuid(number + 100), edgeId: uuid(number + 200),
      toolCallId: `call-${number}`, threadId: `thread-${number}`, turnId: `turn-${number}`,
      canonicalPath: `docs/${number}.txt`, terminalObservedAt: number * 100,
      announcedObservedAt: number * 100, argumentsObservedAt: number * 100,
      now: number * 100, ...overrides,
    });
    return record;
  }

  test('supports the required path/thread/access examples with AND-across and OR-within semantics', async () => {
    const root = await seed(1, { canonicalPath: 'root.txt', accessFamily: 'read', accessKind: 'read' });
    const write = await seed(2, { canonicalPath: 'src/app.ts', accessFamily: 'write', accessKind: 'write' });
    const read = await seed(3, { canonicalPath: 'src/app.ts', accessFamily: 'read', accessKind: 'read' });
    await seed(4, { canonicalPath: 'src/components/button.ts', accessFamily: 'execute', accessKind: 'execute' });
    await seed(5, { workspaceId: 'workspace-other', canonicalPath: 'src/app.ts', accessFamily: 'read', accessKind: 'read' });
    await db('agent_tool_resource_edges').whereIn('edge_id', [
      root.candidate.edgeId, write.candidate.edgeId, read.candidate.edgeId, uuid(204), uuid(205),
    ]).update({
      observation_state: 'skipped', observation_reason: 'final_symlink', next_observation_at: null,
      observed_at: 500, updated_at: 500,
    });

    const touches = await query.query({ workspaceId: 'workspace-1', subject: 'tool_calls', path: 'src/app.ts' });
    expect(touches.items.map((item) => item.toolCallId)).toEqual(['call-3', 'call-2']);
    expect(createPayloadValidator(definition, 'agent:activity')({
      type: 'agent:activity:result', version: 1, requestId: 'tool-query',
      workspaceId: 'workspace-1', workspaceEpoch: uuid(999), subject: 'tool_calls', items: touches.items,
    })).toEqual({ valid: true, errors: [] });
    const writes = await query.query({
      workspaceId: 'workspace-1', subject: 'resource_edges', path: 'src/app.ts',
      threadId: 'thread-2', accessFamilies: ['write'], accessKinds: ['write'],
    });
    expect(writes.items.map((item) => item.toolCallId)).toEqual(['call-2']);
    const reads = await query.query({
      workspaceId: 'workspace-1', subject: 'resource_edges', path: 'src/app.ts', accessFamilies: ['read'],
    });
    expect(reads.items.map((item) => item.threadId)).toEqual(['thread-3']);
    const folder = await query.query({
      workspaceId: 'workspace-1', subject: 'resource_edges', folderPrefix: 'src',
      accessFamilies: ['read', 'write', 'execute'], since: 500, until: 500,
    });
    expect(folder.items.map((item) => item.resource.path)).toEqual([
      'src/components/button.ts', 'src/app.ts', 'src/app.ts',
    ]);
    const rootOnly = await query.query({ workspaceId: 'workspace-1', subject: 'resource_edges', folderPrefix: '' });
    expect(rootOnly.items.map((item) => item.resource.path)).toEqual(['root.txt']);
  });

  test('changedOnly counts each path once and returns exact snapshot metadata without bytes', async () => {
    const first = await seed(10, { canonicalPath: 'docs/change.txt', accessFamily: 'read', accessKind: 'read' });
    const changed = await seed(11, { canonicalPath: 'docs/change.txt', accessFamily: 'write', accessKind: 'write' });
    const resourceId = uuid(900);
    const firstSnapshot = uuid(901);
    const changedSnapshot = uuid(902);
    const firstBytes = Buffer.from('A');
    const changedBytes = Buffer.from('B');
    const firstHash = digest(firstBytes);
    const changedHash = digest(changedBytes);
    await db('resource_registry').insert({
      resource_id: resourceId, workspace_id: 'workspace-1', kind: 'file', canonical_path: 'docs/change.txt',
      lifecycle_state: 'live', fingerprint_dev: '1', fingerprint_ino: '2', fingerprint_size: 1,
      fingerprint_birthtime_ms: null, tombstone_reason: null, created_at: 1, updated_at: 1, tombstoned_at: null,
    });
    await db('agent_snapshot_blobs').insert([
      { sha256: firstHash, byte_length: 1, encoding: 'utf8', bytes: firstBytes, first_stored_at: 1_000 },
      { sha256: changedHash, byte_length: 1, encoding: 'utf8', bytes: changedBytes, first_stored_at: 1_100 },
    ]);
    await db('agent_resource_snapshots').insert([
      {
        snapshot_id: firstSnapshot, observation_id: uuid(903), event_id: uuid(904), workspace_id: 'workspace-1',
        resource_id: resourceId, canonical_path: 'docs/change.txt', file_name: 'change.txt', folder_path: 'docs',
        state: 'bytes', blob_sha256: firstHash, byte_length: 1, relation: 'first_observation', previous_snapshot_id: null,
        source_activity_id: first.input.activityId, source_edge_id: first.candidate.edgeId,
        access_family: 'read', access_kind: 'read', extraction_basis: 'structured_path', snapshot_observed_at: 1_000,
        fact_json: '{}', fact_sha256: digest('{}'), created_at: 1_000, updated_at: 1_000,
      },
      {
        snapshot_id: changedSnapshot, observation_id: uuid(905), event_id: uuid(906), workspace_id: 'workspace-1',
        resource_id: resourceId, canonical_path: 'docs/change.txt', file_name: 'change.txt', folder_path: 'docs',
        state: 'bytes', blob_sha256: changedHash, byte_length: 1, relation: 'changed', previous_snapshot_id: firstSnapshot,
        source_activity_id: changed.input.activityId, source_edge_id: changed.candidate.edgeId,
        access_family: 'write', access_kind: 'write', extraction_basis: 'structured_path', snapshot_observed_at: 1_100,
        fact_json: '{}', fact_sha256: digest('{}'), created_at: 1_100, updated_at: 1_100,
      },
    ]);
    await db('agent_tool_resource_edges').where({ edge_id: first.candidate.edgeId }).update({
      resource_id: resourceId, observation_state: 'first_observation', observation_attempt_count: 1,
      next_observation_at: null, observed_at: 1_000, snapshot_id: firstSnapshot, updated_at: 1_000,
    });
    await db('agent_tool_resource_edges').where({ edge_id: changed.candidate.edgeId }).update({
      resource_id: resourceId, observation_state: 'changed', observation_attempt_count: 1,
      next_observation_at: null, observed_at: 1_100, snapshot_id: changedSnapshot,
      previous_snapshot_id: firstSnapshot, updated_at: 1_100,
    });

    const tools = await query.query({ workspaceId: 'workspace-1', subject: 'tool_calls', path: 'docs/change.txt', changedOnly: true });
    expect(tools.items).toHaveLength(1);
    expect(tools.items[0]).toMatchObject({ toolCallId: 'call-11', resources: { count: 1, changedCount: 1 } });
    const edges = await query.query({
      workspaceId: 'workspace-1', subject: 'resource_edges', changedOnly: true, since: 1_100, until: 1_100,
    });
    expect(edges.items).toEqual([expect.objectContaining({
      toolCallId: 'call-11', observation: {
        state: 'changed', observedAt: 1_100, snapshotId: changedSnapshot,
        previousSnapshotId: firstSnapshot,
        snapshot: { state: 'bytes', sha256: changedHash, byteLength: 1, relation: 'changed' },
      },
    })]);
    const wire = {
      type: 'agent:activity:result', version: 1, requestId: 'query-1', workspaceId: 'workspace-1',
      workspaceEpoch: uuid(999), subject: 'resource_edges', items: edges.items,
    };
    expect(createPayloadValidator(definition, 'agent:activity')(wire)).toEqual({ valid: true, errors: [] });
    expect(wire.items[0].observation.snapshot).not.toHaveProperty('bytes');
  });

  test('all scalar, enum-array, time, ID, and keyset filters compose without cross-workspace leakage', async () => {
    const item = await seed(20, { canonicalPath: 'x/a.txt', status: 'error', accessFamily: 'unknown', accessKind: 'unknown' });
    await db('agent_tool_resource_edges').where({ edge_id: item.candidate.edgeId }).update({
      observation_state: 'failed', observation_reason: 'unreadable', next_observation_at: null,
      observed_at: 2_001, updated_at: 2_001,
    });
    const result = await query.query({
      workspaceId: 'workspace-1', subject: 'resource_edges', activityId: item.input.activityId,
      threadId: 'thread-20', turnId: 'turn-20', toolCallId: 'call-20', harnessId: 'opencode',
      toolNames: ['write', 'read'], statuses: ['completed', 'error'], accessFamilies: ['unknown'],
      accessKinds: ['unknown'], fileName: 'a.txt', folderPrefix: 'x', since: 2_001, until: 2_001,
      cursor: String(Number.MAX_SAFE_INTEGER), limit: 100,
    });
    expect(result.items).toEqual([expect.objectContaining({ activityId: item.input.activityId, status: 'error' })]);
  });

  test('rejected outside candidates expose only their fingerprint and fixed reason', async () => {
    const outsideValue = '../private/outside-secret.txt';
    await seed(30, {
      candidates: [{
        edgeId: uuid(230), candidateValue: outsideValue,
        candidateSha256: rejectedCandidateSha256(outsideValue, 'outside_workspace'),
        reason: 'outside_workspace', accessFamily: 'read', accessKind: 'read',
        extractionBasis: 'structured_path',
      }],
    });
    const result = await query.query({ workspaceId: 'workspace-1', subject: 'resource_edges' });
    expect(result.items).toEqual([expect.objectContaining({
      candidateSha256: rejectedCandidateSha256(outsideValue, 'outside_workspace'),
      observation: { state: 'skipped', reason: 'outside_workspace', observedAt: 3_000 },
    })]);
    expect(result.items[0]).not.toHaveProperty('resource');
    expect(JSON.stringify(result)).not.toContain(outsideValue);
  });

  test.each(['tool_calls', 'resource_edges'])(
    'validated %s result cursor round-trips only through the positive safe-integer boundary',
    async (subject) => {
      const validate = createPayloadValidator(definition, 'agent:activity');
      const result = {
        type: 'agent:activity:result', version: 1, requestId: 'cursor-round-trip',
        workspaceId: 'workspace-1', workspaceEpoch: uuid(999), subject, items: [],
        nextCursor: String(Number.MAX_SAFE_INTEGER),
      };
      expect(validate(result)).toEqual({ valid: true, errors: [] });
      await expect(query.query({
        workspaceId: 'workspace-1', subject, cursor: result.nextCursor,
      })).resolves.toEqual({ items: [] });

      const unsafe = { ...result, nextCursor: String(Number.MAX_SAFE_INTEGER + 1) };
      expect(validate(unsafe)).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([expect.objectContaining({
          instancePath: '/nextCursor', code: 'safe_integer_cursor_required',
        })]),
      });
      await expect(query.query({
        workspaceId: 'workspace-1', subject, cursor: unsafe.nextCursor,
      })).rejects.toThrow('cursor is invalid');
    },
  );
});
