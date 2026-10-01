/**
 * @module worksurfaceSlice
 * @role Group-keyed content worksurface binding state (CHAT-03 / SPEC-03 §6).
 *
 * Bindings are keyed by the composite `{workspaceId, viewId}` address; each
 * binding names the selected `threadGroupId`, the registered adapter identity,
 * and the last acknowledged content/placement lane revisions. Pending captures
 * are retained on conflict/rejection so the outgoing surface never silently
 * discards the latest content. Entry caches are keyed by
 * `{workspaceId, viewId, threadGroupId}`.
 *
 * The in-flight request lifecycle (requestId correlation, queueing, timeouts)
 * lives in `lib/worksurface/worksurfaceController.ts`; this slice holds only
 * the reactive projection the UI reads.
 */

import type { AppState } from '../panelStoreTypes';
import type { JsonValue, ThreadWorksurfaceEntry } from '../../lib/worksurface/types';
import type { ThreadMemberProjection } from '../../types/threadGroupMember';

export type {
  MemberPlacementDisposition,
  ThreadMemberProjection,
} from '../../types/threadGroupMember';

type Set = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;

export interface WorksurfaceBinding {
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  adapterId: string;
  adapterVersion: number;
  contentRevision: string | null;
  placementRevision: string | null;
}

export type WorksurfaceConflictKind =
  | 'revision_conflict'
  | 'rejected'
  | 'timeout'
  | 'worksurface_unavailable';

/** Why an outgoing flush was issued; drives the warned-discard copy. */
export type WorksurfaceFlushReason =
  | 'switch'
  | 'persist'
  | 'view-change'
  | 'close'
  | 'detach'
  | 'workspace-switch'
  | 'teardown'
  | 'reconnect';

export interface PendingWorksurfaceCapture {
  adapterId: string;
  adapterVersion: number;
  expectedContentRevision: string | null;
  content: JsonValue;
  /** Monotonic capture stamp; a newer capture is never clobbered by an older failure. */
  seq?: number;
  reason?: WorksurfaceFlushReason;
}

/**
 * Non-destructive conflict projection for the owning view (SPEC-03 §6.1/§6.2).
 * The pending capture is retained separately; only an explicit warned user
 * choice may discard it.
 */
export interface WorksurfaceConflict {
  kind: WorksurfaceConflictKind;
  /** Classified server/timeout code that produced the conflict. */
  code: string;
  /** Outgoing group still selected/retained. */
  threadGroupId: string;
  /** Intended incoming group for a switch conflict; null for a flush/persist. */
  toGroupId: string | null;
  reason: WorksurfaceFlushReason;
  /** Server's current entry/revisions returned with a stale write (reconcile base). */
  serverEntry: ThreadWorksurfaceEntry | null;
  serverContentRevision: string | null;
  serverPlacementRevision: string | null;
  /** Whether discarding the pending capture would lose unsaved content. */
  lossRisk: boolean;
}

export interface RemoteWorksurfaceRevision {
  contentRevision: string | null;
  placementRevision: string | null;
}

/**
 * SPEC-04 §8 member projection contract (`ThreadMemberProjection`,
 * `MemberPlacementDisposition`) is defined in the portable store-free module
 * `../../types/threadGroupMember` and re-exported above so existing slice
 * consumers keep their import path while a presentation component can consume
 * the contract without importing this store slice.
 */

export function threadMembersKey(workspaceId: string, threadGroupId: string): string {
  return `${workspaceId}::${threadGroupId}`;
}

/** Stable empty member projection for exact-key selectors. */
export const EMPTY_THREAD_MEMBERS: ThreadMemberProjection[] = [];

export function worksurfaceKey(workspaceId: string, viewId: string): string {
  return `${workspaceId}::${viewId}`;
}

export function worksurfaceEntryKey(
  workspaceId: string,
  viewId: string,
  threadGroupId: string,
): string {
  return `${workspaceId}::${viewId}::${threadGroupId}`;
}

export function createWorksurfaceSlice(set: Set) {
  return {
    worksurfaceBindings: {} as Record<string, WorksurfaceBinding>,
    worksurfacePendingCaptures: {} as Record<string, PendingWorksurfaceCapture>,
    worksurfaceEntries: {} as Record<string, ThreadWorksurfaceEntry | null>,
    worksurfaceRemoteRevisions: {} as Record<string, RemoteWorksurfaceRevision>,
    worksurfaceConflicts: {} as Record<string, WorksurfaceConflict>,
    worksurfaceWarnings: [] as string[],
    /**
     * SPEC-04 §6/§7: the focused Side Chat placement per `{workspaceId, viewId}`.
     * Focus is transient renderer state; the placement identity itself is
     * durable in the SPEC-03 managed-placement lane.
     */
    sideChatActivePlacementByView: {} as Record<string, string | null>,
    /**
     * SPEC-04 §3: the outer owning view's ThreadRail dock state, keyed by
     * `{workspaceId, viewId}`. A Side Chat's list button operates this exact
     * outer rail rather than opening a nested list.
     */
    worksurfaceDockOpenByView: {} as Record<string, boolean>,
    /**
     * SPEC-04 §8: ordered member projections by `{workspaceId, threadGroupId}`.
     * Transient renderer state hydrated by the qualified `thread:members` read;
     * never transcript content and never a placement authority.
     */
    threadMembersByGroup: {} as Record<string, ThreadMemberProjection[]>,

    setWorksurfaceBinding: (binding: WorksurfaceBinding) => set((s) => ({
      worksurfaceBindings: {
        ...s.worksurfaceBindings,
        [worksurfaceKey(binding.workspaceId, binding.viewId)]: binding,
      },
    })),

    updateWorksurfaceBinding: (
      workspaceId: string,
      viewId: string,
      patch: Partial<WorksurfaceBinding>,
    ) => set((s) => {
      const key = worksurfaceKey(workspaceId, viewId);
      const current = s.worksurfaceBindings[key];
      if (!current) return {};
      return { worksurfaceBindings: { ...s.worksurfaceBindings, [key]: { ...current, ...patch } } };
    }),

    clearWorksurfaceBinding: (workspaceId: string, viewId: string) => set((s) => {
      const key = worksurfaceKey(workspaceId, viewId);
      if (!(key in s.worksurfaceBindings)
        && !(key in s.worksurfacePendingCaptures)
        && !(key in s.worksurfaceConflicts)) return {};
      const worksurfaceBindings = { ...s.worksurfaceBindings };
      const worksurfacePendingCaptures = { ...s.worksurfacePendingCaptures };
      const worksurfaceConflicts = { ...s.worksurfaceConflicts };
      delete worksurfaceBindings[key];
      delete worksurfacePendingCaptures[key];
      delete worksurfaceConflicts[key];
      return { worksurfaceBindings, worksurfacePendingCaptures, worksurfaceConflicts };
    }),

    setWorksurfacePendingCapture: (
      workspaceId: string,
      viewId: string,
      capture: PendingWorksurfaceCapture,
    ) => set((s) => ({
      worksurfacePendingCaptures: {
        ...s.worksurfacePendingCaptures,
        [worksurfaceKey(workspaceId, viewId)]: capture,
      },
    })),

    clearWorksurfacePendingCapture: (workspaceId: string, viewId: string) => set((s) => {
      const key = worksurfaceKey(workspaceId, viewId);
      if (!(key in s.worksurfacePendingCaptures)) return {};
      const worksurfacePendingCaptures = { ...s.worksurfacePendingCaptures };
      delete worksurfacePendingCaptures[key];
      return { worksurfacePendingCaptures };
    }),

    setWorksurfaceConflict: (
      workspaceId: string,
      viewId: string,
      conflict: WorksurfaceConflict,
    ) => set((s) => ({
      worksurfaceConflicts: {
        ...s.worksurfaceConflicts,
        [worksurfaceKey(workspaceId, viewId)]: conflict,
      },
    })),

    clearWorksurfaceConflict: (workspaceId: string, viewId: string) => set((s) => {
      const key = worksurfaceKey(workspaceId, viewId);
      if (!(key in s.worksurfaceConflicts)) return {};
      const worksurfaceConflicts = { ...s.worksurfaceConflicts };
      delete worksurfaceConflicts[key];
      return { worksurfaceConflicts };
    }),

    setWorksurfaceEntry: (
      workspaceId: string,
      viewId: string,
      threadGroupId: string,
      entry: ThreadWorksurfaceEntry | null,
    ) => set((s) => ({
      worksurfaceEntries: {
        ...s.worksurfaceEntries,
        [worksurfaceEntryKey(workspaceId, viewId, threadGroupId)]: entry,
      },
    })),

    setWorksurfaceRemoteRevision: (
      workspaceId: string,
      viewId: string,
      threadGroupId: string,
      revision: RemoteWorksurfaceRevision,
    ) => set((s) => ({
      worksurfaceRemoteRevisions: {
        ...s.worksurfaceRemoteRevisions,
        [worksurfaceEntryKey(workspaceId, viewId, threadGroupId)]: revision,
      },
    })),

    /**
     * Drop a cached entry for a group the server authoritatively deleted
     * (SPEC-03 §8). The exact server entry is already gone, so a live window
     * must not keep serving a stale "clean" copy. Never touches a pending
     * capture, binding, or conflict.
     */
    removeWorksurfaceEntry: (workspaceId: string, viewId: string, threadGroupId: string) => set((s) => {
      const key = worksurfaceEntryKey(workspaceId, viewId, threadGroupId);
      if (!(key in s.worksurfaceEntries)) return {};
      const worksurfaceEntries = { ...s.worksurfaceEntries };
      delete worksurfaceEntries[key];
      return { worksurfaceEntries };
    }),

    pushWorksurfaceWarning: (warning: string) => set((s) => ({
      worksurfaceWarnings: [...s.worksurfaceWarnings, warning].slice(-50),
    })),

    clearWorksurfaceWarnings: () => set({ worksurfaceWarnings: [] }),

    setActiveSideChatPlacement: (workspaceId: string, viewId: string, placementId: string | null) => set((s) => ({
      sideChatActivePlacementByView: {
        ...s.sideChatActivePlacementByView,
        [worksurfaceKey(workspaceId, viewId)]: placementId,
      },
    })),

    setWorksurfaceDockOpen: (workspaceId: string, viewId: string, open: boolean) => set((s) => ({
      worksurfaceDockOpenByView: {
        ...s.worksurfaceDockOpenByView,
        [worksurfaceKey(workspaceId, viewId)]: open,
      },
    })),

    setThreadMembers: (
      workspaceId: string,
      threadGroupId: string,
      members: ThreadMemberProjection[],
    ) => set((s) => ({
      threadMembersByGroup: {
        ...s.threadMembersByGroup,
        [threadMembersKey(workspaceId, threadGroupId)]: members,
      },
    })),
  };
}

/** Read the outer owning view's ThreadRail dock state. */
export function getWorksurfaceDockOpen(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
): boolean {
  if (!workspaceId) return false;
  return state.worksurfaceDockOpenByView?.[worksurfaceKey(workspaceId, viewId)] ?? false;
}

/** Read the focused Side Chat placement for one `{workspaceId, viewId}`. */
export function getActiveSideChatPlacement(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
): string | null {
  if (!workspaceId) return null;
  return state.sideChatActivePlacementByView?.[worksurfaceKey(workspaceId, viewId)] ?? null;
}

/** Read the ordered member projections for one `{workspaceId, threadGroupId}`. */
export function getThreadMembers(
  state: AppState,
  workspaceId: string | null,
  threadGroupId: string,
): ThreadMemberProjection[] {
  if (!workspaceId) return EMPTY_THREAD_MEMBERS;
  return state.threadMembersByGroup?.[threadMembersKey(workspaceId, threadGroupId)]
    ?? EMPTY_THREAD_MEMBERS;
}

/** Read one binding (null when the view is not group-bound). */
export function getWorksurfaceBinding(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
): WorksurfaceBinding | null {
  if (!workspaceId) return null;
  return state.worksurfaceBindings?.[worksurfaceKey(workspaceId, viewId)] ?? null;
}

export function getWorksurfaceEntry(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
  threadGroupId: string,
): ThreadWorksurfaceEntry | null {
  if (!workspaceId) return null;
  return state.worksurfaceEntries?.[worksurfaceEntryKey(workspaceId, viewId, threadGroupId)] ?? null;
}

export function getWorksurfacePendingCapture(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
): PendingWorksurfaceCapture | null {
  if (!workspaceId) return null;
  return state.worksurfacePendingCaptures?.[worksurfaceKey(workspaceId, viewId)] ?? null;
}

export function getWorksurfaceConflict(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
): WorksurfaceConflict | null {
  if (!workspaceId) return null;
  return state.worksurfaceConflicts?.[worksurfaceKey(workspaceId, viewId)] ?? null;
}

/** True when a broadcast recorded newer remote state for a dirty local entry. */
export function hasNewerRemoteWorksurfaceState(
  state: AppState,
  workspaceId: string | null,
  viewId: string,
  threadGroupId: string,
): boolean {
  if (!workspaceId) return false;
  const binding = getWorksurfaceBinding(state, workspaceId, viewId);
  if (!binding || binding.threadGroupId !== threadGroupId) return false;
  const pending = getWorksurfacePendingCapture(state, workspaceId, viewId);
  if (!pending) return false;
  const remote = state.worksurfaceRemoteRevisions?.[
    worksurfaceEntryKey(workspaceId, viewId, threadGroupId)
  ];
  if (!remote) return false;
  return remote.contentRevision !== binding.contentRevision && remote.contentRevision !== null;
}
