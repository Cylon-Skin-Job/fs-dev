/**
 * @module ViewWorksurfaceDock
 * @role Production view chrome for one view-capable worksurface (CHAT-03 /
 *       SPEC-03 §10 03A).
 *
 * Mounts the accepted SPEC-02 `ViewChatHost` (one `ThreadedChat` = `ThreadRail`
 * + selected group's `ChatSurface`) against the exact `{workspaceId, viewId}`
 * population. The rail is the production group-selection path: selecting a
 * group drives the acknowledgement-gated worksurface switch in the connected
 * host. The dock is collapsed by default so the existing Legacy production
 * composition and visual language are preserved. SPEC-04 §6 composes managed
 * Side Chat placements into the view's own tab rail (the code-owned bridge),
 * not into this dock.
 */

import { usePanelStore } from '../../state/panelStore';
import { getWorksurfaceDockOpen } from '../../state/slices/worksurfaceSlice';
import { ViewChatHost } from './ViewChatHost';
import { WorksurfaceConflictBanner } from './WorksurfaceConflictBanner';
import './ViewWorksurfaceDock.css';

export interface ViewWorksurfaceDockProps {
  panel: string;
  workspaceId: string;
  viewId: string;
  isActive?: boolean;
}

export function ViewWorksurfaceDock({
  panel,
  workspaceId,
  viewId,
  isActive = true,
}: ViewWorksurfaceDockProps) {
  // SPEC-04 §3: the rail dock state is store-keyed by `{workspaceId, viewId}`
  // so a Side Chat's list button can operate this exact outer rail.
  const open = usePanelStore((state) => getWorksurfaceDockOpen(state, workspaceId, viewId));

  return (
    <div
      className="rv-worksurface-dock"
      data-worksurface-dock={viewId}
      data-open={open ? 'true' : 'false'}
    >
      {/* Non-destructive conflict projection: always visible, even collapsed. */}
      <WorksurfaceConflictBanner workspaceId={workspaceId} viewId={viewId} />
      <button
        type="button"
        className="rv-worksurface-dock-toggle"
        aria-expanded={open}
        aria-label="View threads"
        title="View threads"
        onClick={() => usePanelStore
          .getState()
          .setWorksurfaceDockOpen(workspaceId, viewId, !open)}
      >
        <span className="material-symbols-outlined">forum</span>
        <span className="rv-worksurface-dock-label">View Threads</span>
      </button>
      {open && (
        <div className="rv-worksurface-dock-panel">
          <ViewChatHost
            panel={panel}
            workspaceId={workspaceId}
            viewId={viewId}
            isActive={isActive}
          />
        </div>
      )}
    </div>
  );
}
