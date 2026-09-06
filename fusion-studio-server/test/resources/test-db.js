'use strict';

const knex = require('knex');
const initialMigration = require('../../lib/db/migrations/001_initial');
const ledgerMigration = require('../../lib/db/migrations/029_event_ledger');
const registryMigration = require('../../lib/db/migrations/034_event_registry_authority');
const provenanceMigration = require('../../lib/db/migrations/035_file_provenance');
const agentToolProvenanceMigration = require('../../lib/db/migrations/036_agent_tool_provenance');

function createDb(filename = ':memory:') {
  return knex({
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection, done) {
        connection.pragma('foreign_keys = ON');
        connection.pragma('busy_timeout = 1000');
        done(null, connection);
      },
    },
  });
}

async function migrate(db) {
  await initialMigration.up(db);
  await ledgerMigration.up(db);
  await registryMigration.up(db);
  await provenanceMigration.up(db);
  await agentToolProvenanceMigration.up(db);
  return db;
}

module.exports = { createDb, migrate };
