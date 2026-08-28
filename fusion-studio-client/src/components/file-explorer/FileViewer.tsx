import { useFileStore } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { FileContentRenderer } from './FileContentRenderer';
import { isFileEditorTab } from '../../types/file-explorer';

function getFileBreadcrumb(path: string): { folders: string[]; fileName: string } {
  const visibleParts = path.split('/').filter(Boolean).slice(-3);
  return {
    folders: visibleParts.slice(0, -1),
    fileName: visibleParts.at(-1) ?? path,
  };
}

export function FileViewer() {
  const tabs = useFileStore((s) => s.tabs);
  const activeTabId = useFileStore((s) => s.activeTabId);
  const fileTreeCollapsed = usePanelStore(
    (s) => s.viewStates['file-viewer']?.collapsed?.rightCol ?? false,
  );
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  if (!activeTab) return null;

  const selectedFile = isFileEditorTab(activeTab) ? activeTab.file : null;
  const symlinkTooltip = selectedFile?.isSymlink && selectedFile.symlinkTarget
    ? `This resource is linked. Source: ${selectedFile.symlinkTarget}. Edits here update the same underlying file.`
    : null;
  const fileBreadcrumb = selectedFile ? getFileBreadcrumb(selectedFile.path) : null;

  return (
    <div className="rv-file-viewer">
      <div className="rv-file-viewer-info">
        {selectedFile && fileBreadcrumb && (
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
        )}
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

      <div className={`rv-file-viewer-content${isFileEditorTab(activeTab) && activeTab.loading ? ' loading' : ''}`}>
        {isFileEditorTab(activeTab) ? (
          <FileContentRenderer
            content={activeTab.content}
            extension={activeTab.file.extension}
            fileName={activeTab.file.name}
          />
        ) : (
          <div className="rv-file-explorer-empty">
            <span>Select File</span>
          </div>
        )}
      </div>

      {selectedFile && (
        <FloatingPathActions
          panel="file-viewer"
          relativePath={selectedFile.path}
          className="rv-file-floating-actions"
          copyTitle="Copy file path"
          sendTitle="Send file path to chat"
          ariaLabel="File actions"
        />
      )}
    </div>
  );
}
