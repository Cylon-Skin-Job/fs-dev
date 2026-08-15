/**
 * @module useCaptureViewerSearch
 * @role Capture-specific search rules over the shared viewer search index.
 */

import { useMemo } from 'react';
import type { FileNode } from '../../state/fileDataStore';
import {
  useViewerSearchIndex,
  type RankedViewerSearchFileItem,
  type ViewerSearchFileItem,
  type ViewerSearchRoot,
} from '../../hooks/useViewerSearchIndex';
import { DOC_VIEWER_ARCHIVE_FOLDER } from '../../hooks/useDocViewerState';
import { isImageFile } from '../tile-row/documentTileUtils';

const DOC_VIEWER_PANEL = 'capture-viewer';

interface CaptureSearchFolder {
  folder: string;
  label: string;
}

interface CaptureSearchMetadata {
  isArchived: boolean;
  isStarred: boolean;
  modifiedAt: number | null;
}

type FileNodeWithSearchMetadata = FileNode & {
  isStarred?: boolean;
  starred?: boolean;
  lastModified?: number;
  modifiedAt?: number;
  mtime?: number;
  mtimeMs?: number;
};

export type CaptureSearchFileItem = ViewerSearchFileItem<CaptureSearchMetadata>;
export type RankedCaptureSearchFileItem = RankedViewerSearchFileItem<CaptureSearchMetadata>;

function includeCaptureFileNode(node: FileNode): boolean {
  return node.type === 'file' && !node.name.startsWith('.');
}

function shouldLoadCaptureContent(node: FileNode): boolean {
  return !isImageFile(node.name);
}

function getCaptureMetadata(node: FileNode, folder: string): CaptureSearchMetadata {
  const metadata = node as FileNodeWithSearchMetadata;
  return {
    isArchived: folder === DOC_VIEWER_ARCHIVE_FOLDER,
    isStarred: Boolean(metadata.isStarred ?? metadata.starred ?? false),
    modifiedAt: metadata.lastModified ?? metadata.modifiedAt ?? metadata.mtimeMs ?? metadata.mtime ?? null,
  };
}

export function useCaptureViewerSearch(
  folders: CaptureSearchFolder[],
  enabled: boolean,
  query: string
) {
  const roots = useMemo<ViewerSearchRoot[]>(
    () => folders.map((folder) => ({ path: folder.folder, label: folder.label })),
    [folders]
  );

  return useViewerSearchIndex<CaptureSearchMetadata>({
    panel: DOC_VIEWER_PANEL,
    roots,
    enabled,
    query,
    includeFileNode: includeCaptureFileNode,
    shouldLoadContent: shouldLoadCaptureContent,
    getFileMetadata: ({ node, folder }) => getCaptureMetadata(node, folder.path),
  });
}
