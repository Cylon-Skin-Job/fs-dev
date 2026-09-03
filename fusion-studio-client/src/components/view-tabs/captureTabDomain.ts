import type {
  DocViewerMode,
  DocViewerModeBucket,
  DocViewerTab,
  DocViewerTabUi,
  ViewUIState,
} from '../../types';

const MAX_SCROLL = 10_000_000;
const MODES: readonly DocViewerMode[] = ['active', 'recent', 'starred', 'archive'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalCapturePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) return null;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function safeScroll(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_SCROLL, Math.max(0, value));
}

function safeMode(value: unknown): DocViewerMode {
  return MODES.includes(value as DocViewerMode) ? value as DocViewerMode : 'active';
}

function normalizeBucket(value: unknown): DocViewerModeBucket {
  const bucket = isRecord(value) ? value : {};
  return {
    selectedPath: canonicalCapturePath(bucket.selectedPath),
    gridScroll: safeScroll(bucket.gridScroll),
    docScroll: safeScroll(bucket.docScroll),
  };
}

export function emptyCaptureTabUi(mode: DocViewerMode = 'active'): DocViewerTabUi {
  return {
    mode,
    lastOpenedPath: null,
    byMode: {
      active: { selectedPath: null, gridScroll: 0, docScroll: 0 },
      archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
    },
  };
}

function normalizeUi(value: unknown, documentPath?: string): DocViewerTabUi {
  const raw = isRecord(value) ? value : {};
  const mode = safeMode(raw.mode);
  const byMode = isRecord(raw.byMode) ? raw.byMode : {};
  const ui: DocViewerTabUi = {
    mode,
    lastOpenedPath: canonicalCapturePath(raw.lastOpenedPath),
    byMode: {
      active: normalizeBucket(byMode.active),
      archive: normalizeBucket(byMode.archive),
    },
  };

  // One-time migration from the preliminary flat record shape.
  if (!isRecord(raw.byMode)) {
    const bucket = mode === 'archive' ? ui.byMode.archive : ui.byMode.active;
    bucket.gridScroll = safeScroll(raw.gridScroll);
    bucket.docScroll = safeScroll(raw.docScroll);
  }

  if (documentPath) {
    const bucket = mode === 'archive' ? ui.byMode.archive : ui.byMode.active;
    bucket.selectedPath = documentPath;
    ui.lastOpenedPath = canonicalCapturePath(raw.lastOpenedPath) ?? documentPath;
  }
  return ui;
}

function splitPath(path: string): { name: string; extension: string } {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return { name, extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : '' };
}

export interface NormalizedCaptureTabs {
  tabs: DocViewerTab[];
  activeId: string | null;
}

export function normalizeCaptureTabs(rawTabs: unknown, requestedActiveId: unknown): NormalizedCaptureTabs {
  if (!Array.isArray(rawTabs)) return { tabs: [], activeId: null };

  const tabs: DocViewerTab[] = [];
  const ids = new Map<string, string>();
  const paths = new Map<string, string>();
  let captureId: string | null = null;

  for (const value of rawTabs) {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) continue;
    const id = value.id.trim();
    if (ids.has(id)) continue;

    if (value.kind === 'doc') {
      const path = canonicalCapturePath(value.path);
      if (!path) continue;
      const duplicateId = paths.get(path);
      if (duplicateId) {
        ids.set(id, duplicateId);
        continue;
      }
      const { name, extension } = splitPath(path);
      tabs.push({ id, kind: 'doc', path, name, extension, ui: normalizeUi(value.ui, path) });
      ids.set(id, id);
      paths.set(path, id);
      continue;
    }

    if (value.kind === 'capture') {
      if (captureId) {
        ids.set(id, captureId);
        continue;
      }
      tabs.push({ id, kind: 'capture', ui: normalizeUi(value.ui) });
      ids.set(id, id);
      captureId = id;
    }
  }

  const requested = typeof requestedActiveId === 'string' ? requestedActiveId : null;
  const activeId = requested ? (ids.get(requested) ?? tabs[0]?.id ?? null) : (tabs[0]?.id ?? null);
  return { tabs, activeId };
}

export function tabProjection(tab: DocViewerTab | undefined): Partial<ViewUIState> {
  if (!tab) return { docViewerFullPage: false };
  return {
    docViewerMode: tab.ui.mode,
    docViewerLastOpenedPath: tab.ui.lastOpenedPath,
    docViewerActiveSelectedPath: tab.ui.byMode.active.selectedPath,
    docViewerArchiveSelectedPath: tab.ui.byMode.archive.selectedPath,
    docViewerActiveGridScroll: tab.ui.byMode.active.gridScroll,
    docViewerArchiveGridScroll: tab.ui.byMode.archive.gridScroll,
    docViewerActiveDocScroll: tab.ui.byMode.active.docScroll,
    docViewerArchiveDocScroll: tab.ui.byMode.archive.docScroll,
    docViewerFullPage: tab.kind === 'doc',
  };
}

export function snapshotTab(tab: DocViewerTab, state: Partial<ViewUIState>): DocViewerTab {
  const mode = safeMode(state.docViewerMode);
  const activePath = canonicalCapturePath(state.docViewerActiveSelectedPath);
  const archivePath = canonicalCapturePath(state.docViewerArchiveSelectedPath);
  const ui: DocViewerTabUi = {
    mode,
    lastOpenedPath: canonicalCapturePath(state.docViewerLastOpenedPath),
    byMode: {
      active: {
        selectedPath: activePath,
        gridScroll: safeScroll(state.docViewerActiveGridScroll),
        docScroll: safeScroll(state.docViewerActiveDocScroll),
      },
      archive: {
        selectedPath: archivePath,
        gridScroll: safeScroll(state.docViewerArchiveGridScroll),
        docScroll: safeScroll(state.docViewerArchiveDocScroll),
      },
    },
  };

  if (tab.kind === 'capture') return { ...tab, ui };
  const currentPath = mode === 'archive' ? archivePath : activePath;
  const path = currentPath ?? tab.path;
  const { name, extension } = splitPath(path);
  const bucket = mode === 'archive' ? ui.byMode.archive : ui.byMode.active;
  bucket.selectedPath = path;
  ui.lastOpenedPath ??= path;
  return { ...tab, path, name, extension, ui };
}

export function legacyProjectionFor(tab: DocViewerTab): Partial<ViewUIState> {
  const projection = { ...tabProjection(tab) };
  delete projection.docViewerFullPage;
  return projection;
}

/** Record-free Back retains navigation memory but cannot retain an open preview selection. */
export function classicGridProjectionFor(tab: DocViewerTab): Partial<ViewUIState> {
  const projection = legacyProjectionFor(tab);
  if (tab.ui.mode === 'archive') projection.docViewerArchiveSelectedPath = null;
  else projection.docViewerActiveSelectedPath = null;
  return projection;
}

export function captureTabsEqual(
  rawTabs: unknown,
  rawActiveId: unknown,
  normalized: NormalizedCaptureTabs,
): boolean {
  return JSON.stringify(rawTabs) === JSON.stringify(normalized.tabs)
    && rawActiveId === normalized.activeId;
}
