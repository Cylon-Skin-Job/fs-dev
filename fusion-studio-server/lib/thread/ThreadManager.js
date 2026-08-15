/**
 * ThreadManager - Workspace thread orchestrator
 *
 * One ThreadManager instance is bound to one workspace. All threads are
 * workspace-scoped (the single project/workspace chat paradigm, RCC-0095);
 * the previous per-view thread scope has been removed.
 *
 * Combines ThreadIndex (SQLite metadata) and ChatFile (generated markdown
 * mirrors) to provide full thread lifecycle management. Delegates session
 * management to SessionManager. Handles session lifecycle:
 * active → grace-period → suspended.
 */

const path = require('path');
const { ThreadIndex } = require('./ThreadIndex');
const { ChatFile } = require('./ChatFile');
const { HistoryFile } = require('./HistoryFile');
const { SessionManager } = require('./session-manager');
const aiPaths = require('../workspace/ai-paths');

function asPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function assistantTextFromParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part) => part?.type === 'text' && typeof part.content === 'string')
    .map((part) => part.content)
    .join('');
}

function hasToolCallsFromParts(parts) {
  return Array.isArray(parts) && parts.some((part) => part?.type === 'tool_call');
}

function withChatMirrorMetadata(threadId, exchange) {
  const metadata = { ...asPlainObject(exchange.metadata) };
  const existingMirror = asPlainObject(metadata.chatMirror);
  const turnId = metadata.turnId || existingMirror.turnId || null;

  if (turnId && metadata.turnId === undefined) {
    metadata.turnId = turnId;
  }

  metadata.chatMirror = {
    ...existingMirror,
    threadId,
    exchangeId: exchange.exchangeId,
    seq: exchange.seq,
    turnId,
  };

  return metadata;
}

function buildChatlogMessagesFromExchanges(threadId, exchanges) {
  return exchanges.flatMap((exchange) => {
    const parts = Array.isArray(exchange.assistant?.parts) ? exchange.assistant.parts : [];
    return [
      {
        role: 'user',
        content: exchange.user || '',
        hasToolCalls: false,
      },
      {
        role: 'assistant',
        content: assistantTextFromParts(parts),
        hasToolCalls: hasToolCallsFromParts(parts),
        metadata: withChatMirrorMetadata(threadId, exchange),
      },
    ];
  });
}

// Default configuration
const DEFAULT_CONFIG = {
  maxActiveSessions: 10,
  idleTimeoutMinutes: 9
};

class ThreadManager {
  /**
   * @param {object} config
   * @param {string} config.projectRoot - Absolute project root path (required)
   * @param {string} [config.workspaceId] - Workspace identifier (workspaces.id); falls back to basename(projectRoot)
   * @param {number} [config.maxActiveSessions]
   * @param {number} [config.idleTimeoutMinutes]
   */
  constructor(config = {}) {
    if (!config.projectRoot) {
      throw new Error('ThreadManager: projectRoot is required');
    }

    this.projectRoot = config.projectRoot;
    this.projectId = path.basename(this.projectRoot);
    this.workspaceId = config.workspaceId || this.projectId;
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {ThreadIndex} */
    this.index = new ThreadIndex(this.workspaceId);

    /** @type {SessionManager} */
    this.sessionManager = new SessionManager(
      {
        maxActiveSessions: this.config.maxActiveSessions,
        idleTimeoutMinutes: this.config.idleTimeoutMinutes
      },
      (threadId) => this.index.suspend(threadId)
    );
  }

  /**
   * Build the machine-scoped chatlog mirror directory. SQLite is durable chat
   * storage; these markdown files are repo-local audit/export mirrors.
   *
   * @returns {string}
   */
  _getChatlogThreadsDir() {
    return path.join(aiPaths.getMachineAiRoot(this.projectRoot), 'Data', 'Chatlogs', 'threads');
  }

  /**
   * Create a ChatFile for the given thread. _getChatlogThreadsDir() is now
   * guaranteed non-null by the constructor's projectRoot check.
   * @param {string} threadId
   * @returns {ChatFile}
   */
  _createChatFile(threadId) {
    return new ChatFile({
      chatlogDir: this._getChatlogThreadsDir(),
      threadId,
    });
  }

  /**
   * Initialize the thread manager
   */
  async init() {
    await this.index.init();

    // On startup, mark all threads as suspended
    // (Kimi CLI processes would have been killed by 9min timeout)
    const threads = await this.index.list();
    for (const { threadId, entry } of threads) {
      if (entry.status === 'active') {
        await this.index.suspend(threadId);
      }
    }
  }

  /**
   * Create a new thread
   * @param {string} threadId - Thread ID (should be Kimi session ID)
   * @param {string|null} [name=null]
   * @param {object} [options]
   * @param {string} [options.harnessId='kimi']
   * @param {object} [options.harnessConfig]
   * @returns {Promise<{threadId: string, entry: import('./types').ThreadEntry}>}
   */
  async createThread(threadId, name = null, options = {}) {
    // Check for FIFO eviction
    await this._enforceSessionLimit();

    // Create index entry (SQLite)
    const entry = await this.index.create(threadId, name, {
      ...options,
      projectId: this.projectId, // backward compat
    });

    // Create chat markdown file
    const chatFile = this._createChatFile(threadId);
    await chatFile.write(name, []);

    return { threadId, entry };
  }

  /**
   * Get thread info
   * @param {string} threadId
   */
  async getThread(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;

    // Get the chat file path for this thread
    const chatFile = this._createChatFile(threadId);

    return { threadId, entry, filePath: chatFile.filePath };
  }

  /**
   * Merge and persist per-thread harness configuration.
   * @param {string} threadId
   * @param {object} patch
   */
  async updateHarnessConfig(threadId, patch) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;

    const harnessConfig = { ...(entry.harnessConfig || {}), ...patch };
    return this.index.update(threadId, { harnessConfig });
  }

  /**
   * List all threads (MRU order)
   * @returns {Promise<Array<{threadId: string, entry: import('./types').ThreadEntry}>>}
   */
  async listThreads() {
    return this.index.list();
  }

  /**
   * Rename a thread
   * @param {string} threadId
   * @param {string} newName
   */
  async renameThread(threadId, newName) {
    const oldEntry = await this.index.get(threadId);
    if (!oldEntry) return null;

    const entry = await this.index.rename(threadId, newName);
    if (!entry) return null;

    // Rewrite the frontmatter name in place — filename is immutable in SPEC-24b.
    const chatFile = this._createChatFile(threadId);
    const parsed = await chatFile.read();
    if (parsed) {
      await chatFile.write(newName, parsed.messages);
    }
    // If parsed is null (file doesn't exist yet), there's nothing to rewrite.
    // SQLite has the name either way — the file will pick it up on first write.

    return { threadId, entry };
  }

  /**
   * Delete a thread (hard delete)
   * @param {string} threadId
   */
  async deleteThread(threadId) {
    // Kill active session if any
    await this.closeSession(threadId);

    // Remove from index (CASCADE deletes exchanges)
    const deleted = await this.index.delete(threadId);
    if (!deleted) return false;

    // Remove the markdown file. Filename is ${threadId}.md — no need to fetch
    // the entry or look up the name.
    const fsPromises = require('fs').promises;
    try {
      const chatFile = this._createChatFile(threadId);
      await fsPromises.rm(chatFile.filePath, { force: true });
    } catch (err) {
      // ENOENT is fine — file may not exist yet for zero-message threads
      if (err.code !== 'ENOENT') {
        console.error(`Failed to delete chat file for ${threadId}:`, err);
      }
    }

    return true;
  }

  /**
   * Record visible message activity for a thread.
   *
   * SQLite exchanges are the durable history. Markdown mirrors are generated
   * from SQLite after completed turns; this method only maintains thread
   * metadata used by lists and live UI state.
   *
   * @param {string} threadId
   * @param {import('./types').ChatMessage} message
   */
  async addMessage(threadId, message) {
    const entry = await this.index.get(threadId);
    if (!entry) throw new Error(`Thread not found: ${threadId}`);

    // Update message count
    await this.index.incrementMessageCount(threadId);

    // Move to front of MRU
    await this.index.touch(threadId);

    return { threadId, messageCount: entry.messageCount + 1 };
  }

  /**
   * Get thread history — returns { name, messages } from the markdown file.
   * @param {string} threadId
   * @returns {Promise<import('./types').ParsedChat|null>}
   */
  async getHistory(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;
    const chatFile = this._createChatFile(threadId);
    return chatFile.read();
  }

  /**
   * Get rich thread history (SQLite exchanges)
   * @param {string} threadId
   * @returns {Promise<object|null>}
   */
  async getRichHistory(threadId) {
    const historyFile = new HistoryFile(threadId);
    return historyFile.read();
  }

  /**
   * Regenerate the markdown mirror from SQLite exchange history.
   *
   * The mirror is a disposable export/audit artifact. SQLite exchanges are the
   * authority; this method overwrites the primary machine-scoped markdown file
   * from SQLite.
   *
   * @param {string} threadId
   * @returns {Promise<{updated: boolean, written: number, reason: string}>}
   */
  async syncChatlogMirrorFromHistory(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry) {
      return { updated: false, written: 0, reason: 'thread-not-found' };
    }

    const history = await this.getRichHistory(threadId);
    const exchanges = Array.isArray(history?.exchanges) ? history.exchanges : [];
    const expectedMessages = buildChatlogMessagesFromExchanges(threadId, exchanges);
    const chatFile = this._createChatFile(threadId);
    await chatFile.write(entry.name, expectedMessages);
    return {
      updated: true,
      written: expectedMessages.length,
      reason: exchanges.length > 0 ? 'rewritten-from-sqlite' : 'empty',
    };
  }

  /**
   * Correct thread metadata after a durable exchange save.
   * @param {string} threadId
   * @param {number} seq
   */
  async recordSavedExchange(threadId, seq) {
    const messageCount = Math.max(0, Number(seq) || 0) * 2;
    await this.index.update(threadId, {
      messageCount,
      updatedAt: Date.now(),
    });
    return { threadId, messageCount };
  }

  // ── Session delegation (preserves public API) ──

  /**
   * Register an active session
   * @param {string} threadId
   * @param {import('child_process').ChildProcess} wireProcess
   * @param {import('ws').WebSocket} [ws]
   */
  async openSession(threadId, wireProcess, ws = null) {
    // Check for FIFO eviction
    await this._enforceSessionLimit();

    // Mark as active in index
    await this.index.activate(threadId);
    await this.index.markResumed(threadId);

    // Delegate session state to SessionManager. The second arg is the retired
    // viewId slot; SessionManager stores it but never reads it.
    const session = this.sessionManager.openSession(threadId, null, wireProcess, ws);

    return session;
  }

  /**
   * Close a session (kill process, mark suspended)
   * @param {string} threadId
   */
  async closeSession(threadId) {
    const closed = this.sessionManager.closeSession(threadId);
    if (!closed) return false;

    // Mark as suspended in index
    await this.index.suspend(threadId);
    return true;
  }

  /**
   * Get active session
   * @param {string} threadId
   * @returns {import('./types').ThreadSession|undefined}
   */
  getSession(threadId) {
    return this.sessionManager.getSession(threadId);
  }

  /**
   * Update session activity (reset idle timer)
   * @param {string} threadId
   */
  touchSession(threadId) {
    this.sessionManager.touchSession(threadId);
  }

  /**
   * Update session WebSocket
   * @param {string} threadId
   * @param {import('ws').WebSocket} ws
   */
  attachWebSocket(threadId, ws) {
    this.sessionManager.attachWebSocket(threadId, ws);
  }

  /**
   * Remove WebSocket from session
   * @param {string} threadId
   */
  detachWebSocket(threadId) {
    this.sessionManager.detachWebSocket(threadId);
  }

  /**
   * Check if thread is currently active
   * @param {string} threadId
   */
  isActive(threadId) {
    return this.sessionManager.isActive(threadId);
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount() {
    return this.sessionManager.getActiveSessionCount();
  }

  /**
   * Enforce max active sessions limit (FIFO eviction)
   * @private
   */
  async _enforceSessionLimit() {
    if (this.sessionManager.getActiveSessionCount() >= this.sessionManager.maxActiveSessions) {
      // Find oldest active session by MRU order (last in list = least recently used)
      const threads = await this.index.list();
      const activeThreads = threads.filter(t => this.sessionManager.isActive(t.threadId));
      const oldest = activeThreads[activeThreads.length - 1];
      if (oldest) {
        console.log(`[ThreadManager] LRU eviction: closing ${oldest.threadId}`);
        await this.closeSession(oldest.threadId);
      }
    }
  }

}

module.exports = { ThreadManager };
