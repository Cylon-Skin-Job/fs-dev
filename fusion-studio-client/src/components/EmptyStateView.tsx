/**
 * @module EmptyStateView
 * @role Rendered when no active workspace exists.
 *
 * Shown on first-run or after removing the last ribbon-visible workspace.
 * The ribbon remains mounted, so users can restore hidden workspaces from
 * its Add dropdown or open the add-workspace modal from this tile.
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
        <span className="rv-empty-state-label">No workspaces in ribbon</span>
        <span className="rv-empty-state-copy">
          Use Add in the workspace ribbon to restore a hidden workspace, add a project, or create a new one.
        </span>
      </button>
    </div>
  );
}
