/**
 * @module componentTabConnectedOwner
 * @role Shared store-free machinery for VIEW-02 connected tab owners
 *       (SPEC-02 §5/§6/§8, VRT-011, VRT-011A, VRT-012, VRT-013).
 *
 * This module owns NO tab state and imports NO view store. A connected owner
 * (Capture via `panelStore.viewStates['capture-viewer']`, File Explorer via its
 * file stores — Slices 3/4 bind the real owners) supplies:
 *   - one fresh translation of its existing state into generic records
 *     (`readCollection`), without changing identity semantics;
 *   - ONE atomic acknowledged owner transition (`applyCollection`);
 *   - currency (`isCurrent`) and id factories.
 *
 * The runtime built here provides:
 *   - the TABS-03 snapshot/commit ports using the accepted
 *     `captureTabPlacementSnapshot` / `isExactTabPlacementSnapshot` observation
 *     machinery (committed only when a fresh owner read exactly matches the
 *     planned snapshot; otherwise rejected with prior state intact);
 *   - one per-owner intent lane serializing placement decisions, picker
 *     preparation, and reservation lifecycle intents;
 *   - the Empty-tab launcher lifecycle (reserve → launch → validate →
 *     commit/fail) with stale-abort across workspace switch/retire;
 *   - the singleton File-picker context (exactly one per connected
 *     `{workspaceId, viewId}` owner) with atomic prior-reservation replacement;
 *   - initial/plus policy behavior (VRT-011: initial launcher uses the same
 *     reservation contract; plus only creates one Empty tab).
 *
 * This is instance-local connected-owner machinery, not a second tab store and
 * not a durable schema.
 */

import type { TabPolicyInitial, TabPolicyNewTab } from '../../lib/tab-policy-projection';
import type { ComponentTabShellProjection } from './componentTabPresentationDomain';
import {
  cancelEmptyTabReservation,
  closeComponentTab,
  commitEmptyTabFill,
  createEmptyTab,
  dedupeConfiguredBlankTabs,
  failEmptyTabReservation,
  reserveEmptyTab,
  retryEmptyTabReservation,
} from './componentTabLifecycle';
import {
  captureTabPlacementSnapshot,
  isExactTabPlacementSnapshot,
} from './componentTabPlacementSnapshotComparison';
import { createConnectedTabPlacementController } from './componentTabPlacementController';
import type {
  ResolvedTabPlacementTarget,
  TabPlacementCommitAcknowledgement,
  TabPlacementCommitRequest,
  TabPlacementController,
  TabPlacementRequest,
  TabPlacementResult,
  TabPlacementSnapshot,
  TabPlacementSnapshotRecord,
  TabPlacementTargetRef,
} from './componentTabPlacementTypes';
import type {
  ComponentTabCollectionState,
  ComponentTabIdFactory,
  ReservationIdentity,
  TabContentDescriptor,
} from './componentTabTypes';
import { COMPONENT_TAB_LIMITS, } from './componentTabTypes';
import { validateTabContentDescriptor } from './componentTabValidation';
import type { ViewTabDescriptor } from './ViewTabStrip';
import type {
  ConnectedTabLauncherBinding,
  ConnectedTabLauncherOutcome,
} from './componentTabLauncherBinding';

export type {
  ConnectedTabLaunchContext,
  ConnectedTabLauncher,
  ConnectedTabLauncherBinding,
  ConnectedTabLauncherOutcome,
} from './componentTabLauncherBinding';
export { bindCatalogLaunchers } from './componentTabLauncherBinding';

/** Per-tab presentation slots derived by the connected owner's code-owned describer. */
export interface ConnectedTabDisplayProjection {
  tab: ViewTabDescriptor;
  shell: ComponentTabShellProjection;
}

export type ConnectedTabDescriber = (
  tabId: string,
  content: TabContentDescriptor,
) => ConnectedTabDisplayProjection | null;

export interface ConnectedTabOwnerPorts {
  /** Fresh translation of the owner's current state into generic records. */
  readCollection: () => ComponentTabCollectionState;
  /** ONE atomic acknowledged owner transition writing the whole next state. */
  applyCollection: (next: ComponentTabCollectionState) => void;
  /** Owner change notifications (established store subscription). */
  subscribe: (listener: () => void) => () => void;
  /** False once the workspace switched or the owner retired. */
  isCurrent: () => boolean;
  workspaceId: string | null;
  viewId: string;
  mintTabId: ComponentTabIdFactory;
  mintOperationId: ComponentTabIdFactory;
  mintComponentInstanceId: ComponentTabIdFactory;
  describeTab: ConnectedTabDescriber;
  /** Catalog-bound launcher lookup for THIS view; null = unknown/wrong-view/unbound. */
  launcherFor: (launcherId: string) => ConnectedTabLauncherBinding | null;
  /** Code-owned target resolution for TABS-03 placement (Slices 3/4 production). */
  resolvePlacementTarget: (target: TabPlacementTargetRef) => ResolvedTabPlacementTarget | null;
  /**
   * VIEW-02 §4 blank capability: the placement target of this view's HOME tab
   * (the component tab rendering the view's home presenter), or null/absent
   * for views whose blank is the generic Empty tab (no Home kind). Supplied by
   * the view's owner ports; the runtime implements the policy-driven plus
   * contract generically from it.
   */
  blankPlacementTarget?: () => TabPlacementTargetRef | null;
  /**
   * VIEW-02 §7 observation: invoked (inside the serialized intent turn,
   * only when `current()`) after an Empty tab is CREATED in this session —
   * the initial-policy creation, the plus-contract blank creation, and the
   * raw bounded creation. Hydrated Empty tabs are not "created" this session
   * and never invoke it. Views use this to drive per-view new-tab behavior
   * (e.g. File's `autoOpenDrawer`); the runtime itself stays store-free.
   */
  onEmptyTabCreated?: (tabId: string) => void;
  revealPlacement?: (request: {
    tabId: string;
    componentInstanceId: string;
    presenterId: string;
    targetKey: string;
  }) => void | Promise<void>;
}

export type PickerPreparationResult = 'ok' | 'stale_completion';

/** VIEW-02 §4 plus outcome. `recentered` includes both activate-only and activate+reveal. */
export type ConnectedBlankOutcome = 'noop' | 'created' | 'recentered';

/**
 * Raw owner operations available INSIDE one serialized intent turn. Composing
 * several operations through one turn (e.g. VRT-011A picker preparation and the
 * following TABS-03 `current` call) keeps them in one lane turn, so no other
 * intent can interleave between them.
 */
export interface ConnectedOwnerIntentTurn {
  place: (request: TabPlacementRequest) => Promise<TabPlacementResult>;
  preparePickerSelection: (identity: ReservationIdentity) => PickerPreparationResult;
  createEmptyTab: () => string | null;
  /**
   * VIEW-02 §4 plus contract, serialized in this lane: no-op when the active
   * tab is the view's Home or an Empty tab; otherwise create the configured
   * blank (`blankKind`) or recenter the existing one.
   */
  createOrRecenterBlank: (blankKind: TabPolicyNewTab['blankKind']) => Promise<ConnectedBlankOutcome>;
  activateTab: (tabId: string) => boolean;
  closeTab: (tabId: string) => boolean;
  beginLaunch: (tabId: string, launcherId: string) => void;
}

export interface ConnectedTabOwnerRuntime {
  readonly viewId: string;
  readonly workspaceId: string | null;
  subscribe: (listener: () => void) => () => void;
  readCollection: () => ComponentTabCollectionState;
  /** TABS-03 read port: the placement snapshot for the current owner state. */
  buildSnapshot: () => TabPlacementSnapshot | null;
  /** TABS-03 commit port: atomic acknowledged commit with fresh-read verification. */
  commit: (request: TabPlacementCommitRequest) => TabPlacementCommitAcknowledgement;
  /** TABS-03 placement, serialized through the owner intent lane. */
  place: (request: TabPlacementRequest) => Promise<TabPlacementResult>;
  /**
   * Serializes one intent turn for this connected owner. The turn callback
   * receives the raw `ConnectedOwnerIntentTurn` operations; public convenience
   * methods below are single-operation turns. Never call the public methods
   * from inside an intent — use the turn operations instead.
   */
  runIntent: <T>(intent: (turn: ConnectedOwnerIntentTurn) => T | Promise<T>) => Promise<T>;
  /** Plus behavior: creates and activates exactly one Empty tab (bounded). */
  createEmptyTab: () => string | null;
  /**
   * VIEW-02 §4 plus contract, serialized in the owner intent lane: the active
   * tab being the view's Home or an Empty tab is a bounded no-op; otherwise
   * the configured blank (`blankKind`) is created — or recentered (activated,
   * and revealed for a Home blank) when this view already holds one. A view
   * never holds two blanks through this path.
   */
  createOrRecenterBlank: (blankKind: TabPolicyNewTab['blankKind']) => Promise<ConnectedBlankOutcome>;
  /** Ordinary focus change; never clears the picker context. */
  activateTab: (tabId: string) => boolean;
  /** Closes one tab; a picker destination close retires the pending picker. */
  closeTab: (tabId: string) => boolean;
  /** Reserve → launch → validate → commit/fail for one Empty tab. */
  launchInTab: (tabId: string, launcherId: string) => Promise<void>;
  /** Re-runs a failed reservation's launcher. */
  retryTab: (tabId: string) => Promise<void>;
  /** Clears one tab's reservation (pending UI Cancel). */
  cancelTab: (tabId: string) => Promise<void>;
  /**
   * First initialization with no hydrated tabs (SPEC-02 §6). When `blankKind`
   * is supplied, ONE bounded idempotent normalization first enforces the §9
   * per-view blank-kind dedupe after hydration/conversion (hydrated records
   * always win over the initial policy; a valid lone sentinel is never eaten).
   */
  ensureInitial: (initial: TabPolicyInitial, blankKind?: TabPolicyNewTab['blankKind']) => Promise<void>;
  pickerCurrent: () => ReservationIdentity | null;
  /** §5 picker-selection preparation transition, serialized with placement. */
  preparePickerSelection: (identity: ReservationIdentity) => Promise<PickerPreparationResult>;
  /** Drawer close / disconnect: clears the exact context and its reservation. */
  clearPickerContext: () => void;
  /** Workspace switch / disconnect / owner retirement: stale-aborts all async work. */
  retire: () => void;
}

function reservationIdentity(reservation: ReservationIdentity): ReservationIdentity {
  return {
    tabId: reservation.tabId,
    operationId: reservation.operationId,
    expectedRevision: reservation.expectedRevision,
  };
}

function sameIdentity(left: ReservationIdentity, right: ReservationIdentity): boolean {
  return left.tabId === right.tabId
    && left.operationId === right.operationId
    && left.expectedRevision === right.expectedRevision;
}

/** Maps one placement snapshot back into generic collection records (validated). */
export function collectionFromPlacementSnapshot(
  snapshot: TabPlacementSnapshot,
): ComponentTabCollectionState | null {
  const tabs: Array<{ tabId: string; content: TabContentDescriptor }> = [];
  for (const record of snapshot.tabs) {
    const content = validateTabContentDescriptor(record.content);
    if (!content.ok) return null;
    tabs.push({ tabId: record.tabId, content: content.value });
  }
  return {
    tabs,
    activeTabId: snapshot.activeTabId,
    reservations: snapshot.reservations,
  };
}

/** Creates one connected-owner runtime. One instance per `{workspaceId, viewId}` owner. */
export function createConnectedTabOwner(ports: ConnectedTabOwnerPorts): ConnectedTabOwnerRuntime {
  let retired = false;
  let generation = 0;
  let initialApplied = false;
  let lane: Promise<unknown> = Promise.resolve();
  let pickerContext: (ReservationIdentity & { launcherId: string }) | null = null;

  function current(): boolean {
    return !retired && ports.isCurrent();
  }

  /** One owner intent lane: short turns; async continuations re-enter the lane. */
  function runIntent<T>(intent: (turn: ConnectedOwnerIntentTurn) => T | Promise<T>): Promise<T> {
    const result = lane.then(() => intent(turn), () => intent(turn));
    lane = result.then(
      () => undefined,
      () => undefined,
    );
    return result as Promise<T>;
  }

  function apply(next: ComponentTabCollectionState): void {
    ports.applyCollection(next);
  }

  function buildSnapshot(): TabPlacementSnapshot | null {
    try {
      const collection = ports.readCollection();
      const records: TabPlacementSnapshotRecord[] = [];
      for (const tab of collection.tabs) {
        const described = ports.describeTab(tab.tabId, tab.content);
        if (!described) return null;
        records.push({
          tabId: tab.tabId,
          content: tab.content,
          tab: described.tab,
          shell: described.shell,
        });
      }
      return {
        schemaVersion: 1,
        tabs: records,
        activeTabId: collection.activeTabId,
        reservations: collection.reservations,
      };
    } catch {
      return null;
    }
  }

  /** TABS-03 commit: committed only when a fresh owner read exactly matches the plan. */
  function commit(request: TabPlacementCommitRequest): TabPlacementCommitAcknowledgement {
    const rejected = (): TabPlacementCommitAcknowledgement => ({
      schemaVersion: 1,
      status: 'rejected',
      snapshot: request.priorSnapshot,
    });
    if (!current()) return rejected();
    const expectedPrior = captureTabPlacementSnapshot(request.priorSnapshot);
    const expectedNext = captureTabPlacementSnapshot(request.nextSnapshot);
    if (!expectedPrior || !expectedNext) return rejected();
    const observedPrior = buildSnapshot();
    if (!observedPrior || !isExactTabPlacementSnapshot(expectedPrior, observedPrior)) {
      return rejected();
    }
    const nextCollection = collectionFromPlacementSnapshot(request.nextSnapshot);
    if (!nextCollection) return rejected();
    try {
      apply(nextCollection);
    } catch {
      return rejected();
    }
    const observedNext = buildSnapshot();
    if (!observedNext || !isExactTabPlacementSnapshot(expectedNext, observedNext)) {
      return rejected();
    }
    return { schemaVersion: 1, status: 'committed', snapshot: request.nextSnapshot };
  }

  const placementController: TabPlacementController = createConnectedTabPlacementController({
    readSnapshot: () => {
      const snapshot = buildSnapshot();
      if (!snapshot) throw new Error('Connected owner snapshot is unavailable.');
      return snapshot;
    },
    resolveTarget: (target) => ports.resolvePlacementTarget(target),
    mintTabId: ports.mintTabId,
    mintComponentInstanceId: ports.mintComponentInstanceId,
    commit,
    ...(ports.revealPlacement ? { reveal: ports.revealPlacement } : {}),
  });

  function placement(request: TabPlacementRequest): Promise<TabPlacementResult> {
    if (!current()) {
      return Promise.resolve({
        schemaVersion: 1,
        ok: false as const,
        requestId: request.requestId,
        code: 'state_commit_failed' as const,
        message: 'The connected owner is no longer current.',
      });
    }
    return placementController.place(request);
  }

  function failReservation(identity: ReservationIdentity, error: unknown): void {
    const fresh = ports.readCollection();
    const failed = failEmptyTabReservation(fresh, identity, error);
    if (failed.ok && failed.state !== fresh) apply(failed.state);
  }

  /** One transition: retires any prior picker context and binds the new identity. */
  function replacePickerContext(identity: ReservationIdentity, launcherId: string): void {
    const prior = pickerContext;
    pickerContext = { ...identity, launcherId };
    if (!prior || sameIdentity(prior, identity)) return;
    const fresh = ports.readCollection();
    const priorReservation = fresh.reservations.find((candidate) => (
      candidate.tabId === prior.tabId
      && candidate.operationId === prior.operationId
      && candidate.status === 'pending'
    ));
    if (!priorReservation) return;
    const canceled = cancelEmptyTabReservation(fresh, reservationIdentity(priorReservation));
    if (canceled.ok && canceled.state !== fresh) apply(canceled.state);
  }

  function cancelReservationForContext(prior: ReservationIdentity): void {
    const fresh = ports.readCollection();
    const reservation = fresh.reservations.find((candidate) => (
      candidate.tabId === prior.tabId
      && candidate.operationId === prior.operationId
      && candidate.status === 'pending'
    ));
    if (!reservation) return;
    const canceled = cancelEmptyTabReservation(fresh, reservationIdentity(reservation));
    if (canceled.ok && canceled.state !== fresh) apply(canceled.state);
  }

  /** Invokes the binding's launcher and schedules the stale-guarded continuation. */
  function invokeBinding(
    binding: ConnectedTabLauncherBinding,
    reservation: ReservationIdentity,
  ): void {
    const identity = reservationIdentity(reservation);
    const launchGeneration = generation;
    let outcome: ConnectedTabLauncherOutcome | Promise<ConnectedTabLauncherOutcome>;
    try {
      outcome = binding.launcher({
        reservation: identity,
        workspaceId: ports.workspaceId,
        viewId: ports.viewId,
      });
    } catch (error) {
      failReservation(identity, error);
      return;
    }
    if (binding.kind === 'picker') {
      // The reservation stays pending — this tab is the destination for the
      // eventual picker choice (VRT-011A). A rejected reveal is a bounded
      // product-safe failure.
      void Promise.resolve(outcome).then(
        () => undefined,
        (error) => settleLaunchFailure(identity, error, launchGeneration),
      );
      return;
    }
    void Promise.resolve(outcome).then(
      (resolved) => settleComponentLaunch(identity, resolved, launchGeneration),
      (error) => settleLaunchFailure(identity, error, launchGeneration),
    );
  }

  function settleComponentLaunch(
    identity: ReservationIdentity,
    outcome: ConnectedTabLauncherOutcome,
    launchGeneration: number,
  ): void {
    if (launchGeneration !== generation) return; // stale across retire/workspace switch
    void runIntent(() => {
      if (launchGeneration !== generation || !current()) return; // no cross-workspace landing
      if (outcome.kind !== 'component') return; // still pending; nothing to commit
      const fresh = ports.readCollection();
      const stillPending = fresh.reservations.find((candidate) => (
        candidate.tabId === identity.tabId
        && candidate.operationId === identity.operationId
        && candidate.status === 'pending'
      ));
      if (!stillPending) return; // canceled/replaced — no state corruption
      const committed = commitEmptyTabFill(fresh, identity, outcome.descriptor);
      if (!committed.ok) {
        // Invalid descriptor or instance conflict: accepted failure behavior —
        // the reservation carries the product-safe error and the tab stays retryable.
        if (committed.state !== fresh) apply(committed.state);
        return;
      }
      if (committed.state !== fresh) apply(committed.state);
    });
  }

  function settleLaunchFailure(
    identity: ReservationIdentity,
    error: unknown,
    launchGeneration: number,
  ): void {
    if (launchGeneration !== generation) return;
    void runIntent(() => {
      if (launchGeneration !== generation || !current()) return;
      failReservation(identity, error);
    });
  }

  /** Raw (turn-scoped) launch beginning: reserve, replace picker context, invoke. */
  function beginLaunch(tabId: string, launcherId: string): void {
    const fresh = ports.readCollection();
    const reserved = reserveEmptyTab(fresh, tabId, launcherId, ports.mintOperationId);
    if (!reserved.ok) return;
    apply(reserved.state);
    const binding = ports.launcherFor(launcherId);
    if (!binding) {
      // Unknown, wrong-view, or unbound launcher: the accepted failure behavior —
      // a retryable Empty tab with a product-safe error.
      failReservation(reserved.reservation, { code: 'launch_failed' });
      return;
    }
    if (binding.kind === 'picker') {
      // Starting a picker in another Empty tab atomically cancels the prior
      // pending reservation BEFORE binding/revealing the singleton context.
      replacePickerContext(reservationIdentity(reserved.reservation), launcherId);
    }
    invokeBinding(binding, reserved.reservation);
  }

  /** Creates and applies one Empty tab; VIEW-02 §7 observers see the creation. */
  function createAndApplyEmptyTab(): string | null {
    const fresh = ports.readCollection();
    if (fresh.tabs.length >= COMPONENT_TAB_LIMITS.maxContainerEntries) return null;
    const created = createEmptyTab(fresh, ports.mintTabId);
    if (!created.ok) return null;
    apply(created.state);
    if (current()) ports.onEmptyTabCreated?.(created.tabId);
    return created.tabId;
  }

  function createEmptyTabEntry(): string | null {
    if (!current()) return null;
    return createAndApplyEmptyTab();
  }

  /** Predicate: a component tab rendering this view's Home presenter (§2). */
  function isHomeBlankContent(blankTarget: TabPlacementTargetRef | null) {
    return (content: { kind: string; component?: { componentTypeId: string; targetKey?: string } }): boolean => (
      blankTarget !== null
      && content.kind === 'component'
      && content.component?.componentTypeId === blankTarget.presenterId
      && content.component?.targetKey === blankTarget.targetKey
    );
  }

  /** The active tab's closed taxonomy kind (§2), or null with no active tab. */
  function activeTabKindOf(
    collection: ComponentTabCollectionState,
    blankTarget: TabPlacementTargetRef | null,
  ): 'home' | 'empty' | 'document' | null {
    const active = collection.tabs.find((tab) => tab.tabId === collection.activeTabId);
    if (!active) return null;
    if (active.content.kind === 'empty') return 'empty';
    if (isHomeBlankContent(blankTarget)(active.content)) return 'home';
    return 'document';
  }

  /**
   * VIEW-02 §4 plus contract (dumb and deterministic; never opens menus):
   * no-op on the view's Home tab or any Empty tab; otherwise create the
   * configured blank or recenter the existing one. For a Home blank this is
   * exactly the TABS-03 `new` disposition (exact targetKey match → activate +
   * reveal; else append — an Empty tab is never filled), so recenter/append
   * semantics come for free and duplicates stay impossible.
   */
  async function createOrRecenterBlankEntry(
    blankKind: TabPolicyNewTab['blankKind'],
  ): Promise<ConnectedBlankOutcome> {
    if (!current()) return 'noop';
    const blankTarget = ports.blankPlacementTarget?.() ?? null;
    const fresh = ports.readCollection();
    if (activeTabKindOf(fresh, blankTarget) !== 'document') return 'noop';
    if (blankKind === 'empty') {
      const existingBlank = fresh.tabs.find((tab) => tab.content.kind === 'empty');
      if (existingBlank) {
        return activateTabEntry(existingBlank.tabId) ? 'recentered' : 'noop';
      }
      return createEmptyTabEntry() ? 'created' : 'noop';
    }
    // blankKind 'home': the Home-blank target is a view capability. Without
    // it the contract fails closed as a bounded no-op (never a wrong-kind
    // tab), exactly like an unbound launcher.
    if (!blankTarget) return 'noop';
    const requestId = ports.mintOperationId();
    const placed = await placement({
      schemaVersion: 1,
      requestId,
      disposition: 'new',
      target: blankTarget,
    });
    if (!placed.ok) return 'noop';
    return placed.outcome === 'activated_existing' ? 'recentered' : 'created';
  }

  function activateTabEntry(tabId: string): boolean {
    if (!current()) return false;
    const fresh = ports.readCollection();
    if (!fresh.tabs.some((tab) => tab.tabId === tabId) || fresh.activeTabId === tabId) {
      return false;
    }
    apply({
      tabs: fresh.tabs,
      activeTabId: tabId,
      reservations: fresh.reservations,
    });
    return true;
  }

  function closeTabEntry(tabId: string): boolean {
    if (!current()) return false;
    const fresh = ports.readCollection();
    const closed = closeComponentTab(fresh, tabId);
    if (!closed.ok) return false;
    if (pickerContext && pickerContext.tabId === tabId) pickerContext = null;
    if (closed.state !== fresh) apply(closed.state);
    return true;
  }

  function preparePickerSelectionEntry(identity: ReservationIdentity): PickerPreparationResult {
    if (!current()) return 'stale_completion';
    const fresh = ports.readCollection();
    const reservation = fresh.reservations.find((candidate) => (
      candidate.tabId === identity.tabId
      && candidate.operationId === identity.operationId
      && candidate.expectedRevision === identity.expectedRevision
      && candidate.status === 'pending'
    ));
    if (!reservation) return 'stale_completion';
    if (pickerContext && pickerContext.operationId !== identity.operationId) {
      return 'stale_completion'; // replaced by a newer picker start
    }
    const tab = fresh.tabs.find((candidate) => candidate.tabId === identity.tabId);
    if (!tab
      || tab.content.kind !== 'empty'
      || tab.content.revision !== identity.expectedRevision) {
      return 'stale_completion';
    }
    pickerContext = null;
    apply({
      tabs: fresh.tabs, // content/order/revision unchanged
      activeTabId: identity.tabId,
      reservations: fresh.reservations.filter((candidate) => (
        !(candidate.tabId === identity.tabId
          && candidate.operationId === identity.operationId)
      )),
    });
    return 'ok';
  }

  const turn: ConnectedOwnerIntentTurn = {
    place: placement,
    preparePickerSelection: preparePickerSelectionEntry,
    createEmptyTab: createEmptyTabEntry,
    createOrRecenterBlank: createOrRecenterBlankEntry,
    activateTab: activateTabEntry,
    closeTab: closeTabEntry,
    beginLaunch,
  };

  function launchInTab(tabId: string, launcherId: string): Promise<void> {
    return runIntent(() => {
      if (current()) beginLaunch(tabId, launcherId);
    });
  }

  function retryTab(tabId: string): Promise<void> {
    return runIntent(() => {
      if (!current()) return;
      const fresh = ports.readCollection();
      const retried = retryEmptyTabReservation(fresh, tabId, ports.mintOperationId);
      if (!retried.ok) return;
      apply(retried.state);
      const binding = ports.launcherFor(retried.reservation.launcherId);
      if (!binding) {
        failReservation(reservationIdentity(retried.reservation), { code: 'launch_failed' });
        return;
      }
      if (binding.kind === 'picker') {
        replacePickerContext(
          reservationIdentity(retried.reservation),
          retried.reservation.launcherId,
        );
      }
      invokeBinding(binding, retried.reservation);
    });
  }

  function cancelTab(tabId: string): Promise<void> {
    return runIntent(() => {
      if (!current()) return;
      const fresh = ports.readCollection();
      const reservation = fresh.reservations.find((candidate) => candidate.tabId === tabId);
      if (!reservation) return;
      const canceled = cancelEmptyTabReservation(fresh, reservationIdentity(reservation));
      if (!canceled.ok) return;
      if (pickerContext && pickerContext.tabId === tabId
        && pickerContext.operationId === reservation.operationId) {
        pickerContext = null;
      }
      if (canceled.state !== fresh) apply(canceled.state);
    });
  }

  function ensureInitial(
    initial: TabPolicyInitial,
    blankKind?: TabPolicyNewTab['blankKind'],
  ): Promise<void> {
    if (initialApplied) return Promise.resolve();
    initialApplied = true;
    return runIntent(() => {
      if (!current()) return;
      // VIEW-02 §9: after hydration/conversion, ONE bounded idempotent
      // normalization enforces the per-view blank-kind dedupe (at most one
      // blank of the configured kind; a valid lone sentinel is never eaten
      // and a reserved blank is never dropped for a plain duplicate). The
      // whole normalization is one atomic owner apply; with no duplicates it
      // is a no-op.
      if (blankKind) {
        const fresh = ports.readCollection();
        const blankTarget = ports.blankPlacementTarget?.() ?? null;
        const deduped = dedupeConfiguredBlankTabs(
          fresh,
          blankKind,
          isHomeBlankContent(blankTarget),
        );
        if (deduped.state !== fresh) apply(deduped.state);
      }
      const fresh = ports.readCollection();
      if (fresh.tabs.length > 0) return; // hydrated valid generic state wins
      // Initial-policy creation (a session creation, not hydration): §7
      // observers see it (File drives autoOpenDrawer from it).
      const createdTabId = createAndApplyEmptyTab();
      if (initial.kind === 'launcher') {
        // VRT-011: the initial launcher is NOT a privileged shortcut — it runs
        // the same reserve → launch → validate → commit/fail lifecycle.
        if (createdTabId) beginLaunch(createdTabId, initial.launcherId);
      }
    });
  }

  function preparePickerSelection(identity: ReservationIdentity): Promise<PickerPreparationResult> {
    return runIntent(() => preparePickerSelectionEntry(identity));
  }

  function clearPickerContext(): void {
    void runIntent(() => {
      const prior = pickerContext;
      pickerContext = null;
      if (!prior || retired || !ports.isCurrent()) return;
      cancelReservationForContext(prior);
    });
  }

  function retire(): void {
    if (retired) return;
    const prior = pickerContext;
    pickerContext = null;
    retired = true;
    generation += 1;
    if (!prior) return;
    try {
      cancelReservationForContext(prior);
    } catch {
      // The owner may already be gone; nothing further to clear.
    }
  }

  return {
    viewId: ports.viewId,
    workspaceId: ports.workspaceId,
    subscribe: (listener) => ports.subscribe(listener),
    readCollection: () => ports.readCollection(),
    buildSnapshot,
    commit,
    place: (request) => runIntent(() => turn.place(request)),
    runIntent,
    createEmptyTab: createEmptyTabEntry,
    createOrRecenterBlank: (blankKind) => runIntent(() => createOrRecenterBlankEntry(blankKind)),
    activateTab: activateTabEntry,
    closeTab: closeTabEntry,
    launchInTab,
    retryTab,
    cancelTab,
    ensureInitial,
    pickerCurrent: () => (pickerContext ? { ...pickerContext } : null),
    preparePickerSelection,
    clearPickerContext,
    retire,
  };
}
