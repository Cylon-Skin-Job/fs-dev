/**
 * @module FileEmptyTabBody
 * @role VIEW-02 §6 — the File view's Empty-body presenter (the reference
 *       Empty pattern).
 *
 * File-specific vocabulary ("Open file" / "Select a file from the workspace
 * tree") stays in File-owned modules — the generic shell never renders it.
 * This component is supplied to the generic Empty surface through the File
 * connected adapter's bounded `renderEmptyBody` (analogous to first-party
 * component registrations). The drawer itself is hosted beside the panel by
 * the File connected adapter; this body only carries the reference copy and
 * the dock toggle (same `toggleCollapsed('file-viewer','rightCol')` seam as
 * the document presenter, so the user can collapse/re-open the drawer from
 * the Empty tab state).
 */

import { usePanelStore } from '../../state/panelStore';
import './FileEmptyTabBody.css';

export function FileEmptyTabBody() {
  const drawerClosed = usePanelStore(
    (s) => s.viewStates['file-viewer']?.collapsed?.rightCol ?? false,
  );
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);

  return (
    <div className="rv-file-empty-body" data-file-empty-body="true">
      <span
        className="material-symbols-outlined rv-file-empty-body-icon"
        aria-hidden="true"
      >
        folder
      </span>
      <h2 className="rv-file-empty-body-heading">Open file</h2>
      <p className="rv-file-empty-body-copy">Select a file from the workspace tree</p>

      <button
        type="button"
        className="rv-view-layout-control rv-file-tree-dock-control rv-file-empty-dock"
        aria-label={drawerClosed ? 'Show file tree' : 'Hide file tree'}
        aria-expanded={!drawerClosed}
        title={drawerClosed ? 'Show file tree' : 'Hide file tree'}
        onClick={() => toggleCollapsed('file-viewer', 'rightCol')}
      >
        <span className="material-symbols-outlined">dock_to_left</span>
      </button>
    </div>
  );
}
