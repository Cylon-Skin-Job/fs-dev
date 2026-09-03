import { useFileStore, fileTabId } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { FileContentRenderer } from './FileContentRenderer';

function getFileBreadcrumb(path: string): { folders: string[]; fileName: string } {
  const visibleParts = path.split('/').filter(Boolean).slice(-3);
  return {
    folders: visibleParts.slice(0, -1),
    fileName: visibleParts.at(-1) ?? path,
  };
}

export function FileViewer() {
  const tabs = useFileStore((s) => s.tabs);
  const activeTabPath = useFileStore((s) => s.activeTabPath);
  const fileTreeCollapsed = usePanelStore(
    (s) => s.viewStates['file-viewer']?.collapsed?.rightCol ?? false,
  );
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const activeTab = tabs.find((tab) => fileTabId(tab) === activeTabPath) ?? null;

  if (!activeTab || !activeTabPath) return null;

  if (activeTab.kind === 'home') {
    return (
      <div className="rv-file-viewer">
        <div className="rv-file-viewer-content rv-file-explorer-empty">
          <span className="material-symbols-outlined" aria-hidden="true">description</span>
          <span>Select File</span>
        </div>
      </div>
    );
  }

  const selectedFile = activeTab.file;
  const fileContent = activeTab.content;
  const isLoading = activeTab.loading;
  const symlinkTooltip = selectedFile.isSymlink && selectedFile.symlinkTarget
    ? `This resource is linked. Source: ${selectedFile.symlinkTarget}. Edits here update the same underlying file.`
    : null;
  const fileBreadcrumb = getFileBreadcrumb(selectedFile.path);

  return (
    <div className="rv-file-viewer">
      <div className="rv-file-viewer-info">
        <div
          className="info-item rv-file-breadcrumb"
          aria-label={selectedFile.path}
          title={selectedFile.path}
        >
          {fileBreadcrumb.folders.map((folder, index) => (
            <span className="rv-file-breadcrumb-part" key={`${folder}-${index}`}>
              <span className="rv-file-breadcrumb-folder">{folder}</span>
              <span className="rv-file-breadcrumb-separator" aria-hidden="true">&gt;</span>
            </span>
          ))}
          <span className="rv-file-breadcrumb-filename">{fileBreadcrumb.fileName}</span>
        </div>
        {symlinkTooltip && (
          <div className="info-item" title={symlinkTooltip}>
            <span className="material-symbols-outlined">folder_match</span>
            <span>Symlink</span>
          </div>
        )}
        <button
          type="button"
          className="rv-view-layout-control rv-file-tree-dock-control"
          aria-label={fileTreeCollapsed ? 'Show file tree' : 'Hide file tree'}
          aria-expanded={!fileTreeCollapsed}
          title={fileTreeCollapsed ? 'Show file tree' : 'Hide file tree'}
          onClick={() => toggleCollapsed('file-viewer', 'rightCol')}
        >
          <span className="material-symbols-outlined">dock_to_left</span>
        </button>
      </div>

      <div className={`rv-file-viewer-content${isLoading ? ' loading' : ''}`}>
        <FileContentRenderer
          content={fileContent}
          extension={selectedFile.extension}
          fileName={selectedFile.name}
        />
      </div>

      <FloatingPathActions
        panel="file-viewer"
        relativePath={selectedFile.path}
        className="rv-file-floating-actions"
        copyTitle="Copy file path"
        sendTitle="Send file path to chat"
        ariaLabel="File actions"
      />
    </div>
  );
}
