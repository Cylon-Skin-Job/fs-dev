/**
 * @module componentTabConnectedAdapter
 * @role React glue that projects one connected tab owner into the public
 *       `ViewTabBar` adapter model (SPEC-02 §7/§8).
 *
 * Presentation components stay props-only: this hook composes the
 * `ViewTabContentAdapter` and rail model from the connected owner runtime and
 * the ready tab policy. It imports no Capture/File store — the owner ports are
 * supplied by the connected view modules (Slices 3/4 bind the real stores).
 *
 * Activation gate (SPEC-02 §4): the connected content projection is supplied
 * ONLY for a ready `tabPolicies` entry. Absent or unavailable policy means
 * legacy behavior. In this slice, an unavailable policy deliberately maps to
 * legacy too; the bounded unavailable surface with no launch actions is the
 * Slice 3/4 production behavior.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { TabPolicy, TabPolicyProjection } from '../../lib/tab-policy-projection';
import {
  COMPONENT_TAB_PRESENTATION_LIMITS,
  type ComponentTabShellProjection,
  type TabBreadcrumbSegment,
} from './componentTabPresentationDomain';
import { projectTabLocationDisplaySegments } from './componentTabLocationPolicy';
import { findComponentTabLauncherCatalogEntry } from './componentTabLauncherCatalog';
import {
  createConnectedTabOwner,
  type ConnectedTabDescriber,
  type ConnectedTabDisplayProjection,
  type ConnectedTabOwnerRuntime,
  type ConnectedTabOwnerPorts,
} from './componentTabConnectedOwner';
import { createFirstPartyComponentResolver } from './componentTabResolver';
import type { FirstPartyComponentRegistration } from './componentTabResolver';
import type {
  ComponentDescriptor,
  ComponentTabCollectionState,
  TabContentDescriptor,
} from './componentTabTypes';
import type { ViewTabContentAdapter } from './viewTabContentAdapter';
import type { ViewTabDescriptor } from './ViewTabStrip';
import type { ViewTabAdapterModel } from './viewTabAdapters';

/** Code-owned display projection for one committed component descriptor. */
export interface ConnectedComponentTabDisplay {
  label: string;
  locationLabels: readonly string[];
  icon?: string;
  iconClassName?: string;
}

export type ConnectedComponentTabDescriber = (
  component: ComponentDescriptor,
) => ConnectedComponentTabDisplay | null;

function isBoundedDisplayText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes
    && value.trim() === value
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    });
}

/**
 * Default code-owned component display contract: the descriptor input carries
 * `title` (tab label) and `locationLabels` (ordered segments). Extra
 * presenter-specific input fields are allowed and ignored here.
 */
export function describeComponentFromInputContract(
  component: ComponentDescriptor,
): ConnectedComponentTabDisplay | null {
  const input = component.input;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const record = input as { [key: string]: unknown };
  const title = record.title;
  const locationLabels = record.locationLabels;
  const icon = record.icon;
  if (!isBoundedDisplayText(title)) return null;
  if (!Array.isArray(locationLabels)
    || locationLabels.length === 0
    || locationLabels.length > COMPONENT_TAB_PRESENTATION_LIMITS.maxLocationSegments
    || !locationLabels.every((label) => isBoundedDisplayText(label))) {
    return null;
  }
  const safeIcon = isBoundedDisplayText(icon) ? icon : undefined;
  return {
    label: title,
    locationLabels: Object.freeze([...locationLabels as string[]]),
    ...(safeIcon ? { icon: safeIcon } : {}),
  };
}

function locationProjection(
  segments: readonly TabBreadcrumbSegment[],
): ComponentTabShellProjection['location'] {
  return {
    schemaVersion: 1,
    segments: segments as [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]],
  };
}

/** Builds the policy-driven describer used for rail descriptors, shells, and placement snapshots. */
export function createConnectedTabDescriber(options: {
  policy: TabPolicy;
  viewIcon: string;
  describeComponent: ConnectedComponentTabDescriber;
}): ConnectedTabDescriber {
  return (tabId: string, content: TabContentDescriptor): ConnectedTabDisplayProjection | null => {
    if (content.kind === 'empty') {
      return {
        tab: {
          id: tabId,
          label: options.policy.empty.tabLabel,
          icon: options.viewIcon,
          iconClassName: 'rv-view-tab-icon--view',
          closeLabel: `Close ${options.policy.empty.tabLabel}`,
          closable: true,
        },
        shell: {
          schemaVersion: 2,
          tabId,
          presenterId: null,
          location: locationProjection([{ label: options.policy.empty.locationLabel }]),
        },
      };
    }
    const display = options.describeComponent(content.component);
    if (!display) return null;
    const segments = projectTabLocationDisplaySegments(
      display.locationLabels.map((label) => ({ label })),
      options.policy.location.omitTerminalNames,
    );
    return {
      tab: {
        id: tabId,
        label: display.label,
        icon: display.icon ?? options.viewIcon,
        ...(display.iconClassName ? { iconClassName: display.iconClassName } : {}),
        closeLabel: `Close ${display.label}`,
        closable: true,
      },
      shell: {
        schemaVersion: 2,
        tabId,
        presenterId: content.component.componentTypeId,
        location: locationProjection(segments),
      },
    };
  };
}

/**
 * Activation gate: the ready policy for one view, or null for legacy behavior.
 * `unavailable` maps to legacy in this slice (bounded unavailable surface is
 * the Slice 3/4 production behavior). An initial launcher must also be
 * offered by the empty-tab launcher set: the initial-policy reservation
 * lifecycle runs through the offered (catalog-bound) launcher set only.
 */
export function readyTabPolicyFor(
  policies: TabPolicyProjection | null | undefined,
  viewId: string,
): TabPolicy | null {
  const entry = policies?.[viewId];
  if (!entry || entry.status !== 'ready') return null;
  const { initial, empty } = entry.policy;
  if (initial.kind === 'launcher' && !empty.launcherIds.includes(initial.launcherId)) {
    return null;
  }
  return entry.policy;
}

export interface ConnectedComponentTabAdapterConfig {
  enabled: boolean;
  panelId: string;
  /** Rail accessibility label (product vocabulary, e.g. "Open captures"). */
  label: string;
  viewIcon: string;
  plusLabel: string;
  /** Ready policy only (see `readyTabPolicyFor`). */
  policy: TabPolicy;
  /** Owner identity: changes across workspace switches, retiring the old runtime. */
  runtimeKey: string;
  /** Stable per `runtimeKey`. */
  ownerPorts: Omit<ConnectedTabOwnerPorts, 'describeTab' | 'launcherFor'> & {
    launcherFor?: ConnectedTabOwnerPorts['launcherFor'];
  };
  registrations: readonly FirstPartyComponentRegistration[];
  describeComponent?: ConnectedComponentTabDescriber;
  /**
   * VIEW-02 §6: optional view-supplied Empty-body presenter (bounded, from
   * the connected owner layer — analogous to first-party component
   * registrations). The generic Empty surface renders its error-bounded
   * result; without it an Empty tab shows the minimal neutral surface
   * (no launcher menu).
   */
  renderEmptyBody?: ViewTabContentAdapter['renderEmptyBody'];
  /**
   * Receives the owner runtime so view controllers outside this hook (e.g. the
   * Slice 4 file-selection path) can use the same serialized intent lane.
   */
  runtimeRef?: { current: ConnectedTabOwnerRuntime | null };
  /**
   * VIEW-02 §9 hydration reconciliation: when supplied as false, the persisted
   * per-view state document has not landed yet (async `state:get` in flight or
   * unanswered). The initial-policy effect WAITS — a session blank must never
   * be created (or persisted) before the persisted tabs arrive, or the
   * one-time conversion would see it as established generic state and the
   * user's classic tabs would be silently stranded (the verified 6→1 reset).
   * Absent/undefined keeps the ungated (mount-time) behavior for pure/spec
   * consumers.
   */
  initialGateOpen?: boolean;
}

function describerFor(config: ConnectedComponentTabAdapterConfig): ConnectedTabDescriber {
  return createConnectedTabDescriber({
    policy: config.policy,
    viewIcon: config.viewIcon,
    describeComponent: config.describeComponent ?? describeComponentFromInputContract,
  });
}

function buildConnectedTabAdapterModel(
  runtime: ConnectedTabOwnerRuntime,
  describer: ConnectedTabDescriber,
  config: ConnectedComponentTabAdapterConfig,
  collection: ComponentTabCollectionState,
): ViewTabAdapterModel | null {
  if (collection.tabs.length === 0 || !collection.activeTabId) return null;
  const active = collection.tabs.find((tab) => tab.tabId === collection.activeTabId);
  if (!active) return null;
  const tabs: ViewTabDescriptor[] = [];
  let activeShell: ComponentTabShellProjection | null = null;
  for (const tab of collection.tabs) {
    const described = describer(tab.tabId, tab.content);
    if (!described) return null; // fail closed: an undescribable record has no connected surface
    tabs.push(described.tab);
    if (tab.tabId === active.tabId) activeShell = described.shell;
  }
  if (!activeShell) return null;
  // VIEW-02 §6: the launcher grid is retired — no launcher items are offered
  // on the Empty surface. The reserved launcher's catalog label survives only
  // as bounded pending/retry copy for the initial-policy reservation
  // lifecycle (generically rendered by the generic Empty panel).
  const reservation = collection.reservations.find(
    (candidate) => candidate.tabId === active.tabId,
  ) ?? null;
  const reservationLabel = reservation
    ? findComponentTabLauncherCatalogEntry(reservation.launcherId, config.ownerPorts.viewId)?.label
    : undefined;
  const content: ViewTabContentAdapter = {
    active,
    shell: activeShell,
    reservation,
    ...(reservationLabel ? { reservationLabel } : {}),
    ...(config.renderEmptyBody ? { renderEmptyBody: config.renderEmptyBody } : {}),
    resolve: createFirstPartyComponentResolver(config.registrations),
    // Stale or failed owner transitions reject as bounded no-ops (the owner
    // write did not land); the surface refreshes on the next owner
    // notification, so the shell callbacks never surface a rejection.
    retryLauncher: (tabId) => {
      runtime.retryTab(tabId).catch(() => undefined);
    },
    cancelLauncher: (tabId) => {
      runtime.cancelTab(tabId).catch(() => undefined);
    },
  };
  return {
    panelId: config.panelId,
    label: config.label,
    tabs,
    activeId: collection.activeTabId,
    tabPanelTabIndex: -1,
    onActivate: (id) => { runtime.activateTab(id); },
    onClose: (id) => { runtime.closeTab(id); },
    add: config.policy.plus.enabled
      ? {
        label: config.plusLabel,
        onAdd: () => {
          // VIEW-02 §4: the + button is dumb and deterministic and never
          // opens menus/pickers. The whole contract (no-op on the view's
          // Home/Empty tab; create-or-recenter the configured blank on a
          // Document tab) runs inside the owner's serialized intent lane.
          // Always returning null keeps strip focus on the button (existing
          // behavior for null), including for the bounded no-op outcomes.
          void runtime.createOrRecenterBlank(config.policy.newTab.blankKind).catch(() => undefined);
          return null;
        },
      }
      : undefined,
    content,
  };
}

/**
 * Connected adapter hook: one runtime per `runtimeKey` (workspace switch
 * retires the previous runtime and stale-aborts its async work), initial
 * policy applied once from an effect (rendering never calls a launcher), and
 * the model re-derived through `useSyncExternalStore` on owner notifications.
 */
export function useConnectedComponentTabAdapter(
  config: ConnectedComponentTabAdapterConfig,
): ViewTabAdapterModel | null {
  const configRef = useRef(config);
  configRef.current = config;

  const runtime = useMemo(() => {
    // Policy and view presentation are read through `configRef` so a policy
    // refresh never forks the owner runtime or its describer.
    const describer: ConnectedTabDescriber = (tabId, content) => (
      describerFor(configRef.current)(tabId, content)
    );
    const offeredLauncherFor: ConnectedTabOwnerPorts['launcherFor'] = (launcherId) => {
      const current = configRef.current;
      if (!current.policy.empty.launcherIds.includes(launcherId)) return null;
      return current.ownerPorts.launcherFor?.(launcherId) ?? null;
    };
    return createConnectedTabOwner({
      ...configRef.current.ownerPorts,
      launcherFor: offeredLauncherFor,
      describeTab: describer,
    });
    // Runtime lifetime is bound to the owner identity (workspace + view), not
    // to per-render config objects; `ownerPorts` behavior must stay stable
    // per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.runtimeKey]);

  if (config.runtimeRef) config.runtimeRef.current = runtime;

  useEffect(() => () => { runtime.retire(); }, [runtime]);

  useEffect(() => {
    if (!config.enabled) return;
    // VIEW-02 §9: hold the initial policy until the persisted view state has
    // landed (see `initialGateOpen`). The dedupe+initial normalization then
    // runs when hydration lands — not only once at mount (S3 advisory A1).
    if (config.initialGateOpen === false) return;
    // An unbound initial launcher degrades to a plain Empty tab (product-safe,
    // no reservation) instead of creating a reservation the surface cannot show.
    const initial = config.policy.initial;
    // VIEW-02 §9: the configured blank kind rides the initial turn so the
    // post-hydration/post-conversion dedupe normalization runs once, before
    // the initial policy (hydrated records always win over it).
    const blankKind = config.policy.newTab.blankKind;
    if (initial.kind === 'launcher') {
      const binding = config.ownerPorts.launcherFor?.(initial.launcherId) ?? null;
      if (!binding) {
        void runtime.ensureInitial({ kind: 'empty' }, blankKind);
        return;
      }
    }
    void runtime.ensureInitial(initial, blankKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, config.enabled, config.policy, config.initialGateOpen]);

  const cacheRef = useRef<{
    collection: ComponentTabCollectionState | null;
    policy: TabPolicy | null;
    model: ViewTabAdapterModel | null;
  }>({ collection: null, policy: null, model: null });

  const getModel = useCallback(() => {
    const current = configRef.current;
    if (!current.enabled) return null;
    const collection = runtime.readCollection();
    const cache = cacheRef.current;
    if (cache.collection !== collection || cache.policy !== current.policy) {
      cache.collection = collection;
      cache.policy = current.policy;
      cache.model = buildConnectedTabAdapterModel(
        runtime,
        describerFor(current),
        current,
        collection,
      );
    }
    return cache.model;
  }, [runtime]);

  const subscribe = useCallback(
    (listener: () => void) => runtime.subscribe(listener),
    [runtime],
  );

  return useSyncExternalStore(subscribe, getModel, getModel);
}
