import { useState, useEffect, useRef } from 'react';
import type { FileTreeNode } from '../../types/file-explorer';
import { formatNodeName } from '../../lib/file-utils';
import { useFileStore } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import { FileTree } from './FileTree';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

interface FolderNodeProps {
  node: FileTreeNode;
  depth: number;
}

export function FolderNode({ node, depth }: FolderNodeProps) {
  const expandedFolders = useFileStore((s) => s.expandedFolders);
  const folderChildren = useFileStore((s) => s.folderChildren);
  const showHiddenFolders = useFileStore((s) => s.showHiddenFolders);
  const isLoading = useFileStore((s) => s.isLoading);
  const ws = usePanelStore((s) => s.ws);
  const wsRef = useRef(ws);
  
  // Keep wsRef current without triggering re-renders
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);
  
  // Local loading state for this specific folder
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);

  const isExpanded = expandedFolders.has(node.path);
  const children = folderChildren.get(node.path);
  const hasChildrenLoaded = children !== undefined;
  const isHiddenFolder = node.name.startsWith('.');
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  // Auto-fetch children when:
  // - Folder is expanded
  // - We don't have children cached
  // - WebSocket is connected
  useEffect(() => {
    const currentWs = wsRef.current;
    if (isExpanded && !hasChildrenLoaded && node.hasChildren && currentWs?.readyState === WebSocket.OPEN) {
      setIsLoadingChildren(true);
      
      const loadChildren = async () => {
        try {
          const response = await new Promise<FileTreeNode[]>((resolve, reject) => {
            const handleMessage = (event: MessageEvent) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'file_tree_response' && msg.path === node.path) {
                  currentWs.removeEventListener('message', handleMessage);
                  if (msg.success) {
                    resolve(msg.nodes);
                  } else {
                    reject(new Error(msg.error || 'Failed to load'));
                  }
                }
              } catch {
                // Ignore parse errors
              }
            };
            currentWs.addEventListener('message', handleMessage);
            currentWs.send(JSON.stringify({
              type: 'file_tree_request',
              panel: 'file-viewer',
              path: node.path,
              includeHiddenFolders: showHiddenFolders,
            }));
            // Timeout after 5 seconds
            setTimeout(() => {
              currentWs.removeEventListener('message', handleMessage);
              reject(new Error('Timeout'));
            }, 5000);
          });
          
          useFileStore.getState().setFolderChildren(node.path, response);
        } catch (err) {
          console.error('Failed to load folder:', err);
        } finally {
          setIsLoadingChildren(false);
        }
      };
      
      loadChildren();
    }
    // Intentionally exclude 'ws' from deps - use wsRef to avoid re-triggering
     
  }, [isExpanded, hasChildrenLoaded, node.path, node.hasChildren, showHiddenFolders]);

  // Icon logic per spec
  let icon: string;
  let iconClass: string;
  if (node.isSymlink) {
    icon = 'folder_special';
    iconClass = 'rv-tree-icon';
  } else if (isHiddenFolder) {
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

  async function handleClick() {
    if (isLoading || isLoadingChildren) return;
    
    if (isExpanded) {
      // Collapse: remove from expanded set (keep children in cache)
      useFileStore.getState().collapseFolder(node.path);
    } else {
      // Expand: children will be auto-fetched by useEffect if not cached
      useFileStore.getState().expandFolder(node.path);
    }
  }

  const showLoading = isLoading || isLoadingChildren;

  return (
    <div className="folder-node">
      <div
        className={`rv-file-tree-item${showLoading ? ' disabled' : ''}${isHiddenFolder ? ' rv-file-tree-item--hidden-folder' : ''}`}
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
