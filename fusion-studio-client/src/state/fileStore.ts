import { create } from 'zustand';
import type { FileTreeNode, FileInfo, EditorTab } from '../types/file-explorer';
import { basename, isAutocompleteFilePath } from '../lib/chat-file-links/file-link-filter';
import { useChatFileLinkStore } from './chatFileLinkStore';
import { createActivityItem, replaceViewTabs } from '../lib/viewActivity';
import type { ViewActivityState } from '../types';

const FILE_VIEWER_PANEL = 'file-viewer';

interface WorkspaceFileState {
  rootNodes: FileTreeNode[];
  expandedFolders: Set<string>;
  folderChildren: Map<string, FileTreeNode[]>;
  showHiddenFolders: boolean;
}

function createEmptyWorkspaceFileState(): WorkspaceFileState {
  return {
    rootNodes: [],
    expandedFolders: new Set(),
    folderChildren: new Map(),
    showHiddenFolders: false,
  };
}

interface FileState {
  viewMode: 'tree' | 'viewer';
  tabs: EditorTab[];
  activeTabPath: string | null;

  // Current workspace tree state (rendered)
  rootNodes: FileTreeNode[];
  expandedFolders: Set<string>;
  folderChildren: Map<string, FileTreeNode[]>;
  showHiddenFolders: boolean;

  // Workspace-keyed cache (WORKSPACE_ISOLATION_SPEC)
  workspaceTrees: Record<string, WorkspaceFileState>;
  activeWorkspaceId: string | null;
  activateWorkspace: (workspaceId: string | null) => void;
  evictWorkspaceTree: (workspaceId: string) => void;

  isLoading: boolean;
  error: string | null;

  setRootNodes: (nodes: FileTreeNode[]) => void;
  toggleHiddenFolders: () => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  toggleFolder: (path: string) => void;
  setFolderChildren: (path: string, children: FileTreeNode[]) => void;
  getFolderChildren: (path: string) => FileTreeNode[] | undefined;

  /** Add or focus tab; returns whether to send file_content_request. */
  openFileTab: (file: FileInfo) => { shouldFetch: boolean };
  applyFileContent: (
    path: string,
    content: string,
    size: number,
    metadata?: Pick<FileInfo, 'isSymlink' | 'symlinkTarget'>,
  ) => void;
  removeTabAfterError: (path: string, message: string) => void;
  setActiveTab: (path: string) => void;
  /** Move active tab by delta (-1 = previous in strip, +1 = next). Wraps at ends. */
  activateAdjacentTab: (delta: -1 | 1) => void;
  closeTab: (path: string) => void;
  hydrateTabsFromActivity: (activity: ViewActivityState) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/** After removing the tab that was at `closedIdx`, prefer the tab to the left (reading order). */
function pickActiveAfterClose(newTabs: EditorTab[], closedIdx: number): string {
  const left = newTabs[closedIdx - 1];
  if (left) return left.file.path;
  return newTabs[closedIdx]!.file.path;
}

function upsertOpenTabAutocompleteCandidate(path: string) {
  if (!isAutocompleteFilePath(path)) return;
  const name = basename(path);
  useChatFileLinkStore.getState().upsertAutocompleteCandidate({
    id: `open-tab:${path}`,
    label: name,
    path,
    basename: name,
    source: 'open-tab',
    openedAt: Date.now(),
  });
}

function createFileMetadata(file: FileInfo): Record<string, string | boolean> | undefined {
  const metadata = {
    ...(file.isSymlink !== undefined ? { isSymlink: file.isSymlink } : {}),
    ...(file.symlinkTarget !== undefined ? { symlinkTarget: file.symlinkTarget } : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function persistFileTabs(tabs: EditorTab[], activeTabPath: string | null) {
  replaceViewTabs(
    FILE_VIEWER_PANEL,
    tabs.map((tab, index) => createActivityItem({
      panel: FILE_VIEWER_PANEL,
      path: tab.file.path,
      title: tab.file.name,
      kind: 'file',
      extension: tab.file.extension,
      tabIndex: index,
      metadata: createFileMetadata(tab.file),
    })),
    activeTabPath ? `${FILE_VIEWER_PANEL}:${activeTabPath}` : null,
  );
}

function tabsMatchActivity(tabs: EditorTab[], activeTabPath: string | null, activity: ViewActivityState): boolean {
  if (tabs.length !== activity.tabs.length) return false;
  const activeId = activeTabPath ? `${FILE_VIEWER_PANEL}:${activeTabPath}` : null;
  if (activeId !== activity.activeTabId) return false;
  return tabs.every((tab, index) => tab.file.path === activity.tabs[index]?.path);
}

export const useFileStore = create<FileState>((set, get) => ({
  viewMode: 'tree',
  tabs: [],
  activeTabPath: null,
  rootNodes: [],
  expandedFolders: new Set(),
  folderChildren: new Map(),
  showHiddenFolders: false,
  workspaceTrees: {},
  activeWorkspaceId: null,

  activateWorkspace: (workspaceId) => {
    const state = get();

    // Save current tree state into the OLD workspace's cache slot
    const nextWorkspaceTrees = { ...state.workspaceTrees };
    if (state.activeWorkspaceId) {
      nextWorkspaceTrees[state.activeWorkspaceId] = {
        rootNodes: state.rootNodes,
        expandedFolders: state.expandedFolders,
        folderChildren: state.folderChildren,
        showHiddenFolders: state.showHiddenFolders,
      };
    }

    // Load new workspace tree state from cache or create empty
    const cached = workspaceId ? state.workspaceTrees[workspaceId] : null;
    const loaded = cached ? { ...cached } : createEmptyWorkspaceFileState();

    set({
      activeWorkspaceId: workspaceId,
      workspaceTrees: nextWorkspaceTrees,
      rootNodes: loaded.rootNodes,
      expandedFolders: loaded.expandedFolders,
      folderChildren: loaded.folderChildren,
      showHiddenFolders: loaded.showHiddenFolders,
      // Tabs remain global — spec says open files are NOT workspace-scoped yet
    });
  },

  evictWorkspaceTree: (workspaceId) => {
    const state = get();
    if (!state.workspaceTrees[workspaceId] && state.activeWorkspaceId !== workspaceId) {
      return;
    }

    const nextWorkspaceTrees = { ...state.workspaceTrees };
    delete nextWorkspaceTrees[workspaceId];

    if (state.activeWorkspaceId === workspaceId) {
      const emptyState = createEmptyWorkspaceFileState();
      set({
        workspaceTrees: nextWorkspaceTrees,
        rootNodes: emptyState.rootNodes,
        expandedFolders: emptyState.expandedFolders,
        folderChildren: emptyState.folderChildren,
        showHiddenFolders: emptyState.showHiddenFolders,
        isLoading: false,
        error: null,
      });
    } else {
      set({ workspaceTrees: nextWorkspaceTrees });
    }
  },

  isLoading: false,
  error: null,

  setRootNodes: (nodes) => set({ rootNodes: nodes }),

  toggleHiddenFolders: () => set((state) => ({
    showHiddenFolders: !state.showHiddenFolders,
    rootNodes: [],
    folderChildren: new Map(),
  })),

  expandFolder: (path) => set((state) => {
    const next = new Set(state.expandedFolders);
    next.add(path);
    return { expandedFolders: next };
  }),

  collapseFolder: (path) => set((state) => {
    const next = new Set(state.expandedFolders);
    next.delete(path);
    return { expandedFolders: next };
  }),

  setFolderChildren: (path, children) => set((state) => {
    const next = new Map(state.folderChildren);
    next.set(path, children);
    return { folderChildren: next };
  }),

  getFolderChildren: (path) => get().folderChildren.get(path),

  toggleFolder: (path) => {
    const { expandedFolders } = get();
    if (expandedFolders.has(path)) {
      get().collapseFolder(path);
    } else {
      get().expandFolder(path);
    }
  },

  openFileTab: (file) => {
    const state = get();
    const path = file.path;
    const existingIdx = state.tabs.findIndex((t) => t.file.path === path);

    if (existingIdx !== -1) {
      const tabs = [...state.tabs];
      const [tab] = tabs.splice(existingIdx, 1);
      tabs.unshift(tab);
      upsertOpenTabAutocompleteCandidate(path);
      persistFileTabs(tabs, path);
      set({
        tabs,
        activeTabPath: path,
        viewMode: 'viewer',
        error: null,
      });
      return { shouldFetch: false };
    }

    const newTab: EditorTab = {
      file,
      content: '',
      size: 0,
      loading: true,
    };
    upsertOpenTabAutocompleteCandidate(path);
    const tabs = [...state.tabs, newTab];
    persistFileTabs(tabs, path);
    set({
      tabs,
      activeTabPath: path,
      viewMode: 'viewer',
      error: null,
    });
    return { shouldFetch: true };
  },

  applyFileContent: (path, content, size, metadata) => set((state) => {
    const tabs = state.tabs.map((t) =>
      t.file.path === path
        ? {
            ...t,
            file: metadata
              ? {
                  ...t.file,
                  isSymlink: metadata.isSymlink === true ? true : undefined,
                  symlinkTarget: metadata.isSymlink === true ? metadata.symlinkTarget : undefined,
                }
              : t.file,
            content,
            size,
            loading: false,
          }
        : t,
    );
    persistFileTabs(tabs, state.activeTabPath);
    return {
      tabs,
      error: null,
    };
  }),

  removeTabAfterError: (path, message) => set((state) => {
    const closedIdx = state.tabs.findIndex((t) => t.file.path === path);
    if (closedIdx === -1) return { error: message };
    const wasActive = state.activeTabPath === path;
    const newTabs = state.tabs.filter((t) => t.file.path !== path);
    if (newTabs.length === 0) {
      persistFileTabs([], null);
      return {
        tabs: [],
        activeTabPath: null,
        viewMode: 'tree',
        error: message,
      };
    }
    let activeTabPath = state.activeTabPath;
    if (wasActive) {
      activeTabPath = pickActiveAfterClose(newTabs, closedIdx);
    }
    persistFileTabs(newTabs, activeTabPath);
    return {
      tabs: newTabs,
      activeTabPath,
      viewMode: 'viewer',
      error: message,
    };
  }),

  setActiveTab: (path) => set((state) => {
    if (!state.tabs.some((t) => t.file.path === path)) return {};
    persistFileTabs(state.tabs, path);
    return { activeTabPath: path };
  }),

  activateAdjacentTab: (delta) => set((state) => {
    const { tabs, activeTabPath } = state;
    if (tabs.length === 0) return {};
    const idx = tabs.findIndex((t) => t.file.path === activeTabPath);
    if (idx === -1) return {};
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= tabs.length) return {};
    const nextActiveTabPath = tabs[nextIdx].file.path;
    persistFileTabs(tabs, nextActiveTabPath);
    return { activeTabPath: nextActiveTabPath };
  }),

  closeTab: (path) => set((state) => {
    const closedIdx = state.tabs.findIndex((t) => t.file.path === path);
    if (closedIdx === -1) return {};
    const wasActive = state.activeTabPath === path;
    const newTabs = state.tabs.filter((t) => t.file.path !== path);
    if (newTabs.length === 0) {
      persistFileTabs([], null);
      return {
        tabs: [],
        activeTabPath: null,
        viewMode: 'tree',
        error: null,
      };
    }
    let activeTabPath = state.activeTabPath;
    if (wasActive) {
      activeTabPath = pickActiveAfterClose(newTabs, closedIdx);
    }
    persistFileTabs(newTabs, activeTabPath);
    return {
      tabs: newTabs,
      activeTabPath,
      viewMode: 'viewer',
      error: null,
    };
  }),

  hydrateTabsFromActivity: (activity) => {
    const state = get();
    if (tabsMatchActivity(state.tabs, state.activeTabPath, activity)) return;
    const tabs: EditorTab[] = activity.tabs.map((item) => ({
      file: {
        name: item.title,
        path: item.path,
        type: 'file',
        extension: item.extension,
        isSymlink: item.metadata?.isSymlink === true ? true : undefined,
        symlinkTarget: typeof item.metadata?.symlinkTarget === 'string' ? item.metadata.symlinkTarget : undefined,
      },
      content: '',
      size: 0,
      loading: true,
    }));
    const activePath = activity.activeTabId
      ? tabs.find((tab) => `${FILE_VIEWER_PANEL}:${tab.file.path}` === activity.activeTabId)?.file.path ?? null
      : (tabs[0]?.file.path ?? null);
    for (const tab of tabs) {
      upsertOpenTabAutocompleteCandidate(tab.file.path);
    }
    set({
      tabs,
      activeTabPath: activePath,
      viewMode: tabs.length > 0 ? 'viewer' : 'tree',
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  reset: () => set({
    viewMode: 'tree',
    tabs: [],
    activeTabPath: null,
    rootNodes: [],
    expandedFolders: new Set(),
    folderChildren: new Map(),
    showHiddenFolders: false,
    isLoading: false,
    error: null,
  }),
}));
