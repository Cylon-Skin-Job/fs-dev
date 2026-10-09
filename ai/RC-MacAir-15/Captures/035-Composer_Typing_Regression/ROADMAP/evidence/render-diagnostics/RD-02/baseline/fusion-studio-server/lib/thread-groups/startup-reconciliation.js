'use strict';

// Reconcile legacy session membership and pending file projections at activation.
const { getDb } = require('../db');
const repository = require('./repository');
const { runStableViewIdPreflight } = require('../views/stable-view-id-preflight');
const { consumePendingWorksurfaceCleanup } = require('./worksurface-cleanup');
const { consumePendingPlacementOutbox } = require('./placement-delivery');

class GroupStartupReconciliation {
  constructor({ workspaceId, projectRoot, mirror }) {
    Object.assign(this, { workspaceId, projectRoot, mirror });
    this.activationPromise = null;
  }
  ensureActivated() {
    if (!this.activationPromise) this.activationPromise = this.activate().catch(error => {
      this.activationPromise = null;
      throw error;
    });
    return this.activationPromise;
  }
  async activate() {
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
      await this.attachGroupToSession({
        threadId: row.thread_id,
        name: row.name,
        viewId: resolvedViewId,
        createdAt: repository.epochFromIso(row.created_at, Date.now()),
        updatedAt: Number(row.updated_at) || Date.now(),
      });
    }
    await this.mirror.recover();
    // Cross-store recovery (`SPEC-03 §8`): converge any group deletion whose
    // worksurface cleanup did not apply before the process stopped. This is
    // independent of the manager-owned transcript-mirror journal.
    try {
      await consumePendingWorksurfaceCleanup(getDb(), { workspaceId: this.workspaceId, projectRoot: this.projectRoot });
    } catch (_error) {
      // A sweep-read failure must not block group activation; the unapplied
      // instruction stays durable and retryable.
    }
    // SPEC-04 §7: recover committed Move placements that had not yet been
    // materialized into the view-state lane when the process stopped. The
    // committed group transition is already durable; delivery is idempotent.
    try {
      await consumePendingPlacementOutbox(getDb(), { workspaceId: this.workspaceId, projectRoot: this.projectRoot });
    } catch (_error) {
      // The unapplied instruction stays durable and retryable.
    }
    await this.mirror.reconcileRetired();
    return { ok: true, diagnostics: [] };
  }

  async attachGroupToSession({ threadId, name, viewId, createdAt, updatedAt }) {
    const db = getDb();
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
      await this.mirror.stage(trx, { threadId, groupId: threadId, operation: 'create' });
    });
  }
}
module.exports = { GroupStartupReconciliation };
