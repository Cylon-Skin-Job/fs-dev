import { useEffect } from 'react';
import type { FileTreeNode } from '../../types/file-explorer';
import { formatNodeName } from '../../lib/file-utils';
import { useFileStore } from '../../state/fileStore';
import { useFileDataStore } from '../../state/fileDataStore';
import { loadFolderChildren } from '../../lib/file-tree';
import { FileTree } from './FileTree';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

interface FolderNodeProps {
  node: FileTreeNode;
  depth: number;
}

export function FolderNode({ node, depth }: FolderNodeProps) {
  const expandedFolders = useFileStore((s) => s.expandedFolders);
  const showHiddenFolders = useFileStore((s) => s.showHiddenFolders);

  const isExpanded = expandedFolders.has(node.path);
  const treeKey = `file-viewer:${node.path}`;
  const children = useFileDataStore((s) => s.trees[treeKey]) as FileTreeNode[] | undefined;
  const isLoadingChildren = useFileDataStore((s) => s.pendingTrees.has(treeKey));
  const hasChildrenLoaded = children !== undefined;
  const isHiddenFolder = node.name.startsWith('.');
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  // Auto-fetch children when:
  // - Folder is expanded
  // - We don't have children cached
  useEffect(() => {
    if (isExpanded && !hasChildrenLoaded && !isLoadingChildren && node.hasChildren) {
      loadFolderChildren(node.path);
    }
  }, [isExpanded, hasChildrenLoaded, isLoadingChildren, node.path, node.hasChildren, showHiddenFolders]);

  // Tree rows intentionally do not expose symlink chrome.
  let icon: string;
  let iconClass: string;
  if (isHiddenFolder) {
    icon = 'folder_eye';
    iconClass = 'rv-tree-icon';
  } else if (isExpanded) {
    icon = 'folder_open';
    iconClass = 'rv-tree-icon';
  } else if (node.hasChildren) {
    icon = 'folder';
    iconClass = 'rv-tree-icon folder-filled';
  } else {
    icon = 'folder';
    iconClass = 'rv-tree-icon folder-outline';
  }

  function handleClick() {
    if (isLoadingChildren) return;

    if (isExpanded) {
      // Collapse: remove from expanded set (keep children in cache)
      useFileStore.getState().collapseFolder(node.path);
    } else {
      // Expand: children will be auto-fetched by useEffect if not cached
      useFileStore.getState().expandFolder(node.path);
    }
  }

  return (
    <div className="folder-node">
      <div
        className={`rv-file-tree-item${isLoadingChildren ? ' disabled' : ''}${isHiddenFolder ? ' rv-file-tree-item--hidden-folder' : ''}`}
        style={{ '--tree-indent': paddingLeft } as React.CSSProperties}
        onClick={handleClick}
      >
        <span className={`material-symbols-outlined ${iconClass}`}>
          {icon}
        </span>
        <span className="rv-tree-label">{formatNodeName(node.name)}</span>
        {isLoadingChildren && <span className="loading-indicator">...</span>}
        <div className="rv-file-tree-item-actions" onClick={(e) => e.stopPropagation()}>
          <CopyPathButton
            panel="file-viewer"
            relativePath={node.path}
            className="rv-file-page-action"
            title="Copy folder path"
          />
          <SendToChatButton
            panel="file-viewer"
            relativePath={node.path}
            className="rv-file-page-action"
            title="Send folder path to chat"
          />
        </div>
      </div>
      {isExpanded && hasChildrenLoaded && children && children.length > 0 && (
        <div className="folder-children">
          <FileTree nodes={children} depth={depth + 1} />
        </div>
      )}
      {isExpanded && hasChildrenLoaded && children && children.length === 0 && (
        <div className="folder-children">
          <div className="rv-file-tree-empty" style={{ '--tree-indent': `${0.75 + (depth + 1) * 1.25}rem` } as React.CSSProperties}>
            <span className="rv-file-tree-empty-label">Empty folder</span>
          </div>
        </div>
      )}
    </div>
  );
}
