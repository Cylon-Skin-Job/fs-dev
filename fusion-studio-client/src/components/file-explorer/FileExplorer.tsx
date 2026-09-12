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
    hydrateFileViewerActivity(fileActivity);
  }, [fileActivity, rawFileActivity, workspaceEpoch]);

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
       * has a resize handle that writes to viewStates[file-viewer].widths.
       * rightSecondary — the same width variable the sticky secondary chat
       * uses. Drag either and both resize. */}
      <FileTreeDrawer />
    </div>
  );
}
