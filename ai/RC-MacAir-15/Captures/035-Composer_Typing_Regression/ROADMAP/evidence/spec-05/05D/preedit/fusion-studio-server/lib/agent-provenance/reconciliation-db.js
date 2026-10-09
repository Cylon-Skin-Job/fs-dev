'use strict';

const knex = require('knex');

async function createAgentReconciliationDb(primaryDb) {
  const filename = primaryDb?.client?.config?.connection?.filename;
  if (typeof filename !== 'string' || !filename || filename === ':memory:') {
    throw new TypeError('File-backed database is required for agent reconciliation');
  }
  const reconciliationDb = knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection, done) {
        try {
          connection.pragma('foreign_keys = ON');
          connection.pragma('busy_timeout = 0');
          if (Number(connection.pragma('foreign_keys', { simple: true })) !== 1
            || Number(connection.pragma('busy_timeout', { simple: true })) !== 0) {
            throw new Error('Agent reconciliation database policy is unavailable');
          }
          done(null, connection);
        } catch (error) {
          done(error, connection);
        }
      },
    },
  });
  try {
    await reconciliationDb.raw('SELECT 1');
    return reconciliationDb;
  } catch (error) {
    await reconciliationDb.destroy().catch(() => {});
    throw error;
  }
}

module.exports = { createAgentReconciliationDb };
