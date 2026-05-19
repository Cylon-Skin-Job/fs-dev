import { useEffect } from 'react';
import { useFileStore } from '../../state/fileStore';
import { useFileTreeListener, loadExpandedFolders } from '../../hooks/useFileTree';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';
import { RightColResize } from '../ResizeHandle';

export function FileExplorer() {
  useViewLayoutStyles('file-viewer');

  const viewMode = useFileStore((s) => s.viewMode);
  const rootNodes = useFileStore((s) => s.rootNodes);
  const isLoading = useFileStore((s) => s.isLoading);
  const error = useFileStore((s) => s.error);

  // Single WebSocket listener for file operations
  useFileTreeListener();

  // Keep expanded folders loaded whenever tree is visible
  useEffect(() => {
    loadExpandedFolders();
  }, []);

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
        {isLoading && rootNodes.length === 0 ? (
          <div className="rv-file-explorer-loading">
            <span className="rv-dim-label">Loading files...</span>
          </div>
        ) : (
          <div className="rv-file-explorer">
            <FileTree nodes={rootNodes} />
          </div>
        )}
      </div>
    </div>
  );
}
