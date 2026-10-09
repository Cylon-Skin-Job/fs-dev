'use strict';

const crypto = require('crypto');
const { createDb, migrate } = require('../resources/test-db');
const { createAgentExchangeBindRepository, createAgentExchangeBinder, valueSha256 } = require('../../lib/agent-provenance/exchange-bind-repository');
const { createAgentActivityQueryRepository } = require('../../lib/agent-provenance/query-repository');
const { insertTerminalActivity } = require('./helpers');
const { canonicalizeJson } = require('../../lib/event-registry/canonical-json');
const { MAX_CANONICAL_BYTES } = require('../../lib/agent-provenance/bounded-canonical-hash');

describe('agent exchange binding and progressive queries', () => {
  let db;
  beforeEach(async () => {
    db = await migrate(createDb());
    await db('threads').insert({ thread_id: 'thread-1', panel_id: 'chat', name: 'Thread', created_at: '1' });
  });
  afterEach(async () => { await db.destroy(); });

  async function exchange(parts, seq = 1, ts = 500) {
    const [exchangeId] = await db('exchanges').insert({ thread_id: 'thread-1', seq, ts, user_input: 'prompt', assistant: JSON.stringify({ parts }), metadata: '{}' });
    const repository = createAgentExchangeBindRepository(db, { now: () => ts + 1 });
    await db.transaction((trx) => repository.insertInTransaction(trx, { exchangeId, workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-1', exchangeSavedAt: ts }));
    return { exchangeId, repository };
  }

  test('binds exact complete detail and triple-clears direct/cascading exchange deletion', async () => {
    const args = { path: 'docs/a.txt' }; const result = { output: 'ok' };
    await insertTerminalActivity(db, { argumentsSha256: valueSha256(args), resultSha256: valueSha256(result) });
    const saved = await exchange([{ type: 'tool_call', toolCallId: 'call-1', arguments: args, result, terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true }]);
    await expect(createAgentExchangeBinder(saved.repository).drainBatch()).resolves.toEqual([expect.objectContaining({ state: 'applied', boundActivities: 1 })]);
    await expect(db('agent_tool_activities').first()).resolves.toMatchObject({ exchange_id: saved.exchangeId, exchange_saved_at: 500, exchange_bound_at: 501 });
    const boundQuery = await createAgentActivityQueryRepository(db).query({
      workspaceId: 'workspace-1', subject: 'tool_calls', exchangeId: saved.exchangeId,
    });
    expect(boundQuery.items).toEqual([expect.objectContaining({
      exchangeId: saved.exchangeId,
      detailRef: { kind: 'exchange_tool_part', exchangeId: saved.exchangeId, toolCallId: 'call-1' },
    })]);
    expect(JSON.stringify(boundQuery)).not.toContain('output');
    await db('exchanges').where({ id: saved.exchangeId }).delete();
    await expect(db('agent_tool_activities').first()).resolves.toMatchObject({ exchange_id: null, exchange_saved_at: null, exchange_bound_at: null });
    const saved2 = await exchange([], 2, 600);
    await db('threads').where({ thread_id: 'thread-1' }).delete();
    await expect(db('agent_exchange_bind_jobs').where({ exchange_id: saved2.exchangeId }).first()).resolves.toBeUndefined();
  });

  test.each([
    ['incomplete_tool_part', { type: 'tool_call', toolCallId: 'call-1', arguments: {}, result: {} }],
    ['detail_hash_mismatch', { type: 'tool_call', toolCallId: 'call-1', arguments: { wrong: true }, result: {}, terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true }],
  ])('marks %s conflict and leaves activity unbound', async (code, part) => {
    await insertTerminalActivity(db, { argumentsSha256: valueSha256({ expected: true }) });
    const saved = await exchange([part]);
    await expect(saved.repository.bindNext()).resolves.toMatchObject({ state: 'conflict', conflictCode: code });
    await expect(db('agent_tool_activities').first()).resolves.toMatchObject({ exchange_id: null });
  });

  test('rejects ambiguous same-call activities across harness identities', async () => {
    await insertTerminalActivity(db);
    await insertTerminalActivity(db, {
      activityId: '44444444-4444-4444-8444-444444444444',
      eventId: '55555555-5555-4555-8555-555555555555',
      edgeId: '66666666-6666-4666-8666-666666666666',
      harnessId: 'other-harness',
    });
    const saved = await exchange([{
      type: 'tool_call', toolCallId: 'call-1', terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true,
    }]);
    await expect(saved.repository.bindNext()).resolves.toMatchObject({ state: 'conflict', conflictCode: 'duplicate_tool_part' });
    await expect(db('agent_tool_activities').whereNotNull('exchange_id')).resolves.toHaveLength(0);
  });

  test('marks a pre-existing different exchange binding as conflict without retargeting it', async () => {
    await insertTerminalActivity(db);
    const [existingExchangeId] = await db('exchanges').insert({
      thread_id: 'thread-1', seq: 1, ts: 400, user_input: 'older', assistant: '{"parts":[]}', metadata: '{}',
    });
    await db('agent_tool_activities').update({
      exchange_id: existingExchangeId, exchange_saved_at: 400, exchange_bound_at: 401,
    });
    const saved = await exchange([{
      type: 'tool_call', toolCallId: 'call-1',
      terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true,
    }], 2, 500);
    await expect(saved.repository.bindNext()).resolves.toMatchObject({
      state: 'conflict', conflictCode: 'different_binding',
    });
    await expect(db('agent_tool_activities').first()).resolves.toMatchObject({
      exchange_id: existingExchangeId, exchange_saved_at: 400, exchange_bound_at: 401,
    });
  });

  test('rejects duplicate schema-valid exchange IDs even when no activity uses that ID', async () => {
    await insertTerminalActivity(db);
    const complete = { terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true };
    const saved = await exchange([
      { type: 'tool_call', toolCallId: 'call-1', ...complete },
      { type: 'tool_call', toolCallId: 'unowned-call', ...complete },
      { type: 'tool_call', toolCallId: 'unowned-call', ...complete },
    ]);
    await expect(saved.repository.bindNext()).resolves.toMatchObject({ state: 'conflict', conflictCode: 'duplicate_tool_part' });
    await expect(db('agent_tool_activities').whereNotNull('exchange_id')).resolves.toHaveLength(0);
  });

  test('bounded fingerprints match canonical JSON and enforce exact depth, visit, and byte caps', () => {
    const ordinary = { z: -0, a: ['rocket 🚀', true, null, 1.25] };
    const expected = crypto.createHash('sha256').update(canonicalizeJson(ordinary), 'utf8').digest('hex');
    expect(valueSha256(ordinary)).toBe(expected);
    const nested = (depth) => {
      let value = 0;
      for (let index = 0; index < depth; index += 1) value = [value];
      return value;
    };
    expect(valueSha256(nested(32))).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => valueSha256(nested(33))).toThrow(/bounded canonical contract/u);
    expect(valueSha256(Array(9_999).fill(null))).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => valueSha256(Array(10_000).fill(null))).toThrow(/bounded canonical contract/u);
    expect(valueSha256('x'.repeat(MAX_CANONICAL_BYTES - 2))).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => valueSha256('x'.repeat(MAX_CANONICAL_BYTES - 1))).toThrow(/bounded canonical contract/u);

    const byteLength = jest.spyOn(Buffer, 'byteLength');
    try {
      expect(() => valueSha256('x'.repeat(MAX_CANONICAL_BYTES * 8))).toThrow(/bounded canonical contract/u);
      expect(Math.max(...byteLength.mock.calls.map(([chunk]) => chunk.length))).toBeLessThanOrEqual(8_192);
    } finally {
      byteLength.mockRestore();
    }

    const overVisited = Object.fromEntries(Array.from({ length: 10_000 }, (_, index) => [`k${index}`, null]));
    const ownKeys = jest.spyOn(Reflect, 'ownKeys');
    try {
      expect(() => valueSha256(overVisited)).toThrow(/bounded canonical contract/u);
      expect(ownKeys).not.toHaveBeenCalled();
    } finally {
      ownKeys.mockRestore();
    }

    const overCanonicalKeyBudget = Object.fromEntries(Array.from(
      { length: 5_000 },
      (_, index) => [`${String(index).padStart(6, '0')}-${'k'.repeat(300)}`, null],
    ));
    const budgetOwnKeys = jest.spyOn(Reflect, 'ownKeys');
    try {
      expect(() => valueSha256(overCanonicalKeyBudget)).toThrow(/bounded canonical contract/u);
      expect(budgetOwnKeys).not.toHaveBeenCalled();
    } finally {
      budgetOwnKeys.mockRestore();
    }

    const hidden = {};
    Object.defineProperty(hidden, 'secret', { value: true, enumerable: false });
    expect(() => valueSha256(hidden)).toThrow(/bounded canonical contract/u);
    expect(() => valueSha256({ [Symbol('secret')]: true })).toThrow(/bounded canonical contract/u);
    const decorated = [null]; decorated.extra = true;
    expect(() => valueSha256(decorated)).toThrow(/bounded canonical contract/u);
  });

  test('binder skips an omitted fingerprint even when the exchange value exceeds fingerprint bounds', async () => {
    let overDepth = 0;
    for (let index = 0; index < 33; index += 1) overDepth = [overDepth];
    await insertTerminalActivity(db);
    const withoutFingerprint = await exchange([{
      type: 'tool_call', toolCallId: 'call-1', arguments: overDepth,
      terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true,
    }]);
    await expect(withoutFingerprint.repository.bindNext()).resolves.toMatchObject({ state: 'applied', boundActivities: 1 });
  });

  test('binder conflicts when an available fingerprint cannot be recomputed within bounds', async () => {
    let overDepth = 0;
    for (let index = 0; index < 33; index += 1) overDepth = [overDepth];
    await insertTerminalActivity(db, { argumentsSha256: 'a'.repeat(64) });
    const unavailable = await exchange([{
      type: 'tool_call', toolCallId: 'call-1', arguments: overDepth,
      terminalSnapshotExpansionVersion: 1, terminalSnapshotExpansionComplete: true,
    }]);
    await expect(unavailable.repository.bindNext()).resolves.toMatchObject({ state: 'conflict', conflictCode: 'detail_hash_mismatch' });
  });

  test('returns bounded summaries, segment-safe folders, and descending keyset pages', async () => {
    for (let index = 0; index < 3; index += 1) {
      await insertTerminalActivity(db, {
        activityId: `${String(index + 11).padStart(8, '0')}-1111-4111-8111-${String(index + 11).padStart(12, '0')}`,
        eventId: `${String(index + 21).padStart(8, '0')}-2222-4222-8222-${String(index + 21).padStart(12, '0')}`,
        edgeId: `${String(index + 31).padStart(8, '0')}-3333-4333-8333-${String(index + 31).padStart(12, '0')}`,
        toolCallId: `call-${index + 1}`, turnId: `turn-${index + 1}`,
        canonicalPath: index === 2 ? 'docs-child/c.txt' : `docs/${index}.txt`,
        announcedObservedAt: 100 + index, argumentsObservedAt: 100 + index,
        terminalObservedAt: 100 + index, now: 100 + index,
      });
    }
    const queries = createAgentActivityQueryRepository(db);
    const first = await queries.query({ workspaceId: 'workspace-1', subject: 'tool_calls', limit: 2 });
    expect(first.items).toHaveLength(2); expect(first.nextCursor).toMatch(/^[1-9][0-9]*$/u);
    const second = await queries.query({ workspaceId: 'workspace-1', subject: 'tool_calls', limit: 2, cursor: first.nextCursor });
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((item) => item.activityId)).size).toBe(3);
    const firstEdges = await queries.query({ workspaceId: 'workspace-1', subject: 'resource_edges', limit: 2 });
    const secondEdges = await queries.query({
      workspaceId: 'workspace-1', subject: 'resource_edges', limit: 2, cursor: firstEdges.nextCursor,
    });
    expect(new Set([...firstEdges.items, ...secondEdges.items].map((item) => item.edgeId)).size).toBe(3);
    const docs = await queries.query({ workspaceId: 'workspace-1', subject: 'resource_edges', folderPrefix: 'docs' });
    expect(docs.items.map((item) => item.resource.path)).toEqual(expect.arrayContaining(['docs/0.txt', 'docs/1.txt']));
    expect(docs.items.map((item) => item.resource.path)).not.toContain('docs-child/c.txt');
    expect(JSON.stringify(docs)).not.toContain('authority_root');
  });

  test.each([
    [{ workspaceId: '\ud800', subject: 'tool_calls' }],
    [{ workspaceId: 'workspace-1', subject: 'tool_calls', threadId: '\udfff' }],
    [{ workspaceId: 'workspace-1', subject: 'tool_calls', toolNames: ['\ud800'] }],
    [{ workspaceId: 'workspace-1', subject: 'resource_edges', path: `docs/${'x'.repeat(4096)}` }],
    [{ workspaceId: 'workspace-1', subject: 'resource_edges', fileName: 'docs/a.txt' }],
    [{ workspaceId: 'workspace-1', subject: 'resource_edges', fileName: 'docs\\a.txt' }],
    [{ workspaceId: 'workspace-1', subject: 'resource_edges', fileName: '.' }],
    [{ workspaceId: 'workspace-1', subject: 'resource_edges', fileName: '..' }],
    [{ workspaceId: 'workspace-1', subject: 'resource_edges', fileName: 'a\0.txt' }],
  ])('rejects non-scalar, over-bound, and non-basename query selectors', async (query) => {
    const queries = createAgentActivityQueryRepository(db);
    await expect(queries.query(query)).rejects.toBeInstanceOf(TypeError);
  });

  test.each([
    { workspaceId: 'workspace-1', subject: 'tool_calls', path: null },
    { workspaceId: 'workspace-1', subject: 'tool_calls', bogus: 'accepted' },
  ])('rejects null optional and unknown query fields before SQL', async (query) => {
    const queries = createAgentActivityQueryRepository(db);
    let sqlCount = 0;
    const count = () => { sqlCount += 1; };
    db.on('query', count);
    await expect(queries.query(query)).rejects.toBeInstanceOf(TypeError);
    db.removeListener('query', count);
    expect(sqlCount).toBe(0);
  });

  test('omits nextCursor when either query subject has no following page', async () => {
    const queries = createAgentActivityQueryRepository(db);
    const toolCalls = await queries.query({ workspaceId: 'empty-workspace', subject: 'tool_calls' });
    const resourceEdges = await queries.query({ workspaceId: 'empty-workspace', subject: 'resource_edges' });
    expect(toolCalls).toEqual({ items: [] });
    expect(resourceEdges).toEqual({ items: [] });
    expect(Object.hasOwn(toolCalls, 'nextCursor')).toBe(false);
    expect(Object.hasOwn(resourceEdges, 'nextCursor')).toBe(false);
  });

  test.each([[99, 99, 0], [100, 100, 0], [101, 100, 1]])(
    'binder batch cap handles %i committed jobs as %i dispositions plus %i remainder',
    async (count, dispositions, remainder) => {
      const repository = createAgentExchangeBindRepository(db, { now: () => 1_000 });
      for (let index = 0; index < count; index += 1) {
        const [exchangeId] = await db('exchanges').insert({
          thread_id: 'thread-1', seq: index + 1, ts: index + 1,
          user_input: 'prompt', assistant: '{"parts":[]}', metadata: '{}',
        });
        await db.transaction((trx) => repository.insertInTransaction(trx, {
          exchangeId, workspaceId: 'workspace-1', threadId: 'thread-1', turnId: `turn-${index}`, exchangeSavedAt: index + 1,
        }));
      }
      await expect(createAgentExchangeBinder(repository).drainBatch()).resolves.toHaveLength(dispositions);
      await expect(db('agent_exchange_bind_jobs').where({ state: 'pending' })).resolves.toHaveLength(remainder);
    },
  );

  test('bind-job insertion failure rolls exchange insertion back in the caller-owned transaction', async () => {
    const repository = createAgentExchangeBindRepository(db);
    await expect(db.transaction(async (trx) => {
      const [exchangeId] = await trx('exchanges').insert({ thread_id: 'thread-1', seq: 1, ts: 1, user_input: 'x', assistant: '{"parts":[]}', metadata: '{}' });
      await repository.insertInTransaction(trx, { exchangeId, workspaceId: '', threadId: 'thread-1', turnId: 'turn-1', exchangeSavedAt: 1 });
    })).rejects.toBeDefined();
    await expect(db('exchanges')).resolves.toHaveLength(0);
  });

  test('startup binding does not synthesize jobs for historical exchanges', async () => {
    await db('exchanges').insert({
      thread_id: 'thread-1', seq: 1, ts: 1, user_input: 'historical', assistant: '{"parts":[]}', metadata: '{}',
    });
    const binder = createAgentExchangeBinder(createAgentExchangeBindRepository(db));
    await expect(binder.start()).resolves.toMatchObject({ dispositions: 0, eligibleRemaining: false });
    await expect(db('agent_exchange_bind_jobs')).resolves.toHaveLength(0);
    await binder.shutdown();
  });

  test.each(['\ud800', '\udfff'])('bind-job writer rejects lone surrogate authority without mutation', async (surrogate) => {
    const repository = createAgentExchangeBindRepository(db);
    await expect(db.transaction(async (trx) => {
      const [exchangeId] = await trx('exchanges').insert({
        thread_id: 'thread-1', seq: 1, ts: 1, user_input: 'x', assistant: '{"parts":[]}', metadata: '{}',
      });
      await repository.insertInTransaction(trx, {
        exchangeId, workspaceId: surrogate, threadId: 'thread-1', turnId: 'turn-1', exchangeSavedAt: 1,
      });
    })).rejects.toThrow(/Unicode scalar/u);
    await expect(db('exchanges')).resolves.toHaveLength(0);
    await expect(db('agent_exchange_bind_jobs')).resolves.toHaveLength(0);
  });
});
