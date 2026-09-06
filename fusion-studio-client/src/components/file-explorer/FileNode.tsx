import type { FileTreeNode } from '../../types/file-explorer';
import { getFileIcon, formatNodeName } from '../../lib/file-utils';
import { useFileDataStore } from '../../state/fileDataStore';
import { loadFileContent } from '../../lib/file-tree';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

interface FileNodeProps {
  node: FileTreeNode;
  depth: number;
}

export function FileNode({ node, depth }: FileNodeProps) {
  const isThisFileLoading = useFileDataStore((s) => s.pendingContents.has(`file-viewer:${node.path}`));

  const icon = getFileIcon(node.extension);
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  function handleClick() {
    if (isThisFileLoading) return;
    loadFileContent({
      name: node.name,
      path: node.path,
      type: 'file',
      extension: node.extension,
      isSymlink: node.isSymlink,
      symlinkTarget: node.symlinkTarget,
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
