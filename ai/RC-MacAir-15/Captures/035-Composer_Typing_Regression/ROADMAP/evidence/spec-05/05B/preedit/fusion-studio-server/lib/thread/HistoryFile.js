/**
 * HistoryFile - Exchange CRUD against SQLite
 *
 * One job: read/write exchange data in the exchanges table.
 * The assistant column stores { parts: [...] } as JSON text.
 * JSON.parse on read must return the exact shape the client expects.
 */

const { getDb } = require('../db');

const SCHEMA_VERSION = '1.0.0';
let agentExchangeBinding = null;

function installAgentExchangeBinding(binding) {
  if (agentExchangeBinding) throw new Error('Agent exchange binding is already installed');
  if (typeof binding?.insertInTransaction !== 'function' || typeof binding?.signal !== 'function') {
    throw new TypeError('Agent exchange bind writer and signal are required');
  }
  agentExchangeBinding = Object.freeze({
    insertInTransaction: binding.insertInTransaction,
    signal: binding.signal,
  });
}

class HistoryFile {
  /**
   * @param {string} threadId
   */
  constructor(threadId) {
    this.threadId = threadId;
  }

  /**
   * No-op — thread row already exists, exchanges start empty.
   * Kept for caller compatibility.
   * @param {string} threadId
   * @returns {Promise<object>}
   */
  async create(threadId) {
    const now = Date.now();
    return {
      version: SCHEMA_VERSION,
      threadId,
      createdAt: now,
      updatedAt: now,
      exchanges: [],
    };
  }

  /**
   * Read all exchanges for this thread.
   * Reconstructs the HistoryData shape that callers expect.
   * @returns {Promise<object|null>}
   */
  async read() {
    const db = getDb();
    const rows = await db('exchanges')
      .where('thread_id', this.threadId)
      .orderBy('seq', 'asc');

    if (rows.length === 0) return null;

    return {
      version: SCHEMA_VERSION,
      threadId: this.threadId,
      createdAt: rows[0].ts,
      updatedAt: rows[rows.length - 1].ts,
      exchanges: rows.map(this._toExchange),
    };
  }

  /**
   * Add a complete exchange.
   * @param {string} threadId
   * @param {string} userInput
   * @param {Array} parts - Assistant response parts
   * @param {object} [metadata] - Optional metadata (contextUsage, tokenUsage, etc.)
   * @returns {Promise<object>} Exchange object
   */
  async addExchange(threadId, userInput, parts, metadata = null, bindingAuthority = null) {
    const db = getDb();
    const assistant = JSON.stringify({ parts: parts.map((p) => ({ ...p })) });
    if (bindingAuthority && !agentExchangeBinding) {
      throw new Error('Agent exchange binding is not installed');
    }
    const saved = await db.transaction(async (trx) => {
      const exchangeTs = Date.now();
      const count = await trx('exchanges').where('thread_id', threadId).count('* as count').first();
      const seq = Number(count?.count || 0) + 1;
      const inserted = await trx('exchanges').insert({
        thread_id: threadId,
        seq,
        ts: exchangeTs,
        user_input: userInput,
        assistant,
        metadata: JSON.stringify(metadata || {}),
      });
      const exchangeId = Array.isArray(inserted) ? inserted[0] : inserted;
      if (bindingAuthority) {
        await agentExchangeBinding.insertInTransaction(trx, {
          exchangeId,
          workspaceId: bindingAuthority.workspaceId,
          threadId,
          turnId: bindingAuthority.turnId,
          exchangeSavedAt: exchangeTs,
          now: exchangeTs,
        });
      }
      return Object.freeze({ exchangeId, seq, exchangeTs });
    });
    if (bindingAuthority) agentExchangeBinding.signal();

    return {
      exchangeId: saved.exchangeId,
      seq: saved.seq,
      ts: saved.exchangeTs,
      user: userInput,
      assistant: { parts: parts.map((p) => ({ ...p })) },
      metadata: metadata || {},
    };
  }

  /**
   * Check if any exchanges exist for this thread.
   * @returns {Promise<boolean>}
   */
  async exists() {
    const db = getDb();
    const row = await db('exchanges')
      .where('thread_id', this.threadId)
      .first();
    return !!row;
  }

  /**
   * Get exchange count.
   * @returns {Promise<number>}
   */
  async countExchanges() {
    const db = getDb();
    const result = await db('exchanges')
      .where('thread_id', this.threadId)
      .count('* as count')
      .first();
    return result?.count || 0;
  }

  /**
   * Get the last exchange (for continuation).
   * @returns {Promise<object|null>}
   */
  async getLastExchange() {
    const db = getDb();
    const row = await db('exchanges')
      .where('thread_id', this.threadId)
      .orderBy('seq', 'desc')
      .first();

    return row ? this._toExchange(row) : null;
  }

  /**
   * Map a DB row to the Exchange shape the client expects.
   * @private
   */
  _toExchange(row) {
    // Parse metadata - handle both old array format '[]' and new object format '{}'
    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(row.metadata || '{}');
      // Handle legacy array format
      if (Array.isArray(parsedMetadata)) {
        parsedMetadata = {};
      }
    } catch {
      parsedMetadata = {};
    }

    return {
      exchangeId: row.id,
      seq: row.seq,
      ts: row.ts,
      user: row.user_input,
      assistant: JSON.parse(row.assistant),
      metadata: parsedMetadata,
    };
  }
}

module.exports = { HistoryFile, SCHEMA_VERSION, installAgentExchangeBinding };
