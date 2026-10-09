import {
  COMPONENT_TAB_LIMITS,
  type ComponentTabValidationResult,
  type EmptyTabReservation,
  type TabContentDescriptor,
} from './componentTabTypes';
import { getProductSafeReservationError } from './componentTabLifecycle';
import { isBoundedOpaqueId, validateTabContentDescriptor } from './componentTabValidation';
import { validateComponentTabShellProjection } from './componentTabPresentationValidation';
import type { ComponentTabShellProjection } from './componentTabPresentationDomain';
import {
  exactPlacementArray,
  exactPlacementDataRecord,
  placementEnvelopeFailure,
  validateTabPlacementDisplay,
} from './componentTabPlacementValidationSupport';
import { createTabPlacementFailure } from './componentTabPlacementValidation';
import type {
  TabPlacementSnapshot,
  TabPlacementSnapshotRecord,
  TabPlacementTabDescriptor,
  TabPlacementValidationResult,
} from './componentTabPlacementTypes';

export interface TabPlacementRecordInspection {
  record: TabPlacementSnapshotRecord;
  content: ComponentTabValidationResult<TabContentDescriptor>;
  tab: ComponentTabValidationResult<TabPlacementTabDescriptor & { id?: string }>;
  shell: ComponentTabValidationResult<ComponentTabShellProjection>;
}

export type InspectedTabPlacementSnapshotResult =
  | {
      ok: true;
      value: TabPlacementSnapshot;
      inspections: readonly TabPlacementRecordInspection[];
    }
  | { ok: false; failure: ReturnType<typeof createTabPlacementFailure> };

function validateProtectedTabContent(
  value: unknown,
): ComponentTabValidationResult<TabContentDescriptor> {
  return validateTabContentDescriptor(value);
}

function validateReservation(value: unknown) {
  const reservation = exactPlacementDataRecord(
    value,
    ['tabId', 'operationId', 'expectedRevision', 'launcherId', 'status', 'error'],
    ['tabId', 'operationId', 'expectedRevision', 'launcherId', 'status'],
  );
  if (!reservation.ok) return reservation;
  if (!isBoundedOpaqueId(reservation.value.tabId)
    || !isBoundedOpaqueId(reservation.value.operationId)
    || !isBoundedOpaqueId(reservation.value.launcherId)) {
    return placementEnvelopeFailure<EmptyTabReservation>(
      'invalid_id',
      'The reservation identity is invalid.',
    );
  }
  if (!Number.isSafeInteger(reservation.value.expectedRevision)
    || typeof reservation.value.expectedRevision !== 'number'
    || reservation.value.expectedRevision < 0
    || (reservation.value.status !== 'pending' && reservation.value.status !== 'failed')) {
    return placementEnvelopeFailure<EmptyTabReservation>(
      'invalid_shape',
      'The reservation is invalid.',
    );
  }
  let error: EmptyTabReservation['error'];
  const hasError = Object.hasOwn(reservation.value, 'error');
  if ((reservation.value.status === 'pending' && hasError)
    || (reservation.value.status === 'failed' && !hasError)) {
    return placementEnvelopeFailure<EmptyTabReservation>(
      'invalid_shape',
      'The reservation is invalid.',
    );
  }
  if (hasError) {
    const candidate = exactPlacementDataRecord(
      reservation.value.error,
      ['code', 'message'],
      ['code', 'message'],
    );
    const safeError = candidate.ok
      ? getProductSafeReservationError(candidate.value.code)
      : null;
    if (!candidate.ok
      || !safeError
      || candidate.value.message !== safeError.message) {
      return placementEnvelopeFailure<EmptyTabReservation>(
        'invalid_shape',
        'The reservation error is invalid.',
      );
    }
    error = safeError;
  }
  return {
    ok: true as const,
    value: {
      tabId: reservation.value.tabId,
      operationId: reservation.value.operationId,
      expectedRevision: reservation.value.expectedRevision,
      launcherId: reservation.value.launcherId,
      status: reservation.value.status,
      ...(error ? { error } : {}),
    } satisfies EmptyTabReservation,
  };
}

export function inspectTabPlacementSnapshot(
  value: unknown,
  requestId: string | null = null,
): InspectedTabPlacementSnapshotResult {
  const invalid = (): InspectedTabPlacementSnapshotResult => ({
    ok: false,
    failure: createTabPlacementFailure(requestId, 'invalid_state'),
  });
  try {
    const snapshot = exactPlacementDataRecord(
      value,
      ['schemaVersion', 'tabs', 'activeTabId', 'reservations'],
      ['schemaVersion', 'tabs', 'activeTabId', 'reservations'],
    );
    if (!snapshot.ok || snapshot.value.schemaVersion !== 1) return invalid();
    const tabsInput = exactPlacementArray(snapshot.value.tabs);
    const reservationsInput = exactPlacementArray(snapshot.value.reservations);
    if (!tabsInput.ok || !reservationsInput.ok
      || tabsInput.value.length > COMPONENT_TAB_LIMITS.maxContainerEntries
      || reservationsInput.value.length > COMPONENT_TAB_LIMITS.maxContainerEntries) return invalid();

    const tabs: TabPlacementSnapshotRecord[] = [];
    const inspections: TabPlacementRecordInspection[] = [];
    const tabIds = new Set<string>();
    const componentInstances = new Set<string>();
    for (const candidate of tabsInput.value) {
      const record = exactPlacementDataRecord(
        candidate,
        ['tabId', 'content', 'tab', 'shell'],
        ['tabId', 'content', 'tab', 'shell'],
      );
      if (!record.ok || !isBoundedOpaqueId(record.value.tabId) || tabIds.has(record.value.tabId)) {
        return invalid();
      }
      tabIds.add(record.value.tabId);
      const content = validateProtectedTabContent(record.value.content);
      const tab = validateTabPlacementDisplay(record.value.tab, true);
      const shell = validateComponentTabShellProjection(record.value.shell);
      if (content.ok && content.value.kind === 'component') {
        const instanceId = content.value.component.componentInstanceId;
        if (componentInstances.has(instanceId)) return invalid();
        componentInstances.add(instanceId);
      }
      const canonicalRecord: TabPlacementSnapshotRecord = {
        tabId: record.value.tabId,
        content: content.ok ? content.value : record.value.content,
        tab: tab.ok ? tab.value : record.value.tab,
        shell: shell.ok ? shell.value : record.value.shell,
      };
      tabs.push(canonicalRecord);
      inspections.push({ record: canonicalRecord, content, tab, shell });
    }

    const activeTabId = snapshot.value.activeTabId;
    if (activeTabId !== null
      && (!isBoundedOpaqueId(activeTabId) || !tabIds.has(activeTabId))) return invalid();

    const reservations: EmptyTabReservation[] = [];
    const reservedTabs = new Set<string>();
    const operationIds = new Set<string>();
    for (const candidate of reservationsInput.value) {
      const reservation = validateReservation(candidate);
      if (!reservation.ok
        || reservedTabs.has(reservation.value.tabId)
        || operationIds.has(reservation.value.operationId)) return invalid();
      const owner = inspections.find(
        (inspection) => inspection.record.tabId === reservation.value.tabId,
      );
      if (!owner?.content.ok
        || owner.content.value.kind !== 'empty'
        || owner.content.value.revision !== reservation.value.expectedRevision) return invalid();
      reservedTabs.add(reservation.value.tabId);
      operationIds.add(reservation.value.operationId);
      reservations.push(reservation.value);
    }
    return {
      ok: true,
      value: { schemaVersion: 1, tabs, activeTabId, reservations },
      inspections,
    };
  } catch {
    return invalid();
  }
}

export function validateTabPlacementSnapshot(
  value: unknown,
  requestId: string | null = null,
): TabPlacementValidationResult<TabPlacementSnapshot> {
  const inspected = inspectTabPlacementSnapshot(value, requestId);
  return inspected.ok
    ? { ok: true, value: inspected.value }
    : inspected;
}
