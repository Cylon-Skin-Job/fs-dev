/**
 * @module viewCollections
 * @role Shared persisted saved-item collections for views
 *
 * Starred files and pinned folders live in per-view state beside activity.
 * This module also rewrites/removes view references when files move, rename,
 * or are deleted.
 */

import { usePanelStore } from '../state/panelStore';
import { DEFAULT_VIEW_UI_STATE } from '../state/slices/viewSlice';
import { activityId, normalizeViewActivity } from './viewActivity';
import type {
  ViewActivityItem,
  ViewActivityKind,
  ViewActivityState,
  ViewCollectionItem,
  ViewCollectionsState,
  ViewUIState,
} from '../types';

const MAX_COLLECTION_ITEMS = 500;

export interface ViewCollectionInput {
  panel: string;
  path: string;
  title: string;
  kind: ViewActivityKind;
  savedAt?: number;
  folder?: string;
  extension?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

interface PathReference {
  panel: string;
  path: string;
}

interface RewritePathReference extends PathReference {
  nextPanel?: string;
  nextPath: string;
  title?: string;
  folder?: string;
  extension?: string;
  includeDescendants?: boolean;
}

function basename(filePath: string): string {
  return filePath.split('/').filter(Boolean).pop() || filePath;
}

function parentPath(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function isCollectionItem(value: unknown): value is ViewCollectionItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ViewCollectionItem>;
  return typeof item.id === 'string'
    && typeof item.panel === 'string'
    && typeof item.path === 'string'
    && typeof item.title === 'string'
    && typeof item.kind === 'string'
    && typeof item.savedAt === 'number';
}

function normalizeCollectionItem(item: ViewCollectionItem): ViewCollectionItem {
  return {
    ...item,
    id: item.id || activityId(item.panel, item.path),
    savedAt: Number.isFinite(item.savedAt) ? item.savedAt : Date.now(),
  };
}

function dedupeAndSortCollection(items: ViewCollectionItem[]): ViewCollectionItem[] {
  const seen = new Set<string>();
  return items
    .filter(isCollectionItem)
    .map(normalizeCollectionItem)
    .sort((a, b) => b.savedAt - a.savedAt)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, MAX_COLLECTION_ITEMS);
}

function collectionsEqual(a: ViewCollectionsState, b: ViewCollectionsState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function activityEqual(a: ViewActivityState, b: ViewActivityState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function createCollectionItem(input: ViewCollectionInput): ViewCollectionItem {
  return {
    id: activityId(input.panel, input.path),
    panel: input.panel,
    path: input.path,
    title: input.title,
    kind: input.kind,
    savedAt: input.savedAt ?? Date.now(),
    ...(input.folder !== undefined ? { folder: input.folder } : {}),
    ...(input.extension !== undefined ? { extension: input.extension } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

function matchesReference(item: { panel: string; path: string }, reference: PathReference, includeDescendants = false): boolean {
  if (item.panel !== reference.panel) return false;
  if (item.path === reference.path) return true;
  return includeDescendants && item.path.startsWith(`${reference.path}/`);
}

function rewritePath(path: string, fromPath: string, toPath: string, includeDescendants = false): string | null {
  if (path === fromPath) return toPath;
  if (!includeDescendants || !path.startsWith(`${fromPath}/`)) return null;
  return `${toPath}${path.slice(fromPath.length)}`;
}

function rewriteActivityItem(item: ViewActivityItem, reference: RewritePathReference): ViewActivityItem {
  if (item.panel !== reference.panel) return item;
  const nextPath = rewritePath(item.path, reference.path, reference.nextPath, reference.includeDescendants);
  if (!nextPath) return item;
  const nextPanel = reference.nextPanel ?? reference.panel;
  const exactMatch = item.path === reference.path;
  return {
    ...item,
    id: activityId(nextPanel, nextPath),
    panel: nextPanel,
    path: nextPath,
    title: exactMatch ? (reference.title ?? basename(nextPath)) : item.title,
    folder: exactMatch && reference.folder !== undefined ? reference.folder : parentPath(nextPath),
    ...(exactMatch && reference.extension !== undefined ? { extension: reference.extension } : {}),
  };
}

function rewriteCollectionItem(item: ViewCollectionItem, reference: RewritePathReference): ViewCollectionItem {
  if (item.panel !== reference.panel) return item;
  const nextPath = rewritePath(item.path, reference.path, reference.nextPath, reference.includeDescendants);
  if (!nextPath) return item;
  const nextPanel = reference.nextPanel ?? reference.panel;
  const exactMatch = item.path === reference.path;
  return {
    ...item,
    id: activityId(nextPanel, nextPath),
    panel: nextPanel,
    path: nextPath,
    title: exactMatch ? (reference.title ?? basename(nextPath)) : item.title,
    folder: exactMatch && reference.folder !== undefined ? reference.folder : parentPath(nextPath),
    ...(exactMatch && reference.extension !== undefined ? { extension: reference.extension } : {}),
  };
}

function persistViewPatch(view: string, patch: Partial<ViewUIState>) {
  const store = usePanelStore.getState();
  store.setViewState(view, patch);
  store._persistViewPatch(view, patch);
}

function normalizeActivityForView(view: string): ViewActivityState {
  return normalizeViewActivity(usePanelStore.getState().viewStates[view]?.activity);
}

export function normalizeViewCollections(collections?: Partial<ViewCollectionsState> | null): ViewCollectionsState {
  return {
    starred: dedupeAndSortCollection(Array.isArray(collections?.starred) ? collections.starred : []),
    pinnedFolders: dedupeAndSortCollection(Array.isArray(collections?.pinnedFolders) ? collections.pinnedFolders : []),
  };
}

export function getViewCollections(view: string): ViewCollectionsState {
  const state = usePanelStore.getState().viewStates[view];
  return normalizeViewCollections(state?.collections);
}

export function isViewStarred(view: string, panel: string, path: string): boolean {
  return getViewCollections(view).starred.some((item) => item.id === activityId(panel, path));
}

export function isViewPinnedFolder(view: string, panel: string, path: string): boolean {
  return getViewCollections(view).pinnedFolders.some((item) => item.id === activityId(panel, path));
}

export function toggleViewStarred(view: string, input: ViewCollectionInput): ViewCollectionsState {
  const current = getViewCollections(view);
  const item = createCollectionItem(input);
  const exists = current.starred.some((saved) => saved.id === item.id);
  const next = {
    ...current,
    starred: exists
      ? current.starred.filter((saved) => saved.id !== item.id)
      : dedupeAndSortCollection([item, ...current.starred]),
  };
  persistViewPatch(view, { collections: next });
  return next;
}

export function toggleViewPinnedFolder(view: string, input: ViewCollectionInput): ViewCollectionsState {
  const current = getViewCollections(view);
  const item = createCollectionItem({ ...input, kind: 'folder' });
  const exists = current.pinnedFolders.some((saved) => saved.id === item.id);
  const next = {
    ...current,
    pinnedFolders: exists
      ? current.pinnedFolders.filter((saved) => saved.id !== item.id)
      : dedupeAndSortCollection([item, ...current.pinnedFolders]),
  };
  persistViewPatch(view, { collections: next });
  return next;
}

export function removeViewPathReferences(reference: PathReference & { includeDescendants?: boolean }) {
  const store = usePanelStore.getState();
  for (const view of Object.keys(store.viewStates)) {
    const currentActivity = normalizeActivityForView(view);
    const currentCollections = normalizeViewCollections(store.viewStates[view]?.collections);
    const match = (item: { panel: string; path: string }) =>
      matchesReference(item, reference, reference.includeDescendants);

    const nextActivity: ViewActivityState = {
      ...currentActivity,
      recents: currentActivity.recents.filter((item) => !match(item)),
      navigation: {
        stack: currentActivity.navigation.stack.filter((item) => !match(item)),
        index: currentActivity.navigation.index,
      },
      tabs: currentActivity.tabs.filter((item) => !match(item)),
    };
    nextActivity.navigation.index = Math.min(
      nextActivity.navigation.stack.length - 1,
      Math.max(-1, nextActivity.navigation.index)
    );
    if (nextActivity.activeTabId && !nextActivity.tabs.some((item) => item.id === nextActivity.activeTabId)) {
      nextActivity.activeTabId = nextActivity.tabs[0]?.id ?? null;
    }

    const nextCollections: ViewCollectionsState = {
      starred: currentCollections.starred.filter((item) => !match(item)),
      pinnedFolders: currentCollections.pinnedFolders.filter((item) => !match(item)),
    };

    const patch: Partial<ViewUIState> = {};
    if (!activityEqual(currentActivity, nextActivity)) patch.activity = nextActivity;
    if (!collectionsEqual(currentCollections, nextCollections)) patch.collections = nextCollections;
    if (Object.keys(patch).length > 0) {
      persistViewPatch(view, patch);
    }
  }
}

export function rewriteViewPathReferences(reference: RewritePathReference) {
  const store = usePanelStore.getState();
  for (const view of Object.keys(store.viewStates)) {
    const currentActivity = normalizeActivityForView(view);
    const currentCollections = normalizeViewCollections(store.viewStates[view]?.collections);
    const nextActivity: ViewActivityState = {
      ...currentActivity,
      recents: currentActivity.recents.map((item) => rewriteActivityItem(item, reference)),
      navigation: {
        ...currentActivity.navigation,
        stack: currentActivity.navigation.stack.map((item) => rewriteActivityItem(item, reference)),
      },
      tabs: currentActivity.tabs.map((item) => rewriteActivityItem(item, reference)),
    };
    const activeTab = currentActivity.tabs.find((item) => item.id === currentActivity.activeTabId);
    const nextActiveTabId = activeTab ? rewriteActivityItem(activeTab, reference).id : null;
    nextActivity.activeTabId = nextActiveTabId && nextActivity.tabs.some((item) => item.id === nextActiveTabId)
      ? nextActiveTabId
      : (nextActivity.tabs[0]?.id ?? null);

    const nextCollections: ViewCollectionsState = {
      starred: dedupeAndSortCollection(currentCollections.starred.map((item) => rewriteCollectionItem(item, reference))),
      pinnedFolders: dedupeAndSortCollection(currentCollections.pinnedFolders.map((item) => rewriteCollectionItem(item, reference))),
    };

    const patch: Partial<ViewUIState> = {};
    if (!activityEqual(currentActivity, nextActivity)) patch.activity = nextActivity;
    if (!collectionsEqual(currentCollections, nextCollections)) patch.collections = nextCollections;
    if (Object.keys(patch).length > 0) {
      persistViewPatch(view, patch);
    }
  }
}

export function defaultViewCollections(): ViewCollectionsState {
  return DEFAULT_VIEW_UI_STATE.collections;
}
