'use strict';

/**
 * @module thread-groups/service
 * @role Thread Group domain operations.
 *
 * Owns group-visible semantics (population selection, open resolution, title,
 * durable group actions with idempotency and delete recovery) while delegating
 * every session/mirror concern to the ThreadManager. It never clones
 * ThreadManager's session-limit, harness-config, or mirror rules (`SPEC-01 §7`).
 *
 * Slice 01B adds the canonical `rename` and `delete` group actions:
 *   - durable per-`{workspaceId, requestId}` result replay and
 *     `request_mismatch` on different-input reuse (§5.5/§8.2);
 *   - one group-mutation lease, member busy check, runtime fences, mirror
 *     deletion + tombstone recovery, and retained Provenance facts (§9);
 *   - durable envelope context with no `surfaceId` (§4.2).
 *
 * Slice 01C adds:
 *   - `recordPromptAccepted` — the idempotent prompt-accepted activity and the
 *     sole prompt-driven advance of group MRU, committed in one transaction
 *     before `message:sent`/provider dispatch (§5.4/§7);
 *   - canonical `copy_link`, `resolve_link`, `view_markdown`, and
 *     `set_harness_selection` actions with durable replay, server-validated
 *     identities, and no `surfaceId` (§8.2); and
 *   - a Legacy-safe link resolution that opens the authoritative current
 *     primary and never borrows the active panel's view (§9).
 */

const { getDb } = require('../db');
const views = require('../views');
const repository = require('./repository');
const { buildDurableActionContext, canonicalTargetHash } = require('./action-identity');
const { groupMutationLeaseKey, withGroupMutationLease } = require('./group-mutation-lease');
const { buildGroupLink, isBoundedId, parseGroupLink } = require('./application-link');
const { resolveCliPolicy } = require('../cli-config');
const { validatePortableSelection } = require('../thread/thread-harness-config-policy');

const MAX_GROUP_NAME_BYTES = 512;
/** Bounded recovery window for a deleted group's cleanup tombstone. */
const DELETE_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

class ThreadGroupService {
  /** @param {{ manager: object }} deps */
  constructor({ manager }) {
    if (!manager) throw new Error('ThreadGroupService: manager is required');
    this.manager = manager;
  }

  get db() {
    return getDb();
  }

  get workspaceId() {
    return this.manager.workspaceId;
  }

  /** Run preflight + reconciliation once; safe to call on every route. */
  async activate() {
    return this.manager.ensureGroupsActivated();
  }

  /**
   * One exact `{workspaceId, viewId}` population. Legacy is the explicit
   * null-view population, never a fallback to the active panel.
   */
  async listGroups({ viewId = null } = {}) {
    const activation = await this.activate();
    if (!activation.ok) return activation;
    const groups = await repository.listGroupProjections(this.db, {
      workspaceId: this.workspaceId,
      viewId,
    });
    return { ok: true, viewId, groups };
  }

  /**
   * Resolve a visible-row open. Unknown explicit group/member IDs return null
   * (the caller answers `not_found`) and never create a replacement.
   */
  async resolveOpenTarget({ threadGroupId = null, threadId = null } = {}) {
    const activation = await this.activate();
    if (!activation.ok) return activation;
    const db = this.db;

    let groupRow = null;
    if (threadGroupId) {
      groupRow = await repository.getGroup(db, threadGroupId);
      if (groupRow && groupRow.workspace_id !== this.workspaceId) groupRow = null;
    } else if (threadId) {
      groupRow = await repository.getGroupForThread(db, threadId);
      if (groupRow && groupRow.workspace_id !== this.workspaceId) groupRow = null;
      // Verify the exact member belongs to the resolved group.
      if (groupRow) {
        const member = await repository.getMember(db, groupRow.group_id, threadId);
        if (!member) groupRow = null;
      }
    }
    if (!groupRow) return { ok: true, target: null };

    const projection = await repository.getGroupProjection(db, groupRow.group_id);
    if (!projection) return { ok: true, target: null };
    const requestedThreadId = threadId && projection.currentPrimaryThreadId !== threadId
      ? threadId
      : projection.currentPrimaryThreadId;
    const member = await repository.getMember(db, groupRow.group_id, requestedThreadId);
    if (!member) return { ok: true, target: null };
    return { ok: true, target: { projection, threadId: requestedThreadId } };
  }

  /** Registry-validate an externally supplied view target; null means Legacy. */
  resolveViewTarget(viewId) {
    if (viewId === null || viewId === undefined) return { ok: true, viewId: null };
    if (typeof viewId !== 'string' || !viewId) return { ok: false, viewId: null };
    const root = views.resolveViewRoot(this.manager.projectRoot, viewId, { strictFilesystemErrors: true });
    return root ? { ok: true, viewId } : { ok: false, viewId: null };
  }

  /** Dispatch one canonical `thread:action` to its owning group operation. */
  async performAction(action, params = {}) {
    if (action === 'rename') return this.renameGroup(params);
    if (action === 'delete') return this.deleteGroup(params);
    if (action === 'copy_link') return this.copyLink(params);
    if (action === 'resolve_link') return this.resolveLink(params);
    if (action === 'view_markdown') return this.viewMarkdown(params);
    if (action === 'set_harness_selection') return this.setHarnessSelection(params);
    return { ok: false, code: 'invalid_action' };
  }

  /** Resolve an owned group row from either explicit group or exact member. */
  async _resolveOwnedGroup({ threadGroupId = null, threadId = null } = {}) {
    const db = this.db;
    let groupRow = null;
    if (threadGroupId) {
      groupRow = await repository.getGroup(db, threadGroupId);
    } else if (threadId) {
      groupRow = await repository.getGroupForThread(db, threadId);
    }
    if (!groupRow || groupRow.workspace_id !== this.workspaceId) return null;
    if (threadId) {
      const member = await repository.getMember(db, groupRow.group_id, threadId);
      if (!member) return null;
    }
    return groupRow;
  }

  /** Same-request/same-input replay or `request_mismatch`; never re-runs. */
  _replay(existing, expected) {
    const expectedHash = canonicalTargetHash(expected);
    if (existing.action !== expected.action || existing.targetHash !== expectedHash) {
      return { ok: false, code: 'request_mismatch' };
    }
    let result = null;
    try {
      result = JSON.parse(existing.resultJson);
    } catch (_error) {
      result = null;
    }
    return { ok: true, result, replayed: true };
  }

  /** Replay a stored result for a requestId, or null when unseen. */
  async _replayIfPresent(requestId, expected) {
    if (!requestId) return null;
    const existing = await repository.getActionResult(this.db, this.workspaceId, requestId);
    return existing ? this._replay(existing, expected) : null;
  }

  /** Persist one durable action result keyed by `{workspaceId, requestId}`. */
  async _recordActionResult({ action, requestId, targetHash, result }) {
    if (!requestId) return;
    const now = Date.now();
    await repository.upsertActionResult(this.db, {
      workspaceId: this.workspaceId,
      requestId,
      action,
      targetHash,
      resultJson: JSON.stringify(result),
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Canonical durable context for one committed group/member action. */
  _context({ workspaceId, viewId, threadGroupId, threadId, componentContext }) {
    return buildDurableActionContext({
      workspaceId,
      viewId: viewId ?? null,
      threadGroupId,
      threadId,
      componentContext,
    });
  }

  /**
   * Record the idempotent prompt-accepted activity and monotonically advance
   * the group's sole visible-list MRU clock in one transaction (`SPEC-01
   * §5.4/§7`). The canonical key is `prompt:{threadId}:{turnId}`; a retry of
   * the same accepted thread/turn never advances MRU twice. It resolves the
   * exact session's owning group and never reads the active panel.
   *
   * @param {{ threadId: string, turnId: string }} input
   * @returns {Promise<{ ok: boolean, advanced?: boolean, code?: string }>}
   */
  async recordPromptAccepted({ threadId, turnId } = {}) {
    if (!isBoundedId(threadId) || !isBoundedId(turnId)) {
      return { ok: false, code: 'request_invalid' };
    }
    const activation = await this.activate();
    if (!activation.ok) {
      return {
        ok: false,
        code: 'view_id_preflight_repair_required',
        diagnostics: activation.diagnostics,
      };
    }
    const db = this.db;
    const groupRow = await repository.getGroupForThread(db, threadId);
    if (!groupRow || groupRow.workspace_id !== this.workspaceId) {
      return { ok: false, code: 'not_found' };
    }
    const advanced = await repository.recordActivityAndAdvance(db, {
      eventKey: `prompt:${threadId}:${turnId}`,
      groupId: groupRow.group_id,
      threadId,
      turnId,
      kind: 'prompt-accepted',
      occurredAt: Date.now(),
    });
    return { ok: true, advanced, threadGroupId: groupRow.group_id };
  }

  /**
   * `copy_link` — group scope. Returns the versioned application URI for the
   * authoritative group with the validated sole/current member. SPEC-04
   * exclusively adds non-primary member link production (`CHAT-I-029`).
   */
  async copyLink({
    threadGroupId = null, threadId = null, requestId = null, componentContext = null,
  } = {}) {
    const expected = { action: 'copy_link', threadGroupId, threadId };
    const targetHash = canonicalTargetHash(expected);
    const replay = await this._replayIfPresent(requestId, expected);
    if (replay) return replay;

    const groupRow = await this._resolveOwnedGroup({ threadGroupId, threadId });
    if (!groupRow) return { ok: false, code: 'not_found' };
    const projection = await repository.getGroupProjection(this.db, groupRow.group_id);
    if (!projection) return { ok: false, code: 'not_found' };

    // An optional exact member is only accepted when it is the authoritative
    // sole/current member; nothing else may be promoted through a link.
    const memberThreadId = projection.currentPrimaryThreadId;
    if (threadId && threadId !== memberThreadId) return { ok: false, code: 'not_found' };

    const link = buildGroupLink({
      workspaceId: projection.workspaceId,
      threadGroupId: projection.threadGroupId,
      viewId: projection.viewId ?? null,
      threadId: memberThreadId,
    });
    if (!link) return { ok: false, code: 'not_found' };

    const result = {
      action: 'copy_link',
      threadGroupId: projection.threadGroupId,
      threadId: memberThreadId,
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      link,
      context: this._context({
        workspaceId: projection.workspaceId,
        viewId: projection.viewId ?? null,
        threadGroupId: projection.threadGroupId,
        threadId: memberThreadId,
        componentContext,
      }),
    };
    await this._recordActionResult({ action: 'copy_link', requestId, targetHash, result });
    return { ok: true, result };
  }

  /**
   * `resolve_link` — group or optional exact current-member target. Validates
   * the URI/ids and resolves to the authoritative group + current primary.
   * Opens Main Chat either way and applies no member-placement semantics, so
   * Legacy links resolve to the workspace Legacy host and never borrow the
   * active view (`SPEC-01 §9`, `CHAT-I-029`).
   */
  async resolveLink({
    threadGroupId = null, threadId = null, uri = null,
    requestId = null, componentContext = null,
  } = {}) {
    const expected = {
      action: 'resolve_link', threadGroupId, threadId, uri: uri ?? null,
    };
    const targetHash = canonicalTargetHash(expected);
    const replay = await this._replayIfPresent(requestId, expected);
    if (replay) return replay;

    let resolvedWorkspaceId = null;
    let resolvedGroupId = threadGroupId;
    let resolvedViewId = undefined;
    let resolvedMemberId = threadId;
    if (uri !== null && uri !== undefined) {
      const parsed = parseGroupLink(uri);
      if (!parsed) return { ok: false, code: 'invalid_link' };
      resolvedWorkspaceId = parsed.workspaceId;
      // The URI is only ever resolved inside the bound workspace; it is never
      // authority to switch workspaces.
      if (resolvedWorkspaceId !== this.workspaceId) return { ok: false, code: 'not_found' };
      resolvedGroupId = parsed.threadGroupId;
      resolvedViewId = parsed.viewId;
      resolvedMemberId = parsed.threadId;
    }

    const groupRow = resolvedGroupId
      ? await repository.getGroup(this.db, resolvedGroupId)
      : (resolvedMemberId
        ? await repository.getGroupForThread(this.db, resolvedMemberId)
        : null);
    if (!groupRow || groupRow.workspace_id !== this.workspaceId) {
      return { ok: false, code: 'not_found' };
    }
    const projection = await repository.getGroupProjection(this.db, groupRow.group_id);
    if (!projection) return { ok: false, code: 'not_found' };

    // A URI's encoded view must match the authoritative group binding; a stale
    // or foreign view never retargets the link, and Legacy is the explicit
    // null-view population.
    if (uri !== null && uri !== undefined && (resolvedViewId ?? null) !== (projection.viewId ?? null)) {
      return { ok: false, code: 'not_found' };
    }
    // An optional exact member must belong to the group. It is validated but
    // never promoted: resolution always targets the authoritative current
    // primary and opens Main Chat.
    if (resolvedMemberId) {
      const member = await repository.getMember(this.db, groupRow.group_id, resolvedMemberId);
      if (!member) return { ok: false, code: 'not_found' };
    }

    const result = {
      action: 'resolve_link',
      threadGroupId: projection.threadGroupId,
      threadId: projection.currentPrimaryThreadId,
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      resolved: true,
      context: this._context({
        workspaceId: projection.workspaceId,
        viewId: projection.viewId ?? null,
        threadGroupId: projection.threadGroupId,
        threadId: projection.currentPrimaryThreadId,
        componentContext,
      }),
    };
    await this._recordActionResult({ action: 'resolve_link', requestId, targetHash, result });
    return { ok: true, result };
  }

  /**
   * `view_markdown` — exact member. Returns the validated exact-member mirror
   * path resolved through ThreadManager's canonical
   * `Data/Chatlogs/threads/<threadId>.md` owner; never an arbitrary path.
   */
  async viewMarkdown({
    threadGroupId = null, threadId = null, requestId = null, componentContext = null,
  } = {}) {
    const expected = { action: 'view_markdown', threadGroupId, threadId };
    const targetHash = canonicalTargetHash(expected);
    const replay = await this._replayIfPresent(requestId, expected);
    if (replay) return replay;

    const groupRow = await this._resolveOwnedGroup({ threadGroupId, threadId });
    if (!groupRow) return { ok: false, code: 'not_found' };
    const projection = await repository.getGroupProjection(this.db, groupRow.group_id);
    if (!projection) return { ok: false, code: 'not_found' };

    const memberThreadId = threadId || projection.currentPrimaryThreadId;
    const member = await repository.getMember(this.db, groupRow.group_id, memberThreadId);
    if (!member) return { ok: false, code: 'not_found' };

    const thread = typeof this.manager.getThread === 'function'
      ? await this.manager.getThread(memberThreadId)
      : null;
    if (!thread || typeof thread.filePath !== 'string' || !thread.filePath) {
      return { ok: false, code: 'not_found' };
    }

    const result = {
      action: 'view_markdown',
      threadGroupId: projection.threadGroupId,
      threadId: memberThreadId,
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      markdownPath: thread.filePath,
      context: this._context({
        workspaceId: projection.workspaceId,
        viewId: projection.viewId ?? null,
        threadGroupId: projection.threadGroupId,
        threadId: memberThreadId,
        componentContext,
      }),
    };
    await this._recordActionResult({ action: 'view_markdown', requestId, targetHash, result });
    return { ok: true, result };
  }

  /**
   * `set_harness_selection` — exact member. Accepts only portable
   * `{model, variant}`, validates both against the current server-owned policy,
   * and never accepts or changes the harness binding (`CHAT-I-026/031`). The
   * harness id is read only from server-owned session state. A rejection
   * leaves the prior value authoritative.
   */
  async setHarnessSelection({
    threadGroupId = null, threadId = null, model = null, variant = null,
    requestId = null, componentContext = null,
  } = {}) {
    const expected = {
      action: 'set_harness_selection', threadGroupId, threadId, model, variant,
    };
    const targetHash = canonicalTargetHash(expected);
    const replay = await this._replayIfPresent(requestId, expected);
    if (replay) return replay;

    const groupRow = await this._resolveOwnedGroup({ threadGroupId, threadId });
    if (!groupRow) return { ok: false, code: 'not_found' };
    const projection = await repository.getGroupProjection(this.db, groupRow.group_id);
    if (!projection) return { ok: false, code: 'not_found' };
    const memberThreadId = threadId || projection.currentPrimaryThreadId;
    const member = await repository.getMember(this.db, groupRow.group_id, memberThreadId);
    if (!member) return { ok: false, code: 'not_found' };

    const thread = typeof this.manager.getThread === 'function'
      ? await this.manager.getThread(memberThreadId)
      : null;
    const harnessId = thread?.entry?.harnessId;
    if (!thread || !harnessId) return { ok: false, code: 'not_found' };

    let policy;
    try {
      policy = await resolveCliPolicy(this.manager.projectRoot);
    } catch (_error) {
      return { ok: false, code: 'selection_unavailable' };
    }
    const models = policy?.config?.[harnessId]?.models ?? null;
    const selection = validatePortableSelection({ models, model, variant });
    if (!selection.ok) return { ok: false, code: selection.code };

    if (typeof this.manager.updateHarnessConfig !== 'function') {
      return { ok: false, code: 'selection_unavailable' };
    }
    await this.manager.updateHarnessConfig(memberThreadId, {
      model: selection.model,
      variant: selection.variant,
    });
    const acknowledged = await this.manager.getThread(memberThreadId);
    const acknowledgedConfig = acknowledged?.entry?.harnessConfig ?? {};

    const result = {
      action: 'set_harness_selection',
      threadGroupId: projection.threadGroupId,
      threadId: memberThreadId,
      workspaceId: projection.workspaceId,
      viewId: projection.viewId ?? null,
      harnessId,
      model: acknowledgedConfig.model ?? selection.model,
      variant: acknowledgedConfig.variant === undefined ? selection.variant : acknowledgedConfig.variant,
      context: this._context({
        workspaceId: projection.workspaceId,
        viewId: projection.viewId ?? null,
        threadGroupId: projection.threadGroupId,
        threadId: memberThreadId,
        componentContext,
      }),
    };
    await this._recordActionResult({
      action: 'set_harness_selection', requestId, targetHash, result,
    });
    return { ok: true, result };
  }

  /**
   * Rename the group title only. Does not rewrite session identity, provider
   * state, historical Provenance, or the visible-list MRU clock (§9).
   */
  async renameGroup({
    threadGroupId = null, threadId = null, name, requestId = null, componentContext = null,
  }) {
    const activation = await this.activate();
    if (!activation.ok) {
      return { ok: false, code: 'view_id_preflight_repair_required', diagnostics: activation.diagnostics };
    }
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || Buffer.byteLength(cleanName, 'utf8') > MAX_GROUP_NAME_BYTES) {
      return { ok: false, code: 'invalid_name' };
    }
    const db = this.db;
    const targetHash = canonicalTargetHash({
      action: 'rename', threadGroupId, threadId, name: cleanName,
    });

    if (requestId) {
      const existing = await repository.getActionResult(db, this.workspaceId, requestId);
      if (existing) {
        return this._replay(existing, {
          action: 'rename', threadGroupId, threadId, name: cleanName,
        });
      }
    }

    const groupRow = await this._resolveOwnedGroup({ threadGroupId, threadId });
    if (!groupRow) return { ok: false, code: 'not_found' };

    return withGroupMutationLease(
      groupMutationLeaseKey(this.workspaceId, groupRow.group_id),
      async () => {
        if (requestId) {
          const replay = await repository.getActionResult(db, this.workspaceId, requestId);
          if (replay) {
            return this._replay(replay, {
              action: 'rename', threadGroupId, threadId, name: cleanName,
            });
          }
        }
        // The group owns the visible title. ThreadManager performs the
        // compatibility session-name + mirror-frontmatter write so this
        // service never clones ThreadManager's mirror rules (§7/§9).
        const before = await repository.getGroupProjection(db, groupRow.group_id);
        if (!before) return { ok: false, code: 'not_found' };
        const renamed = typeof this.manager.renameThread === 'function'
          ? await this.manager.renameThread(before.currentPrimaryThreadId, cleanName)
          : null;
        if (renamed === null) return { ok: false, code: 'not_found' };
        if (typeof this.manager.renameThread !== 'function') {
          await repository.renameGroup(db, groupRow.group_id, cleanName);
        }
        const projection = await repository.getGroupProjection(db, groupRow.group_id);
        if (!projection) return { ok: false, code: 'not_found' };
        const result = {
          action: 'rename',
          threadGroupId: projection.threadGroupId,
          threadId: projection.currentPrimaryThreadId,
          workspaceId: projection.workspaceId,
          viewId: projection.viewId ?? null,
          name: cleanName,
          context: buildDurableActionContext({
            workspaceId: projection.workspaceId,
            viewId: projection.viewId ?? null,
            threadGroupId: projection.threadGroupId,
            threadId: projection.currentPrimaryThreadId,
            componentContext,
          }),
        };
        if (requestId) {
          const now = Date.now();
          await repository.upsertActionResult(db, {
            workspaceId: this.workspaceId,
            requestId,
            action: 'rename',
            targetHash,
            resultJson: JSON.stringify(result),
            createdAt: now,
            updatedAt: now,
          });
        }
        return { ok: true, result };
      },
    );
  }

  /**
   * Delete one whole group with busy check, runtime fences, durable mirror
   * deletion + cleanup tombstone, and new-ID tombstone recovery (§9).
   */
  async deleteGroup({
    threadGroupId = null, threadId = null, requestId = null, componentContext = null,
  }) {
    const activation = await this.activate();
    if (!activation.ok) {
      return { ok: false, code: 'view_id_preflight_repair_required', diagnostics: activation.diagnostics };
    }
    const db = this.db;
    const targetHash = canonicalTargetHash({ action: 'delete', threadGroupId, threadId });

    if (requestId) {
      const existing = await repository.getActionResult(db, this.workspaceId, requestId);
      if (existing) {
        return this._replay(existing, { action: 'delete', threadGroupId, threadId });
      }
    }

    const groupRow = await this._resolveOwnedGroup({ threadGroupId, threadId });
    if (!groupRow) {
      return withGroupMutationLease(
        groupMutationLeaseKey(this.workspaceId, threadGroupId || threadId),
        () => this._recoverDeletedGroupWithinLease({
          threadGroupId, threadId, requestId, componentContext, targetHash,
        }),
      );
    }

    return withGroupMutationLease(
      groupMutationLeaseKey(this.workspaceId, groupRow.group_id),
      async () => {
        if (requestId) {
          const replay = await repository.getActionResult(db, this.workspaceId, requestId);
          if (replay) return this._replay(replay, { action: 'delete', threadGroupId, threadId });
        }
        // A peer delete may have committed while this request waited. The
        // group lease is already held here, so recover without re-acquiring it.
        const current = await repository.getGroup(db, groupRow.group_id);
        if (!current) {
          return this._recoverDeletedGroupWithinLease({
            threadGroupId: groupRow.group_id, threadId, requestId, componentContext, targetHash,
          });
        }

        const deleted = await this.manager.deleteGroup(groupRow.group_id, {
          tombstoneExpiresAt: Date.now() + DELETE_TOMBSTONE_TTL_MS,
          context: buildDurableActionContext({
            workspaceId: this.workspaceId,
            viewId: current.view_id ?? null,
            threadGroupId: groupRow.group_id,
            threadId: current.current_primary_thread_id ?? null,
            componentContext,
          }),
        });
        if (!deleted.deleted) {
          if (deleted.reason === 'group_busy') {
            return { ok: false, code: 'group_busy', busy: deleted.busy };
          }
          return { ok: false, code: 'not_found' };
        }

        // Post-commit mirror cleanup is separately failure-isolated; a failed
        // cleanup returns the retained state and stays repairable.
        let result = deleted.result;
        try {
          await this.manager.retryMirrorCleanupForGroup(groupRow.group_id);
        } catch (_error) {
          // Retained tombstone cleanup state already records the failure.
        }
        result = await this._refreshTombstoneAggregate(groupRow.group_id, result);

        if (requestId) {
          const now = Date.now();
          await repository.upsertActionResult(db, {
            workspaceId: this.workspaceId,
            requestId,
            action: 'delete',
            targetHash,
            resultJson: JSON.stringify(result),
            createdAt: now,
            updatedAt: now,
          });
        }
        return { ok: true, result };
      },
    );
  }

  /**
   * New-request recovery: while the group-scoped cleanup tombstone holds,
   * return the retained aggregate (not `not_found`, not a rerun), resume
   * idempotent repair, and bind the aggregate to the new request ID so replay
   * survives tombstone expiry (`CHAT-I-030`/`CHAT-I-032`). Past expiry an
   * unseen request receives ordinary `not_found` and the mutation is never
   * replayed.
   */
  async _recoverDeletedGroupWithinLease({
    threadGroupId = null, threadId = null, requestId = null, componentContext = null, targetHash,
  }) {
    const db = this.db;
    const tombstone = threadGroupId
      ? await repository.getDeleteTombstone(db, threadGroupId)
      : null;
    if (!tombstone
      || tombstone.workspaceId !== this.workspaceId
      || Number(tombstone.expiresAt) <= Date.now()) {
      return { ok: false, code: 'not_found' };
    }

    try {
      await this.manager.retryMirrorCleanupForGroup(tombstone.groupId);
    } catch (_error) {
      // Retained cleanup state below reflects the remaining pending work.
    }
    let base;
    try {
      base = JSON.parse(tombstone.resultJson);
    } catch (_error) {
      base = { action: 'delete', threadGroupId: tombstone.groupId, deleted: true };
    }
    const result = await this._refreshTombstoneAggregate(
      tombstone.groupId,
      { ...base, recovered: true },
    );
    const context = base?.context
      ?? buildDurableActionContext({
        workspaceId: this.workspaceId,
        viewId: result.viewId ?? null,
        threadGroupId: result.threadGroupId,
        threadId: result.threadId ?? null,
        componentContext,
      });
    const durableResult = { ...result, context };
    if (requestId) {
      const now = Date.now();
      await repository.upsertActionResult(db, {
        workspaceId: this.workspaceId,
        requestId,
        action: 'delete',
        targetHash,
        resultJson: JSON.stringify(durableResult),
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true, result: durableResult, recovered: true };
  }

  /** Recompute the retained cleanup aggregate from durable mirror records. */
  async _refreshTombstoneAggregate(groupId, baseResult) {
    const db = this.db;
    const rows = await repository.listMirrorRecoveryForGroup(db, groupId, 'delete');
    const mirrors = rows.map((row) => ({
      threadId: row.thread_id,
      mirrorKey: row.mirror_key,
      status: row.status,
      failureCode: row.failure_code ?? null,
    }));
    const status = mirrors.some((mirror) => mirror.status === 'failed')
      ? 'failed'
      : mirrors.some((mirror) => mirror.status === 'pending')
        ? 'pending'
        : 'complete';
    const cleanup = { status, mirrors };
    const result = { ...baseResult, cleanup };
    try {
      await repository.updateDeleteTombstone(db, groupId, {
        resultJson: JSON.stringify(result),
        cleanupJson: JSON.stringify(cleanup),
        now: Date.now(),
      });
    } catch (_error) {
      // The durable action result below still carries the same aggregate.
    }
    return result;
  }
}

function createThreadGroupService(deps) {
  return new ThreadGroupService(deps);
}

module.exports = {
  DELETE_TOMBSTONE_TTL_MS,
  ThreadGroupService,
  createThreadGroupService,
};
