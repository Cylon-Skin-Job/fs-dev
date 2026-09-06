import { useEffect, useMemo } from 'react';
import { useFileStore } from '../../state/fileStore';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import {
  hydrateFileViewerActivity,
  loadExpandedFolders,
  loadRootTree,
} from '../../lib/file-tree';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import { RightColResize } from '../ResizeHandle';
import { normalizeViewActivity } from '../../lib/viewActivity';
import type { FileTreeNode } from '../../types/file-explorer';
import { useWorkspaceStore } from '../../state/workspaceStore';

export function FileExplorer() {
  useViewLayoutStyles('file-viewer');

  const viewMode = useFileStore((s) => s.viewMode);
  const showHiddenFolders = useFileStore((s) => s.showHiddenFolders);
  const toggleHiddenFolders = useFileStore((s) => s.toggleHiddenFolders);
  const rootNodes = useFileDataStore((s) => s.trees['file-viewer:']) as FileTreeNode[] | undefined;
  const pendingTrees = useFileDataStore((s) => s.pendingTrees);
  const treeErrors = useFileDataStore((s) => s.treeErrors);
  const contentErrors = useFileDataStore((s) => s.contentErrors);
  const ws = usePanelStore((s) => s.ws);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaceEpoch = useWorkspaceStore((s) => s.workspaceEpoch);
  const readProtocolVersion = useWorkspaceStore((s) => s.fileViewerReadProtocolVersion);
  const rawFileActivity = usePanelStore((s) => s.viewStates['file-viewer']?.activity);
  const fileActivity = useMemo(() => normalizeViewActivity(rawFileActivity), [rawFileActivity]);
  const isLoading = pendingTrees.has('file-viewer:');
  const error = treeErrors['file-viewer:']
    ?? Object.entries(treeErrors).find(([key]) => key.startsWith('file-viewer:'))?.[1]
    ?? Object.entries(contentErrors).find(([key]) => key.startsWith('file-viewer:'))?.[1]
    ?? null;

  function handleToggleHiddenFolders() {
    toggleHiddenFolders();
    loadRootTree(true);
    loadExpandedFolders(true);
  }

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

      {/* Right sidebar: file tree. Left edge has a resize handle that writes
       * to viewStates[file-viewer].widths.rightSecondary — the same width
       * variable the sticky secondary chat uses. Drag either and both resize. */}
      <div className="rv-file-tree-sidebar">
        <RightColResize panel="file-viewer" />
        {error && (
          <div className="rv-file-explorer-error">
            <span className="material-symbols-outlined rv-icon-md">error</span>
            <span>{error}</span>
          </div>
        )}
        {isLoading && (rootNodes?.length ?? 0) === 0 ? (
          <div className="rv-file-explorer-loading">
            <span className="rv-dim-label">Loading files...</span>
          </div>
        ) : (
          <div className="rv-file-explorer">
            <FileTree nodes={rootNodes ?? []} />
          </div>
        )}
        <div className="rv-file-tree-footer" aria-hidden="false">
          <button
            type="button"
            className="rv-file-hidden-toggle"
            aria-label={showHiddenFolders ? 'Hide hidden folders' : 'Show hidden folders'}
            aria-pressed={showHiddenFolders}
            title={showHiddenFolders ? 'Hide hidden folders' : 'Show hidden folders'}
            onClick={handleToggleHiddenFolders}
          >
            <span className="material-symbols-outlined">{showHiddenFolders ? 'folder_off' : 'folder_eye'}</span>
            <span>Toggle Hidden</span>
          </button>
        </div>
      </div>
    </div>
  );
}
