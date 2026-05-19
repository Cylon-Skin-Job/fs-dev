import type { FileTreeNode as FileTreeNodeType } from '../../types/file-explorer';
import { FileTreeNode } from './FileTreeNode';

interface FileTreeProps {
  nodes: FileTreeNodeType[];
  depth?: number;
}

export function FileTree({ nodes, depth = 0 }: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="rv-file-tree-empty" style={{ '--tree-indent': `${0.75 + depth * 1.25}rem` } as React.CSSProperties}>
        <span className="rv-file-tree-empty-label">Empty folder</span>
      </div>
    );
  }

  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} depth={depth} />
      ))}
    </div>
  );
}
