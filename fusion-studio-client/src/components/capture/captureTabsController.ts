/**
 * @module captureTabsController
 * @role State transitions for capture-viewer tabs.
 *
 * Tabs are born from the shell plus button while a doc is open full screen,
 * and latch until only one item remains. The panel view-state keys used by
 * useDocViewerState (mode, selected path, scrolls) always describe the ACTIVE
 * tab; this module swaps those globals atomically on every transition.
 */

import { usePanelStore } from '../../state/panelStore';
import type { DocViewerTab } from '../../types';
import type { DocViewerMode } from '../../hooks/useDocViewerState';

const PANEL = 'capture-viewer';
export const CAPTURE_TAB_LABEL = 'CAPTURE';

let seq = 0;
const nextTabId = () => `cvt-${Date.now().toString(36)}-${(seq++).toString(36)}`;

interface TabsSnapshot {
  tabs: DocViewerTab[];
  activeId: string | null;
}

function readSnapshot(): TabsSnapshot {
  const vs = usePanelStore.getState().viewStates[PANEL];
  return {
    tabs: vs?.docViewerTabs ?? [],
    activeId: vs?.docViewerActiveTabId ?? null,
  };
}

function setPatch(patch: Record<string, unknown>) {
  usePanelStore.getState().setViewState(PANEL, patch as never);
}

function activeKey(mode: DocViewerMode) {
  return mode === 'archive' ? 'docViewerArchiveSelectedPath' : 'docViewerActiveSelectedPath';
}

function gridScrollKey(mode: DocViewerMode) {
  return mode === 'archive' ? 'docViewerArchiveGridScroll' : 'docViewerActiveGridScroll';
}

function docScrollKey(mode: DocViewerMode) {
  return mode === 'archive' ? 'docViewerArchiveDocScroll' : 'docViewerActiveDocScroll';
}

function readSelectedPath(): string | null {
  const vs = usePanelStore.getState().viewStates[PANEL];
  const mode: DocViewerMode = vs?.docViewerMode ?? 'active';
  return vs?.[activeKey(mode)] ?? null;
}

function splitPath(path: string): { name: string; extension: string } {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return { name, extension: name.split('.').pop()?.toLowerCase() ?? '' };
}

/** Scroll values to snapshot into the CURRENT tab before a transition. */
export interface TabFlush {
  gridScroll?: number;
  docScroll?: number;
}

/** True when the tab strip should render (tabs mode is latched). */
export function isTabsActive(tabs: DocViewerTab[] | undefined): boolean {
  return (tabs?.length ?? 0) > 0;
}

/**
 * Shell plus button. First press enters tabs mode seeded with the open doc
 * plus a fresh CAPTURE tab (CAPTURE focused). Later presses refocus CAPTURE.
 */
export function plusPressed(flush?: TabFlush): void {
  const { tabs } = readSnapshot();

  if (tabs.length > 0) {
    const capture = tabs.find((t) => t.kind === 'capture');
    if (capture) {
      activateTab(capture.id, flush);
      return;
    }
    const fresh: DocViewerTab = { id: nextTabId(), kind: 'capture', ui: {} };
    setPatch({ docViewerTabs: [...tabs, fresh], docViewerActiveTabId: fresh.id });
    return;
  }

  const path = readSelectedPath();
  if (!path) return;
  const { name, extension } = splitPath(path);
  const vs = usePanelStore.getState().viewStates[PANEL];
  const mode: DocViewerMode = vs?.docViewerMode ?? 'active';
  const docTab: DocViewerTab = {
    id: nextTabId(),
    kind: 'doc',
    path,
    name,
    extension,
    ui: {
      mode,
      gridScroll: flush?.gridScroll ?? 0,
      docScroll: flush?.docScroll
        ?? vs?.[docScrollKey(mode)]
        ?? 0,
    },
  };
  const captureTab: DocViewerTab = { id: nextTabId(), kind: 'capture', ui: { mode: 'active' } };
  setPatch({ docViewerTabs: [docTab, captureTab], docViewerActiveTabId: captureTab.id });
}

/** Switch the active tab, swapping the global ui keys in one atomic patch. */
export function activateTab(id: string, flush?: TabFlush): void {
  const { tabs } = readSnapshot();
  const target = tabs.find((t) => t.id === id);
  const currentId = usePanelStore.getState().viewStates[PANEL]?.docViewerActiveTabId ?? null;
  if (!target || currentId === id) return;

  const stashed = tabs.map((t) => (
    t.id === currentId
      ? { ...t, ui: { ...(t.ui ?? {}), gridScroll: flush?.gridScroll ?? t.ui?.gridScroll ?? 0 } }
      : t
  ));

  setPatch({ ...tabToGlobals(target), docViewerTabs: stashed, docViewerActiveTabId: id });
}

/** Load a tab's remembered state into the global keys (no array change). */
function tabToGlobals(tab: DocViewerTab): Record<string, unknown> {
  const mode: DocViewerMode = tab.ui?.mode ?? 'active';
  const patch: Record<string, unknown> = {
    docViewerMode: mode,
    [gridScrollKey(mode)]: tab.ui?.gridScroll ?? 0,
    [docScrollKey(mode)]: tab.ui?.docScroll ?? 0,
  };
  patch[activeKey(mode)] = tab.kind === 'doc' ? (tab.path ?? null) : null;
  const otherKey = mode === 'archive' ? 'docViewerActiveSelectedPath' : 'docViewerArchiveSelectedPath';
  patch[otherKey] = null;
  patch.docViewerFullPage = tab.kind === 'doc';
  return patch;
}

/**
 * Full-screen request inside tabs mode. Dedupes by path: an open doc's tab is
 * activated instead of duplicated. Otherwise the active CAPTURE tab is
 * replaced by the doc, or a new doc tab is appended.
 */
export function docOpenedInTabs(
  info: { folder: string; path?: string; name: string },
): boolean {
  const { tabs, activeId } = readSnapshot();
  if (tabs.length === 0) return false;

  const fullPath = info.path ?? `${info.folder}/${info.name}`;
  const existing = tabs.find((t) => t.kind === 'doc'
    && (t.path === fullPath || `${info.folder}/${t.name}` === fullPath));
  if (existing) {
    activateTab(existing.id);
    return true;
  }

  const extension = info.name.split('.').pop()?.toLowerCase();
  const active = tabs.find((t) => t.id === activeId);

  if (active?.kind === 'capture') {
    const replacement: DocViewerTab = {
      ...active,
      kind: 'doc',
      path: fullPath,
      name: info.name,
      extension,
      ui: { mode: 'active', gridScroll: 0, docScroll: 0 },
    };
    const nextTabs = tabs.map((t) => (t.id === active.id ? replacement : t));
    setPatch({ ...tabToGlobals(replacement), docViewerTabs: nextTabs });
    return true;
  }

  const fresh: DocViewerTab = {
    id: nextTabId(),
    kind: 'doc',
    path: fullPath,
    name: info.name,
    extension,
    ui: { mode: 'active', gridScroll: 0, docScroll: 0 },
  };
  setPatch({
    ...tabToGlobals(fresh),
    docViewerTabs: [...tabs, fresh],
    docViewerActiveTabId: fresh.id,
  });
  return true;
}

/**
 * Back arrow inside tabs mode: morph the current doc tab into a fresh CAPTURE
 * tab (staying put), and dispose any OTHER capture tab that this creates.
 */
export function backOutOfDocTabs(flush?: TabFlush): void {
  const { tabs, activeId } = readSnapshot();
  if (tabs.length === 0) return;

  const morphed = tabs.map((t) => {
    if (t.id !== activeId || t.kind !== 'doc') return t;
    return { ...t, kind: 'capture' as const, path: undefined, name: undefined, extension: undefined, ui: { mode: 'active' as DocViewerMode, gridScroll: 0, docScroll: 0 } };
  });

  // The morphed tab becomes THE one allowed CAPTURE; dispose any other.
  const deduped = morphed.filter((t) => t.id === activeId || t.kind !== 'capture');

  if (deduped.length === 1) {
    exitTabs(deduped[0]);
    return;
  }

  const current = morphed.find((t) => t.id === activeId);
  setPatch({
    ...tabToGlobals(current ?? { id: '', kind: 'capture' }),
    docViewerTabs: deduped,
    docViewerActiveTabId: activeId,
  });
  void flush;
}

/** Close a tab. When one tab remains, unwind into classic single-item mode. */
export function closeTab(id: string, flush?: TabFlush): void {
  const { tabs, activeId } = readSnapshot();
  const victimIndex = tabs.findIndex((t) => t.id === id);
  if (victimIndex === -1) return;

  let nextTabs = tabs.filter((t) => t.id !== id);

  if (nextTabs.length === 1) {
    exitTabs(nextTabs[0]);
    return;
  }
  if (nextTabs.length === 0) {
    setPatch({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerFullPage: false,
      [activeKey('active')]: null,
    });
    return;
  }

  if (id === activeId) {
    const neighbor = nextTabs[Math.max(0, victimIndex - 1)];
    setPatch({ ...tabToGlobals(neighbor), docViewerTabs: nextTabs, docViewerActiveTabId: neighbor.id });
    return;
  }

  nextTabs = nextTabs.map((t) => (
    t.id === activeId ? { ...t, ui: { ...(t.ui ?? {}), gridScroll: flush?.gridScroll ?? t.ui?.gridScroll ?? 0 } } : t
  ));
  setPatch({ docViewerTabs: nextTabs });
}

/** Unlatch: single remaining tab becomes the classic full-window state. */
function exitTabs(remaining: DocViewerTab): void {
  setPatch({
    ...tabToGlobals(remaining),
    docViewerTabs: [],
    docViewerActiveTabId: null,
    ...(remaining.kind === 'capture' ? { [gridScrollKey('active')]: 0 } : {}),
  });
}
