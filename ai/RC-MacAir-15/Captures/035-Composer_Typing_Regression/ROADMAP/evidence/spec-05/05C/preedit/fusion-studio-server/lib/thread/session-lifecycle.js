'use strict';

// Canonical session lifecycle. Group membership and transaction lifetime stay
// with the group command owner; this owner only stages session rows/journals.
const sessionRepository = require('./session-repository');
const repository = require('../thread-groups/repository');
const { threadRuntimeManager } = require('./thread-runtime-manager');

class SessionLifecycle {
  constructor({ workspaceId, projectId, projectRoot, index, sessionManager, mirror }) {
    Object.assign(this, { workspaceId, projectId, projectRoot, index, sessionManager, mirror });
  }

  async deleteRows(trx, threadIds) {
    return sessionRepository.deleteRows(trx, this.workspaceId, threadIds);
  }

  async stageDeletion(trx, threadId, groupId) {
    await this.mirror.stage(trx, { threadId, groupId, operation: 'delete' });
  }

  async stageNewSession(trx, {
    threadId, name = null, harnessId, harnessConfig = null, groupId = null, projectId = null,
  }) {
    if (!groupId) throw new Error('SessionLifecycle.stageNewSession: groupId is required');
    const now = Date.now();
    const createdAt = await sessionRepository.insertRow(trx, this.workspaceId, threadId, name, {
      projectId: projectId || this.projectId,
      harnessId,
      harnessConfig,
    });
    await this.mirror.stage(trx, { threadId, groupId, operation: 'create' });
    return repository.epochFromIso(createdAt, now);
  }

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
        await this.enforceCapacity({ afterSessionClaim: true, excludeThreadId: threadId });
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
        await this.closeSession(threadId);
      }
      finishActivation();
      throw error;
    } finally {
      finishActivation();
    }

    return session;
  }

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

  async enforceCapacity(options = {}) {
    // Capacity is a serialized policy decision, never a second runtime map.
    const previous = this.capacityTail || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => this._enforceCapacity(options));
    this.capacityTail = operation;
    try { return await operation; }
    finally { if (this.capacityTail === operation) this.capacityTail = null; }
  }

  async _enforceCapacity({ afterSessionClaim = false, excludeThreadId = null } = {}) {
    const limit = this.sessionManager.maxActiveSessions - (afterSessionClaim ? 0 : 1);
    while (this.sessionManager.getActiveSessionCount() > limit) {
      const threads = await this.index.list();
      const candidates = threads.filter(({ threadId }) => {
        const session = this.sessionManager.getSession(threadId);
        // Waiting for another activation here would create an admission cycle.
        return threadId !== excludeThreadId && session?.state === 'active'
          && !session.pendingActivation;
      });
      const oldest = candidates[candidates.length - 1];
      if (!oldest) {
        const error = new Error('Session capacity is busy; retry after activation completes');
        error.code = 'session_capacity';
        throw error;
      }
      await this.closeSession(oldest.threadId);
    }
  }
}

module.exports = { SessionLifecycle };
