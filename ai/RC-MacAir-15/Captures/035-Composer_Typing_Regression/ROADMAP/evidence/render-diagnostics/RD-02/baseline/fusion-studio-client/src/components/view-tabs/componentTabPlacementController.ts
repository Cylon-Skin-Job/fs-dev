import { COMPONENT_TAB_LIMITS } from './componentTabTypes';
import {
  classifyTabPlacement,
  completeTabPlacementPlan,
  createTabPlacementSuccess,
} from './componentTabPlacement';
import {
  captureTabPlacementSnapshot,
  isExactTabPlacementSnapshot,
  type CapturedTabPlacementSnapshot,
} from './componentTabPlacementSnapshotComparison';
import {
  createTabPlacementFailure,
  validateResolvedTabPlacementTarget,
  validateTabPlacementRequest,
} from './componentTabPlacementValidation';
import { exactPlacementDataRecord } from './componentTabPlacementValidationSupport';
import type {
  TabPlacementCommitAcknowledgement,
  TabPlacementCommitRequest,
  TabPlacementController,
  TabPlacementControllerPorts,
  TabPlacementFailure,
  TabPlacementPlan,
  TabPlacementResult,
  TabPlacementRevealRequest,
  TabPlacementTargetRef,
} from './componentTabPlacementTypes';

interface SafeControllerPorts {
  readSnapshot: (() => unknown) | null;
  resolveTarget: ((target: TabPlacementTargetRef) => unknown) | null;
  mintTabId: (() => unknown) | null;
  mintComponentInstanceId: (() => unknown) | null;
  commit: ((request: TabPlacementCommitRequest) => unknown) | null;
  reveal: ((request: TabPlacementRevealRequest) => unknown) | null;
}

type LockedPlacementResult =
  | { ok: false; result: TabPlacementFailure }
  | { ok: true; plan: TabPlacementPlan };

function ownFunction(value: unknown, key: string): ((...args: never[]) => unknown) | null {
  try {
    if (typeof value !== 'object' || value === null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable && 'value' in descriptor && typeof descriptor.value === 'function'
      ? descriptor.value as (...args: never[]) => unknown
      : null;
  } catch {
    return null;
  }
}

function normalizePorts(value: unknown): SafeControllerPorts {
  return {
    readSnapshot: ownFunction(value, 'readSnapshot') as SafeControllerPorts['readSnapshot'],
    resolveTarget: ownFunction(value, 'resolveTarget') as SafeControllerPorts['resolveTarget'],
    mintTabId: ownFunction(value, 'mintTabId') as SafeControllerPorts['mintTabId'],
    mintComponentInstanceId: ownFunction(
      value,
      'mintComponentInstanceId',
    ) as SafeControllerPorts['mintComponentInstanceId'],
    commit: ownFunction(value, 'commit') as SafeControllerPorts['commit'],
    reveal: ownFunction(value, 'reveal') as SafeControllerPorts['reveal'],
  };
}

function commitAcknowledgement(value: unknown): TabPlacementCommitAcknowledgement | null {
  const acknowledgement = exactPlacementDataRecord(
    value,
    ['schemaVersion', 'status', 'snapshot'],
    ['schemaVersion', 'status', 'snapshot'],
  );
  if (!acknowledgement.ok
    || acknowledgement.value.schemaVersion !== 1
    || (acknowledgement.value.status !== 'committed'
      && acknowledgement.value.status !== 'rejected')) return null;
  return {
    schemaVersion: 1,
    status: acknowledgement.value.status,
    snapshot: acknowledgement.value.snapshot as TabPlacementCommitAcknowledgement['snapshot'],
  };
}

function safeRead(ports: SafeControllerPorts): unknown {
  if (!ports.readSnapshot) return undefined;
  try {
    return ports.readSnapshot();
  } catch {
    return undefined;
  }
}

function safeCall(factory: (() => unknown) | null): unknown {
  if (!factory) return undefined;
  try {
    return factory();
  } catch {
    return undefined;
  }
}

function failure(plan: TabPlacementPlan): TabPlacementFailure {
  return createTabPlacementFailure(plan.request.requestId, 'state_commit_failed');
}

async function applyAndObserve(
  ports: SafeControllerPorts,
  plan: TabPlacementPlan,
  suppliedPrior?: CapturedTabPlacementSnapshot,
): Promise<boolean> {
  if (!ports.commit) return false;
  const expectedPrior = suppliedPrior ?? captureTabPlacementSnapshot(plan.priorSnapshot);
  const expectedNext = captureTabPlacementSnapshot(plan.nextSnapshot);
  if (!expectedPrior || !expectedNext) return false;
  const plannedPriorIsExact = isExactTabPlacementSnapshot(expectedPrior, plan.priorSnapshot);
  const observedPriorIsExact = isExactTabPlacementSnapshot(expectedPrior, safeRead(ports));
  if (!plannedPriorIsExact || !observedPriorIsExact) return false;
  const commitRequest: TabPlacementCommitRequest = {
    schemaVersion: 1,
    priorSnapshot: plan.priorSnapshot,
    nextSnapshot: plan.nextSnapshot,
  };
  let acknowledgement: TabPlacementCommitAcknowledgement | null = null;
  try {
    acknowledgement = commitAcknowledgement(await ports.commit(commitRequest));
  } catch {
    // The final fresh read below still checks for a partial owner write.
  }
  const expected = acknowledgement?.status === 'committed'
    ? expectedNext
    : expectedPrior;
  const acknowledgedStateIsExact = acknowledgement !== null
    && isExactTabPlacementSnapshot(expected, acknowledgement.snapshot);
  const observedStateIsExact = isExactTabPlacementSnapshot(expected, safeRead(ports));
  return acknowledgement?.status === 'committed'
    && acknowledgedStateIsExact
    && observedStateIsExact;
}

function samePlacementIdentity(left: TabPlacementPlan, right: TabPlacementPlan): boolean {
  return left.outcome === 'activated_existing'
    && right.outcome === 'activated_existing'
    && left.tabId === right.tabId
    && left.componentTypeId === right.componentTypeId
    && left.componentInstanceId === right.componentInstanceId
    && left.presenterId === right.presenterId
    && left.targetKey === right.targetKey;
}

function safelyResolve(
  ports: SafeControllerPorts,
  target: TabPlacementTargetRef,
): unknown {
  if (!ports.resolveTarget) return undefined;
  try {
    return ports.resolveTarget(target);
  } catch {
    return undefined;
  }
}

function priorRemainsExact(
  ports: SafeControllerPorts,
  expected: CapturedTabPlacementSnapshot,
  plannedPrior: TabPlacementPlan['priorSnapshot'],
): boolean {
  const plannedPriorIsExact = isExactTabPlacementSnapshot(expected, plannedPrior);
  const observedPriorIsExact = isExactTabPlacementSnapshot(expected, safeRead(ports));
  return plannedPriorIsExact && observedPriorIsExact;
}

async function executeLocked(
  ports: SafeControllerPorts,
  requestValue: unknown,
): Promise<LockedPlacementResult> {
  const request = validateTabPlacementRequest(requestValue);
  if (!request.ok) return { ok: false, result: request.failure };
  const classified = classifyTabPlacement(request.value, safeRead(ports));
  if (!classified.ok) return { ok: false, result: classified.failure };

  if (classified.decision.kind === 'activate_existing') {
    const planned = completeTabPlacementPlan(classified.decision, undefined);
    if (!planned.ok) return { ok: false, result: planned.failure };
    if (planned.plan.requiresCommit) {
      return await applyAndObserve(ports, planned.plan)
        ? { ok: true, plan: planned.plan }
        : { ok: false, result: failure(planned.plan) };
    }
    const expectedPrior = captureTabPlacementSnapshot(planned.plan.priorSnapshot);
    if (!expectedPrior) return { ok: false, result: failure(planned.plan) };
    const observed = safeRead(ports);
    const verified = classifyTabPlacement(request.value, observed);
    const plannedPriorIsExact = isExactTabPlacementSnapshot(
      expectedPrior,
      planned.plan.priorSnapshot,
    );
    const observedPriorIsExact = isExactTabPlacementSnapshot(expectedPrior, observed);
    if (!verified.ok || verified.decision.kind !== 'activate_existing') {
      return { ok: false, result: failure(planned.plan) };
    }
    const latest = completeTabPlacementPlan(verified.decision, undefined);
    if (!latest.ok
      || !plannedPriorIsExact
      || !observedPriorIsExact
      || latest.plan.requiresCommit
      || !samePlacementIdentity(planned.plan, latest.plan)) {
      return { ok: false, result: failure(planned.plan) };
    }
    return { ok: true, plan: latest.plan };
  }

  const expectedPrior = captureTabPlacementSnapshot(classified.decision.snapshot);
  if (!expectedPrior) {
    return {
      ok: false,
      result: createTabPlacementFailure(request.value.requestId, 'state_commit_failed'),
    };
  }
  const requestedPresenterId = request.value.target.presenterId;
  const requestedTargetKey = request.value.target.targetKey;
  const resolvedValue = safelyResolve(ports, {
    presenterId: requestedPresenterId,
    targetKey: requestedTargetKey,
  });
  if (!priorRemainsExact(ports, expectedPrior, classified.decision.snapshot)) {
    return {
      ok: false,
      result: createTabPlacementFailure(request.value.requestId, 'state_commit_failed'),
    };
  }
  const resolved = validateResolvedTabPlacementTarget(resolvedValue);
  if (!resolved.ok) {
    return {
      ok: false,
      result: createTabPlacementFailure(request.value.requestId, 'target_unavailable'),
    };
  }
  if (resolved.value.presenterId !== requestedPresenterId
    || resolved.value.targetKey !== requestedTargetKey) {
    return {
      ok: false,
      result: createTabPlacementFailure(request.value.requestId, 'target_contract_conflict'),
    };
  }
  if (classified.decision.kind === 'append_new'
    && classified.decision.snapshot.tabs.length >= COMPONENT_TAB_LIMITS.maxContainerEntries) {
    return {
      ok: false,
      result: createTabPlacementFailure(request.value.requestId, 'capacity_exceeded'),
    };
  }

  let generatedIds;
  if (classified.decision.kind === 'append_new') {
    const tabId = safeCall(ports.mintTabId);
    if (!priorRemainsExact(ports, expectedPrior, classified.decision.snapshot)) {
      return {
        ok: false,
        result: createTabPlacementFailure(request.value.requestId, 'state_commit_failed'),
      };
    }
    generatedIds = {
      tabId,
      componentInstanceId: safeCall(ports.mintComponentInstanceId),
    };
  } else {
    generatedIds = { componentInstanceId: safeCall(ports.mintComponentInstanceId) };
  }
  if (!priorRemainsExact(ports, expectedPrior, classified.decision.snapshot)) {
    return {
      ok: false,
      result: createTabPlacementFailure(request.value.requestId, 'state_commit_failed'),
    };
  }
  const planned = completeTabPlacementPlan(classified.decision, resolved.value, generatedIds);
  if (!planned.ok) return { ok: false, result: planned.failure };
  return await applyAndObserve(ports, planned.plan, expectedPrior)
    ? { ok: true, plan: planned.plan }
    : { ok: false, result: failure(planned.plan) };
}

async function revealExisting(
  ports: SafeControllerPorts,
  plan: TabPlacementPlan,
): Promise<TabPlacementResult> {
  if (!ports.reveal) return createTabPlacementSuccess(plan, 'failed');
  const request: TabPlacementRevealRequest = {
    tabId: plan.tabId,
    componentInstanceId: plan.componentInstanceId,
    presenterId: plan.presenterId,
    targetKey: plan.targetKey,
  };
  try {
    const outcome = await ports.reveal(request);
    return createTabPlacementSuccess(plan, outcome === undefined ? 'completed' : 'failed');
  } catch {
    return createTabPlacementSuccess(plan, 'failed');
  }
}

/** Creates one instance-local placement route for all connected navigation sources. */
export function createConnectedTabPlacementController(
  suppliedPorts: TabPlacementControllerPorts,
): TabPlacementController {
  const ports = normalizePorts(suppliedPorts);
  let lane = Promise.resolve();
  return {
    place(requestValue: unknown): Promise<TabPlacementResult> {
      const prior = lane;
      let release: () => void = () => undefined;
      lane = new Promise<void>((resolve) => { release = resolve; });
      return (async () => {
        await prior;
        let locked: LockedPlacementResult;
        try {
          locked = await executeLocked(ports, requestValue);
        } catch {
          const request = validateTabPlacementRequest(requestValue);
          locked = {
            ok: false,
            result: request.ok
              ? createTabPlacementFailure(request.value.requestId, 'invalid_state')
              : request.failure,
          };
        } finally {
          release();
        }
        if (!locked.ok) return locked.result;
        return locked.plan.outcome === 'activated_existing'
          ? revealExisting(ports, locked.plan)
          : createTabPlacementSuccess(locked.plan, 'not_required');
      })();
    },
  };
}
