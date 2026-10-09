'use strict';

// Canonical session lifecycle. Group membership and transaction lifetime stay
// with the group command owner; this owner only stages session rows/journals.
const sessionRepository = require('./session-repository');
const repository = require('../thread-groups/repository');
const { threadRuntimeManager } = require('./thread-runtime-manager');
const { awaitBoundedDrainCompletion } = require('./canonical-drain-context');

class SessionLifecycle {
  constructor({ workspaceId, projectId, projectRoot, index, sessionManager, mirror }) {
    Object.assign(this, { workspaceId, projectId, projectRoot, index, sessionManager, mirror });
  }

  resourceKey(threadId) {
    return {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      threadId,
    };
  }

  memberBusy(threadId) {
    const session = this.sessionManager.getSession(threadId);
    if (session?.pendingActivation) return 'accepting';
    if (session?.state === 'stopping') return 'stopping';
    return threadRuntimeManager.getResourceBusyState(this.resourceKey(threadId));
  }

  async fenceMember(threadId) {
    const resourceKey = this.resourceKey(threadId);
    await threadRuntimeManager.retireResourceDrains(resourceKey);
    if (this.sessionManager.getSession(threadId)) await this.closeSession(threadId);
    threadRuntimeManager.fenceResource(resourceKey);
  }

  async initialize() {
    for (const { threadId, entry } of await this.index.list()) {
      if (entry.status === 'active') await this.index.suspend(threadId);
    }
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
        current.providerExitObserved = true;
        this.reconcileProviderExit(threadId, current);
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

  reconcileProviderExit(threadId, expectedSession) {
    const current = this.sessionManager.getSession(threadId);
    if (current !== expectedSession || !current?.providerExitObserved
      || current.stopFinalization || current.closePromise || current.exitReconciliation) return;
    const reconciliation = Promise.resolve().then(() => {
      if (this.sessionManager.getSession(threadId) !== current) return false;
      return this.closeSession(threadId);
    });
    current.exitReconciliation = reconciliation;
    reconciliation.catch(() => {
      console.error(`[ThreadManager] Provider exit cleanup failed for ${threadId}`);
    }).finally(() => {
      if (current.exitReconciliation === reconciliation) delete current.exitReconciliation;
    });
  }

  async closeSession(threadId, options = {}) {
    const activeSession = this.sessionManager.getSession(threadId);
    if (activeSession?.stopFinalization) return false;
    const expectedWire = activeSession?.wireProcess;
    const runtimeIdentity = {
      workspaceId: this.workspaceId,
      projectRoot: this.projectRoot,
      workspaceEpoch: activeSession?.workspaceEpoch || null,
      scope: 'project',
      threadId,
    };
    const ownership = threadRuntimeManager.captureOwnership(runtimeIdentity);
    if (activeSession?.providerExitObserved && runtimeIdentity.workspaceEpoch) {
      // Actual exit proves this provider no longer needs a Stop signal. A
      // previous bounded Stop may have left a rejected retirement promise;
      // recover through the captured iterator completion, never that promise.
      const drain = threadRuntimeManager.getActiveDrain(runtimeIdentity);
      if (drain) {
        if (!drain.completion) throw new Error('Exited provider drain has no completion lifecycle');
        // Iterator rejection is still settled: after proven provider exit it
        // cannot publish more events. Do not confuse failure with pending work.
        await awaitBoundedDrainCompletion(Promise.allSettled([drain.completion]));
        if (this.sessionManager.getSession(threadId) !== activeSession
          || activeSession.wireProcess !== expectedWire
          || (activeSession.workspaceEpoch || null) !== runtimeIdentity.workspaceEpoch
          || activeSession.stopFinalization
          || !threadRuntimeManager.isOwnershipCurrent(ownership)) return false;
        threadRuntimeManager.clearActiveDrainIfCurrent(runtimeIdentity, drain.drainId);
      }
    } else if (runtimeIdentity.workspaceEpoch) {
      await threadRuntimeManager.retireActiveDrain(runtimeIdentity);
    } else {
      await threadRuntimeManager.retireResourceDrains(runtimeIdentity);
    }
    if (this.sessionManager.getSession(threadId) !== activeSession
      || activeSession?.wireProcess !== expectedWire) return false;
    const canRelease = () => this.sessionManager.getSession(threadId) === activeSession
      && activeSession?.wireProcess === expectedWire && !activeSession?.stopFinalization
      && (activeSession?.workspaceEpoch || null) === runtimeIdentity.workspaceEpoch
      && (ownership ? threadRuntimeManager.isOwnershipCurrent(ownership)
        : !threadRuntimeManager.getRuntime(runtimeIdentity));
    const closed = await this.sessionManager.closeSessionAndWait(threadId, { ...options,
      canRelease,
      beforeRelease: () => this.index.suspend(threadId),
    });
    if (!closed) return false;

    // Metadata settled while the exact retiring provider still owned admission.
    threadRuntimeManager.markOwnedState(ownership, 'cold');
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
