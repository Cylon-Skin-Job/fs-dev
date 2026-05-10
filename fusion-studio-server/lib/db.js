/**
 * Database singleton — Knex + better-sqlite3
 *
 * One job: manage the lifecycle of fusion.db (init, get, close).
 */

const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Resolved at module-load time so consumers (e.g. lib/startup.js) can read
// the canonical DB path before initDb() runs. Single source of truth.
// See docs/DB_RELOCATION_SPEC.md §3a.
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'fusion.db');

let instance = null;

/**
 * Initialize the database. Creates data/ if needed, runs migrations.
 * @returns {Promise<import('knex').Knex>}
 */
async function initDb() {
  if (instance) return instance;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  instance = knex({
    client: 'better-sqlite3',
    connection: { filename: DB_PATH },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, done) => {
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
    migrations: {
      directory: path.join(__dirname, 'db', 'migrations'),
    },
  });

  await instance.migrate.latest();
  return instance;
}

/**
 * Get the initialized Knex instance.
 * @returns {import('knex').Knex}
 */
function getDb() {
  if (!instance) throw new Error('DB not initialized — call initDb() first');
  return instance;
}

/**
 * Close the database connection.
 */
async function closeDb() {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}

module.exports = { initDb, getDb, closeDb, DB_PATH };
