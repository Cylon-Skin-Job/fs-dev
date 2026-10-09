'use strict';

const crypto = require('crypto');
const { assertTimestamp, assertUuid } = require('../file-mutations/provenance-values');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');
const { FAILURE_REASONS, SKIP_REASONS, assertEnum } = require('./values');

class AgentObservationClaimError extends Error {
  constructor(code = 'observation_claim_conflict') {
    super('Observation claim no longer owns the durable job.');
    this.name = 'AgentObservationClaimError';
    this.code = code;
  }
}

const ACCESS_RANK = Object.freeze({ write: 0, read: 1, execute: 2, unknown: 3 });

function createAgentObservationJobRepository(db, { randomUuid = crypto.randomUUID } = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  const retryTransaction = (work) => runBoundedSqliteRetry(() => db.transaction(work), {
    attempts: 5,
    exhaustionCode: 'agent_observation_transition_failed',
    exhaustionMessage: 'agent observation transition did not settle',
  });

  async function jobAfterGroupTransition(trx, activityId, token, now) {
    const next = await trx('agent_tool_resource_edges')
      .where({ activity_id: activityId, observation_state: 'pending' })
      .min({ value: 'next_observation_at' }).first();
    const changed = await trx('agent_observation_jobs').where({
      activity_id: activityId,
      state: 'running',
      claim_token: token,
    }).update({
      state: next?.value == null ? 'complete' : 'pending',
      claim_token: null,
      claimed_edge_id: null,
      claimed_attempt: null,
      claimed_at: null,
      lease_expires_at: null,
      next_attempt_at: next?.value ?? null,
      updated_at: now,
    });
    if (changed !== 1) throw new AgentObservationClaimError();
  }

  async function claimedGroup(trx, token) {
    const job = await trx('agent_observation_jobs').where({ state: 'running', claim_token: token }).first();
    if (!job) throw new AgentObservationClaimError();
    const edge = await trx('agent_tool_resource_edges').where({ edge_id: job.claimed_edge_id }).first();
    if (!edge || edge.activity_id !== job.activity_id || edge.workspace_id !== job.workspace_id) {
      throw new AgentObservationClaimError('observation_claim_edge_conflict');
    }
    const siblings = await trx('agent_tool_resource_edges').where({
      activity_id: job.activity_id,
      canonical_path: edge.canonical_path,
      observation_state: 'pending',
    }).orderBy('candidate_ordinal', 'asc');
    if (!siblings.length) throw new AgentObservationClaimError('observation_claim_group_empty');
    return { job, edge, siblings };
  }

  function assertAttemptConsistency(job, siblings) {
    const attempts = new Set(siblings.map((edge) => edge.observation_attempt_count));
    if (attempts.size !== 1) throw new AgentObservationClaimError('observation_attempt_drift');
    const siblingAttempt = siblings[0].observation_attempt_count;
    if ((job.claimed_attempt === 0 && siblingAttempt > 2)
      || (job.claimed_attempt > 0 && siblingAttempt !== job.claimed_attempt)) {
      throw new AgentObservationClaimError('observation_attempt_drift');
    }
    return siblingAttempt;
  }

  return Object.freeze({
    async loadClaimContext(claimToken) {
      const token = assertUuid(claimToken, 'claimToken');
      return retryTransaction(async (trx) => {
        const { job, edge, siblings } = await claimedGroup(trx, token);
        const activity = await trx('agent_tool_activities').where({
          activity_id: job.activity_id,
          workspace_id: job.workspace_id,
          fact_admission_state: 'admitted',
        }).first();
        if (!activity) throw new AgentObservationClaimError('observation_owner_not_admitted');
        return Object.freeze({
          activity: Object.freeze({ ...activity }),
          dominantEdge: Object.freeze({ ...edge }),
          siblingEdgeIds: Object.freeze(siblings.map((sibling) => sibling.edge_id)),
        });
      });
    },

    async claimDue(now, {
      leaseMs = 30_000,
      excludedActivityIds = [],
      onlyActivityId = null,
    } = {}) {
      assertTimestamp(now, 'now');
      if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('leaseMs must be positive');
      let selectedActivityId = onlyActivityId;
      try {
        return await retryTransaction(async (trx) => {
        let query = trx('agent_observation_jobs as jobs')
          .join('agent_tool_activities as activities', function joinOwner() {
            this.on('activities.activity_id', '=', 'jobs.activity_id')
              .andOn('activities.workspace_id', '=', 'jobs.workspace_id');
          })
          .where('jobs.state', 'pending')
          .where('jobs.next_attempt_at', '<=', now)
          .where('activities.fact_admission_state', 'admitted')
          .orderBy('jobs.next_attempt_at', 'asc')
          .orderBy('jobs.created_at', 'asc')
          .orderBy('jobs.activity_id', 'asc')
          .select('jobs.*');
        if (onlyActivityId) query = query.where('jobs.activity_id', onlyActivityId);
        if (excludedActivityIds.length) query = query.whereNotIn('jobs.activity_id', excludedActivityIds);
        const job = await query.first();
        if (!job) return null;
        selectedActivityId = job.activity_id;
        const pendingEdges = await trx('agent_tool_resource_edges')
          .where({ activity_id: job.activity_id, observation_state: 'pending' })
          .orderBy('candidate_ordinal', 'asc');
        const groups = new Map();
        for (const edge of pendingEdges) {
          const group = groups.get(edge.canonical_path) ?? [];
          group.push(edge);
          groups.set(edge.canonical_path, group);
        }
        const readyGroups = [...groups.values()].filter((group) => (
          Math.min(...group.map((edge) => edge.next_observation_at)) <= now
        )).map((group) => ({
          group,
          dominant: [...group].sort((left, right) => (
            ACCESS_RANK[left.access_family] - ACCESS_RANK[right.access_family]
              || left.candidate_ordinal - right.candidate_ordinal
          ))[0],
        })).sort((left, right) => left.dominant.candidate_ordinal - right.dominant.candidate_ordinal);
        if (!readyGroups.length) throw new AgentObservationClaimError('observation_job_minimum_drift');
        const { dominant } = readyGroups[0];
        const canonicalPath = dominant.canonical_path;
        const token = assertUuid(randomUuid(), 'generated claimToken');
        const changed = await trx('agent_observation_jobs').where({
          activity_id: job.activity_id,
          state: 'pending',
          next_attempt_at: job.next_attempt_at,
        }).update({
          state: 'running',
          claim_token: token,
          claimed_edge_id: dominant.edge_id,
          claimed_attempt: 0,
          claimed_at: now,
          lease_expires_at: now + leaseMs,
          updated_at: now,
        });
        if (changed !== 1) return null;
        return Object.freeze({
          activityId: job.activity_id,
          workspaceId: job.workspace_id,
          claimToken: token,
          claimedEdgeId: dominant.edge_id,
          canonicalPath,
          claimedAttempt: 0,
          leaseExpiresAt: now + leaseMs,
        });
        });
      } catch (error) {
        if (selectedActivityId) error.activityId = selectedActivityId;
        throw error;
      }
    },

    async reserveAttempt(claimToken, now, { deadlineGuard = () => true } = {}) {
      const token = assertUuid(claimToken, 'claimToken');
      assertTimestamp(now, 'now');
      if (typeof deadlineGuard !== 'function' || !deadlineGuard()) {
        throw new AgentObservationClaimError('observation_deadline_expired');
      }
      return retryTransaction(async (trx) => {
        if (!deadlineGuard()) throw new AgentObservationClaimError('observation_deadline_expired');
        const { job, siblings } = await claimedGroup(trx, token);
        if (job.claimed_attempt !== 0) {
          throw new AgentObservationClaimError('observation_attempt_already_reserved');
        }
        const attempt = assertAttemptConsistency(job, siblings) + 1;
        if (attempt > 3) throw new AgentObservationClaimError('observation_attempt_exhausted');
        const changed = await trx('agent_observation_jobs').where({
          claim_token: token,
          state: 'running',
          claimed_attempt: 0,
        }).update({
          claimed_attempt: attempt,
          updated_at: now,
        });
        if (changed !== 1) throw new AgentObservationClaimError();
        const advanced = await trx('agent_tool_resource_edges')
          .whereIn('edge_id', siblings.map((edge) => edge.edge_id))
          .update({ observation_attempt_count: attempt, updated_at: now });
        if (advanced !== siblings.length) throw new AgentObservationClaimError('observation_attempt_drift');
        if (!deadlineGuard()) throw new AgentObservationClaimError('observation_deadline_expired');
        return attempt;
      });
    },

    async releaseWithoutAttempt(claimToken, now, delayMs = 100) {
      const token = assertUuid(claimToken, 'claimToken');
      assertTimestamp(now, 'now');
      return retryTransaction(async (trx) => {
        const { job, siblings } = await claimedGroup(trx, token);
        if (job.claimed_attempt !== 0) throw new AgentObservationClaimError('observation_attempt_already_reserved');
        assertAttemptConsistency(job, siblings);
        await trx('agent_tool_resource_edges').whereIn('edge_id', siblings.map((edge) => edge.edge_id)).update({
          next_observation_at: now + delayMs,
          updated_at: now,
        });
        await jobAfterGroupTransition(trx, job.activity_id, token, now);
      });
    },

    async settleNoResult(claimToken, now) {
      const token = assertUuid(claimToken, 'claimToken');
      assertTimestamp(now, 'now');
      return retryTransaction(async (trx) => {
        const { job, siblings } = await claimedGroup(trx, token);
        const attempt = job.claimed_attempt;
        assertAttemptConsistency(job, siblings);
        if (attempt === 3) {
          await trx('agent_tool_resource_edges').whereIn('edge_id', siblings.map((edge) => edge.edge_id)).update({
            observation_state: 'failed',
            observation_reason: 'observation_incomplete',
            observed_at: now,
            next_observation_at: null,
            updated_at: now,
          });
        } else {
          const delay = attempt === 0 ? 100 : attempt === 1 ? 250 : 1_000;
          await trx('agent_tool_resource_edges').whereIn('edge_id', siblings.map((edge) => edge.edge_id)).update({
            next_observation_at: now + delay,
            updated_at: now,
          });
        }
        await jobAfterGroupTransition(trx, job.activity_id, token, now);
      });
    },

    async closeGroup(claimToken, now, { state, reason, deadlineGuard = () => true }) {
      const token = assertUuid(claimToken, 'claimToken');
      assertTimestamp(now, 'now');
      if (!['skipped', 'failed'].includes(state)) throw new TypeError('closed state is invalid');
      assertEnum(reason, state === 'skipped'
        ? SKIP_REASONS.filter((item) => !['outside_workspace', 'blocked_before_execution'].includes(item))
        : FAILURE_REASONS, 'observation reason');
      if (typeof deadlineGuard !== 'function' || !deadlineGuard()) {
        throw new AgentObservationClaimError('observation_deadline_expired');
      }
      return retryTransaction(async (trx) => {
        if (!deadlineGuard()) throw new AgentObservationClaimError('observation_deadline_expired');
        const { job, siblings } = await claimedGroup(trx, token);
        if (job.claimed_attempt < 1 || new Set(siblings.map((edge) => edge.observation_attempt_count)).size !== 1
          || siblings.some((edge) => edge.observation_attempt_count !== job.claimed_attempt)) {
          throw new AgentObservationClaimError('observation_attempt_not_reserved');
        }
        await trx('agent_tool_resource_edges').whereIn('edge_id', siblings.map((edge) => edge.edge_id)).update({
          observation_state: state,
          observation_reason: reason,
          observed_at: now,
          next_observation_at: null,
          snapshot_id: null,
          previous_snapshot_id: null,
          updated_at: now,
        });
        await jobAfterGroupTransition(trx, job.activity_id, token, now);
        if (!deadlineGuard()) throw new AgentObservationClaimError('observation_deadline_expired');
      });
    },

    async recoverExpired(now, {
      excludedClaimTokens = [],
      limit = 16,
      shouldContinue = () => true,
    } = {}) {
      assertTimestamp(now, 'now');
      if (!Number.isInteger(limit) || limit < 0 || limit > 16) {
        throw new TypeError('observation recovery limit must be 0..16');
      }
      if (typeof shouldContinue !== 'function') throw new TypeError('shouldContinue must be a function');
      if (limit === 0 || !shouldContinue()) return 0;
      let query = db('agent_observation_jobs')
        .where({ state: 'running' }).where('lease_expires_at', '<=', now);
      if (excludedClaimTokens.length) query = query.whereNotIn('claim_token', excludedClaimTokens);
      const expired = await query.orderBy('lease_expires_at', 'asc').limit(limit).select('claim_token');
      let recovered = 0;
      for (const row of expired) {
        if (!shouldContinue()) break;
        try {
          await this.settleNoResult(row.claim_token, now);
          recovered += 1;
        } catch (error) {
          error.claimToken = row.claim_token;
          throw error;
        }
      }
      return recovered;
    },

    async nextWakeAt({ excludedActivityIds = [], excludedClaimTokens = [] } = {}) {
      let pendingQuery = db('agent_observation_jobs as jobs')
        .join('agent_tool_activities as activities', function joinOwner() {
          this.on('activities.activity_id', '=', 'jobs.activity_id').andOn('activities.workspace_id', '=', 'jobs.workspace_id');
        })
        .where('jobs.state', 'pending').where('activities.fact_admission_state', 'admitted');
      if (excludedActivityIds.length) pendingQuery = pendingQuery.whereNotIn('jobs.activity_id', excludedActivityIds);
      let runningQuery = db('agent_observation_jobs').where({ state: 'running' });
      if (excludedClaimTokens.length) runningQuery = runningQuery.whereNotIn('claim_token', excludedClaimTokens);
      const [pending, running] = await Promise.all([
        pendingQuery.min({ value: 'jobs.next_attempt_at' }).first(),
        runningQuery.min({ value: 'lease_expires_at' }).first(),
      ]);
      const values = [pending?.value, running?.value].filter((value) => value != null);
      return values.length ? Math.min(...values) : null;
    },
  });
}

function createAgentObservationScheduler(repository) {
  if (!repository?.claimDue) throw new TypeError('observation job repository is required');
  let draining = null;

  async function drainBatch(now, processClaim, { limit = 16, concurrency = 4, leaseMs = 30_000 } = {}) {
    assertTimestamp(now, 'now');
    if (typeof processClaim !== 'function') throw new TypeError('processClaim is required');
    if (!Number.isInteger(limit) || limit < 0 || limit > 16) throw new TypeError('observation batch limit must be 0..16');
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new TypeError('observation concurrency must be 1..4');
    if (draining) return draining;
    draining = (async () => {
      const dispositions = [];
      const active = new Map();
      let selectionExhausted = false;
      while (dispositions.length < limit) {
        while (!selectionExhausted && active.size < concurrency && dispositions.length + active.size < limit) {
          const claim = await repository.claimDue(now, {
            leaseMs,
            excludedActivityIds: [...active.keys()],
          });
          if (!claim) {
            selectionExhausted = true;
            break;
          }
          const settled = Promise.resolve().then(() => processClaim(claim)).then(
            (value) => ({ activityId: claim.activityId, claim, status: 'fulfilled', value }),
            (reason) => ({ activityId: claim.activityId, claim, status: 'rejected', reason }),
          );
          active.set(claim.activityId, settled);
        }
        if (!active.size) break;
        const disposition = await Promise.race(active.values());
        active.delete(disposition.activityId);
        dispositions.push(Object.freeze(disposition));
        selectionExhausted = false;
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

module.exports = { AgentObservationClaimError, createAgentObservationJobRepository, createAgentObservationScheduler };
