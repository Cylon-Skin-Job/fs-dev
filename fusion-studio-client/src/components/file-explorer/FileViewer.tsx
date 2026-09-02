import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useFileStore } from '../../state/fileStore';
import { usePanelStore } from '../../state/panelStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { FileContentRenderer } from './FileContentRenderer';
import type { EditorTab } from '../../types/file-explorer';
import { getFileIcon } from '../../lib/file-utils';

function getFileBreadcrumb(path: string): { folders: string[]; fileName: string } {
  const visibleParts = path.split('/').filter(Boolean).slice(-3);
  return {
    folders: visibleParts.slice(0, -1),
    fileName: visibleParts.at(-1) ?? path,
  };
}

function TabRow({
  tab,
  active,
  onClose,
}: {
  tab: EditorTab;
  active: boolean;
  onClose: (e: MouseEvent) => void;
}) {
  const fileIcon = getFileIcon(tab.file.extension, tab.file.name);
  const path = tab.file.path;

  return (
    <div
      role="tab"
      aria-selected={active}
      data-tab-path={path}
      tabIndex={active ? 0 : -1}
      className={`rv-file-viewer-tab${active ? ' active' : ''}`}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          useFileStore.getState().setActiveTab(path);
        }
      }}
    >
      <span className={`material-symbols-outlined rv-tab-icon file-icon-${tab.file.extension}`}>
        {fileIcon}
      </span>
      <span className="rv-tab-name">{tab.file.name}</span>
      <button
        type="button"
        className="rv-tab-close"
        onClick={onClose}
        disabled={tab.loading}
        title="Close tab"
      >
        <span className="material-symbols-outlined rv-icon-sm">
          close
        </span>
      </button>
    </div>
  );
}

export function FileViewer() {
  const tabs = useFileStore((s) => s.tabs);
  const activeTabPath = useFileStore((s) => s.activeTabPath);
  const closeTab = useFileStore((s) => s.closeTab);
  const fileTreeCollapsed = usePanelStore(
    (s) => s.viewStates['file-viewer']?.collapsed?.rightCol ?? false,
  );
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [compactTabs, setCompactTabs] = useState(false);

  const activeTab = tabs.find((t) => t.file.path === activeTabPath) ?? null;

  useEffect(() => {
    const tabStrip = tabStripRef.current;
    if (!tabStrip) return;

    const updateTabDensity = () => {
      const firstTab = tabStrip.querySelector<HTMLElement>('.rv-file-viewer-tab');
      setCompactTabs(Boolean(firstTab && firstTab.getBoundingClientRect().width <= 120));
    };

    const resizeObserver = new ResizeObserver(updateTabDensity);
    resizeObserver.observe(tabStrip);
    updateTabDensity();
    return () => resizeObserver.disconnect();
  }, [tabs.length, activeTabPath]);

  if (!activeTab || !activeTabPath) return null;

  const selectedFile = activeTab.file;
  const fileContent = activeTab.content;
  const isLoading = activeTab.loading;
  const symlinkTooltip = selectedFile.isSymlink && selectedFile.symlinkTarget
    ? `This resource is linked. Source: ${selectedFile.symlinkTarget}. Edits here update the same underlying file.`
    : null;
  const fileBreadcrumb = getFileBreadcrumb(selectedFile.path);

  function handleTabStripClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button.rv-tab-close')) return;
    const row = (e.target as HTMLElement).closest('[data-tab-path]');
    if (!row) return;
    const path = row.getAttribute('data-tab-path');
    if (!path) return;
    e.stopPropagation();
    useFileStore.getState().setActiveTab(path);
  }

  return (
    <div className="rv-file-viewer">
      <div className="rv-file-viewer-header">
        <div
          ref={tabStripRef}
          className={`rv-file-viewer-tabs${compactTabs ? ' compact' : ''}`}
          onClick={handleTabStripClick}
        >
          {tabs.map((tab) => (
            <TabRow
              key={tab.file.path}
              tab={tab}
              active={tab.file.path === activeTabPath}
              onClose={(e) => {
                e.stopPropagation();
                closeTab(tab.file.path);
              }}
            />
          ))}
          <button
            type="button"
            className="rv-file-viewer-tab-bar-action"
            aria-label="New file tab"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
      </div>

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
