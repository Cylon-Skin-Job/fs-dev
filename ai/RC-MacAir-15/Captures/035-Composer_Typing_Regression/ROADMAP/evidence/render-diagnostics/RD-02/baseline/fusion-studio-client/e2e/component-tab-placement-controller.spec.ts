import { expect, test } from '@playwright/test';
import {
  COMPONENT_TAB_LIMITS,
  createConnectedTabPlacementController,
  type TabPlacementCommitAcknowledgement,
  type TabPlacementCommitRequest,
  type TabPlacementRequest,
  type TabPlacementSnapshot,
  type TabPlacementSnapshotRecord,
} from '../src/components/view-tabs/componentTabDomain';
import {
  componentPlacementRecord as componentRecord,
  deferred,
  emptyPlacementRecord as emptyRecord,
  placementOwner as owner,
  placementRequest as request,
  placementSnapshot as snapshot,
  resolvedTarget as resolved,
} from './component-tab-placement-controller-fixtures';

test('invalid request, invalid state, ambiguity, and exact matches skip creation effects', async () => {
  for (const [requestValue, initial, expectedCode] of [
    [{ ...request(), disposition: 'replace' }, snapshot(), 'invalid_request'],
    [request(), { ...snapshot(), activeTabId: 'missing' }, 'invalid_state'],
    [request(), snapshot([
      componentRecord('tab-a', 'presenter.files', 'file:alpha', 'component-a'),
      componentRecord('tab-b', 'presenter.files', 'file:alpha', 'component-b'),
    ]), 'ambiguous_existing_target'],
  ] as const) {
    const events: string[] = [];
    const harness = owner({ initial: initial as TabPlacementSnapshot, events });
    await expect(harness.controller.place(requestValue as TabPlacementRequest)).resolves.toMatchObject({
      ok: false,
      code: expectedCode,
    });
    expect(events.filter((event) => event !== 'read')).toEqual([]);
  }

  const events: string[] = [];
  const harness = owner({
    initial: snapshot([componentRecord()], 'tab-alpha'),
    events,
    reveal: () => { events.push('reveal'); },
  });
  await expect(harness.controller.place(request())).resolves.toMatchObject({
    ok: true,
    outcome: 'activated_existing',
    reveal: 'completed',
  });
  expect(events).toEqual(['read', 'read', 'reveal']);
});

test('hostile port accessors are never invoked and fail through a bounded result', async () => {
  let reads = 0;
  const hostilePorts = {
    get readSnapshot() { reads += 1; throw new Error('/private/port.ts'); },
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: () => { throw new Error('must not run'); },
  };
  const controller = createConnectedTabPlacementController(hostilePorts as never);
  await expect(controller.place(request())).resolves.toEqual({
    schemaVersion: 1,
    ok: false,
    requestId: 'request-1',
    code: 'invalid_state',
    message: 'The tab collection is not available for placement.',
  });
  expect(reads).toBe(0);
});

test('valid no-match resolves synchronously exactly once and rejects thenable output', async () => {
  let resolves = 0;
  let thenCalls = 0;
  const harness = owner({
    resolve: () => {
      resolves += 1;
      return { then: () => { thenCalls += 1; } };
    },
  });
  await expect(harness.controller.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'target_unavailable',
  });
  expect(resolves).toBe(1);
  expect(thenCalls).toBe(0);
  expect(harness.commits).toHaveLength(0);
});

test('resolver throw and identity conflict are bounded and do not mint or commit', async () => {
  for (const [resolveTarget, expectedCode] of [
    [() => { throw new Error('/Users/private/project/target.ts'); }, 'target_unavailable'],
    [() => resolved('presenter.wrong'), 'target_contract_conflict'],
  ] as const) {
    const events: string[] = [];
    const harness = owner({ resolve: resolveTarget, events });
    const result = await harness.controller.place(request());
    expect(result).toMatchObject({
      ok: false,
      code: expectedCode,
    });
    expect(result.ok ? '' : result.message).not.toContain('/Users/private');
    expect(events).toEqual(['read', 'read']);
    expect(harness.commits).toHaveLength(0);
  }
});

test('resolver cannot rewrite the validated request identity it receives', async () => {
  const harness = owner({
    resolve: (target) => {
      target.presenterId = 'presenter.rewritten';
      target.targetKey = 'file:rewritten';
      return resolved('presenter.rewritten', 'file:rewritten');
    },
  });
  await expect(harness.controller.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'target_contract_conflict',
    requestId: 'request-1',
  });
  expect(harness.commits).toHaveLength(0);
});

test('fill and append use required factories in deterministic order and commit once', async () => {
  const fillEvents: string[] = [];
  const fill = owner({ events: fillEvents });
  await expect(fill.controller.place(request())).resolves.toMatchObject({
    ok: true,
    outcome: 'filled_current',
    reveal: 'not_required',
  });
  expect(fillEvents).toEqual([
    'read', 'resolve', 'read', 'mint-component', 'read', 'read', 'commit', 'read',
  ]);
  expect(fill.commits).toHaveLength(1);

  const appendEvents: string[] = [];
  const append = owner({ initial: snapshot([componentRecord()], 'tab-alpha'), events: appendEvents });
  await expect(append.controller.place(request('request-2', 'new', 'presenter.files', 'file:beta')))
    .resolves.toMatchObject({ ok: true, outcome: 'appended_new', reveal: 'not_required' });
  expect(appendEvents).toEqual([
    'read', 'resolve', 'read', 'mint-tab', 'read', 'mint-component', 'read',
    'read', 'commit', 'read',
  ]);
  expect(append.commits).toHaveLength(1);
});

test('capacity rejection occurs after one resolution and before either ID factory', async () => {
  const full = Array.from(
    { length: COMPONENT_TAB_LIMITS.maxContainerEntries },
    (_, index) => componentRecord(`tab-${index}`, 'presenter.other', `other-${index}`, `instance-${index}`),
  );
  const events: string[] = [];
  const harness = owner({ initial: snapshot(full, 'tab-0'), events });
  await expect(harness.controller.place(request('request-capacity', 'new'))).resolves.toMatchObject({
    ok: false,
    code: 'capacity_exceeded',
  });
  expect(events).toEqual(['read', 'resolve', 'read']);
});

test('factory failures are contained and cannot reach commit', async () => {
  const base = owner();
  const badFactoryController = createConnectedTabPlacementController({
    readSnapshot: () => base.getState(),
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => { throw new Error('/private/factory.ts'); },
    commit: () => { throw new Error('must not run'); },
  });
  await expect(badFactoryController.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'invalid_generated_id',
    message: 'A fresh valid placement identifier is required.',
  });
});

test('inactive exact match commits once, observes exact state, then reveals exact identity', async () => {
  const events: string[] = [];
  const payloads: unknown[] = [];
  const harness = owner({
    initial: snapshot([emptyRecord('tab-current'), componentRecord()], 'tab-current'),
    events,
    reveal: (payload) => { events.push('reveal'); payloads.push(payload); },
  });
  await expect(harness.controller.place(request())).resolves.toEqual({
    schemaVersion: 1,
    ok: true,
    requestId: 'request-1',
    outcome: 'activated_existing',
    tabId: 'tab-alpha',
    componentTypeId: 'fixture.file',
    componentInstanceId: 'component-alpha',
    presenterId: 'presenter.files',
    targetKey: 'file:alpha',
    reveal: 'completed',
  });
  expect(events).toEqual(['read', 'read', 'commit', 'read', 'reveal']);
  expect(harness.commits).toHaveLength(1);
  expect(payloads).toEqual([{
    tabId: 'tab-alpha',
    componentInstanceId: 'component-alpha',
    presenterId: 'presenter.files',
    targetKey: 'file:alpha',
  }]);
});

test('commit acknowledgement is awaited and success waits for the fresh owner read', async () => {
  const acknowledgement = deferred<TabPlacementCommitAcknowledgement>();
  let state: unknown = snapshot();
  let settled = false;
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: (commitRequest) => {
      state = commitRequest.nextSnapshot;
      return acknowledgement.promise;
    },
  });
  const placement = controller.place(request()).then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  acknowledgement.resolve({ schemaVersion: 1, status: 'committed', snapshot: state });
  await expect(placement).resolves.toMatchObject({ ok: true, outcome: 'filled_current' });
});

test('false, throw, reject, malformed, hostile thenable, and snapshot mismatch acknowledgements fail', async () => {
  let acknowledgementGetterReads = 0;
  const hostileThenable = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(hostileThenable, 'then', {
    get() { throw new Error('/private/acknowledgement.ts'); },
  });
  const cases: Array<(requestValue: TabPlacementCommitRequest) => unknown> = [
    () => false,
    () => { throw new Error('/private/commit.ts'); },
    () => Promise.reject(new Error('/private/rejection.ts')),
    () => ({ schemaVersion: 1, status: 'committed' }),
    (commitRequest) => ({
      schemaVersion: 1,
      status: 'committed',
      snapshot: commitRequest.nextSnapshot,
      extra: true,
    }),
    (commitRequest) => Object.assign({
      schemaVersion: 1,
      status: 'committed',
      snapshot: commitRequest.nextSnapshot,
    }, { [Symbol('extra')]: true }),
    () => Object.defineProperty({ schemaVersion: 1, status: 'committed' }, 'snapshot', {
      enumerable: true,
      get() { acknowledgementGetterReads += 1; return snapshot(); },
    }),
    () => hostileThenable,
    (commitRequest) => ({
      schemaVersion: 1,
      status: 'committed',
      snapshot: { ...commitRequest.nextSnapshot, activeTabId: null },
    }),
  ];
  for (const commit of cases) {
    const harness = owner({ commit });
    const result = await harness.controller.place(request());
    expect(result).toEqual({
      schemaVersion: 1,
      ok: false,
      requestId: 'request-1',
      code: 'state_commit_failed',
      message: 'The tab placement could not be committed.',
    });
  }
  expect(acknowledgementGetterReads).toBe(0);
});

test('committed acknowledgement still fails when the fresh authoritative snapshot is stale or partial', async () => {
  let state: unknown = snapshot();
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: (commitRequest) => ({
      schemaVersion: 1,
      status: 'committed',
      snapshot: commitRequest.nextSnapshot,
    }),
  });
  await expect(controller.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'state_commit_failed',
  });

  state = snapshot();
  const partial = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: (commitRequest) => {
      state = { ...commitRequest.nextSnapshot, tabs: commitRequest.priorSnapshot.tabs };
      return { schemaVersion: 1, status: 'committed', snapshot: state };
    },
  });
  await expect(partial.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'state_commit_failed',
  });

  state = snapshot();
  const mutatedArgument = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: (commitRequest) => {
      const mutable = commitRequest.nextSnapshot as { activeTabId: string | null };
      mutable.activeTabId = null;
      state = commitRequest.nextSnapshot;
      return { schemaVersion: 1, status: 'committed', snapshot: state };
    },
  });
  await expect(mutatedArgument.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'state_commit_failed',
  });
});

test('rejected commit verifies unchanged state and rejects owner mutation without a second write', async () => {
  for (const mutate of [false, true]) {
    let state: unknown = snapshot();
    let commits = 0;
    const controller = createConnectedTabPlacementController({
      readSnapshot: () => state,
      resolveTarget: () => resolved(),
      mintTabId: () => 'tab-new',
      mintComponentInstanceId: () => 'component-new',
      commit: (commitRequest) => {
        commits += 1;
        if (mutate) state = commitRequest.nextSnapshot;
        return {
          schemaVersion: 1,
          status: 'rejected',
          snapshot: mutate ? state : commitRequest.priorSnapshot,
        };
      },
    });
    await expect(controller.place(request())).resolves.toMatchObject({
      ok: false,
      code: 'state_commit_failed',
    });
    expect(commits).toBe(1);
  }
});

test('protected invalid nested slots remain exact references through acknowledged append', async () => {
  let reads = 0;
  const protectedContent = {
    kind: 'component',
    revision: 1,
    get component() { reads += 1; return null; },
  };
  Object.defineProperty(protectedContent, 'self', {
    value: protectedContent,
    enumerable: true,
  });
  const protectedRecord: TabPlacementSnapshotRecord = {
    tabId: 'tab-protected',
    content: protectedContent,
    tab: undefined,
    shell: undefined,
  };
  const harness = owner({ initial: snapshot([protectedRecord], 'tab-protected') });
  await expect(harness.controller.place(request())).resolves.toMatchObject({
    ok: true,
    outcome: 'appended_new',
  });
  const committed = harness.getState() as TabPlacementSnapshot;
  expect(committed.tabs[0]?.content).toBe(protectedContent);
  expect(reads).toBe(0);
});
