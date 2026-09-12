import { useFileDataStore } from '../../state/fileDataStore';
import { useFileStore } from '../../state/fileStore';
import {
  loadExpandedFolders,
  loadRootTree,
} from '../../lib/file-tree';
import { FileTree } from './FileTree';
import { RightColResize } from '../ResizeHandle';
import type { FileTreeNode } from '../../types/file-explorer';

/**
 * The EXISTING File Explorer file-tree drawer (SPEC-02 §3: the drawer is not
 * redesigned). Extracted verbatim from `FileExplorer.tsx` so the legacy
 * surface, the connected document presenter, and the connected picker reveal
 * overlay all render exactly this accepted drawer: error/loading bounds, the
 * tree, the resize handle, and the hidden-folders footer.
 */
export function FileTreeDrawer() {
  const showHiddenFolders = useFileStore((s) => s.showHiddenFolders);
  const toggleHiddenFolders = useFileStore((s) => s.toggleHiddenFolders);
  const rootNodes = useFileDataStore((s) => s.trees['file-viewer:']) as FileTreeNode[] | undefined;
  const pendingTrees = useFileDataStore((s) => s.pendingTrees);
  const treeErrors = useFileDataStore((s) => s.treeErrors);
  const contentErrors = useFileDataStore((s) => s.contentErrors);
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

  return (
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
  );
}
