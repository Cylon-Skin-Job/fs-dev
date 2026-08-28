/**
 * @module captureTabsController
 * @role Durable capture-viewer tab transitions and tab-to-global mirroring.
 *
 * The durable discriminated tab records are the tabbed-mode truth. Existing
 * capture readers continue to consume the global docViewer keys; every
 * transition snapshots those globals into the outgoing tab, then restores the
 * resolved active tab back into them. A future `kind: 'view'` record belongs to
 * the transportable-views SPEC and is deliberately not accepted here.
 *
 * Concurrent app instances use the existing whole-key last-writer-wins view
 * state behavior. This controller intentionally does not add coordination.
 */

import { usePanelStore } from '../../state/panelStore';
import { DOC_VIEWER_ARCHIVE_FOLDER } from '../../lib/viewFolders';
import type {
  DocViewerMode,
  DocViewerTab,
  DocViewerTabUi,
  ViewUIState,
} from '../../types';

export const CAPTURE_VIEWER_PANEL = 'capture-viewer';
export const CAPTURE_TAB_LABEL = 'CAPTURE';

let sequence = 0;
const nextTabId = () => `cvt-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

const MODES = new Set<DocViewerMode>(['active', 'recent', 'starred', 'archive']);

function modeFrom(value: unknown): DocViewerMode {
  return typeof value === 'string' && MODES.has(value as DocViewerMode)
    ? value as DocViewerMode
    : 'active';
}

function scrollFrom(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function usableString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function splitPath(path: string): { name: string; extension: string } {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return { name, extension: dot > -1 ? name.slice(dot + 1).toLowerCase() : '' };
}

function normalizeUi(value: unknown): DocViewerTabUi {
  const ui = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    mode: modeFrom(ui.mode),
    gridScroll: scrollFrom(ui.gridScroll),
    docScroll: scrollFrom(ui.docScroll),
  };
}

/** Validate durable records, keep the first id, and keep the first CAPTURE. */
export function normalizeCaptureTabRecords(value: unknown): DocViewerTab[] {
  if (!Array.isArray(value)) return [];

  const ids = new Set<string>();
  let hasCapture = false;
  const tabs: DocViewerTab[] = [];

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    if (!usableString(record.id) || ids.has(record.id)) continue;

    if (record.kind === 'capture') {
      if (hasCapture) continue;
      hasCapture = true;
      ids.add(record.id);
      tabs.push({ id: record.id, kind: 'capture', ui: normalizeUi(record.ui) });
      continue;
    }

    if (record.kind !== 'doc' || !usableString(record.path)) continue;
    ids.add(record.id);
    const { name, extension } = splitPath(record.path);
    tabs.push({
      id: record.id,
      kind: 'doc',
      path: record.path,
      name,
      extension,
      ui: normalizeUi(record.ui),
    });
  }

  return tabs;
}

export function normalizedCaptureTabsFromState(state: ViewUIState | undefined): DocViewerTab[] {
  const tabs = normalizeCaptureTabRecords(state?.docViewerTabs);
  return tabs.length >= 2 ? tabs : [];
}

export function isCaptureTabsActive(state: ViewUIState | undefined): boolean {
  return normalizedCaptureTabsFromState(state).length > 0;
}

function selectedPathKey(mode: DocViewerMode) {
  return mode === 'archive' ? 'docViewerArchiveSelectedPath' : 'docViewerActiveSelectedPath';
}

function gridScrollKey(mode: DocViewerMode) {
  return mode === 'archive' ? 'docViewerArchiveGridScroll' : 'docViewerActiveGridScroll';
}

function docScrollKey(mode: DocViewerMode) {
  return mode === 'archive' ? 'docViewerArchiveDocScroll' : 'docViewerActiveDocScroll';
}

function globalsForTab(tab: DocViewerTab): Partial<ViewUIState> {
  const mode = modeFrom(tab.ui.mode);
  const otherSelectedPathKey = mode === 'archive'
    ? 'docViewerActiveSelectedPath'
    : 'docViewerArchiveSelectedPath';
  return {
    docViewerMode: mode,
    [selectedPathKey(mode)]: tab.kind === 'doc' ? tab.path : null,
    [otherSelectedPathKey]: null,
    [gridScrollKey(mode)]: scrollFrom(tab.ui.gridScroll),
    [docScrollKey(mode)]: scrollFrom(tab.ui.docScroll),
    docViewerFullPage: tab.kind === 'doc',
  };
}

function snapshotOutgoing(
  tabs: DocViewerTab[],
  activeId: string | null,
  viewState: ViewUIState | undefined,
): DocViewerTab[] {
  if (!activeId) return tabs;
  const mode = modeFrom(viewState?.docViewerMode);
  return tabs.map((tab) => {
    if (tab.id !== activeId) return tab;
    const selectedPath = viewState?.[selectedPathKey(mode)];
    const pathPatch = tab.kind === 'doc' && usableString(selectedPath)
      ? { path: selectedPath, ...splitPath(selectedPath) }
      : {};
    return {
      ...tab,
      ...pathPatch,
      ui: {
        mode,
        gridScroll: scrollFrom(viewState?.[gridScrollKey(mode)]),
        docScroll: scrollFrom(viewState?.[docScrollKey(mode)]),
      },
    };
  });
}

function readTransitionState() {
  const viewState = usePanelStore.getState().viewStates[CAPTURE_VIEWER_PANEL];
  const tabs = normalizeCaptureTabRecords(viewState?.docViewerTabs);
  const requestedActive = viewState?.docViewerActiveTabId;
  const activeId = usableString(requestedActive) && tabs.some((tab) => tab.id === requestedActive)
    ? requestedActive
    : (tabs[0]?.id ?? null);
  return {
    viewState,
    tabs: snapshotOutgoing(tabs, activeId, viewState),
    activeId,
  };
}

/** The only writer for durable capture tab keys. */
function persistDurableTabs(tabs: DocViewerTab[], activeId: string | null): void {
  const store = usePanelStore.getState();
  const patch: Pick<ViewUIState, 'docViewerTabs' | 'docViewerActiveTabId'> = {
    docViewerTabs: tabs,
    docViewerActiveTabId: activeId,
  };
  store.setViewState(CAPTURE_VIEWER_PANEL, patch);
  store._persistViewPatch(CAPTURE_VIEWER_PANEL, patch);
}

/**
 * Persist an ordinary capture-viewer global patch, then keep the active durable
 * record current. The durable write still flows through persistDurableTabs and
 * contains only the two tab keys; transition-time global swaps never call this.
 */
export function persistCaptureViewPatch(patch: Partial<ViewUIState>): void {
  const store = usePanelStore.getState();
  store.setViewState(CAPTURE_VIEWER_PANEL, patch);
  store._persistViewPatch(CAPTURE_VIEWER_PANEL, patch);

  const viewState = usePanelStore.getState().viewStates[CAPTURE_VIEWER_PANEL];
  const tabs = normalizeCaptureTabRecords(viewState?.docViewerTabs);
  const requestedActive = viewState?.docViewerActiveTabId;
  const activeId = usableString(requestedActive) && tabs.some((tab) => tab.id === requestedActive)
    ? requestedActive
    : null;
  if (tabs.length < 2 || !activeId) return;

  const currentTabs = snapshotOutgoing(tabs, activeId, viewState);
  if (JSON.stringify(currentTabs) !== JSON.stringify(tabs)) {
    persistDurableTabs(currentTabs, activeId);
  }
}

function commitTransition(
  candidateTabs: DocViewerTab[],
  candidateActiveId: string | null,
  emptyPatch?: Partial<ViewUIState>,
): void {
  const tabs = normalizeCaptureTabRecords(candidateTabs);
  const store = usePanelStore.getState();

  if (tabs.length <= 1) {
    const remaining = tabs[0];
    store.setViewState(
      CAPTURE_VIEWER_PANEL,
      remaining ? globalsForTab(remaining) : (emptyPatch ?? {}),
    );
    persistDurableTabs([], null);
    return;
  }

  const activeId = candidateActiveId && tabs.some((tab) => tab.id === candidateActiveId)
    ? candidateActiveId
    : tabs[0].id;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  store.setViewState(CAPTURE_VIEWER_PANEL, globalsForTab(active));
  persistDurableTabs(tabs, activeId);
}

function durableStateNeedsRepair(
  rawTabs: unknown,
  rawActiveId: unknown,
  tabs: DocViewerTab[],
  activeId: string | null,
): boolean {
  if (rawTabs === undefined && (rawActiveId === undefined || rawActiveId === null)) return false;
  return JSON.stringify(rawTabs) !== JSON.stringify(tabs) || rawActiveId !== activeId;
}

/**
 * Rebuild reader globals after state hydration and repair malformed durable
 * records. Empty durable state leaves classic-mode globals alone.
 */
export function normalizeCaptureTabsAfterHydration(): void {
  const store = usePanelStore.getState();
  const viewState = store.viewStates[CAPTURE_VIEWER_PANEL];
  if (!viewState) return;

  const normalized = normalizeCaptureTabRecords(viewState.docViewerTabs);
  const resolvedActive = usableString(viewState.docViewerActiveTabId)
    && normalized.some((tab) => tab.id === viewState.docViewerActiveTabId)
    ? viewState.docViewerActiveTabId
    : (normalized[0]?.id ?? null);

  const durableTabs = normalized.length >= 2 ? normalized : [];
  const durableActiveId = durableTabs.length > 0 ? resolvedActive : null;
  const active = normalized.length === 1
    ? normalized[0]
    : durableTabs.find((tab) => tab.id === durableActiveId);
  if (active) store.setViewState(CAPTURE_VIEWER_PANEL, globalsForTab(active));

  if (durableStateNeedsRepair(
    viewState.docViewerTabs,
    viewState.docViewerActiveTabId,
    durableTabs,
    durableActiveId,
  )) {
    persistDurableTabs(durableTabs, durableActiveId);
  }
}

/** Mutation responses are acknowledgements, not a second hydration pass. */
export function normalizeCaptureTabsAfterStateResult(clientMutationId: number | null): void {
  if (clientMutationId === null) normalizeCaptureTabsAfterHydration();
}

/** RAM-only classic full-page transition; never enters the persistence patch. */
export function setClassicDocFullPage(fullPage: boolean): void {
  const state = usePanelStore.getState().viewStates[CAPTURE_VIEWER_PANEL];
  if (isCaptureTabsActive(state)) return;
  usePanelStore.getState().setViewState(CAPTURE_VIEWER_PANEL, {
    docViewerFullPage: fullPage,
  });
}

/** Archive removes the classic selection and must also exit classic full page. */
export function clearActiveDocumentAfterArchive(): void {
  const state = usePanelStore.getState().viewStates[CAPTURE_VIEWER_PANEL];
  if (isCaptureTabsActive(state)) return;
  persistCaptureViewPatch({ docViewerActiveSelectedPath: null });
  setClassicDocFullPage(false);
}

interface CapturePathChange {
  sourcePanel: string;
  sourcePath: string;
  targetPanel?: string;
  targetPath?: string;
  includeDescendants?: boolean;
}

function matchesCapturePath(path: string, change: CapturePathChange): boolean {
  return path === change.sourcePath
    || Boolean(change.includeDescendants && path.startsWith(`${change.sourcePath}/`));
}

function rewrittenCapturePath(path: string, change: CapturePathChange): string {
  const suffix = path.slice(change.sourcePath.length);
  return `${change.targetPath}${suffix}`;
}

function isCaptureArchivePath(path: string): boolean {
  return path === DOC_VIEWER_ARCHIVE_FOLDER
    || path.startsWith(`${DOC_VIEWER_ARCHIVE_FOLDER}/`);
}

function removeCaptureDocuments(
  change: CapturePathChange,
  morphActive: boolean,
): void {
  if (change.sourcePanel !== CAPTURE_VIEWER_PANEL) return;
  const { tabs, activeId } = readTransitionState();
  if (tabs.length < 2 || !tabs.some(
    (tab) => tab.kind === 'doc' && matchesCapturePath(tab.path, change),
  )) return;

  const active = tabs.find((tab) => tab.id === activeId);
  const shouldMorphActive = Boolean(
    morphActive && active?.kind === 'doc' && matchesCapturePath(active.path, change),
  );
  const nextTabs = tabs
    .map((tab): DocViewerTab | null => {
      if (tab.kind !== 'doc' || !matchesCapturePath(tab.path, change)) return tab;
      if (!shouldMorphActive || tab.id !== activeId) return null;
      return {
        id: tab.id,
        kind: 'capture',
        ui: { mode: 'active', gridScroll: 0, docScroll: 0 },
      };
    })
    .filter((tab): tab is DocViewerTab => tab !== null)
    .filter((tab) => !shouldMorphActive || tab.id === activeId || tab.kind !== 'capture');

  const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
  const nextActiveId = shouldMorphActive
    ? activeId
    : nextTabs.some((tab) => tab.id === activeId)
      ? activeId
      : (nextTabs[Math.max(0, Math.min(activeIndex - 1, nextTabs.length - 1))]?.id ?? null);
  commitTransition(nextTabs, nextActiveId, {
    docViewerMode: 'active',
    docViewerActiveSelectedPath: null,
    docViewerArchiveSelectedPath: null,
    docViewerFullPage: false,
  });
}

/** Keep durable doc identity aligned with successful file move/rename events. */
export function rewriteCaptureDocumentPaths(change: CapturePathChange): void {
  if (change.sourcePanel !== CAPTURE_VIEWER_PANEL) return;
  if (change.targetPanel && change.targetPanel !== CAPTURE_VIEWER_PANEL) {
    removeCaptureDocuments(change, true);
    return;
  }
  if (!usableString(change.targetPath)) return;
  if (!isCaptureArchivePath(change.sourcePath) && isCaptureArchivePath(change.targetPath)) {
    removeCaptureDocuments(change, true);
    return;
  }

  const { tabs, activeId } = readTransitionState();
  if (tabs.length < 2) return;
  let changed = false;
  const nextTabs = tabs.map((tab) => {
    if (tab.kind !== 'doc' || !matchesCapturePath(tab.path, change)) return tab;
    changed = true;
    const path = rewrittenCapturePath(tab.path, change);
    return { ...tab, path, ...splitPath(path) };
  });
  if (changed) commitTransition(nextTabs, activeId);
}

/** Remove dangling durable docs after delete; the active slot becomes CAPTURE. */
export function removeCaptureDocumentPaths(change: CapturePathChange): void {
  removeCaptureDocuments(change, true);
}

/** First plus seeds [open doc, CAPTURE]; later plus creates/focuses CAPTURE. */
export function plusPressed(): void {
  const { tabs, activeId, viewState } = readTransitionState();
  if (tabs.length >= 2) {
    const existingCapture = tabs.find((tab) => tab.kind === 'capture');
    if (existingCapture) {
      if (existingCapture.id !== activeId) commitTransition(tabs, existingCapture.id);
      return;
    }
    const capture: DocViewerTab = {
      id: nextTabId(),
      kind: 'capture',
      ui: { mode: 'active', gridScroll: 0, docScroll: 0 },
    };
    commitTransition([...tabs, capture], capture.id);
    return;
  }

  const mode = modeFrom(viewState?.docViewerMode);
  const path = viewState?.[selectedPathKey(mode)];
  if (!usableString(path) || !viewState?.docViewerFullPage) return;
  const { name, extension } = splitPath(path);
  const doc: DocViewerTab = {
    id: nextTabId(),
    kind: 'doc',
    path,
    name,
    extension,
    ui: {
      mode,
      gridScroll: scrollFrom(viewState[gridScrollKey(mode)]),
      docScroll: scrollFrom(viewState[docScrollKey(mode)]),
    },
  };
  const capture: DocViewerTab = {
    id: nextTabId(),
    kind: 'capture',
    ui: { mode: 'active', gridScroll: 0, docScroll: 0 },
  };
  commitTransition([doc, capture], capture.id);
}

/** Single activation chokepoint for capture tabs. */
export function activateTab(id: string): void {
  const { tabs, activeId } = readTransitionState();
  if (tabs.length < 2 || id === activeId || !tabs.some((tab) => tab.id === id)) return;
  commitTransition(tabs, id);
}

/**
 * Replace an active CAPTURE, append from an active doc, or focus a path match.
 * Returns false in classic mode so the caller can use the classic transition.
 */
export function docOpenedInTabs(info: { folder: string; path?: string; name: string }): boolean {
  const { tabs, activeId, viewState } = readTransitionState();
  if (tabs.length < 2) return false;

  const fullPath = info.path ?? `${info.folder}/${info.name}`;
  const existing = tabs.find((tab) => tab.kind === 'doc' && tab.path === fullPath);
  if (existing) {
    commitTransition(tabs, existing.id);
    return true;
  }

  const mode = modeFrom(viewState?.docViewerMode);
  const { name, extension } = splitPath(fullPath);
  const active = tabs.find((tab) => tab.id === activeId);
  const doc: DocViewerTab = {
    id: active?.kind === 'capture' ? active.id : nextTabId(),
    kind: 'doc',
    path: fullPath,
    name,
    extension,
    ui: { mode, gridScroll: 0, docScroll: 0 },
  };

  const nextTabs = active?.kind === 'capture'
    ? tabs.map((tab) => tab.id === active.id ? doc : tab)
    : [...tabs, doc];
  commitTransition(nextTabs, doc.id);
  return true;
}

/** Back morphs the active doc in place and removes any other CAPTURE. */
export function backOutOfDocTabs(): void {
  const { tabs, activeId } = readTransitionState();
  const active = tabs.find((tab) => tab.id === activeId);
  if (tabs.length < 2 || active?.kind !== 'doc') return;

  const capture: DocViewerTab = {
    id: active.id,
    kind: 'capture',
    ui: { mode: 'active', gridScroll: 0, docScroll: 0 },
  };
  const nextTabs = tabs
    .map((tab) => tab.id === active.id ? capture : tab)
    .filter((tab) => tab.id === active.id || tab.kind !== 'capture');
  commitTransition(nextTabs, active.id);
}

/** Close and select the left neighbor; one survivor unwinds to classic mode. */
export function closeTab(id: string): void {
  const { tabs, activeId } = readTransitionState();
  const victimIndex = tabs.findIndex((tab) => tab.id === id);
  if (victimIndex < 0) return;

  const nextTabs = tabs.filter((tab) => tab.id !== id);
  if (nextTabs.length === 0) {
    commitTransition([], null, {
      docViewerMode: 'active',
      docViewerActiveSelectedPath: null,
      docViewerArchiveSelectedPath: null,
      docViewerActiveGridScroll: 0,
      docViewerArchiveGridScroll: 0,
      docViewerActiveDocScroll: 0,
      docViewerArchiveDocScroll: 0,
      docViewerFullPage: false,
    });
    return;
  }

  const nextActiveId = id === activeId
    ? nextTabs[Math.max(0, victimIndex - 1)].id
    : activeId;
  commitTransition(nextTabs, nextActiveId);
}
