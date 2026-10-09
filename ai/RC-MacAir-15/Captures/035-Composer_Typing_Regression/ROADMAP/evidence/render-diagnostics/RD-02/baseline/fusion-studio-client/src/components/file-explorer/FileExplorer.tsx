import { useEffect, useMemo } from 'react';
import { useFileStore } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import {
  hydrateFileViewerActivity,
  loadExpandedFolders,
  loadRootTree,
} from '../../lib/file-tree';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { FileTreeDrawer } from './FileTreeDrawer';
import { FileViewer } from './FileViewer';
import { normalizeViewActivity } from '../../lib/viewActivity';
import { getWorksurfaceBinding } from '../../state/slices/worksurfaceSlice';
import { useWorkspaceStore } from '../../state/workspaceStore';

export function FileExplorer() {
  useViewLayoutStyles('file-viewer');

  const viewMode = useFileStore((s) => s.viewMode);
  const ws = usePanelStore((s) => s.ws);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaceEpoch = useWorkspaceStore((s) => s.workspaceEpoch);
  const readProtocolVersion = useWorkspaceStore((s) => s.fileViewerReadProtocolVersion);
  const rawFileActivity = usePanelStore((s) => s.viewStates['file-viewer']?.activity);
  const fileActivity = useMemo(() => normalizeViewActivity(rawFileActivity), [rawFileActivity]);
  // CHAT-03 / SPEC-03 §5: while the File Viewer is bound to a Thread Group its
  // worksurface adapter/controller is the sole writer + hydrator of the tab
  // facts. The non-group/Legacy path must not hydrate over a group entry.
  const worksurfaceBound = usePanelStore(
    (s) => getWorksurfaceBinding(s, workspaceId ?? null, 'file-viewer') !== null,
  );

  // The central store owns response handling; this effect only requests the
  // current root after an initial bind or replacement socket becomes usable.
  useEffect(() => {
    if (
      currentPanel !== 'file-viewer'
      || ws?.readyState !== WebSocket.OPEN
      || !workspaceId
      || !workspaceEpoch
      || readProtocolVersion !== 1
    ) return;
    loadRootTree(false);
    loadExpandedFolders(false);
  }, [currentPanel, readProtocolVersion, workspaceEpoch, workspaceId, ws]);

  useEffect(() => {
    if (!rawFileActivity) return;
    // Group-bound: the controller restores the exact acknowledged entry; a
    // global/top-level activity response can never hydrate over it.
    if (worksurfaceBound) return;
    hydrateFileViewerActivity(fileActivity);
  }, [fileActivity, rawFileActivity, workspaceEpoch, worksurfaceBound]);

  return (
    <div className="rv-file-explorer-layout">
      {/* Main viewer area */}
      <div className="rv-file-explorer-main">
        {viewMode === 'viewer' ? (
          <FileViewer />
        ) : (
          <div className="rv-file-explorer-empty">
            <span className="material-symbols-outlined">description</span>
            <span>Select a file to view</span>
          </div>
        )}
      </div>

      {/* Right sidebar: the shared file-tree drawer (also rendered by the
       * connected File presenters and the picker reveal overlay). Left edge
       * has a resize handle that writes to viewStates[file-viewer].widths.rightCol. */}
      <FileTreeDrawer />
    </div>
  );
}
