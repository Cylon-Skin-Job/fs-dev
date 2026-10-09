/**
 * @module wikiStore
 * @role State management for the wiki-viewer folder-tree model
 * @reads ai/<machine>/Wiki folder-tree PAGE.md files; a folder's 000- child is its heading article
 */

import { create } from 'zustand';
import {
  getViewActivity,
  pushViewNavigation,
  setViewNavigationIndex,
} from '../lib/viewActivity';

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
  selectedSymlinkTarget: string | null;
  loading: boolean;
  error: string | null;
  history: string[];
  historyIndex: number;
}

type WikiActions = {
  setRoot: (root: WikiNode | null) => void;
  selectNode: (node: WikiNode) => void;
  viewNode: (node: WikiNode) => void;
  setSelectedContent: (content: string, metadata?: { isSymlink?: boolean; symlinkTarget?: string }) => void;
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

const HEADING_ARTICLE_PREFIX = '000-';
const WIKI_PANEL = 'wiki-viewer';

/**
 * A section heading's article is its 000- child folder, and only 000- —
 * a section with no 000- child has no article and is not clickable.
 */
export function findHeadingArticle(section: WikiNode): WikiNode | null {
  return section.children.find((child) => child.name.startsWith(HEADING_ARTICLE_PREFIX)) || null;
}

export function isWikiHeadingArticle(node: WikiNode): boolean {
  return node.name.startsWith(HEADING_ARTICLE_PREFIX);
}

export function isWikiRightNavContext(node: WikiNode | null): node is WikiNode {
  return Boolean(node && node.kind === 'article' && !isWikiHeadingArticle(node));
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
    selectedSymlinkTarget: null,
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

function wikiActivityInput(node: WikiNode) {
  return {
    panel: WIKI_PANEL,
    path: node.path,
    title: node.label,
    kind: 'page' as const,
    extension: 'md',
    metadata: {
      pagePath: node.pagePath,
      kind: node.kind,
    },
  };
}

export const useWikiStore = create<FullWikiState>((set, get) => ({
  ...createEmptyState(),

  setRoot: (root) => {
    // The root delegates to its 000- heading article when one exists, both
    // as the default selection and as the "Wiki Guide" button target.
    const rootDefault = root ? findHeadingArticle(root) || root : null;
    const activity = getViewActivity(WIKI_PANEL);
    const persistedStack = root
      ? activity.navigation.stack.filter((item) => findWikiNodeByPath(root, item.path))
      : [];
    const persistedIndex = persistedStack.length > 0
      ? Math.max(0, Math.min(persistedStack.length - 1, activity.navigation.index))
      : -1;
    const persistedViewed = root && persistedIndex >= 0
      ? findWikiNodeByPath(root, persistedStack[persistedIndex].path)
      : null;
    const storedSelected = root ? findWikiNodeByPath(root, get().selectedPath) : null;
    const selectedNode = storedSelected && storedSelected !== root ? storedSelected : persistedViewed || rootDefault;
    const viewedNode = persistedViewed || (root && get().viewedPath ? findWikiNodeByPath(root, get().viewedPath) || selectedNode : selectedNode);
    const history = persistedStack.length > 0
      ? persistedStack.map((item) => item.path)
      : (viewedNode ? [viewedNode.path] : []);
    const historyIndex = persistedStack.length > 0
      ? persistedIndex
      : (viewedNode ? 0 : -1);

    set({
      root,
      ...(selectedNode ? { selectedPath: selectedNode.path } : { selectedPath: '' }),
      ...(viewedNode ? viewForNode(viewedNode) : { viewedPath: '', viewedPagePath: '' }),
      selectedContent: '',
      selectedSymlinkTarget: null,
      loading: false,
      error: null,
      history,
      historyIndex,
    });
  },

  selectNode: (node) => {
    const state = get();
    const nextHistory = state.history.slice(0, state.historyIndex + 1);

    if (nextHistory[nextHistory.length - 1] !== node.path) {
      nextHistory.push(node.path);
    }
    pushViewNavigation(WIKI_PANEL, wikiActivityInput(node));

    // Re-selecting the viewed page must not clear its content: the content
    // request effect only fires on path change, so a clear here would strand
    // the viewer on the loading screen.
    if (node.path === state.viewedPath) {
      set({
        selectedPath: node.path,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
      });
      return;
    }

    set({
      ...selectionForNode(node),
      selectedContent: '',
      selectedSymlinkTarget: null,
      loading: true,
      error: null,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
  },

  viewNode: (node) => {
    const state = get();
    if (node.path === state.viewedPath) return;

    const nextHistory = state.history.slice(0, state.historyIndex + 1);

    if (nextHistory[nextHistory.length - 1] !== node.path) {
      nextHistory.push(node.path);
    }
    pushViewNavigation(WIKI_PANEL, wikiActivityInput(node));

    set({
      ...viewForNode(node),
      selectedContent: '',
      selectedSymlinkTarget: null,
      loading: true,
      error: null,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
  },

  setSelectedContent: (content, metadata) =>
    set({
      selectedContent: content,
      selectedSymlinkTarget: metadata?.isSymlink === true && metadata.symlinkTarget ? metadata.symlinkTarget : null,
      loading: false,
      error: null,
    }),

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
      selectedSymlinkTarget: null,
      loading: true,
      error: null,
    });
    setViewNavigationIndex(WIKI_PANEL, nextIndex);
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
      selectedSymlinkTarget: null,
      loading: true,
      error: null,
    });
    setViewNavigationIndex(WIKI_PANEL, nextIndex);
  },

  activateWorkspace: () => {
    set(createEmptyState());
  },

  reset: () => set(createEmptyState()),
}));
