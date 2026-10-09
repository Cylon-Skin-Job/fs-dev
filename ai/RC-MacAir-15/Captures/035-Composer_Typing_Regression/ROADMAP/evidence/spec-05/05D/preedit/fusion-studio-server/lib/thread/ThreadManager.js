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
const { ChatlogMirror } = require('./chatlog-mirror');
const { HistoryFile } = require('./HistoryFile');
const { SessionLifecycle } = require('./session-lifecycle');
const { createGroup, deleteSingleSession } = require('../thread-groups/session-transactions');
const { SessionManager } = require('./session-manager');
const { RUNTIME_STATES, threadRuntimeManager } = require('./thread-runtime-manager');
const { getDb } = require('../db');
const repository = require('../thread-groups/repository');
const { groupMutationLeaseKey, withGroupMutationLease } = require('../thread-groups/group-mutation-lease');
const { createThreadGroupService } = require('../thread-groups/service');
const {
  buildWorksurfaceCleanupKey,
  consumePendingWorksurfaceCleanup,
  consumeWorksurfaceCleanupForGroup,
} = require('../thread-groups/worksurface-cleanup');
const {
  consumePendingPlacementOutbox,
  consumePlacementOutboxForGroup,
} = require('../thread-groups/placement-delivery');
const { runStableViewIdPreflight } = require('../views/stable-view-id-preflight');

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
    this.threadGroups = createThreadGroupService({
      workspaceId: this.workspaceId, projectRoot: this.projectRoot,
      operations: {
        ensureGroupsActivated: (...args) => this.ensureGroupsActivated(...args),
        getThread: (...args) => this.getThread(...args),
        renameThread: (...args) => this.renameThread(...args),
        updateHarnessConfig: (...args) => this.updateHarnessConfig(...args),
        isMemberBusy: (...args) => this.isMemberBusy(...args),
        stageNewSession: (...args) => this.stageNewSession(...args),
        ensureSessionMirror: (...args) => this.ensureSessionMirror(...args),
        deleteGroup: (...args) => this._deleteGroupWithinLease(...args),
        retryMirrorCleanupForGroup: (...args) => this.retryMirrorCleanupForGroup(...args),
        retryWorksurfaceCleanupForGroup: (...args) => this.retryWorksurfaceCleanupForGroup(...args),
        retryPlacementDeliveryForGroup: (...args) => this.retryPlacementDeliveryForGroup(...args),
      },
    });
    this._groupsActivationPromise = null;
  }

  get sessionLifecycle() {
    if (!this._sessionLifecycle) {
      this._sessionLifecycle = new SessionLifecycle({
        workspaceId: this.workspaceId, projectId: this.projectId,
        projectRoot: this.projectRoot, index: this.index, sessionManager: this.sessionManager,
        mirror: this.chatlogMirror,
      });
    }
    return this._sessionLifecycle;
  }

  get chatlogMirror() {
    if (!this._chatlogMirror) this._chatlogMirror = new ChatlogMirror({
      workspaceId: this.workspaceId, projectRoot: this.projectRoot, getDb,
      getThread: (id) => this.index.get(id), readHistory: (id) => this.getRichHistory(id),
    });
    return this._chatlogMirror;
  }

  /**
   * Build the machine-scoped chatlog mirror directory. SQLite is durable chat
   * storage; these markdown files are repo-local audit/export mirrors.
   *
   * @returns {string}
   */
  _getChatlogThreadsDir() {
    return this.chatlogMirror.directory();
  }

  /**
   * Create a ChatFile for the given thread. _getChatlogThreadsDir() is now
   * guaranteed non-null by the constructor's projectRoot check.
   * @param {string} threadId
   * @returns {ChatFile}
   */
  _createChatFile(threadId) {
    return this.chatlogMirror.file(threadId);
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
    return this.chatlogMirror.key(threadId);
  }

  /**
   * ThreadManager-owned durable session/mirror creation boundary for an
   * existing group (`SPEC-04 §5` step 4). The Thread Group Move transaction
   * invokes this with its transaction handle so the new Main Chat session row
   * and its recoverable mirror instruction commit atomically with the group
   * transition. The group service never clones session-limit, harness-config,
   * or mirror rules.
   *
   * The session row keeps the accepted `view_id: null` convention: the group
   * owns the view binding and the `thread:action:completed` envelope carries
   * it, so a member session row never re-owns the view (R4).
   *
   * @param {object} trx active transaction handle
   * @param {{ threadId: string, name?: string|null, harnessId: string,
   *           harnessConfig?: object|null, groupId: string }} input
   * @returns {Promise<number>} created-at epoch ms
   */
  async stageNewSession(trx, input) {
    return this.sessionLifecycle.stageNewSession(trx, input);
  }

  /**
   * Post-commit completion of a staged session mirror. Failure-isolated: the
   * pending mirror-recovery record keeps a failed write retryable on the next
   * activation sweep.
   */
  async ensureSessionMirror(threadId) {
    return this.chatlogMirror.deliver(threadId, 'create');
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
    await createGroup({ db, workspaceId: this.workspaceId, sessions: this.sessionLifecycle },
      threadId, name, options);

    await this.ensureSessionMirror(threadId);

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
    // Cross-store recovery (`SPEC-03 §8`): converge any group deletion whose
    // worksurface cleanup did not apply before the process stopped. This is
    // independent of the manager-owned transcript-mirror journal.
    try {
      await this._retryPendingWorksurfaceCleanup();
    } catch (_error) {
      // A sweep-read failure must not block group activation; the unapplied
      // instruction stays durable and retryable.
    }
    // SPEC-04 §7: recover committed Move placements that had not yet been
    // materialized into the view-state lane when the process stopped. The
    // committed group transition is already durable; delivery is idempotent.
    try {
      await this._retryPendingPlacementDelivery();
    } catch (_error) {
      // The unapplied instruction stays durable and retryable.
    }
    await this._reconcileRetiredMirrors();
    return { ok: true, diagnostics: [] };
  }

  /**
   * Remove generated Markdown mirrors for thread/exchange pairs the authorized
   * migration retirement branch removed. Only bounded recorded IDs are used;
   * the sweep is idempotent and never touches SQLite or user files.
   */
  async _reconcileRetiredMirrors() {
    return this.chatlogMirror.reconcileRetired();
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
      await this.chatlogMirror.stage(trx, { threadId, groupId: threadId, operation: 'create' });
    });
  }

  async _retryPendingMirrorRecovery() {
    return this.chatlogMirror.recover();
  }

  /**
   * Restart/recovery sweep for the durable worksurface-cleanup outbox
   * (`SPEC-03 §8`). Drains every unapplied instruction for this exact
   * workspace; each delivery is failure-isolated and remains retryable.
   */
  async _retryPendingWorksurfaceCleanup() {
    return consumePendingWorksurfaceCleanup(getDb(), {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
    });
  }

  /**
   * Explicit retry for one deleted group's unapplied cleanup instruction.
   * Repeated delivery after success is harmless: an applied instruction is
   * never re-run and removing an already-absent entry is an acknowledged no-op.
   */
  async retryWorksurfaceCleanupForGroup(groupId) {
    return consumeWorksurfaceCleanupForGroup(getDb(), {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      groupId,
    });
  }

  /**
   * Restart/recovery sweep for the durable Side Chat placement outbox
   * (`SPEC-04 §7`). Each delivery is failure-isolated and remains retryable.
   */
  async _retryPendingPlacementDelivery() {
    return consumePendingPlacementOutbox(getDb(), {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
    });
  }

  /**
   * Explicit retry of one committed Move's placement delivery. Repeated
   * delivery acknowledges/focuses the existing placement and creates no
   * duplicate; it never rolls back the group transition.
   */
  async retryPlacementDeliveryForGroup(groupId) {
    return consumePlacementOutboxForGroup(getDb(), {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      groupId,
    });
  }

  /**
   * Public bounded busy check for one member session (`SPEC-04 §4/§9`). A
   * merely warm provider is idle; an accepting, in-flight, draining, or
   * stopping lifecycle is busy and Move must fail inertly.
   */
  isMemberBusy(threadId) {
    return this._groupMemberBusy(threadId);
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

    await this.chatlogMirror.rename(threadId, newName);

    return { threadId, entry };
  }

  /**
   * Delete a thread (hard delete)
   * @param {string} threadId
   */
  async deleteThread(threadId) {
    const db = getDb();
    const retired = await deleteSingleSession({
      db, workspaceId: this.workspaceId, sessions: this.sessionLifecycle,
      closeSession: (id) => this.closeSession(id),
    }, threadId);
    if (!retired) return false;
    await this.chatlogMirror.deliver(threadId, 'delete');

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
    return threadRuntimeManager.getResourceBusyState(this._resourceRuntimeKey(threadId));
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
    await threadRuntimeManager.retireResourceDrains(resourceKey);
    if (this.sessionManager.getSession(threadId)) await this.closeSessionAndWait(threadId);
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
  async deleteGroup(groupId, options = {}) {
    return withGroupMutationLease(groupMutationLeaseKey(this.workspaceId, groupId),
      () => this._deleteGroupWithinLease(groupId, options));
  }

  async _deleteGroupWithinLease(groupId, { tombstoneExpiresAt = null, context = null } = {}) {
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
    const viewId = projection?.viewId ?? null;
    const cleanup = {
      status: 'pending',
      mirrors: memberRecords.map((member) => ({
        threadId: member.threadId,
        mirrorKey: member.mirrorKey,
        status: 'pending',
        failureCode: null,
      })),
    };
    // A view-bound group records exactly one durable worksurface-cleanup
    // instruction in the same transaction as the group deletion/tombstone.
    // Legacy groups (`viewId: null`) own no worksurface and create no record.
    const viewStateCleanup = viewId
      ? { status: 'pending', attempts: 0 }
      : { status: 'not_applicable', attempts: 0 };
    const result = {
      action: 'delete',
      threadGroupId: groupId,
      threadId: projection?.currentPrimaryThreadId ?? memberRecords[0]?.threadId ?? null,
      workspaceId: this.workspaceId,
      viewId,
      members: memberRecords,
      deleted: true,
      cleanup,
      viewStateCleanup,
      context: context || null,
    };
    const expiresAt = Number.isFinite(tombstoneExpiresAt) && tombstoneExpiresAt > now
      ? tombstoneExpiresAt
      : now + DEFAULT_DELETE_TOMBSTONE_TTL_MS;

    await db.transaction(async (trx) => {
      const current = await repository.getGroup(trx, groupId);
      const currentMembers = await repository.listMembers(trx, groupId);
      if (!current || current.workspace_id !== this.workspaceId
        || currentMembers.length !== members.length
        || currentMembers.some((row) => !members.some((member) => member.thread_id === row.thread_id))) {
        throw new Error('Group membership changed before deletion');
      }
      for (const member of memberRecords) {
        await this.chatlogMirror.stage(trx, { threadId: member.threadId, groupId, operation: 'delete' });
      }
      if (viewId) {
        await repository.insertWorksurfaceCleanup(trx, {
          idempotencyKey: buildWorksurfaceCleanupKey({
            workspaceId: this.workspaceId,
            viewId,
            threadGroupId: groupId,
          }),
          workspaceId: this.workspaceId,
          viewId,
          groupId,
          status: 'pending',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        });
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
      await this.sessionLifecycle.deleteRows(trx, memberRecords.map((member) => member.threadId));
      await repository.deleteGroup(trx, groupId);
    });

    // Post-commit cross-store delivery. Failure-isolated: the group deletion is
    // committed and success-shaped regardless; a failure leaves the instruction
    // observable/retryable and never rolls back.
    let committedViewStateCleanup = viewStateCleanup;
    if (viewId) {
      try {
        committedViewStateCleanup = await this.retryWorksurfaceCleanupForGroup(groupId);
      } catch (_error) {
        committedViewStateCleanup = { status: 'failed', attempts: 0, failureCode: 'view_state_unavailable' };
      }
    }

    return {
      deleted: true,
      result: { ...result, viewStateCleanup: committedViewStateCleanup },
      members: memberRecords,
    };
  }

  /**
   * Resume idempotent mirror cleanup for one deleted group by replaying the
   * workspace pending-delete instructions. Used by new-request recovery and by
   * startup/workspace reattach.
   */
  async retryMirrorCleanupForGroup(groupId) {
    return this.chatlogMirror.recover(groupId);
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
    return this.chatlogMirror.sync(threadId);
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
    return this.sessionLifecycle.openSession(threadId, wireProcess, ws, options);
  }

  /**
   * Close a session (kill process, mark suspended)
   * @param {string} threadId
   */
  async closeSession(threadId, options = {}) {
    return this.sessionLifecycle.closeSession(threadId, options);
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
  async shutdownSessions(options = {}) {
    return this.sessionLifecycle.shutdownSessions(options);
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
    return this.sessionLifecycle.completeStoppedSession(threadId, expectedWire);
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
  async _enforceSessionLimit(options = {}) {
    return this.sessionLifecycle.enforceCapacity(options);
  }


}

module.exports = { ThreadManager };
