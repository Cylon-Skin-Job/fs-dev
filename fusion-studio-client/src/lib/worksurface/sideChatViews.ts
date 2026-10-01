/**
 * @module worksurface/sideChatViews
 * @role Code-owned client mirror of the server's chat-capable view set
 *       (SPEC-04 §6/§11 04B/04C).
 *
 * Keep in lockstep with `fusion-studio-server/lib/thread-groups/chat-capable-views.js`.
 * Used to admit exact per-group placement reads after the active view host's
 * qualified population response. Inactive/unbound views do not run a hidden
 * reconnect sweep; their persisted placement materializes when that exact view
 * becomes active. This never widens the Generic Host.
 */

export const SIDE_CHAT_CAPABLE_VIEW_IDS: ReadonlySet<string> = Object.freeze(new Set([
  'file-viewer',
  'capture-viewer',
  'wiki-viewer',
  'office-viewer',
  'email-viewer',
  'issues-viewer',
  'agents-viewer',
  'browser-viewer',
]));

/** True when one registered view may host a Move Side Chat. */
export function isSideChatCapableView(viewId: string): boolean {
  return typeof viewId === 'string' && SIDE_CHAT_CAPABLE_VIEW_IDS.has(viewId);
}
