/**
 * @module worksurface/worksurfaceController
 * @role Public facade for connected group-worksurface orchestration
 *       (CHAT-03 / SPEC-03 §6–§7).
 *
 * 03B-D8 recorded that this module had grown to 895 lines. Slice 03D performs
 * the planned mechanical, behavior-identical extraction: the request-tracking
 * runtime, conflict classification, capture/request emission, switch/flush
 * operations, and registered-frame handling each live in a focused sibling
 * module behind this stable public API. Every consumer import path and export
 * name is unchanged.
 *
 * Ownership and invariants (SPEC-03 §6.1):
 *   1. freeze one immutable capture of the outgoing group's content;
 *   2. submit it with the last acknowledged opaque content revision;
 *   3. keep the outgoing group selected until correlated success;
 *   4. on success select/open the incoming group;
 *   5. request the exact `{workspaceId, viewId, threadGroupId}` entry;
 *   6. sanitize + restore, or preserve current/default for a missing entry.
 */

import './builtins';
import { usePanelStore } from '../../state/panelStore';
import { getWorksurfaceBinding } from '../../state/slices/worksurfaceSlice';
import { resetWorksurfaceRuntime } from './worksurfaceRuntime';
import {
  CAPTURE_VIEWER_CONTENT_KEYS,
  EMAIL_VIEWER_CONTENT_KEYS,
  OFFICE_VIEWER_CONTENT_KEYS,
} from './viewContentKeys';

/**
 * Elected top-level `ViewUIState` content keys per participating view. File
 * Viewer and Wiki Viewer elect only `activity`, which the ws-client hydration
 * guard already pins; the document viewers elect top-level keys.
 */
const BOUND_VIEW_CONTENT_KEYS: Record<string, ReadonlySet<string>> = {
  'capture-viewer': CAPTURE_VIEWER_CONTENT_KEYS as ReadonlySet<string>,
  'office-viewer': OFFICE_VIEWER_CONTENT_KEYS as ReadonlySet<string>,
  'email-viewer': EMAIL_VIEWER_CONTENT_KEYS as ReadonlySet<string>,
};

/** The elected content keys for a group-bound view (null when none). */
export function boundViewContentKeys(viewId: string): ReadonlySet<string> | null {
  return BOUND_VIEW_CONTENT_KEYS[viewId] ?? null;
}

export {
  WORKSURFACE_REQUEST_TIMEOUT_MS,
  setWorksurfaceRequestTimeout,
} from './worksurfaceRuntime';

export { worksurfaceAdapterForView } from './registry';

export {
  selectViewGroup,
  bindViewWorksurface,
  requestGroupSelection,
  onViewContentChanged,
  flushBoundView,
  flushBoundWorkspaceViews,
  completeSwitch,
} from './worksurfaceSwitch';

export {
  retryPendingWorksurfaceCapture,
  discardPendingWorksurfaceConflict,
  handleWorksurfaceResultFrame,
  handleWorksurfaceErrorFrame,
  handleWorksurfaceChangedFrame,
  reconcileWorksurfacesOnReconnect,
  reconcileSideChatPlacementsOnReconnect,
  requestWorksurfaceEntryRead,
  closeSideChatPlacement,
} from './worksurfaceFrames';

export function isViewWorksurfaceBound(workspaceId: string | null, viewId: string): boolean {
  const state = usePanelStore.getState();
  return getWorksurfaceBinding(state, workspaceId, viewId) !== null;
}

/** Test seam: clear all in-flight tracking. */
export function resetWorksurfaceController(): void {
  resetWorksurfaceRuntime();
}
