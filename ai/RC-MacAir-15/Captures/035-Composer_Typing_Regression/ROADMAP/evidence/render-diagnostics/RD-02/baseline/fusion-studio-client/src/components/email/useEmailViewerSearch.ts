/**
 * @module useEmailViewerSearch
 * @role Email-specific search rules over the shared viewer search index.
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
import { EMAIL_VIEWER_ARCHIVE_FOLDER } from '../../lib/viewFolders';
import { isImageFile } from '../tile-row/documentTileUtils';

const EMAIL_VIEWER_PANEL = 'email-viewer';

export type EmailSearchFileItem = ViewerSearchFileItem;
export type RankedEmailSearchFileItem = RankedViewerSearchFileItem;
export type RankedEmailSearchFolderResult = RankedViewerSearchFolderResult;

function includeEmailFolderNode(node: FileNode): boolean {
  return node.type === 'folder' && !node.name.startsWith('.');
}

function includeEmailFileNode(node: FileNode): boolean {
  return node.type === 'file' && !node.name.startsWith('.');
}

function shouldLoadEmailContent(node: FileNode): boolean {
  return !isImageFile(node.name);
}

interface UseEmailViewerSearchOptions {
  enabled: boolean;
  query: string;
}

export function useEmailViewerSearch({
  enabled,
  query,
}: UseEmailViewerSearchOptions) {
  const roots = useMemo<ViewerSearchRoot[]>(
    () => [
      { path: '', label: 'Email' },
      { path: EMAIL_VIEWER_ARCHIVE_FOLDER, label: 'Archive' },
    ],
    []
  );

  return useViewerSearchIndex({
    panel: EMAIL_VIEWER_PANEL,
    roots,
    enabled,
    query,
    recursive: true,
    includeFolderResults: true,
    includeFolderNode: includeEmailFolderNode,
    includeFileNode: includeEmailFileNode,
    shouldLoadContent: shouldLoadEmailContent,
  });
}
