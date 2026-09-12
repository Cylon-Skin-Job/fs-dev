/**
 * @module captureViewTabAdapter
 * @role Capture view tab adapters (VIEW-02 Slices 2–3).
 *
 * Slice 3 makes Capture the FIRST production consumer of the generic tab host:
 * - `useCaptureConnectedAdapter` binds the connected owner runtime to
 *   `panelStore.viewStates['capture-viewer']` through
 *   `createCaptureConnectedOwnerPorts` (acknowledged `state:set` owner), runs
 *   the ONE-TIME classic-state conversion, and supplies the real home /
 *   document / bounded-unavailable presenters.
 * - `useCaptureAdapter` remains the legacy adapter (byte-for-byte behavior)
 *   for views without a ready `tabPolicies` entry.
 */

import { createElement, lazy, Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { getFileIcon } from '../../lib/file-utils';
import { usePanelStore } from '../../state/panelStore';
import type { DocViewerTab } from '../../types';
import type { TabPolicy } from '../../lib/tab-policy-projection';
import type { ViewTabAdapterModel } from './viewTabAdapters';
import type { ViewTabDescriptor } from './ViewTabStrip';
import { normalizeCaptureTabs } from './captureTabDomain';
import {
  activateCaptureTab,
  CAPTURE_PANEL,
  CAPTURE_TAB_LABEL,
  closeCaptureTab,
  getCaptureHandoffStatus,
  normalizeHydratedCaptureTabs,
  plusPressed,
  subscribeCaptureHandoff,
} from './captureTabsController';
import {
  type ConnectedTabOwnerRuntime,
} from './componentTabConnectedOwner';
import {
  readyTabPolicyFor,
  useConnectedComponentTabAdapter,
} from './componentTabConnectedAdapter';
import type { FirstPartyComponentRegistration } from './componentTabResolver';
// The real presenters carry view CSS; they load lazily so pure/spec consumers
// of the registry chain stay CSS-free.
const CaptureTiles = lazy(async () => ({ default: (await import('../capture/CaptureTiles')).CaptureTiles }));
const CaptureDocumentPresenter = lazy(async () => (
  { default: (await import('../capture/CaptureDocumentPresenter')).CaptureDocumentPresenter }
));
import {
  applyCaptureClassicConversionOnce,
  capturePostCloseEstablished,
  openCaptureDocumentFromPresenter,
  setActiveCaptureConnectedRuntime,
} from './captureConnectedTabs';
import {
  CAPTURE_DOCUMENT_PRESENTER_ID,
  CAPTURE_LANDING_COMPONENT_TYPE,
  CAPTURE_LANDING_PRESENTER_ID,
  CAPTURE_LANDING_TARGET_LABELS,
  CAPTURE_UNAVAILABLE_PRESENTER_ID,
} from './captureConnectedPresenterTargets';
import {
  createCaptureConnectedOwnerPorts,
  describeCaptureComponent,
} from './captureConnectedOwnerPorts';

export {
  CAPTURE_DOCUMENT_PRESENTER_ID,
  CAPTURE_HOME_TARGET_KEY,
  CAPTURE_LANDING_COMPONENT_TYPE,
  CAPTURE_LANDING_PRESENTER_ID,
} from './captureConnectedPresenterTargets';

/** Legacy Capture rail adapter (behavior preserved byte-for-byte). */
export function useCaptureAdapter(enabled: boolean): ReturnType<typeof useLegacyCaptureAdapter> {
  return useLegacyCaptureAdapter(enabled);
}

function useLegacyCaptureAdapter(enabled: boolean) {
  const rawTabs = usePanelStore((state) => state.viewStates[CAPTURE_PANEL]?.docViewerTabs);
  const rawActiveId = usePanelStore((state) => state.viewStates[CAPTURE_PANEL]?.docViewerActiveTabId);
  const captureIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === CAPTURE_PANEL)?.icon ?? 'note_stack'
  ));
  const hasHydratedTabs = rawTabs !== undefined;
  const hydrationFingerprint = JSON.stringify([rawTabs, rawActiveId]);
  const handoffStatus = useSyncExternalStore(
    subscribeCaptureHandoff,
    getCaptureHandoffStatus,
    getCaptureHandoffStatus,
  );

  useEffect(() => {
    if (enabled && hasHydratedTabs) normalizeHydratedCaptureTabs();
  }, [enabled, hasHydratedTabs, hydrationFingerprint]);

  return useMemo<ViewTabAdapterModel | null>(() => {
    if (!enabled) return null;
    const normalized = normalizeCaptureTabs(rawTabs, rawActiveId);
    const recoveryVisible = normalized.tabs.length === 1
      && normalized.tabs[0]?.kind === 'capture'
      && handoffStatus === 'failed';
    if ((normalized.tabs.length < 2 && !recoveryVisible) || !normalized.activeId) return null;
    const descriptors = normalized.tabs.map((tab: DocViewerTab): ViewTabDescriptor => {
      const isCapture = tab.kind === 'capture';
      return {
        id: tab.id,
        label: isCapture ? CAPTURE_TAB_LABEL : tab.name,
        icon: isCapture ? captureIcon : getFileIcon(tab.extension, tab.name),
        iconClassName: isCapture ? 'rv-view-tab-icon--view' : `file-icon-${tab.extension}`,
        closeLabel: isCapture ? 'Close capture view' : `Close ${tab.name}`,
        closable: true,
      };
    });
    return {
      panelId: CAPTURE_PANEL,
      label: 'Open captures',
      tabs: descriptors,
      activeId: normalized.activeId,
      tabPanelTabIndex: -1,
      onActivate: (id) => { activateCaptureTab(id); },
      onClose: closeCaptureTab,
      add: recoveryVisible ? undefined : { label: 'New capture view', onAdd: plusPressed },
    };
  }, [captureIcon, enabled, handoffStatus, rawActiveId, rawTabs]);
}

/** Code-owned Capture landing presenter identity (SPEC-02 §9). */
export const CAPTURE_LANDING_TARGET_LOCATION = CAPTURE_LANDING_TARGET_LABELS;

// The launcher binding and display contract live in the CSS-free ports module
// so pure/spec consumers can bind them without the presentation tree.
export {
  createCaptureHomeLauncherBinding,
  describeCaptureComponent,
} from './captureConnectedOwnerPorts';

function documentPresenterInput(value: unknown): {
  path: string;
  name: string;
} | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as { [key: string]: unknown };
  if (typeof record.path !== 'string' || !record.path
    || record.path.length > 1024
    || record.path.startsWith('/')
    || record.path.includes('\\')
    || record.path.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }
  if (typeof record.name !== 'string' || !record.name || record.name.length > 1024) return null;
  return { path: record.path, name: record.name };
}

/**
 * First-party registrations for the adopted Capture presenters. The home
 * target renders the EXISTING Capture landing content (the classic grid /
 * landing projection) — store-connected here at the connected-host layer;
 * the presentation components themselves stay unchanged.
 */
export function captureConnectedPresenterRegistrations(): readonly FirstPartyComponentRegistration[] {
  return [
    {
      componentTypeId: CAPTURE_LANDING_COMPONENT_TYPE,
      label: 'Capture Home',
      render: () => createElement(
        'section',
        { 'data-capture-landing': true, 'data-presenter-id': CAPTURE_LANDING_PRESENTER_ID },
        // VIEW-02 §4.3: the landing presenter is dumb — its single open
        // handler is supplied here by the connected layer (the disposition
        // policy lives in `openCaptureDocumentFromPresenter`).
        createElement(
          Suspense,
          { fallback: null },
          createElement(CaptureTiles, { onOpenDocument: openCaptureDocumentFromPresenter }),
        ),
      ),
    },
    {
      componentTypeId: CAPTURE_DOCUMENT_PRESENTER_ID,
      label: 'Capture document',
      render: ({ descriptor }) => {
        const targetKey = descriptor.targetKey;
        const input = documentPresenterInput(descriptor.input);
        if (!targetKey || !input) {
          return boundedUnavailableSurface();
        }
        return createElement(
          Suspense,
          { fallback: null },
          createElement(CaptureDocumentPresenter, { targetKey, input }),
        );
      },
    },
    {
      componentTypeId: CAPTURE_UNAVAILABLE_PRESENTER_ID,
      label: 'Capture document unavailable',
      render: () => boundedUnavailableSurface(),
    },
  ];
}

function boundedUnavailableSurface() {
  return createElement(
    'section',
    {
      className: 'rv-capture-tab-unavailable',
      role: 'status',
      'data-capture-unavailable': true,
    },
    createElement(
      'p',
      { className: 'rv-capture-tab-unavailable-message' },
      'This Capture document state could not be reopened. The view stays usable.',
    ),
  );
}

const CAPTURE_CONNECTED_REGISTRATIONS = captureConnectedPresenterRegistrations();

/**
 * Stand-in policy used ONLY while the connected path is disabled (no ready
 * policy); it is never read by the owner runtime in that state.
 */
const CAPTURE_STANDIN_POLICY: TabPolicy = {
  schemaVersion: 1,
  initial: { kind: 'empty' },
  plus: { enabled: true },
  empty: { tabLabel: 'New Capture Tab', locationLabel: 'New Capture Tab', launcherIds: ['capture.home'] },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned Capture values (owner-confirmed 2026-09-10).
  newTab: { blankKind: 'home', autoOpenDrawer: false },
};

/**
 * Capture connected adapter: policy-gated production adoption. Returns null
 * when the connected path is not engaged (no ready policy) or the connected
 * collection is truly empty (the classic surface beneath is the established
 * owner lifecycle).
 */
export function useCaptureConnectedAdapter(enabled: boolean): ViewTabAdapterModel | null {
  const policy = usePanelStore((state) => readyTabPolicyFor(state.tabPolicies, CAPTURE_PANEL));
  const workspaceId = usePanelStore((state) => state.activeWorkspaceId);
  const viewIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === CAPTURE_PANEL)?.icon ?? 'note_stack'
  ));
  // Post-close guard (SPEC-02 §6): a present, empty records document with no
  // surviving legacy tabs is an ESTABLISHED post-close collection — the
  // connected surface (and with it the initial-policy reinit) stays off until
  // the established owner lifecycle re-enters (legacy tabs normalize once).
  const viewState = usePanelStore((state) => state.viewStates[CAPTURE_PANEL]);
  const postCloseEstablished = capturePostCloseEstablished(viewState);
  // VIEW-02 §9 hydration reconciliation: the initial policy (and with it the
  // session blank) waits until the persisted view-state document has landed
  // (a `state:get` response settles the marker) AND is not still in flight —
  // so the one-time conversion sees the persisted classic tabs and the blank
  // is never created (or persisted) ahead of them. Local-only writers (e.g.
  // the layout fetch) do not open the gate while a load is pending.
  const initialGateOpen = usePanelStore((state) => (
    state.viewStates[CAPTURE_PANEL] !== undefined
    && !state.viewStateLoadPending[CAPTURE_PANEL]
  ));
  const legacyTabCount = usePanelStore(
    (state) => state.viewStates[CAPTURE_PANEL]?.docViewerTabs?.length ?? 0,
  );
  const runtimeRef = useRef<ConnectedTabOwnerRuntime | null>(null);

  const ownerPorts = useMemo(
    () => createCaptureConnectedOwnerPorts({ workspaceId }),
    [workspaceId],
  );

  const runtimeKey = workspaceId ?? '__capture-no-workspace__';
  const connectedEnabled = enabled && policy !== null && !postCloseEstablished;

  // Register the runtime for view-side entry points (placement from
  // CaptureTiles, document presenter actions, path rewrites). I-11: every
  // mounted panel renders this adapter with `enabled: false`; a disabled
  // instance must never clear the module registration slot — only the
  // enabled instance owns it (last-writer-wins otherwise breaks every
  // panel mounted after an enabled one).
  useEffect(() => {
    if (!connectedEnabled) return undefined;
    setActiveCaptureConnectedRuntime(runtimeRef.current, workspaceId);
    return () => {
      setActiveCaptureConnectedRuntime(null, null);
    };
  }, [connectedEnabled, runtimeKey, workspaceId]);

  // ONE-TIME classic-state conversion, serialized in the owner intent lane
  // BEFORE the connected adapter's initial policy effect (hook effect order).
  // Re-armed by legacy-tab presence so tabs created through the established
  // classic lifecycle after a close normalize once into the records.
  useEffect(() => {
    if (!connectedEnabled && legacyTabCount === 0) return;
    let canceled = false;
    void runtimeRef.current?.runIntent(() => {
      if (canceled) return;
      applyCaptureClassicConversionOnce(ownerPorts);
    });
    return () => { canceled = true; };
  }, [connectedEnabled, runtimeKey, ownerPorts, legacyTabCount]);

  return useConnectedComponentTabAdapter({
    enabled: connectedEnabled,
    panelId: CAPTURE_PANEL,
    label: 'Open captures',
    viewIcon,
    plusLabel: 'New capture tab',
    policy: policy ?? CAPTURE_STANDIN_POLICY,
    runtimeKey,
    ownerPorts,
    registrations: CAPTURE_CONNECTED_REGISTRATIONS,
    describeComponent: describeCaptureComponent,
    initialGateOpen,
    runtimeRef,
  });
}
