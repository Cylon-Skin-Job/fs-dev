'use strict';

const crypto = require('crypto');
const { assertTimestamp, assertUuid } = require('../file-mutations/provenance-values');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');

class AgentRendererProjectionClaimError extends Error {
  constructor(code = 'renderer_projection_claim_conflict') {
    super('Renderer projection claim no longer owns the durable job.');
    this.name = 'AgentRendererProjectionClaimError';
    this.code = code;
  }
}

function mapJob(row) {
  if (!row) return null;
  return Object.freeze({
    sourceEdgeId: row.source_edge_id,
    workspaceId: row.workspace_id,
    activityId: row.activity_id,
    observedAt: row.observed_at,
    relation: row.relation,
    state: row.state,
    deliveryFailureCount: row.delivery_failure_count,
    nextAttemptAt: row.next_attempt_at,
    claimToken: row.claim_token,
    leaseExpiresAt: row.lease_expires_at,
    settlement: row.settlement,
  });
}

function createAgentRendererProjectionJobRepository(db, { randomUuid = crypto.randomUUID } = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  const retryTransaction = (work) => runBoundedSqliteRetry(() => db.transaction(work), {
    attempts: 5,
    exhaustionCode: 'agent_renderer_projection_transition_failed',
    exhaustionMessage: 'agent renderer projection transition did not settle',
  });

  return Object.freeze({
    async claimDue(now, {
      leaseMs = 30_000,
      excludedSourceEdgeIds = [],
      onlySourceEdgeId = null,
    } = {}) {
      assertTimestamp(now, 'now');
      let selectedSourceEdgeId = onlySourceEdgeId;
      try {
        return await retryTransaction(async (trx) => {
        let query = trx('agent_renderer_projection_jobs as jobs')
          .join('agent_tool_resource_edges as edges', 'edges.edge_id', 'jobs.source_edge_id')
          .where('jobs.state', 'pending')
          .where('jobs.next_attempt_at', '<=', now)
          .orderBy('jobs.next_attempt_at', 'asc')
          .orderBy('jobs.observed_at', 'asc')
          .orderBy('edges.id', 'asc')
          .orderBy('jobs.source_edge_id', 'asc')
          .select('jobs.*');
        if (onlySourceEdgeId) query = query.where('jobs.source_edge_id', onlySourceEdgeId);
        if (excludedSourceEdgeIds.length) query = query.whereNotIn('jobs.source_edge_id', excludedSourceEdgeIds);
        const job = await query.first();
        if (!job) return null;
        selectedSourceEdgeId = job.source_edge_id;
        const edge = await trx('agent_tool_resource_edges').where({ edge_id: job.source_edge_id }).first();
        if (!edge || edge.workspace_id !== job.workspace_id || edge.activity_id !== job.activity_id
          || edge.observed_at !== job.observed_at || edge.observation_state !== job.relation) {
          throw new AgentRendererProjectionClaimError('renderer_projection_owner_drift');
        }
        const token = assertUuid(randomUuid(), 'generated claimToken');
        const changed = await trx('agent_renderer_projection_jobs').where({
          source_edge_id: job.source_edge_id,
          state: 'pending',
          next_attempt_at: job.next_attempt_at,
        }).update({
          state: 'running',
          next_attempt_at: null,
          claim_token: token,
          claimed_at: now,
          lease_expires_at: now + leaseMs,
          updated_at: now,
        });
        if (changed !== 1) return null;
        return mapJob({ ...job, state: 'running', next_attempt_at: null, claim_token: token, lease_expires_at: now + leaseMs });
        });
      } catch (error) {
        if (selectedSourceEdgeId) error.sourceEdgeId = selectedSourceEdgeId;
        throw error;
      }
    },

    async settle(claimToken, now, settlement) {
      const token = assertUuid(claimToken, 'claimToken');
      assertTimestamp(now, 'now');
      if (!['v2_sent', 'refresh_required_sent', 'no_recipient'].includes(settlement)) throw new TypeError('settlement is invalid');
      const changed = await runBoundedSqliteRetry(() => db('agent_renderer_projection_jobs')
        .where({ state: 'running', claim_token: token }).update({
          state: 'settled', claim_token: null, claimed_at: null, lease_expires_at: null,
          settled_at: now, settlement, updated_at: now,
        }), {
        attempts: 5,
        exhaustionCode: 'agent_renderer_projection_transition_failed',
        exhaustionMessage: 'agent renderer projection settlement did not settle',
      });
      if (changed !== 1) throw new AgentRendererProjectionClaimError();
    },

    async failDelivery(claimToken, now) {
      const token = assertUuid(claimToken, 'claimToken');
      assertTimestamp(now, 'now');
      return retryTransaction(async (trx) => {
        const job = await trx('agent_renderer_projection_jobs').where({ state: 'running', claim_token: token }).first();
        if (!job) throw new AgentRendererProjectionClaimError();
        const count = job.delivery_failure_count + 1;
        const failed = count === 3;
        await trx('agent_renderer_projection_jobs').where({ claim_token: token, state: 'running' }).update({
          state: failed ? 'failed' : 'pending',
          delivery_failure_count: count,
          next_attempt_at: failed ? null : now + (count === 1 ? 250 : 1_000),
          claim_token: null,
          claimed_at: null,
          lease_expires_at: null,
          settled_at: failed ? now : null,
          settlement: failed ? 'retry_exhausted' : null,
          updated_at: now,
        });
        return Object.freeze({ failed, deliveryFailureCount: count });
      });
    },

    async recoverExpired(now, {
      excludedClaimTokens = [],
      onlyClaimToken = null,
      limit = 100,
      shouldContinue = () => true,
    } = {}) {
      assertTimestamp(now, 'now');
      if (!Number.isInteger(limit) || limit < 0 || limit > 100) {
        throw new TypeError('renderer projection recovery limit must be 0..100');
      }
      if (typeof shouldContinue !== 'function') throw new TypeError('shouldContinue must be a function');
      if (limit === 0 || !shouldContinue()) return 0;
      let recoveryKey = null;
      try {
        return await retryTransaction(async (trx) => {
        let query = trx('agent_renderer_projection_jobs')
          .where({ state: 'running' }).where('lease_expires_at', '<=', now);
        if (onlyClaimToken) query = query.where('claim_token', onlyClaimToken);
        if (excludedClaimTokens.length) query = query.whereNotIn('claim_token', excludedClaimTokens);
        const rows = await query.orderBy('lease_expires_at', 'asc').limit(limit);
        let recovered = 0;
        for (const row of rows) {
          if (!shouldContinue()) break;
          recoveryKey = { claimToken: row.claim_token, sourceEdgeId: row.source_edge_id };
          try {
            await trx('agent_renderer_projection_jobs').where({
              source_edge_id: row.source_edge_id,
              state: 'running',
              claim_token: row.claim_token,
            }).update({
              state: 'pending',
              next_attempt_at: now + 100,
              claim_token: null,
              claimed_at: null,
              lease_expires_at: null,
              updated_at: now,
            });
            recovered += 1;
          } catch (error) {
            error.claimToken = row.claim_token;
            error.sourceEdgeId = row.source_edge_id;
            throw error;
          }
        }
        return recovered;
        });
      } catch (error) {
        if (recoveryKey) Object.assign(error, recoveryKey);
        throw error;
      }
    },

    async nextWakeAt({ excludedSourceEdgeIds = [], excludedClaimTokens = [] } = {}) {
      let pendingQuery = db('agent_renderer_projection_jobs').where({ state: 'pending' });
      if (excludedSourceEdgeIds.length) pendingQuery = pendingQuery.whereNotIn('source_edge_id', excludedSourceEdgeIds);
      let runningQuery = db('agent_renderer_projection_jobs').where({ state: 'running' });
      if (excludedClaimTokens.length) runningQuery = runningQuery.whereNotIn('claim_token', excludedClaimTokens);
      const [pending, running] = await Promise.all([
        pendingQuery.min({ value: 'next_attempt_at' }).first(),
        runningQuery.min({ value: 'lease_expires_at' }).first(),
      ]);
      const values = [pending?.value, running?.value].filter((value) => value != null);
      return values.length ? Math.min(...values) : null;
    },
  });
}

function createAgentRendererProjectionScheduler(repository) {
  if (!repository?.claimDue) throw new TypeError('renderer projection job repository is required');
  let draining = null;

  async function drainBatch(now, processClaim, { limit = 100, leaseMs = 30_000 } = {}) {
    assertTimestamp(now, 'now');
    if (typeof processClaim !== 'function') throw new TypeError('processClaim is required');
    if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new TypeError('projection batch limit must be 0..100');
    if (draining) return draining;
    draining = (async () => {
      const dispositions = [];
      while (dispositions.length < limit) {
        const claim = await repository.claimDue(now, { leaseMs });
        if (!claim) break;
        try {
          dispositions.push(Object.freeze({ claim, status: 'fulfilled', value: await processClaim(claim) }));
        } catch (reason) {
          dispositions.push(Object.freeze({ claim, status: 'rejected', reason }));
        }
      }
      return Object.freeze(dispositions);
    })();
    try {
      return await draining;
    } finally {
      draining = null;
    }
  }

  return Object.freeze({ drainBatch });
}

module.exports = {
  AgentRendererProjectionClaimError,
  createAgentRendererProjectionJobRepository,
  createAgentRendererProjectionScheduler,
};
