'use strict';

const crypto = require('crypto');
const { canonicalizeJson } = require('../../lib/event-registry/canonical-json');
const { createAgentActivityRepository } = require('../../lib/agent-provenance/activity-repository');
const { acceptedCandidateSha256 } = require('../../lib/agent-provenance/candidate-fingerprints');

const IDS = Object.freeze({
  activity: '11111111-1111-4111-8111-111111111111',
  event: '22222222-2222-4222-8222-222222222222',
  edge: '33333333-3333-4333-8333-333333333333',
});

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function insertTerminalActivity(db, overrides = {}) {
  const repository = createAgentActivityRepository(db);
  const factJson = overrides.factJson ?? canonicalizeJson({ kind: 'fixture' });
  const path = overrides.canonicalPath ?? 'docs/a.txt';
  const edgeId = overrides.edgeId ?? IDS.edge;
  const candidate = {
    edgeId,
    candidateSha256: acceptedCandidateSha256(path),
    canonicalPath: path,
    accessFamily: overrides.accessFamily ?? 'write',
    accessKind: overrides.accessKind ?? 'write',
    extractionBasis: overrides.extractionBasis ?? 'structured_path',
  };
  const input = {
    activityId: overrides.activityId ?? IDS.activity,
    eventId: overrides.eventId ?? IDS.event,
    workspaceId: overrides.workspaceId ?? 'workspace-1',
    threadId: overrides.threadId ?? 'thread-1',
    turnId: overrides.turnId ?? 'turn-1',
    harnessId: overrides.harnessId ?? 'opencode',
    provider: overrides.provider ?? 'opencode',
    toolCallId: overrides.toolCallId ?? 'call-1',
    toolName: 'write',
    nativeToolName: 'write',
    authorityRootSha256: overrides.authorityRootSha256 ?? digest('/tmp/workspace-1'),
    authorityRootDevice: overrides.authorityRootDevice ?? '1',
    authorityRootInode: overrides.authorityRootInode ?? '2',
    status: overrides.status ?? 'completed',
    announcedObservedAt: overrides.announcedObservedAt ?? 100,
    argumentsObservedAt: overrides.argumentsObservedAt ?? 100,
    terminalObservedAt: overrides.terminalObservedAt ?? 100,
    reconciledAt: overrides.reconciledAt ?? null,
    argumentsSha256: overrides.argumentsSha256 ?? null,
    resultSha256: overrides.resultSha256 ?? null,
    candidates: overrides.candidates ?? [candidate],
    reportedCount: overrides.reportedCount ?? 1,
    truncated: overrides.truncated ?? false,
    factJson,
    factSha256: overrides.factSha256 ?? digest(factJson),
    now: overrides.now ?? 100,
  };
  const result = await repository.reserveTerminal(input);
  return { repository, input, result, candidate };
}

async function admitActivity(db, activityId = IDS.activity) {
  await db('agent_tool_activities').where({ activity_id: activityId }).update({
    fact_admission_state: 'admitted',
    ledger_state: 'pending',
    ledger_next_attempt_at: 100,
  });
}

module.exports = { IDS, admitActivity, digest, insertTerminalActivity };
