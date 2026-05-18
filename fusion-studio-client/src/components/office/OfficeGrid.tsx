/**
 * @module OfficeGrid
 * @role Content component for the office-viewer panel
 *
 * Three-level navigation:
 * - Root: grid of folder cards
 * - Folder: grid of DocumentTiles for files in the selected folder
 * - File: full-page FilePageView with back button + sibling ribbon
 *
 * Reuses DocumentTile for thumbnails and FilePageView for detail.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { useFileDataStore } from '../../state/fileDataStore';
import { useRecentDocsStore } from '../../state/recentDocsStore';
import { usePanelStore } from '../../state/panelStore';
import { useFolderFiles } from '../../hooks/useFolderFiles';
import type { FileWithContent } from '../tile-row/TileRow';
import { OfficeDocumentTile } from './OfficeDocumentTile';
import { OfficeDocumentPage } from './OfficeDocumentPage';
import { FilePageView } from '../capture/FilePageView';
import { Icon } from '../Icon';
import { copyResourcePath } from '../../lib/resource-path';
import './OfficeGrid.css';

const PANEL = 'office-viewer';
const ROOT_PATH = '';

interface FolderInfo {
  name: string;
  path: string;
}

function isMarkdownDocument(file: FileWithContent): boolean {
  const fileName = file.name.toLowerCase();
  return file.extension === 'md' ||
    file.extension === 'markdown' ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.markdown');
}

export function OfficeGrid() {
  useViewLayoutStyles(PANEL);

  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileWithContent | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);

  const trees = useFileDataStore((s) => s.trees);
  const requestTree = useFileDataStore((s) => s.requestTree);

  // --- Folder discovery (root view) ---
  const rootKey = `${PANEL}:${ROOT_PATH}`;
  const rootNodes = trees[rootKey];

  useEffect(() => {
    requestTree(PANEL, ROOT_PATH);
  }, [requestTree]);

  useEffect(() => {
    if (rootNodes !== undefined) {
      setIsLoadingFolders(false);
    }
  }, [rootNodes]);

  const folders: FolderInfo[] = useMemo(() => {
    if (!rootNodes) return [];
    return rootNodes
      .filter((n) => n.type === 'folder')
      .map((n) => ({ name: n.name, path: n.path }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rootNodes]);

  // --- File listing (folder view) ---
  const { files, loading: filesLoading } = useFolderFiles(
    PANEL,
    currentFolder ?? ROOT_PATH
  );

  const documentFiles = useMemo(
    () => files.filter(isMarkdownDocument),
    [files]
  );

  const handleFolderClick = useCallback((folderPath: string) => {
    setCurrentFolder(folderPath);
    setSelectedFile(null);
  }, []);

  const handleBackToFolders = useCallback(() => {
    setCurrentFolder(null);
    setSelectedFile(null);
  }, []);

  const handleBackToFolder = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleFileClick = useCallback((file: FileWithContent) => {
    setSelectedFile(file);

    // Record in recent docs (markdown only)
    if (isMarkdownDocument(file) && currentFolder) {
      const workspaceId = usePanelStore.getState().activeWorkspaceId ?? '';
      if (workspaceId) {
        useRecentDocsStore.getState().recordOpen({
          workspaceId,
          panel: PANEL,
          path: file.path,
          folder: currentFolder,
          name: file.name,
        });
      }
    }
  }, [currentFolder]);

  const handleOpenFile = useCallback((path: string, folder: string) => {
    const fileData = useFileDataStore.getState();
    const cacheKey = `${PANEL}:${path}`;
    const cachedContent = fileData.contents[cacheKey] || '';

    if (!cachedContent) {
      fileData.requestContent(PANEL, path);
    }

    const name = path.split('/').pop() || path;
    const ext = name.split('.').pop()?.toLowerCase() || '';

    setCurrentFolder(folder);
    setSelectedFile({
      name,
      path,
      type: 'file',
      extension: ext,
      content: cachedContent,
    });
  }, []);

  // --- File detail view ---
  if (currentFolder && selectedFile) {
    const folderName = currentFolder.split('/').pop() || currentFolder;
    const isMarkdown = isMarkdownDocument(selectedFile);

    if (isMarkdown) {
      return (
        <OfficeDocumentPage
          key={selectedFile.path}
          file={selectedFile}
          folder={currentFolder}
          folderName={folderName}
          onBack={handleBackToFolder}
          onOpenFile={handleOpenFile}
        />
      );
    }

    // Non-markdown files still use FilePageView
    return (
      <FilePageView
        file={selectedFile}
        panel={PANEL}
        folder={currentFolder}
        folderName={folderName}
        showRibbon={false}
        onBack={handleBackToFolder}
      />
    );
  }

  // --- Folder view ---
  if (currentFolder) {
    const folderName = currentFolder.split('/').pop() || currentFolder;

    return (
      <div className="rv-office-folder-view rv-office-view-transition">
        <div className="rv-office-topbar">
          <button
            className="rv-office-topbar-back"
            onClick={handleBackToFolders}
            title="Back to folders"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="rv-office-topbar-title">{folderName}</span>
          <div className="rv-office-topbar-actions">
            <button
              className="rv-office-topbar-action"
              onClick={() => copyResourcePath(PANEL, currentFolder)}
              title="Copy folder path"
            >
              <span className="material-symbols-outlined">link_2</span>
            </button>
          </div>
        </div>

        <div className="rv-office-folder-content">
          {filesLoading ? (
            <div className="rv-office-loading">
              <span>Loading files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="rv-office-empty">
              <Icon name="folder_open" className="rv-office-empty-icon" />
              <span>This folder is empty</span>
            </div>
          ) : documentFiles.length === 0 ? (
            <div className="rv-office-empty">
              <Icon name="description" className="rv-office-empty-icon" />
              <span>No documents in this folder.</span>
            </div>
          ) : (
            <div className="rv-office-file-grid">
              {documentFiles.map((file) => (
                <OfficeDocumentTile
                  key={file.path}
                  name={file.name}
                  content={file.content}
                  extension={file.extension}
                  panel={PANEL}
                  folderPath={currentFolder}
                  onClick={() => handleFileClick(file)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Root folder grid view ---
  return (
    <div className="rv-office-grid rv-office-view-transition">
      <div className="rv-office-header">
        <h2 className="rv-office-title">Office</h2>
      </div>

      {isLoadingFolders ? (
        <div className="rv-office-loading">
          <span>Loading folders...</span>
        </div>
      ) : folders.length === 0 ? (
        <div className="rv-office-empty">
          <Icon name="folder_open" className="rv-office-empty-icon" />
          <span>No folders yet</span>
        </div>
      ) : (
        <div className="rv-office-folder-grid">
          {folders.map((folder) => (
            <button
              key={folder.path}
              className="rv-office-folder-card"
              onClick={() => handleFolderClick(folder.path)}
              title={folder.name}
            >
              <Icon
                name="folder"
                className="rv-office-folder-icon"
                filled={true}
              />
              <span className="rv-office-folder-name">{folder.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
