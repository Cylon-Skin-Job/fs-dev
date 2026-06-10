/**
 * @module wikiStore
 * @role State management for the wiki-viewer folder-tree model
 * @reads ai/views/wiki-viewer/Wiki/PAGE.md and child folder PAGE.md files
 */

import { create } from 'zustand';

export type WikiNodeKind =
  | 'root'
  | 'section'
  | 'article'
  | 'sidebar-section'
  | 'sidebar-article';

export interface WikiNode {
  id: string;
  name: string;
  label: string;
  path: string;
  pagePath: string;
  kind: WikiNodeKind;
  depth: number;
  children: WikiNode[];
}

interface WikiState {
  root: WikiNode | null;
  selectedPath: string;
  viewedPath: string;
  viewedPagePath: string;
  selectedContent: string;
  loading: boolean;
  error: string | null;
  history: string[];
  historyIndex: number;
}

type WikiActions = {
  setRoot: (root: WikiNode | null) => void;
  selectNode: (node: WikiNode) => void;
  viewNode: (node: WikiNode) => void;
  setSelectedContent: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  goBack: () => void;
  goForward: () => void;
  activateWorkspace: (workspaceId: string | null) => void;
  reset: () => void;
};

type FullWikiState = WikiState & WikiActions;

export function wikiFolderNameToLabel(name: string): string {
  return name.replace(/^\d{3,}-/, '').replace(/_/g, ' ');
}

export function createWikiRootNode(children: WikiNode[] = []): WikiNode {
  return {
    id: 'root',
    name: 'Wiki',
    label: 'Wiki Guide',
    path: '',
    pagePath: 'PAGE.md',
    kind: 'root',
    depth: 0,
    children,
  };
}

export function createWikiNode(params: {
  name: string;
  path: string;
  kind: WikiNodeKind;
  depth: number;
  children?: WikiNode[];
}): WikiNode {
  return {
    id: params.path || 'root',
    name: params.name,
    label: wikiFolderNameToLabel(params.name),
    path: params.path,
    pagePath: params.path ? `${params.path}/PAGE.md` : 'PAGE.md',
    kind: params.kind,
    depth: params.depth,
    children: params.children || [],
  };
}

export function findWikiNodeByPath(node: WikiNode | null, path: string): WikiNode | null {
  if (!node) return null;
  if (node.path === path) return node;

  for (const child of node.children) {
    const found = findWikiNodeByPath(child, path);
    if (found) return found;
  }

  return null;
}

function createEmptyState(): WikiState {
  return {
    root: null,
    selectedPath: '',
    viewedPath: '',
    viewedPagePath: '',
    selectedContent: '',
    loading: false,
    error: null,
    history: [],
    historyIndex: -1,
  };
}

function selectionForNode(node: WikiNode) {
  return {
    selectedPath: node.path,
    viewedPath: node.path,
    viewedPagePath: node.pagePath,
  };
}

function viewForNode(node: WikiNode) {
  return {
    viewedPath: node.path,
    viewedPagePath: node.pagePath,
  };
}

export const useWikiStore = create<FullWikiState>((set, get) => ({
  ...createEmptyState(),

  setRoot: (root) => {
    const selectedNode = root ? findWikiNodeByPath(root, get().selectedPath) || root : null;
    const viewedNode = root && get().viewedPath ? findWikiNodeByPath(root, get().viewedPath) : selectedNode;

    set({
      root,
      ...(selectedNode ? { selectedPath: selectedNode.path } : { selectedPath: '' }),
      ...(viewedNode ? viewForNode(viewedNode) : { viewedPath: '', viewedPagePath: '' }),
      selectedContent: '',
      loading: false,
      error: null,
      history: viewedNode ? [viewedNode.path] : [],
      historyIndex: viewedNode ? 0 : -1,
    });
  },

  selectNode: (node) => {
    const state = get();
    const nextHistory = state.history.slice(0, state.historyIndex + 1);

    if (nextHistory[nextHistory.length - 1] !== node.path) {
      nextHistory.push(node.path);
    }

    set({
      ...selectionForNode(node),
      selectedContent: '',
      loading: true,
      error: null,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
  },

  viewNode: (node) => {
    const state = get();
    const nextHistory = state.history.slice(0, state.historyIndex + 1);

    if (nextHistory[nextHistory.length - 1] !== node.path) {
      nextHistory.push(node.path);
    }

    set({
      ...viewForNode(node),
      selectedContent: '',
      loading: true,
      error: null,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
  },

  setSelectedContent: (content) =>
    set({ selectedContent: content, loading: false, error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  goBack: () => {
    const state = get();
    if (state.historyIndex <= 0) return;

    const nextIndex = state.historyIndex - 1;
    const node = findWikiNodeByPath(state.root, state.history[nextIndex]);
    if (!node) return;

    set({
      historyIndex: nextIndex,
      ...viewForNode(node),
      selectedContent: '',
      loading: true,
      error: null,
    });
  },

  goForward: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;

    const nextIndex = state.historyIndex + 1;
    const node = findWikiNodeByPath(state.root, state.history[nextIndex]);
    if (!node) return;

    set({
      historyIndex: nextIndex,
      ...viewForNode(node),
      selectedContent: '',
      loading: true,
      error: null,
    });
  },

  activateWorkspace: () => {
    set(createEmptyState());
  },

  reset: () => set(createEmptyState()),
}));
