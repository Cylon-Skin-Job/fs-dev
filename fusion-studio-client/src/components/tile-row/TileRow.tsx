/**
 * @module TileRow
 * @role Generic horizontal row of document tiles for a folder
 *
 * Reads from the central fileDataStore via useFolderFiles hook.
 * Supports right-click context menu for rename, archive/restore, and delete.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useFolderFiles } from '../../hooks/useFolderFiles';
import { useTileFileActions } from '../../hooks/useTileFileActions';
import { showContextMenu } from '../../lib/contextMenu';
import { DocumentTile } from './DocumentTile';
import type { FileWithContent } from '../../state/fileDataStore';

// Re-export for consumers that import from here
export type { FileWithContent } from '../../state/fileDataStore';

interface TileRowProps {
  label: string;
  panel: string;
  folder: string;
  onFileClick?: (filePath: string) => void;
  onFileSelect?: (file: FileWithContent, siblings: FileWithContent[]) => void;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
}

export function TileRow({ label, panel, folder, onFileClick, onFileSelect }: TileRowProps) {
  const { files, loading } = useFolderFiles(panel, folder);
  const { isArchive, renameFile, archiveOrRestoreFile, deleteFile } = useTileFileActions({
    panel,
    folder,
  });
  const closeMenuRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      closeMenuRef.current?.();
    };
  }, []);

  const handleContextMenu = useCallback(
    (file: FileWithContent) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      closeMenuRef.current?.();

      const items = [
        { label: 'Rename', action: () => renameFile(file) },
        {
          label: isArchive ? 'Restore' : 'Archive',
          action: () => archiveOrRestoreFile(file),
        },
        { label: 'Delete', danger: true, action: () => deleteFile(file) },
      ];

      closeMenuRef.current = showContextMenu({
        x: e.clientX,
        y: e.clientY,
        items,
      });
    },
    [isArchive, renameFile, archiveOrRestoreFile, deleteFile]
  );

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
                onClick={() => {
                  onFileClick?.(file.path);
                  onFileSelect?.(file, files);
                }}
                onContextMenu={handleContextMenu(file)}
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
