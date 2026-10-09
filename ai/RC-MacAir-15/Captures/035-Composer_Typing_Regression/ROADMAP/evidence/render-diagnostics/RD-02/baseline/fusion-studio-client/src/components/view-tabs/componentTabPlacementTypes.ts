import type { ComponentDescriptor, EmptyTabReservation, JsonValue } from './componentTabTypes';
import type {
  ComponentTabShellProjection,
  TabLocationProjection,
} from './componentTabPresentationDomain';

export type TabPlacementDisposition = 'current' | 'new';

export interface TabPlacementTargetRef {
  presenterId: string;
  targetKey: string;
}

export interface TabPlacementRequest {
  schemaVersion: 1;
  requestId: string;
  disposition: TabPlacementDisposition;
  target: TabPlacementTargetRef;
}

export interface TabPlacementTabDescriptor {
  label: string;
  icon: string;
  iconClassName?: string;
  closeLabel: string;
  closable?: boolean;
  closeDisabled?: boolean;
}

export interface ResolvedTabPlacementTarget {
  schemaVersion: 1;
  presenterId: string;
  targetKey: string;
  componentTypeId: string;
  input: { [key: string]: JsonValue };
  tab: TabPlacementTabDescriptor;
  location: TabLocationProjection;
}

/**
 * Nested slots intentionally remain unknown so invalid, legacy, and unaddressed
 * records can be carried through unchanged as protected chrome.
 */
export interface TabPlacementSnapshotRecord {
  tabId: string;
  content: unknown;
  tab: unknown;
  shell: unknown;
}

/** Runtime state remains with the connected owner; this is not a store schema. */
export interface TabPlacementSnapshot {
  schemaVersion: 1;
  tabs: readonly TabPlacementSnapshotRecord[];
  activeTabId: string | null;
  reservations: readonly EmptyTabReservation[];
}

export type TabPlacementOutcome =
  | 'activated_existing'
  | 'filled_current'
  | 'appended_new';

export type TabPlacementFailureCode =
  | 'invalid_request'
  | 'invalid_state'
  | 'target_unavailable'
  | 'target_contract_conflict'
  | 'ambiguous_existing_target'
  | 'capacity_exceeded'
  | 'invalid_generated_id'
  | 'id_conflict'
  | 'state_commit_failed';

export interface TabPlacementSuccess {
  schemaVersion: 1;
  ok: true;
  requestId: string;
  outcome: TabPlacementOutcome;
  tabId: string;
  componentTypeId: string;
  componentInstanceId: string;
  presenterId: string;
  targetKey: string;
  reveal: 'not_required' | 'completed' | 'failed';
}

export interface TabPlacementFailure {
  schemaVersion: 1;
  ok: false;
  requestId: string | null;
  code: TabPlacementFailureCode;
  message: string;
}

export type TabPlacementResult = TabPlacementSuccess | TabPlacementFailure;

export type ResolveTabPlacementTarget = (
  target: TabPlacementTargetRef,
) => ResolvedTabPlacementTarget | null;

export interface TabPlacementCommitRequest {
  schemaVersion: 1;
  priorSnapshot: TabPlacementSnapshot;
  nextSnapshot: TabPlacementSnapshot;
}

export type TabPlacementCommitAcknowledgement =
  | {
      schemaVersion: 1;
      status: 'committed';
      snapshot: TabPlacementSnapshot;
    }
  | {
      schemaVersion: 1;
      status: 'rejected';
      snapshot: TabPlacementSnapshot;
    };

export interface TabPlacementRevealRequest {
  tabId: string;
  componentInstanceId: string;
  presenterId: string;
  targetKey: string;
}

export interface TabPlacementControllerPorts {
  readSnapshot: () => TabPlacementSnapshot;
  resolveTarget: ResolveTabPlacementTarget;
  mintTabId: () => string;
  mintComponentInstanceId: () => string;
  commit: (
    request: TabPlacementCommitRequest,
  ) => TabPlacementCommitAcknowledgement | Promise<TabPlacementCommitAcknowledgement>;
  reveal?: (request: TabPlacementRevealRequest) => void | Promise<void>;
}

export interface TabPlacementController {
  place: (request: TabPlacementRequest) => Promise<TabPlacementResult>;
}

export type TabPlacementValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: TabPlacementFailure };

export interface TabPlacementGeneratedIds {
  componentInstanceId: unknown;
  tabId?: unknown;
}

export interface TabPlacementPlan {
  schemaVersion: 1;
  request: TabPlacementRequest;
  outcome: TabPlacementOutcome;
  priorSnapshot: TabPlacementSnapshot;
  nextSnapshot: TabPlacementSnapshot;
  requiresCommit: boolean;
  tabId: string;
  componentTypeId: string;
  componentInstanceId: string;
  presenterId: string;
  targetKey: string;
}

export type TabPlacementPlanResult =
  | { ok: true; plan: TabPlacementPlan }
  | { ok: false; failure: TabPlacementFailure };

export type TabPlacementDecision =
  | {
      kind: 'activate_existing';
      request: TabPlacementRequest;
      snapshot: TabPlacementSnapshot;
      record: TabPlacementSnapshotRecord;
      component: ComponentDescriptor & { targetKey: string };
      shell: ComponentTabShellProjection & { presenterId: string };
      usedComponentInstanceIds: readonly string[];
    }
  | {
      kind: 'fill_current';
      request: TabPlacementRequest;
      snapshot: TabPlacementSnapshot;
      record: TabPlacementSnapshotRecord;
      revision: number;
      usedComponentInstanceIds: readonly string[];
    }
  | {
      kind: 'append_new';
      request: TabPlacementRequest;
      snapshot: TabPlacementSnapshot;
      usedComponentInstanceIds: readonly string[];
    };

export type TabPlacementDecisionResult =
  | { ok: true; decision: TabPlacementDecision }
  | { ok: false; failure: TabPlacementFailure };
