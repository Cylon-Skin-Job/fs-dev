'use strict';

const knex = require('knex');
const { migrate } = require('../resources/test-db');

async function createZeroBusyTimeoutDb(filename = ':memory:') {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection, done) {
        connection.pragma('foreign_keys = ON');
        connection.pragma('busy_timeout = 0');
        done(null, connection);
      },
    },
  });
  await migrate(db);
  const connection = await db.client.acquireConnection();
  const timeout = connection.pragma('busy_timeout', { simple: true });
  await db.client.releaseConnection(connection);
  if (timeout !== 0) throw new Error('zero-timeout provenance fixture is misconfigured');
  return db;
}

module.exports = { createZeroBusyTimeoutDb };
