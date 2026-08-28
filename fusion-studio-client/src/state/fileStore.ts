import { create } from 'zustand';
import {
  isFileEditorTab,
  type FileTreeNode,
  type FileInfo,
  type EditorTab,
  type FileEditorTab,
} from '../types/file-explorer';
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
  activeTabId: string | null;

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
  /** Create or focus the one session-only file-picker tab. */
  openEmptyTab: () => void;
  applyFileContent: (
    path: string,
    content: string,
    size: number,
    metadata?: Pick<FileInfo, 'isSymlink' | 'symlinkTarget'>,
  ) => void;
  removeTabAfterError: (path: string, message: string) => void;
  setActiveTab: (id: string) => void;
  /** Move active tab by delta (-1 = previous in strip, +1 = next). Wraps at ends. */
  activateAdjacentTab: (delta: -1 | 1) => void;
  closeTab: (id: string) => void;
  hydrateTabsFromActivity: (activity: ViewActivityState) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/** Create an opaque session-local identity for universal tab-strip routing. */
function createTabId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `fvt-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

/** After removing the tab that was at `closedIdx`, prefer the tab to the left (reading order). */
function pickActiveAfterClose(newTabs: EditorTab[], closedIdx: number): string {
  const left = newTabs[closedIdx - 1];
  if (left) return left.id;
  return newTabs[closedIdx]!.id;
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

function persistFileTabs(tabs: EditorTab[], activeTabId: string | null) {
  const fileTabs = tabs.filter(isFileEditorTab);
  const activeFileTab = fileTabs.find((tab) => tab.id === activeTabId) ?? null;
  replaceViewTabs(
    FILE_VIEWER_PANEL,
    fileTabs.map((tab, index) => createActivityItem({
      panel: FILE_VIEWER_PANEL,
      path: tab.file.path,
      title: tab.file.name,
      kind: 'file',
      extension: tab.file.extension,
      tabIndex: index,
      metadata: createFileMetadata(tab.file),
    })),
    activeFileTab ? `${FILE_VIEWER_PANEL}:${activeFileTab.file.path}` : null,
  );
}

function hasPersistablePath(item: ViewActivityState['tabs'][number]): boolean {
  return typeof item.path === 'string' && item.path.trim().length > 0;
}

function tabsMatchActivity(tabs: EditorTab[], activeTabId: string | null, activity: ViewActivityState): boolean {
  const fileTabs = tabs.filter(isFileEditorTab);
  const activityTabs = activity.tabs.filter(hasPersistablePath);
  if (activityTabs.length !== activity.tabs.length || fileTabs.length !== activityTabs.length) return false;
  const activeFileTab = fileTabs.find((tab) => tab.id === activeTabId) ?? null;
  const activeId = activeFileTab ? `${FILE_VIEWER_PANEL}:${activeFileTab.file.path}` : null;
  if (activeId !== activity.activeTabId) return false;
  return fileTabs.every((tab, index) => tab.file.path === activityTabs[index]?.path);
}

export const useFileStore = create<FileState>((set, get) => ({
  viewMode: 'tree',
  tabs: [],
  activeTabId: null,
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
    const existingIdx = state.tabs.findIndex((tab) => isFileEditorTab(tab) && tab.file.path === path);
    const emptyIdx = state.tabs.findIndex((tab) => tab.kind === 'empty');

    if (existingIdx !== -1) {
      const existingTab = state.tabs[existingIdx]!;
      const tabs = [existingTab, ...state.tabs.filter((tab) => tab.id !== existingTab.id && tab.kind !== 'empty')];
      upsertOpenTabAutocompleteCandidate(path);
      persistFileTabs(tabs, existingTab.id);
      set({
        tabs,
        activeTabId: existingTab.id,
        viewMode: 'viewer',
        error: null,
      });
      return { shouldFetch: false };
    }

    const newTab: FileEditorTab = {
      id: emptyIdx === -1 ? createTabId() : state.tabs[emptyIdx]!.id,
      kind: 'file',
      file,
      content: '',
      size: 0,
      loading: true,
    };
    upsertOpenTabAutocompleteCandidate(path);
    const tabs = emptyIdx === -1
      ? [...state.tabs, newTab]
      : state.tabs.map((tab, index) => index === emptyIdx ? newTab : tab);
    persistFileTabs(tabs, newTab.id);
    set({
      tabs,
      activeTabId: newTab.id,
      viewMode: 'viewer',
      error: null,
    });
    return { shouldFetch: true };
  },

  openEmptyTab: () => set((state) => {
    const existing = state.tabs.find((tab) => tab.kind === 'empty');
    if (existing) {
      persistFileTabs(state.tabs, existing.id);
      return {
        activeTabId: existing.id,
        viewMode: 'viewer',
        error: null,
      };
    }
    const emptyTab: EditorTab = { id: createTabId(), kind: 'empty' };
    const tabs = [...state.tabs, emptyTab];
    persistFileTabs(tabs, emptyTab.id);
    return {
      tabs,
      activeTabId: emptyTab.id,
      viewMode: 'viewer',
      error: null,
    };
  }),

  applyFileContent: (path, content, size, metadata) => set((state) => {
    const tabs = state.tabs.map((tab) =>
      isFileEditorTab(tab) && tab.file.path === path
        ? {
            ...tab,
            file: metadata
              ? {
                  ...tab.file,
                  isSymlink: metadata.isSymlink === true ? true : undefined,
                  symlinkTarget: metadata.isSymlink === true ? metadata.symlinkTarget : undefined,
                }
              : tab.file,
            content,
            size,
            loading: false,
          }
        : tab,
    );
    persistFileTabs(tabs, state.activeTabId);
    return {
      tabs,
      error: null,
    };
  }),

  removeTabAfterError: (path, message) => set((state) => {
    const closedIdx = state.tabs.findIndex((tab) => isFileEditorTab(tab) && tab.file.path === path);
    if (closedIdx === -1) return { error: message };
    const closedTab = state.tabs[closedIdx]!;
    const wasActive = state.activeTabId === closedTab.id;
    const newTabs = state.tabs.filter((tab) => tab.id !== closedTab.id);
    if (newTabs.length === 0) {
      persistFileTabs([], null);
      return {
        tabs: [],
        activeTabId: null,
        viewMode: 'tree',
        error: message,
      };
    }
    let activeTabId = state.activeTabId;
    if (wasActive) {
      activeTabId = pickActiveAfterClose(newTabs, closedIdx);
    }
    persistFileTabs(newTabs, activeTabId);
    return {
      tabs: newTabs,
      activeTabId,
      viewMode: 'viewer',
      error: message,
    };
  }),

  setActiveTab: (id) => set((state) => {
    if (!state.tabs.some((tab) => tab.id === id)) return {};
    persistFileTabs(state.tabs, id);
    return { activeTabId: id };
  }),

  activateAdjacentTab: (delta) => set((state) => {
    const { tabs, activeTabId } = state;
    if (tabs.length === 0) return {};
    const idx = tabs.findIndex((tab) => tab.id === activeTabId);
    if (idx === -1) return {};
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= tabs.length) return {};
    const nextActiveTabId = tabs[nextIdx]!.id;
    persistFileTabs(tabs, nextActiveTabId);
    return { activeTabId: nextActiveTabId };
  }),

  closeTab: (id) => set((state) => {
    const closedIdx = state.tabs.findIndex((tab) => tab.id === id);
    if (closedIdx === -1) return {};
    const wasActive = state.activeTabId === id;
    const newTabs = state.tabs.filter((tab) => tab.id !== id);
    if (newTabs.length === 0) {
      persistFileTabs([], null);
      return {
        tabs: [],
        activeTabId: null,
        viewMode: 'tree',
        error: null,
      };
    }
    let activeTabId = state.activeTabId;
    if (wasActive) {
      activeTabId = pickActiveAfterClose(newTabs, closedIdx);
    }
    persistFileTabs(newTabs, activeTabId);
    return {
      tabs: newTabs,
      activeTabId,
      viewMode: 'viewer',
      error: null,
    };
  }),

  hydrateTabsFromActivity: (activity) => {
    const state = get();
    if (tabsMatchActivity(state.tabs, state.activeTabId, activity)) return;
    const activityTabs = activity.tabs.filter(hasPersistablePath);
    const tabs: FileEditorTab[] = activityTabs.map((item) => ({
      id: createTabId(),
      kind: 'file',
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
    const activeTabId = activity.activeTabId
      ? tabs.find((tab) => `${FILE_VIEWER_PANEL}:${tab.file.path}` === activity.activeTabId)?.id ?? null
      : (tabs[0]?.id ?? null);
    for (const tab of tabs) {
      upsertOpenTabAutocompleteCandidate(tab.file.path);
    }
    set({
      tabs,
      activeTabId: activeTabId ?? tabs[0]?.id ?? null,
      viewMode: tabs.length > 0 ? 'viewer' : 'tree',
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  reset: () => set({
    viewMode: 'tree',
    tabs: [],
    activeTabId: null,
    rootNodes: [],
    expandedFolders: new Set(),
    folderChildren: new Map(),
    showHiddenFolders: false,
    isLoading: false,
    error: null,
  }),
}));
