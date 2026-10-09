/**
 * @module fileConnectedOwnerPorts
 * @role VIEW-02 Slice 4 — binds the generic connected tab owner to File
 *       Explorer's EXISTING Zustand presentation owner (SPEC-02 §8/§10,
 *       VRT-011A, VRT-012, VRT-013).
 *
 * State ownership is UNCHANGED (VRT-013): the durable owner is
 * `state/fileStore.ts` (tabs + active tab) plus the established view-activity
 * persistence (`persistFileTabs` → `replaceViewTabs` → acknowledged
 * `state:set`) and the `fileDataStore.ts` content lifecycles. This module is
 * translation, not a second store: it adds no durable schema, no
 * `fileTabRecords`-style state document, and no WS message types. The generic
 * snapshot is derived from the file presentation store on every fresh read
 * (cached by store identity so `useSyncExternalStore` snapshots stay
 * referentially stable), and `applyCollection` performs ONE atomic
 * acknowledged owner commit through the store's own
 * `applyConnectedTabCommit` primitive.
 *
 * Session-only generic lifecycle state that the presentation store does not
 * model (empty-tab revisions, reservations, component instance identity) is
 * instance-local connected-owner machinery — exactly the "instance-local,
 * not a second tab store and not a durable schema" contract of
 * `componentTabConnectedOwner.ts`. It is re-derived from the store whenever
 * the store changes outside the owner (hydration, legacy paths).
 */

import { getFileIcon } from '../../lib/file-utils';
import { usePanelStore } from '../../state/panelStore';
import { useFileStore } from '../../state/fileStore';
import type { EditorTab, FileEditorTab } from '../../types/file-explorer';
import {
  canonicalFilePath,
  FILE_DOCUMENT_PRESENTER_ID,
  FILE_VIEWER_FALLBACK_LABEL,
  FILE_VIEWER_PANEL_ID,
  FILE_VIEWER_TARGET_KEY_PREFIX,
  fileDocumentTargetKey,
  fileLocationLabels,
  splitFilePath,
} from './fileConnectedPresenterTargets';
import {
  isBoundedOpaqueId,
  validateComponentDescriptor,
  validateTabContentRecord,
} from './componentTabValidation';import type {
  ComponentDescriptor,
  ComponentTabCollectionState,
  EmptyTabReservation,
  TabContentRecord,
} from './componentTabTypes';
import type { ConnectedTabOwnerPorts } from './componentTabConnectedOwner';
import type { ConnectedTabLauncherBinding } from './componentTabLauncherBinding';
import { describeComponentFromInputContract } from './componentTabConnectedAdapter';
import type {
  ResolvedTabPlacementTarget,
  TabPlacementTargetRef,
} from './componentTabPlacementTypes';
import type { TabBreadcrumbSegment } from './componentTabPresentationDomain';
import { createFileOpenPickerBinding } from './fileViewTabAdapter';
import type { ViewTabAdapterModel } from './viewTabAdapters';

const EMPTY_COLLECTION: ComponentTabCollectionState = Object.freeze({
  tabs: Object.freeze([]) as readonly TabContentRecord[],
  activeTabId: null,
  reservations: Object.freeze([]) as readonly EmptyTabReservation[],
});

function isBoundedDisplayText(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxBytes
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    });
}

/** File display contract: shared input contract plus the file-icon class. */
export function describeFileComponent(
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

/** Bounded, validated input contract for the connected file document presenter. */
export function fileDocumentPresenterInput(value: unknown): {
  path: string;
  name: string;
  extension: string;
} | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as { [key: string]: unknown };
  const path = canonicalFilePath(record.path);
  if (!path || path.length > 1024) return null;
  if (typeof record.name !== 'string' || !record.name || record.name.length > 1024) return null;
  if (typeof record.extension !== 'string' || record.extension.length > 64) return null;
  return { path, name: record.name, extension: record.extension };
}

/** Current view label for location segments (read at derive/resolve time). */
function currentViewLabel(): string {
  const name = usePanelStore.getState().panelConfigs.find(
    (config) => config.id === FILE_VIEWER_PANEL_ID,
  )?.name;
  return (name && name.trim()) || FILE_VIEWER_FALLBACK_LABEL;
}

interface FileOwnerSession {
  /** Canonical path → component instance identity (stable per session). */
  instanceIds: Map<string, string>;
  /** Tab id → generic content revision (survives external store changes). */
  revisions: Map<string, number>;
  /** Canonical path → symlink presentation metadata preserved across commits. */
  fileExtras: Map<string, { isSymlink?: true; symlinkTarget?: string }>;
  /** Reservations held between owner commits; re-validated on derivation. */
  reservations: readonly EmptyTabReservation[];
  /** Last observed presentation-store identity for stable fresh reads. */
  mirrorTabs: readonly EditorTab[] | null;
  mirrorActiveTabId: string | null;
  collection: ComponentTabCollectionState;
}

function createSession(): FileOwnerSession {
  return {
    instanceIds: new Map(),
    revisions: new Map(),
    fileExtras: new Map(),
    reservations: [],
    mirrorTabs: null,
    mirrorActiveTabId: null,
    collection: EMPTY_COLLECTION,
  };
}

/**
 * Code-owned TABS-03 target resolution for the File document presenter. The
 * descriptor input is exactly what the store-side translation re-derives from
 * the committed presentation tab, so a placement commit survives the
 * atomic-commit fresh-read verification (title/location/icon/identity).
 */
export function resolveFilePlacementTarget(
  target: TabPlacementTargetRef,
  viewLabel: string,
): ResolvedTabPlacementTarget | null {
  if (target.presenterId !== FILE_DOCUMENT_PRESENTER_ID
    || !target.targetKey.startsWith(FILE_VIEWER_TARGET_KEY_PREFIX)) {
    return null;
  }
  const path = canonicalFilePath(target.targetKey.slice(FILE_VIEWER_TARGET_KEY_PREFIX.length));
  if (!path) return null;
  const { name, extension } = splitFilePath(path);
  const locationLabels = fileLocationLabels(path, viewLabel);
  return {
    schemaVersion: 1,
    presenterId: FILE_DOCUMENT_PRESENTER_ID,
    targetKey: fileDocumentTargetKey(path),
    componentTypeId: FILE_DOCUMENT_PRESENTER_ID,
    input: {
      title: name,
      locationLabels,
      icon: getFileIcon(extension, name),
      ...(extension ? { iconClassName: `file-icon-${extension}` } : {}),
      path,
      name,
      extension,
    },
    tab: {
      label: name,
      icon: getFileIcon(extension, name),
      ...(extension ? { iconClassName: `file-icon-${extension}` } : {}),
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

/**
 * `file.open` launcher binding (VRT-011A): the shell-owned reveal effect
 * expands the existing file-tree drawer (the drawer itself is rendered by the
 * File surface) and the reservation stays pending — this tab is the
 * destination for the eventual file choice. A thrown reveal is a bounded
 * product-safe failure.
 */
export function createFileOpenLauncherBinding(): ConnectedTabLauncherBinding {
  return createFileOpenPickerBinding({
    reveal: () => {
      const state = usePanelStore.getState();
      if (state.viewStates[FILE_VIEWER_PANEL_ID]?.collapsed?.rightCol) {
        state.toggleCollapsed(FILE_VIEWER_PANEL_ID, 'rightCol');
      }
    },
  });
}

/**
 * Creates the File connected-owner ports. One instance per owner identity
 * (`{workspaceId, ws}`); `describeTab` is supplied by the connected adapter
 * hook. `applyCollection` performs the optimistic local owner write plus the
 * established activity persistence through the presentation store.
 */
export function createFileConnectedOwnerPorts(options: {
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
> {
  const context = { workspaceId: options.workspaceId, ws: usePanelStore.getState().ws };
  const session = createSession();
  let sequence = 0;
  const mintId = (prefix: string) => {
    const random = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${Date.now().toString(36)}-${(sequence++).toString(36)}-${random}`;
  };

  function instanceIdFor(path: string): string | null {
    const existing = session.instanceIds.get(path);
    if (existing) return existing;
    const minted = mintId('fvd');
    if (!isBoundedOpaqueId(minted)) return null;
    session.instanceIds.set(path, minted);
    return minted;
  }

  /** Presentation tab → validated generic component descriptor (fail-closed). */
  function descriptorFor(tab: FileEditorTab): ComponentDescriptor | null {
    const path = canonicalFilePath(tab.file.path);
    if (!path) return null;
    const componentInstanceId = instanceIdFor(path);
    if (!componentInstanceId) return null;
    const name = (tab.file.name || splitFilePath(path).name).slice(0, 1024);
    const extension = tab.file.extension ?? splitFilePath(path).extension;
    const locationLabels = fileLocationLabels(path, currentViewLabel());
    const validated = validateComponentDescriptor({
      schemaVersion: 1,
      componentTypeId: FILE_DOCUMENT_PRESENTER_ID,
      componentInstanceId,
      input: {
        title: name,
        locationLabels,
        icon: getFileIcon(extension, name),
        ...(extension ? { iconClassName: `file-icon-${extension}` } : {}),
        path,
        name,
        extension,
      },
      targetKey: fileDocumentTargetKey(path),
    });
    if (validated.ok) {
      if (tab.file.isSymlink === true || typeof tab.file.symlinkTarget === 'string') {
        session.fileExtras.set(path, {
          ...(tab.file.isSymlink === true ? { isSymlink: true } : {}),
          ...(typeof tab.file.symlinkTarget === 'string' ? { symlinkTarget: tab.file.symlinkTarget } : {}),
        });
      }
    }
    return validated.ok ? validated.value : null;
  }

  /**
   * Re-derives the generic snapshot from the presentation store after an
   * external change (hydration, legacy paths, restart). Fails closed to the
   * empty collection on any undescribable record — the established legacy
   * surface beneath stays the owner presentation.
   */
  function deriveCollection(tabs: readonly EditorTab[], activeTabId: string | null):
    ComponentTabCollectionState {
    const records: TabContentRecord[] = [];
    const seenPaths = new Set<string>();
    const seenTabIds = new Set<string>();
    for (const tab of tabs) {
      if (seenTabIds.has(tab.id)) return EMPTY_COLLECTION;
      seenTabIds.add(tab.id);
      if (tab.kind === 'file') {
        const path = canonicalFilePath(tab.file.path);
        if (!path || seenPaths.has(path)) return EMPTY_COLLECTION;
        seenPaths.add(path);
        const component = descriptorFor(tab);
        if (!component) return EMPTY_COLLECTION;
        const revision = session.revisions.get(tab.id) ?? 1;
        records.push({ tabId: tab.id, content: { kind: 'component', revision, component } });
      } else {
        // `empty` (and the session-only legacy `home` tab) translate to the
        // generic waiting Empty tab; the tab's opaque identity is preserved.
        records.push({
          tabId: tab.id,
          content: { kind: 'empty', revision: session.revisions.get(tab.id) ?? 0 },
        });
      }
    }
    const reservations = session.reservations.filter((reservation) => {
      const record = records.find((candidate) => candidate.tabId === reservation.tabId);
      return record !== undefined
        && record.content.kind === 'empty'
        && record.content.revision === reservation.expectedRevision;
    });
    session.reservations = reservations;
    const resolvedActive = activeTabId !== null
      && records.some((record) => record.tabId === activeTabId)
      ? activeTabId
      : null;
    return { tabs: records, activeTabId: resolvedActive, reservations };
  }

  function readCollection(): ComponentTabCollectionState {
    const fileState = useFileStore.getState();
    if (session.mirrorTabs === fileState.tabs
      && session.mirrorActiveTabId === fileState.activeTabId) {
      return session.collection;
    }
    const derived = deriveCollection(fileState.tabs, fileState.activeTabId);
    session.mirrorTabs = fileState.tabs;
    session.mirrorActiveTabId = fileState.activeTabId;
    session.collection = derived;
    return derived;
  }

  /** Presentation tabs for one planned generic collection. */
  function presentationTabsOf(collection: ComponentTabCollectionState): EditorTab[] | null {
    const tabs: EditorTab[] = [];
    for (const record of collection.tabs) {
      const validated = validateTabContentRecord(record);
      if (!validated.ok) return null;
      if (validated.value.content.kind === 'empty') {
        tabs.push({ id: validated.value.tabId, kind: 'empty' });
        continue;
      }
      const input = fileDocumentPresenterInput(validated.value.content.component.input);
      if (!input
        || validated.value.content.component.componentTypeId !== FILE_DOCUMENT_PRESENTER_ID
        || validated.value.content.component.targetKey !== fileDocumentTargetKey(input.path)) {
        return null;
      }
      // Preserve the committed component identity: the same canonical path
      // keeps its session instance identity across store round-trips.
      session.instanceIds.set(input.path, validated.value.content.component.componentInstanceId);
      session.revisions.set(validated.value.tabId, validated.value.content.revision);
      const extras = session.fileExtras.get(input.path);
      const fileTab: FileEditorTab = {
        id: validated.value.tabId,
        kind: 'file',
        file: {
          name: input.name,
          path: input.path,
          type: 'file',
          extension: input.extension,
          ...(extras?.isSymlink === true || typeof extras?.symlinkTarget === 'string'
            ? {
              ...(extras.isSymlink === true ? { isSymlink: true as const } : {}),
              ...(typeof extras.symlinkTarget === 'string' ? { symlinkTarget: extras.symlinkTarget } : {}),
            }
            : {}),
        },
      };
      tabs.push(fileTab);
    }
    return tabs;
  }

  return {
    workspaceId: options.workspaceId,
    viewId: FILE_VIEWER_PANEL_ID,
    readCollection,
    applyCollection: (next) => {
      const state = usePanelStore.getState();
      if (state.activeWorkspaceId !== context.workspaceId || state.ws !== context.ws) {
        throw new Error('The connected File owner is no longer current.');
      }
      const presentationTabs = presentationTabsOf(next);
      if (!presentationTabs) {
        throw new Error('The connected File collection could not be committed.');
      }
      for (const record of next.tabs) {
        if (record.content.kind === 'empty') {
          session.revisions.set(record.tabId, record.content.revision);
        }
      }
      session.reservations = next.reservations;
      useFileStore.getState().applyConnectedTabCommit({
        tabs: presentationTabs,
        activeTabId: next.activeTabId,
      });
      const committed = useFileStore.getState();
      session.mirrorTabs = committed.tabs;
      session.mirrorActiveTabId = committed.activeTabId;
      session.collection = next;
    },
    // The File presentation owner AND the workspace/panel owner both notify.
    subscribe: (listener) => {
      const unsubscribeFiles = useFileStore.subscribe(listener);
      const unsubscribePanel = usePanelStore.subscribe(listener);
      return () => {
        unsubscribeFiles();
        unsubscribePanel();
      };
    },
    isCurrent: () => {
      const state = usePanelStore.getState();
      return state.activeWorkspaceId === context.workspaceId && state.ws === context.ws;
    },
    mintTabId: () => mintId('fvt'),
    mintOperationId: () => mintId('fvo'),
    mintComponentInstanceId: () => mintId('fvi'),
    // Catalog-bound launcher for THIS view: exactly the code-owned picker;
    // unknown/wrong-view IDs fail closed (null).
    launcherFor: (launcherId: string) => (
      launcherId === 'file.open' ? createFileOpenLauncherBinding() : null
    ),
    resolvePlacementTarget: (target: TabPlacementTargetRef) => (
      resolveFilePlacementTarget(target, currentViewLabel())
    ),
    revealPlacement: (request: { tabId: string }) => {
      revealFilePlacement(request.tabId);
    },
  };
}

/** Bounded reveal: focus the placed tab's chrome, or the panel content area. */
function revealFilePlacement(tabId: string): void {
  try {
    window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(
        '.rv-panel[data-panel="file-viewer"].active',
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

/** True when the descriptor input is a pending (in-flight) file content request. */
export function isFileRecordPending(
  collection: ComponentTabCollectionState,
  tabId: string,
  pendingContents: ReadonlyMap<string, unknown>,
): boolean {
  const record = collection.tabs.find((candidate) => candidate.tabId === tabId);
  if (!record || record.content.kind !== 'component') return false;
  const input = fileDocumentPresenterInput(record.content.component.input);
  if (!input) return false;
  return pendingContents.has(`file-viewer:${input.path}`);
}

/**
 * Pending-file close protection (SPEC-02 §8/§10) applied at the connected
 * model seam: a tab whose content request is in flight renders a disabled
 * close affordance and refuses close, exactly like the established legacy
 * rail (`pendingContents.has('file-viewer:<path>')`). Pure function so the
 * behavior is provable without mounting the presentation tree.
 */
export function protectFileModelForPendingClose(
  model: ViewTabAdapterModel,
  collection: ComponentTabCollectionState,
  pendingContents: ReadonlyMap<string, unknown>,
): ViewTabAdapterModel {
  let changed = false;
  const tabs = model.tabs.map((tab) => {
    if (!isFileRecordPending(collection, tab.id, pendingContents)) return tab;
    changed = true;
    return { ...tab, closeDisabled: true };
  });
  if (!changed) return model;
  return {
    ...model,
    tabs,
    onClose: (tabId: string) => {
      if (isFileRecordPending(collection, tabId, pendingContents)) return;
      model.onClose(tabId);
    },
  };
}
