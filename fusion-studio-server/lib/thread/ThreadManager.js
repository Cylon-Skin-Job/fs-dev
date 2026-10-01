'use strict';

// Workspace-qualified facade. Domain owners hold policies and transaction lifetimes.
const path = require('path');
const { ThreadIndex } = require('./ThreadIndex');
const { ChatlogMirror } = require('./chatlog-mirror');
const { HistoryFile } = require('./HistoryFile');
const { SessionLifecycle } = require('./session-lifecycle');
const { SessionManager } = require('./session-manager');
const { createGroup, deleteSingleSession } = require('../thread-groups/session-transactions');
const { GroupStartupReconciliation } = require('../thread-groups/startup-reconciliation');
const { deleteGroupWithinLease } = require('../thread-groups/delete-transaction');
const { getDb } = require('../db');
const { SessionMetadata } = require('./session-metadata');
const { groupMutationLeaseKey, withGroupMutationLease } = require('../thread-groups/group-mutation-lease');
const { createThreadGroupService } = require('../thread-groups/service');
const { consumeWorksurfaceCleanupForGroup } = require('../thread-groups/worksurface-cleanup');
const { consumePlacementOutboxForGroup } = require('../thread-groups/placement-delivery');
const DEFAULT_CONFIG = { maxActiveSessions: 10, idleTimeoutMinutes: 9 };

class ThreadManager {
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
        deleteGroup: (...args) => this.deleteWithinLease(...args),
        retryMirrorCleanupForGroup: (...args) => this.retryMirrorCleanupForGroup(...args),
        retryWorksurfaceCleanupForGroup: (...args) => this.retryWorksurfaceCleanupForGroup(...args),
        retryPlacementDeliveryForGroup: (...args) => this.retryPlacementDeliveryForGroup(...args),
      },
    });
  }

  get metadata() {
    if (!this._metadata) this._metadata = new SessionMetadata({ index: this.index, mirror: this.chatlogMirror });
    return this._metadata;
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

  async stageNewSession(trx, input) {
    return this.sessionLifecycle.stageNewSession(trx, input);
  }

  async ensureSessionMirror(threadId) {
    return this.chatlogMirror.deliver(threadId, 'create');
  }

  async createThread(threadId, name = null, options = {}) {
    await this.sessionLifecycle.enforceCapacity();

    const db = getDb();
    await createGroup({ db, workspaceId: this.workspaceId, sessions: this.sessionLifecycle },
      threadId, name, options);

    await this.ensureSessionMirror(threadId);

    const entry = await this.index.get(threadId);
    return { threadId, entry };
  }

  async retryWorksurfaceCleanupForGroup(groupId) {
    return consumeWorksurfaceCleanupForGroup(getDb(), {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      groupId,
    });
  }

  async retryPlacementDeliveryForGroup(groupId) {
    return consumePlacementOutboxForGroup(getDb(), {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      groupId,
    });
  }

  async listGroups(viewId = null) {
    return this.threadGroups.listGroups({ viewId });
  }

  async getThread(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;

    const chatFile = this.chatlogMirror.file(threadId);

    return { threadId, entry, filePath: chatFile.filePath };
  }

  updateHarnessConfig(threadId, patch) { return this.metadata.updateHarnessConfig(threadId, patch); }

  async listThreads() {
    return this.index.list();
  }

  renameThread(threadId, newName) { return this.metadata.renameThread(threadId, newName); }

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

  async retryMirrorCleanupForGroup(groupId) {
    return this.chatlogMirror.recover(groupId);
  }

  addMessage(threadId, message) { return this.metadata.addMessage(threadId, message); }

  async getHistory(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;
    const chatFile = this.chatlogMirror.file(threadId);
    return chatFile.read();
  }

  async getRichHistory(threadId) {
    const historyFile = new HistoryFile(threadId);
    return historyFile.read();
  }

  async syncChatlogMirrorFromHistory(threadId) {
    return this.chatlogMirror.sync(threadId);
  }

  recordSavedExchange(threadId, seq) { return this.metadata.recordSavedExchange(threadId, seq); }

  async openSession(threadId, wireProcess, ws = null, options = {}) {
    return this.sessionLifecycle.openSession(threadId, wireProcess, ws, options);
  }

  async closeSession(threadId, options = {}) {
    return this.sessionLifecycle.closeSession(threadId, options);
  }

  async closeSessionAndWait(threadId, options = {}) {
    return this.closeSession(threadId, options);
  }

  async shutdownSessions(options = {}) {
    return this.sessionLifecycle.shutdownSessions(options);
  }

  getOwnedSessionIds(ws) { return this.sessionManager.getOwnedSessionIds(ws); }

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

  async completeStoppedSession(threadId, expectedWire) {
    return this.sessionLifecycle.completeStoppedSession(threadId, expectedWire);
  }

  reconcileProviderExit(threadId, expectedSession) {
    return this.sessionLifecycle.reconcileProviderExit(threadId, expectedSession);
  }

  touchSession(threadId) {
    this.sessionManager.touchSession(threadId);
  }

  attachWebSocket(threadId, ws) {
    this.sessionManager.attachWebSocket(threadId, ws);
  }

  detachWebSocket(threadId) {
    this.sessionManager.detachWebSocket(threadId);
  }

  isActive(threadId) {
    return this.sessionManager.isActive(threadId);
  }

  getActiveSessionCount() {
    return this.sessionManager.getActiveSessionCount();
  }

  init() { return this.sessionLifecycle.initialize(); }

  ensureGroupsActivated() {
    if (!this.groupStartup) this.groupStartup = new GroupStartupReconciliation({
      workspaceId: this.workspaceId, projectRoot: this.projectRoot, mirror: this.chatlogMirror,
    });
    return this.groupStartup.ensureActivated();
  }

  isMemberBusy(threadId) { return this.sessionLifecycle.memberBusy(threadId); }

  deleteGroup(groupId, options = {}) {
    return withGroupMutationLease(groupMutationLeaseKey(this.workspaceId, groupId),
      () => this.deleteWithinLease(groupId, options));
  }

  deleteWithinLease(groupId, options = {}) {
    return deleteGroupWithinLease({
      workspaceId: this.workspaceId, sessions: this.sessionLifecycle, mirror: this.chatlogMirror,
      retryWorksurfaceCleanup: (id) => this.retryWorksurfaceCleanupForGroup(id),
    }, groupId, options);
  }
}

module.exports = { ThreadManager };
