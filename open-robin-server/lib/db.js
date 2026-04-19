/**
 * Database singleton — Knex + better-sqlite3
 *
 * One job: manage the lifecycle of robin.db (init, get, close).
 */

const knex = require('knex');
const path = require('path');
const fs = require('fs');

let instance = null;

/**
 * Initialize the database. Creates data/ if needed, runs migrations.
 * @returns {Promise<import('knex').Knex>}
 */
async function initDb() {
  if (instance) return instance;

  const dataDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  instance = knex({
    client: 'better-sqlite3',
    connection: { filename: path.join(dataDir, 'robin.db') },
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

module.exports = { initDb, getDb, closeDb };
