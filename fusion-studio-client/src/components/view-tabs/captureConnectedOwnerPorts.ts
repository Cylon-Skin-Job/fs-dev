/**
 * @module captureConnectedOwnerPorts
 * @role VIEW-02 Slice 3 — binds the generic connected tab owner to Capture's
 *       existing view-state owner (SPEC-02 §6/§8/§9, VRT-012, VRT-013).
 *
 * State ownership is UNCHANGED: the generic tab records persist as one
 * versioned field (`captureTabRecords`) inside the SAME per-view state
 * document, written through the established acknowledged `state:set` path
 * (`captureTabsController.ts` pattern: clientMutationId + state:result/error
 * settlement via the wire layer). This module is translation, not a second
 * store: it imports no new persistence and adds no WS message types.
 *
 * The document is strictly parsed on every fresh read (fail-closed to an empty
 * collection) and cached by store identity so `useSyncExternalStore` snapshots
 * stay referentially stable.
 */

import { usePanelStore } from '../../state/panelStore';
import type { CaptureTabRecordsDocument, ViewUIState } from '../../types/view-state';
import { canonicalCapturePath } from './captureTabDomain';
import {
  CAPTURE_DOCUMENT_PRESENTER_ID,
  CAPTURE_HOME_TARGET_KEY,
  CAPTURE_LANDING_COMPONENT_TYPE,
  CAPTURE_LANDING_PRESENTER_ID,
  CAPTURE_LANDING_TARGET_LABELS,
  CAPTURE_VIEWER_TARGET_KEY_PREFIX,
  captureCollectionLabel,
} from './captureConnectedPresenterTargets';
import {
  isBoundedOpaqueId,
  validateTabContentDescriptor,
  validateTabContentRecord,
} from './componentTabValidation';
import type {
  ComponentTabCollectionState,
  EmptyTabReservation,
  TabContentRecord,
} from './componentTabTypes';
import { getProductSafeReservationError } from './componentTabLifecycle';
import type {
  ResolvedTabPlacementTarget,
  TabPlacementTargetRef,
} from './componentTabPlacementTypes';
import type { ConnectedTabOwnerPorts } from './componentTabConnectedOwner';
import type { ConnectedTabLauncherBinding } from './componentTabLauncherBinding';
import { describeComponentFromInputContract } from './componentTabConnectedAdapter';
import type { TabBreadcrumbSegment } from './componentTabPresentationDomain';
import { validateComponentDescriptor } from './componentTabValidation';
import type { ComponentDescriptor } from './componentTabTypes';
import { getFileIcon } from '../../lib/file-utils';

export const CAPTURE_PANEL_ID = 'capture-viewer';
export const CAPTURE_TAB_RECORDS_FIELD = 'captureTabRecords';

/**
 * `capture.home` launcher binding: returns a fully validated component
 * descriptor for the existing Capture landing presenter, or a bounded
 * product-safe failure (throw → the accepted Empty reservation failure
 * behavior). Never creates files or folders.
 */
export function createCaptureHomeLauncherBinding(
  mintComponentInstanceId: () => string,
): ConnectedTabLauncherBinding {
  return {
    kind: 'component',
    icon: 'home',
    launcher: () => {
      const descriptor = {
        schemaVersion: 1 as const,
        componentTypeId: 'capture.landing',
        componentInstanceId: mintComponentInstanceId(),
        input: {
          title: 'CAPTURE',
          locationLabels: ['Capture', 'Documents and Artifacts'],
        },
        targetKey: CAPTURE_HOME_TARGET_KEY,
      };
      const validated = validateComponentDescriptor(descriptor);
      if (!validated.ok) {
        throw new Error('capture.home produced an invalid descriptor.');
      }
      return { kind: 'component' as const, descriptor: validated.value };
    },
  };
}

function isBoundedDisplayText(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxBytes
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    });
}

/**
 * Capture display contract: the shared descriptor input contract (title +
 * ordered location segments) plus the file-icon class used by document tabs.
 */
export function describeCaptureComponent(
  component: ComponentDescriptor,
): ReturnType<typeof describeComponentFromInputContract> | null {
  const display = describeComponentFromInputContract(component);
  if (!display) return null;
  const iconClassName = component.input.iconClassName;
  if (isBoundedDisplayText(iconClassName, 256)) {
    return { ...display, iconClassName };
  }
  return display;
}

const EMPTY_COLLECTION: ComponentTabCollectionState = Object.freeze({
  tabs: Object.freeze([]) as readonly TabContentRecord[],
  activeTabId: null,
  reservations: Object.freeze([]) as readonly EmptyTabReservation[],
});

/** Strict fail-closed parse of the durable document into runtime records. */
export function parseCaptureTabRecordsDocument(
  value: unknown,
): ComponentTabCollectionState | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { [key: string]: unknown };
  if (record.schemaVersion !== 1) return null;
  if (!Array.isArray(record.tabs)) return null;
  const tabs: TabContentRecord[] = [];
  for (const candidate of record.tabs) {
    const validated = validateTabContentRecord(candidate);
    if (!validated.ok) return null;
    tabs.push(validated.value);
  }
  if (record.activeTabId !== null && !isBoundedOpaqueId(record.activeTabId)) return null;
  if (!Array.isArray(record.reservations)) return null;
  const reservations: EmptyTabReservation[] = [];
  for (const candidate of record.reservations) {
    const reservation = parseReservation(candidate);
    if (!reservation) return null;
    reservations.push(reservation);
  }
  const activeTabId = record.activeTabId as string | null;
  if (activeTabId !== null && !tabs.some((tab) => tab.tabId === activeTabId)) return null;
  return { tabs, activeTabId, reservations };
}

function parseReservation(value: unknown): EmptyTabReservation | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as { [key: string]: unknown };
  if (!isBoundedOpaqueId(record.tabId)
    || !isBoundedOpaqueId(record.operationId)
    || !isBoundedOpaqueId(record.launcherId)
    || typeof record.expectedRevision !== 'number'
    || !Number.isSafeInteger(record.expectedRevision)
    || record.expectedRevision < 0
    || (record.status !== 'pending' && record.status !== 'failed')) {
    return null;
  }
  const hasError = Object.hasOwn(record, 'error');
  if (record.status === 'pending' && hasError) return null;
  if (record.status === 'failed' && !hasError) return null;
  const base = {
    tabId: record.tabId as string,
    operationId: record.operationId as string,
    expectedRevision: record.expectedRevision as number,
    launcherId: record.launcherId as string,
    status: record.status as 'pending' | 'failed',
  };
  if (!hasError) return base;
  const error = record.error as { [key: string]: unknown } | null;
  if (typeof error !== 'object' || error === null
    || typeof error.code !== 'string' || typeof error.message !== 'string') {
    return null;
  }
  const safe = getProductSafeReservationError(error.code);
  if (!safe || error.message !== safe.message) return null;
  return { ...base, error: { ...safe } };
}

/** Serializes runtime records back into the durable versioned document. */
export function captureTabRecordsDocument(
  collection: ComponentTabCollectionState,
): CaptureTabRecordsDocument {
  return {
    schemaVersion: 1,
    tabs: collection.tabs.map((tab) => ({ tabId: tab.tabId, content: tab.content })),
    activeTabId: collection.activeTabId,
    reservations: collection.reservations.map((reservation) => ({ ...reservation })),
  };
}

function currentViewState(): Partial<ViewUIState> {
  return usePanelStore.getState().viewStates[CAPTURE_PANEL_ID] ?? {};
}

/**
 * Creates the Capture connected-owner ports. One instance per owner identity
 * (`{workspaceId, ws}`); `describeTab` and `launcherFor` are supplied by the
 * connected adapter hook. `applyCollection` performs the optimistic local
 * owner write plus the acknowledged `state:set` persist (the established
 * `captureTabsController` discipline).
 */
export function createCaptureConnectedOwnerPorts(options: {
  workspaceId: string | null;
}): Pick<
  ConnectedTabOwnerPorts,
  | 'readCollection'
  | 'applyCollection'
  | 'subscribe'
  | 'isCurrent'
  | 'workspaceId'
  | 'viewId'
  | 'launcherFor'
  | 'mintTabId'
  | 'mintOperationId'
  | 'mintComponentInstanceId'
  | 'resolvePlacementTarget'
  | 'revealPlacement'
  | 'blankPlacementTarget'
> {
  const context = { workspaceId: options.workspaceId, ws: usePanelStore.getState().ws };
  let sequence = 0;
  const mintId = (prefix: string) => {
    const random = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}-${random}`;
  };

  // Reference-stable read cache: the store holds one document object until
  // the next owner write replaces it, so repeated reads between writes return
  // the same collection identity (required by useSyncExternalStore).
  let cachedSource: unknown;
  let cachedCollection: ComponentTabCollectionState = EMPTY_COLLECTION;
  function readCollection(): ComponentTabCollectionState {
    const source = usePanelStore.getState().viewStates[CAPTURE_PANEL_ID]?.[CAPTURE_TAB_RECORDS_FIELD];
    if (source === cachedSource) return cachedCollection;
    const parsed = parseCaptureTabRecordsDocument(source);
    cachedSource = source;
    cachedCollection = parsed ?? EMPTY_COLLECTION;
    return cachedCollection;
  }

  return {
    workspaceId: options.workspaceId,
    viewId: CAPTURE_PANEL_ID,
    readCollection,    applyCollection: (next) => {
      const state = usePanelStore.getState();
      if (state.activeWorkspaceId !== context.workspaceId || state.ws !== context.ws) {
        throw new Error('The connected Capture owner is no longer current.');
      }
      const documentPatch = {
        [CAPTURE_TAB_RECORDS_FIELD]: captureTabRecordsDocument(next),
      } as Partial<ViewUIState>;
      state.setViewState(CAPTURE_PANEL_ID, documentPatch);
      state._persistViewPatch(CAPTURE_PANEL_ID, documentPatch);
    },
    subscribe: (listener) => usePanelStore.subscribe(listener),
    isCurrent: () => {
      const state = usePanelStore.getState();
      return state.activeWorkspaceId === context.workspaceId && state.ws === context.ws;
    },
    mintTabId: () => mintId('cvt'),
    mintOperationId: () => mintId('cvo'),
    mintComponentInstanceId: () => mintId('cvi'),
    // Catalog-bound launcher for THIS view: exactly one code-owned component
    // launcher; unknown/wrong-view IDs fail closed (null).
    launcherFor: (launcherId: string) => (
      launcherId === 'capture.home'
        ? createCaptureHomeLauncherBinding(() => mintId('cvi'))
        : null
    ),
    // The view icon is read at resolve time so a view rename/icon refresh
    // never forks the owner runtime.
    resolvePlacementTarget: (target: TabPlacementTargetRef) => (
      resolveCapturePlacementTarget(target, currentCaptureViewIcon())
    ),
    // VIEW-02 §4 blank capability: Capture's configured blank is the Home tab
    // (landing presenter, stable home target key). The generic plus contract
    // places/recenters THIS target through TABS-03; File's blank is the
    // generic Empty tab, so its ports deliberately omit this capability.
    blankPlacementTarget: () => ({
      presenterId: CAPTURE_LANDING_PRESENTER_ID,
      targetKey: CAPTURE_HOME_TARGET_KEY,
    }),
    revealPlacement: (request: { tabId: string }) => {
      revealCapturePlacement(request.tabId);
    },
  };
}

function currentCaptureViewIcon(): string {
  return usePanelStore.getState().panelConfigs.find((config) => config.id === CAPTURE_PANEL_ID)?.icon
    ?? 'note_stack';
}

/** Code-owned TABS-03 target resolution for Capture presenters. */
export function resolveCapturePlacementTarget(
  target: TabPlacementTargetRef,
  viewIcon: string,
): ResolvedTabPlacementTarget | null {
  if (target.presenterId === CAPTURE_LANDING_PRESENTER_ID
    && target.targetKey === CAPTURE_HOME_TARGET_KEY) {
    return {
      schemaVersion: 1,
      presenterId: CAPTURE_LANDING_PRESENTER_ID,
      targetKey: CAPTURE_HOME_TARGET_KEY,
      componentTypeId: CAPTURE_LANDING_COMPONENT_TYPE,
      input: {
        title: 'CAPTURE',
        locationLabels: [...CAPTURE_LANDING_TARGET_LABELS],
      },
      tab: {
        label: 'CAPTURE',
        icon: viewIcon,
        iconClassName: 'rv-view-tab-icon--view',
        closeLabel: 'Close CAPTURE',
        closable: true,
      },
      location: {
        schemaVersion: 1,
        segments: CAPTURE_LANDING_TARGET_LABELS.map((label) => ({ label })) as
          [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]],
      },
    };
  }
  if (target.presenterId === CAPTURE_DOCUMENT_PRESENTER_ID
    && target.targetKey.startsWith(CAPTURE_VIEWER_TARGET_KEY_PREFIX)) {
    const path = canonicalCapturePath(
      target.targetKey.slice(CAPTURE_VIEWER_TARGET_KEY_PREFIX.length),
    );
    if (!path) return null;
    return resolveCaptureDocumentTarget(path);
  }
  return null;
}

/** Builds the document placement target from the live classic projection. */
export function resolveCaptureDocumentTarget(
  path: string,
): ResolvedTabPlacementTarget | null {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const state = currentViewState();
  const mode = state.docViewerMode ?? 'active';
  const bucket = mode === 'archive' ? 'archive' : 'active';
  const selectedPath = bucket === 'archive'
    ? canonicalCapturePath(state.docViewerArchiveSelectedPath)
    : canonicalCapturePath(state.docViewerActiveSelectedPath);
  const docScroll = bucket === 'archive'
    ? (state.docViewerArchiveDocScroll ?? 0)
    : (state.docViewerActiveDocScroll ?? 0);
  const lastOpenedPath = canonicalCapturePath(state.docViewerLastOpenedPath);
  const locationLabels = ['Capture', captureCollectionLabel(path), name];
  return {
    schemaVersion: 1,
    presenterId: CAPTURE_DOCUMENT_PRESENTER_ID,
    targetKey: `${CAPTURE_VIEWER_TARGET_KEY_PREFIX}${path}`,
    componentTypeId: CAPTURE_DOCUMENT_PRESENTER_ID,
    input: {
      title: name,
      locationLabels,
      icon: getFileIcon(extension, name),
      iconClassName: `file-icon-${extension}`,
      path,
      name,
      extension,
      mode,
      docScroll,
      ...(selectedPath ? { selectedPath } : {}),
      ...(lastOpenedPath ? { lastOpenedPath } : {}),
    },
    tab: {
      label: name,
      icon: getFileIcon(extension, name),
      iconClassName: `file-icon-${extension}`,
      closeLabel: `Close ${name}`,
      closable: true,
    },
    location: {
      schemaVersion: 1,
      segments: locationLabels.map((label) => ({ label })) as
        [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]],
    },
  };
}

/** Bounded reveal: focus the placed tab's chrome, or the panel content area. */
function revealCapturePlacement(tabId: string): void {
  try {
    window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(
        '.rv-panel[data-panel="capture-viewer"].active',
      );
      if (!panel) return;
      const tab = panel.querySelector<HTMLElement>(
        `[role="tab"][data-tab-id="${CSS.escape(tabId)}"]`,
      );
      (tab ?? panel.querySelector<HTMLElement>('.rv-content-area'))?.focus();
    });
  } catch {
    // Reveal is a presentation nicety; never fail placement for it.
  }
}

/** Reads one committed component record by its target key (validated). */
export function findComponentTargetKey(
  collection: ComponentTabCollectionState,
  targetKey: string,
): { tabId: string; input: { [key: string]: unknown } } | null {
  for (const tab of collection.tabs) {
    if (tab.content.kind !== 'component') continue;
    if (tab.content.component.targetKey !== targetKey) continue;
    const validated = validateTabContentDescriptor(tab.content);
    if (!validated.ok || validated.value.kind !== 'component') continue;
    return { tabId: tab.tabId, input: validated.value.component.input };
  }
  return null;
}
