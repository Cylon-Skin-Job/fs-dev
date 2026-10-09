'use strict';

const crypto = require('crypto');
const { canonicalizeJson } = require('../event-registry/canonical-json');
const { assertSha256, assertTimestamp, assertUuid } = require('../file-mutations/provenance-values');
const {
  STATUSES,
  normalizeActivityIdentity,
  normalizeCandidate,
  normalizeRootAuthority,
  normalizeTimes,
} = require('./values');

class AgentActivityConflictError extends Error {
  constructor(code = 'activity_replay_conflict') {
    super('Agent activity replay conflicts with established durable truth.');
    this.name = 'AgentActivityConflictError';
    this.code = code;
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));
}

function toolFact(identity, status, times, argumentsSha256, resultSha256, candidates, truncated) {
  return {
    eventId: identity.eventId,
    eventType: 'agent.tool_completed',
    schemaVersion: 1,
    occurredAt: times.terminalObservedAt,
    workspaceId: identity.workspaceId,
    operationId: identity.activityId,
    origin: {
      kind: 'agent_harness', harnessId: identity.harnessId, provider: identity.provider, assurance: 'adapter_observed',
    },
    thread: { threadId: identity.threadId, turnId: identity.turnId },
    tool: compact({
      toolCallId: identity.toolCallId,
      name: identity.toolName,
      nativeName: identity.nativeToolName,
      status,
      argumentsSha256,
      resultSha256,
    }),
    timing: compact(times),
    resources: candidates.map((candidate) => compact({
      edgeId: candidate.edgeId,
      path: candidate.canonicalPath,
      candidateSha256: candidate.candidateSha256,
      accessFamily: candidate.accessFamily,
      accessKind: candidate.accessKind,
      extractionBasis: candidate.extractionBasis,
      rejectionReason: candidate.reason,
    })),
    candidatesTruncated: truncated,
  };
}

function rowIdentityMatches(row, identity) {
  return row.workspace_id === identity.workspaceId
    && row.thread_id === identity.threadId
    && row.turn_id === identity.turnId
    && row.harness_id === identity.harnessId
    && row.provider === identity.provider
    && row.tool_call_id === identity.toolCallId
    && row.tool_name === identity.toolName
    && row.native_tool_name === identity.nativeToolName
    && row.authority_root_sha256 === identity.authorityRootSha256
    && sameNullable(row.authority_root_device, identity.authorityRootDevice)
    && sameNullable(row.authority_root_inode, identity.authorityRootInode);
}

function terminalFieldsMatch(row, normalized) {
  const times = normalized.times;
  return row.status === normalized.status
    && sameNullable(row.arguments_sha256, normalized.argumentsSha256)
    && sameNullable(row.result_sha256, normalized.resultSha256)
    && row.candidate_reported_count === normalized.reportedCount
    && row.candidate_retained_count === normalized.candidates.length
    && row.candidates_truncated === Number(normalized.truncated)
    && sameNullable(row.announced_reported_at, times.announcedReportedAt)
    && sameNullable(row.execution_started_reported_at, times.executionStartedReportedAt)
    && sameNullable(row.arguments_reported_at, times.argumentsReportedAt)
    && sameNullable(row.terminal_reported_at, times.terminalReportedAt)
    && sameNullable(row.terminal_snapshot_reported_at, times.terminalSnapshotReportedAt)
    && (times.argumentsObservedAt == null) === (row.arguments_observed_at == null);
}

function edgeMatches(row, candidate) {
  return row.candidate_ordinal === candidate.candidateOrdinal
    && row.candidate_sha256 === candidate.candidateSha256
    && sameNullable(row.canonical_path, candidate.canonicalPath)
    && sameNullable(row.file_name, candidate.fileName)
    && sameNullable(row.folder_path, candidate.folderPath)
    && row.access_family === candidate.accessFamily
    && row.access_kind === candidate.accessKind
    && row.extraction_basis === candidate.extractionBasis
    && (candidate.reason == null || row.observation_reason === candidate.reason);
}

function establishedTimes(row) {
  return {
    announcedObservedAt: row.announced_observed_at,
    announcedReportedAt: row.announced_reported_at,
    executionStartedReportedAt: row.execution_started_reported_at,
    argumentsObservedAt: row.arguments_observed_at,
    argumentsReportedAt: row.arguments_reported_at,
    terminalObservedAt: row.terminal_observed_at,
    terminalReportedAt: row.terminal_reported_at,
    terminalSnapshotReportedAt: row.terminal_snapshot_reported_at,
    reconciledAt: row.reconciled_at,
  };
}

function mapActivity(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    activityId: row.activity_id,
    eventId: row.event_id,
    workspaceId: row.workspace_id,
    threadId: row.thread_id,
    turnId: row.turn_id,
    exchangeId: row.exchange_id,
    harnessId: row.harness_id,
    provider: row.provider,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    nativeToolName: row.native_tool_name,
    status: row.status,
    factAdmissionState: row.fact_admission_state,
    ledgerState: row.ledger_state,
    announcedObservedAt: row.announced_observed_at,
    terminalObservedAt: row.terminal_observed_at,
  });
}

function createAgentActivityRepository(db, { onDiagnostic = () => {} } = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');

  function normalizeTerminal(input) {
    const identity = normalizeActivityIdentity(input);
    if (!STATUSES.includes(input.status) || input.status === 'announced') throw new TypeError('terminal status is invalid');
    const status = input.status;
    const times = normalizeTimes(input, status);
    const argumentsSha256 = input.argumentsSha256 == null ? null : assertSha256(input.argumentsSha256, 'argumentsSha256');
    const resultSha256 = input.resultSha256 == null ? null : assertSha256(input.resultSha256, 'resultSha256');
    if (!Array.isArray(input.candidates) || input.candidates.length > 64) throw new TypeError('at most 64 retained candidates are allowed');
    const candidates = input.candidates.map((candidate, index) => normalizeCandidate(candidate, index));
    const reportedCount = input.reportedCount ?? candidates.length;
    if (!Number.isInteger(reportedCount) || reportedCount < candidates.length || reportedCount > 65) throw new TypeError('reportedCount is invalid');
    const truncated = input.truncated === true;
    if (truncated ? (reportedCount !== 65 || candidates.length !== 64) : reportedCount !== candidates.length) {
      throw new TypeError('candidate truncation shape is invalid');
    }
    const now = assertTimestamp(input.now ?? times.terminalObservedAt, 'now');
    return Object.freeze({
      identity, status, times, argumentsSha256, resultSha256, candidates,
      reportedCount, truncated, now,
    });
  }

  function attachFact(normalized, times = normalized.times) {
    const factJson = canonicalizeJson(toolFact(
      normalized.identity,
      normalized.status,
      times,
      normalized.argumentsSha256,
      normalized.resultSha256,
      normalized.candidates,
      normalized.truncated,
    ));
    return Object.freeze({ ...normalized, times: Object.freeze(times), factJson, factSha256: sha256(factJson) });
  }

  async function conflict() {
    onDiagnostic('agent_tool_activity_conflict');
    throw new AgentActivityConflictError();
  }

  async function insertEdgesAndJob(trx, normalized, activityId, workspaceId) {
    const terminalAt = normalized.times.terminalObservedAt;
    const edgeRows = normalized.candidates.map((candidate) => {
      const rejected = candidate.reason != null;
      return {
        edge_id: candidate.edgeId, workspace_id: workspaceId, activity_id: activityId,
        candidate_ordinal: candidate.candidateOrdinal, candidate_sha256: candidate.candidateSha256,
        resource_id: candidate.resourceId, canonical_path: candidate.canonicalPath,
        file_name: candidate.fileName, folder_path: candidate.folderPath,
        access_family: candidate.accessFamily, access_kind: candidate.accessKind,
        extraction_basis: candidate.extractionBasis,
        observation_state: rejected ? 'skipped' : 'pending', observation_reason: candidate.reason,
        observed_at: rejected ? terminalAt : null, next_observation_at: rejected ? null : terminalAt,
        created_at: normalized.now, updated_at: normalized.now,
      };
    });
    if (edgeRows.length) await trx('agent_tool_resource_edges').insert(edgeRows);
    if (edgeRows.some((edge) => edge.observation_state === 'pending')) {
      await trx('agent_observation_jobs').insert({
        activity_id: activityId, workspace_id: workspaceId, state: 'pending', next_attempt_at: terminalAt,
        created_at: normalized.now, updated_at: normalized.now,
      });
    }
  }

  function rawInsert(connection, table, row) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    return connection.prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    ).run(...columns.map((column) => row[column]));
  }

  function rawActivity(connection, identity) {
    return connection.prepare(`
      SELECT * FROM agent_tool_activities
      WHERE workspace_id = ? AND thread_id = ? AND turn_id = ? AND harness_id = ? AND tool_call_id = ?
    `).get(identity.workspaceId, identity.threadId, identity.turnId, identity.harnessId, identity.toolCallId);
  }

  function insertEdgesAndJobSync(connection, normalized, activityId, workspaceId) {
    const terminalAt = normalized.times.terminalObservedAt;
    let hasPending = false;
    for (const candidate of normalized.candidates) {
      const rejected = candidate.reason != null;
      hasPending ||= !rejected;
      rawInsert(connection, 'agent_tool_resource_edges', {
        edge_id: candidate.edgeId, workspace_id: workspaceId, activity_id: activityId,
        candidate_ordinal: candidate.candidateOrdinal, candidate_sha256: candidate.candidateSha256,
        resource_id: candidate.resourceId, canonical_path: candidate.canonicalPath,
        file_name: candidate.fileName, folder_path: candidate.folderPath,
        access_family: candidate.accessFamily, access_kind: candidate.accessKind,
        extraction_basis: candidate.extractionBasis,
        observation_state: rejected ? 'skipped' : 'pending', observation_attempt_count: 0,
        next_observation_at: rejected ? null : terminalAt,
        observation_reason: candidate.reason, observed_at: rejected ? terminalAt : null,
        snapshot_id: null, previous_snapshot_id: null,
        created_at: normalized.now, updated_at: normalized.now,
      });
    }
    if (hasPending) {
      rawInsert(connection, 'agent_observation_jobs', {
        activity_id: activityId, workspace_id: workspaceId, state: 'pending',
        claim_token: null, claimed_edge_id: null, claimed_attempt: null,
        claimed_at: null, lease_expires_at: null, next_attempt_at: terminalAt,
        created_at: normalized.now, updated_at: normalized.now,
      });
    }
  }

  function reserveTerminalSync(connection, input) {
    if (!connection || typeof connection.transaction !== 'function') {
      throw new TypeError('A better-sqlite3 connection is required');
    }
    const normalized = normalizeTerminal(input);
    const syncConflict = () => {
      onDiagnostic('agent_tool_activity_conflict');
      throw new AgentActivityConflictError();
    };
    const transaction = connection.transaction(() => {
      const identity = normalized.identity;
      const existing = rawActivity(connection, identity);
      if (existing) {
        const edges = connection.prepare(`
          SELECT * FROM agent_tool_resource_edges WHERE activity_id = ? ORDER BY candidate_ordinal ASC
        `).all(existing.activity_id);
        if (existing.status === 'announced') {
          if (!rowIdentityMatches(existing, identity)
            || !sameNullable(existing.announced_reported_at, normalized.times.announcedReportedAt)
            || (existing.arguments_observed_at != null && (
              normalized.times.argumentsObservedAt == null
              || !sameNullable(existing.arguments_sha256, normalized.argumentsSha256)
              || !sameNullable(existing.arguments_reported_at, normalized.times.argumentsReportedAt)
            ))) {
            onDiagnostic('agent_tool_activity_conflict');
            throw new AgentActivityConflictError();
          }
          const effective = attachFact({
            ...normalized,
            identity: Object.freeze({ ...identity, activityId: existing.activity_id, eventId: existing.event_id }),
          }, {
            ...normalized.times,
            announcedObservedAt: existing.announced_observed_at,
            announcedReportedAt: existing.announced_reported_at,
            argumentsObservedAt: existing.arguments_observed_at ?? normalized.times.argumentsObservedAt,
            argumentsReportedAt: existing.arguments_reported_at ?? normalized.times.argumentsReportedAt,
          });
          const update = connection.prepare(`
            UPDATE agent_tool_activities SET
              status = ?, arguments_sha256 = ?, result_sha256 = ?, candidate_reported_count = ?,
              candidate_retained_count = ?, candidates_truncated = ?, execution_started_reported_at = ?,
              arguments_observed_at = ?, arguments_reported_at = ?, terminal_observed_at = ?,
              terminal_reported_at = ?, terminal_snapshot_reported_at = ?, reconciled_at = ?,
              fact_admission_state = 'pending', fact_json = ?, fact_sha256 = ?, updated_at = ?
            WHERE id = ? AND status = 'announced'
          `).run(
            effective.status, effective.argumentsSha256, effective.resultSha256, effective.reportedCount,
            effective.candidates.length, Number(effective.truncated), effective.times.executionStartedReportedAt,
            effective.times.argumentsObservedAt, effective.times.argumentsReportedAt, effective.times.terminalObservedAt,
            effective.times.terminalReportedAt, effective.times.terminalSnapshotReportedAt, effective.times.reconciledAt,
            effective.factJson, effective.factSha256, effective.now, existing.id,
          );
          if (update.changes !== 1 || edges.length !== 0) syncConflict();
          insertEdgesAndJobSync(connection, effective, existing.activity_id, existing.workspace_id);
          return Object.freeze({ activity: mapActivity(rawActivity(connection, identity)), replay: false, transitioned: true });
        }
        if (!rowIdentityMatches(existing, identity)
          || !terminalFieldsMatch(existing, normalized)
          || edges.length !== normalized.candidates.length
          || edges.some((edge, index) => !edgeMatches(edge, normalized.candidates[index]))) {
          onDiagnostic('agent_tool_activity_conflict');
          throw new AgentActivityConflictError();
        }
        const established = attachFact({
          ...normalized,
          identity: Object.freeze({ ...identity, activityId: existing.activity_id, eventId: existing.event_id }),
          candidates: Object.freeze(normalized.candidates.map((candidate, index) => Object.freeze({
            ...candidate, edgeId: edges[index].edge_id,
          }))),
        }, establishedTimes(existing));
        if (existing.fact_json !== established.factJson || existing.fact_sha256 !== established.factSha256) {
          onDiagnostic('agent_tool_activity_conflict');
          throw new AgentActivityConflictError();
        }
        return Object.freeze({ activity: mapActivity(existing), replay: true });
      }

      const direct = attachFact(normalized);
      const row = {
        activity_id: identity.activityId, event_id: identity.eventId,
        workspace_id: identity.workspaceId, thread_id: identity.threadId, turn_id: identity.turnId,
        authority_root_sha256: identity.authorityRootSha256,
        authority_root_device: identity.authorityRootDevice, authority_root_inode: identity.authorityRootInode,
        exchange_id: null, exchange_saved_at: null, exchange_bound_at: null,
        harness_id: identity.harnessId, provider: identity.provider, tool_call_id: identity.toolCallId,
        tool_name: identity.toolName, native_tool_name: identity.nativeToolName, status: direct.status,
        arguments_sha256: direct.argumentsSha256, result_sha256: direct.resultSha256,
        candidate_reported_count: direct.reportedCount, candidate_retained_count: direct.candidates.length,
        candidates_truncated: Number(direct.truncated), announced_observed_at: direct.times.announcedObservedAt,
        announced_reported_at: direct.times.announcedReportedAt,
        execution_started_reported_at: direct.times.executionStartedReportedAt,
        arguments_observed_at: direct.times.argumentsObservedAt, arguments_reported_at: direct.times.argumentsReportedAt,
        terminal_observed_at: direct.times.terminalObservedAt, terminal_reported_at: direct.times.terminalReportedAt,
        terminal_snapshot_reported_at: direct.times.terminalSnapshotReportedAt, reconciled_at: direct.times.reconciledAt,
        fact_admission_state: 'pending', ledger_state: 'not_ready', ledger_attempt_count: 0,
        ledger_next_attempt_at: null, ledger_claim_token: null, ledger_claimed_at: null,
        ledger_lease_expires_at: null, fact_json: direct.factJson, fact_sha256: direct.factSha256,
        created_at: direct.now, updated_at: direct.now,
      };
      const result = rawInsert(connection, 'agent_tool_activities', row);
      insertEdgesAndJobSync(connection, direct, identity.activityId, identity.workspaceId);
      return Object.freeze({ activity: mapActivity({ ...row, id: Number(result.lastInsertRowid) }), replay: false });
    });
    return transaction.immediate();
  }

  return Object.freeze({
    reserveTerminalSync,
    async reserveAnnounced(input) {
      const identity = normalizeActivityIdentity(input);
      const times = normalizeTimes(input, 'announced');
      const now = assertTimestamp(input.now ?? times.announcedObservedAt, 'now');
      return db.transaction(async (trx) => {
        const existing = await trx('agent_tool_activities').where({
          workspace_id: identity.workspaceId,
          thread_id: identity.threadId,
          turn_id: identity.turnId,
          harness_id: identity.harnessId,
          tool_call_id: identity.toolCallId,
        }).first();
        if (existing) {
          if (!rowIdentityMatches(existing, identity)
            || !sameNullable(existing.announced_reported_at, times.announcedReportedAt)) return conflict();
          return Object.freeze({ activity: mapActivity(existing), replay: true });
        }
        const row = {
          activity_id: identity.activityId,
          event_id: identity.eventId,
          workspace_id: identity.workspaceId,
          thread_id: identity.threadId,
          turn_id: identity.turnId,
          authority_root_sha256: identity.authorityRootSha256,
          authority_root_device: identity.authorityRootDevice,
          authority_root_inode: identity.authorityRootInode,
          harness_id: identity.harnessId,
          provider: identity.provider,
          tool_call_id: identity.toolCallId,
          tool_name: identity.toolName,
          native_tool_name: identity.nativeToolName,
          status: 'announced',
          announced_observed_at: times.announcedObservedAt,
          announced_reported_at: times.announcedReportedAt,
          created_at: now,
          updated_at: now,
        };
        const [id] = await trx('agent_tool_activities').insert(row);
        return Object.freeze({ activity: mapActivity({ ...row, id }), replay: false });
      });
    },

    async reserveTerminal(input) {
      const normalized = normalizeTerminal(input);
      return db.transaction(async (trx) => {
        const identity = normalized.identity;
        const existing = await trx('agent_tool_activities').where({
          workspace_id: identity.workspaceId,
          thread_id: identity.threadId,
          turn_id: identity.turnId,
          harness_id: identity.harnessId,
          tool_call_id: identity.toolCallId,
        }).first();
        if (existing) {
          if (existing.status === 'announced') {
            if (!rowIdentityMatches(existing, identity)
              || !sameNullable(existing.announced_reported_at, normalized.times.announcedReportedAt)
              || (existing.arguments_observed_at != null && (
                normalized.times.argumentsObservedAt == null
                || !sameNullable(existing.arguments_sha256, normalized.argumentsSha256)
                || !sameNullable(existing.arguments_reported_at, normalized.times.argumentsReportedAt)
              ))) return conflict();
            const effective = attachFact({
              ...normalized,
              identity: Object.freeze({
                ...normalized.identity,
                activityId: existing.activity_id,
                eventId: existing.event_id,
              }),
            }, {
              ...normalized.times,
              announcedObservedAt: existing.announced_observed_at,
              announcedReportedAt: existing.announced_reported_at,
              argumentsObservedAt: existing.arguments_observed_at ?? normalized.times.argumentsObservedAt,
              argumentsReportedAt: existing.arguments_reported_at ?? normalized.times.argumentsReportedAt,
            });
            const changed = await trx('agent_tool_activities').where({ id: existing.id, status: 'announced' }).update({
              status: effective.status,
              arguments_sha256: effective.argumentsSha256,
              result_sha256: effective.resultSha256,
              candidate_reported_count: effective.reportedCount,
              candidate_retained_count: effective.candidates.length,
              candidates_truncated: Number(effective.truncated),
              execution_started_reported_at: effective.times.executionStartedReportedAt,
              arguments_observed_at: effective.times.argumentsObservedAt,
              arguments_reported_at: effective.times.argumentsReportedAt,
              terminal_observed_at: effective.times.terminalObservedAt,
              terminal_reported_at: effective.times.terminalReportedAt,
              terminal_snapshot_reported_at: effective.times.terminalSnapshotReportedAt,
              reconciled_at: effective.times.reconciledAt,
              fact_admission_state: 'pending',
              fact_json: effective.factJson,
              fact_sha256: effective.factSha256,
              updated_at: effective.now,
            });
            if (changed !== 1) return conflict();
            await insertEdgesAndJob(trx, effective, existing.activity_id, existing.workspace_id);
            const transitioned = await trx('agent_tool_activities').where({ id: existing.id }).first();
            return Object.freeze({ activity: mapActivity(transitioned), replay: false, transitioned: true });
          }
          const edges = await trx('agent_tool_resource_edges')
            .where({ activity_id: existing.activity_id }).orderBy('candidate_ordinal', 'asc');
          if (!rowIdentityMatches(existing, identity)
            || !terminalFieldsMatch(existing, normalized)
            || edges.length !== normalized.candidates.length
            || edges.some((edge, index) => !edgeMatches(edge, normalized.candidates[index]))) return conflict();
          const established = attachFact({
            ...normalized,
            identity: Object.freeze({
              ...normalized.identity,
              activityId: existing.activity_id,
              eventId: existing.event_id,
            }),
            candidates: Object.freeze(normalized.candidates.map((candidate, index) => Object.freeze({
              ...candidate,
              edgeId: edges[index].edge_id,
            }))),
          }, establishedTimes(existing));
          if (existing.fact_json !== established.factJson || existing.fact_sha256 !== established.factSha256) return conflict();
          return Object.freeze({ activity: mapActivity(existing), replay: true });
        }

        const direct = attachFact(normalized);
        const terminalAt = direct.times.terminalObservedAt;
        const activityRow = {
          activity_id: identity.activityId,
          event_id: identity.eventId,
          workspace_id: identity.workspaceId,
          thread_id: identity.threadId,
          turn_id: identity.turnId,
          authority_root_sha256: identity.authorityRootSha256,
          authority_root_device: identity.authorityRootDevice,
          authority_root_inode: identity.authorityRootInode,
          harness_id: identity.harnessId,
          provider: identity.provider,
          tool_call_id: identity.toolCallId,
          tool_name: identity.toolName,
          native_tool_name: identity.nativeToolName,
          status: direct.status,
          arguments_sha256: direct.argumentsSha256,
          result_sha256: direct.resultSha256,
          candidate_reported_count: direct.reportedCount,
          candidate_retained_count: direct.candidates.length,
          candidates_truncated: Number(direct.truncated),
          announced_observed_at: direct.times.announcedObservedAt,
          announced_reported_at: direct.times.announcedReportedAt,
          execution_started_reported_at: direct.times.executionStartedReportedAt,
          arguments_observed_at: direct.times.argumentsObservedAt,
          arguments_reported_at: direct.times.argumentsReportedAt,
          terminal_observed_at: terminalAt,
          terminal_reported_at: direct.times.terminalReportedAt,
          terminal_snapshot_reported_at: direct.times.terminalSnapshotReportedAt,
          reconciled_at: direct.times.reconciledAt,
          fact_admission_state: 'pending',
          fact_json: direct.factJson,
          fact_sha256: direct.factSha256,
          created_at: direct.now,
          updated_at: direct.now,
        };
        const [id] = await trx('agent_tool_activities').insert(activityRow);
        await insertEdgesAndJob(trx, direct, identity.activityId, identity.workspaceId);
        return Object.freeze({ activity: mapActivity({ ...activityRow, id }), replay: false });
      });
    },

    async reserveArguments(input) {
      const identity = normalizeActivityIdentity(input);
      const observedAt = assertTimestamp(input.argumentsObservedAt, 'argumentsObservedAt');
      const reportedAt = input.argumentsReportedAt == null ? null : assertTimestamp(input.argumentsReportedAt, 'argumentsReportedAt');
      const fingerprint = input.argumentsSha256 == null ? null : assertSha256(input.argumentsSha256, 'argumentsSha256');
      return db.transaction(async (trx) => {
        const row = await trx('agent_tool_activities').where({
          workspace_id: identity.workspaceId, thread_id: identity.threadId, turn_id: identity.turnId,
          harness_id: identity.harnessId, tool_call_id: identity.toolCallId,
        }).first();
        if (!row || !rowIdentityMatches(row, identity)) return conflict();
        if (row.arguments_observed_at != null) {
          if (!sameNullable(row.arguments_sha256, fingerprint) || !sameNullable(row.arguments_reported_at, reportedAt)) return conflict();
          return Object.freeze({ activity: mapActivity(row), replay: true });
        }
        if (row.status !== 'announced') return conflict();
        if (observedAt < row.announced_observed_at) throw new TypeError('arguments observed before announcement');
        await trx('agent_tool_activities').where({ id: row.id, status: 'announced' }).update({
          arguments_sha256: fingerprint,
          arguments_observed_at: observedAt,
          arguments_reported_at: reportedAt,
          updated_at: assertTimestamp(input.now ?? observedAt, 'now'),
        });
        return Object.freeze({ activity: mapActivity(await trx('agent_tool_activities').where({ id: row.id }).first()), replay: false });
      });
    },

    async verifyAuthority(activityId, authority) {
      assertUuid(activityId, 'activityId');
      const normalized = normalizeRootAuthority(authority);
      const row = await db('agent_tool_activities').where({ activity_id: activityId }).first();
      return Boolean(row
        && row.authority_root_sha256 === normalized.authorityRootSha256
        && sameNullable(row.authority_root_device, normalized.authorityRootDevice)
        && sameNullable(row.authority_root_inode, normalized.authorityRootInode));
    },

    async getByActivityId(activityId) {
      assertUuid(activityId, 'activityId');
      return mapActivity(await db('agent_tool_activities').where({ activity_id: activityId }).first());
    },
  });
}

module.exports = { AgentActivityConflictError, createAgentActivityRepository };
