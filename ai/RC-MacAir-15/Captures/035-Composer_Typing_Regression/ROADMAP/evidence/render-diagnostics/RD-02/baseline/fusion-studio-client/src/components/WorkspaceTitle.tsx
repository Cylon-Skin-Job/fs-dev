/**
 * @module WorkspaceTitle
 * @role Header center title with left/right chevron buttons.
 *
 * Reads active workspace from store. Pure presentation — all actions
 * delegate to workspaceStore.
 */

import { useWorkspaceStore } from '../state/workspaceStore';
import './WorkspaceTitle.css';

export function WorkspaceTitle() {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );

  if (!activeWorkspace) {
    return (
      <div className="rv-header-center">
        <button
          className="rv-header-center-title"
          onClick={() => useWorkspaceStore.getState().toggleRibbon()}
          type="button"
          title="Open workspace ribbon"
        >
          <span className="rv-workspace-name">No workspace selected</span>
        </button>
      </div>
    );
  }

  return (
    <div className="rv-header-center">
      <button
        className="rv-header-nav-btn"
        onClick={() => useWorkspaceStore.getState().cycleWorkspace('left')}
        type="button"
        title="Previous workspace"
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>
      <button
        className="rv-header-center-title"
        onClick={() => useWorkspaceStore.getState().toggleRibbon()}
        type="button"
        title="Switch workspace"
      >
        <span className="rv-workspace-name">{activeWorkspace.label}</span>
      </button>
      <button
        className="rv-header-nav-btn"
        onClick={() => useWorkspaceStore.getState().cycleWorkspace('right')}
        type="button"
        title="Next workspace"
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  );
}
