'use strict';

// Canonical thread-action validation and response serialization.
function boundedActionError(code) {
  switch (code) {
    case 'group_busy': return 'Thread has an active conversation';
    case 'request_mismatch': return 'Request reused with different input';
    case 'not_found': return 'Thread not found';
    case 'invalid_name': return 'Thread name is invalid';
    case 'invalid_action': return 'Unsupported thread action';
    case 'invalid_link': return 'Thread link is invalid';
    case 'invalid_selection': return 'Model selection is not available';
    case 'selection_unavailable': return 'Model selection is not available';
    case 'request_invalid': return 'Action requires a bounded requestId';
    case 'invalid_request': return 'Action request is invalid';
    case 'not_primary': return 'Only the current Main Chat can be moved';
    case 'stale_primary': return 'The conversation changed; try again';
    case 'view_not_supported': return 'This view cannot host a Side Chat';
    case 'member_unavailable': return 'That Side Chat is not available';
    case 'placement_unavailable': return 'The Side Chat could not be opened';
    case 'view_id_preflight_repair_required': return 'View identity repair required';
    default: return 'Thread action failed';
  }
}

function buildActionErrorFrame(clientMsg, code) {
  return {
    type: 'thread:action:error',
    requestId: typeof clientMsg?.requestId === 'string' ? clientMsg.requestId : null,
    action: clientMsg?.action ?? null,
    threadGroupId: clientMsg?.threadGroupId ?? null,
    ...(clientMsg?.threadId ? { threadId: clientMsg.threadId } : {}),
    code,
    message: boundedActionError(code),
  };
}

/**
 * One canonical completion envelope. Durable identities only; `surfaceId` is
 * never built, persisted, echoed, or fanned out (`BRIDGE-02` §4.2/§4.5).
 */
function buildActionCompletedFrame(outcome, { requestId, action, fanOut = false }) {
  const result = outcome?.result || {};
  return {
    type: 'thread:action:completed',
    requestId,
    action,
    threadGroupId: result.threadGroupId ?? null,
    threadId: result.threadId ?? null,
    workspaceId: result.workspaceId ?? null,
    viewId: result.viewId ?? null,
    context: result.context ?? null,
    ...(fanOut ? { fanOut: true } : {}),
    ...(action === 'rename' ? { name: result.name ?? null } : {}),
    ...(action === 'delete'
      ? {
        deleted: true,
        recovered: Boolean(outcome?.recovered || result.recovered),
        replayed: Boolean(outcome?.replayed || result.replayed),
        cleanup: result.cleanup ?? null,
        viewStateCleanup: result.viewStateCleanup ?? null,
        members: result.members ?? [],
      }
      : {}),
    ...(action === 'copy_link'
      ? { link: result.link ?? null }
      : {}),
    ...(action === 'resolve_link'
      ? {
        resolved: true,
        ...(result.targetMemberThreadId
          ? {
            targetMemberThreadId: result.targetMemberThreadId,
            sideChatPlacementId: result.sideChatPlacementId ?? null,
            placementStatus: result.placementStatus ?? null,
          }
          : {}),
      }
      : {}),
    ...(action === 'view_markdown'
      ? { markdownPath: result.markdownPath ?? null }
      : {}),
    ...(action === 'set_harness_selection'
      ? {
        harnessId: result.harnessId ?? null,
        model: result.model ?? null,
        variant: result.variant ?? null,
      }
      : {}),
    ...(action === 'move_chat_to_side'
      ? {
        movedThreadId: result.movedThreadId ?? null,
        newMainThreadId: result.newMainThreadId ?? null,
        currentPrimarySequence: result.currentPrimarySequence ?? null,
        sideChatPlacementId: result.sideChatPlacementId ?? null,
        placementStatus: result.placementStatus ?? null,
        placement: result.placement ?? null,
        replayed: Boolean(outcome?.replayed || result.replayed),
      }
      : {}),
    ...(action === 'open_member_in_side'
      ? {
        sideChatPlacementId: result.sideChatPlacementId ?? null,
        placementStatus: result.placementStatus ?? null,
        focused: Boolean(result.focused),
        replayed: Boolean(outcome?.replayed || result.replayed),
      }
      : {}),
  };
}

/** Canonical durable `thread:action` names owned by this route. */
const DURABLE_THREAD_ACTIONS = Object.freeze(new Set([
  'rename',
  'delete',
  'copy_link',
  'resolve_link',
  'view_markdown',
  'set_harness_selection',
  'move_chat_to_side',
  'open_member_in_side',
  'prompt_receipt_status',
]));

/**
 * Exact allowed payload key set for one member access (`SPEC-04 §8`). Like
 * Move, workspace and view authority are server-derived; only durable
 * group/member identities plus the fail-open `context` are accepted.
 */
const OPEN_MEMBER_ACTION_KEYS = Object.freeze(new Set([
  'type', 'action', 'requestId', 'threadGroupId', 'threadId', 'context',
]));

/**
 * Exact allowed payload key set for one Move (`SPEC-04 §4`). Redundant client
 * workspace/view authority fields are schema-rejected: workspace is
 * server-derived from the bound connection and view from the group. `context`
 * is the fail-open durable `ChatActionContext` portion only.
 */
const MOVE_ACTION_KEYS = Object.freeze(new Set([
  'type', 'action', 'requestId', 'threadGroupId', 'threadId',
  'expectedPrimarySequence', 'context',
]));

function hasRedundantMoveAuthority(clientMsg) {
  return Object.keys(clientMsg).some((key) => !MOVE_ACTION_KEYS.has(key));
}

function hasRedundantMemberAuthority(clientMsg) {
  return Object.keys(clientMsg).some((key) => !OPEN_MEMBER_ACTION_KEYS.has(key));
}


module.exports = { boundedActionError, buildActionErrorFrame, buildActionCompletedFrame, DURABLE_THREAD_ACTIONS, hasRedundantMoveAuthority, hasRedundantMemberAuthority };
