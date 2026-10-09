'use strict';

const crypto = require('crypto');
const { createDb, migrate } = require('../resources/test-db');
const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { createAgentFactAuthorityRepository } = require('../../lib/agent-provenance/fact-authority-repository');
const { createAgentFactAdmissionReconciler } = require('../../lib/agent-provenance/fact-admission-reconciler');
const { createAgentLedgerRepository } = require('../../lib/agent-provenance/agent-ledger-repository');
const { createAgentLedgerReconciler } = require('../../lib/agent-provenance/agent-ledger-reconciler');
const { createAgentObservationJobRepository } = require('../../lib/agent-provenance/observation-job-repository');
const { createAgentCheckpointRepository } = require('../../lib/agent-provenance/checkpoint-repository');
const { createAgentResourceIdentityService } = require('../../lib/agent-provenance/resource-identity');
const { createStableResourceRepository } = require('../../lib/file-mutations/stable-resource-repository');
const { acceptedCandidateSha256 } = require('../../lib/agent-provenance/candidate-fingerprints');
const { insertTerminalActivity } = require('./helpers');

const UUIDS = Array.from({ length: 30 }, (_, index) => {
  const hex = (index + 100).toString(16).padStart(8, '0');
  return `${hex}-aaaa-4aaa-8aaa-${(index + 100).toString(16).padStart(12, '0')}`;
});

describe('sealed two-fact admission authority and ATP-D17 agent ledger', () => {
  let db;
  let authority;
  let ledger;
  let admission;
  let publishers;
  let diagnosticCodes;
  let handlerSawState;
  let uuidIndex;

  beforeEach(async () => {
    jest.resetModules();
    db = await migrate(createDb());
    uuidIndex = 0;
    diagnosticCodes = [];
    handlerSawState = [];
    authority = createAgentFactAuthorityRepository(db);
    const repository = createAgentLedgerRepository(db, { randomUuid: () => UUIDS[uuidIndex++] });
    ledger = createAgentLedgerReconciler({
      repository,
      writeDiagnostic: (code) => diagnosticCodes.push(code),
    });
    admission = createAgentFactAdmissionReconciler({
      authority,
      writeDiagnostic: (code) => diagnosticCodes.push(code),
    });
    const registry = await createInitializedEventRegistry(db, {
      installedHandlers: ['system.agent-provenance-ledger'],
    });
    const { bootstrapGovernedEventBus } = require('../../lib/subscriptions/host-bootstrap');
    bootstrapGovernedEventBus({
      registryAccess: registry.access,
      verifyReservation: async () => { throw new Error('not a file fact'); },
      verifyAgentReservation: authority.verifyReservation,
      commitVerifiedAgentAdmission: authority.commitVerifiedAdmission,
      deliverAdmittedFact: async (fact) => {
        const kind = fact.eventType === 'agent.tool_completed' ? 'tool' : 'observation';
        handlerSawState.push((await authority.state(kind, fact.eventId)).fact_admission_state);
        const result = await ledger.appendAgentFact(fact);
        return [{
          subscriptionId: 'd64557f0-49fb-4cb1-bc62-d2e70c1d16b1',
          handlerKey: 'system.agent-provenance-ledger',
          status: result.status === 'conflict' ? 'failed' : 'completed',
        }];
      },
      writeDiagnostic: ({ code }) => diagnosticCodes.push(code),
      installFileSavePublishers: () => {},
      installAgentPublishers: (value) => {
        publishers = value;
        admission.installPublishers(value);
      },
      onAgentAdmissionCommitted: () => ledger.signal(),
    });
  });

  afterEach(async () => {
    await admission.shutdown();
    await ledger.shutdown();
    await db.destroy();
  });

  test('commits before delivery, gates observation claims, and projects tool and fixture checkpoint facts exactly', async () => {
    const tool = await insertTerminalActivity(db, {
      activityId: UUIDS[20], eventId: UUIDS[21], edgeId: UUIDS[22],
      canonicalPath: 'docs/a.txt', terminalObservedAt: 100, announcedObservedAt: 90,
      argumentsObservedAt: 95, now: 100,
    });
    const observations = createAgentObservationJobRepository(db, { randomUuid: () => UUIDS[uuidIndex++] });
    await expect(observations.claimDue(Date.now())).resolves.toBeNull();

    const toolInput = await authority.createPublishInput('tool', tool.input.eventId);
    await expect(publishers.publishAgentToolCompleted(toolInput)).resolves.toMatchObject({
      admitted: true, eventId: tool.input.eventId,
    });
    expect(handlerSawState).toEqual(['admitted']);
    await expect(db('agent_tool_activities').where({ event_id: tool.input.eventId }).first())
      .resolves.toMatchObject({ fact_admission_state: 'admitted', ledger_state: 'stored', ledger_attempt_count: 1 });
    const toolEvent = await db('event_log').where({ event_id: tool.input.eventId }).first();
    expect(toolEvent).toMatchObject({
      event_type: 'agent.tool_completed', actor_type: 'agent_harness', actor_id: 'opencode',
      occurred_at: 100, summary: 'Agent tool completed: write',
      source_module: 'agent-tool-activity-controller', correlation_id: tool.input.activityId,
      causation_id: null,
    });
    await expect(db('event_resource_edges').where({ event_id: tool.input.eventId }))
      .resolves.toEqual([expect.objectContaining({ path: 'docs/a.txt', role: 'agent_write', resource_id: null })]);

    const claim = await observations.claimDue(Date.now());
    await observations.reserveAttempt(claim.claimToken, Date.now());
    const stable = createStableResourceRepository(db, { randomUuid: () => UUIDS[uuidIndex++] });
    const checkpoints = createAgentCheckpointRepository(db, {
      resourceIdentity: createAgentResourceIdentityService(db, stable),
      randomUuid: () => UUIDS[uuidIndex++],
    });
    const checkpoint = await checkpoints.applySuccessfulObservation({
      activityId: tool.input.activityId,
      claimToken: claim.claimToken,
      sourceEdgeId: tool.input.candidates[0].edgeId,
      canonicalPath: 'docs/a.txt',
      state: 'bytes',
      bytes: Buffer.from('hello', 'utf8'),
      fingerprint: { dev: '1', ino: '2', size: 5, birthtimeMs: 1 },
      observedAt: 200,
      snapshotId: UUIDS[10], observationId: UUIDS[11], eventId: UUIDS[12], resourceId: UUIDS[13],
    });
    const observationInput = await authority.createPublishInput('observation', checkpoint.eventId);
    await expect(publishers.publishResourceStateObserved(observationInput)).resolves.toMatchObject({
      admitted: true, eventId: checkpoint.eventId,
    });
    expect(handlerSawState).toEqual(['admitted', 'admitted']);
    await expect(db('agent_resource_snapshots').where({ event_id: checkpoint.eventId }).first())
      .resolves.toMatchObject({ fact_admission_state: 'admitted', ledger_state: 'stored', ledger_attempt_count: 1 });
    await expect(db('event_log').where({ event_id: checkpoint.eventId }).first()).resolves.toMatchObject({
      event_type: 'resource.state_observed', actor_id: 'opencode', occurred_at: 200,
      summary: 'Observed file state: bytes', source_module: 'agent-resource-observer',
      correlation_id: tool.input.activityId, causation_id: null,
    });
    await expect(db('event_resource_edges').where({ event_id: checkpoint.eventId }))
      .resolves.toEqual([expect.objectContaining({
        path: 'docs/a.txt', role: 'observed', resource_id: UUIDS[13],
      })]);
    await expect(db('event_tags').whereIn('event_id', [tool.input.eventId, checkpoint.eventId]))
      .resolves.toEqual([]);

    const createdAt = toolEvent.created_at;
    const replay = await authority.createPublishInput('tool', tool.input.eventId);
    await expect(publishers.publishAgentToolCompleted(replay)).resolves.toMatchObject({ admitted: true });
    await expect(db('event_log').where({ event_id: tool.input.eventId }).first())
      .resolves.toMatchObject({ created_at: createdAt });
  });

  test('rejects mutated bodies before delivery and reconciles deterministic pending facts', async () => {
    const first = await insertTerminalActivity(db, {
      activityId: UUIDS[20], eventId: UUIDS[21], edgeId: UUIDS[22],
      toolCallId: 'first', terminalObservedAt: 100, announcedObservedAt: 100, argumentsObservedAt: 100, now: 100,
    });
    const input = await authority.createPublishInput('tool', first.input.eventId);
    await expect(publishers.publishResourceStateObserved(input)).resolves.toEqual({
      admitted: false, eventId: null, deliveries: [],
    });
    await expect(publishers.publishAgentToolCompleted({
      reservation: Object.freeze(Object.create(null)), body: input.body,
    })).resolves.toEqual({ admitted: false, eventId: null, deliveries: [] });
    input.body.tool.name = 'tampered';
    await expect(publishers.publishAgentToolCompleted(input)).resolves.toEqual({
      admitted: false, eventId: null, deliveries: [],
    });
    expect(handlerSawState).toEqual([]);
    await expect(authority.state('tool', first.input.eventId)).resolves.toMatchObject({
      fact_admission_state: 'pending', ledger_state: 'not_ready',
    });
    await admission.start();
    await expect(authority.state('tool', first.input.eventId)).resolves.toMatchObject({
      fact_admission_state: 'admitted', ledger_state: 'stored',
    });
  });

  test('moves canonical-invalid tool and observation source text to semantic conflict', async () => {
    const terminal = await insertTerminalActivity(db, {
      activityId: UUIDS[20], eventId: UUIDS[21], edgeId: UUIDS[22],
      terminalObservedAt: 100, announcedObservedAt: 90, argumentsObservedAt: 95, now: 100,
    });
    const terminalRow = await db('agent_tool_activities')
      .where({ event_id: terminal.input.eventId }).first();
    const storedToolFact = JSON.parse(terminalRow.fact_json);
    const malformedTool = JSON.stringify({
      ...storedToolFact,
      tool: { ...storedToolFact.tool, name: '\ud800' },
    });
    await db('agent_tool_activities').where({ event_id: terminal.input.eventId }).update({
      fact_json: malformedTool,
      fact_sha256: crypto.createHash('sha256').update(malformedTool, 'utf8').digest('hex'),
    });

    const snapshotEventId = UUIDS[12];
    const malformedObservation = JSON.stringify({ eventId: '\ud800' });
    await db('agent_resource_snapshots').insert({
      snapshot_id: UUIDS[10], observation_id: UUIDS[11], event_id: snapshotEventId,
      workspace_id: terminal.input.workspaceId, resource_id: null,
      canonical_path: 'docs/a.txt', file_name: 'a.txt', folder_path: 'docs',
      state: 'absent', blob_sha256: null, byte_length: 0, relation: 'first_observation',
      previous_snapshot_id: null, source_activity_id: terminal.input.activityId,
      source_edge_id: terminal.candidate.edgeId, access_family: 'write', access_kind: 'write',
      extraction_basis: 'structured_path', snapshot_observed_at: 101,
      fact_json: malformedObservation,
      fact_sha256: crypto.createHash('sha256').update(malformedObservation, 'utf8').digest('hex'),
      created_at: 101, updated_at: 101,
    });

    await admission._drain();

    await expect(authority.state('tool', terminal.input.eventId)).resolves.toMatchObject({
      fact_admission_state: 'conflict', ledger_state: 'not_ready',
    });
    await expect(authority.state('observation', snapshotEventId)).resolves.toMatchObject({
      fact_admission_state: 'conflict', ledger_state: 'not_ready',
    });
    expect(diagnosticCodes).toEqual([
      'agent_fact_admission_conflict', 'agent_fact_admission_conflict',
    ]);
    expect([...admission._suppressed]).toEqual([]);
  });

  test('selects eligible facts before limit so delayed rows cannot block later work', async () => {
    const first = await insertTerminalActivity(db, {
      activityId: UUIDS[20], eventId: UUIDS[21], edgeId: UUIDS[22], toolCallId: 'first',
      terminalObservedAt: 100, announcedObservedAt: 100, argumentsObservedAt: 100, now: 100,
    });
    const second = await insertTerminalActivity(db, {
      activityId: UUIDS[23], eventId: UUIDS[24], edgeId: UUIDS[25], toolCallId: 'second',
      canonicalPath: 'docs/second.txt', terminalObservedAt: 101,
      announcedObservedAt: 101, argumentsObservedAt: 101, now: 101,
    });
    await expect(authority.listPending({ limit: 1, excludedKeys: [`tool:${first.input.eventId}`] }))
      .resolves.toEqual([expect.objectContaining({ key: `tool:${second.input.eventId}` })]);

    await db('agent_tool_activities').whereIn('event_id', [first.input.eventId, second.input.eventId]).update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 100,
    });
    const repository = createAgentLedgerRepository(db);
    await expect(repository.listCandidates({
      now: 101, includeRunning: true, limit: 1, excludedKeys: [`tool:${first.input.eventId}`],
    })).resolves.toEqual([expect.objectContaining({ key: `tool:${second.input.eventId}` })]);
  });

  test('computes the next ledger wake with bounded SQL minima and exact exclusions', async () => {
    const first = await insertTerminalActivity(db, {
      activityId: UUIDS[20], eventId: UUIDS[21], edgeId: UUIDS[22], toolCallId: 'wake-first',
      terminalObservedAt: 100, announcedObservedAt: 90, argumentsObservedAt: 95, now: 100,
    });
    const second = await insertTerminalActivity(db, {
      activityId: UUIDS[23], eventId: UUIDS[24], edgeId: UUIDS[25], toolCallId: 'wake-second',
      terminalObservedAt: 200, announcedObservedAt: 190, argumentsObservedAt: 195, now: 200,
    });
    const running = await insertTerminalActivity(db, {
      activityId: UUIDS[26], eventId: UUIDS[27], edgeId: UUIDS[28], toolCallId: 'wake-running',
      terminalObservedAt: 300, announcedObservedAt: 290, argumentsObservedAt: 295, now: 300,
    });
    await db('agent_tool_activities').where({ event_id: first.input.eventId }).update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 100,
    });
    await db('agent_tool_activities').where({ event_id: second.input.eventId }).update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 200,
    });
    const claimToken = UUIDS[29];
    await db('agent_tool_activities').where({ event_id: running.input.eventId }).update({
      fact_admission_state: 'admitted', ledger_state: 'running', ledger_attempt_count: 1,
      ledger_next_attempt_at: null, ledger_claim_token: claimToken,
      ledger_claimed_at: 25, ledger_lease_expires_at: 50,
    });
    const repository = createAgentLedgerRepository(db);
    await expect(repository.nextWake([])).resolves.toBe(50);
    await expect(repository.nextWake([`claim:${claimToken}`])).resolves.toBe(100);
    const queries = [];
    const recordQuery = (query) => queries.push(query.sql);
    db.on('query', recordQuery);
    await expect(repository.nextWake([
      `claim:${claimToken}`, `tool:${first.input.eventId}`,
    ])).resolves.toBe(200);
    db.removeListener('query', recordQuery);
    expect(queries).toHaveLength(4);
    expect(queries.every((query) => /min\s*\(/iu.test(query))).toBe(true);
  });

  test('projects canonical blocked-before-execution paths while omitting only pathless candidates', async () => {
    const canonicalPath = 'Settings/protected.json';
    const blocked = await insertTerminalActivity(db, {
      activityId: UUIDS[20], eventId: UUIDS[21], edgeId: UUIDS[22], status: 'blocked',
      candidates: [{
        edgeId: UUIDS[22], candidateSha256: acceptedCandidateSha256(canonicalPath),
        canonicalPath, accessFamily: 'write', accessKind: 'write',
        extractionBasis: 'structured_path', reason: 'blocked_before_execution',
      }],
      terminalObservedAt: 100, announcedObservedAt: 90, argumentsObservedAt: 95, now: 100,
    });
    const input = await authority.createPublishInput('tool', blocked.input.eventId);
    await expect(publishers.publishAgentToolCompleted(input)).resolves.toMatchObject({ admitted: true });

    await expect(db('agent_tool_resource_edges').where({ activity_id: blocked.input.activityId }))
      .resolves.toEqual([expect.objectContaining({
        canonical_path: canonicalPath,
        observation_state: 'skipped',
        observation_reason: 'blocked_before_execution',
      })]);
    await expect(db('agent_observation_jobs').where({ activity_id: blocked.input.activityId }))
      .resolves.toEqual([]);
    await expect(db('event_resource_edges').where({ event_id: blocked.input.eventId }))
      .resolves.toEqual([expect.objectContaining({ path: canonicalPath, role: 'agent_write' })]);
  });
});
