/**
 * @module office/officeViewerPersistence
 * @role Single persistence entry point for the Office Viewer's per-view state
 *       (CHAT-03 / SPEC-03 §5 view-writer cutover).
 *
 * While the Office Viewer is bound to a Thread Group its registered adapter is
 * the sole writer/hydrator of the elected content facts (mode, current folder,
 * selected document, document side panel). Those keys are routed into the
 * selected group's content lane; every non-content fact (e.g. paper brightness)
 * keeps the exact existing global `state:set` write. A non-group/Legacy view
 * keeps the exact existing behavior.
 */

import { usePanelStore } from '../../state/panelStore';
import { onViewContentChanged } from '../../lib/worksurface/worksurfaceController';
import { OFFICE_VIEWER_CONTENT_KEYS } from '../../lib/worksurface/officeViewerWorksurfaceAdapter';
import type { ViewUIState } from '../../types';

const OFFICE_PANEL = 'office-viewer';

function splitContentPatch(patch: Partial<ViewUIState>): {
  hasContent: boolean;
  displayPatch: Partial<ViewUIState>;
} {
  const displayPatch: Record<string, unknown> = {};
  let hasContent = false;
  for (const [key, value] of Object.entries(patch)) {
    if (OFFICE_VIEWER_CONTENT_KEYS.has(key as keyof ViewUIState)) {
      hasContent = true;
    } else {
      displayPatch[key] = value;
    }
  }
  return { hasContent, displayPatch: displayPatch as Partial<ViewUIState> };
}

export function persistOfficeViewPatch(patch: Partial<ViewUIState>): void {
  const store = usePanelStore.getState();
  store.setViewState(OFFICE_PANEL, patch);
  const { hasContent, displayPatch } = splitContentPatch(patch);
  // Group-bound: the adapter captures the full elected content from the store
  // (already updated above) and the global writer is skipped for those keys.
  if (hasContent && onViewContentChanged(OFFICE_PANEL)) {
    if (Object.keys(displayPatch).length > 0) {
      store._persistViewPatch(OFFICE_PANEL, displayPatch);
    }
    return;
  }
  store._persistViewPatch(OFFICE_PANEL, patch);
}
