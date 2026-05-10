/**
 * secrets_index CRUD — Knex data access for the metadata mirror table.
 *
 * One job: read and write secrets_index rows. No keychain logic, no event
 * emission, no validation beyond what the table schema enforces.
 * See SECRETS_MANAGER_SPEC.md §13.
 */

const { getDb } = require('../../db');

const TABLE = 'secrets_index';
const COLUMNS = [
  'name',
  'description',
  'expires_at',
  'fingerprint',
  'created_at',
  'updated_at',
];

async function list() {
  return getDb()(TABLE).select(COLUMNS).orderBy('name', 'asc');
}

async function get(name) {
  const row = await getDb()(TABLE).select(COLUMNS).where({ name }).first();
  return row || null;
}

async function insert(row) {
  await getDb()(TABLE).insert(row);
}

async function update(name, fields) {
  const count = await getDb()(TABLE).where({ name }).update(fields);
  if (count === 0) {
    throw new Error(`secrets_index row not found: ${name}`);
  }
}

async function remove(name) {
  const count = await getDb()(TABLE).where({ name }).del();
  return count > 0;
}

module.exports = { list, get, insert, update, remove };
