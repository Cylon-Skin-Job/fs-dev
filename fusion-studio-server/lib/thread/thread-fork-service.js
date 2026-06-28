'use strict';

/**
 * @module thread-fork-service
 * @role Create persisted pending fork threads from existing OpenCode threads.
 */

const { getDb } = require('../db');
const { HistoryFile } = require('./HistoryFile');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');

const SCOPE = 'project';
const FORK_HARNESS_ID = 'opencode';

class ThreadForkError extends Error {
  constructor(message, { code = 'THREAD_FORK_FAILED', recoverable = true } = {}) {
    super(message);
    this.name = 'ThreadForkError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

function generateThreadId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mm}-${dd}T${hh}-${mi}-${ss}-${ms}`;
}

function parseHarnessConfig(row) {
  if (!row?.harness_config) return {};
  try {
    const parsed = JSON.parse(row.harness_config);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveDisplayName(threadId, name) {
  return name || threadId.replace(/-\d{3}$/, '');
}

function getRuntimeKey(manager, threadId) {
  return {
    workspaceId: manager.workspaceId,
    scope: SCOPE,
    threadId,
  };
}

function assertSourceThreadIdle(manager, sourceThreadId) {
  const runtimeState = threadRuntimeManager.getRuntimeState(getRuntimeKey(manager, sourceThreadId));
  if (runtimeState === RUNTIME_STATES.COLD || runtimeState === RUNTIME_STATES.READY) {
    return;
  }

  throw new ThreadForkError('Source thread is busy. Wait for the current turn to finish.', {
    code: 'THREAD_FORK_SOURCE_BUSY',
    recoverable: true,
  });
}

function resolveCopiedMessageCount(sourceRow, copiedRows) {
  const sourceMessageCount = Number(sourceRow.message_count) || 0;
  if (copiedRows.length === 0) return 0;
  if (sourceMessageCount > 0) {
    return Math.min(sourceMessageCount, copiedRows.length * 2);
  }
  return copiedRows.length * 2;
}

async function readForkHistory(threadId) {
  const richHistory = await new HistoryFile(threadId).read();
  return richHistory?.exchanges || [];
}

function parseJsonObject(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function buildChatFileMessages(exchangeRows) {
  const messages = [];
  for (const row of exchangeRows) {
    messages.push({
      role: 'user',
      content: row.user_input,
    });

    const assistant = parseJsonObject(row.assistant, { parts: [] });
    const parts = Array.isArray(assistant.parts) ? assistant.parts : [];
    const text = parts
      .filter((part) => part?.type === 'text' && typeof part.content === 'string')
      .map((part) => part.content)
      .join('');
    const metadata = parseJsonObject(row.metadata, {});
    const assistantMessage = {
      role: 'assistant',
      content: text,
      hasToolCalls: parts.some((part) => part?.type && part.type !== 'text' && part.type !== 'think'),
    };
    if (Object.keys(metadata).length > 0) {
      assistantMessage.metadata = metadata;
    }
    messages.push(assistantMessage);
  }
  return messages;
}

async function writeForkChatFile(manager, threadId, name, exchangeRows) {
  if (typeof manager._createChatFile !== 'function') return;
  const chatFile = manager._createChatFile(threadId);
  await chatFile.write(name, buildChatFileMessages(exchangeRows));
}

/**
 * Create a pending OpenCode fork thread and clone source exchanges.
 *
 * @param {object} deps
 * @param {import('./ThreadManager').ThreadManager} deps.manager
 * @param {string} deps.sourceThreadId
 * @param {number|string|null} [deps.sourceExchangeId]
 * @param {string} [deps.requestedFrom]
 * @returns {Promise<object>}
 */
async function createPendingForkThread({
  manager,
  sourceThreadId,
  sourceExchangeId = null,
  requestedFrom = 'composer-fork-button',
}) {
  if (!manager?.workspaceId) {
    throw new ThreadForkError('No ThreadManager available', {
      code: 'THREAD_FORK_NO_MANAGER',
      recoverable: false,
    });
  }
  if (!sourceThreadId) {
    throw new ThreadForkError('Source thread is required', {
      code: 'THREAD_FORK_SOURCE_REQUIRED',
      recoverable: false,
    });
  }

  assertSourceThreadIdle(manager, sourceThreadId);

  const db = getDb();
  const now = Date.now();
  const requestedAt = new Date(now).toISOString();
  const forkThreadId = generateThreadId();

  const result = await db.transaction(async (trx) => {
    const sourceRow = await trx('threads')
      .where({
        thread_id: sourceThreadId,
        workspace_id: manager.workspaceId,
        scope: SCOPE,
      })
      .first();

    if (!sourceRow) {
      throw new ThreadForkError(`Source thread not found: ${sourceThreadId}`, {
        code: 'THREAD_FORK_SOURCE_NOT_FOUND',
        recoverable: false,
      });
    }
    if (sourceRow.harness_id !== FORK_HARNESS_ID) {
      throw new ThreadForkError('Fork requires an OpenCode thread', {
        code: 'THREAD_FORK_NON_OPENCODE',
        recoverable: true,
      });
    }

    const sourceHarnessConfig = parseHarnessConfig(sourceRow);
    const sourceOpenCodeSessionId = sourceHarnessConfig.opencodeSessionId;
    if (!sourceOpenCodeSessionId) {
      throw new ThreadForkError('Source thread has no OpenCode session to fork', {
        code: 'THREAD_FORK_MISSING_SOURCE_SESSION',
        recoverable: true,
      });
    }

    let sourceExchangeRow = null;
    if (sourceExchangeId !== null && sourceExchangeId !== undefined) {
      sourceExchangeRow = await trx('exchanges')
        .where({
          id: sourceExchangeId,
          thread_id: sourceThreadId,
        })
        .first();
      if (!sourceExchangeRow) {
        throw new ThreadForkError(`Source exchange not found: ${sourceExchangeId}`, {
          code: 'THREAD_FORK_SOURCE_EXCHANGE_NOT_FOUND',
          recoverable: false,
        });
      }
    } else {
      sourceExchangeRow = await trx('exchanges')
        .where('thread_id', sourceThreadId)
        .orderBy('seq', 'desc')
        .first();
    }

    const sourceExchangeSeq = sourceExchangeRow?.seq ?? null;
    const sourceExchangeIdForProvenance = sourceExchangeRow?.id ?? null;
    const sourceDisplayName = resolveDisplayName(sourceThreadId, sourceRow.name);
    const forkName = `Fork: ${sourceDisplayName}`;

    const sourceExchangeRowsQuery = trx('exchanges')
      .where('thread_id', sourceThreadId)
      .orderBy('seq', 'asc');
    if (sourceExchangeSeq !== null) {
      sourceExchangeRowsQuery.where('seq', '<=', sourceExchangeSeq);
    }
    const sourceExchangeRows = await sourceExchangeRowsQuery;
    const messageCount = resolveCopiedMessageCount(sourceRow, sourceExchangeRows);
    const pendingFork = {
      type: 'opencode-current-head',
      status: 'pending',
      sourceThreadId,
      sourceThreadName: sourceDisplayName,
      sourceExchangeId: sourceExchangeIdForProvenance,
      sourceExchangeSeq,
      sourceOpenCodeSessionId,
      requestedAt,
      requestedFrom,
    };
    const harnessConfig = {
      pendingFork,
      forkProvenance: {
        ...pendingFork,
        status: 'pending',
        forkThreadId,
      },
    };

    await trx('threads').insert({
      thread_id: forkThreadId,
      workspace_id: manager.workspaceId,
      project_id: manager.projectId || null,
      scope: SCOPE,
      view_id: null,
      name: forkName,
      created_at: requestedAt,
      message_count: messageCount,
      status: 'suspended',
      updated_at: now,
      harness_id: FORK_HARNESS_ID,
      harness_config: JSON.stringify(harnessConfig),
    });

    if (sourceExchangeRows.length > 0) {
      await trx('exchanges').insert(sourceExchangeRows.map((row) => ({
        thread_id: forkThreadId,
        seq: row.seq,
        ts: row.ts,
        user_input: row.user_input,
        assistant: row.assistant,
        metadata: row.metadata,
      })));
    }

    return {
      forkThreadId,
      forkName,
      pendingFork,
      messageCount,
      sourceExchangeRows,
    };
  });

  await writeForkChatFile(manager, result.forkThreadId, result.forkName, result.sourceExchangeRows);

  const threadEntry = await manager.index.get(result.forkThreadId);
  const exchanges = await readForkHistory(result.forkThreadId);

  return {
    threadId: result.forkThreadId,
    thread: threadEntry,
    exchanges,
    fork: result.pendingFork,
  };
}

module.exports = {
  ThreadForkError,
  createPendingForkThread,
};
