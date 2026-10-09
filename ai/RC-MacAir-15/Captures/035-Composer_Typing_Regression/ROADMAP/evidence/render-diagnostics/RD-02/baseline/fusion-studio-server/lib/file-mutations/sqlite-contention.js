'use strict';

const { ProvenanceConflictError } = require('./provenance-values');

function isBusy(error) {
  return error?.code === 'SQLITE_BUSY'
    || /database is locked|cannot start a transaction within a transaction/iu.test(String(error?.message));
}

function isUnique(error) {
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
    || /UNIQUE constraint failed/iu.test(String(error?.message));
}

async function runBoundedSqliteRetry(work, {
  attempts = 5,
  retryUnique = false,
  exhaustionCode = 'storage_contention',
  exhaustionMessage = 'durable storage contention did not settle',
} = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work(attempt);
    } catch (error) {
      lastError = error;
      if (!isBusy(error) && !(retryUnique && isUnique(error))) throw error;
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  throw new ProvenanceConflictError(exhaustionMessage, exhaustionCode, { cause: lastError });
}

module.exports = { isBusy, isUnique, runBoundedSqliteRetry };
