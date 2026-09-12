/**
 * @module fileConnectedAdapter
 * @role VIEW-02 Slice 4 — File Explorer connected adapter: policy-gated
 *       production adoption of the generic component tab host (SPEC-02
 *       §6/§7/§8/§10, VRT-011A, VRT-012, VRT-013).
 *
 * File-specific connected behavior bound here (the generic shell stays
 * untouched):
 *  - the ONE-TIME initial Empty tab comes from the shipped policy through the
 *    shared connected adapter (hydrated file tabs win — SPEC-02 §6);
 *  - VIEW-02 §6: the File Empty tab renders the File-owned reference body
 *    (folder icon + "Open file" + copy) through the generic Empty surface's
 *    bounded view-supplied presenter slot — the launcher grid is retired;
 *  - VIEW-02 §5/§7: the file-tree drawer is the ONLY way an Empty tab is
 *    filled. While a File Empty tab is ACTIVE the drawer is hosted beside the
 *    generic empty-panel body (subsuming the reservation-pending case), and a
 *    session Empty-tab creation auto-opens it when the shipped policy says
 *    `autoOpenDrawer` (File: true). Hydrated Empty tabs are not "created"
 *    this session and never auto-open. Drawer close (the dock control
 *    collapsing the right column) retires the pending picker context and
 *    reservation (SPEC-02 §5); ordinary focus changes do not;
 *  - pending-file close protection is preserved at the model seam: a tab
 *    whose content request is in flight renders a disabled close affordance
 *    and refuses close, exactly like the legacy rail;
 *  - the presenter tree keeps using the existing fileDataStore owner.
 */

import { createElement, lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFileDataStore } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { useWorkspaceStore } from '../../state/workspaceStore';
import {
  hydrateFileViewerActivity,
  loadExpandedFolders,
  loadRootTree,
} from '../../lib/file-tree';
import { normalizeViewActivity } from '../../lib/viewActivity';
import type { TabPolicy } from '../../lib/tab-policy-projection';
import type { ViewTabAdapterModel } from './viewTabAdapters';
import {
  readyTabPolicyFor,
  useConnectedComponentTabAdapter,
} from './componentTabConnectedAdapter';
import type { ConnectedTabOwnerRuntime } from './componentTabConnectedOwner';
import type { FirstPartyComponentRegistration } from './componentTabResolver';
import { FILE_DOCUMENT_PRESENTER_ID, FILE_VIEWER_PANEL_ID } from './fileConnectedPresenterTargets';
import {
  createFileConnectedOwnerPorts,
  describeFileComponent,
  fileDocumentPresenterInput,
  protectFileModelForPendingClose,
} from './fileConnectedOwnerPorts';
import { setActiveFileConnectedRuntime } from './fileConnectedTabs';

// The real presenters carry view CSS; they load lazily so pure/spec consumers
// of the registry chain stay CSS-free.
const LazyFileDocumentPresenter = lazy(async () => ({
  default: (await import('../file-explorer/FileDocumentPresenter')).FileDocumentPresenter,
}));
const LazyFilePickerDrawerLayer = lazy(async () => ({
  default: (await import('../file-explorer/FilePickerDrawerLayer')).FilePickerDrawerLayer,
}));
const LazyFileEmptyTabBody = lazy(async () => ({
  default: (await import('../file-explorer/FileEmptyTabBody')).FileEmptyTabBody,
}));

/** First-party registration for the adopted File document presenter. */
export function fileConnectedPresenterRegistrations(): readonly FirstPartyComponentRegistration[] {
  return [
    {
      componentTypeId: FILE_DOCUMENT_PRESENTER_ID,
      label: 'File document',
      render: ({ descriptor }) => {
        const input = fileDocumentPresenterInput(descriptor.input);
        if (!input || descriptor.targetKey === undefined) {
          return boundedUnavailableSurface();
        }
        return createElement(
          Suspense,
          { fallback: null },
          createElement(LazyFileDocumentPresenter, { input }),
        );
      },
    },
  ];
}

function boundedUnavailableSurface() {
  return createElement(
    'section',
    {
      className: 'rv-capture-tab-unavailable',
      role: 'status',
      'data-file-unavailable': true,
    },
    createElement(
      'p',
      { className: 'rv-capture-tab-unavailable-message' },
      'This file could not be reopened. The view stays usable.',
    ),
  );
}

const FILE_CONNECTED_REGISTRATIONS = fileConnectedPresenterRegistrations();

/**
 * Stand-in policy used ONLY while the connected path is disabled (no ready
 * policy); it is never read by the owner runtime in that state.
 */
const FILE_STANDIN_POLICY: TabPolicy = {
  schemaVersion: 1,
  initial: { kind: 'empty' },
  plus: { enabled: true },
  empty: { tabLabel: 'New File Tab', locationLabel: 'New File Tab', launcherIds: ['file.open'] },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned File values (owner-confirmed 2026-09-10).
  newTab: { blankKind: 'empty', autoOpenDrawer: true },
};

interface DrawerHost {
  element: HTMLDivElement;
  root: Root;
}

/**
 * File Explorer connected adapter: policy-gated production adoption. Returns
 * null when the connected path is not engaged (no ready policy) or the
 * connected collection is truly empty (the legacy FileExplorer surface
 * beneath is the established owner lifecycle).
 */
export function useFileConnectedAdapter(enabled: boolean): ViewTabAdapterModel | null {
  const policy = usePanelStore((state) => readyTabPolicyFor(state.tabPolicies, FILE_VIEWER_PANEL_ID));
  const workspaceId = usePanelStore((state) => state.activeWorkspaceId);
  const viewIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === FILE_VIEWER_PANEL_ID)?.icon ?? 'folder'
  ));
  const runtimeRef = useRef<ConnectedTabOwnerRuntime | null>(null);

  const ownerPorts = useMemo(() => {
    const ports = createFileConnectedOwnerPorts({ workspaceId });
    return {
      ...ports,
      // VIEW-02 §7: a session Empty-tab creation auto-opens the file-tree
      // drawer when the shipped policy says `autoOpenDrawer` (File: true).
      // Hydrated Empty tabs are not "created" this session — the observation
      // fires only from the owner runtime's creation transitions, so pure
      // hydration never auto-opens. Idempotent: expands only when collapsed.
      onEmptyTabCreated: () => {
        const state = usePanelStore.getState();
        const currentPolicy = readyTabPolicyFor(state.tabPolicies, FILE_VIEWER_PANEL_ID);
        if (!currentPolicy?.newTab.autoOpenDrawer) return;
        if (state.viewStates[FILE_VIEWER_PANEL_ID]?.collapsed?.rightCol) {
          state.toggleCollapsed(FILE_VIEWER_PANEL_ID, 'rightCol');
        }
      },
    };
  }, [workspaceId]);

  const runtimeKey = workspaceId ?? '__file-no-workspace__';
  const connectedEnabled = enabled && policy !== null;
  // VIEW-02 §9 hydration reconciliation: the initial policy (and with it the
  // session Empty tab) waits until the persisted view-state document has
  // landed, so the established activity hydration (6 persisted file tabs)
  // wins before any blank is created — and no premature empty-activity write
  // can clobber the persisted state (the verified silent 6→1 reset).
  const initialGateOpen = usePanelStore((state) => (
    state.viewStates[FILE_VIEWER_PANEL_ID] !== undefined
    && !state.viewStateLoadPending[FILE_VIEWER_PANEL_ID]
  ));

  // Register the runtime for view-side entry points (the public file-open
  // path in lib/file-tree.ts routes through the serialized intent lane).
  useEffect(() => {
    if (!connectedEnabled) {
      setActiveFileConnectedRuntime(null, null);
      return undefined;
    }
    setActiveFileConnectedRuntime(runtimeRef.current, workspaceId);
    return () => {
      setActiveFileConnectedRuntime(null, null);
    };
  }, [connectedEnabled, runtimeKey, workspaceId]);

  const model = useConnectedComponentTabAdapter({
    enabled: connectedEnabled,
    panelId: FILE_VIEWER_PANEL_ID,
    label: 'Open files',
    viewIcon,
    plusLabel: 'New file tab',
    policy: policy ?? FILE_STANDIN_POLICY,
    runtimeKey,
    ownerPorts,
    registrations: FILE_CONNECTED_REGISTRATIONS,
    describeComponent: describeFileComponent,
    initialGateOpen,
    // VIEW-02 §6: the File-owned reference Empty body (folder icon +
    // "Open file" + copy + dock toggle), rendered through the generic Empty
    // surface's bounded view-supplied presenter slot.
    renderEmptyBody: () => createElement(
      Suspense,
      { fallback: null },
      createElement(LazyFileEmptyTabBody),
    ),
    runtimeRef,
  });

  // Connected workspace lifecycle driver (VRT-013). The established
  // hydration + tree-reload effects live on FileExplorer, which the connected
  // surface REPLACES whenever tabs exist — without this driver a workspace
  // switch would keep the previous workspace's tabs and tree (cross-workspace
  // bleed, SPEC §13.8). While the connected surface owns the view it drives
  // the EXACT same established lifecycle for the active workspace; FileExplorer
  // keeps driving it in the legacy/no-policy path and while the connected
  // collection is empty (FileExplorer is mounted exactly then, so the two
  // drivers never double-run).
  const rawFileActivity = usePanelStore((state) => state.viewStates[FILE_VIEWER_PANEL_ID]?.activity);
  const fileActivity = useMemo(() => normalizeViewActivity(rawFileActivity), [rawFileActivity]);
  const ws = usePanelStore((state) => state.ws);
  const currentPanel = usePanelStore((state) => state.currentPanel);
  const workspaceEpoch = useWorkspaceStore((state) => state.workspaceEpoch);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const readProtocolVersion = useWorkspaceStore((state) => state.fileViewerReadProtocolVersion);
  const connectedLifecycleOwned = connectedEnabled && model !== null;

  useEffect(() => {
    if (!connectedLifecycleOwned || !rawFileActivity) return;
    hydrateFileViewerActivity(fileActivity);
  }, [connectedLifecycleOwned, fileActivity, rawFileActivity, workspaceEpoch]);

  useEffect(() => {
    if (!connectedLifecycleOwned) return;
    if (
      currentPanel !== FILE_VIEWER_PANEL_ID
      || ws?.readyState !== WebSocket.OPEN
      || !activeWorkspaceId
      || !workspaceEpoch
      || readProtocolVersion !== 1
    ) return;
    loadRootTree(false);
    loadExpandedFolders(false);
  }, [connectedLifecycleOwned, currentPanel, readProtocolVersion, workspaceEpoch, activeWorkspaceId, ws]);

  // Drawer close (SPEC-02 §5): collapsing the file-tree drawer retires the
  // pending picker context and its reservation. Expanding/focus never does.
  const drawerClosed = usePanelStore(
    (state) => state.viewStates[FILE_VIEWER_PANEL_ID]?.collapsed?.rightCol ?? false,
  );
  useEffect(() => {
    if (!drawerClosed) return;
    runtimeRef.current?.clearPickerContext();
  }, [drawerClosed]);

  // Pending-file close protection (SPEC-02 §8/§10): preserve the legacy
  // behavior — a tab with an in-flight content request shows a disabled
  // close affordance and refuses close. Applied at the model seam; the
  // generic shell stays untouched.
  const pendingContents = useFileDataStore((state) => state.pendingContents);
  const protectedModel = useMemo(() => {
    if (!model) return null;
    const runtime = runtimeRef.current;
    if (!runtime) return model;
    return protectFileModelForPendingClose(model, runtime.readCollection(), pendingContents);
  }, [model, pendingContents]);

  // VIEW-02 §5: while a File Empty tab is ACTIVE, host the accepted file-tree
  // drawer beside the generic empty-panel body so the drawer — the ONLY way
  // an Empty tab is filled — is actually reachable. This subsumes the old
  // reservation-pending case (a pending `file.open` reservation always lives
  // on an Empty tab). Collapsing the drawer unmounts the host and retires the
  // pending picker context (the drawer-close effect above); the Empty body's
  // dock control re-opens it. The host is a File-owned child of the shell
  // body (a flex sibling of the tab panel inside it); the drawer itself is
  // the existing component, unredesigned.
  const activeEmptyObserved = useActiveEmptyObservation(connectedEnabled, runtimeRef);
  const pickerHostActive = activeEmptyObserved && !drawerClosed;
  const drawerHostRef = useRef<DrawerHost | null>(null);
  useEffect(() => {
    if (!pickerHostActive) return undefined;
    const shellBody = document.querySelector<HTMLElement>(
      '.rv-panel[data-panel="file-viewer"].active .rv-component-tab-shell-body',
    );
    if (!shellBody) return undefined;
    const element = document.createElement('div');
    element.className = 'rv-file-connected-picker-layer';
    shellBody.appendChild(element);
    const root = createRoot(element);
    root.render(
      createElement(Suspense, { fallback: null }, createElement(LazyFilePickerDrawerLayer)),
    );
    drawerHostRef.current = { element, root };
    return () => {
      drawerHostRef.current = null;
      root.unmount();
      element.remove();
    };
  }, [pickerHostActive]);

  return protectedModel;
}

/**
 * Reactive predicate: the ACTIVE tab is an Empty tab. Re-evaluates on every
 * owner-driven model refresh (every activation, reservation, and collection
 * change produces a fresh adapter model through the acknowledged owner
 * commit), which is exactly the state this predicate reads.
 */
function useActiveEmptyObservation(
  connectedEnabled: boolean,
  runtimeRef: { current: ConnectedTabOwnerRuntime | null },
): boolean {
  if (!connectedEnabled) return false;
  const runtime = runtimeRef.current;
  if (!runtime) return false;
  const collection = runtime.readCollection();
  const active = collection.tabs.find((tab) => tab.tabId === collection.activeTabId);
  return active?.content.kind === 'empty';
}
