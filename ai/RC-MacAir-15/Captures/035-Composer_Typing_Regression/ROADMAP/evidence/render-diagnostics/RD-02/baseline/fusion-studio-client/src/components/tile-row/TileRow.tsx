/**
 * @module TileRow
 * @role Generic horizontal row of document tiles for a folder
 *
 * Reads from the central fileDataStore via useFolderFiles hook.
 * Supports right-click context menu for rename, archive/restore, and delete.
 */

import { useMemo } from 'react';
import { useFolderFiles } from '../../hooks/useFolderFiles';
import { useFileTileMenu } from '../../hooks/useFileTileMenu';
import { DocumentTile } from './DocumentTile';
import type { FileWithContent } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { activityId } from '../../lib/viewActivity';
import { normalizeViewCollections } from '../../lib/viewCollections';
import { useTileFileActions } from '../../hooks/useTileFileActions';
import { CaptureDocumentMenuButton } from '../capture/CaptureDocumentMenuButton';

// Re-export for consumers that import from here
export type { FileWithContent } from '../../state/fileDataStore';

interface TileRowProps {
  label: string;
  panel: string;
  folder: string;
  checkedPath?: string | null;
  onFileClick?: (filePath: string) => void;
  onFileSelect?: (file: FileWithContent, siblings: FileWithContent[]) => void;
  onFileContextMenu?: (event: React.MouseEvent, file: FileWithContent) => void;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
}

export function TileRow({ label, panel, folder, checkedPath, onFileClick, onFileSelect, onFileContextMenu }: TileRowProps) {
  const { files, loading } = useFolderFiles(panel, folder);
  const rawCollections = usePanelStore((s) => s.viewStates[panel]?.collections);
  const starredIds = useMemo(
    () => new Set(normalizeViewCollections(rawCollections).starred.map((item) => item.id)),
    [rawCollections]
  );
  const { getFileStarClickHandler } = useFileTileMenu({
    panel,
    folder,
  });
  const { archiveOrRestoreFile, renameFile, deleteFile } = useTileFileActions({ panel, folder });

  return (
    <div className="rv-tile-row">
      <div className="rv-tile-row-header">
        <span className="rv-tile-row-label">{label}</span>
        <span className="rv-tile-row-count">
          {loading ? '...' : files.length > 0 ? `${files.length}` : ''}
        </span>
      </div>
      <div className="rv-tile-row-scroll">
        {loading ? (
          <div className="rv-tile-row-empty">Loading...</div>
        ) : files.length === 0 ? (
          <div className="rv-tile-row-empty">Empty</div>
        ) : (
          <>
            {files.slice(0, 30).map((file) => (
              <DocumentTile
                key={file.path}
                name={file.name}
                content={file.content}
                extension={file.extension}
                panel={panel}
                folderPath={folder}
                checked={checkedPath === file.path || checkedPath === `${folder}/${file.name}`}
                starred={starredIds.has(activityId(panel, file.path))}
                onStarClick={getFileStarClickHandler(file)}
                onClick={() => {
                  onFileClick?.(file.path);
                  onFileSelect?.(file, files);
                }}
                onContextMenu={(event) => onFileContextMenu?.(event, file)}
                moreButton={(
                  <CaptureDocumentMenuButton
                    fileName={file.name}
                    className="rv-doc-tile-more"
                    onRename={() => renameFile(file)}
                    onArchive={() => archiveOrRestoreFile(file)}
                    onDelete={() => deleteFile(file)}
                  />
                )}
              />
            ))}
            {files.length > 30 && (
              <div className="rv-tile-row-more">+{files.length - 30} more</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
