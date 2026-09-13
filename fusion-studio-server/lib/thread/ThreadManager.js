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
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const aiPaths = require('../workspace/ai-paths');
const { getDb } = require('../db');
const repository = require('../thread-groups/repository');
const { createThreadGroupService } = require('../thread-groups/service');
const { runStableViewIdPreflight } = require('../views/stable-view-id-preflight');

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

// Bounded recovery window for a deleted group's cleanup tombstone. Durable
// action results survive independently, so replay of an already-recorded
// request keeps working after tombstone expiry (`SPEC-01 §9`).
const DEFAULT_DELETE_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

    /** @type {import('../thread-groups/service').ThreadGroupService} */
    this.threadGroups = createThreadGroupService({ manager: this });
    this._groupsActivationPromise = null;
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

  /** Deterministic, bounded mirror identity for the mirror-recovery record. */
  _mirrorKey(threadId) {
    return `chatlog:${threadId}`;
  }

  async _insertSessionRow(trx, threadId, name, options = {}) {
    const createdAt = new Date().toISOString();
    await trx('threads').insert({
      thread_id: threadId,
      workspace_id: this.workspaceId,
      project_id: options.projectId || this.projectId || null,
      scope: 'project',
      view_id: null,
      name,
      created_at: createdAt,
      message_count: 0,
      status: 'suspended',
      updated_at: Date.now(),
      harness_id: options.harnessId || 'kimi',
      harness_config: options.harnessConfig ? JSON.stringify(options.harnessConfig) : null,
    });
    return createdAt;
  }

  /**
   * Create a new thread and its one-member Thread Group in one transaction.
   *
   * The Thread Group service supplies the group identity/view/action intent;
   * this primitive owns the session row and the mirror instruction so the
   * group service never clones ThreadManager's session/mirror rules.
   *
   * @param {string} threadId
   * @param {string|null} [name=null]
   * @param {object} [options]
   * @returns {Promise<{threadId: string, entry: import('./types').ThreadEntry}>}
   */
  async createThread(threadId, name = null, options = {}) {
    // Check for FIFO eviction
    await this._enforceSessionLimit();

    const db = getDb();
    const now = Date.now();
    const groupId = options.groupId || threadId;
    const viewId = options.viewId === undefined ? null : options.viewId;
    const mirrorKey = this._mirrorKey(threadId);

    await db.transaction(async (trx) => {
      const createdAt = await this._insertSessionRow(trx, threadId, name, options);
      const createdAtMs = repository.epochFromIso(createdAt, now);
      await repository.insertGroup(trx, {
        groupId,
        workspaceId: this.workspaceId,
        viewId,
        name,
        currentPrimaryThreadId: threadId,
        createdAt: createdAtMs,
        updatedAt: now,
      });
      await repository.insertMember(trx, {
        groupId,
        threadId,
        ordinal: 1,
        originKind: 'initial',
        joinedAt: createdAtMs,
      });
      await repository.insertPrimaryEvent(trx, {
        groupId,
        sequence: 1,
        previousThreadId: null,
        nextThreadId: threadId,
        reason: 'initial',
        occurredAt: createdAtMs,
      });
      await repository.insertActivityEvent(trx, {
        eventKey: `initial:${groupId}`,
        groupId,
        threadId,
        turnId: null,
        kind: 'initial',
        occurredAt: createdAtMs,
      });
      await repository.insertMirrorRecovery(trx, {
        workspaceId: this.workspaceId,
        groupId,
        threadId,
        mirrorKey,
        operation: 'create',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      if (options.requestId && options.action) {
        await repository.insertActionResult(trx, {
          workspaceId: this.workspaceId,
          requestId: options.requestId,
          action: options.action,
          targetHash: options.targetHash || 'creation',
          resultJson: JSON.stringify(options.actionResult || { threadId, threadGroupId: groupId }),
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    // Mirror creation is a post-commit, recoverable instruction.
    const chatFile = this._createChatFile(threadId);
    try {
      await chatFile.write(name, []);
      await repository.markMirrorRecovery(db, {
        workspaceId: this.workspaceId,
        mirrorKey,
        operation: 'create',
        status: 'complete',
        now: Date.now(),
      });
    } catch (error) {
      console.error(`[ThreadManager] Chat mirror creation failed for ${threadId}:`, error?.message || error);
      await repository.markMirrorRecovery(db, {
        workspaceId: this.workspaceId,
        mirrorKey,
        operation: 'create',
        status: 'failed',
        failureCode: 'mirror_write_failed',
        now: Date.now(),
      });
    }

    const entry = await this.index.get(threadId);
    return { threadId, entry };
  }

  /**
   * Idempotent preflight + group reconciliation. Runs the stable view-ID
   * preflight and, only when it succeeds, binds every remaining ungrouped
   * session to exactly one group. No group-backed list is exposed before this
   * succeeds (`SPEC-01 §6`).
   */
  async ensureGroupsActivated() {
    if (!this._groupsActivationPromise) {
      this._groupsActivationPromise = this._activateGroups().catch((error) => {
        this._groupsActivationPromise = null;
        throw error;
      });
    }
    return this._groupsActivationPromise;
  }

  async _activateGroups() {
    const preflight = runStableViewIdPreflight(this.projectRoot);
    if (!preflight.ok) {
      return { ok: false, diagnostics: preflight.diagnostics };
    }
    // `init()` is owned by the manager registry at manager creation; calling it
    // here would re-suspend every active row on first activation.

    const db = getDb();
    const allowed = new Set(preflight.viewIds);
    const ungrouped = await repository.listThreadIdsWithoutGroup(db, this.workspaceId);
    for (const row of ungrouped) {
      const resolvedViewId = typeof row.view_id === 'string' && allowed.has(row.view_id)
        ? row.view_id
        : null;
      await this._attachGroupToSession({
        threadId: row.thread_id,
        name: row.name,
        viewId: resolvedViewId,
        createdAt: repository.epochFromIso(row.created_at, Date.now()),
        updatedAt: Number(row.updated_at) || Date.now(),
      });
    }
    await this._retryPendingMirrorRecovery();
    await this._reconcileRetiredMirrors();
    return { ok: true, diagnostics: [] };
  }

  /**
   * Remove generated Markdown mirrors for thread/exchange pairs the authorized
   * migration retirement branch removed. Only bounded recorded IDs are used;
   * the sweep is idempotent and never touches SQLite or user files.
   */
  async _reconcileRetiredMirrors() {
    const db = getDb();
    const record = await db('system_config')
      .where('key', 'thread_group.retirement.041')
      .first();
    if (!record) return;
    let parsed;
    try {
      parsed = JSON.parse(record.value);
    } catch {
      return;
    }
    const threadIds = Array.isArray(parsed?.threadIds) ? parsed.threadIds.slice(0, 100) : [];
    const fsPromises = require('fs').promises;
    for (const threadId of threadIds) {
      if (typeof threadId !== 'string' || !threadId) continue;
      const chatFile = this._createChatFile(threadId);
      await fsPromises.rm(chatFile.filePath, { force: true }).catch(() => {});
    }
  }

  async _attachGroupToSession({ threadId, name, viewId, createdAt, updatedAt }) {
    const db = getDb();
    const now = Date.now();
    await db.transaction(async (trx) => {
      const existing = await repository.getGroupForThread(trx, threadId);
      if (existing) return;
      await repository.insertGroup(trx, {
        groupId: threadId,
        workspaceId: this.workspaceId,
        viewId,
        name: name ?? null,
        currentPrimaryThreadId: threadId,
        createdAt,
        updatedAt,
      });
      await repository.insertMember(trx, {
        groupId: threadId,
        threadId,
        ordinal: 1,
        originKind: 'initial',
        joinedAt: createdAt,
      });
      await repository.insertPrimaryEvent(trx, {
        groupId: threadId,
        sequence: 1,
        previousThreadId: null,
        nextThreadId: threadId,
        reason: 'initial',
        occurredAt: createdAt,
      });
      await repository.insertActivityEvent(trx, {
        eventKey: `initial:${threadId}`,
        groupId: threadId,
        threadId,
        turnId: null,
        kind: 'initial',
        occurredAt: createdAt,
      });
      await repository.insertMirrorRecovery(trx, {
        workspaceId: this.workspaceId,
        groupId: threadId,
        threadId,
        mirrorKey: this._mirrorKey(threadId),
        operation: 'create',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async _retryPendingMirrorRecovery() {
    const db = getDb();
    const pending = await repository.listPendingMirrorRecovery(db, this.workspaceId);
    const fsPromises = require('fs').promises;
    for (const record of pending) {
      try {
        if (record.operation === 'create') {
          await this.syncChatlogMirrorFromHistory(record.thread_id);
        } else {
          const chatFile = this._createChatFile(record.thread_id);
          await fsPromises.rm(chatFile.filePath, { force: true });
        }
        await repository.markMirrorRecovery(db, {
          workspaceId: this.workspaceId,
          mirrorKey: record.mirror_key,
          operation: record.operation,
          status: 'complete',
          now: Date.now(),
        });
      } catch (error) {
        await repository.markMirrorRecovery(db, {
          workspaceId: this.workspaceId,
          mirrorKey: record.mirror_key,
          operation: record.operation,
          status: 'failed',
          failureCode: 'mirror_unavailable',
          now: Date.now(),
        });
      }
    }
  }

  /** Group-backed visible population for one exact {workspaceId, viewId}. */
  async listGroups(viewId = null) {
    return this.threadGroups.listGroups({ viewId });
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

    // The group owns the visible title (§9). Keep SQLite's session mirror of
    // the title in sync so legacy reads do not become a second title owner.
    const db = getDb();
    const groupRow = await repository.getGroupForThread(db, threadId);
    if (groupRow) {
      await repository.renameGroup(db, groupRow.group_id, newName);
    }

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
    const db = getDb();
    // A raw session delete must never orphan a group (§5.6). A session belongs
    // to exactly one group; with more than one member (SPEC-04 and later) a
    // raw session delete is rejected and only the group service may retire it.
    const groupRow = await repository.getGroupForThread(db, threadId);
    if (groupRow) {
      const members = await repository.listMembers(db, groupRow.group_id);
      if (members.length > 1) return false;
    }

    // Kill active session if any
    await this.closeSession(threadId);

    const now = Date.now();
    const mirrorKey = this._mirrorKey(threadId);

    // Record every member mirror before canonical rows vanish (§5.5).
    if (groupRow) {
      try {
        await repository.insertMirrorRecovery(db, {
          workspaceId: this.workspaceId,
          groupId: groupRow.group_id,
          threadId,
          mirrorKey,
          operation: 'delete',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
      } catch (_error) {
        // Duplicate delete-recovery record from a retry is benign.
      }
    }

    // Remove from index (CASCADE deletes exchanges)
    const deleted = await this.index.delete(threadId);
    if (!deleted) return false;

    // A raw session delete must never orphan a group (§5.6). 01A groups are
    // one-member, so the whole group retires with its only member.
    if (groupRow) {
      await repository.deleteGroup(db, groupRow.group_id);
    }

    // Remove the markdown file. Filename is ${threadId}.md — no need to fetch
    // the entry or look up the name.
    const fsPromises = require('fs').promises;
    try {
      const chatFile = this._createChatFile(threadId);
      await fsPromises.rm(chatFile.filePath, { force: true });
      if (groupRow) {
        await repository.markMirrorRecovery(db, {
          workspaceId: this.workspaceId,
          mirrorKey,
          operation: 'delete',
          status: 'complete',
          now: Date.now(),
        });
      }
    } catch (err) {
      // ENOENT is fine — file may not exist yet for zero-message threads
      if (err.code !== 'ENOENT') {
        console.error(`Failed to delete chat file for ${threadId}:`, err);
        if (groupRow) {
          await repository.markMirrorRecovery(db, {
            workspaceId: this.workspaceId,
            mirrorKey,
            operation: 'delete',
            status: 'failed',
            failureCode: 'mirror_delete_failed',
            now: Date.now(),
          });
        }
      }
    }

    return true;
  }

  /** Resource-scoped runtime identity (workspace + root + thread, epoch-free). */
  _resourceRuntimeKey(threadId) {
    return {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      threadId,
    };
  }

  /**
   * True when any member runtime generation is mid-operation. A merely warm
   * (READY) provider is idle, not busy: Delete may fence and retire it. Busy is
   * the turn/runtime lifecycle in progress — accepting/warming, an in-flight
   * turn, finalizing/draining, or stopping (`SPEC-01 §9`).
   *
   * @param {string} threadId
   * @returns {string|null} bounded busy state, or null when terminal
   */
  _groupMemberBusy(threadId) {
    const session = this.sessionManager.getSession(threadId);
    if (session?.pendingActivation) return 'accepting';
    if (session?.state === 'stopping') return 'stopping';
    const runtime = threadRuntimeManager.getRuntimeForResource(this._resourceRuntimeKey(threadId));
    if (runtime?.activeDrain) return 'draining';
    if (runtime?.state === RUNTIME_STATES.WARMING) return 'accepting';
    if (runtime?.state === RUNTIME_STATES.IN_FLIGHT) return 'active';
    if (runtime?.state === RUNTIME_STATES.STOPPING) return 'stopping';
    return null;
  }

  /**
   * Fence one exact member resource before its canonical rows vanish: retire
   * any residual drain, terminate the provider, and remove every runtime
   * generation so a late provider/event frame compares-current against a
   * missing record and is dropped rather than appending an exchange or
   * recreating runtime state.
   */
  async _fenceGroupMember(threadId) {
    const resourceKey = this._resourceRuntimeKey(threadId);
    try {
      await threadRuntimeManager.retireResourceDrains(resourceKey);
    } catch (_error) {
      // Provider termination below still owns the hard fence.
    }
    const session = this.sessionManager.getSession(threadId);
    if (session) {
      try {
        await this.closeSessionAndWait(threadId);
      } catch (_error) {
        // A failed provider close must not be treated as a successful fence;
        // the caller still proceeds only after the busy check proved terminal.
      }
    }
    threadRuntimeManager.fenceResource(resourceKey);
  }

  /**
   * Delete one whole Thread Group: session rows (exchanges cascade), the group,
   * members, primary/activity events, plus the durable mirror-deletion and
   * group-cleanup recovery records. The tombstone and mirror instructions are
   * committed in the same transaction, before canonical rows vanish
   * (`SPEC-01 §5.5/§9`).
   *
   * Non-mutating `group_busy` is returned while any member runtime is
   * mid-operation. Unknown groups return `not_found` and never create.
   *
   * @param {string} groupId
   * @param {{ tombstoneExpiresAt?: number, context?: object|null }} [options]
   * @returns {Promise<{deleted: boolean, reason?: string, busy?: Array,
   *   result?: object, members?: Array}>}
   */
  async deleteGroup(groupId, { tombstoneExpiresAt = null, context = null } = {}) {
    const db = getDb();
    const groupRow = await repository.getGroup(db, groupId);
    if (!groupRow || groupRow.workspace_id !== this.workspaceId) {
      return { deleted: false, reason: 'not_found' };
    }
    const members = await repository.listMembers(db, groupId);
    if (members.length === 0) return { deleted: false, reason: 'not_found' };

    const busy = [];
    for (const member of members) {
      const state = this._groupMemberBusy(member.thread_id);
      if (state) busy.push({ threadId: member.thread_id, state });
    }
    if (busy.length > 0) return { deleted: false, reason: 'group_busy', busy };

    for (const member of members) {
      await this._fenceGroupMember(member.thread_id);
    }

    const projection = await repository.getGroupProjection(db, groupId);
    const now = Date.now();
    const memberRecords = members.map((member) => ({
      threadId: member.thread_id,
      mirrorKey: this._mirrorKey(member.thread_id),
    }));
    const cleanup = {
      status: 'pending',
      mirrors: memberRecords.map((member) => ({
        threadId: member.threadId,
        mirrorKey: member.mirrorKey,
        status: 'pending',
        failureCode: null,
      })),
    };
    const result = {
      action: 'delete',
      threadGroupId: groupId,
      threadId: projection?.currentPrimaryThreadId ?? memberRecords[0]?.threadId ?? null,
      workspaceId: this.workspaceId,
      viewId: projection?.viewId ?? null,
      members: memberRecords,
      deleted: true,
      cleanup,
      context: context || null,
    };
    const expiresAt = Number.isFinite(tombstoneExpiresAt) && tombstoneExpiresAt > now
      ? tombstoneExpiresAt
      : now + DEFAULT_DELETE_TOMBSTONE_TTL_MS;

    await db.transaction(async (trx) => {
      for (const member of memberRecords) {
        try {
          await repository.insertMirrorRecovery(trx, {
            workspaceId: this.workspaceId,
            groupId,
            threadId: member.threadId,
            mirrorKey: member.mirrorKey,
            operation: 'delete',
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          });
        } catch (_error) {
          // A duplicate delete-recovery record from a retry is benign.
        }
      }
      await repository.insertDeleteTombstone(trx, {
        groupId,
        workspaceId: this.workspaceId,
        resultJson: JSON.stringify(result),
        cleanupJson: JSON.stringify(cleanup),
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });
      await trx('threads')
        .whereIn('thread_id', memberRecords.map((member) => member.threadId))
        .where('workspace_id', this.workspaceId)
        .del();
      await repository.deleteGroup(trx, groupId);
    });

    return { deleted: true, result, members: memberRecords };
  }

  /**
   * Resume idempotent mirror cleanup for one deleted group by replaying the
   * workspace pending-delete instructions. Used by new-request recovery and by
   * startup/workspace reattach.
   */
  async retryMirrorCleanupForGroup() {
    await this._retryPendingMirrorRecovery();
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
  async openSession(threadId, wireProcess, ws = null, options = {}) {
    // Claim the in-memory provider owner synchronously before metadata awaits
    // or capacity eviction can admit/destroy the wrong provider for the same
    // workspace-scoped thread.
    const previousSession = this.sessionManager.getSession(threadId);
    const activationToken = {};
    let resolveActivation;
    const activationCompletion = new Promise((resolve) => {
      resolveActivation = resolve;
    });
    const session = this.sessionManager.openSession(threadId, null, wireProcess, ws, {
      activationToken,
      activationCompletion,
      workspaceEpoch: options.workspaceEpoch || null,
      projectRoot: this.projectRoot,
    });
    let activationFinished = false;
    const finishActivation = () => {
      if (activationFinished) return;
      activationFinished = true;
      this.sessionManager.finishSessionActivation(threadId, session, activationToken);
      resolveActivation();
    };
    if (!session.threadManagerExitObserverInstalled && typeof wireProcess?.once === 'function') {
      Object.defineProperty(session, 'threadManagerExitObserverInstalled', {
        value: true,
        enumerable: false,
      });
      wireProcess.once('exit', () => {
        const current = this.sessionManager.getSession(threadId);
        if (current !== session || current.wireProcess !== wireProcess) return;
        void this.closeSession(threadId).catch(() => {
          console.error(`[ThreadManager] Provider exit cleanup failed for ${threadId}`);
        });
      });
    }

    try {
      if (previousSession !== session) {
        // A new target is already CAS-owned. Enforce capacity only after that
        // acceptance, excluding the target itself from LRU retirement.
        await this._enforceSessionLimit({ afterSessionClaim: true, excludeThreadId: threadId });
      }
      // Mark as active in index only after the exact provider owner is held.
      await this.index.activate(threadId);
      await this.index.markResumed(threadId);
      if (!this.sessionManager.commitSessionActivation(threadId, session, activationToken)) {
        throw new Error('Thread activation ownership changed');
      }
      finishActivation();
    } catch (error) {
      if (previousSession === session) {
        this.sessionManager.rollbackSessionActivation(threadId, session, activationToken);
      } else if (this.sessionManager.getSession(threadId) === session) {
        // Resolve the activation barrier before waiting on a close that may
        // already be owned by a concurrent workspace retirement.
        finishActivation();
        await this.sessionManager.closeSessionAndWait(threadId);
      }
      finishActivation();
      throw error;
    } finally {
      finishActivation();
    }

    return session;
  }

  /**
   * Close a session (kill process, mark suspended)
   * @param {string} threadId
   */
  async closeSession(threadId, options = {}) {
    const activeSession = this.sessionManager.getSession(threadId);
    const runtimeIdentity = {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      workspaceEpoch: activeSession?.workspaceEpoch || null,
      scope: 'project',
      threadId,
    };
    if (runtimeIdentity.workspaceEpoch) {
      await threadRuntimeManager.retireActiveDrain(runtimeIdentity);
    } else {
      await threadRuntimeManager.retireResourceDrains(runtimeIdentity);
    }
    const closed = await this.sessionManager.closeSessionAndWait(threadId, options);
    if (!closed) return false;

    // Mark as suspended in index
    await this.index.suspend(threadId);
    return true;
  }

  /**
   * Explicit alias for callers whose control flow names the termination wait.
   * All close paths now share the same drain-and-provider quiescence contract.
   *
   * @param {string} threadId
   */
  async closeSessionAndWait(threadId, options = {}) {
    return this.closeSession(threadId, options);
  }

  /**
   * Retire every provider owned by this workspace manager during process
   * shutdown. Providers close concurrently under one bounded shared budget.
   */
  async shutdownSessions({ timeoutMs = 3_000, signal } = {}) {
    if (signal?.aborted) return false;
    const threadIds = [...this.sessionManager.activeSessions.keys()];
    if (threadIds.length === 0) return true;
    const requestedBudget = Math.max(2, Number(timeoutMs) || 3_000);
    // Leave the Phase-A owner a small completion margin after provider exit;
    // the outer owner treats equality with its deadline as a failed drain.
    const budget = Math.max(2, Math.min(2_500,
      requestedBudget > 10 ? requestedBudget - 10 : requestedBudget));
    const providerCloseGraceMs = Math.max(1, Math.floor(budget * 2 / 3));
    const providerCloseForceMs = Math.max(1, budget - providerCloseGraceMs);
    const results = await Promise.allSettled(threadIds.map((threadId) => this.closeSession(threadId, {
      providerCloseGraceMs,
      providerCloseForceMs,
    })));
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    return !signal?.aborted && this.sessionManager.activeSessions.size === 0;
  }

  /**
   * Get active session
   * @param {string} threadId
   * @returns {import('./types').ThreadSession|undefined}
   */
  getSession(threadId) {
    return this.sessionManager.getSession(threadId);
  }

  beginSessionRetirement(threadId, ws) {
    return this.sessionManager.beginSessionRetirement(threadId, ws);
  }

  restoreSessionOwner(threadId, expectedSession, expectedWire, expectedWs, previous) {
    return this.sessionManager.restoreSessionOwner(
      threadId, expectedSession, expectedWire, expectedWs, previous,
    );
  }

  /**
   * Complete a session reserved by Stop after the bound provider control has
   * proved exit. Pending activation metadata must settle before the final
   * suspended write, and the exact wire must still own the reserved session.
   */
  async completeStoppedSession(threadId, expectedWire) {
    const session = this.sessionManager.getSession(threadId);
    if (!session
      || session.state !== 'stopping'
      || !expectedWire
      || session.wireProcess !== expectedWire) return false;
    if (session.pendingActivation?.completion) {
      await session.pendingActivation.completion;
    }
    if (this.sessionManager.getSession(threadId) !== session
      || session.state !== 'stopping'
      || session.wireProcess !== expectedWire) return false;
    await this.index.suspend(threadId);
    return this.sessionManager.completeStoppedSession(threadId, expectedWire);
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
  async _enforceSessionLimit({ afterSessionClaim = false, excludeThreadId = null } = {}) {
    const activeCount = this.sessionManager.getActiveSessionCount();
    const overLimit = afterSessionClaim
      ? activeCount > this.sessionManager.maxActiveSessions
      : activeCount >= this.sessionManager.maxActiveSessions;
    if (overLimit) {
      // Find oldest active session by MRU order (last in list = least recently used)
      const threads = await this.index.list();
      const activeThreads = threads.filter(t => (
        t.threadId !== excludeThreadId && this.sessionManager.isActive(t.threadId)
      ));
      const oldest = activeThreads[activeThreads.length - 1];
      if (oldest) {
        console.log(`[ThreadManager] LRU eviction: closing ${oldest.threadId}`);
        await this.closeSession(oldest.threadId);
      }
    }
  }

}

module.exports = { ThreadManager };
