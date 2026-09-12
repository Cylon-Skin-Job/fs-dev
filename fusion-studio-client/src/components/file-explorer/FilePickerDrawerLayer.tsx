import { FileTreeDrawer } from './FileTreeDrawer';
import './FilePickerDrawerLayer.css';

/**
 * VIEW-02 Slice 4 (§5 model) — host for the accepted file-tree drawer while a
 * File Empty tab is ACTIVE. The drawer is the ONLY way an Empty tab is
 * filled, so it is reachable for the whole active-Empty state (subsuming the
 * original `file.open` reservation-pending case, VRT-011A, SPEC-02 §5/§10).
 *
 * The generic empty-tab body (EmptyTabPanel) hosts only the view-supplied
 * Empty-body presenter, so this File-owned layer mounts as a child of the
 * shell body (a flex sibling of the tab panel inside it): the drawer sits
 * exactly where the legacy layout places it and the file choice is actually
 * reachable. The drawer itself is the existing component — not redesigned
 * (SPEC-02 §3).
 */
export function FilePickerDrawerLayer() {
  return (
    <div className="rv-file-connected-picker-layer" data-file-picker-layer="true">
      <FileTreeDrawer />
    </div>
  );
}
