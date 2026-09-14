/**
 * @module chatSurfaceSlice
 * @role Per-session, per-population, and per-mount chat surface state
 *       (SPEC-02 §6.1/§6.2/§6.3).
 *
 * Group populations and their selected group are keyed by the composite
 * `{workspaceId, viewId}` identity. Legacy is the explicit `viewId: null`
 * population in the `legacy*` maps; view populations live under
 * `threadGroupsByWorkspaceAndView[workspaceId][viewId]`. A late response for
 * one pair can never fill another workspace or view. Session-owned facts
 * (context/token usage, wire readiness, acknowledged + pending harness
 * selection) remain keyed by exact `threadId`.
 *
 * Correlated `thread:open` requests are recorded per request and per
 * population so two hosts cannot consume each other's `thread:opened`
 * response.
 *
 * The legacy workspace-global `contextUsage`/`tokenUsage`/`wireReady` fields
 * remain only as a compatibility mirror for pre-SPEC-02 consumers; every chat
 * surface reads the per-thread maps.
 */

import type { Thread, TokenUsage } from '../../types';
import type { AppState } from '../panelStoreTypes';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
type Get = () => AppState;

/** Last server-acknowledged portable selection for one exact session. */
export interface HarnessSelectionAck {
  model: string | null;
  variant: string | null;
  harnessId: string | null;
}

export interface PendingHarnessSelection {
  modelId: string | null;
  variant: string | null;
  requestId: string;
}

export interface ThreadHarnessSelection {
  acknowledged: HarnessSelectionAck;
  pending: PendingHarnessSelection | null;
}

/**
 * One correlated `thread:open` request awaiting its exact response. The
 * population `{workspaceId, viewId}` is the request owner; a response may only
 * mutate selection for its own population (SPEC-02 §6.1).
 */
export interface PendingThreadOpenRequest {
  workspaceId: string | null;
  viewId: string | null;
  threadId?: string;
  threadGroupId?: string;
}

/** Population address for one visible group list and its selected group. */
export interface ChatPopulationAddress {
  workspaceId: string | null;
  viewId: string | null;
}

/** Match key for one `thread:opened` response. */
export interface ThreadOpenResponseMatch {
  threadId?: string;
  threadGroupId?: string;
}

const MAX_PENDING_THREAD_OPENS = 64;

const EMPTY_ACK: HarnessSelectionAck = { model: null, variant: null, harnessId: null };

/** Stable empty population so selectors never return a fresh array. */
export const EMPTY_THREAD_GROUP_POPULATION: Thread[] = [];

/**
 * Collision-safe composite key for tests and diagnostics. The reserved
 * `\u0000legacy` segment can never equal a real view id, so `viewId: null`
 * never collides with a view literally named `null`.
 */
export function chatPopulationKey(workspaceId: string | null, viewId: string | null): string {
  return `${workspaceId ?? ''}::${viewId ?? '\u0000legacy'}`;
}

/** Read one explicit population. `viewId: null` is the Legacy population. */
export function getThreadGroupPopulation(
  state: AppState,
  workspaceId: string | null,
  viewId: string | null,
): Thread[] {
  if (!workspaceId) return EMPTY_THREAD_GROUP_POPULATION;
  if (viewId === null) {
    return state.legacyThreadGroupsByWorkspaceId?.[workspaceId] ?? EMPTY_THREAD_GROUP_POPULATION;
  }
  return state.threadGroupsByWorkspaceAndView?.[workspaceId]?.[viewId]
    ?? EMPTY_THREAD_GROUP_POPULATION;
}

/** Read the selected visible group for one population. */
export function getCurrentThreadGroupId(
  state: AppState,
  workspaceId: string | null,
  viewId: string | null,
): string | null {
  if (!workspaceId) return null;
  if (viewId === null) {
    return state.currentLegacyThreadGroupIdByWorkspaceId?.[workspaceId] ?? null;
  }
  return state.currentThreadGroupIdByWorkspaceAndView?.[workspaceId]?.[viewId] ?? null;
}

function samePopulation(
  a: PendingThreadOpenRequest,
  b: ChatPopulationAddress,
): boolean {
  return (a.workspaceId ?? null) === (b.workspaceId ?? null)
    && (a.viewId ?? null) === (b.viewId ?? null);
}

function requestMatchesResponse(
  request: PendingThreadOpenRequest,
  match: ThreadOpenResponseMatch,
): boolean {
  if (match.threadGroupId && request.threadGroupId === match.threadGroupId) return true;
  if (match.threadId && request.threadId === match.threadId) return true;
  return false;
}

/**
 * True when a recorded `thread:open` request for this exact population is still
 * awaiting the response. A response for another population never matches.
 */
export function matchesPendingThreadOpen(
  state: AppState,
  address: ChatPopulationAddress,
  match: ThreadOpenResponseMatch,
): boolean {
  return (state.pendingThreadOpens ?? []).some(
    (request) => samePopulation(request, address) && requestMatchesResponse(request, match),
  );
}

// ── Accepted row mutations keep every population in lockstep ───────────────
// The composite population maps are the rail's read model (SPEC-02 §6.1).
// Rename/delete/create acks must mutate them, not only the Legacy `threads`
// backing store, or the rail shows a stale name / keeps a deleted row until a
// later refresh. One shared transform keeps every call site consistent and
// keeps the portable components free of store ownership.

interface PopulationRemoval {
  workspaceId: string;
  viewId: string | null;
  removedGroupIds: string[];
}

function mutatePopulationRows(
  state: AppState,
  mutateRows: (rows: Thread[]) => { rows: Thread[]; removedGroupIds: string[] },
): { next: Partial<AppState>; removals: PopulationRemoval[] } {
  let changed = false;
  const removals: PopulationRemoval[] = [];
  const legacyThreadGroupsByWorkspaceId: Record<string, Thread[]> = {
    ...state.legacyThreadGroupsByWorkspaceId,
  };
  for (const [workspaceId, rows] of Object.entries(state.legacyThreadGroupsByWorkspaceId ?? {})) {
    const result = mutateRows(rows);
    if (result.rows !== rows) {
      legacyThreadGroupsByWorkspaceId[workspaceId] = result.rows;
      changed = true;
    }
    if (result.removedGroupIds.length > 0) {
      removals.push({ workspaceId, viewId: null, removedGroupIds: result.removedGroupIds });
    }
  }
  const threadGroupsByWorkspaceAndView: Record<string, Record<string, Thread[]>> = {
    ...state.threadGroupsByWorkspaceAndView,
  };
  for (const [workspaceId, byView] of Object.entries(state.threadGroupsByWorkspaceAndView ?? {})) {
    let viewChanged = false;
    const nextByView = { ...byView };
    for (const [viewId, rows] of Object.entries(byView ?? {})) {
      const result = mutateRows(rows);
      if (result.rows !== rows) {
        nextByView[viewId] = result.rows;
        viewChanged = true;
        changed = true;
      }
      if (result.removedGroupIds.length > 0) {
        removals.push({ workspaceId, viewId, removedGroupIds: result.removedGroupIds });
      }
    }
    if (viewChanged) threadGroupsByWorkspaceAndView[workspaceId] = nextByView;
  }
  const next: Partial<AppState> = {};
  if (changed) {
    next.legacyThreadGroupsByWorkspaceId = legacyThreadGroupsByWorkspaceId;
    next.threadGroupsByWorkspaceAndView = threadGroupsByWorkspaceAndView;
  }
  return { next, removals };
}

/**
 * Apply an accepted rename to every population containing the exact
 * `threadId`. `threads` stays in lockstep via the caller.
 */
export function renameThreadInPopulations(
  state: AppState,
  threadId: string,
  updates: Partial<Thread['entry']>,
): Partial<AppState> {
  const { next } = mutatePopulationRows(state, (rows) => {
    let didChange = false;
    const nextRows = rows.map((row) => {
      if (row.threadId !== threadId) return row;
      didChange = true;
      return { ...row, entry: { ...row.entry, ...updates } };
    });
    return { rows: didChange ? nextRows : rows, removedGroupIds: [] };
  });
  return next;
}

function upsertPopulationRow(rows: Thread[], thread: Thread): Thread[] {
  const index = rows.findIndex((row) => row.threadId === thread.threadId
    || (!!thread.threadGroupId && row.threadGroupId === thread.threadGroupId));
  if (index >= 0) {
    const nextRows = [...rows];
    nextRows[index] = { ...nextRows[index], ...thread };
    return nextRows;
  }
  // Server MRU order: a newly created thread is the newest row.
  return [thread, ...rows];
}

/**
 * Insert an accepted create into the one population it belongs to, and only
 * when that population is already initialized. Idempotent against the list
 * that may follow the create.
 */
export function addThreadToPopulations(state: AppState, thread: Thread): Partial<AppState> {
  const workspaceId = state.activeWorkspaceId;
  if (!workspaceId) return {};
  // 02B advisory A-3: the route is derived ONLY from the accepted create's own
  // durable `viewId` (top-level or entry). An absent view binding is the
  // EXPLICIT Legacy population (`viewId: null`); it is never inferred from the
  // active panel, current selection, or another identity's shape (SPEC-02 §6.1).
  const viewId = thread.viewId ?? thread.entry?.viewId ?? null;
  if (viewId === null) {
    const rows = state.legacyThreadGroupsByWorkspaceId?.[workspaceId];
    if (!rows) return {};
    return {
      legacyThreadGroupsByWorkspaceId: {
        ...state.legacyThreadGroupsByWorkspaceId,
        [workspaceId]: upsertPopulationRow(rows, thread),
      },
    };
  }
  const byView = state.threadGroupsByWorkspaceAndView?.[workspaceId];
  const rows = byView?.[viewId];
  if (!byView || !rows) return {};
  return {
    threadGroupsByWorkspaceAndView: {
      ...state.threadGroupsByWorkspaceAndView,
      [workspaceId]: { ...byView, [viewId]: upsertPopulationRow(rows, thread) },
    },
  };
}

/**
 * Remove an accepted delete from every population containing the exact
 * `threadId` and clear any qualified selected group that pointed at a removed
 * row. `address` is the ack's own population; it also clears the selection when
 * the row was already absent from the read model.
 */
export function removeThreadFromPopulations(
  state: AppState,
  threadId: string,
  address?: ChatPopulationAddress & { threadGroupId?: string | null },
): Partial<AppState> {
  const { next, removals } = mutatePopulationRows(state, (rows) => {
    const removed = rows.filter((row) => row.threadId === threadId);
    if (removed.length === 0) return { rows, removedGroupIds: [] };
    return {
      rows: rows.filter((row) => row.threadId !== threadId),
      removedGroupIds: removed
        .map((row) => row.threadGroupId)
        .filter((groupId): groupId is string => !!groupId),
    };
  });

  let selectionChanged = false;
  const currentLegacyThreadGroupIdByWorkspaceId = {
    ...state.currentLegacyThreadGroupIdByWorkspaceId,
  };
  const currentThreadGroupIdByWorkspaceAndView = {
    ...state.currentThreadGroupIdByWorkspaceAndView,
  };

  const clearLegacySelection = (workspaceId: string, groupId: string | null | undefined) => {
    if (!groupId) return;
    if (currentLegacyThreadGroupIdByWorkspaceId[workspaceId] === groupId) {
      currentLegacyThreadGroupIdByWorkspaceId[workspaceId] = null;
      selectionChanged = true;
    }
  };
  const clearViewSelection = (
    workspaceId: string,
    viewId: string,
    groupId: string | null | undefined,
  ) => {
    if (!groupId) return;
    const byView = currentThreadGroupIdByWorkspaceAndView[workspaceId];
    if (byView && byView[viewId] === groupId) {
      currentThreadGroupIdByWorkspaceAndView[workspaceId] = { ...byView, [viewId]: null };
      selectionChanged = true;
    }
  };

  for (const removal of removals) {
    for (const groupId of removal.removedGroupIds) {
      if (removal.viewId === null) clearLegacySelection(removal.workspaceId, groupId);
      else clearViewSelection(removal.workspaceId, removal.viewId, groupId);
    }
  }
  if (address?.workspaceId) {
    if (address.viewId === null) {
      clearLegacySelection(address.workspaceId, address.threadGroupId);
    } else {
      clearViewSelection(address.workspaceId, address.viewId, address.threadGroupId);
    }
  }

  const result: Partial<AppState> = { ...next };
  if (selectionChanged) {
    result.currentLegacyThreadGroupIdByWorkspaceId = currentLegacyThreadGroupIdByWorkspaceId;
    result.currentThreadGroupIdByWorkspaceAndView = currentThreadGroupIdByWorkspaceAndView;
  }
  return result;
}

/** Stable empty selection so selectors never return a fresh object. */
export const EMPTY_THREAD_SELECTION: ThreadHarnessSelection = Object.freeze({
  acknowledged: Object.freeze({ ...EMPTY_ACK }) as HarnessSelectionAck,
  pending: null,
});

function harnessConfigToAck(
  harnessConfig: Record<string, unknown> | null | undefined,
  harnessId: string | null = null,
): HarnessSelectionAck {
  if (!harnessConfig || typeof harnessConfig !== 'object') {
    return { ...EMPTY_ACK, harnessId };
  }
  const model = typeof harnessConfig.model === 'string' && harnessConfig.model.trim()
    ? harnessConfig.model.trim()
    : null;
  const variant = typeof harnessConfig.variant === 'string' && harnessConfig.variant.trim()
    ? harnessConfig.variant.trim()
    : null;
  return { model, variant, harnessId };
}

/** Read the last acknowledged `{model, variant}` portable selection for Send. */
export function acknowledgedHarnessConfigForThread(
  state: AppState,
  threadId: string,
): { model: string; variant?: string | null } | undefined {
  const ack = state.harnessSelectionByThread?.[threadId]?.acknowledged;
  if (!ack?.model) return undefined;
  return {
    model: ack.model,
    ...(ack.variant !== undefined ? { variant: ack.variant } : {}),
  };
}

export function createChatSurfaceSlice(set: Set, _get: Get) {
  return {
    contextUsageByThread: {} as Record<string, number>,
    tokenUsageByThread: {} as Record<string, TokenUsage | null>,
    wireReadyByThread: {} as Record<string, boolean>,
    harnessSelectionByThread: {} as Record<string, ThreadHarnessSelection>,
    threadGroupsByWorkspaceAndView: {} as Record<string, Record<string, Thread[]>>,
    currentThreadGroupIdByWorkspaceAndView: {} as Record<string, Record<string, string | null>>,
    legacyThreadGroupsByWorkspaceId: {} as Record<string, Thread[]>,
    currentLegacyThreadGroupIdByWorkspaceId: {} as Record<string, string | null>,
    pendingThreadOpens: [] as PendingThreadOpenRequest[],

    setThreadContextUsage: (threadId: string, usage: number) => set((state) => ({
      contextUsageByThread: { ...state.contextUsageByThread, [threadId]: usage },
    })),

    setThreadTokenUsage: (threadId: string, usage: TokenUsage | null) => set((state) => ({
      tokenUsageByThread: { ...state.tokenUsageByThread, [threadId]: usage },
    })),

    clearThreadUsage: (threadId: string) => set((state) => {
      if (!(threadId in state.contextUsageByThread) && !(threadId in state.tokenUsageByThread)) {
        return state;
      }
      const contextUsageByThread = { ...state.contextUsageByThread };
      const tokenUsageByThread = { ...state.tokenUsageByThread };
      delete contextUsageByThread[threadId];
      delete tokenUsageByThread[threadId];
      return { contextUsageByThread, tokenUsageByThread };
    }),

    setThreadWireReady: (threadId: string, ready: boolean) => set((state) => ({
      wireReadyByThread: { ...state.wireReadyByThread, [threadId]: ready },
    })),

    clearThreadWireReady: (threadId: string) => set((state) => {
      if (!(threadId in state.wireReadyByThread)) return state;
      const wireReadyByThread = { ...state.wireReadyByThread };
      delete wireReadyByThread[threadId];
      return { wireReadyByThread };
    }),

    /**
     * Fill exactly one `{workspaceId, viewId}` population. `viewId: null`
     * writes the explicit Legacy map; a view response never touches it.
     */
    setThreadGroupPopulation: (
      workspaceId: string,
      viewId: string | null,
      rows: Thread[],
    ) => set((state) => {
      if (!workspaceId) return state;
      if (viewId === null) {
        return {
          legacyThreadGroupsByWorkspaceId: {
            ...state.legacyThreadGroupsByWorkspaceId,
            [workspaceId]: rows,
          },
        };
      }
      const byView = { ...(state.threadGroupsByWorkspaceAndView[workspaceId] ?? {}) };
      byView[viewId] = rows;
      return {
        threadGroupsByWorkspaceAndView: {
          ...state.threadGroupsByWorkspaceAndView,
          [workspaceId]: byView,
        },
      };
    }),

    /** Set the selected visible group for exactly one population. */
    setCurrentThreadGroupId: (
      workspaceId: string,
      viewId: string | null,
      threadGroupId: string | null,
    ) => set((state) => {
      if (!workspaceId) return state;
      if (viewId === null) {
        return {
          currentLegacyThreadGroupIdByWorkspaceId: {
            ...state.currentLegacyThreadGroupIdByWorkspaceId,
            [workspaceId]: threadGroupId,
          },
        };
      }
      const byView = { ...(state.currentThreadGroupIdByWorkspaceAndView[workspaceId] ?? {}) };
      byView[viewId] = threadGroupId;
      return {
        currentThreadGroupIdByWorkspaceAndView: {
          ...state.currentThreadGroupIdByWorkspaceAndView,
          [workspaceId]: byView,
        },
      };
    }),

    /** Record one correlated `thread:open` request owned by its population. */
    requestThreadOpen: (target: PendingThreadOpenRequest) => set((state) => {
      const pending = state.pendingThreadOpens ?? [];
      const duplicate = pending.some((existing) => (
        samePopulation(existing, target)
        && existing.threadId === target.threadId
        && existing.threadGroupId === target.threadGroupId
      ));
      if (duplicate) return state;
      const next = [...pending, { ...target }];
      return {
        pendingThreadOpens: next.length > MAX_PENDING_THREAD_OPENS
          ? next.slice(next.length - MAX_PENDING_THREAD_OPENS)
          : next,
      };
    }),

    /**
     * Retire the recorded request(s) that a `thread:opened` response actually
     * answers, for its own population only.
     */
    consumeThreadOpen: (address: ChatPopulationAddress, match: ThreadOpenResponseMatch) => set((state) => {
      const pending = state.pendingThreadOpens ?? [];
      if (pending.length === 0) return state;
      const remaining = pending.filter(
        (request) => !(samePopulation(request, address) && requestMatchesResponse(request, match)),
      );
      return remaining.length === pending.length ? state : { pendingThreadOpens: remaining };
    }),

    /**
     * Hydrate the server-owned acknowledged selection from `thread:list` /
     * `thread:opened`. Never clears an in-flight optimistic pending value
     * (the acknowledged prior stays the Send fallback until the exact
     * acknowledgement arrives).
     */
    hydrateHarnessSelection: (
      threadId: string,
      harnessConfig: Record<string, unknown> | null | undefined,
      harnessId: string | null = null,
    ) => set((state) => {
      const current = state.harnessSelectionByThread[threadId];
      const acknowledged = harnessConfigToAck(harnessConfig, harnessId);
      if (current
        && current.acknowledged.model === acknowledged.model
        && current.acknowledged.variant === acknowledged.variant
        && current.acknowledged.harnessId === acknowledged.harnessId) {
        return state;
      }
      return {
        harnessSelectionByThread: {
          ...state.harnessSelectionByThread,
          [threadId]: {
            acknowledged,
            pending: current?.pending ?? null,
          },
        },
      };
    }),

    beginHarnessSelection: (threadId: string, pending: PendingHarnessSelection) => set((state) => {
      const current = state.harnessSelectionByThread[threadId];
      return {
        harnessSelectionByThread: {
          ...state.harnessSelectionByThread,
          [threadId]: {
            acknowledged: current?.acknowledged ?? { ...EMPTY_ACK },
            pending: { ...pending },
          },
        },
      };
    }),

    /**
     * Promote an exact-session acknowledgement. Only the in-flight request's
     * own completion clears pending; a fan-out frame from another window
     * hydrates acknowledged server truth without touching this mount's pending.
     */
    ackHarnessSelection: (
      threadId: string,
      requestId: string | null | undefined,
      ack: HarnessSelectionAck,
    ) => set((state) => {
      const current = state.harnessSelectionByThread[threadId];
      const matchesPending = !!current?.pending && !!requestId
        && current.pending.requestId === requestId;
      return {
        harnessSelectionByThread: {
          ...state.harnessSelectionByThread,
          [threadId]: {
            acknowledged: ack,
            pending: matchesPending ? null : (current?.pending ?? null),
          },
        },
      };
    }),

    /** A rejected exact-session selection restores the prior acknowledged value. */
    rejectHarnessSelection: (
      threadId: string,
      requestId: string | null | undefined,
    ) => set((state) => {
      const current = state.harnessSelectionByThread[threadId];
      if (!current?.pending || !requestId || current.pending.requestId !== requestId) {
        return state;
      }
      return {
        harnessSelectionByThread: {
          ...state.harnessSelectionByThread,
          [threadId]: { acknowledged: current.acknowledged, pending: null },
        },
      };
    }),

    clearThreadHarnessSelection: (threadId: string) => set((state) => {
      if (!(threadId in state.harnessSelectionByThread)) return state;
      const harnessSelectionByThread = { ...state.harnessSelectionByThread };
      delete harnessSelectionByThread[threadId];
      return { harnessSelectionByThread };
    }),
  };
}

/** Read the acknowledged/pending selection for one explicit session. */
export function selectionForThread(
  state: AppState,
  threadId: string | null,
): ThreadHarnessSelection {
  if (!threadId) return EMPTY_THREAD_SELECTION;
  return state.harnessSelectionByThread?.[threadId] ?? EMPTY_THREAD_SELECTION;
}
