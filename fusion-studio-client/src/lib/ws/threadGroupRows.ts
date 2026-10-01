/**
 * @module threadGroupRows
 * @role Pure mapping between server Thread Group projections and the current
 *       renderer's thread-row shape.
 *
 * SPEC-01 §8.1: `thread:list` returns `ThreadGroupProjection` rows carrying
 * durable identities only. The current rail is the workspace Legacy host
 * (`viewId: null`) and needs the authoritative current primary for chat routing
 * while keeping `threadGroupId` as the visible-row key. This module is the
 * single translation point; SPEC-02 replaces it with explicit surfaces.
 */

import type { Thread } from '../../types';

export interface ThreadGroupProjectionLike {
  threadGroupId?: string;
  workspaceId?: string;
  viewId?: string | null;
  name?: string | null;
  currentPrimaryThreadId?: string;
  currentPrimarySequence?: number;
  memberCount?: number;
  createdAt?: number;
  updatedAt?: number;
  /** Present only for legacy/raw thread entries. */
  threadId?: string;
  entry?: Thread['entry'];
}

export function threadGroupRowFromProjection(projection: ThreadGroupProjectionLike): Thread {
  return {
    threadId: projection.currentPrimaryThreadId || projection.threadId || '',
    ...(projection.threadGroupId ? { threadGroupId: projection.threadGroupId } : {}),
    entry: projection.entry as Thread['entry'],
    ...(projection.workspaceId ? { workspaceId: projection.workspaceId } : {}),
    ...(projection.viewId !== undefined ? { viewId: projection.viewId } : {}),
    ...(projection.name !== undefined ? { name: projection.name } : {}),
    ...(projection.currentPrimaryThreadId
      ? { currentPrimaryThreadId: projection.currentPrimaryThreadId }
      : {}),
    ...(projection.currentPrimarySequence !== undefined
      ? { currentPrimarySequence: projection.currentPrimarySequence }
      : {}),
    ...(projection.memberCount !== undefined ? { memberCount: projection.memberCount } : {}),
    ...(projection.createdAt !== undefined ? { createdAt: projection.createdAt } : {}),
    ...(projection.updatedAt !== undefined ? { updatedAt: projection.updatedAt } : {}),
  };
}

export function threadRowsFromProjections(
  projections: ThreadGroupProjectionLike[] | undefined,
): Thread[] {
  return (projections || []).map((projection) => threadGroupRowFromProjection(projection));
}

/**
 * Rows are groups: open by the visible-row identity when available; otherwise
 * fall back to the exact session identity for legacy/raw consumers.
 */
export function threadOpenRequest(
  threadGroupId: string | undefined,
  threadId: string | undefined,
): { type: 'thread:open'; threadGroupId?: string; threadId?: string } {
  if (threadGroupId) return { type: 'thread:open', threadGroupId };
  return { type: 'thread:open', threadId };
}

/**
 * One durable retry identity per user action. `requestId` is the caller's
 * idempotency key, never proof an effect occurred (`SPEC-01 §4`).
 */
export function makeThreadActionRequestId(): string {
  const cryptoApi = typeof globalThis !== 'undefined'
    ? (globalThis.crypto as Crypto | undefined)
    : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface ThreadActionRename {
  type: 'thread:action';
  action: 'rename';
  requestId: string;
  threadGroupId?: string;
  threadId?: string;
  name: string;
}

export interface ThreadActionDelete {
  type: 'thread:action';
  action: 'delete';
  requestId: string;
  threadGroupId?: string;
  threadId?: string;
}

export interface ThreadActionCopyLink {
  type: 'thread:action';
  action: 'copy_link';
  requestId: string;
  threadGroupId?: string;
  threadId?: string;
}

export interface ThreadActionViewMarkdown {
  type: 'thread:action';
  action: 'view_markdown';
  requestId: string;
  threadGroupId?: string;
  threadId?: string;
}

export interface ThreadActionMoveChatToSide {
  type: 'thread:action';
  action: 'move_chat_to_side';
  requestId: string;
  threadGroupId: string;
  threadId: string;
  /** Exact current-primary sequence the caller observed (SPEC-04 §4/§9). */
  expectedPrimarySequence: number;
}

/** SPEC-04 §8 idempotent explicit access to one non-primary member's Side Chat. */
export interface ThreadActionOpenMemberInSide {
  type: 'thread:action';
  action: 'open_member_in_side';
  requestId: string;
  threadGroupId: string;
  threadId: string;
}

export interface ThreadActionSetHarnessSelection {
  type: 'thread:action';
  action: 'set_harness_selection';
  requestId: string;
  threadGroupId?: string;
  threadId?: string;
  /** Portable model only; never a harness id, provider session, or unknown key. */
  model: string;
  variant: string | null;
}

/**
 * `open_member_in_side` is the SPEC-04 §8 idempotent member-access action. It
 * carries only durable group/member identities; workspace/view are
 * server-derived and no placement identity is ever supplied by the caller.
 */
export function threadActionOpenMemberInSide(
  { threadGroupId, threadId }: { threadGroupId: string; threadId: string },
): ThreadActionOpenMemberInSide {
  return {
    type: 'thread:action',
    action: 'open_member_in_side',
    requestId: makeThreadActionRequestId(),
    threadGroupId,
    threadId,
  };
}

/** Qualified `thread:members` read for one validated group (SPEC-04 §8). */
export function threadMembersRequest(
  threadGroupId: string,
): { type: 'thread:members'; threadGroupId: string } {
  return { type: 'thread:members', threadGroupId };
}

/**
 * Canonical group action intent. Rename/Delete are group scope and prefer
 * `threadGroupId`; the exact `threadId` rides along as member context and the
 * server remains the authority (§8.2).
 */
export function threadActionRename(
  { threadGroupId, threadId, name }: { threadGroupId?: string; threadId?: string; name: string },
): ThreadActionRename {
  return {
    type: 'thread:action',
    action: 'rename',
    requestId: makeThreadActionRequestId(),
    ...(threadGroupId ? { threadGroupId } : {}),
    ...(threadId ? { threadId } : {}),
    name,
  };
}

export function threadActionDelete(
  { threadGroupId, threadId }: { threadGroupId?: string; threadId?: string },
): ThreadActionDelete {
  return {
    type: 'thread:action',
    action: 'delete',
    requestId: makeThreadActionRequestId(),
    ...(threadGroupId ? { threadGroupId } : {}),
    ...(threadId ? { threadId } : {}),
  };
}

/**
 * Copy Link is the canonical `copy_link` group action; the server returns the
 * versioned application URI and the renderer copies the acknowledged value.
 */
export function threadActionCopyLink(
  { threadGroupId, threadId }: { threadGroupId?: string; threadId?: string },
): ThreadActionCopyLink {
  return {
    type: 'thread:action',
    action: 'copy_link',
    requestId: makeThreadActionRequestId(),
    ...(threadGroupId ? { threadGroupId } : {}),
    ...(threadId ? { threadId } : {}),
  };
}

/**
 * View Markdown is the canonical exact-member `view_markdown` action; the
 * server returns the validated mirror path through ThreadManager.
 */
export function threadActionViewMarkdown(
  { threadGroupId, threadId }: { threadGroupId?: string; threadId?: string },
): ThreadActionViewMarkdown {
  return {
    type: 'thread:action',
    action: 'view_markdown',
    requestId: makeThreadActionRequestId(),
    ...(threadGroupId ? { threadGroupId } : {}),
    ...(threadId ? { threadId } : {}),
  };
}

/**
 * `move_chat_to_side` is the SPEC-04 group action. It carries only durable
 * group/member identities plus the exact observed primary sequence; workspace
 * is server-derived and view comes from the group, so no authority field is
 * sent (SPEC-04 §4).
 */
export function threadActionMoveChatToSide(
  { threadGroupId, threadId, expectedPrimarySequence }:
  { threadGroupId: string; threadId: string; expectedPrimarySequence: number },
): ThreadActionMoveChatToSide {
  return {
    type: 'thread:action',
    action: 'move_chat_to_side',
    requestId: makeThreadActionRequestId(),
    threadGroupId,
    threadId,
    expectedPrimarySequence,
  };
}

/**
 * `set_harness_selection` is the exact-member session action. The envelope
 * carries only portable `model` and nullable `variant`; the session's harness
 * binding stays server-owned and immutable through this action (§6.2,
 * CHAT-I-031). A fresh `requestId` correlates the exact-session acknowledgement.
 */
export function threadActionSetHarnessSelection(
  {
    threadGroupId,
    threadId,
    model,
    variant,
  }: { threadGroupId?: string; threadId: string; model: string; variant: string | null },
): ThreadActionSetHarnessSelection {
  return {
    type: 'thread:action',
    action: 'set_harness_selection',
    requestId: makeThreadActionRequestId(),
    ...(threadGroupId ? { threadGroupId } : {}),
    ...(threadId ? { threadId } : {}),
    model,
    variant,
  };
}
