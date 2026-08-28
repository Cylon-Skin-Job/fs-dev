import { usePanelStore } from '../state/panelStore';
import { DEFAULT_VIEW_UI_STATE } from '../state/slices/viewSlice';
import type {
  ViewActivityItem,
  ViewActivityKind,
  ViewActivityState,
  ViewNavigationState,
  ViewUIState,
} from '../types';

const MAX_RECENTS = 100;
const MAX_RECENT_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export interface ViewActivityInput {
  panel: string;
  path: string;
  title: string;
  kind: ViewActivityKind;
  openedAt?: number;
  folder?: string;
  extension?: string;
  tabIndex?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ActivityDateGroup {
  label: string;
  items: ViewActivityItem[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function startOfWeek(date: Date): number {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset));
}

function monthLabel(date: Date): string {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function activityId(panel: string, path: string): string {
  return `${panel}:${path}`;
}

export function createActivityItem(input: ViewActivityInput): ViewActivityItem {
  return {
    id: activityId(input.panel, input.path),
    panel: input.panel,
    path: input.path,
    title: input.title,
    kind: input.kind,
    openedAt: input.openedAt ?? Date.now(),
    ...(input.folder !== undefined ? { folder: input.folder } : {}),
    ...(input.extension !== undefined ? { extension: input.extension } : {}),
    ...(input.tabIndex !== undefined ? { tabIndex: input.tabIndex } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

function isActivityItem(value: unknown): value is ViewActivityItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ViewActivityItem>;
  return typeof item.id === 'string'
    && typeof item.panel === 'string'
    && typeof item.path === 'string'
    && typeof item.title === 'string'
    && typeof item.kind === 'string'
    && typeof item.openedAt === 'number';
}

function normalizeItem(item: ViewActivityItem): ViewActivityItem {
  return {
    ...item,
    id: item.id || activityId(item.panel, item.path),
    openedAt: Number.isFinite(item.openedAt) ? item.openedAt : Date.now(),
  };
}

function pruneRecents(items: ViewActivityItem[], now = Date.now()): ViewActivityItem[] {
  const seen = new Set<string>();
  return items
    .filter(isActivityItem)
    .map(normalizeItem)
    .filter((item) => now - item.openedAt <= MAX_RECENT_AGE_MS)
    .sort((a, b) => b.openedAt - a.openedAt)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, MAX_RECENTS);
}

function normalizeNavigation(value: unknown): ViewNavigationState {
  if (!value || typeof value !== 'object') {
    return { stack: [], index: -1 };
  }
  const nav = value as Partial<ViewNavigationState>;
  const stack = Array.isArray(nav.stack)
    ? nav.stack.filter(isActivityItem).map(normalizeItem).slice(-MAX_RECENTS)
    : [];
  const maxIndex = stack.length - 1;
  const index = typeof nav.index === 'number'
    ? Math.max(-1, Math.min(maxIndex, nav.index))
    : maxIndex;
  return { stack, index };
}

export function normalizeViewActivity(activity?: Partial<ViewActivityState> | null): ViewActivityState {
  return {
    recents: pruneRecents(Array.isArray(activity?.recents) ? activity.recents : []),
    navigation: normalizeNavigation(activity?.navigation),
    tabs: Array.isArray(activity?.tabs)
      ? activity.tabs.filter(isActivityItem).map(normalizeItem).slice(0, MAX_RECENTS)
      : [],
    activeTabId: typeof activity?.activeTabId === 'string' ? activity.activeTabId : null,
  };
}

export function getViewActivity(view: string): ViewActivityState {
  const state = usePanelStore.getState().viewStates[view];
  return normalizeViewActivity(state?.activity);
}

function persistActivity(view: string, activity: ViewActivityState) {
  const store = usePanelStore.getState();
  const current = store.viewStates[view] ?? DEFAULT_VIEW_UI_STATE;
  const nextState: ViewUIState = {
    ...current,
    activity,
  };
  store.setViewState(view, nextState);
  store._persistViewPatch(view, { activity });
}

export function recordViewRecent(view: string, itemInput: ViewActivityInput): ViewActivityState {
  const current = getViewActivity(view);
  const item = createActivityItem(itemInput);
  const recents = pruneRecents([
    item,
    ...current.recents.filter((recent) => recent.id !== item.id),
  ]);
  const next = { ...current, recents };
  persistActivity(view, next);
  return next;
}

export function pushViewNavigation(view: string, itemInput: ViewActivityInput): ViewActivityState {
  const current = getViewActivity(view);
  const item = createActivityItem(itemInput);
  const previousStack = current.navigation.stack.slice(0, current.navigation.index + 1);
  const stack = previousStack[previousStack.length - 1]?.id === item.id
    ? previousStack
    : [...previousStack, item].slice(-MAX_RECENTS);
  const navigation = {
    stack,
    index: stack.length - 1,
  };
  const recents = pruneRecents([
    item,
    ...current.recents.filter((recent) => recent.id !== item.id),
  ]);
  const next = { ...current, navigation, recents };
  persistActivity(view, next);
  return next;
}

export function setViewNavigationIndex(view: string, index: number): ViewActivityState {
  const current = getViewActivity(view);
  const maxIndex = current.navigation.stack.length - 1;
  const navigation = {
    ...current.navigation,
    index: Math.max(-1, Math.min(maxIndex, index)),
  };
  const next = { ...current, navigation };
  persistActivity(view, next);
  return next;
}

export function replaceViewTabs(
  view: string,
  tabs: ViewActivityItem[],
  activeTabId: string | null,
): ViewActivityState {
  const current = getViewActivity(view);
  const normalizedTabs = tabs.filter(isActivityItem).map(normalizeItem).slice(0, MAX_RECENTS);
  const activeId = activeTabId === null
    ? null
    : normalizedTabs.some((tab) => tab.id === activeTabId)
      ? activeTabId
      : (normalizedTabs[0]?.id ?? null);
  const next = {
    ...current,
    tabs: normalizedTabs,
    activeTabId: activeId,
  };
  persistActivity(view, next);
  return next;
}

export function groupActivityByDate(items: ViewActivityItem[], now = new Date()): ActivityDateGroup[] {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const buckets = new Map<string, ViewActivityItem[]>();
  const sorted = [...items].sort((a, b) => b.openedAt - a.openedAt);

  for (const item of sorted) {
    const openedAt = new Date(item.openedAt);
    const timestamp = openedAt.getTime();
    let label: string;
    if (timestamp >= todayStart) {
      label = 'Today';
    } else if (timestamp >= yesterdayStart) {
      label = 'Yesterday';
    } else if (timestamp >= weekStart) {
      label = 'Earlier This Week';
    } else if (timestamp >= monthStart) {
      label = 'Earlier This Month';
    } else if (timestamp >= lastMonthStart) {
      label = 'Last Month';
    } else {
      label = monthLabel(openedAt);
    }

    const bucket = buckets.get(label) ?? [];
    bucket.push(item);
    buckets.set(label, bucket);
  }

  return Array.from(buckets.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}
