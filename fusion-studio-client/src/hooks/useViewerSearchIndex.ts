/**
 * @module useViewerSearchIndex
 * @role Shared file-tree indexing and ranking for viewer search surfaces.
 */

import { useEffect, useMemo } from 'react';
import { rankSearchFields, type SearchRankFields } from '../lib/searchQuery';
import { useFileDataStore, type FileNode, type FileWithContent } from '../state/fileDataStore';

export interface ViewerSearchRoot {
  path: string;
  label: string;
}

interface IndexedSearchFolder extends ViewerSearchRoot {
  folderIndex: number;
}

export interface ViewerSearchFolderResult {
  kind: 'folder';
  path: string;
  name: string;
  parentPath: string;
  parentLabel: string;
  folderIndex: number;
  nodeIndex: number;
}

export interface RankedViewerSearchFolderResult extends ViewerSearchFolderResult {
  score: number;
}

export interface ViewerSearchFileItem<TMetadata = undefined> {
  kind: 'file';
  folder: string;
  folderLabel: string;
  folderIndex: number;
  fileIndex: number;
  file: FileWithContent;
  metadata: TMetadata;
}

export interface RankedViewerSearchFileItem<TMetadata = undefined> extends ViewerSearchFileItem<TMetadata> {
  score: number;
}

interface FileMetadataArgs {
  node: FileNode;
  folder: IndexedSearchFolder;
  fileIndex: number;
  content: string;
}

interface UseViewerSearchIndexOptions<TMetadata> {
  panel: string;
  roots: ViewerSearchRoot[];
  enabled: boolean;
  query: string;
  recursive?: boolean;
  includeFolderResults?: boolean;
  includeFolderNode?: (node: FileNode, folder: IndexedSearchFolder) => boolean;
  includeFileNode?: (node: FileNode, folder: IndexedSearchFolder) => boolean;
  shouldLoadContent?: (node: FileNode, folder: IndexedSearchFolder) => boolean;
  getFileMetadata?: (args: FileMetadataArgs) => TMetadata;
  getFileSearchFields?: (item: ViewerSearchFileItem<TMetadata>) => SearchRankFields;
  getFolderSearchFields?: (item: ViewerSearchFolderResult) => SearchRankFields;
}

interface ViewerSearchIndex<TMetadata> {
  fileItems: ViewerSearchFileItem<TMetadata>[];
  folderResults: ViewerSearchFolderResult[];
  rankedFileItems: RankedViewerSearchFileItem<TMetadata>[];
  rankedFolderResults: RankedViewerSearchFolderResult[];
  loading: boolean;
}

function defaultIncludeFolderNode(node: FileNode): boolean {
  return node.type === 'folder' && !node.name.startsWith('.');
}

function defaultIncludeFileNode(node: FileNode): boolean {
  return node.type === 'file' && !node.name.startsWith('.');
}

function defaultShouldLoadContent(): boolean {
  return true;
}

function defaultFileSearchFields<TMetadata>(item: ViewerSearchFileItem<TMetadata>): SearchRankFields {
  return {
    title: item.file.name,
    location: `${item.folderLabel}\n${item.folder}`,
    body: item.file.content,
  };
}

function defaultFolderSearchFields(item: ViewerSearchFolderResult): SearchRankFields {
  return {
    title: item.name,
    location: item.path,
    body: '',
  };
}

function treeKey(panel: string, folder: string): string {
  return `${panel}:${folder}`;
}

export function useViewerSearchIndex<TMetadata = undefined>({
  panel,
  roots,
  enabled,
  query,
  recursive = false,
  includeFolderResults = false,
  includeFolderNode = defaultIncludeFolderNode,
  includeFileNode = defaultIncludeFileNode,
  shouldLoadContent = defaultShouldLoadContent,
  getFileMetadata,
  getFileSearchFields = defaultFileSearchFields,
  getFolderSearchFields = defaultFolderSearchFields,
}: UseViewerSearchIndexOptions<TMetadata>): ViewerSearchIndex<TMetadata> {
  const trees = useFileDataStore((s) => s.trees);
  const contents = useFileDataStore((s) => s.contents);
  const contentErrors = useFileDataStore((s) => s.contentErrors);
  const fileDataGeneration = useFileDataStore((s) => s.generation);
  const requestTree = useFileDataStore((s) => s.requestTree);
  const requestContent = useFileDataStore((s) => s.requestContent);

  const indexedFolders = useMemo<IndexedSearchFolder[]>(() => {
    const result: IndexedSearchFolder[] = [];
    const seen = new Set<string>();
    const queue = roots.map((root, index) => ({ ...root, folderIndex: index }));

    for (let index = 0; index < queue.length; index += 1) {
      const folder = queue[index];
      if (seen.has(folder.path)) continue;

      seen.add(folder.path);
      result.push(folder);

      if (!recursive) continue;

      const nodes = trees[treeKey(panel, folder.path)];
      if (!nodes) continue;

      for (const node of nodes) {
        if (!includeFolderNode(node, folder)) continue;
        queue.push({
          path: node.path,
          label: node.name,
          folderIndex: queue.length,
        });
      }
    }

    return result;
  }, [includeFolderNode, panel, recursive, roots, trees]);

  const indexedFolderKey = useMemo(
    () => indexedFolders.map((folder) => folder.path).join('\n'),
    [indexedFolders]
  );

  useEffect(() => {
    if (!enabled) return;
    for (const folder of indexedFolders) {
      requestTree(panel, folder.path);
    }
  }, [enabled, fileDataGeneration, indexedFolderKey, indexedFolders, panel, requestTree]);

  useEffect(() => {
    if (!enabled) return;

    for (const folder of indexedFolders) {
      const nodes = trees[treeKey(panel, folder.path)];
      if (!nodes) continue;

      for (const node of nodes) {
        if (!includeFileNode(node, folder) || !shouldLoadContent(node, folder)) continue;
        requestContent(panel, node.path);
      }
    }
  }, [enabled, includeFileNode, indexedFolderKey, indexedFolders, panel, requestContent, shouldLoadContent, trees]);

  return useMemo<ViewerSearchIndex<TMetadata>>(() => {
    if (!enabled) {
      return {
        fileItems: [],
        folderResults: [],
        rankedFileItems: [],
        rankedFolderResults: [],
        loading: false,
      };
    }

    let loading = false;
    const fileItems: ViewerSearchFileItem<TMetadata>[] = [];
    const folderResults: ViewerSearchFolderResult[] = [];

    for (const folder of indexedFolders) {
      const nodes = trees[treeKey(panel, folder.path)];
      if (!nodes) {
        loading = true;
        continue;
      }

      nodes.forEach((node, nodeIndex) => {
        if (includeFolderResults && includeFolderNode(node, folder)) {
          folderResults.push({
            kind: 'folder',
            path: node.path,
            name: node.name,
            parentPath: folder.path,
            parentLabel: folder.label,
            folderIndex: folder.folderIndex,
            nodeIndex,
          });
        }

        if (!includeFileNode(node, folder)) return;

        const needsContent = shouldLoadContent(node, folder);
        const contentKey = treeKey(panel, node.path);
        const content = needsContent ? contents[contentKey] : '';
        const resolvedContent = content ?? '';
        if (needsContent && content === undefined && contentErrors[contentKey] === undefined) {
          loading = true;
        }

        fileItems.push({
          kind: 'file',
          folder: folder.path,
          folderLabel: folder.label,
          folderIndex: folder.folderIndex,
          fileIndex: nodeIndex,
          file: { ...node, content: resolvedContent },
          metadata: getFileMetadata
            ? getFileMetadata({ node, folder, fileIndex: nodeIndex, content: resolvedContent })
            : (undefined as TMetadata),
        });
      });
    }

    const rankedFolderResults = folderResults
      .map((item) => {
        const rank = rankSearchFields(getFolderSearchFields(item), query);
        return rank.matches ? { ...item, score: rank.score } : null;
      })
      .filter((item): item is RankedViewerSearchFolderResult => item !== null)
      .sort((a, b) =>
        b.score - a.score ||
        a.folderIndex - b.folderIndex ||
        a.nodeIndex - b.nodeIndex ||
        a.name.localeCompare(b.name)
      );

    const rankedFileItems = fileItems
      .map((item) => {
        const rank = rankSearchFields(getFileSearchFields(item), query);
        return rank.matches ? { ...item, score: rank.score } : null;
      })
      .filter((item): item is RankedViewerSearchFileItem<TMetadata> => item !== null)
      .sort((a, b) =>
        b.score - a.score ||
        a.folderIndex - b.folderIndex ||
        a.fileIndex - b.fileIndex ||
        a.file.name.localeCompare(b.file.name)
      );

    return {
      fileItems,
      folderResults,
      rankedFileItems,
      rankedFolderResults,
      loading,
    };
  }, [
    contents,
    contentErrors,
    enabled,
    getFileMetadata,
    getFileSearchFields,
    getFolderSearchFields,
    includeFileNode,
    includeFolderNode,
    includeFolderResults,
    indexedFolders,
    panel,
    query,
    shouldLoadContent,
    trees,
  ]);
}
