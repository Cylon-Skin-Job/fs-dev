/**
 * @module useOfficeViewerSearch
 * @role Office-specific search rules over the shared viewer search index.
 */

import { useMemo } from 'react';
import type { FileNode } from '../../state/fileDataStore';
import {
  useViewerSearchIndex,
  type RankedViewerSearchFileItem,
  type RankedViewerSearchFolderResult,
  type ViewerSearchFileItem,
  type ViewerSearchRoot,
} from '../../hooks/useViewerSearchIndex';
import { OFFICE_VIEWER_ARCHIVE_FOLDER } from '../../lib/viewFolders';
import { isImageFile } from '../tile-row/documentTileUtils';

const OFFICE_VIEWER_PANEL = 'office-viewer';

export type OfficeSearchFileItem = ViewerSearchFileItem;
export type RankedOfficeSearchFileItem = RankedViewerSearchFileItem;
export type RankedOfficeSearchFolderResult = RankedViewerSearchFolderResult;

function includeOfficeFolderNode(node: FileNode): boolean {
  return node.type === 'folder' && !node.name.startsWith('.');
}

function includeOfficeFileNode(node: FileNode): boolean {
  return node.type === 'file' && !node.name.startsWith('.');
}

function shouldLoadOfficeContent(node: FileNode): boolean {
  return !isImageFile(node.name);
}

interface UseOfficeViewerSearchOptions {
  enabled: boolean;
  query: string;
}

export function useOfficeViewerSearch({
  enabled,
  query,
}: UseOfficeViewerSearchOptions) {
  const roots = useMemo<ViewerSearchRoot[]>(
    () => [
      { path: '', label: 'Office' },
      { path: OFFICE_VIEWER_ARCHIVE_FOLDER, label: 'Archive' },
    ],
    []
  );

  return useViewerSearchIndex({
    panel: OFFICE_VIEWER_PANEL,
    roots,
    enabled,
    query,
    recursive: true,
    includeFolderResults: true,
    includeFolderNode: includeOfficeFolderNode,
    includeFileNode: includeOfficeFileNode,
    shouldLoadContent: shouldLoadOfficeContent,
  });
}
