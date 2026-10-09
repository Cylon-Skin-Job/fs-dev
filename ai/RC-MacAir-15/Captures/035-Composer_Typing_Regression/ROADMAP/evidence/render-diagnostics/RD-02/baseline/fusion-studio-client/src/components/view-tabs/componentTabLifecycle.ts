import {
  type ComponentTabCollectionState,
  type ComponentTabIdFactory,
  type ComponentTabTransitionFailure,
  type EmptyTabReservation,
  type ReservationError,
  type ReservationFailureKind,
  type ReservationIdentity,
  type TabContentDescriptor,
  type TabContentRecord,
} from './componentTabTypes';
import { isBoundedOpaqueId, validateComponentDescriptor } from './componentTabValidation';

interface StateSuccess {
  ok: true;
  state: ComponentTabCollectionState;
}

export type CreateEmptyTabResult = (StateSuccess & { tabId: string }) | ComponentTabTransitionFailure;
export type ReserveEmptyTabResult = (StateSuccess & { reservation: EmptyTabReservation }) | ComponentTabTransitionFailure;
export type CommitEmptyTabResult = (StateSuccess & { tab: TabContentRecord }) | ComponentTabTransitionFailure;
export type FailEmptyTabResult = (StateSuccess & { reservation: EmptyTabReservation }) | ComponentTabTransitionFailure;
export type CancelEmptyTabResult = StateSuccess | ComponentTabTransitionFailure;
export type CloseComponentTabResult = StateSuccess | ComponentTabTransitionFailure;

function rejected(
  state: ComponentTabCollectionState,
  code: ComponentTabTransitionFailure['code'],
  message: string,
): ComponentTabTransitionFailure {
  return { ok: false, state, code, message };
}

function stale(state: ComponentTabCollectionState): ComponentTabTransitionFailure {
  return rejected(state, 'stale_completion', 'This component operation is no longer current.');
}

function currentReservation(
  state: ComponentTabCollectionState,
  identity: ReservationIdentity,
): EmptyTabReservation | null {
  const reservation = state.reservations.find((candidate) => candidate.tabId === identity.tabId);
  if (!reservation
    || reservation.operationId !== identity.operationId
    || reservation.expectedRevision !== identity.expectedRevision) {
    return null;
  }
  return reservation;
}

function currentEmptyTab(
  state: ComponentTabCollectionState,
  identity: ReservationIdentity,
): TabContentRecord | null {
  const tab = state.tabs.find((candidate) => candidate.tabId === identity.tabId);
  if (!tab || tab.content.kind !== 'empty' || tab.content.revision !== identity.expectedRevision) {
    return null;
  }
  return tab;
}

function mintedId(factory: ComponentTabIdFactory): string | null {
  try {
    const id = factory();
    return isBoundedOpaqueId(id) ? id : null;
  } catch {
    return null;
  }
}

function replaceReservation(
  reservations: readonly EmptyTabReservation[],
  next: EmptyTabReservation,
): EmptyTabReservation[] {
  const index = reservations.findIndex((reservation) => reservation.tabId === next.tabId);
  if (index < 0) return [...reservations, next];
  return reservations.map((reservation, candidateIndex) => (
    candidateIndex === index ? next : reservation
  ));
}

function withoutReservation(
  reservations: readonly EmptyTabReservation[],
  tabId: string,
): EmptyTabReservation[] {
  return reservations.filter((reservation) => reservation.tabId !== tabId);
}

const PRODUCT_SAFE_RESERVATION_ERRORS: Readonly<Record<ReservationFailureKind, ReservationError>> = {
  launch_failed: {
    code: 'launch_failed',
    message: 'The component could not be opened. Try again.',
  },
  timed_out: {
    code: 'timed_out',
    message: 'The component took too long to open. Try again.',
  },
  unavailable: {
    code: 'unavailable',
    message: 'The component is currently unavailable. Try again.',
  },
  invalid_component: {
    code: 'invalid_component',
    message: 'The component returned invalid content. Try again.',
  },
  component_instance_conflict: {
    code: 'component_instance_conflict',
    message: 'The component instance could not be opened. Try again.',
  },
};

/** Returns canonical UI-safe reservation copy without exposing the shared table. */
export function getProductSafeReservationError(kind: unknown): ReservationError | null {
  if (typeof kind !== 'string' || !Object.hasOwn(PRODUCT_SAFE_RESERVATION_ERRORS, kind)) {
    return null;
  }
  return { ...PRODUCT_SAFE_RESERVATION_ERRORS[kind as ReservationFailureKind] };
}

export function createEmptyTab(
  state: ComponentTabCollectionState,
  mintTabId: ComponentTabIdFactory,
): CreateEmptyTabResult {
  const tabId = mintedId(mintTabId);
  if (!tabId) return rejected(state, 'invalid_id', 'A fresh valid tab identifier is required.');
  if (state.tabs.some((tab) => tab.tabId === tabId)) {
    return rejected(state, 'id_conflict', 'The tab identifier is already in use.');
  }
  return {
    ok: true,
    tabId,
    state: {
      tabs: [...state.tabs, { tabId, content: { kind: 'empty', revision: 0 } }],
      activeTabId: tabId,
      reservations: state.reservations,
    },
  };
}

export function reserveEmptyTab(
  state: ComponentTabCollectionState,
  tabId: string,
  launcherId: string,
  mintOperationId: ComponentTabIdFactory,
): ReserveEmptyTabResult {
  if (!isBoundedOpaqueId(tabId) || !isBoundedOpaqueId(launcherId)) {
    return rejected(state, 'invalid_id', 'Valid tab and launcher identifiers are required.');
  }
  const tab = state.tabs.find((candidate) => candidate.tabId === tabId);
  if (!tab) return rejected(state, 'tab_not_found', 'The target tab does not exist.');
  if (tab.content.kind !== 'empty') {
    return rejected(state, 'tab_not_empty', 'A populated tab cannot be filled through the empty-tab route.');
  }
  const operationId = mintedId(mintOperationId);
  if (!operationId) return rejected(state, 'invalid_id', 'A fresh valid operation identifier is required.');
  if (state.reservations.some((reservation) => reservation.operationId === operationId)) {
    return rejected(state, 'id_conflict', 'The operation identifier is already in use.');
  }
  const reservation: EmptyTabReservation = {
    tabId,
    operationId,
    expectedRevision: tab.content.revision,
    launcherId,
    status: 'pending',
  };
  return {
    ok: true,
    reservation,
    state: {
      ...state,
      reservations: replaceReservation(state.reservations, reservation),
    },
  };
}

function boundedError(error: unknown): ReservationError {
  let kind: unknown = error;
  try {
    if (typeof error === 'object' && error !== null && !Array.isArray(error)) {
      const code = Object.getOwnPropertyDescriptor(error, 'code');
      kind = code?.enumerable && 'value' in code ? code.value : null;
    }
  } catch {
    kind = null;
  }
  return getProductSafeReservationError(kind)
    ?? { ...PRODUCT_SAFE_RESERVATION_ERRORS.launch_failed };
}

function failCurrentReservation(
  state: ComponentTabCollectionState,
  reservation: EmptyTabReservation,
  error: unknown,
): { state: ComponentTabCollectionState; reservation: EmptyTabReservation } {
  const failedReservation: EmptyTabReservation = {
    ...reservation,
    status: 'failed',
    error: boundedError(error),
  };
  return {
    reservation: failedReservation,
    state: {
      ...state,
      reservations: replaceReservation(state.reservations, failedReservation),
    },
  };
}

export function commitEmptyTabFill(
  state: ComponentTabCollectionState,
  identity: ReservationIdentity,
  componentValue: unknown,
): CommitEmptyTabResult {
  const reservation = currentReservation(state, identity);
  const tab = currentEmptyTab(state, identity);
  if (!reservation || reservation.status !== 'pending' || !tab) return stale(state);
  const component = validateComponentDescriptor(componentValue);
  if (!component.ok) {
    const failed = failCurrentReservation(state, reservation, {
      code: 'invalid_component',
    });
    return rejected(failed.state, 'invalid_component', 'The component descriptor is invalid.');
  }
  if (state.tabs.some((candidate) => (
    candidate.content.kind === 'component'
    && candidate.content.component.componentInstanceId === component.value.componentInstanceId
  ))) {
    const failed = failCurrentReservation(state, reservation, {
      code: 'component_instance_conflict',
    });
    return rejected(
      failed.state,
      'component_instance_conflict',
      'The component instance identifier is already in use.',
    );
  }
  const filled: TabContentRecord = {
    tabId: tab.tabId,
    content: {
      kind: 'component',
      revision: tab.content.revision + 1,
      component: component.value,
    },
  };
  return {
    ok: true,
    tab: filled,
    state: {
      tabs: state.tabs.map((candidate) => candidate.tabId === tab.tabId ? filled : candidate),
      activeTabId: state.activeTabId,
      reservations: withoutReservation(state.reservations, tab.tabId),
    },
  };
}

export function failEmptyTabReservation(
  state: ComponentTabCollectionState,
  identity: ReservationIdentity,
  error: unknown,
): FailEmptyTabResult {
  const reservation = currentReservation(state, identity);
  const tab = currentEmptyTab(state, identity);
  if (!reservation || reservation.status !== 'pending' || !tab) return stale(state);
  const failed = failCurrentReservation(state, reservation, error);
  return {
    ok: true,
    reservation: failed.reservation,
    state: failed.state,
  };
}

export function retryEmptyTabReservation(
  state: ComponentTabCollectionState,
  tabId: string,
  mintOperationId: ComponentTabIdFactory,
): ReserveEmptyTabResult {
  const prior = state.reservations.find((reservation) => reservation.tabId === tabId);
  const tab = state.tabs.find((candidate) => candidate.tabId === tabId);
  if (!prior
    || prior.status !== 'failed'
    || !tab
    || tab.content.kind !== 'empty'
    || tab.content.revision !== prior.expectedRevision) {
    return rejected(state, 'reservation_not_failed', 'Only a current failed reservation can be retried.');
  }
  return reserveEmptyTab(state, tabId, prior.launcherId, mintOperationId);
}

export function cancelEmptyTabReservation(
  state: ComponentTabCollectionState,
  identity: ReservationIdentity,
): CancelEmptyTabResult {
  if (!currentReservation(state, identity) || !currentEmptyTab(state, identity)) return stale(state);
  return {
    ok: true,
    state: { ...state, reservations: withoutReservation(state.reservations, identity.tabId) },
  };
}

export function closeComponentTab(
  state: ComponentTabCollectionState,
  tabId: string,
): CloseComponentTabResult {
  const index = state.tabs.findIndex((tab) => tab.tabId === tabId);
  if (index < 0) return rejected(state, 'tab_not_found', 'The target tab does not exist.');
  const tabs = state.tabs.filter((tab) => tab.tabId !== tabId);
  const activeTabId = state.activeTabId === tabId
    ? (state.tabs[index - 1]?.tabId ?? state.tabs[index + 1]?.tabId ?? null)
    : state.activeTabId;
  return {
    ok: true,
    state: {
      tabs,
      activeTabId,
      reservations: withoutReservation(state.reservations, tabId),
    },
  };
}

/** The view's configured §7 blank kind: `home` (Home tab) or `empty` (Empty tab). */
export type BlankTabKind = 'home' | 'empty';

export type DedupeConfiguredBlankTabsResult = {
  ok: true;
  /** The input state unchanged when there is no dedupe to perform. */
  state: ComponentTabCollectionState;
  keptTabId: string | null;
  removedTabIds: readonly string[];
};

function blankReservationRank(
  state: ComponentTabCollectionState,
  tabId: string,
): 0 | 1 | 2 {
  const reservation = state.reservations.find((candidate) => candidate.tabId === tabId);
  if (!reservation) return 0;
  return reservation.status === 'pending' ? 2 : 1;
}

/**
 * VIEW-02 §4/§9 per-view blank-kind dedupe: after hydration/conversion a view
 * never holds two blanks OF ITS CONFIGURED BLANK KIND. Deterministic rules:
 *  - `empty` blanks (Empty tabs): keep exactly one — the first
 *    reservation-carrying blank in tab order (pending before failed; a plain
 *    duplicate never displaces a reserved one), otherwise the first in tab
 *    order.
 *  - `home` blanks (component tabs matching the view's Home target): keep the
 *    first in tab order.
 *  - A tab carrying a PENDING reservation is never removed; if pathological
 *    duplicates make that impossible, the extra blank is left in place rather
 *    than silently killing a pending launch (the reservation semantics
 *    survive; dedupe stays bounded and idempotent).
 *  - When the removed set contained the active tab, the kept blank is
 *    activated (the §4 recenter contract).
 * Idempotent: with at most one blank of the kind (a valid lone sentinel) the
 * input state is returned unchanged — never eaten, never resurrected.
 */
export function dedupeConfiguredBlankTabs(
  state: ComponentTabCollectionState,
  blankKind: BlankTabKind,
  isHomeBlank: (content: TabContentDescriptor) => boolean,
): DedupeConfiguredBlankTabsResult {
  const isBlank = (tab: TabContentRecord): boolean => (
    blankKind === 'empty' ? tab.content.kind === 'empty' : isHomeBlank(tab.content)
  );
  const blanks = state.tabs.filter(isBlank);
  if (blanks.length <= 1) {
    return { ok: true, state, keptTabId: blanks[0]?.tabId ?? null, removedTabIds: [] };
  }
  let keptTabId: string | null = null;
  if (blankKind === 'empty') {
    // Prefer pending, then failed, then the first plain blank in tab order.
    let bestRank = 0;
    for (const blank of blanks) {
      const rank = blankReservationRank(state, blank.tabId);
      if (rank > bestRank) {
        bestRank = rank;
        keptTabId = blank.tabId;
        if (rank === 2) break; // a pending reservation always wins
      }
    }
  }
  if (!keptTabId) {
    keptTabId = blanks.find((blank) => blankReservationRank(state, blank.tabId) !== 2)?.tabId
      ?? blanks[0].tabId;
  }
  const removedTabIds = blanks
    .map((blank) => blank.tabId)
    .filter((tabId) => tabId !== keptTabId)
    // A pending reservation is never dropped: leave the extra blank in place.
    .filter((tabId) => blankReservationRank(state, tabId) !== 2);
  if (removedTabIds.length === 0) {
    return { ok: true, state, keptTabId, removedTabIds };
  }
  const removed = new Set(removedTabIds);
  return {
    ok: true,
    keptTabId,
    removedTabIds,
    state: {
      tabs: state.tabs.filter((tab) => !removed.has(tab.tabId)),
      activeTabId: state.activeTabId !== null && removed.has(state.activeTabId)
        ? keptTabId
        : state.activeTabId,
      reservations: state.reservations.filter((reservation) => !removed.has(reservation.tabId)),
    },
  };
}
