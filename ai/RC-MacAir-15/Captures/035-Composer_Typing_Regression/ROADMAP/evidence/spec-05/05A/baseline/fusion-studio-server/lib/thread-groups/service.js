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
 * Slice 01B adds the canonical `rename` and `delete` group actions (durable
 * `{workspaceId, requestId}` replay, one group-mutation lease with busy/
 * runtime fences, mirror deletion + tombstone recovery, Provenance retention,
 * no-`surfaceId` envelope context; §5.5/§8.2/§9/§4.2).
 *
 * Slice 01C adds `recordPromptAccepted` (idempotent prompt-accepted activity
 * and sole prompt-driven MRU advance; §5.4/§7) plus the canonical `copy_link`,
 * `resolve_link`, `view_markdown`, and `set_harness_selection` actions. Those
 * four now live in `./link-service` and `./selection-service`, and `delete`
 * lives in `./delete-service` (Slice 05B mechanical split); their durable
 * replay, server-validated identities, Legacy-safe link resolution, and
 * no-`surfaceId` guarantees are unchanged.
 */

const { getDb } = require('../db');
const views = require('../views');
const repository = require('./repository');
const { buildDurableActionContext, canonicalTargetHash } = require('./action-identity');
const { groupMutationLeaseKey, withGroupMutationLease } = require('./group-mutation-lease');
const { isBoundedId } = require('./application-link');
const moveService = require('./move-service');
const memberService = require('./member-service');
const linkService = require('./link-service');
const selectionService = require('./selection-service');
const deleteService = require('./delete-service');

const MAX_GROUP_NAME_BYTES = 512;
// The deleted-group recovery window is owned by `./delete-service` and
// re-exported below under the same name and value (Slice 05B split).
const { DELETE_TOMBSTONE_TTL_MS } = deleteService;

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

  /**
   * `thread:members` — the qualified ordered-member read for one validated
   * group (`SPEC-04 §8`). See `./member-service` for the owning
   * implementation; this stable method keeps the public service surface.
   */
  async listGroupMembers(params = {}) {
    return memberService.listGroupMembers(this, params);
  }

  /** Dispatch one canonical `thread:action` to its owning group operation. */
  async performAction(action, params = {}) {
    if (action === 'rename') return this.renameGroup(params);
    if (action === 'delete') return this.deleteGroup(params);
    if (action === 'copy_link') return this.copyLink(params);
    if (action === 'resolve_link') return this.resolveLink(params);
    if (action === 'view_markdown') return this.viewMarkdown(params);
    if (action === 'set_harness_selection') return this.setHarnessSelection(params);
    if (action === 'move_chat_to_side') return this.moveChatToSide(params);
    if (action === 'open_member_in_side') return this.openMemberInSide(params);
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
  async recordPromptAccepted({ threadId, turnId, db: transaction = null } = {}) {
    if (!isBoundedId(threadId) || !isBoundedId(turnId)) {
      return { ok: false, code: 'request_invalid' };
    }
    const activation = transaction ? { ok: true } : await this.activate();
    if (!activation.ok) {
      return {
        ok: false,
        code: 'view_id_preflight_repair_required',
        diagnostics: activation.diagnostics,
      };
    }
    const db = transaction || this.db;
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

  /** `copy_link` group scope. Owning implementation: `./link-service`. */
  async copyLink(params = {}) {
    return linkService.copyLink(this, params);
  }

  /** `resolve_link` group or exact-member target. Owning: `./link-service`. */
  async resolveLink(params = {}) {
    return linkService.resolveLink(this, params);
  }

  /** `view_markdown` exact member. Owning implementation: `./link-service`. */
  async viewMarkdown(params = {}) {
    return linkService.viewMarkdown(this, params);
  }

  /** `set_harness_selection` exact member. Owning: `./selection-service`. */
  async setHarnessSelection(params = {}) {
    return selectionService.setHarnessSelection(this, params);
  }

  /**
   * Move the current Main Chat `A` into a Side Chat tab and create a new empty
   * Main Chat `B` in the same group (`SPEC-04 §4/§5`, slice 04A). See
   * `./move-service` for the owning implementation; this stable method keeps
   * the public `performAction` surface. The server-owned session-start policy
   * (`SPEC-04 §5`, `CHAT-I-026/031`) resolves there too.
   */
  async moveChatToSide(params = {}) {
    return moveService.moveChatToSide(this, params);
  }

  /**
   * `open_member_in_side` — idempotent explicit access to one non-primary group
   * member's lifetime Side Chat (`SPEC-04 §8`, CHAT-I-027/029). See
   * `./member-service` for the owning implementation; this stable method keeps
   * the public `performAction` surface.
   */
  async openMemberInSide(params = {}) {
    return memberService.openMemberInSide(this, params);
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
  async deleteGroup(params = {}) {
    return deleteService.deleteGroup(this, params);
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
