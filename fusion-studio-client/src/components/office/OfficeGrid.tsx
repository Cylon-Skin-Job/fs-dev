/**
 * @module OfficeGrid
 * @role Content component for the office-viewer panel
 *
 * Three-level navigation:
 * - Root: grid of folder cards
 * - Folder: grid of OfficeDocumentTile cards for files in the selected folder
 * - File: full-page FilePageView with back button + sibling ribbon
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { useFolderFiles } from '../../hooks/useFolderFiles';
import { useFileTileMenu } from '../../hooks/useFileTileMenu';
import type { FileWithContent } from '../tile-row/TileRow';
import { OfficeDocumentTile } from './OfficeDocumentTile';
import { OfficeDocumentPage } from './OfficeDocumentPage';
import { OfficeViewerHeader } from './OfficeViewerHeader';
import { OfficeBreadcrumb } from './OfficeBreadcrumb';
import { useOfficeViewerSearch } from './useOfficeViewerSearch';
import { FilePageView } from '../capture/FilePageView';
import { Icon } from '../Icon';
import { CopyPathButton } from '../CopyPathButton';
import { LinkedResourceIndicator } from '../LinkedResourceIndicator';
import { SendToChatButton } from '../SendToChatButton';
import { OfficeNewMenuButton } from './OfficeNewMenuButton';
import { onFusionMessage, sendFusionMessage } from '../../lib/ws-client';
import { OFFICE_VIEWER_ARCHIVE_FOLDER, isViewerArchivePath } from '../../lib/viewFolders';
import type { ViewUIState } from '../../types';
import {
  normalizeViewCollections,
} from '../../lib/viewCollections';
import {
  activityId,
  groupActivityByDate,
  normalizeViewActivity,
  recordViewRecent,
} from '../../lib/viewActivity';
import { normalizeOfficePaperBrightness, officePaperMuteAlpha } from '../../lib/officePaperBrightness';
import './OfficeGrid.css';

const PANEL = 'office-viewer';
const ROOT_PATH = '';

function persistOfficeViewPatch(patch: Partial<ViewUIState>) {
  const store = usePanelStore.getState();
  store.setViewState(PANEL, patch);
  store._persistViewPatch(PANEL, patch);
}

function folderPathForFile(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash === -1 ? ROOT_PATH : filePath.slice(0, lastSlash);
}

function fileNameForPath(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

function extensionForName(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function storedFolderPath(folderPath: string): string | null {
  return folderPath || null;
}

const OFFICE_SIDEBAR_ITEMS = [
  { kind: 'item', icon: 'home', label: 'Home', action: 'home' },
  { kind: 'item', icon: 'browse_gallery', label: 'Recent', action: 'recent' },
  { kind: 'item', icon: 'kid_star', label: 'Starred', action: 'starred' },
  { kind: 'item', icon: 'archive', label: 'Archive', action: 'archive' },
] as const;

type OfficeSidebarItem = Extract<typeof OFFICE_SIDEBAR_ITEMS[number], { kind: 'item' }>;
type OfficeSidebarAction = OfficeSidebarItem['action'];
type OfficeCreateModalKind = 'folder' | 'document';

interface FolderInfo {
  name: string;
  path: string;
}

interface OfficeSectionedResultsProps {
  folderItems: ReactNode[];
  fileItems: ReactNode[];
}

interface DocumentCreateResponseMessage {
  type: 'document_create_response';
  panel?: string;
  parentPath?: string;
  path?: string;
  name?: string;
  extension?: string;
  content?: string;
  success?: boolean;
}

function isMarkdownDocument(file: FileWithContent): boolean {
  const fileName = file.name.toLowerCase();
  return file.extension === 'md' ||
    file.extension === 'markdown' ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.markdown');
}

function OfficeSectionedResults({
  folderItems,
  fileItems,
}: OfficeSectionedResultsProps) {
  return (
    <div className="rv-office-search-results">
      {folderItems.length > 0 ? (
        <div className="rv-office-search-section">
          <div className="rv-office-search-section-title">Folders</div>
          <div className="rv-office-folder-grid rv-office-search-folder-grid">
            {folderItems}
          </div>
        </div>
      ) : null}
      {fileItems.length > 0 ? (
        <div className="rv-office-search-section rv-office-search-section--files">
          <div className="rv-office-search-section-title">Files</div>
          <div className="rv-office-file-grid rv-office-search-grid">
            {fileItems}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OfficeRecentResults({
  groups,
  contents,
  onOpenFile,
  onFileContextMenu,
  onFileMoreClick,
  isFileStarred,
}: {
  groups: ReturnType<typeof groupActivityByDate>;
  contents: Record<string, string>;
  onOpenFile: (path: string, folder: string) => void;
  onFileContextMenu: (file: FileWithContent, folder: string) => (event: ReactMouseEvent) => void;
  onFileMoreClick: (file: FileWithContent, folder: string) => (event: ReactMouseEvent) => void;
  isFileStarred: (panel: string, path: string) => boolean;
}) {
  return (
    <div className="rv-office-search-results rv-office-recent-results">
      {groups.map((group) => (
        <div className="rv-office-search-section" key={group.label}>
          <div className="rv-office-search-section-title">{group.label}</div>
          <div className="rv-office-file-grid rv-office-search-grid">
            {group.items.map((item) => {
              const folder = item.folder ?? '';
              const file: FileWithContent = {
                name: item.title,
                path: item.path,
                type: 'file',
                extension: item.extension,
                content: contents[`${item.panel}:${item.path}`] || '',
              };
              return (
                <OfficeDocumentTile
                  key={item.id}
                  name={file.name}
                  content={file.content}
                  extension={file.extension}
                  panel={item.panel}
                  folderPath={folder}
                  starred={isFileStarred(item.panel, item.path)}
                  onClick={() => onOpenFile(item.path, folder)}
                  onContextMenu={onFileContextMenu(file, folder)}
                  onMoreClick={onFileMoreClick(file, folder)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficeFolderCard({
  folder,
  onClick,
  onContextMenu,
  onMoreClick,
  title,
}: {
  folder: FolderInfo;
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
  onMoreClick?: (event: ReactMouseEvent) => void;
  title?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="rv-office-folder-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      title={title ?? folder.name}
    >
      <Icon
        name="folder"
        className="rv-office-folder-icon"
        filled={true}
      />
      <span className="rv-office-folder-name">{folder.name}</span>
      <button
        type="button"
        className="rv-office-folder-more"
        aria-label={`More actions for ${folder.name}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onMoreClick?.(event);
        }}
      >
        <span className="material-symbols-outlined">more_vert</span>
      </button>
    </div>
  );
}

function officeModeForFolder(folderPath: string): OfficeSidebarAction {
  return isViewerArchivePath(folderPath, OFFICE_VIEWER_ARCHIVE_FOLDER) ? 'archive' : 'home';
}

function OfficeSidebar({
  activeAction,
  onAction,
  pinnedFolders,
  activeFolderPath,
  onPinnedFolderClick,
  onNewFolder,
  onNewDocument,
}: {
  activeAction: OfficeSidebarAction;
  onAction: (action: OfficeSidebarAction) => void;
  pinnedFolders: FolderInfo[];
  activeFolderPath: string;
  onPinnedFolderClick: (folderPath: string) => void;
  onNewFolder: () => void;
  onNewDocument: () => void;
}) {
  return (
    <aside className="rv-office-sidebar" aria-label="Office navigation">
      <h2 className="rv-office-sidebar-title">Office</h2>
      <OfficeNewMenuButton
        onNewFolder={onNewFolder}
        onNewDocument={onNewDocument}
      />
      <nav className="rv-office-sidebar-nav">
        {OFFICE_SIDEBAR_ITEMS.slice(0, 3).map((item) => {
          const isActive = item.action === activeAction;
          const className = [
            'rv-office-sidebar-item',
            isActive ? 'active' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={item.action}
              type="button"
              className={className}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              onClick={() => onAction(item.action)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="rv-office-sidebar-separator" role="separator" />
        <div className="rv-office-sidebar-section-label">
          <span className="material-symbols-outlined" aria-hidden="true">pinboard_unread</span>
          <span>Pinned Folders</span>
        </div>
        {pinnedFolders.map((folder) => {
          const isActive = folder.path === activeFolderPath;
          return (
            <button
              key={folder.path}
              type="button"
              className={`rv-office-sidebar-item rv-office-sidebar-item--pinned${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={folder.path}
              onClick={() => onPinnedFolderClick(folder.path)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">folder</span>
              <span>{folder.name}</span>
            </button>
          );
        })}
        <div className="rv-office-sidebar-separator" role="separator" />
        {OFFICE_SIDEBAR_ITEMS.slice(3).map((item) => {
          const isActive = item.action === activeAction;
          const className = [
            'rv-office-sidebar-item',
            isActive ? 'active' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={item.action}
              type="button"
              className={className}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              onClick={() => onAction(item.action)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function OfficeCreateModal({
  kind,
  name,
  onNameChange,
  onCancel,
  onSave,
}: {
  kind: OfficeCreateModalKind;
  name: string;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = kind === 'folder' ? 'Folder name' : 'Document name';
  const inputId = `rv-office-${kind}-name`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave();
  };

  return (
    <div className="rv-office-create-modal-overlay" role="presentation" onMouseDown={onCancel}>
      <form
        className="rv-office-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rv-office-create-modal-label"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label id="rv-office-create-modal-label" className="rv-office-create-modal-label" htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="rv-office-create-modal-input"
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
        />
        <div className="rv-office-create-modal-actions">
          <button type="button" className="rv-office-create-modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="rv-office-create-modal-btn rv-office-create-modal-btn--primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export function OfficeGrid() {
  useViewLayoutStyles(PANEL);

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [createModalKind, setCreateModalKind] = useState<OfficeCreateModalKind | null>(null);
  const [createName, setCreateName] = useState('');

  const trees = useFileDataStore((s) => s.trees);
  const contents = useFileDataStore((s) => s.contents);
  const treeMetadata = useFileDataStore((s) => s.treeMetadata);
  const treeErrors = useFileDataStore((s) => s.treeErrors);
  const contentErrors = useFileDataStore((s) => s.contentErrors);
  const fileDataGeneration = useFileDataStore((s) => s.generation);
  const officeMode = usePanelStore((s) => s.viewStates[PANEL]?.officeViewerMode ?? 'home');
  const currentFolder = usePanelStore((s) => s.viewStates[PANEL]?.officeViewerCurrentFolder ?? null);
  const selectedPath = usePanelStore((s) => s.viewStates[PANEL]?.officeViewerSelectedPath ?? null);
  const rawOfficeActivity = usePanelStore((s) => s.viewStates[PANEL]?.activity);
  const rawOfficeCollections = usePanelStore((s) => s.viewStates[PANEL]?.collections);
  const rawOfficePaperBrightness = usePanelStore((s) => s.viewStates[PANEL]?.officePaperBrightness);
  const officePaperBrightness = normalizeOfficePaperBrightness(rawOfficePaperBrightness);
  const officeActivity = useMemo(
    () => normalizeViewActivity(rawOfficeActivity),
    [rawOfficeActivity]
  );
  const officeCollections = useMemo(
    () => normalizeViewCollections(rawOfficeCollections),
    [rawOfficeCollections]
  );
  const officeStarredItems = useMemo(
    () => officeCollections.starred.filter((item) => item.panel === PANEL),
    [officeCollections.starred]
  );
  const officeStarredIds = useMemo(
    () => new Set(officeCollections.starred.map((item) => item.id)),
    [officeCollections.starred]
  );
  const isOfficeFileStarred = useCallback(
    (panel: string, path: string) => officeStarredIds.has(activityId(panel, path)),
    [officeStarredIds]
  );
  const pinnedFolders = useMemo<FolderInfo[]>(
    () => officeCollections.pinnedFolders
      .filter((item) => item.panel === PANEL)
      .map((item) => ({ name: item.title, path: item.path })),
    [officeCollections.pinnedFolders]
  );
  const recentGroups = useMemo(
    () => groupActivityByDate(officeActivity.recents),
    [officeActivity.recents]
  );
  // --- Directory listing (Home or folder view) ---
  const activeFolderPath = currentFolder ?? ROOT_PATH;
  const activeTreeKey = `${PANEL}:${activeFolderPath}`;
  const activeNodes = trees[activeTreeKey];
  const activeFolderMetadata = treeMetadata[activeTreeKey];
  const activeTreeError = treeErrors[activeTreeKey];
  const { files, loading: filesLoading } = useFolderFiles(
    PANEL,
    activeFolderPath
  );
  const {
    getFileContextMenuHandler,
    getFileMoreClickHandler,
    getFolderContextMenuHandler,
    getFolderMoreClickHandler,
  } = useFileTileMenu({
    panel: PANEL,
    folder: activeFolderPath,
  });

  const selectedFolderPath = selectedPath ? folderPathForFile(selectedPath) : activeFolderPath;
  const selectedContentError = selectedPath ? contentErrors[`${PANEL}:${selectedPath}`] : undefined;
  const selectedFile = useMemo<FileWithContent | null>(() => {
    if (!selectedPath) return null;
    const content = contents[`${PANEL}:${selectedPath}`];
    if (content === undefined) return null;
    const name = fileNameForPath(selectedPath);
    return {
      name,
      path: selectedPath,
      type: 'file',
      extension: extensionForName(name),
      content,
    };
  }, [contents, selectedPath]);

  useEffect(() => {
    if (!selectedPath) return;
    const fileData = useFileDataStore.getState();
    fileData.requestTree(PANEL, selectedFolderPath);
    fileData.requestContent(PANEL, selectedPath);
  }, [fileDataGeneration, selectedFolderPath, selectedPath]);

  useEffect(() => {
    if (!activeTreeError || activeFolderPath === ROOT_PATH) return;
    persistOfficeViewPatch({
      officeViewerMode: 'home',
      officeViewerCurrentFolder: null,
      officeViewerSelectedPath: null,
    });
  }, [activeFolderPath, activeTreeError]);

  useEffect(() => {
    if (!selectedPath || !selectedContentError) return;
    persistOfficeViewPatch({
      officeViewerMode: 'home',
      officeViewerCurrentFolder: null,
      officeViewerSelectedPath: null,
    });
  }, [selectedContentError, selectedPath]);

  const directoryFolders: FolderInfo[] = useMemo(() => {
    if (!activeNodes) return [];
    return activeNodes
      .filter((n) => n.type === 'folder' && !n.name.startsWith('.'))
      .map((n) => ({ name: n.name, path: n.path }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeNodes]);

  const directoryHasFileNodes = useMemo(
    () => activeNodes?.some((n) => n.type === 'file' && !n.name.startsWith('.')) ?? false,
    [activeNodes]
  );

  const directoryTreeLoading = activeNodes === undefined;

  const {
    fileItems: searchItems,
    folderResults: searchFolderItems,
    rankedFileItems: rankedSearchItems,
    rankedFolderResults: rankedSearchFolderItems,
    loading: searchLoading,
  } = useOfficeViewerSearch(
    {
      enabled: isSearchSubmitted,
      query: submittedSearchQuery,
    }
  );

  const handleSearchSubmit = useCallback(() => {
    setSubmittedSearchQuery(searchQuery);
    setIsSearchSubmitted(true);
  }, [searchQuery]);

  const handleSearchDismiss = useCallback(() => {
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, []);

  const leaveSearchMode = useCallback(() => {
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, []);

  const handleFolderClick = useCallback((folderPath: string) => {
    persistOfficeViewPatch({
      officeViewerMode: officeModeForFolder(folderPath),
      officeViewerCurrentFolder: folderPath,
      officeViewerSelectedPath: null,
    });
  }, []);

  const handleBackToFolders = useCallback(() => {
    persistOfficeViewPatch({
      officeViewerMode: 'home',
      officeViewerCurrentFolder: null,
      officeViewerSelectedPath: null,
    });
    leaveSearchMode();
  }, [leaveSearchMode]);

  const handleNavigateToFolder = useCallback((folderPath: string) => {
    persistOfficeViewPatch({
      officeViewerMode: officeModeForFolder(folderPath),
      officeViewerCurrentFolder: folderPath,
      officeViewerSelectedPath: null,
    });
    leaveSearchMode();
  }, [leaveSearchMode]);

  const hasSearchItems = searchItems.length > 0 || searchFolderItems.length > 0;
  const hasSearchMatches = rankedSearchItems.length > 0 || rankedSearchFolderItems.length > 0;

  const handleBackToFolder = useCallback(() => {
    persistOfficeViewPatch({ officeViewerSelectedPath: null });
  }, []);

  const handleFileClick = useCallback((file: FileWithContent, folderOverride?: string) => {
    const folder = folderOverride ?? activeFolderPath;
    persistOfficeViewPatch({
      officeViewerMode: officeModeForFolder(folder),
      officeViewerCurrentFolder: storedFolderPath(folder),
      officeViewerSelectedPath: file.path,
    });
    recordViewRecent(PANEL, {
      panel: PANEL,
      path: file.path,
      title: file.name,
      kind: 'document',
      folder,
      extension: file.extension ?? file.name.split('.').pop()?.toLowerCase(),
    });
  }, [activeFolderPath]);

  const handleSearchFileClick = useCallback((file: FileWithContent, folder: string) => {
    leaveSearchMode();
    handleFileClick(file, folder);
  }, [handleFileClick, leaveSearchMode]);

  const handleOpenFile = useCallback((path: string, folder: string) => {
    const fileData = useFileDataStore.getState();
    const cacheKey = `${PANEL}:${path}`;
    const cachedContent = fileData.contents[cacheKey] || '';

    if (!cachedContent) {
      fileData.requestContent(PANEL, path);
    }

    const name = fileNameForPath(path);
    const ext = extensionForName(name);

    persistOfficeViewPatch({
      officeViewerMode: officeModeForFolder(folder),
      officeViewerCurrentFolder: storedFolderPath(folder),
      officeViewerSelectedPath: path,
    });
    recordViewRecent(PANEL, {
      panel: PANEL,
      path,
      title: name,
      kind: 'document',
      folder,
      extension: ext,
    });
  }, []);

  const officeHeaderTitle = isSearchSubmitted ? 'Search results' : currentFolder ? (
    <OfficeBreadcrumb
      folderPath={currentFolder}
      onHomeClick={handleBackToFolders}
      onFolderClick={handleNavigateToFolder}
    />
  ) : 'Home';
  const headerRightControls = currentFolder && !isSearchSubmitted ? (
    <div className="rv-office-folder-actions" aria-label="Folder actions">
      {activeFolderMetadata?.isSymlink && activeFolderMetadata.symlinkTarget ? (
        <LinkedResourceIndicator
          symlinkTarget={activeFolderMetadata.symlinkTarget}
          className="rv-office-header-action"
        />
      ) : null}
      <SendToChatButton panel={PANEL} relativePath={currentFolder} className="rv-office-header-action" title="Send folder path to chat" />
      <CopyPathButton panel={PANEL} relativePath={currentFolder} className="rv-office-header-action" title="Copy folder path" />
    </div>
  ) : null;
  const handleOfficeHome = useCallback(() => {
    persistOfficeViewPatch({
      officeViewerMode: 'home',
      officeViewerCurrentFolder: null,
      officeViewerSelectedPath: null,
    });
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, []);

  const handleSidebarAction = useCallback((action: OfficeSidebarAction) => {
    if (action === 'home') {
      handleOfficeHome();
      return;
    }
    if (action === 'archive') {
      persistOfficeViewPatch({
        officeViewerMode: action,
        officeViewerCurrentFolder: OFFICE_VIEWER_ARCHIVE_FOLDER,
        officeViewerSelectedPath: null,
      });
      setSearchQuery('');
      setSubmittedSearchQuery('');
      setIsSearchSubmitted(false);
      return;
    }
    persistOfficeViewPatch({
      officeViewerMode: action,
      officeViewerCurrentFolder: null,
      officeViewerSelectedPath: null,
    });
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }, [handleOfficeHome]);

  const handleOpenCreateModal = useCallback((kind: OfficeCreateModalKind) => {
    setCreateName('');
    setCreateModalKind(kind);
  }, []);

  const handleOpenNewFolderModal = useCallback(() => {
    handleOpenCreateModal('folder');
  }, [handleOpenCreateModal]);

  const handleOpenNewDocumentModal = useCallback(() => {
    handleOpenCreateModal('document');
  }, [handleOpenCreateModal]);

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalKind(null);
    setCreateName('');
  }, []);

  const handleSaveCreateItem = useCallback(() => {
    const name = createName.trim();
    if (!name || !createModalKind) return;

    sendFusionMessage({
      type: createModalKind === 'folder' ? 'folder_create' : 'document_create',
      panel: PANEL,
      parentPath: activeFolderPath,
      name,
    });
    handleCloseCreateModal();
  }, [activeFolderPath, createModalKind, createName, handleCloseCreateModal]);

  useEffect(() => onFusionMessage<DocumentCreateResponseMessage>('document_create_response', (msg) => {
    if (msg.panel !== PANEL || !msg.success || !msg.path || !msg.name) return;
    const parentPath = msg.parentPath ?? ROOT_PATH;
    persistOfficeViewPatch({
      officeViewerMode: officeModeForFolder(parentPath),
      officeViewerCurrentFolder: storedFolderPath(parentPath),
      officeViewerSelectedPath: msg.path,
    });
    useFileDataStore.getState().handleContentResponse(PANEL, msg.path, msg.content ?? '');
    recordViewRecent(PANEL, {
      panel: PANEL,
      path: msg.path,
      title: msg.name,
      kind: 'document',
      folder: parentPath,
      extension: msg.extension ?? 'md',
    });
    setSubmittedSearchQuery('');
    setIsSearchSubmitted(false);
  }), []);

  useEffect(() => {
    const fileData = useFileDataStore.getState();
    for (const item of [...officeActivity.recents, ...officeStarredItems]) {
      const key = `${item.panel}:${item.path}`;
      if (!(key in fileData.contents)) {
        fileData.requestContent(item.panel, item.path);
      }
    }
  }, [fileDataGeneration, officeActivity.recents, officeStarredItems]);

  const officePaperStyle = useMemo(() => ({
    '--rv-office-paper-mute-alpha': officePaperMuteAlpha(officePaperBrightness),
  }) as CSSProperties, [officePaperBrightness]);

  const renderOfficeShell = (content: ReactNode, mainClassName = 'rv-office-grid', showSidebar = true) => (
    <div
      className={`rv-office-shell rv-office-view-transition${showSidebar ? '' : ' rv-office-shell--no-sidebar'}`}
      style={officePaperStyle}
    >
      {showSidebar ? (
        <OfficeSidebar
          activeAction={officeMode}
          onAction={handleSidebarAction}
          pinnedFolders={pinnedFolders}
          activeFolderPath={activeFolderPath}
          onPinnedFolderClick={handleNavigateToFolder}
          onNewFolder={handleOpenNewFolderModal}
          onNewDocument={handleOpenNewDocumentModal}
        />
      ) : null}
      <main className={mainClassName}>
        {content}
      </main>
      {createModalKind ? (
        <OfficeCreateModal
          kind={createModalKind}
          name={createName}
          onNameChange={setCreateName}
          onCancel={handleCloseCreateModal}
          onSave={handleSaveCreateItem}
        />
      ) : null}
    </div>
  );

  // --- File detail view ---
  if (selectedPath && !selectedFile) {
    return renderOfficeShell(
      <div className="rv-office-loading">
        <span>Loading document...</span>
      </div>,
      'rv-office-detail-main',
      false
    );
  }

  if (selectedFile) {
    const documentFolderPath = folderPathForFile(selectedFile.path);
    const selectedFolderName = documentFolderPath ? documentFolderPath.split('/').pop() || documentFolderPath : 'Home';
    const isMarkdown = isMarkdownDocument(selectedFile);

    if (isMarkdown) {
      return renderOfficeShell(
        <OfficeDocumentPage
          key={selectedFile.path}
          file={selectedFile}
          folder={documentFolderPath}
          folderName={selectedFolderName}
          onBack={handleBackToFolder}
          onOpenFile={handleOpenFile}
        />,
        'rv-office-detail-main',
        false
      );
    }

    // Non-markdown files still use FilePageView
    return renderOfficeShell(
      <FilePageView
        file={selectedFile}
        panel={PANEL}
        folder={documentFolderPath}
        folderName={selectedFolderName}
        onBack={handleBackToFolder}
      />,
      'rv-office-detail-main',
      false
    );
  }

  let officeContent: ReactNode;
  if (isSearchSubmitted) {
    if (searchLoading) {
      officeContent = (
        <div className="rv-office-loading">
          <span>Searching...</span>
        </div>
      );
    } else if (!hasSearchItems) {
      officeContent = (
        <div className="rv-office-empty">
          <Icon name="description" className="rv-office-empty-icon" />
          <span>No documents yet</span>
        </div>
      );
    } else if (!hasSearchMatches) {
      officeContent = (
        <div className="rv-office-empty">
          <Icon name="search_off" className="rv-office-empty-icon" />
          <span>No matches</span>
        </div>
      );
    } else {
      officeContent = (
        <OfficeSectionedResults
          folderItems={rankedSearchFolderItems.map((folder) => (
            <OfficeFolderCard
              key={folder.path}
              folder={folder}
              onClick={() => handleNavigateToFolder(folder.path)}
              onContextMenu={getFolderContextMenuHandler(folder)}
              onMoreClick={getFolderMoreClickHandler(folder)}
              title={folder.path}
            />
          ))}
          fileItems={rankedSearchItems.map(({ folder, file }) => (
            <OfficeDocumentTile
              key={`${folder}/${file.path}`}
              name={file.name}
              content={file.content}
              extension={file.extension}
              panel={PANEL}
              folderPath={folder}
              starred={isOfficeFileStarred(PANEL, file.path)}
              onClick={() => handleSearchFileClick(file, folder)}
              onContextMenu={getFileContextMenuHandler(file, folder)}
              onMoreClick={getFileMoreClickHandler(file, folder)}
            />
          ))}
        />
      );
    }
  } else if (officeMode === 'recent') {
    officeContent = recentGroups.length === 0 ? (
      <div className="rv-office-empty">
        <Icon name="history" className="rv-office-empty-icon" />
        <span>No recent documents</span>
      </div>
    ) : (
      <OfficeRecentResults
        groups={recentGroups}
        contents={contents}
        onOpenFile={handleOpenFile}
        onFileContextMenu={getFileContextMenuHandler}
        onFileMoreClick={getFileMoreClickHandler}
        isFileStarred={isOfficeFileStarred}
      />
    );
  } else if (officeMode === 'starred') {
    officeContent = officeStarredItems.length === 0 ? (
      <div className="rv-office-empty">
        <Icon name="kid_star" className="rv-office-empty-icon" />
        <span>No starred documents</span>
      </div>
    ) : (
      <OfficeSectionedResults
        folderItems={[]}
        fileItems={officeStarredItems.map((item) => {
          const folder = item.folder ?? item.path.split('/').slice(0, -1).join('/');
          const file: FileWithContent = {
            name: item.title,
            path: item.path,
            type: 'file',
            extension: item.extension ?? item.title.split('.').pop()?.toLowerCase(),
            content: contents[`${item.panel}:${item.path}`] || '',
          };
          return (
            <OfficeDocumentTile
              key={item.id}
              name={file.name}
              content={file.content}
              extension={file.extension}
              panel={item.panel}
              folderPath={folder}
              starred={true}
              onClick={() => handleOpenFile(item.path, folder)}
              onContextMenu={getFileContextMenuHandler(file, folder)}
              onMoreClick={getFileMoreClickHandler(file, folder)}
            />
          );
        })}
      />
    );
  } else if (directoryTreeLoading) {
    officeContent = (
      <div className="rv-office-loading">
        <span>Loading files...</span>
      </div>
    );
  } else if (directoryFolders.length === 0 && !directoryHasFileNodes) {
    officeContent = (
      <div className="rv-office-empty">
        <Icon name="folder_open" className="rv-office-empty-icon" />
        <span>This folder is empty</span>
      </div>
    );
  } else {
    officeContent = (
      <OfficeSectionedResults
        folderItems={directoryFolders.map((folder) => (
          <OfficeFolderCard
            key={folder.path}
            folder={folder}
            onClick={() => handleFolderClick(folder.path)}
            onContextMenu={getFolderContextMenuHandler(folder)}
            onMoreClick={getFolderMoreClickHandler(folder)}
          />
        ))}
        fileItems={filesLoading && directoryHasFileNodes ? [
          <div key="loading-files" className="rv-office-loading rv-office-loading--inline">
            <span>Loading files...</span>
          </div>,
        ] : files.map((file) => (
          <OfficeDocumentTile
            key={file.path}
            name={file.name}
            content={file.content}
            extension={file.extension}
            panel={PANEL}
            folderPath={activeFolderPath}
            starred={isOfficeFileStarred(PANEL, file.path)}
            onClick={() => handleFileClick(file)}
            onContextMenu={getFileContextMenuHandler(file, activeFolderPath)}
            onMoreClick={getFileMoreClickHandler(file, activeFolderPath)}
          />
        ))}
      />
    );
  }

  const officeHeader = (
    <OfficeViewerHeader
      title={
        officeMode === 'recent' ? 'Recent'
          : officeMode === 'starred' ? 'Starred'
          : officeMode === 'archive' ? 'Archive'
          : officeHeaderTitle
      }
      searchQuery={searchQuery}
      isSearchSubmitted={isSearchSubmitted}
      rightControls={headerRightControls}
      showFolderFilters={Boolean(currentFolder)}
      onSearchQueryChange={setSearchQuery}
      onSearchSubmit={handleSearchSubmit}
      onSearchDismiss={handleSearchDismiss}
    >
      {officeContent}
    </OfficeViewerHeader>
  );

  // --- Root, folder, and search list views ---
  return renderOfficeShell(
    officeHeader
  );
}
