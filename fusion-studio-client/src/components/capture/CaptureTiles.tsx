/**
 * @module CaptureTiles
 * @role Grid / document orchestration view for the capture-viewer panel
 *
 * Renders either the tile grid or the file detail view. All state is owned by
 * useDocViewerState; this component only wires presentation to that state.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { DOC_VIEWER_ARCHIVE_FOLDER, type DocViewerMode, useDocViewerState } from '../../hooks/useDocViewerState';
import { useFolderFiles } from '../../hooks/useFolderFiles';
import { useFileTileMenu } from '../../hooks/useFileTileMenu';
import { useTileFileActions } from '../../hooks/useTileFileActions';
import { TileRow } from '../tile-row/TileRow';
import type { FileWithContent } from '../tile-row/TileRow';
import { DocumentTile } from '../tile-row/DocumentTile';
import { Pinwheel } from '../Pinwheel';
import { FilePageView } from './FilePageView';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { CaptureDocumentMenuButton } from './CaptureDocumentMenuButton';
import { DocViewerHeader } from './DocViewerHeader';
import {
  backOutOfCaptureDocument,
  getCaptureHandoffStatus,
  openDocumentInCaptureTabs,
  isCaptureTabsLatched,
  subscribeCaptureHandoff,
} from '../view-tabs/captureTabsController';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { useCaptureViewerSearch } from './useCaptureViewerSearch';
import { normalizeViewCollections } from '../../lib/viewCollections';
import { activityId, groupActivityByDate, normalizeViewActivity } from '../../lib/viewActivity';
import './CaptureTiles.css';

const ORDERED_DOCS_FOLDER = /^\d{3}-(.+)$/;
const DOC_VIEWER_PANEL = 'capture-viewer';

function isDocsFolder(node: { name: string; type: string }): boolean {
  return (
    (node.type === 'folder' || node.type === 'directory') &&
    node.name !== DOC_VIEWER_ARCHIVE_FOLDER &&
    ORDERED_DOCS_FOLDER.test(node.name)
  );
}

function docsFolderLabel(folderName: string): string {
  const match = folderName.match(ORDERED_DOCS_FOLDER);
  const label = match ? match[1] : folderName;
  return label.replace(/[-_]+/g, ' ');
}

export function CaptureTiles() {
  useViewLayoutStyles(DOC_VIEWER_PANEL);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressGridScrollPersistRef = useRef(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const isFullPageSelected = usePanelStore((s) => {
    const viewState = s.viewStates[DOC_VIEWER_PANEL];
    const tabs = viewState?.docViewerTabs ?? [];
    const activeId = viewState?.docViewerActiveTabId;
    const durableDocument = tabs.find((tab) => tab.id === activeId)?.kind === 'doc'
      || (tabs.length === 1 && tabs[0]?.kind === 'doc');
    return Boolean(viewState?.docViewerFullPage || durableDocument);
  });
  const setIsFullPageSelected = (next: boolean) => {
    usePanelStore.getState().setViewState(DOC_VIEWER_PANEL, { docViewerFullPage: next });
  };
  const docTabs = usePanelStore((s) => s.viewStates[DOC_VIEWER_PANEL]?.docViewerTabs);
  const captureHandoffStatus = useSyncExternalStore(
    subscribeCaptureHandoff,
    getCaptureHandoffStatus,
    getCaptureHandoffStatus,
  );
  const recoveryCaptureVisible = docTabs?.length === 1
    && docTabs[0]?.kind === 'capture'
    && captureHandoffStatus === 'failed';
  const isTabsMode = isCaptureTabsLatched(docTabs) || recoveryCaptureVisible;
  const rootNodes = useFileDataStore((s) => s.trees[`${DOC_VIEWER_PANEL}:`]);
  const fileDataGeneration = useFileDataStore((s) => s.generation);
  const requestTree = useFileDataStore((s) => s.requestTree);
  const contents = useFileDataStore((s) => s.contents);
  const contentErrors = useFileDataStore((s) => s.contentErrors);
  const requestContent = useFileDataStore((s) => s.requestContent);
  const rawDocActivity = usePanelStore((s) => s.viewStates[DOC_VIEWER_PANEL]?.activity);
  const rawDocCollections = usePanelStore((s) => s.viewStates[DOC_VIEWER_PANEL]?.collections);
  const docActivity = useMemo(
    () => normalizeViewActivity(rawDocActivity),
    [rawDocActivity]
  );
  const docCollections = useMemo(
    () => normalizeViewCollections(rawDocCollections),
    [rawDocCollections]
  );
  const docStarredIds = useMemo(
    () => new Set(docCollections.starred.map((item) => item.id)),
    [docCollections.starred]
  );
  const isDocFileStarred = (path: string) => docStarredIds.has(activityId(DOC_VIEWER_PANEL, path));
  const recentGroups = useMemo(
    () => groupActivityByDate(docActivity.recents),
    [docActivity.recents]
  );
  const {
    mode,
    selected,
    lastOpenedPath,
    gridScroll,
    docScroll,
    setMode,
    selectFile,
    clearSelection,
    restoreSelectedFile,
    archiveSelectedFile,
    persistGridScroll,
    resetGridScroll,
    persistDocScroll,
  } = useDocViewerState();
  const { getFileStarClickHandler } = useFileTileMenu({
    panel: DOC_VIEWER_PANEL,
    folder: '',
  });
  const { archiveOrRestoreFile, renameFile, deleteFile } = useTileFileActions({
    panel: DOC_VIEWER_PANEL,
    folder: selected?.folder ?? '',
  });
  const { files: archiveFiles, loading: archiveLoading } = useFolderFiles(
    DOC_VIEWER_PANEL,
    DOC_VIEWER_ARCHIVE_FOLDER,
    { enabled: mode === 'archive' }
  );

  useEffect(() => {
    requestTree(DOC_VIEWER_PANEL, '');
  }, [fileDataGeneration, requestTree]);

  useEffect(() => {
    for (const item of [...docActivity.recents, ...docCollections.starred]) {
      if (!(item.panel === DOC_VIEWER_PANEL)) continue;
      const key = `${DOC_VIEWER_PANEL}:${item.path}`;
      if (!(key in contents) && !(key in contentErrors)) {
        requestContent(DOC_VIEWER_PANEL, item.path);
      }
    }
  }, [contentErrors, contents, docActivity.recents, docCollections.starred, requestContent]);

  useEffect(() => {
    if (selected || !scrollRef.current || gridScroll <= 0) return;
    const el = scrollRef.current;
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTop = Math.min(gridScroll, el.scrollHeight - el.clientHeight);
    }
  }, [selected, gridScroll]);

  const openFilePreview = (folder: string, file: FileWithContent) => {
    setIsFullPageSelected(false);
    selectFile(folder, file);
  };

  const openDocFullScreen = (folder: string, file: FileWithContent) => {
    if (isTabsMode) {
      openDocumentInCaptureTabs({ folder, path: file.path, name: file.name });
      selectFile(folder, file);
      return;
    }
    selectFile(folder, file);
    setIsFullPageSelected(true);
  };

  const openFileFullScreen = (
    event: React.MouseEvent,
    folder: string,
    file: FileWithContent
  ) => {
    event.preventDefault();
    event.stopPropagation();
    openDocFullScreen(folder, file);
  };

  const handleFileSelect = (folder: string) => (file: FileWithContent) => {
    openFilePreview(folder, file);
  };

  const isLastOpenedFile = (folder: string, file: FileWithContent) => (
    lastOpenedPath === file.path || lastOpenedPath === `${folder}/${file.name}`
  );

  const rows = useMemo(
    () => (rootNodes ?? [])
      .filter(isDocsFolder)
      .map((node) => ({
        label: docsFolderLabel(node.name),
        folder: node.name,
      })),
    [rootNodes]
  );

  const searchFolders = useMemo(() => {
    const folders = rows.map((row) => ({ folder: row.folder, label: row.label }));
    if (!folders.some((row) => row.folder === DOC_VIEWER_ARCHIVE_FOLDER)) {
      folders.push({ folder: DOC_VIEWER_ARCHIVE_FOLDER, label: 'Archive' });
    }
    return folders;
  }, [rows]);

  const {
    fileItems: searchItems,
    rankedFileItems: rankedSearchItems,
    loading: searchFilesLoading,
  } = useCaptureViewerSearch(
    searchFolders,
    isSearchSubmitted && rootNodes !== undefined,
    submittedSearchQuery
  );

  const searchLoading = isSearchSubmitted && (rootNodes === undefined || searchFilesLoading);

  const handleSearchOpenChange = (nextIsOpen: boolean) => {
    setIsSearchOpen(nextIsOpen);
    if (!nextIsOpen) {
      setIsSearchSubmitted(false);
      setSubmittedSearchQuery('');
    }
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
  };

  const setVisibleGridScrollTop = () => {
    if (scrollRef.current) {
      suppressGridScrollPersistRef.current = true;
      scrollRef.current.scrollTop = 0;
      window.setTimeout(() => {
        suppressGridScrollPersistRef.current = false;
      }, 150);
    }
  };

  const scrollGridToTop = (targetMode: DocViewerMode = mode) => {
    setVisibleGridScrollTop();
    resetGridScroll(targetMode);
  };

  const handleModeChange = (nextMode: DocViewerMode) => {
    setVisibleGridScrollTop();
    setMode(nextMode);
  };

  const handleSearchSubmit = () => {
    scrollGridToTop();
    setSubmittedSearchQuery(searchQuery);
    setIsSearchSubmitted(true);
  };

  const loneCaptureIsHandingOff = docTabs?.length === 1
    && docTabs[0]?.kind === 'capture'
    && captureHandoffStatus !== 'failed';

  if (loneCaptureIsHandingOff) {
    return <div className="rv-tile-grid rv-capture-viewer-grid" aria-busy="true" />;
  }

  if (selected && isFullPageSelected) {
    return (
      <FilePageView
        file={selected.file}
        panel={DOC_VIEWER_PANEL}
        folder={selected.folder}
        docScroll={docScroll}
        onDocScroll={persistDocScroll}
        onRestore={selected.folder === DOC_VIEWER_ARCHIVE_FOLDER ? undefined : restoreSelectedFile}
        onArchive={archiveSelectedFile}
        starred={isDocFileStarred(selected.file.path)}
        onRename={() => renameFile(selected.file, selected.folder)}
        onDelete={() => deleteFile(selected.file, selected.folder)}
        onToggleStar={getFileStarClickHandler(selected.file, selected.folder)}
        hideChromeTitle={isTabsMode}
        onBack={() => {
          if ((docTabs?.length ?? 0) > 0) {
            backOutOfCaptureDocument();
            return;
          }
          setIsFullPageSelected(false);
          clearSelection();
        }}
      />
    );
  }

  return (
    <div className="rv-tile-grid rv-capture-viewer-grid">
      <DocViewerHeader
        mode={mode}
        onModeChange={handleModeChange}
        isSearchOpen={isSearchOpen}
        isSearchSubmitted={isSearchSubmitted}
        searchQuery={searchQuery}
        onSearchOpenChange={handleSearchOpenChange}
        onSearchQueryChange={handleSearchQueryChange}
        onSearchSubmit={handleSearchSubmit}
        tabsMode={isTabsMode}
      />
      <div
        ref={scrollRef}
        className="rv-capture-viewer-grid-scroll"
        onScroll={(e) => {
          if (suppressGridScrollPersistRef.current && e.currentTarget.scrollTop === 0) return;
          persistGridScroll(e.currentTarget.scrollTop);
        }}
      >
        {isSearchSubmitted ? (
          searchLoading ? (
            <div className="rv-capture-viewer-searching" role="status" aria-live="polite">
              <div className="rv-capture-viewer-searching-text">Searching</div>
              <Pinwheel
                className="rv-capture-viewer-searching-pinwheel"
                size="8rem"
                color="var(--accent-dim, var(--theme-primary, #39628e))"
              />
            </div>
          ) : searchItems.length === 0 ? (
            <div className="rv-tile-row-empty">Empty</div>
          ) : rankedSearchItems.length === 0 ? (
            <div className="rv-tile-row-empty">No matches</div>
          ) : (
            <div className="rv-capture-viewer-archive-grid rv-capture-viewer-search-grid">
              {rankedSearchItems.map(({ folder, file }) => (
                <DocumentTile
                  key={`${folder}/${file.path}`}
                  name={file.name}
                  content={file.content}
                  extension={file.extension}
                  panel={DOC_VIEWER_PANEL}
                  folderPath={folder}
                  checked={isLastOpenedFile(folder, file)}
                  starred={isDocFileStarred(file.path)}
                  onStarClick={getFileStarClickHandler(file, folder)}
                  onClick={() => openFilePreview(folder, file)}
                  onContextMenu={(event) => openFileFullScreen(event, folder, file)}
                  moreButton={(
                    <CaptureDocumentMenuButton
                      fileName={file.name}
                      className="rv-doc-tile-more"
                      onRename={() => renameFile(file, folder)}
                      onArchive={() => archiveOrRestoreFile(file, folder)}
                      onDelete={() => deleteFile(file, folder)}
                    />
                  )}
                />
              ))}
            </div>
          )
        ) : mode === 'recent' ? (
          recentGroups.length === 0 ? (
            <div className="rv-tile-row-empty">No recent documents</div>
          ) : (
            <div className="rv-capture-viewer-recent-results">
              {recentGroups.map((group) => (
                <div className="rv-capture-viewer-recent-section" key={group.label}>
                  <div className="rv-capture-viewer-recent-section-title">{group.label}</div>
                  <div className="rv-capture-viewer-archive-grid">
                    {group.items.map((item) => {
                      const folder = item.folder ?? '';
                      const file: FileWithContent = {
                        name: item.title,
                        path: item.path,
                        type: 'file',
                        extension: item.extension ?? item.title.split('.').pop()?.toLowerCase(),
                        content: contents[`${DOC_VIEWER_PANEL}:${item.path}`] ?? '',
                      };
                      return (
                        <DocumentTile
                          key={item.id}
                          name={file.name}
                          content={file.content}
                          extension={file.extension}
                          panel={DOC_VIEWER_PANEL}
                          folderPath={folder}
                          checked={isLastOpenedFile(folder, file)}
                          starred={isDocFileStarred(file.path)}
                          onStarClick={getFileStarClickHandler(file, folder)}
                          onClick={() => openFilePreview(folder, file)}
                          onContextMenu={(event) => openFileFullScreen(event, folder, file)}
                          moreButton={(
                            <CaptureDocumentMenuButton
                              fileName={file.name}
                              className="rv-doc-tile-more"
                              onRename={() => renameFile(file, folder)}
                              onArchive={() => archiveOrRestoreFile(file, folder)}
                              onDelete={() => deleteFile(file, folder)}
                            />
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : mode === 'starred' ? (
          docCollections.starred.length === 0 ? (
            <div className="rv-tile-row-empty">No starred documents</div>
          ) : (
            <div className="rv-capture-viewer-archive-grid">
              {docCollections.starred
                .filter((item) => item.panel === DOC_VIEWER_PANEL)
                .map((item) => {
                  const folder = item.folder ?? item.path.split('/').slice(0, -1).join('/');
                  const file: FileWithContent = {
                    name: item.title,
                    path: item.path,
                    type: 'file',
                    extension: item.extension ?? item.title.split('.').pop()?.toLowerCase(),
                    content: contents[`${DOC_VIEWER_PANEL}:${item.path}`] ?? '',
                  };
                  return (
                    <DocumentTile
                      key={item.id}
                      name={file.name}
                      content={file.content}
                      extension={file.extension}
                      panel={DOC_VIEWER_PANEL}
                      folderPath={folder}
                      checked={isLastOpenedFile(folder, file)}
                      starred={true}
                      onStarClick={getFileStarClickHandler(file, folder)}
                      onClick={() => openFilePreview(folder, file)}
                      onContextMenu={(event) => openFileFullScreen(event, folder, file)}
                      moreButton={(
                        <CaptureDocumentMenuButton
                          fileName={file.name}
                          className="rv-doc-tile-more"
                          onRename={() => renameFile(file, folder)}
                          onArchive={() => archiveOrRestoreFile(file, folder)}
                          onDelete={() => deleteFile(file, folder)}
                        />
                      )}
                    />
                  );
                })}
            </div>
          )
        ) : mode === 'archive' ? (
          archiveLoading ? (
            <div className="rv-tile-row-empty">Loading...</div>
          ) : archiveFiles.length === 0 ? (
            <div className="rv-tile-row-empty">Empty</div>
          ) : (
            <div className="rv-capture-viewer-archive-grid">
              {archiveFiles.map((file) => (
                <DocumentTile
                  key={file.path}
                  name={file.name}
                  content={file.content}
                  extension={file.extension}
                  panel={DOC_VIEWER_PANEL}
                  folderPath={DOC_VIEWER_ARCHIVE_FOLDER}
                  checked={isLastOpenedFile(DOC_VIEWER_ARCHIVE_FOLDER, file)}
                  starred={isDocFileStarred(file.path)}
                  onStarClick={getFileStarClickHandler(file, DOC_VIEWER_ARCHIVE_FOLDER)}
                  onClick={() => openFilePreview(DOC_VIEWER_ARCHIVE_FOLDER, file)}
                  onContextMenu={(event) => openFileFullScreen(event, DOC_VIEWER_ARCHIVE_FOLDER, file)}
                  moreButton={(
                    <CaptureDocumentMenuButton
                      fileName={file.name}
                      className="rv-doc-tile-more"
                      onRename={() => renameFile(file, DOC_VIEWER_ARCHIVE_FOLDER)}
                      onArchive={() => archiveOrRestoreFile(file, DOC_VIEWER_ARCHIVE_FOLDER)}
                      onDelete={() => deleteFile(file, DOC_VIEWER_ARCHIVE_FOLDER)}
                    />
                  )}
                />
              ))}
            </div>
          )
        ) : rootNodes === undefined ? (
          <div className="rv-tile-row-empty">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="rv-tile-row-empty">Empty</div>
        ) : rows.map((row) => (
          <TileRow
            key={row.folder}
            label={row.label}
            panel={DOC_VIEWER_PANEL}
            folder={row.folder}
            checkedPath={lastOpenedPath}
            onFileSelect={handleFileSelect(row.folder)}
            onFileContextMenu={(event, file) => openFileFullScreen(event, row.folder, file)}
          />
        ))}
      </div>
      {selected && (
        <DocumentPreviewModal
          file={selected.file}
          panel={DOC_VIEWER_PANEL}
          starred={isDocFileStarred(selected.file.path)}
          onClose={() => {
            setIsFullPageSelected(false);
            clearSelection();
          }}
          onOpenFullScreen={() => openDocFullScreen(selected.folder, selected.file)}
          onRename={() => renameFile(selected.file, selected.folder)}
          onArchive={archiveSelectedFile}
          onDelete={() => deleteFile(selected.file, selected.folder)}
          onToggleStar={getFileStarClickHandler(selected.file, selected.folder)}
        />
      )}
    </div>
  );
}
