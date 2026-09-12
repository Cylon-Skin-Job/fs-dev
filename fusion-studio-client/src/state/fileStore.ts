import { create } from 'zustand';
import {
  isFileEditorTab,
  type FileInfo,
  type EditorTab,
  type FileEditorTab,
} from '../types/file-explorer';
import { basename, isAutocompleteFilePath } from '../lib/chat-file-links/file-link-filter';
import { useChatFileLinkStore } from './chatFileLinkStore';
import { useFileDataStore } from './fileDataStore';
import { createActivityItem, replaceViewTabs } from '../lib/viewActivity';
import type { ViewActivityState } from '../types';

const FILE_VIEWER_PANEL = 'file-viewer';
export const FILE_VIEW_HOME_TAB_ID = 'file-view-home' as const;

/** Public shell identity retained for the accepted tab-bar contract. */
export function fileTabId(tab: EditorTab): string {
  return isFileEditorTab(tab) ? tab.file.path : tab.id;
}

interface WorkspaceFileState {
  expandedFolders: Set<string>;
  showHiddenFolders: boolean;
}

function createEmptyWorkspaceFileState(): WorkspaceFileState {
  return { expandedFolders: new Set(), showHiddenFolders: false };
}

interface FileState {
  viewMode: 'tree' | 'viewer';
  tabs: EditorTab[];
  /** Opaque presentation identity used by the provenance-safe file runtime. */
  activeTabId: string | null;
  /** Path/home alias consumed by the accepted shell tab adapter. */
  activeTabPath: string | null;
  expandedFolders: Set<string>;
  showHiddenFolders: boolean;
  workspaceTrees: Record<string, WorkspaceFileState>;
  activeWorkspaceId: string | null;
  activateWorkspace: (workspaceId: string | null) => void;
  evictWorkspacePresentation: (workspaceId: string) => void;
  toggleHiddenFolders: () => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  toggleFolder: (path: string) => void;
  /** Add or focus a presentation tab. Canonical content fetching is separate. */
  openFileTab: (file: FileInfo) => void;
  /** Create or focus the accepted shell's session-only view-home tab. */
  openViewHomeTab: () => string | null;
  /** Create or focus the provenance runtime's session-only file-picker tab. */
  openEmptyTab: () => void;
  removeTabAfterError: (path: string) => void;
  setActiveTab: (idOrPath: string) => void;
  activateAdjacentTab: (delta: -1 | 1) => void;
  closeTab: (idOrPath: string) => void;
  hydrateTabsFromActivity: (activity: ViewActivityState) => void;
  refreshPersistedTabMetadata: () => void;
  /**
   * VIEW-02 Slice 4 (VRT-013): ONE atomic acknowledged owner commit for the
   * connected tab surface. The connected owner translates its planned generic
   * collection into presentation tabs and commits them through THIS owner —
   * the store keeps its private persistence semantics (activity persistence,
   * autocomplete candidates, dirty-protected content release, error clearing)
   * and re-derives `activeTabPath`/`viewMode` itself. This is the store's own
   * commit primitive, not competing tab logic: placement decisions are made
   * by TABS-03 before this action is ever called.
   */
  applyConnectedTabCommit: (next: { tabs: EditorTab[]; activeTabId: string | null }) => void;
  reset: () => void;
}

/** Create an opaque session-local identity for provenance-safe tab routing. */
function createTabId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `fvt-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function activePathForId(tabs: EditorTab[], activeTabId: string | null): string | null {
  if (!activeTabId) return null;
  const tab = tabs.find((candidate) => candidate.id === activeTabId);
  return tab ? fileTabId(tab) : null;
}

function resolveTabId(tabs: EditorTab[], idOrPath: string): string | null {
  return tabs.find((tab) => tab.id === idOrPath || fileTabId(tab) === idOrPath)?.id ?? null;
}

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
  const canonical = useFileDataStore.getState().contentMetadata[`${FILE_VIEWER_PANEL}:${file.path}`];
  const isSymlink = canonical ? canonical.isSymlink : file.isSymlink;
  const symlinkTarget = canonical ? canonical.symlinkTarget : file.symlinkTarget;
  const metadata = {
    ...(isSymlink !== undefined ? { isSymlink } : {}),
    ...(symlinkTarget !== undefined ? { symlinkTarget } : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function releaseRemovedFilePaths(previousTabs: EditorTab[], nextTabs: EditorTab[]): void {
  const remainingPaths = new Set(nextTabs.filter(isFileEditorTab).map((tab) => tab.file.path));
  const removedPaths = new Set(previousTabs.filter(isFileEditorTab).map((tab) => tab.file.path));
  for (const path of removedPaths) {
    if (!remainingPaths.has(path)) useFileDataStore.getState().releaseFileViewerContent(path);
  }
}

function persistFileTabs(tabs: EditorTab[], activeTabId: string | null) {
  const fileTabs = tabs.filter((tab) => tab.kind === 'file');
  const activeFileTab = fileTabs.find((tab) => tab.id === activeTabId) ?? null;
  const activePresentationTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
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
    { preserveExplicitNull: activePresentationTab?.kind === 'empty' },
  );
}

function hasPersistablePath(item: ViewActivityState['tabs'][number]): boolean {
  return typeof item.path === 'string' && item.path.trim().length > 0;
}

function tabsMatchActivity(tabs: EditorTab[], activeTabId: string | null, activity: ViewActivityState): boolean {
  const fileTabs = tabs.filter((tab) => tab.kind === 'file');
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
  activeTabPath: null,
  expandedFolders: new Set(),
  showHiddenFolders: false,
  workspaceTrees: {},
  activeWorkspaceId: null,

  activateWorkspace: (workspaceId) => {
    const state = get();
    const nextWorkspaceTrees = { ...state.workspaceTrees };
    if (state.activeWorkspaceId) {
      nextWorkspaceTrees[state.activeWorkspaceId] = {
        expandedFolders: state.expandedFolders,
        showHiddenFolders: state.showHiddenFolders,
      };
    }
    const cached = workspaceId ? nextWorkspaceTrees[workspaceId] : null;
    const loaded = cached ? { ...cached } : createEmptyWorkspaceFileState();
    set({
      activeWorkspaceId: workspaceId,
      workspaceTrees: nextWorkspaceTrees,
      expandedFolders: loaded.expandedFolders,
      showHiddenFolders: loaded.showHiddenFolders,
    });
    useFileDataStore.getState().setFileViewerTreeRepresentation(loaded.showHiddenFolders);
  },

  evictWorkspacePresentation: (workspaceId) => {
    const state = get();
    if (!state.workspaceTrees[workspaceId] && state.activeWorkspaceId !== workspaceId) return;
    const nextWorkspaceTrees = { ...state.workspaceTrees };
    delete nextWorkspaceTrees[workspaceId];
    if (state.activeWorkspaceId === workspaceId) {
      const emptyState = createEmptyWorkspaceFileState();
      set({
        workspaceTrees: nextWorkspaceTrees,
        expandedFolders: emptyState.expandedFolders,
        showHiddenFolders: emptyState.showHiddenFolders,
      });
      useFileDataStore.getState().setFileViewerTreeRepresentation(false);
    } else {
      set({ workspaceTrees: nextWorkspaceTrees });
    }
  },

  toggleHiddenFolders: () => {
    const showHiddenFolders = !get().showHiddenFolders;
    set({ showHiddenFolders });
    useFileDataStore.getState().setFileViewerTreeRepresentation(showHiddenFolders);
  },

  expandFolder: (path) => set((state) => {
    const expandedFolders = new Set(state.expandedFolders);
    expandedFolders.add(path);
    return { expandedFolders };
  }),

  collapseFolder: (path) => set((state) => {
    const expandedFolders = new Set(state.expandedFolders);
    expandedFolders.delete(path);
    return { expandedFolders };
  }),

  toggleFolder: (path) => {
    const { expandedFolders } = get();
    if (expandedFolders.has(path)) get().collapseFolder(path);
    else get().expandFolder(path);
  },

  openFileTab: (file) => {
    useFileDataStore.getState().clearFileViewerErrors();
    const state = get();
    const path = file.path;
    const existingIdx = state.tabs.findIndex((tab) => isFileEditorTab(tab) && tab.file.path === path);
    const emptyIdx = state.tabs.findIndex((tab) => tab.kind === 'empty');
    const activeHomeIndex = state.activeTabPath === FILE_VIEW_HOME_TAB_ID
      ? state.tabs.findIndex((tab) => tab.kind === 'home')
      : -1;

    if (existingIdx !== -1) {
      const existingTab = state.tabs[existingIdx]!;
      const tabs = [existingTab, ...state.tabs.filter((tab) => (
        tab.id !== existingTab.id && tab.kind !== 'empty' && !(activeHomeIndex >= 0 && tab.kind === 'home')
      ))];
      upsertOpenTabAutocompleteCandidate(path);
      persistFileTabs(tabs, existingTab.id);
      set({ tabs, activeTabId: existingTab.id, activeTabPath: path, viewMode: 'viewer' });
      return;
    }

    const newTab: FileEditorTab = {
      id: emptyIdx >= 0 ? state.tabs[emptyIdx]!.id : createTabId(),
      kind: 'file',
      file,
    };
    upsertOpenTabAutocompleteCandidate(path);
    const tabs = emptyIdx >= 0
      ? state.tabs.map((tab, index) => index === emptyIdx ? newTab : tab)
      : activeHomeIndex >= 0
        ? state.tabs.map((tab, index) => index === activeHomeIndex ? newTab : tab)
        : [...state.tabs, newTab];
    persistFileTabs(tabs, newTab.id);
    set({ tabs, activeTabId: newTab.id, activeTabPath: path, viewMode: 'viewer' });
  },

  openViewHomeTab: () => {
    const state = get();
    if (state.tabs.length === 0) return null;
    const existing = state.tabs.find((tab) => tab.kind === 'home');
    if (existing) {
      set({ activeTabId: existing.id, activeTabPath: existing.id, viewMode: 'viewer' });
      return existing.id;
    }
    const home: EditorTab = { kind: 'home', id: FILE_VIEW_HOME_TAB_ID, loading: false };
    set({ tabs: [...state.tabs, home], activeTabId: home.id, activeTabPath: home.id, viewMode: 'viewer' });
    return home.id;
  },

  openEmptyTab: () => {
    useFileDataStore.getState().clearFileViewerErrors();
    set((state) => {
      const existing = state.tabs.find((tab) => tab.kind === 'empty');
      if (existing) {
        persistFileTabs(state.tabs, existing.id);
        return { activeTabId: existing.id, activeTabPath: existing.id, viewMode: 'viewer' };
      }
      const emptyTab: EditorTab = { id: createTabId(), kind: 'empty' };
      const tabs = [...state.tabs, emptyTab];
      persistFileTabs(tabs, emptyTab.id);
      return { tabs, activeTabId: emptyTab.id, activeTabPath: emptyTab.id, viewMode: 'viewer' };
    });
  },

  removeTabAfterError: (path) => {
    const state = get();
    const closedIdx = state.tabs.findIndex((tab) => isFileEditorTab(tab) && tab.file.path === path);
    if (closedIdx === -1) return;
    const closedTab = state.tabs[closedIdx]!;
    const wasActive = state.activeTabId === closedTab.id;
    const newTabs = state.tabs.filter((tab) => tab.id !== closedTab.id);
    if (newTabs.length === 0) {
      persistFileTabs([], null);
      set({ tabs: [], activeTabId: null, activeTabPath: null, viewMode: 'tree' });
    } else {
      const activeTabId = wasActive ? pickActiveAfterClose(newTabs, closedIdx) : state.activeTabId;
      persistFileTabs(newTabs, activeTabId);
      set({ tabs: newTabs, activeTabId, activeTabPath: activePathForId(newTabs, activeTabId), viewMode: 'viewer' });
    }
    if (!newTabs.some((tab) => isFileEditorTab(tab) && tab.file.path === path)) {
      useFileDataStore.getState().releaseFileViewerContent(path);
    }
  },

  setActiveTab: (idOrPath) => set((state) => {
    const activeTabId = resolveTabId(state.tabs, idOrPath);
    if (!activeTabId) return {};
    persistFileTabs(state.tabs, activeTabId);
    return { activeTabId, activeTabPath: activePathForId(state.tabs, activeTabId) };
  }),

  activateAdjacentTab: (delta) => set((state) => {
    if (state.tabs.length === 0) return {};
    const idx = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
    if (idx === -1) return {};
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= state.tabs.length) return {};
    const activeTabId = state.tabs[nextIdx]!.id;
    persistFileTabs(state.tabs, activeTabId);
    return { activeTabId, activeTabPath: activePathForId(state.tabs, activeTabId) };
  }),

  closeTab: (idOrPath) => {
    const state = get();
    const id = resolveTabId(state.tabs, idOrPath);
    if (!id) return;
    const closedIdx = state.tabs.findIndex((tab) => tab.id === id);
    useFileDataStore.getState().clearFileViewerErrors();
    const closedTab = state.tabs[closedIdx]!;
    const wasActive = state.activeTabId === id;
    const newTabs = state.tabs.filter((tab) => tab.id !== id);
    if (newTabs.length === 0) {
      persistFileTabs([], null);
      set({ tabs: [], activeTabId: null, activeTabPath: null, viewMode: 'tree' });
    } else {
      const activeTabId = wasActive ? pickActiveAfterClose(newTabs, closedIdx) : state.activeTabId;
      persistFileTabs(newTabs, activeTabId);
      set({ tabs: newTabs, activeTabId, activeTabPath: activePathForId(newTabs, activeTabId), viewMode: 'viewer' });
    }
    if (isFileEditorTab(closedTab)
      && !newTabs.some((tab) => isFileEditorTab(tab) && tab.file.path === closedTab.file.path)) {
      useFileDataStore.getState().releaseFileViewerContent(closedTab.file.path);
    }
  },

  hydrateTabsFromActivity: (activity) => {
    const state = get();
    if (tabsMatchActivity(state.tabs, state.activeTabId, activity)) return;
    useFileDataStore.getState().clearFileViewerErrors();
    const activityTabs = activity.tabs
      .filter((item) => typeof item.path === 'string' && item.path.trim().length > 0);
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
    }));
    const activeTabId = activity.activeTabId
      ? tabs.find((tab) => `${FILE_VIEWER_PANEL}:${tab.file.path}` === activity.activeTabId)?.id ?? null
      : (tabs[0]?.id ?? null);
    for (const tab of tabs) upsertOpenTabAutocompleteCandidate(tab.file.path);
    const resolvedActiveId = activeTabId ?? tabs[0]?.id ?? null;
    set({
      tabs,
      activeTabId: resolvedActiveId,
      activeTabPath: activePathForId(tabs, resolvedActiveId),
      viewMode: tabs.length > 0 ? 'viewer' : 'tree',
    });
    releaseRemovedFilePaths(state.tabs, tabs);
  },

  refreshPersistedTabMetadata: () => {
    const state = get();
    persistFileTabs(state.tabs, state.activeTabId);
  },

  applyConnectedTabCommit: ({ tabs, activeTabId }) => {
    const state = get();
    // Error clearing mirrors the established open/close lifecycle: a commit
    // that changes the tab set (add/remove/fill) clears bounded viewer
    // errors; a pure focus change does not (setActiveTab never clears).
    const structureChanged = tabs.length !== state.tabs.length
      || tabs.some((tab, index) => {
        const previous = state.tabs[index];
        return previous?.id !== tab.id || previous?.kind !== tab.kind;
      });
    if (structureChanged) useFileDataStore.getState().clearFileViewerErrors();
    const previousPaths = new Set(state.tabs.filter(isFileEditorTab).map((tab) => tab.file.path));
    for (const tab of tabs) {
      if (isFileEditorTab(tab) && !previousPaths.has(tab.file.path)) {
        upsertOpenTabAutocompleteCandidate(tab.file.path);
      }
    }
    persistFileTabs(tabs, activeTabId);
    set({
      tabs,
      activeTabId,
      activeTabPath: activePathForId(tabs, activeTabId),
      viewMode: tabs.length > 0 ? 'viewer' : 'tree',
    });
    releaseRemovedFilePaths(state.tabs, tabs);
  },

  reset: () => {
    const tabs = get().tabs;
    useFileDataStore.getState().clearFileViewerErrors();
    set({
      viewMode: 'tree',
      tabs: [],
      activeTabId: null,
      activeTabPath: null,
      expandedFolders: new Set(),
      showHiddenFolders: false,
    });
    useFileDataStore.getState().setFileViewerTreeRepresentation(false);
    releaseRemovedFilePaths(tabs, []);
  },
}));
