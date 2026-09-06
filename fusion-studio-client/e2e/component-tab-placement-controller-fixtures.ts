import {
  createConnectedTabPlacementController,
  type ResolvedTabPlacementTarget,
  type TabPlacementCommitRequest,
  type TabPlacementControllerPorts,
  type TabPlacementRequest,
  type TabPlacementSnapshot,
  type TabPlacementSnapshotRecord,
} from '../src/components/view-tabs/componentTabDomain';

export function placementRequest(
  requestId = 'request-1',
  disposition: 'current' | 'new' = 'current',
  presenterId = 'presenter.files',
  targetKey = 'file:alpha',
): TabPlacementRequest {
  return { schemaVersion: 1, requestId, disposition, target: { presenterId, targetKey } };
}

export function resolvedTarget(
  presenterId = 'presenter.files',
  targetKey = 'file:alpha',
): ResolvedTabPlacementTarget {
  return {
    schemaVersion: 1,
    presenterId,
    targetKey,
    componentTypeId: 'fixture.file',
    input: { targetKey },
    tab: { label: 'Alpha', icon: 'file', closeLabel: 'Close Alpha', closable: true },
    location: { schemaVersion: 1, segments: [{ label: 'Files' }, { label: 'Alpha' }] },
  };
}

export function emptyPlacementRecord(
  tabId = 'tab-empty',
  revision = 0,
): TabPlacementSnapshotRecord {
  return {
    tabId,
    content: { kind: 'empty', revision },
    tab: { id: tabId, label: 'New Tab', icon: 'plus', closeLabel: 'Close New Tab' },
    shell: {
      schemaVersion: 2,
      tabId,
      presenterId: null,
      location: { schemaVersion: 1, segments: [{ label: 'New Tab' }] },
    },
  };
}

export function componentPlacementRecord(
  tabId = 'tab-alpha',
  presenterId = 'presenter.files',
  targetKey = 'file:alpha',
  componentInstanceId = 'component-alpha',
): TabPlacementSnapshotRecord {
  return {
    tabId,
    content: {
      kind: 'component',
      revision: 1,
      component: {
        schemaVersion: 1,
        componentTypeId: 'fixture.file',
        componentInstanceId,
        input: { targetKey },
        targetKey,
      },
    },
    tab: { id: tabId, label: 'Alpha', icon: 'file', closeLabel: 'Close Alpha' },
    shell: {
      schemaVersion: 2,
      tabId,
      presenterId,
      location: { schemaVersion: 1, segments: [{ label: 'Alpha' }] },
    },
  };
}

export function placementSnapshot(
  tabs: readonly TabPlacementSnapshotRecord[] = [emptyPlacementRecord()],
  activeTabId: string | null = tabs[0]?.tabId ?? null,
): TabPlacementSnapshot {
  return { schemaVersion: 1, tabs, activeTabId, reservations: [] };
}

interface OwnerOptions {
  initial?: TabPlacementSnapshot;
  resolve?: (target: Parameters<TabPlacementControllerPorts['resolveTarget']>[0]) => unknown;
  commit?: (request: TabPlacementCommitRequest) => unknown;
  reveal?: (request: Parameters<NonNullable<TabPlacementControllerPorts['reveal']>>[0]) => unknown;
  events?: string[];
}

export function placementOwner(options: OwnerOptions = {}) {
  let state: unknown = options.initial ?? placementSnapshot();
  let nextTab = 1;
  let nextComponent = 1;
  const events = options.events ?? [];
  const commits: TabPlacementCommitRequest[] = [];
  const ports: TabPlacementControllerPorts = {
    readSnapshot: () => { events.push('read'); return state; },
    resolveTarget: (options.resolve ?? ((target) => {
      events.push('resolve');
      return resolvedTarget(target.presenterId, target.targetKey);
    })) as TabPlacementControllerPorts['resolveTarget'],
    mintTabId: () => { events.push('mint-tab'); return `tab-new-${nextTab++}`; },
    mintComponentInstanceId: () => {
      events.push('mint-component');
      return `component-new-${nextComponent++}`;
    },
    commit: (options.commit ?? ((commitRequest) => {
      events.push('commit');
      commits.push(commitRequest);
      state = commitRequest.nextSnapshot;
      return { schemaVersion: 1, status: 'committed', snapshot: state };
    })) as TabPlacementControllerPorts['commit'],
    ...(Object.hasOwn(options, 'reveal') ? {
      reveal: options.reveal as TabPlacementControllerPorts['reveal'],
    } : {}),
  };
  return {
    controller: createConnectedTabPlacementController(ports),
    events,
    commits,
    getState: () => state,
    setState: (value: unknown) => { state = value; },
  };
}

export function deferred<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
