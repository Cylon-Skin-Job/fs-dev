'use strict';

/**
 * @module thread-groups/chat-capable-views
 * @role Code-owned capability set of views that may host a Move Side Chat
 *       (SPEC-04 §6, §11 04B).
 *
 * SPEC-04 §6 requires every registered chat-enabled view to be either covered
 * by the code-owned Side Chat bridge or explicitly ineligible BEFORE the server
 * commits a Move. The client bridge (SPEC-04 §11 04B) covers exactly these
 * views:
 *
 *   - `file-viewer`, `capture-viewer` — native connected tab owners. The bridge
 *     preserves the adapter's native tabs and composes managed Side Chats into
 *     the same visible rail.
 *   - `wiki-viewer`, `office-viewer`, `email-viewer` — dock-backed worksurface
 *     views with a registered SPEC-03 content adapter but no native view tab
 *     adapter; the bridge activates only while a Side Chat placement exists and
 *     constructs a runtime-only root for the existing child.
 *   - `issues-viewer`, `agents-viewer`, `browser-viewer` — the SPEC-04 §6
 *     adapterless hosts; the same runtime-only root composition.
 *
 * Everything else the view registry can report — `system-viewer`,
 * `calendar-viewer`, `contacts-viewer`, `custom-viewer`, custom/iframe panels,
 * and any unknown id — is explicitly ineligible. The server rejects Move for a
 * group bound to one of those views with the existing classified
 * `view_not_supported` before any session, membership, primary event, activity,
 * outbox row, or action result is created. This module deliberately does NOT
 * widen the shared `resolveViewTarget` registry validation (view creation for
 * other views keeps its accepted behavior); it is consulted only by the Move
 * placement precommit.
 *
 * This is the single server owner of the capability set; the client bridge's
 * coverage is documented in `src/components/chat/sideChatBridge.ts`.
 */

const CHAT_CAPABLE_VIEW_IDS = Object.freeze(new Set([
  'file-viewer',
  'capture-viewer',
  'wiki-viewer',
  'office-viewer',
  'email-viewer',
  'issues-viewer',
  'agents-viewer',
  'browser-viewer',
]));

/** True when one registered view id may host a Move Side Chat. */
function isChatCapableView(viewId) {
  return typeof viewId === 'string' && CHAT_CAPABLE_VIEW_IDS.has(viewId);
}

module.exports = {
  CHAT_CAPABLE_VIEW_IDS,
  isChatCapableView,
};
