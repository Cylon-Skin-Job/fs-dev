import { COMPONENT_TAB_LIMITS, type ComponentDescriptor } from './componentTabTypes';
import { isBoundedOpaqueId } from './componentTabValidation';
import type { ComponentTabShellProjection } from './componentTabPresentationDomain';
import {
  createTabPlacementFailure,
  validateResolvedTabPlacementTarget,
  validateTabPlacementRequest,
} from './componentTabPlacementValidation';
import {
  inspectTabPlacementSnapshot,
  type TabPlacementRecordInspection,
} from './componentTabPlacementSnapshotValidation';
import { exactPlacementDataRecord } from './componentTabPlacementValidationSupport';
import type {
  ResolvedTabPlacementTarget,
  TabPlacementDecision,
  TabPlacementDecisionResult,
  TabPlacementGeneratedIds,
  TabPlacementPlan,
  TabPlacementPlanResult,
  TabPlacementResult,
  TabPlacementSnapshot,
  TabPlacementSnapshotRecord,
} from './componentTabPlacementTypes';

function correlatedComponent(
  inspection: TabPlacementRecordInspection,
): {
  component: ComponentDescriptor & { targetKey: string };
  shell: ComponentTabShellProjection & { presenterId: string };
} | null {
  const { record, content, tab, shell } = inspection;
  if (!content.ok
    || content.value.kind !== 'component'
    || typeof content.value.component.targetKey !== 'string'
    || !tab.ok
    || tab.value.id !== record.tabId
    || !shell.ok
    || shell.value.tabId !== record.tabId
    || shell.value.presenterId === null) return null;
  return {
    component: content.value.component as ComponentDescriptor & { targetKey: string },
    shell: shell.value as ComponentTabShellProjection & { presenterId: string },
  };
}

function fillableEmpty(inspection: TabPlacementRecordInspection): number | null {
  const { record, content, tab, shell } = inspection;
  if (!content.ok
    || content.value.kind !== 'empty'
    || !tab.ok
    || tab.value.id !== record.tabId
    || !shell.ok
    || shell.value.tabId !== record.tabId
    || shell.value.presenterId !== null) return null;
  return content.value.revision;
}

export function classifyTabPlacement(
  requestValue: unknown,
  snapshotValue: unknown,
): TabPlacementDecisionResult {
  const request = validateTabPlacementRequest(requestValue);
  if (!request.ok) return request;
  const snapshot = inspectTabPlacementSnapshot(snapshotValue, request.value.requestId);
  if (!snapshot.ok) return snapshot;
  const usedComponentInstanceIds = snapshot.inspections.flatMap((inspection) => (
    inspection.content.ok && inspection.content.value.kind === 'component'
      ? [inspection.content.value.component.componentInstanceId]
      : []
  ));

  const matches = snapshot.inspections.flatMap((inspection) => {
    const correlated = correlatedComponent(inspection);
    return correlated
      && correlated.shell.presenterId === request.value.target.presenterId
      && correlated.component.targetKey === request.value.target.targetKey
      ? [{ record: inspection.record, ...correlated }]
      : [];
  });
  if (matches.length > 1) {
    return {
      ok: false,
      failure: createTabPlacementFailure(
        request.value.requestId,
        'ambiguous_existing_target',
      ),
    };
  }
  if (matches.length === 1) {
    return {
      ok: true,
      decision: {
        kind: 'activate_existing',
        request: request.value,
        snapshot: snapshot.value,
        record: matches[0].record,
        component: matches[0].component,
        shell: matches[0].shell,
        usedComponentInstanceIds,
      },
    };
  }

  if (request.value.disposition === 'current' && snapshot.value.activeTabId !== null) {
    const active = snapshot.inspections.find(
      (inspection) => inspection.record.tabId === snapshot.value.activeTabId,
    );
    if (active && !snapshot.value.reservations.some(
      (reservation) => reservation.tabId === active.record.tabId,
    )) {
      const revision = fillableEmpty(active);
      if (revision !== null) {
        if (revision === Number.MAX_SAFE_INTEGER) {
          return {
            ok: false,
            failure: createTabPlacementFailure(request.value.requestId, 'invalid_state'),
          };
        }
        return {
          ok: true,
          decision: {
            kind: 'fill_current',
            request: request.value,
            snapshot: snapshot.value,
            record: active.record,
            revision,
            usedComponentInstanceIds,
          },
        };
      }
    }
  }
  return {
    ok: true,
    decision: {
      kind: 'append_new',
      request: request.value,
      snapshot: snapshot.value,
      usedComponentInstanceIds,
    },
  };
}

function invalidGeneratedId(decision: TabPlacementDecision): TabPlacementPlanResult {
  return {
    ok: false,
    failure: createTabPlacementFailure(decision.request.requestId, 'invalid_generated_id'),
  };
}

function idConflict(decision: TabPlacementDecision): TabPlacementPlanResult {
  return {
    ok: false,
    failure: createTabPlacementFailure(decision.request.requestId, 'id_conflict'),
  };
}

function planForExisting(
  decision: Extract<TabPlacementDecision, { kind: 'activate_existing' }>,
): TabPlacementPlanResult {
  const nextSnapshot: TabPlacementSnapshot = decision.snapshot.activeTabId === decision.record.tabId
    ? decision.snapshot
    : { ...decision.snapshot, activeTabId: decision.record.tabId };
  return {
    ok: true,
    plan: {
      schemaVersion: 1,
      request: decision.request,
      outcome: 'activated_existing',
      priorSnapshot: decision.snapshot,
      nextSnapshot,
      requiresCommit: nextSnapshot !== decision.snapshot,
      tabId: decision.record.tabId,
      componentTypeId: decision.component.componentTypeId,
      componentInstanceId: decision.component.componentInstanceId,
      presenterId: decision.shell.presenterId,
      targetKey: decision.component.targetKey,
    },
  };
}

function committedRecord(
  tabId: string,
  revision: number,
  componentInstanceId: string,
  resolved: ResolvedTabPlacementTarget,
): TabPlacementSnapshotRecord {
  return {
    tabId,
    content: {
      kind: 'component',
      revision,
      component: {
        schemaVersion: 1,
        componentTypeId: resolved.componentTypeId,
        componentInstanceId,
        input: resolved.input,
        targetKey: resolved.targetKey,
      },
    },
    tab: { id: tabId, ...resolved.tab },
    shell: {
      schemaVersion: 2,
      tabId,
      presenterId: resolved.presenterId,
      location: resolved.location,
    },
  };
}

export function completeTabPlacementPlan(
  decision: TabPlacementDecision,
  resolvedValue: unknown,
  generatedIds: TabPlacementGeneratedIds = { componentInstanceId: undefined },
): TabPlacementPlanResult {
  if (decision.kind === 'activate_existing') return planForExisting(decision);

  const resolved = validateResolvedTabPlacementTarget(resolvedValue);
  if (!resolved.ok) {
    return {
      ok: false,
      failure: createTabPlacementFailure(decision.request.requestId, 'target_unavailable'),
    };
  }
  if (resolved.value.presenterId !== decision.request.target.presenterId
    || resolved.value.targetKey !== decision.request.target.targetKey) {
    return {
      ok: false,
      failure: createTabPlacementFailure(
        decision.request.requestId,
        'target_contract_conflict',
      ),
    };
  }
  if (decision.kind === 'append_new'
    && decision.snapshot.tabs.length >= COMPONENT_TAB_LIMITS.maxContainerEntries) {
    return {
      ok: false,
      failure: createTabPlacementFailure(decision.request.requestId, 'capacity_exceeded'),
    };
  }

  const generated = exactPlacementDataRecord(
    generatedIds,
    ['componentInstanceId', 'tabId'],
    decision.kind === 'append_new'
      ? ['componentInstanceId', 'tabId']
      : ['componentInstanceId'],
  );
  if (!generated.ok) return invalidGeneratedId(decision);
  const componentInstanceId = generated.value.componentInstanceId;
  if (!isBoundedOpaqueId(componentInstanceId)) return invalidGeneratedId(decision);
  if (decision.usedComponentInstanceIds.includes(componentInstanceId)) {
    return idConflict(decision);
  }

  let tabId: string;
  let record: TabPlacementSnapshotRecord;
  let tabs: readonly TabPlacementSnapshotRecord[];
  if (decision.kind === 'fill_current') {
    tabId = decision.record.tabId;
    record = committedRecord(tabId, decision.revision + 1, componentInstanceId, resolved.value);
    tabs = decision.snapshot.tabs.map((candidate) => (
      candidate.tabId === tabId ? record : candidate
    ));
  } else {
    if (!isBoundedOpaqueId(generated.value.tabId)) return invalidGeneratedId(decision);
    tabId = generated.value.tabId;
    if (decision.snapshot.tabs.some((candidate) => candidate.tabId === tabId)) {
      return idConflict(decision);
    }
    record = committedRecord(tabId, 0, componentInstanceId, resolved.value);
    tabs = [...decision.snapshot.tabs, record];
  }

  const nextSnapshot: TabPlacementSnapshot = {
    schemaVersion: 1,
    tabs,
    activeTabId: tabId,
    reservations: decision.snapshot.reservations,
  };
  const plan: TabPlacementPlan = {
    schemaVersion: 1,
    request: decision.request,
    outcome: decision.kind === 'fill_current' ? 'filled_current' : 'appended_new',
    priorSnapshot: decision.snapshot,
    nextSnapshot,
    requiresCommit: true,
    tabId,
    componentTypeId: resolved.value.componentTypeId,
    componentInstanceId,
    presenterId: resolved.value.presenterId,
    targetKey: resolved.value.targetKey,
  };
  return { ok: true, plan };
}

export function planTabPlacement(
  requestValue: unknown,
  snapshotValue: unknown,
  resolvedValue?: unknown,
  generatedIds?: TabPlacementGeneratedIds,
): TabPlacementPlanResult {
  const classified = classifyTabPlacement(requestValue, snapshotValue);
  if (!classified.ok) return classified;
  return completeTabPlacementPlan(classified.decision, resolvedValue, generatedIds);
}

export function createTabPlacementSuccess(
  plan: TabPlacementPlan,
  reveal: 'not_required' | 'completed' | 'failed',
): TabPlacementResult {
  const safeReveal = plan.outcome === 'activated_existing'
    ? (reveal === 'completed' ? 'completed' : 'failed')
    : 'not_required';
  return {
    schemaVersion: 1,
    ok: true,
    requestId: plan.request.requestId,
    outcome: plan.outcome,
    tabId: plan.tabId,
    componentTypeId: plan.componentTypeId,
    componentInstanceId: plan.componentInstanceId,
    presenterId: plan.presenterId,
    targetKey: plan.targetKey,
    reveal: safeReveal,
  };
}
