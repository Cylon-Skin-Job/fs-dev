'use strict';

const { createDb, migrate } = require('../resources/test-db');
const {
  acceptedCandidateSha256,
  admitCandidatePath,
  rejectedCandidateSha256,
  retainCandidates,
} = require('../../lib/agent-provenance/candidate-fingerprints');
const { AgentActivityConflictError } = require('../../lib/agent-provenance/activity-repository');
const { insertTerminalActivity } = require('./helpers');
const { digest } = require('./helpers');
const { canonicalizeJson } = require('../../lib/event-registry/canonical-json');

describe('agent candidates and atomic activity reservation', () => {
  let db;
  beforeEach(async () => { db = await migrate(createDb()); });
  afterEach(async () => { await db.destroy(); });

  test('admits aliases lexically and keeps rejected outside values fingerprint-only', async () => {
    const accepted = admitCandidatePath('/tmp/workspace/docs/../a.txt', '/tmp/workspace');
    expect(accepted).toMatchObject({ accepted: true, canonicalPath: 'a.txt', fileName: 'a.txt', folderPath: '' });
    expect(accepted.candidateSha256).toBe(acceptedCandidateSha256('a.txt'));
    expect(admitCandidatePath('/tmp/workspace-other/secret', '/tmp/workspace')).toMatchObject({ accepted: false, reason: 'outside_workspace' });
    const enormous = `${'x'.repeat(4097)}outside-secret`;
    expect(rejectedCandidateSha256(enormous, 'invalid_path')).toBe(rejectedCandidateSha256(enormous, 'invalid_path'));
    const rejected = admitCandidatePath('../outside-secret', '/tmp/workspace');
    const { input } = await insertTerminalActivity(db, {
      candidates: [{
        edgeId: '99999999-9999-4999-8999-999999999999', candidateSha256: rejected.candidateSha256,
        candidateValue: '../outside-secret', reason: 'outside_workspace',
        accessFamily: 'read', accessKind: 'read', extractionBasis: 'structured_path',
      }],
    });
    const row = await db('agent_tool_resource_edges').where({ activity_id: input.activityId }).first();
    expect(row).toMatchObject({ canonical_path: null, file_name: null, folder_path: null, observation_state: 'skipped', observation_reason: 'outside_workspace', observation_attempt_count: 0 });
    expect(JSON.stringify(row)).not.toContain('outside-secret');
    await expect(db('agent_observation_jobs').where({ activity_id: input.activityId }).first()).resolves.toBeUndefined();
  });

  test('deduplicates aliases/access tuples and saturates only on the 65th unique candidate', () => {
    const candidates = Array.from({ length: 65 }, (_, index) => ({
      candidateSha256: acceptedCandidateSha256(`f-${index}`), accessFamily: 'read', accessKind: 'read', extractionBasis: 'structured_path',
    }));
    expect(retainCandidates([candidates[0], candidates[0]])).toMatchObject({ reportedCount: 1, retainedCount: 1, truncated: false });
    const capped = retainCandidates(candidates);
    expect(capped).toMatchObject({ reportedCount: 65, retainedCount: 64, truncated: true });
    expect(capped.candidates.map((item) => item.candidateOrdinal)).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  test('atomically inserts activity, edges, and observation job; exact replay preserves host clocks', async () => {
    const { repository, input, result } = await insertTerminalActivity(db);
    expect(result.replay).toBe(false);
    await expect(db('agent_tool_resource_edges').where({ activity_id: input.activityId })).resolves.toHaveLength(1);
    await expect(db('agent_observation_jobs').where({ activity_id: input.activityId }).first()).resolves.toMatchObject({ next_attempt_at: 100 });
    const replay = await repository.reserveTerminal({ ...input, announcedObservedAt: 500, argumentsObservedAt: 500, terminalObservedAt: 500, now: 500 });
    expect(replay.replay).toBe(true);
    await expect(db('agent_tool_activities').where({ activity_id: input.activityId }).first()).resolves.toMatchObject({ announced_observed_at: 100, terminal_observed_at: 100 });
    await db('agent_tool_resource_edges').where({ activity_id: input.activityId }).update({
      observation_state: 'skipped', observation_reason: 'final_symlink', observed_at: 501,
      next_observation_at: null, updated_at: 501,
    });
    await expect(repository.reserveTerminal(input)).resolves.toMatchObject({ replay: true });
    await expect(repository.reserveTerminal({ ...input, resultSha256: 'f'.repeat(64) })).rejects.toBeInstanceOf(AgentActivityConflictError);
    const differentFact = canonicalizeJson({ arguments: 'TOP-SECRET-RAW-ARG', oversized: 'x'.repeat(1_048_577) });
    await expect(repository.reserveTerminal({ ...input, factJson: differentFact, factSha256: digest(differentFact) }))
      .resolves.toMatchObject({ replay: true });
    const stored = await db('agent_tool_activities').where({ activity_id: input.activityId }).first();
    expect(stored.fact_json).toContain('agent.tool_completed');
    expect(stored.fact_json).not.toContain('TOP-SECRET-RAW-ARG');
    expect(stored.fact_json).not.toContain('oversized');
    const tampered = { ...JSON.parse(stored.fact_json), eventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', occurredAt: 999 };
    await db('agent_tool_activities').where({ activity_id: input.activityId }).update({
      fact_json: canonicalizeJson(tampered), fact_sha256: 'f'.repeat(64),
    });
    await expect(repository.reserveTerminal(input)).rejects.toBeInstanceOf(AgentActivityConflictError);
  });

  test('interrupted terminal replay preserves the first reconciliation clock', async () => {
    const { repository, input } = await insertTerminalActivity(db, { status: 'interrupted', reconciledAt: 150 });
    await expect(repository.reserveTerminal({ ...input, reconciledAt: 900, now: 900 })).resolves.toMatchObject({ replay: true });
    await expect(db('agent_tool_activities').where({ activity_id: input.activityId }).first())
      .resolves.toMatchObject({ reconciled_at: 150 });
  });

  test('terminal writer constructs the bounded fact and never persists caller fact content', async () => {
    const supplied = canonicalizeJson({ arguments: 'TOP-SECRET-INITIAL-ARG', oversized: 'x'.repeat(1_048_577) });
    const { input } = await insertTerminalActivity(db, { factJson: supplied, factSha256: digest(supplied) });
    const row = await db('agent_tool_activities').where({ activity_id: input.activityId }).first();
    expect(row.fact_json).toContain('agent.tool_completed');
    expect(row.fact_json).not.toContain('TOP-SECRET-INITIAL-ARG');
    expect(row.fact_json).not.toContain('oversized');
  });

  test('rejects non-scalar identities, mismatched accepted fingerprints, and false cap metadata', async () => {
    const common = (await insertTerminalActivity(db, { toolCallId: 'base' })).input;
    await expect(common && insertTerminalActivity(db, {
      activityId: 'abababab-abab-4bab-8bab-abababababab', eventId: 'acacacac-acac-4cac-8cac-acacacacacac',
      edgeId: 'adadadad-adad-4dad-8dad-adadadadadad', toolCallId: '\ud800',
    })).rejects.toThrow(/Unicode scalar/u);
    await expect(insertTerminalActivity(db, {
      activityId: 'babababa-baba-4aba-8aba-babababababa', eventId: 'bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc',
      toolCallId: 'mismatch', candidates: [{
        edgeId: 'bdbdbdbd-bdbd-4dbd-8dbd-bdbdbdbdbdbd', canonicalPath: 'docs/a.txt',
        candidateSha256: acceptedCandidateSha256('other.txt'), accessFamily: 'read', accessKind: 'read', extractionBasis: 'structured_path',
      }],
    })).rejects.toThrow(/does not match/u);
    await expect(insertTerminalActivity(db, {
      activityId: 'cacacaca-caca-4aca-8aca-cacacacacaca', eventId: 'cbcbcbcb-cbcb-4bcb-8bcb-cbcbcbcbcbcb',
      toolCallId: 'false-cap', candidates: [], reportedCount: 65, truncated: true,
    })).rejects.toThrow(/truncation/u);
  });

  test('rolls back the complete reservation when an edge violates a durable constraint', async () => {
    await expect(insertTerminalActivity(db, {
      candidates: [{
        edgeId: 'not-a-uuid', candidateSha256: 'a'.repeat(64), canonicalPath: 'a.txt',
        accessFamily: 'read', accessKind: 'read', extractionBasis: 'structured_path',
      }],
    })).rejects.toThrow();
    await expect(db('agent_tool_activities')).resolves.toHaveLength(0);
  });

  test('advances announced/arguments/terminal phases and verifies immutable restart root authority', async () => {
    const { createAgentActivityRepository } = require('../../lib/agent-provenance/activity-repository');
    const repository = createAgentActivityRepository(db);
    const identity = {
      activityId: '12121212-1212-4212-8212-121212121212', eventId: '13131313-1313-4313-8313-131313131313',
      workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-1', harnessId: 'opencode', provider: 'opencode',
      toolCallId: 'phase-call', toolName: 'write', nativeToolName: 'write',
      authorityRootSha256: digest('/tmp/workspace-1'), authorityRootDevice: '1', authorityRootInode: '2',
    };
    await repository.reserveAnnounced({ ...identity, announcedObservedAt: 10, now: 10 });
    await repository.reserveArguments({ ...identity, argumentsObservedAt: 11, argumentsSha256: 'a'.repeat(64), now: 11 });
    const factJson = canonicalizeJson({ phase: 'terminal' });
    const replacementActivityId = '14141414-1414-4414-8414-141414141414';
    const replacementEventId = '15151515-1515-4515-8515-151515151515';
    const result = await repository.reserveTerminal({
      ...identity, activityId: replacementActivityId, eventId: replacementEventId,
      status: 'completed', announcedObservedAt: 999, argumentsObservedAt: 999, terminalObservedAt: 1_000,
      argumentsSha256: 'a'.repeat(64), candidates: [], reportedCount: 0, truncated: false,
      factJson, factSha256: digest(factJson), now: 1_000,
    });
    expect(result).toMatchObject({ replay: false, transitioned: true });
    await expect(repository.reserveAnnounced({ ...identity, announcedObservedAt: 999, now: 999 })).resolves.toMatchObject({ replay: true });
    await expect(repository.reserveArguments({ ...identity, argumentsObservedAt: 999, argumentsSha256: 'a'.repeat(64), now: 999 })).resolves.toMatchObject({ replay: true });
    await expect(repository.verifyAuthority(identity.activityId, identity)).resolves.toBe(true);
    await expect(repository.verifyAuthority(identity.activityId, { ...identity, authorityRootInode: '3' })).resolves.toBe(false);
    const established = await db('agent_tool_activities').first();
    expect(established).toMatchObject({ announced_observed_at: 10, arguments_observed_at: 11, terminal_observed_at: 1_000 });
    const establishedFact = JSON.parse(established.fact_json);
    expect(establishedFact).toMatchObject({ operationId: identity.activityId, eventId: identity.eventId });
    expect(establishedFact).not.toMatchObject({ operationId: replacementActivityId, eventId: replacementEventId });
    expect(establishedFact.timing).toMatchObject({
      announcedObservedAt: 10, argumentsObservedAt: 11, terminalObservedAt: 1_000,
    });
  });
});
