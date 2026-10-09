/**
 * Emoji recents table access.
 *
 * One job: record and list recently used emojis from SQLite.
 */

'use strict';

const { getDb } = require('../db');

const TABLE = 'emoji_recents';
const EMOJI_RECENTS_CAP = 20;

async function list(limit = EMOJI_RECENTS_CAP) {
  const db = getDb();
  const rows = await db(TABLE)
    .select('id', 'emoji', 'last_used_at')
    .orderBy('last_used_at', 'desc')
    .limit(limit);
  return { items: rows, total: await db(TABLE).count({ count: '*' }).first().then(r => Number(r.count)) };
}

async function record(emoji, now = Date.now()) {
  if (typeof emoji !== 'string' || emoji.length === 0) {
    throw new Error('emoji is required');
  }

  const db = getDb();
  const existing = await db(TABLE).where({ emoji }).first();
  if (existing) {
    await db(TABLE).where({ id: existing.id }).update({ last_used_at: now });
    return { ...existing, last_used_at: now };
  }

  const ids = await db(TABLE).insert({ emoji, last_used_at: now });
  const row = await db(TABLE).where({ id: ids[0] }).first();
  await pruneToCapacity();
  return row;
}

async function pruneToCapacity() {
  const db = getDb();
  const totalRow = await db(TABLE).count({ count: '*' }).first();
  const total = Number(totalRow.count);
  if (total <= EMOJI_RECENTS_CAP) return [];

  const overflow = total - EMOJI_RECENTS_CAP;
  const oldest = await db(TABLE)
    .select('id')
    .orderBy('last_used_at', 'asc')
    .limit(overflow);
  const ids = oldest.map(row => row.id);
  if (ids.length > 0) await db(TABLE).whereIn('id', ids).del();
  return ids;
}

module.exports = { list, record, EMOJI_RECENTS_CAP };
