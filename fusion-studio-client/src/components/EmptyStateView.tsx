/**
 * @module EmptyStateView
 * @role Rendered when no active workspace exists.
 *
 * Shown on first-run (or after removing the last workspace). One action:
 * open the add-workspace modal. The switcher is still reachable via the
 * menu button in the header, so the user can also paste a path from there.
 *
 * See docs/WORKSPACE_CLIENT_UI_SPEC.md §7.
 */

import { useWorkspaceStore } from '../state/workspaceStore';
import './EmptyStateView.css';

export function EmptyStateView() {
  const openAddModal = useWorkspaceStore((s) => s.openAddModal);

  return (
    <div className="rv-empty-state">
      <button
        className="rv-empty-state-tile"
        onClick={openAddModal}
        type="button"
      >
        <span className="material-symbols-outlined rv-empty-state-icon">
          folder_open
        </span>
        <span className="rv-empty-state-label">Add Project</span>
      </button>
    </div>
  );
}
