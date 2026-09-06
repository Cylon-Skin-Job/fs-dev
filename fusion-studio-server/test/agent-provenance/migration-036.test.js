'use strict';

const initial = require('../../lib/db/migrations/001_initial');
const ledger = require('../../lib/db/migrations/029_event_ledger');
const registry = require('../../lib/db/migrations/034_event_registry_authority');
const provenance = require('../../lib/db/migrations/035_file_provenance');
const migration = require('../../lib/db/migrations/036_agent_tool_provenance');
const { createDb } = require('../resources/test-db');
const { digest, insertTerminalActivity } = require('./helpers');

describe('migration 036 agent tool provenance', () => {
  let db;
  afterEach(async () => { if (db) await db.destroy(); db = null; });

  async function through035() {
    db = createDb();
    await initial.up(db); await ledger.up(db); await registry.up(db); await provenance.up(db);
  }

  test('applies after migration 035 with exactly seven tables, trigger, foreign keys, and query indexes', async () => {
    await through035();
    await migration.up(db);
    const tables = [
      'agent_tool_activities', 'agent_tool_resource_edges', 'agent_snapshot_blobs',
      'agent_resource_snapshots', 'agent_exchange_bind_jobs', 'agent_observation_jobs',
      'agent_renderer_projection_jobs',
    ];
    for (const table of tables) await expect(db.schema.hasTable(table)).resolves.toBe(true);
    const trigger = await db.raw("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='agent_exchange_delete_clear_activity_binding'");
    expect(trigger).toHaveLength(1);
    expect(trigger[0].sql).toContain('exchange_saved_at = NULL');
    expect(trigger[0].sql).toContain('exchange_bound_at = NULL');
    const agentTriggers = await db.raw("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'agent_%' ORDER BY name");
    expect(agentTriggers).toEqual([{ name: 'agent_exchange_delete_clear_activity_binding' }]);
    const activityColumns = await db.raw('PRAGMA table_info(agent_tool_activities)');
    expect(activityColumns.find((column) => column.name === 'candidate_reported_count')).toMatchObject({ notnull: 1, dflt_value: '0' });
    expect(activityColumns.find((column) => column.name === 'authority_root_device')).toMatchObject({ notnull: 0 });
    for (const [table, primaryKey] of [
      ['agent_snapshot_blobs', 'sha256'],
      ['agent_exchange_bind_jobs', 'exchange_id'],
      ['agent_observation_jobs', 'activity_id'],
      ['agent_renderer_projection_jobs', 'source_edge_id'],
    ]) {
      const columns = await db.raw(`PRAGMA table_info(${table})`);
      expect(columns.find((column) => column.name === primaryKey)).toMatchObject({ notnull: 1, pk: 1 });
    }
    const edgeFks = await db.raw('PRAGMA foreign_key_list(agent_tool_resource_edges)');
    expect(edgeFks.map((row) => `${row.table}:${row.on_delete}`)).toEqual(expect.arrayContaining([
      'agent_tool_activities:RESTRICT', 'resource_registry:RESTRICT', 'agent_resource_snapshots:RESTRICT',
    ]));
    const plan = await db.raw("EXPLAIN QUERY PLAN SELECT * FROM agent_tool_activities WHERE workspace_id='w' AND terminal_observed_at < 10 ORDER BY id DESC LIMIT 5");
    expect(plan.some((row) => /agent_tool_activities_workspace_time_idx/u.test(row.detail))).toBe(true);
  });

  test('enforces row-local UUID/digest/bounds/state/default/check matrices', async () => {
    await through035(); await migration.up(db);
    const base = {
      activity_id: '11111111-1111-4111-8111-111111111111',
      event_id: '22222222-2222-4222-8222-222222222222',
      workspace_id: 'w', thread_id: 't', turn_id: 'turn', harness_id: 'h', provider: 'p',
      tool_call_id: 'call', tool_name: 'write', native_tool_name: 'write',
      authority_root_sha256: 'a'.repeat(64), status: 'announced', announced_observed_at: 1,
      created_at: 1, updated_at: 1,
    };
    await db('agent_tool_activities').insert(base);
    await expect(db('agent_tool_activities').insert({ ...base, activity_id: 'bad', event_id: '33333333-3333-4333-8333-333333333333', tool_call_id: 'other' })).rejects.toBeDefined();
    await expect(db('agent_tool_activities').insert({
      ...base,
      activity_id: '11111111-1111-4111-8111-1111-1111111',
      event_id: '33333333-3333-4333-8333-333333333333',
      tool_call_id: 'other-malformed',
    })).rejects.toBeDefined();
    await expect(db('agent_tool_activities').insert({ ...base, activity_id: '44444444-4444-4444-8444-444444444444', event_id: '55555555-5555-4555-8555-555555555555', tool_call_id: 'other', authority_root_device: '01', authority_root_inode: '2' })).rejects.toBeDefined();
    await expect(db('agent_tool_activities').insert({ ...base, activity_id: '66666666-6666-4666-8666-666666666666', event_id: '77777777-7777-4777-8777-777777777777', tool_call_id: 'other2', candidate_reported_count: 65 })).rejects.toBeDefined();
    await expect(db('agent_tool_activities').insert({
      ...base,
      activity_id: '88888888-8888-4888-8888-888888888888',
      event_id: '99999999-9999-4999-8999-999999999999',
      tool_call_id: 'unsafe-time', announced_observed_at: Number.MAX_SAFE_INTEGER + 1,
      created_at: Number.MAX_SAFE_INTEGER + 1, updated_at: Number.MAX_SAFE_INTEGER + 1,
    })).rejects.toBeDefined();
    await expect(db('agent_snapshot_blobs').insert({ sha256: 'b'.repeat(64), byte_length: 1, encoding: 'utf8', bytes: Buffer.alloc(2), first_stored_at: 1 })).rejects.toBeDefined();
    await expect(db('agent_snapshot_blobs').insert({
      sha256: null, byte_length: 0, encoding: 'utf8', bytes: Buffer.alloc(0), first_stored_at: 1,
    })).rejects.toBeDefined();
    await expect(db('agent_observation_jobs').insert({
      activity_id: null, workspace_id: 'w', state: 'pending', next_attempt_at: 1, created_at: 1, updated_at: 1,
    })).rejects.toBeDefined();
    await db('threads').insert({ thread_id: 't', panel_id: 'chat', created_at: '1' });
    await db('exchanges').insert({
      id: 1, thread_id: 't', seq: 1, ts: 1, user_input: 'prompt', assistant: '{}', metadata: '{}',
    });
    await expect(db('agent_exchange_bind_jobs').insert({
      exchange_id: null, workspace_id: 'w', thread_id: 't', turn_id: 'turn',
      exchange_saved_at: 1, created_at: 1, updated_at: 1,
    })).rejects.toBeDefined();
    await expect(db('agent_renderer_projection_jobs').insert({
      source_edge_id: null, workspace_id: 'w', activity_id: base.activity_id,
      observed_at: 1, relation: 'unchanged', state: 'pending', next_attempt_at: 1,
      created_at: 1, updated_at: 1,
    })).rejects.toBeDefined();
  });

  test('reverses only migration 036 in required dependency order', async () => {
    await through035(); await migration.up(db);
    await insertTerminalActivity(db);
    await migration.down(db);
    await expect(db.schema.hasTable('agent_tool_activities')).resolves.toBe(false);
    await expect(db.schema.hasTable('resource_registry')).resolves.toBe(true);
    await expect(db.schema.hasTable('event_schema_registry')).resolves.toBe(true);
  });

  test('rejects a trailing slash in normalized snapshot folder_path', async () => {
    await through035(); await migration.up(db);
    const terminal = await insertTerminalActivity(db);
    await db('agent_resource_snapshots').insert({
      snapshot_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      observation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      event_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      workspace_id: terminal.input.workspaceId,
      resource_id: null,
      canonical_path: 'docs/a.txt', file_name: 'a.txt', folder_path: 'docs',
      state: 'absent', blob_sha256: null, byte_length: 0, relation: 'first_observation', previous_snapshot_id: null,
      source_activity_id: terminal.input.activityId, source_edge_id: terminal.candidate.edgeId,
      access_family: 'write', access_kind: 'write', extraction_basis: 'structured_path', snapshot_observed_at: 101,
      fact_json: '{}', fact_sha256: digest('{}'), created_at: 101, updated_at: 101,
    });
    await expect(db('agent_resource_snapshots').update({ folder_path: 'docs/' })).rejects.toBeDefined();
  });

  test('requires every admitted activity and snapshot fact to enter a valid ledger state', async () => {
    await through035(); await migration.up(db);
    const terminal = await insertTerminalActivity(db);
    await expect(db('agent_tool_activities').where({ activity_id: terminal.input.activityId }).update({
      fact_admission_state: 'admitted',
    })).rejects.toBeDefined();
    await expect(db('agent_tool_activities').where({ activity_id: terminal.input.activityId }).first())
      .resolves.toMatchObject({ fact_admission_state: 'pending', ledger_state: 'not_ready' });
    await expect(db('agent_tool_activities').where({ activity_id: terminal.input.activityId }).update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 102,
    })).resolves.toBe(1);

    await db('agent_resource_snapshots').insert({
      snapshot_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      observation_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      event_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      workspace_id: terminal.input.workspaceId,
      resource_id: null,
      canonical_path: 'docs/a.txt', file_name: 'a.txt', folder_path: 'docs',
      state: 'absent', blob_sha256: null, byte_length: 0, relation: 'first_observation', previous_snapshot_id: null,
      source_activity_id: terminal.input.activityId, source_edge_id: terminal.candidate.edgeId,
      access_family: 'write', access_kind: 'write', extraction_basis: 'structured_path', snapshot_observed_at: 103,
      fact_json: '{}', fact_sha256: digest('{}'), created_at: 103, updated_at: 103,
    });
    await expect(db('agent_resource_snapshots').update({ fact_admission_state: 'admitted' })).rejects.toBeDefined();
    await expect(db('agent_resource_snapshots').first())
      .resolves.toMatchObject({ fact_admission_state: 'pending', ledger_state: 'not_ready' });
    await expect(db('agent_resource_snapshots').update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 104,
    })).resolves.toBe(1);
  });

  test('rejects null terminal reasons and null projection settlement', async () => {
    await through035(); await migration.up(db);
    const terminal = await insertTerminalActivity(db);
    const edge = () => db('agent_tool_resource_edges').where({ edge_id: terminal.candidate.edgeId });
    await expect(edge().update({
      observation_state: 'skipped', observation_reason: null, observed_at: 101, next_observation_at: null,
    })).rejects.toBeDefined();
    await expect(edge().first()).resolves.toMatchObject({
      observation_state: 'pending', observation_reason: null, observation_attempt_count: 0,
    });

    await db('agent_renderer_projection_jobs').insert({
      source_edge_id: terminal.candidate.edgeId,
      workspace_id: terminal.input.workspaceId,
      activity_id: terminal.input.activityId,
      observed_at: 101,
      relation: 'unchanged',
      state: 'pending', next_attempt_at: 101, created_at: 101, updated_at: 101,
    });
    await expect(db('agent_renderer_projection_jobs').update({
      state: 'settled', next_attempt_at: null, settled_at: 102, settlement: null, updated_at: 102,
    })).rejects.toBeDefined();
    await expect(db('agent_renderer_projection_jobs').update({
      state: 'settled', next_attempt_at: null, settled_at: 102, settlement: 'v2_sent', updated_at: 102,
    })).resolves.toBe(1);
  });
});
