'use strict';

const crypto = require('crypto');
const { canonicalizeJson, canonicalizeJsonText } = require('../event-registry/canonical-json');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');
const { SOURCE_DEFINITIONS } = require('./fact-authority-repository');

const LEASE_MS = 30_000;
const RETRY_DELAYS = Object.freeze({ 1: 250, 2: 1_000 });
const ROLE_BY_ACCESS = Object.freeze({
  read: 'agent_read',
  write: 'agent_write',
  execute: 'agent_execute',
  unknown: 'agent_unknown',
});

class AgentLedgerConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentLedgerConflictError';
    this.code = 'agent_ledger_conflict';
  }
}

class AgentLedgerSourceMissingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentLedgerSourceMissingError';
    this.code = 'agent_ledger_source_missing';
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function kindForFact(fact) {
  if (fact?.eventType === 'agent.tool_completed' && fact.schemaVersion === 1) return 'tool';
  if (fact?.eventType === 'resource.state_observed' && fact.schemaVersion === 1) return 'observation';
  throw new TypeError('only admitted agent facts are supported');
}

function sourceBindingMatches(kind, row, fact) {
  const definition = SOURCE_DEFINITIONS[kind];
  if (!row || row.fact_admission_state !== 'admitted' || typeof row.fact_json !== 'string') return false;
  const canonical = canonicalizeJsonText(row.fact_json);
  return canonical === row.fact_json
    && sha256(canonical) === row.fact_sha256
    && canonical === canonicalizeJson(fact)
    && row[definition.idColumn] === fact.eventId
    && row[definition.operationColumn] === fact.operationId
    && row.workspace_id === fact.workspaceId
    && row[definition.occurredColumn] === fact.occurredAt;
}

function projectionFor(kind, fact, projectedAt) {
  const event = kind === 'tool' ? {
    event_id: fact.eventId,
    event_type: 'agent.tool_completed',
    workspace_id: fact.workspaceId,
    machine_id: null,
    machine_name: null,
    actor_type: 'agent_harness',
    actor_id: fact.origin.harnessId,
    occurred_at: fact.occurredAt,
    summary: `Agent tool ${fact.tool.status}: ${fact.tool.name}`,
    payload_json: canonicalizeJson(fact),
    source_module: 'agent-tool-activity-controller',
    correlation_id: fact.operationId,
    causation_id: null,
    created_at: projectedAt,
  } : {
    event_id: fact.eventId,
    event_type: 'resource.state_observed',
    workspace_id: fact.workspaceId,
    machine_id: null,
    machine_name: null,
    actor_type: 'agent_harness',
    actor_id: fact.source.harnessId,
    occurred_at: fact.occurredAt,
    summary: `Observed file state: ${fact.observation.state}`,
    payload_json: canonicalizeJson(fact),
    source_module: 'agent-resource-observer',
    correlation_id: fact.source.activityId,
    causation_id: null,
    created_at: projectedAt,
  };
  const edges = kind === 'tool'
    ? fact.resources.filter((resource) => resource.path).map((resource) => ({
      event_id: fact.eventId,
      resource_type: 'file',
      resource_id: null,
      workspace_id: fact.workspaceId,
      machine_id: null,
      path: resource.path,
      role: ROLE_BY_ACCESS[resource.accessFamily],
    }))
    : [{
      event_id: fact.eventId,
      resource_type: 'file',
      resource_id: fact.observation.state === 'bytes' ? fact.resource.resourceId : null,
      workspace_id: fact.workspaceId,
      machine_id: null,
      path: fact.resource.path,
      role: 'observed',
    }];
  return Object.freeze({ event: Object.freeze(event), edges: Object.freeze(edges.map(Object.freeze)) });
}

function eventMatches(row, expected) {
  if (!row) return false;
  return Object.keys(expected).every((key) => key === 'created_at'
    || (row[key] ?? null) === (expected[key] ?? null));
}

function edgeMatches(row, expected) {
  return Object.keys(expected).every((key) => (row[key] ?? null) === (expected[key] ?? null));
}

function createAgentLedgerRepository(db, {
  randomUuid = crypto.randomUUID,
  canAttempt = () => true,
} = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  if (typeof canAttempt !== 'function') throw new TypeError('agent ledger attempt guard is required');
  const retryTransition = (work) => runBoundedSqliteRetry((attempt) => {
    if (!canAttempt()) {
      const error = new Error('agent ledger owner is stopped');
      error.code = 'agent_ledger_shutdown';
      throw error;
    }
    return work(attempt);
  }, {
    attempts: 5,
    retryUnique: true,
    exhaustionCode: 'agent_ledger_transition_failed',
    exhaustionMessage: 'agent ledger transition did not settle',
  });

  async function sourceRow(kind, eventId, executor = db) {
    const definition = SOURCE_DEFINITIONS[kind];
    return executor(definition.table).where({ [definition.idColumn]: eventId }).first();
  }

  async function verifySource(fact, executor = db) {
    const kind = kindForFact(fact);
    const row = await sourceRow(kind, fact.eventId, executor);
    if (!sourceBindingMatches(kind, row, fact)) {
      throw new AgentLedgerSourceMissingError('agent ledger source is missing or mismatched');
    }
    return Object.freeze({ kind, row });
  }

  async function listCandidates({ now, includeRunning = false, limit = 101, excludedKeys = [] }) {
    return retryTransition(async () => {
      const excluded = new Set(excludedKeys);
      const rows = [];
      for (const [kind, definition] of Object.entries(SOURCE_DEFINITIONS)) {
        const excludedEventIds = [...excluded]
          .filter((key) => key.startsWith(`${kind}:`))
          .map((key) => key.slice(kind.length + 1));
        const excludedClaims = [...excluded]
          .filter((key) => key.startsWith('claim:'))
          .map((key) => key.slice('claim:'.length));
        const query = db(definition.table).where({ fact_admission_state: 'admitted' })
          .where((builder) => {
            builder.where((pending) => {
              pending.where('ledger_state', 'pending').where('ledger_next_attempt_at', '<=', now);
              if (excludedEventIds.length) pending.whereNotIn(definition.idColumn, excludedEventIds);
            });
            if (includeRunning) builder.orWhere((running) => {
              running.where('ledger_state', 'running').where('ledger_lease_expires_at', '<=', now);
              if (excludedClaims.length) running.whereNotIn('ledger_claim_token', excludedClaims);
            });
          })
          .orderByRaw('CASE WHEN ledger_state = ? THEN ledger_next_attempt_at ELSE ledger_lease_expires_at END ASC', ['pending'])
          .orderBy(definition.occurredColumn, 'asc')
          .orderBy(definition.internalIdColumn, 'asc')
          .orderBy(definition.idColumn, 'asc')
          .limit(limit);
        for (const row of await query) {
          const eventId = row[definition.idColumn];
          const key = row.ledger_state === 'running' ? `claim:${row.ledger_claim_token}` : `${kind}:${eventId}`;
          if (!excluded.has(key)) rows.push(Object.freeze({
            kind,
            key,
            eventId,
            state: row.ledger_state,
            nextAt: row.ledger_state === 'running' ? row.ledger_lease_expires_at : row.ledger_next_attempt_at,
            occurredAt: row[definition.occurredColumn],
            rank: definition.rank,
            internalId: row[definition.internalIdColumn],
            claimToken: row.ledger_claim_token,
            attempt: row.ledger_attempt_count,
          }));
        }
      }
      rows.sort((left, right) => left.nextAt - right.nextAt
        || left.occurredAt - right.occurredAt
        || left.rank - right.rank
        || left.internalId - right.internalId
        || left.eventId.localeCompare(right.eventId));
      return Object.freeze(rows.slice(0, limit));
    });
  }

  async function nextWake(excludedKeys = []) {
    return retryTransition(async () => {
      let minimum = null;
      for (const [kind, definition] of Object.entries(SOURCE_DEFINITIONS)) {
        const excludedEventIds = excludedKeys
          .filter((key) => key.startsWith(`${kind}:`))
          .map((key) => key.slice(kind.length + 1));
        const excludedClaims = excludedKeys
          .filter((key) => key.startsWith('claim:'))
          .map((key) => key.slice('claim:'.length));
        let pending = db(definition.table)
          .where({ fact_admission_state: 'admitted', ledger_state: 'pending' })
          .whereNotNull('ledger_next_attempt_at');
        if (excludedEventIds.length) {
          pending = pending.whereNotIn(definition.idColumn, excludedEventIds);
        }
        const pendingMinimum = await pending.min({ value: 'ledger_next_attempt_at' }).first();

        let running = db(definition.table)
          .where({ fact_admission_state: 'admitted', ledger_state: 'running' })
          .whereNotNull('ledger_lease_expires_at');
        if (excludedClaims.length) {
          running = running.whereNotIn('ledger_claim_token', excludedClaims);
        }
        const runningMinimum = await running.min({ value: 'ledger_lease_expires_at' }).first();
        for (const value of [pendingMinimum?.value, runningMinimum?.value]) {
          if (value != null && (minimum == null || value < minimum)) minimum = value;
        }
      }
      return minimum;
    });
  }

  async function claim(candidate, claimedAt) {
    const definition = SOURCE_DEFINITIONS[candidate.kind];
    const token = randomUuid();
    return retryTransition(async () => {
      const changed = await db(definition.table).where({
        [definition.idColumn]: candidate.eventId,
        fact_admission_state: 'admitted',
        ledger_state: 'pending',
      }).where('ledger_next_attempt_at', '<=', claimedAt).where('ledger_attempt_count', '<', 3).update({
        ledger_state: 'running',
        ledger_attempt_count: db.raw('ledger_attempt_count + 1'),
        ledger_next_attempt_at: null,
        ledger_claim_token: token,
        ledger_claimed_at: claimedAt,
        ledger_lease_expires_at: claimedAt + LEASE_MS,
        updated_at: db.raw('MAX(updated_at, ?)', [claimedAt]),
      });
      if (changed !== 1) return null;
      const row = await sourceRow(candidate.kind, candidate.eventId);
      return Object.freeze({
        kind: candidate.kind,
        eventId: candidate.eventId,
        claimToken: token,
        attempt: row.ledger_attempt_count,
        fact: JSON.parse(row.fact_json),
      });
    });
  }

  async function claimFact(fact, claimedAt) {
    const { kind, row } = await verifySource(fact);
    if (row.ledger_state === 'stored') {
      const expected = projectionFor(kind, fact, row.updated_at);
      const existing = await db('event_log').where({ event_id: fact.eventId }).first();
      const edges = await db('event_resource_edges').where({ event_id: fact.eventId }).orderBy('id', 'asc');
      if (!eventMatches(existing, expected.event)
        || edges.length !== expected.edges.length
        || edges.some((edge, index) => !edgeMatches(edge, expected.edges[index]))) {
        const definition = SOURCE_DEFINITIONS[kind];
        await retryTransition(() => db(definition.table).where({
          [definition.idColumn]: fact.eventId,
          ledger_state: 'stored',
        }).update({ ledger_state: 'conflict', updated_at: db.raw('MAX(updated_at, ?)', [claimedAt]) }));
        return Object.freeze({ status: 'conflict', kind, eventId: fact.eventId });
      }
      return Object.freeze({ status: 'duplicate', kind, eventId: fact.eventId });
    }
    if (row.ledger_state !== 'pending' || row.ledger_next_attempt_at > claimedAt) {
      return Object.freeze({ status: row.ledger_state, kind, eventId: fact.eventId });
    }
    return claim({ kind, eventId: fact.eventId }, claimedAt);
  }

  async function appendClaimed(claim, projectedAt) {
    const definition = SOURCE_DEFINITIONS[claim.kind];
    return db.transaction(async (trx) => {
      const source = await sourceRow(claim.kind, claim.eventId, trx);
      if (!sourceBindingMatches(claim.kind, source, claim.fact)
        || source.ledger_state !== 'running'
        || source.ledger_claim_token !== claim.claimToken
        || source.ledger_attempt_count !== claim.attempt) {
        throw new AgentLedgerSourceMissingError('claimed agent ledger source is missing or mismatched');
      }
      const projection = projectionFor(claim.kind, claim.fact, projectedAt);
      const existing = await trx('event_log').where({ event_id: claim.eventId }).first();
      let status = 'stored';
      if (existing) {
        const edges = await trx('event_resource_edges').where({ event_id: claim.eventId }).orderBy('id', 'asc');
        if (!eventMatches(existing, projection.event)
          || edges.length !== projection.edges.length
          || edges.some((edge, index) => !edgeMatches(edge, projection.edges[index]))) {
          await trx(definition.table).where({
            [definition.idColumn]: claim.eventId,
            ledger_state: 'running',
            ledger_claim_token: claim.claimToken,
          }).update({
            ledger_state: 'conflict',
            ledger_next_attempt_at: null,
            ledger_claim_token: null,
            ledger_claimed_at: null,
            ledger_lease_expires_at: null,
            updated_at: trx.raw('MAX(updated_at, ?)', [projectedAt]),
          });
          return Object.freeze({ status: 'conflict', eventId: claim.eventId });
        }
        status = 'duplicate';
      } else {
        await trx('event_log').insert(projection.event);
        if (projection.edges.length) await trx('event_resource_edges').insert(projection.edges);
      }
      const changed = await trx(definition.table).where({
        [definition.idColumn]: claim.eventId,
        ledger_state: 'running',
        ledger_claim_token: claim.claimToken,
      }).update({
        ledger_state: 'stored',
        ledger_next_attempt_at: null,
        ledger_claim_token: null,
        ledger_claimed_at: null,
        ledger_lease_expires_at: null,
        updated_at: trx.raw('MAX(updated_at, ?)', [projectedAt]),
      });
      if (changed !== 1) throw new AgentLedgerSourceMissingError('agent ledger claim was lost');
      return Object.freeze({ status, eventId: claim.eventId });
    });
  }

  async function settleFailure(claim, transitionNow, { terminal = false } = {}) {
    const definition = SOURCE_DEFINITIONS[claim.kind];
    const failed = terminal || claim.attempt >= 3;
    return retryTransition(async () => {
      const changed = await db(definition.table).where({
        [definition.idColumn]: claim.eventId,
        ledger_state: 'running',
        ledger_claim_token: claim.claimToken,
      }).update({
        ledger_state: failed ? 'failed' : 'pending',
        ledger_next_attempt_at: failed ? null : transitionNow + RETRY_DELAYS[claim.attempt],
        ledger_claim_token: null,
        ledger_claimed_at: null,
        ledger_lease_expires_at: null,
        updated_at: db.raw('MAX(updated_at, ?)', [transitionNow]),
      });
      return changed === 1;
    });
  }

  async function recover(candidate, transitionNow) {
    return settleFailure({
      kind: candidate.kind,
      eventId: candidate.eventId,
      claimToken: candidate.claimToken,
      attempt: candidate.attempt,
    }, transitionNow);
  }

  async function state(kind, eventId) {
    return sourceRow(kind, eventId);
  }

  return Object.freeze({
    appendClaimed,
    claim,
    claimFact,
    listCandidates,
    nextWake,
    projectionFor,
    recover,
    settleFailure,
    state,
    verifySource,
  });
}

module.exports = {
  AgentLedgerConflictError,
  AgentLedgerSourceMissingError,
  LEASE_MS,
  RETRY_DELAYS,
  ROLE_BY_ACCESS,
  createAgentLedgerRepository,
  kindForFact,
  projectionFor,
};
