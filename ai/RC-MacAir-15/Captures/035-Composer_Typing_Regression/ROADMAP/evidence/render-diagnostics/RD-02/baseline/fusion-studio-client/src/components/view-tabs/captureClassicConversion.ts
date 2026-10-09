/**
 * @module captureClassicConversion
 * @role VIEW-02 Slice 3 — the ONE-TIME classic-state conversion (SPEC-02 §6).
 *
 * Pure module: given the current generic records (if any) and the classic
 * view-state projection, decides between:
 *   - hydrated: valid generic records win over conversion and initial policy;
 *   - convert:  build ONE generic collection from the classic state;
 *   - unavailable: an asserted full-page state without a valid selected
 *     document stays bounded (never silently reset);
 *   - default: the truly-uninitialized default shape uses the configured
 *     initial policy.
 *
 * Conversion never rewrites an existing tab set and never runs reactively
 * after the collection becomes truly empty (no render loop recreating closed
 * tabs); the post-close classic surface is the established owner lifecycle.
 */

import type { ViewUIState } from '../../types/view-state';
import { canonicalCapturePath, normalizeCaptureTabs } from './captureTabDomain';
import {
  CAPTURE_DOCUMENT_PRESENTER_ID,
  CAPTURE_HOME_TARGET_KEY,
  CAPTURE_LANDING_COMPONENT_TYPE,
  CAPTURE_LANDING_TARGET_LABELS,
  CAPTURE_VIEWER_TARGET_KEY_PREFIX,
  captureCollectionLabel,
} from './captureConnectedPresenterTargets';
import type { ComponentDescriptor, TabContentRecord } from './componentTabTypes';
import type { ComponentTabCollectionState } from './componentTabTypes';
import { getFileIcon } from '../../lib/file-utils';

export interface ClassicCaptureProjection {
  docViewerFullPage?: boolean;
  docViewerMode?: ViewUIState['docViewerMode'];
  docViewerActiveSelectedPath?: string | null;
  docViewerArchiveSelectedPath?: string | null;
  docViewerLastOpenedPath?: string | null;
  docViewerActiveGridScroll?: number;
  docViewerArchiveGridScroll?: number;
  docViewerActiveDocScroll?: number;
  docViewerArchiveDocScroll?: number;
  docViewerTabs?: unknown;
  docViewerActiveTabId?: string | null;
}

export type CaptureClassicConversionPlan =
  | { kind: 'hydrated' }
  | { kind: 'default' }
  | { kind: 'unavailable' }
  | {
    kind: 'convert';
    collection: ComponentTabCollectionState;
    /** Classic fields written together with the converted records. */
    classicReset: Partial<ViewUIState>;
  };

function modeBucket(mode: NonNullable<ClassicCaptureProjection['docViewerMode']>) {
  return mode === 'archive' ? 'archive' : 'active';
}

function selectedPathFor(state: ClassicCaptureProjection): string | null {
  const mode = modeBucket(state.docViewerMode ?? 'active');
  const raw = mode === 'archive'
    ? state.docViewerArchiveSelectedPath
    : state.docViewerActiveSelectedPath;
  return canonicalCapturePath(raw);
}

function docScrollFor(state: ClassicCaptureProjection): number {
  const mode = modeBucket(state.docViewerMode ?? 'active');
  const raw = mode === 'archive'
    ? state.docViewerArchiveDocScroll
    : state.docViewerActiveDocScroll;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function gridScrollFor(state: ClassicCaptureProjection): number {
  const mode = modeBucket(state.docViewerMode ?? 'active');
  const raw = mode === 'archive'
    ? state.docViewerArchiveGridScroll
    : state.docViewerActiveGridScroll;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function documentDescriptor(
  path: string,
  state: ClassicCaptureProjection,
  componentInstanceId: string,
): ComponentDescriptor {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const mode = state.docViewerMode ?? 'active';
  const lastOpenedPath = canonicalCapturePath(state.docViewerLastOpenedPath);
  const locationLabels = ['Capture', captureCollectionLabel(path), name];
  return {
    schemaVersion: 1,
    componentTypeId: CAPTURE_DOCUMENT_PRESENTER_ID,
    componentInstanceId,
    input: {
      title: name,
      locationLabels,
      icon: getFileIcon(extension, name),
      iconClassName: `file-icon-${extension}`,
      path,
      name,
      extension,
      mode,
      docScroll: docScrollFor(state),
      gridScroll: gridScrollFor(state),
      ...(selectedPathFor(state) ? { selectedPath: selectedPathFor(state) } : {}),
      ...(lastOpenedPath ? { lastOpenedPath } : {}),
    },
    targetKey: `${CAPTURE_VIEWER_TARGET_KEY_PREFIX}${path}`,
  };
}

function homeDescriptor(
  state: ClassicCaptureProjection,
  componentInstanceId: string,
): ComponentDescriptor {
  return {
    schemaVersion: 1,
    componentTypeId: CAPTURE_LANDING_COMPONENT_TYPE,
    componentInstanceId,
    input: {
      title: 'CAPTURE',
      locationLabels: [...CAPTURE_LANDING_TARGET_LABELS],
      // The landing presenter projection is preserved for identity/restart;
      // the live projection stays in the classic fields the presenter reads.
      classic: {
        mode: state.docViewerMode ?? 'active',
        ...(state.docViewerLastOpenedPath
          ? { lastOpenedPath: canonicalCapturePath(state.docViewerLastOpenedPath) }
          : {}),
        ...(selectedPathFor(state) ? { selectedPath: selectedPathFor(state) } : {}),
        ...(state.docViewerArchiveSelectedPath
          ? { archiveSelectedPath: canonicalCapturePath(state.docViewerArchiveSelectedPath) }
          : {}),
        gridScroll: gridScrollFor(state),
        docScroll: docScrollFor(state),
      },
    },
    targetKey: CAPTURE_HOME_TARGET_KEY,
  };
}

function collectionFor(
  descriptor: ComponentDescriptor,
  tabId: string,
): ComponentTabCollectionState {
  return {
    tabs: [{ tabId, content: { kind: 'component', revision: 0, component: descriptor } }],
    activeTabId: tabId,
    reservations: [],
  };
}

/** True when any classic field carries meaningful (non-default) state. */
function hasMeaningfulClassicState(state: ClassicCaptureProjection): boolean {
  if (selectedPathFor(state)) return true;
  if (canonicalCapturePath(state.docViewerArchiveSelectedPath)) return true;
  if (canonicalCapturePath(state.docViewerLastOpenedPath)) return true;
  if ((state.docViewerMode ?? 'active') !== 'active') return true;
  const scrolls = [
    state.docViewerActiveGridScroll,
    state.docViewerArchiveGridScroll,
    state.docViewerActiveDocScroll,
    state.docViewerArchiveDocScroll,
  ];
  return scrolls.some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

/** Full projection reader with legacy tab normalization. */
export function planCaptureClassicConversion(options: {
  records: ComponentTabCollectionState | null;
  classic: ClassicCaptureProjection;
  mintTabId: () => string;
  mintComponentInstanceId: () => string;
}): CaptureClassicConversionPlan {
  const { records, classic, mintTabId, mintComponentInstanceId } = options;
  if (records && records.tabs.length > 0) return { kind: 'hydrated' };

  // Legacy hydrated Capture tabs normalize ONCE into the connected projection,
  // preserving open document identity, active selection, and scroll state.
  const legacy = normalizeCaptureTabs(classic.docViewerTabs, classic.docViewerActiveTabId);
  if (legacy.tabs.length > 0) {
    const tabs: TabContentRecord[] = [];
    const idMap = new Map<string, string>();
    for (const tab of legacy.tabs) {
      const tabId = mintTabId();
      idMap.set(tab.id, tabId);
      const projection: ClassicCaptureProjection = {
        docViewerMode: tab.ui.mode,
        docViewerLastOpenedPath: tab.ui.lastOpenedPath,
        docViewerActiveSelectedPath: tab.ui.byMode.active.selectedPath,
        docViewerArchiveSelectedPath: tab.ui.byMode.archive.selectedPath,
        docViewerActiveGridScroll: tab.ui.byMode.active.gridScroll,
        docViewerArchiveGridScroll: tab.ui.byMode.archive.gridScroll,
        docViewerActiveDocScroll: tab.ui.byMode.active.docScroll,
        docViewerArchiveDocScroll: tab.ui.byMode.archive.docScroll,
      };
      if (tab.kind === 'doc') {
        tabs.push({
          tabId,
          content: {
            kind: 'component',
            revision: 0,
            component: documentDescriptor(tab.path, projection, mintComponentInstanceId()),
          },
        });
      } else {
        tabs.push({
          tabId,
          content: {
            kind: 'component',
            revision: 0,
            component: homeDescriptor(projection, mintComponentInstanceId()),
          },
        });
      }
    }
    const legacyActive = legacy.activeId ? idMap.get(legacy.activeId) : undefined;
    return {
      kind: 'convert',
      collection: {
        tabs,
        activeTabId: legacyActive ?? tabs[0].tabId,
        reservations: [],
      },
      // docViewerFullPage: false — the full-page/preview mode is now expressed
      // by the connected tabs; classic grid fields stay for the presenter.
      classicReset: {
        docViewerTabs: [],
        docViewerActiveTabId: null,
        docViewerFullPage: false,
      },
    };
  }

  if (classic.docViewerFullPage === true) {
    const path = selectedPathFor(classic);
    if (!path) return { kind: 'unavailable' };
    return {
      kind: 'convert',
      collection: collectionFor(
        documentDescriptor(path, classic, mintComponentInstanceId()),
        mintTabId(),
      ),
      classicReset: {
        docViewerTabs: [],
        docViewerActiveTabId: null,
        docViewerFullPage: false,
      },
    };
  }

  if (hasMeaningfulClassicState(classic)) {
    return {
      kind: 'convert',
      collection: collectionFor(
        homeDescriptor(classic, mintComponentInstanceId()),
        mintTabId(),
      ),
      // Landing/preview conversion preserves the classic projection (the
      // presenter reads it); only the legacy tab shell fields clear.
      classicReset: {
        docViewerTabs: [],
        docViewerActiveTabId: null,
      },
    };
  }

  return { kind: 'default' };
}

/** Reads the classic projection from the live panel store view state. */
export function classicProjectionFromViewState(
  viewState: Partial<ViewUIState> | undefined,
): ClassicCaptureProjection {
  return {
    docViewerFullPage: viewState?.docViewerFullPage,
    docViewerMode: viewState?.docViewerMode,
    docViewerActiveSelectedPath: viewState?.docViewerActiveSelectedPath,
    docViewerArchiveSelectedPath: viewState?.docViewerArchiveSelectedPath,
    docViewerLastOpenedPath: viewState?.docViewerLastOpenedPath,
    docViewerActiveGridScroll: viewState?.docViewerActiveGridScroll,
    docViewerArchiveGridScroll: viewState?.docViewerArchiveGridScroll,
    docViewerActiveDocScroll: viewState?.docViewerActiveDocScroll,
    docViewerArchiveDocScroll: viewState?.docViewerArchiveDocScroll,
    docViewerTabs: viewState?.docViewerTabs,
    docViewerActiveTabId: viewState?.docViewerActiveTabId,
  };
}
