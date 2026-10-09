'use strict';

const { assertTimestamp } = require('../file-mutations/provenance-values');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');
const { assertScalarBoundedString } = require('./values');
const { boundedCanonicalSha256 } = require('./bounded-canonical-hash');

function valueSha256(value) {
  return boundedCanonicalSha256(value);
}

function createAgentExchangeBindRepository(db, { now = Date.now } = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  const retryTransaction = (work) => runBoundedSqliteRetry(() => db.transaction(work), {
    attempts: 5,
    exhaustionCode: 'agent_exchange_bind_failed',
    exhaustionMessage: 'agent exchange binding did not settle',
  });

  async function insertInTransaction(trx, input) {
    if (!Number.isSafeInteger(input.exchangeId) || input.exchangeId <= 0) throw new TypeError('exchangeId must be a positive safe integer');
    const workspaceId = assertScalarBoundedString(input.workspaceId, 128, 'workspaceId');
    const threadId = assertScalarBoundedString(input.threadId, 128, 'threadId');
    const turnId = assertScalarBoundedString(input.turnId, 128, 'turnId');
    const exchangeSavedAt = assertTimestamp(input.exchangeSavedAt, 'exchangeSavedAt');
    const createdAt = assertTimestamp(input.now ?? exchangeSavedAt, 'now');
    const exchange = await trx('exchanges').where({ id: input.exchangeId }).first();
    if (!exchange || exchange.thread_id !== threadId || exchange.ts !== exchangeSavedAt) {
      throw new TypeError('exchange bind authority does not match the committed exchange');
    }
    await trx('agent_exchange_bind_jobs').insert({
      exchange_id: input.exchangeId,
      workspace_id: workspaceId,
      thread_id: threadId,
      turn_id: turnId,
      exchange_saved_at: exchangeSavedAt,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  async function markConflict(trx, job, code, boundAt) {
    await trx('agent_exchange_bind_jobs').where({ exchange_id: job.exchange_id, state: 'pending' }).update({
      state: 'conflict', conflict_code: code, updated_at: boundAt,
    });
    return Object.freeze({ exchangeId: job.exchange_id, state: 'conflict', conflictCode: code });
  }

  async function listNext({ excludedExchangeIds = [], onlyExchangeId = null } = {}) {
    return runBoundedSqliteRetry(async () => {
      let query = db('agent_exchange_bind_jobs').where({ state: 'pending' });
      if (onlyExchangeId != null) query = query.where({ exchange_id: onlyExchangeId });
      if (excludedExchangeIds.length > 0) query = query.whereNotIn('exchange_id', excludedExchangeIds);
      return query.orderBy('exchange_id', 'asc').first();
    }, {
      attempts: 5,
      exhaustionCode: 'agent_exchange_bind_failed',
      exhaustionMessage: 'agent exchange bind selection did not settle',
    });
  }

  async function bindExchange(exchangeId) {
    try {
      return await retryTransaction(async (trx) => {
        const job = await trx('agent_exchange_bind_jobs')
          .where({ exchange_id: exchangeId, state: 'pending' })
          .first();
        if (!job) return null;
        const exchange = await trx('exchanges').where({ id: job.exchange_id }).first();
        if (!exchange) return null;
        const boundAt = assertTimestamp(now(), 'exchangeBoundAt');
        if (exchange.thread_id !== job.thread_id || exchange.ts !== job.exchange_saved_at) {
          return markConflict(trx, job, 'different_binding', boundAt);
        }
        let parts;
        try {
          const parsed = JSON.parse(exchange.assistant);
          parts = Array.isArray(parsed?.parts) ? parsed.parts : [];
        } catch {
          return markConflict(trx, job, 'incomplete_tool_part', boundAt);
        }
        const validToolPartCounts = new Map();
        for (const part of parts) {
          if (part?.type !== 'tool_call') continue;
          try {
            const toolCallId = assertScalarBoundedString(part.toolCallId, 512, 'toolCallId');
            validToolPartCounts.set(toolCallId, (validToolPartCounts.get(toolCallId) ?? 0) + 1);
          } catch {
            // Parts without a schema-valid provider tool-call ID cannot bind an activity.
          }
        }
        if ([...validToolPartCounts.values()].some((count) => count > 1)) {
          return markConflict(trx, job, 'duplicate_tool_part', boundAt);
        }
        const activities = await trx('agent_tool_activities').where({
          workspace_id: job.workspace_id,
          thread_id: job.thread_id,
          turn_id: job.turn_id,
        }).orderBy('id', 'asc');
        const activityCounts = new Map();
        for (const activity of activities) {
          activityCounts.set(activity.tool_call_id, (activityCounts.get(activity.tool_call_id) ?? 0) + 1);
        }
        if ([...activityCounts.values()].some((count) => count > 1)) {
          return markConflict(trx, job, 'duplicate_tool_part', boundAt);
        }
        const updates = [];
        for (const activity of activities) {
          const matches = parts.filter((part) => part?.type === 'tool_call' && part.toolCallId === activity.tool_call_id);
          if (matches.length > 1) return markConflict(trx, job, 'duplicate_tool_part', boundAt);
          if (matches.length !== 1
            || matches[0].terminalSnapshotExpansionVersion !== 1
            || matches[0].terminalSnapshotExpansionComplete !== true) {
            return markConflict(trx, job, 'incomplete_tool_part', boundAt);
          }
          const part = matches[0];
          try {
            if (activity.arguments_sha256 != null && valueSha256(part.arguments) !== activity.arguments_sha256) {
              return markConflict(trx, job, 'detail_hash_mismatch', boundAt);
            }
            if (activity.result_sha256 != null && valueSha256(part.result) !== activity.result_sha256) {
              return markConflict(trx, job, 'detail_hash_mismatch', boundAt);
            }
          } catch {
            return markConflict(trx, job, 'detail_hash_mismatch', boundAt);
          }
          if (activity.exchange_id != null && activity.exchange_id !== job.exchange_id) {
            return markConflict(trx, job, 'different_binding', boundAt);
          }
          updates.push(activity.activity_id);
        }
        if (updates.length) {
          await trx('agent_tool_activities').whereIn('activity_id', updates).whereNull('exchange_id').update({
            exchange_id: job.exchange_id,
            exchange_saved_at: job.exchange_saved_at,
            exchange_bound_at: boundAt,
            updated_at: boundAt,
          });
        }
        await trx('agent_exchange_bind_jobs').where({ exchange_id: job.exchange_id, state: 'pending' }).update({
          state: 'applied', updated_at: boundAt,
        });
        return Object.freeze({ exchangeId: job.exchange_id, state: 'applied', boundActivities: updates.length });
      });
    } catch (error) {
      if (error && typeof error === 'object' && error.exchangeId == null) {
        Object.defineProperty(error, 'exchangeId', { value: exchangeId, configurable: true });
      }
      throw error;
    }
  }

  return Object.freeze({
    insertInTransaction,
    listNext,
    bindExchange,

    async bindNext(options = {}) {
      const job = await listNext(options);
      return job ? bindExchange(job.exchange_id) : null;
    },
  });
}

const { createAgentExchangeBinder } = require('./exchange-binder');

module.exports = { createAgentExchangeBindRepository, createAgentExchangeBinder, valueSha256 };
