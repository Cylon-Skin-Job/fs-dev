/**
 * Chat Search Module
 *
 * Queries exchanges by workspace so users (and future agent tools) can
 * search past conversations. Cross-workspace search is possible but not
 * the default.
 *
 * @see docs/WORKSPACE_ISOLATION_AND_KEYED_STATE_SPEC.md §11
 */

const { getDb } = require('../db');

/**
 * Search exchanges across threads.
 *
 * @param {object} options
 * @param {string|null} [options.workspaceId] - Omit for default (current). Pass null for all workspaces.
 * @param {string} options.query
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {Promise<{total: number, results: Array<object>}>}
 */
async function search({ workspaceId, query, limit = 50, offset = 0 }) {
  const db = getDb();
  const likePattern = `%${query}%`;

  // Build base query joining exchanges to threads, plus the Thread Group
  // ownership. Search stays exchange/session-backed: `threadId` and
  // `exchangeId` remain the identities; the group join only adds query
  // context (`SPEC-01 §8.5`).
  let baseQuery = db('exchanges')
    .join('threads', 'exchanges.thread_id', 'threads.thread_id')
    .leftJoin('thread_group_members as tgm', 'tgm.thread_id', 'threads.thread_id')
    .leftJoin('thread_groups as tg', 'tg.group_id', 'tgm.group_id')
    .where(function () {
      this.whereLike('exchanges.user_input', likePattern)
        .orWhereLike('exchanges.assistant', likePattern);
    });

  // Workspace filter: undefined = no filter (all workspaces), null = all workspaces
  if (workspaceId !== undefined && workspaceId !== null) {
    baseQuery = baseQuery.where('threads.workspace_id', workspaceId);
  }

  // Count total matches
  const countResult = await baseQuery
    .clone()
    .clearSelect()
    .count('* as count')
    .first();
  const total = countResult ? Number(countResult.count) : 0;

  // Fetch results with thread metadata
  const rows = await baseQuery
    .select(
      'exchanges.id as exchange_id',
      'exchanges.thread_id',
      'exchanges.seq',
      'exchanges.ts',
      'exchanges.user_input',
      'exchanges.assistant',
      'exchanges.metadata',
      'threads.name as thread_name',
      'threads.workspace_id',
      'threads.scope',
      'threads.view_id',
      'tg.group_id as thread_group_id',
      'tg.name as thread_group_name',
      'tg.view_id as thread_group_view_id'
    )
    .orderBy('exchanges.ts', 'desc')
    .limit(limit)
    .offset(offset);

  const results = rows.map((row) => {
    let assistantParts = null;
    try {
      const parsed = JSON.parse(row.assistant);
      assistantParts = parsed.parts || null;
    } catch {
      // assistant may be raw text in legacy rows
    }

    let metadata = null;
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      metadata = null;
    }

    return {
      exchangeId: row.exchange_id,
      threadId: row.thread_id,
      threadName: row.thread_name,
      workspaceId: row.workspace_id,
      scope: row.scope,
      viewId: row.view_id,
      // Group context is joined for query/worksurface only; it never replaces
      // the exact exchange/session identity.
      threadGroupId: row.thread_group_id ?? null,
      threadGroupName: row.thread_group_name ?? null,
      groupViewId: row.thread_group_view_id ?? null,
      seq: row.seq,
      timestamp: row.ts,
      userInput: row.user_input,
      assistantPreview: assistantParts
        ? JSON.stringify(assistantParts).slice(0, 200)
        : String(row.assistant).slice(0, 200),
      metadata,
    };
  });

  return { total, results };
}

module.exports = { search };
