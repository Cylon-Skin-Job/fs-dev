/**
 * @module WikiExplorer
 * @role Top-level wiki-viewer panel component — three-column layout
 * @reads wikiStore: root, viewedPagePath
 *
 * Renders: TopicList (left) | PageViewer (center) | EdgePanel (right)
 * Discovers folders under ai/<machine>/Wiki and loads each selected PAGE.md.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { usePanelStore } from '../../state/panelStore';
import { createWikiNode, createWikiRootNode, useWikiStore, type WikiNode, type WikiNodeKind } from '../../state/wikiStore';
import type { FileTreeNode } from '../../types/file-explorer';
import { TopicList } from './TopicList';
import { PageViewer } from './PageViewer';
import { EdgePanel } from './EdgePanel';

const MAX_WIKI_DEPTH = 4;

function getDepthForPath(path: string): number {
  if (!path) return 0;
  return path.split('/').filter(Boolean).length;
}

function kindForDepth(depth: number): WikiNodeKind {
  if (depth === 1) return 'section';
  if (depth === 2) return 'article';
  if (depth === 3) return 'sidebar-section';
  return 'sidebar-article';
}

function foldersOnly(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .filter((node) => node.type === 'folder')
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildNodeTree(path: string, folderMap: Map<string, FileTreeNode[]>): WikiNode[] {
  const folders = folderMap.get(path) || [];

  return folders.map((folder) => {
    const depth = getDepthForPath(folder.path);
    return createWikiNode({
      name: folder.name,
      path: folder.path,
      kind: kindForDepth(depth),
      depth,
      children: depth < MAX_WIKI_DEPTH ? buildNodeTree(folder.path, folderMap) : [],
    });
  });
}

export function WikiExplorer() {
  useViewLayoutStyles('wiki-viewer');
  const ws = usePanelStore((s) => s.ws);
  const activeWorkspaceId = usePanelStore((s) => s.activeWorkspaceId);
  const pendingTreePathsRef = useRef<Set<string>>(new Set());
  const folderMapRef = useRef<Map<string, FileTreeNode[]>>(new Map());

  const root = useWikiStore((s) => s.root);
  const viewedPagePath = useWikiStore((s) => s.viewedPagePath);
  const setRoot = useWikiStore((s) => s.setRoot);
  const setSelectedContent = useWikiStore((s) => s.setSelectedContent);
  const setLoading = useWikiStore((s) => s.setLoading);
  const setError = useWikiStore((s) => s.setError);

  const sendTreeRequest = useCallback((path: string) => {
    const socket = usePanelStore.getState().ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    pendingTreePathsRef.current.add(path);
    socket.send(JSON.stringify({
      type: 'file_tree_request',
      panel: 'wiki-viewer',
      path,
    }));
  }, []);

  const sendContentRequest = useCallback((path: string) => {
    const socket = usePanelStore.getState().ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: 'file_content_request',
      panel: 'wiki-viewer',
      path,
    }));
  }, []);

  const publishTreeIfReady = useCallback(() => {
    if (pendingTreePathsRef.current.size > 0) return;
    const children = buildNodeTree('', folderMapRef.current);
    setRoot(createWikiRootNode(children));
  }, [setRoot]);

  useEffect(() => {
    if (!ws) return;

    function handleMessage(event: MessageEvent) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.panel !== 'wiki-viewer') return;

        if (msg.type === 'file_tree_response') {
          const path = msg.path || '';
          if (!pendingTreePathsRef.current.has(path)) return;

          pendingTreePathsRef.current.delete(path);

          if (!msg.success) {
            setError(msg.error || `Failed to load wiki folder: ${path || 'Wiki'}`);
            publishTreeIfReady();
            return;
          }

          const folders = foldersOnly(msg.nodes || []);
          folderMapRef.current.set(path, folders);

          const depth = getDepthForPath(path);
          if (depth < MAX_WIKI_DEPTH) {
            folders.forEach((folder) => {
              if (!folderMapRef.current.has(folder.path)) {
                sendTreeRequest(folder.path);
              }
            });
          }

          publishTreeIfReady();
          return;
        }

        if (msg.type === 'file_content_response') {
          if (msg.path !== useWikiStore.getState().viewedPagePath) return;

          if (!msg.success) {
            setError(`Missing wiki page: ${msg.path}`);
            return;
          }

          setSelectedContent(msg.content || '', {
            isSymlink: msg.isSymlink,
            symlinkTarget: msg.symlinkTarget,
          });
        }
      } catch {
        // Ignore non-JSON WebSocket messages.
      }
    }

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [publishTreeIfReady, sendTreeRequest, setError, setSelectedContent, ws]);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    pendingTreePathsRef.current = new Set();
    folderMapRef.current = new Map();
    setRoot(null);
    setSelectedContent('');
    setError(null);
    sendTreeRequest('');
  }, [activeWorkspaceId, ws, sendTreeRequest, setError, setRoot, setSelectedContent]);

  useEffect(() => {
    if (!viewedPagePath) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setLoading(true);
    sendContentRequest(viewedPagePath);
  }, [viewedPagePath, ws, sendContentRequest, setLoading]);

  if (!root) {
    return (
      <div className="rv-wiki-explorer">
        <div className="rv-wiki-loading">
          <span className="rv-dim-label">Loading wiki...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rv-wiki-explorer">
      <TopicList />
      <PageViewer />
      <EdgePanel />
    </div>
  );
}
