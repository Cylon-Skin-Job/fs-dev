import type { KeyboardEvent, MouseEvent } from 'react';
import { useFileStore } from '../../state/fileStore';
import { FileContentRenderer } from './FileContentRenderer';
import type { EditorTab } from '../../types/file-explorer';

// File extension to icon mapping
const FILE_ICONS: Record<string, string> = {
  js: 'javascript',
  jsx: 'code',
  ts: 'terminal',
  tsx: 'code',
  json: 'data_object',
  css: 'format_paint',
  scss: 'format_paint',
  html: 'html',
  htm: 'html',
  py: 'terminal',
  rb: 'terminal',
  go: 'terminal',
  rs: 'terminal',
  java: 'coffee',
  c: 'memory',
  cpp: 'memory',
  h: 'memory',
  sh: 'terminal',
  bash: 'terminal',
  yml: 'list',
  yaml: 'list',
  toml: 'settings',
  xml: 'code',
  sql: 'database',
  md: 'description',
  txt: 'description',
  env: 'settings',
  gitignore: 'settings',
};

function getFileIcon(extension?: string): string {
  if (!extension) return 'description';
  return FILE_ICONS[extension] || 'description';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFilePath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return '.../' + parts.slice(-2).join('/');
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
  const fileIcon = getFileIcon(tab.file.extension);
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
  const activateAdjacentTab = useFileStore((s) => s.activateAdjacentTab);
  const closeTab = useFileStore((s) => s.closeTab);

  const activeTab = tabs.find((t) => t.file.path === activeTabPath) ?? null;

  if (!activeTab || !activeTabPath) return null;

  const selectedFile = activeTab.file;
  const fileContent = activeTab.content;
  const isLoading = activeTab.loading;
  const fileSize = activeTab.size;

  const displaySize = fileSize ? formatFileSize(fileSize) : isLoading ? 'Loading...' : '—';
  const lineCount = fileContent.split('\n').length;
  const symlinkTooltip = selectedFile.isSymlink && selectedFile.symlinkTarget
    ? `This resource is linked. Source: ${selectedFile.symlinkTarget}. Edits here update the same underlying file.`
    : null;

  const activeIdx = tabs.findIndex((t) => t.file.path === activeTabPath);
  const canGoPrev = tabs.length > 1 && activeIdx > 0;
  const canGoNext = tabs.length > 1 && activeIdx >= 0 && activeIdx < tabs.length - 1;

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
        <div className="rv-file-viewer-nav">
          <button
            type="button"
            className="rv-nav-btn"
            title="Previous tab"
            disabled={!canGoPrev}
            onClick={() => activateAdjacentTab(-1)}
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            type="button"
            className="rv-nav-btn"
            title="Next tab"
            disabled={!canGoNext}
            onClick={() => activateAdjacentTab(1)}
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
        <div className="rv-file-viewer-tabs" onClick={handleTabStripClick}>
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
        </div>
      </div>

      <div className="rv-file-viewer-info">
        <div className="info-item">
          <span>{formatFilePath(selectedFile.path)}</span>
        </div>
        {symlinkTooltip && (
          <div className="info-item rv-file-viewer-info-spacer" title={symlinkTooltip}>
            <span className="material-symbols-outlined">folder_match</span>
            <span>Symlink</span>
          </div>
        )}
        <div className="info-item">
          <span className="material-symbols-outlined">straighten</span>
          <span>{displaySize}</span>
        </div>
        <div className="info-item">
          <span className="material-symbols-outlined">format_list_numbered</span>
          <span>{lineCount} lines</span>
        </div>
      </div>

      <div className={`rv-file-viewer-content${isLoading ? ' loading' : ''}`}>
        <FileContentRenderer
          content={fileContent}
          extension={selectedFile.extension}
          fileName={selectedFile.name}
        />
      </div>
    </div>
  );
}
