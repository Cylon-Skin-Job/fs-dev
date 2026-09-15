/**
 * @module worksurface/sideChatViews
 * @role Code-owned client mirror of the server's chat-capable view set
 *       (SPEC-04 §6/§11 04B/04C).
 *
 * Keep in lockstep with `fusion-studio-server/lib/thread-groups/chat-capable-views.js`.
 * Used by the reconnect placement sweep so an existing open placement on an
 * unbound/dockless adapterless view (Issues/Agents/Browser) materializes after
 * relaunch without an action frame, through the accepted qualified
 * `thread:list` read plus per-group worksurface entry reads (`SPEC-04 §7`).
 * This is not a transport family and never widens the Generic Host.
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
