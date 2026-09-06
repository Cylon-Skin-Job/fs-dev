'use strict';

const crypto = require('crypto');
const {
  canonicalizeJson,
  canonicalizeJsonText,
  sha256CanonicalJson,
} = require('../event-registry/canonical-json');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');

const SOURCE_DEFINITIONS = Object.freeze({
  tool: Object.freeze({
    table: 'agent_tool_activities',
    idColumn: 'event_id',
    internalIdColumn: 'id',
    occurredColumn: 'terminal_observed_at',
    operationColumn: 'activity_id',
    producerId: 'system.agent-tool-activity-controller',
    schemaKey: 'agent.tool_completed',
    rank: 0,
  }),
  observation: Object.freeze({
    table: 'agent_resource_snapshots',
    idColumn: 'event_id',
    internalIdColumn: 'id',
    occurredColumn: 'snapshot_observed_at',
    operationColumn: 'observation_id',
    producerId: 'system.agent-resource-observer',
    schemaKey: 'resource.state_observed',
    rank: 1,
  }),
});

class AgentFactConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentFactConflictError';
    this.code = 'agent_fact_admission_conflict';
  }
}

function digest(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function bodyFromFact(fact) {
  const {
    eventId: _eventId,
    eventType: _eventType,
    schemaVersion: _schemaVersion,
    occurredAt: _occurredAt,
    workspaceId: _workspaceId,
    operationId: _operationId,
    ...body
  } = fact;
  return JSON.parse(canonicalizeJson(body));
}

function durableInput(definition, identity, body) {
  return {
    producerId: definition.producerId,
    schemaKey: definition.schemaKey,
    schemaVersion: 1,
    eventId: identity.eventId,
    occurredAt: identity.occurredAt,
    workspaceId: identity.workspaceId,
    operationId: identity.operationId,
    body,
  };
}

function createAgentFactAuthorityRepository(db, { canAttempt = () => true } = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  if (typeof canAttempt !== 'function') throw new TypeError('agent fact attempt guard is required');
  const reservations = new WeakMap();
  const retry = (work) => runBoundedSqliteRetry((attempt) => {
    if (!canAttempt()) {
      const error = new Error('agent fact admission owner is stopped');
      error.code = 'agent_fact_admission_shutdown';
      throw error;
    }
    return work(attempt);
  }, {
    attempts: 5,
    retryUnique: true,
    exhaustionCode: 'agent_fact_admission_transition_failed',
    exhaustionMessage: 'agent fact admission transition did not settle',
  });

  function definitionForKind(kind) {
    const definition = SOURCE_DEFINITIONS[kind];
    if (!definition) throw new TypeError('unknown agent fact source kind');
    return definition;
  }

  function assertSourceRow(kind, row) {
    const definition = definitionForKind(kind);
    if (!row || typeof row.fact_json !== 'string' || typeof row.fact_sha256 !== 'string') {
      throw new AgentFactConflictError('agent fact source missing');
    }
    try {
      const canonical = canonicalizeJsonText(row.fact_json);
      if (canonical !== row.fact_json || digest(canonical) !== row.fact_sha256) {
        throw new AgentFactConflictError('agent fact body hash mismatch');
      }
      const fact = JSON.parse(canonical);
      if (fact.eventId !== row[definition.idColumn]
        || fact.eventType !== definition.schemaKey
        || fact.schemaVersion !== 1
        || fact.occurredAt !== row[definition.occurredColumn]
        || fact.workspaceId !== row.workspace_id
        || fact.operationId !== row[definition.operationColumn]) {
        throw new AgentFactConflictError('agent fact owner binding mismatch');
      }
      return Object.freeze({ fact, body: bodyFromFact(fact) });
    } catch (error) {
      if (error instanceof AgentFactConflictError) throw error;
      throw new AgentFactConflictError('agent fact canonical source mismatch');
    }
  }

  async function load(kind, eventId, executor = db) {
    const definition = definitionForKind(kind);
    const row = await executor(definition.table).where({ [definition.idColumn]: eventId }).first();
    const source = assertSourceRow(kind, row);
    return { definition, row, ...source };
  }

  async function createPublishInput(kind, eventId) {
    return retry(async () => {
      const source = await load(kind, eventId);
      if (!['pending', 'admitted'].includes(source.row.fact_admission_state)) {
        throw new AgentFactConflictError('agent fact source is not publishable');
      }
      const identity = Object.freeze({
        producerId: source.definition.producerId,
        schemaKey: source.definition.schemaKey,
        schemaVersion: 1,
        workspaceId: source.fact.workspaceId,
        operationId: source.fact.operationId,
        eventId: source.fact.eventId,
        occurredAt: source.fact.occurredAt,
      });
      const reservation = Object.freeze(Object.create(null));
      reservations.set(reservation, Object.freeze({ kind, identity, factSha256: source.row.fact_sha256 }));
      return Object.freeze({ reservation, body: source.body });
    });
  }

  async function verifyReservation({ reservation, producerId, schemaKey, schemaVersion }) {
    const binding = reservations.get(reservation);
    if (!binding) throw new AgentFactConflictError('unknown agent fact reservation');
    const definition = definitionForKind(binding.kind);
    if (producerId !== definition.producerId || schemaKey !== definition.schemaKey || schemaVersion !== 1) {
      throw new AgentFactConflictError('agent fact reservation authority mismatch');
    }
    return retry(async () => {
      const source = await load(binding.kind, binding.identity.eventId);
      if (!['pending', 'admitted'].includes(source.row.fact_admission_state)
        || source.row.fact_sha256 !== binding.factSha256) {
        throw new AgentFactConflictError('agent fact reservation source mismatch');
      }
      const canonicalHash = sha256CanonicalJson(durableInput(definition, binding.identity, source.body));
      return Object.freeze({ ...binding.identity, canonicalHash });
    });
  }

  async function commitVerifiedAdmission({ reservation, fact, now = Date.now() }) {
    const binding = reservations.get(reservation);
    if (!binding) throw new AgentFactConflictError('unknown agent fact reservation');
    const definition = definitionForKind(binding.kind);
    return retry(() => db.transaction(async (trx) => {
      const source = await load(binding.kind, binding.identity.eventId, trx);
      if (source.row.fact_sha256 !== binding.factSha256
        || canonicalizeJson(source.fact) !== canonicalizeJson(fact)) {
        throw new AgentFactConflictError('agent fact admission source mismatch');
      }
      if (source.row.fact_admission_state === 'admitted') {
        return Object.freeze({ admitted: true, replay: true, kind: binding.kind, eventId: source.fact.eventId });
      }
      if (source.row.fact_admission_state !== 'pending' || source.row.ledger_state !== 'not_ready') {
        throw new AgentFactConflictError('agent fact admission state mismatch');
      }
      const changed = await trx(definition.table).where({
        [definition.idColumn]: binding.identity.eventId,
        fact_admission_state: 'pending',
        ledger_state: 'not_ready',
      }).update({
        fact_admission_state: 'admitted',
        ledger_state: 'pending',
        ledger_attempt_count: 0,
        ledger_next_attempt_at: now,
        ledger_claim_token: null,
        ledger_claimed_at: null,
        ledger_lease_expires_at: null,
        updated_at: trx.raw('MAX(updated_at, ?)', [now]),
      });
      if (changed !== 1) throw new Error('agent fact admission compare-and-set failed');
      return Object.freeze({ admitted: true, replay: false, kind: binding.kind, eventId: source.fact.eventId });
    }));
  }

  async function markConflict(kind, eventId, now = Date.now()) {
    const definition = definitionForKind(kind);
    return retry(async () => {
      const changed = await db(definition.table).where({
        [definition.idColumn]: eventId,
        fact_admission_state: 'pending',
        ledger_state: 'not_ready',
      }).update({
        fact_admission_state: 'conflict',
        updated_at: db.raw('MAX(updated_at, ?)', [now]),
      });
      return changed === 1;
    });
  }

  async function listPending({ limit = 101, excludedKeys = [] } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 201) throw new TypeError('pending source limit is invalid');
    return retry(async () => {
      const excluded = new Set(excludedKeys);
      const rows = [];
      for (const [kind, definition] of Object.entries(SOURCE_DEFINITIONS)) {
        const excludedEventIds = [...excluded]
          .filter((key) => key.startsWith(`${kind}:`))
          .map((key) => key.slice(kind.length + 1));
        let query = db(definition.table).where({ fact_admission_state: 'pending' });
        if (excludedEventIds.length) query = query.whereNotIn(definition.idColumn, excludedEventIds);
        const selected = await query
          .orderBy(definition.occurredColumn, 'asc')
          .orderBy(definition.internalIdColumn, 'asc')
          .orderBy(definition.idColumn, 'asc')
          .limit(limit);
        for (const row of selected) {
          const eventId = row[definition.idColumn];
          const key = `${kind}:${eventId}`;
          if (!excluded.has(key)) rows.push(Object.freeze({
            kind,
            key,
            eventId,
            occurredAt: row[definition.occurredColumn],
            rank: definition.rank,
            internalId: row[definition.internalIdColumn],
          }));
        }
      }
      rows.sort((left, right) => left.occurredAt - right.occurredAt
        || left.rank - right.rank
        || left.internalId - right.internalId
        || left.eventId.localeCompare(right.eventId));
      return Object.freeze(rows.slice(0, limit));
    });
  }

  async function state(kind, eventId) {
    const definition = definitionForKind(kind);
    return db(definition.table).where({ [definition.idColumn]: eventId }).select(
      'fact_admission_state', 'ledger_state', 'ledger_attempt_count', 'ledger_next_attempt_at',
    ).first();
  }

  return Object.freeze({
    commitVerifiedAdmission,
    createPublishInput,
    listPending,
    markConflict,
    state,
    verifyReservation,
  });
}

module.exports = {
  AgentFactConflictError,
  SOURCE_DEFINITIONS,
  createAgentFactAuthorityRepository,
};
