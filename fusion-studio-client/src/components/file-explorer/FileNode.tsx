import type { FileTreeNode } from '../../types/file-explorer';
import { getFileIcon, formatNodeName } from '../../lib/file-utils';
import { useFileStore } from '../../state/fileStore';
import { loadFileContent } from '../../hooks/useFileTree';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

interface FileNodeProps {
  node: FileTreeNode;
  depth: number;
}

export function FileNode({ node, depth }: FileNodeProps) {
  const isThisFileLoading = useFileStore((s) =>
    s.tabs.some((t) => t.file.path === node.path && t.loading),
  );

  const icon = getFileIcon(node.extension);
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  function handleClick() {
    if (isThisFileLoading) return;
    loadFileContent({
      name: node.name,
      path: node.path,
      type: 'file',
      extension: node.extension,
    });
  }

  return (
    <div
      className={`rv-file-tree-item${isThisFileLoading ? ' disabled' : ''}`}
      style={{ '--tree-indent': paddingLeft } as React.CSSProperties}
      onClick={handleClick}
    >
      <span className={`material-symbols-outlined rv-tree-icon icon-${icon}`}>
        {icon}
      </span>
      <span className="rv-tree-label">{formatNodeName(node.name)}</span>
      <div className="rv-file-tree-item-actions" onClick={(e) => e.stopPropagation()}>
        <CopyPathButton
          panel="file-viewer"
          relativePath={node.path}
          className="rv-file-page-action"
          title="Copy file path"
        />
        <SendToChatButton
          panel="file-viewer"
          relativePath={node.path}
          className="rv-file-page-action"
          title="Send file path to chat"
        />
      </div>
    </div>
  );
}
