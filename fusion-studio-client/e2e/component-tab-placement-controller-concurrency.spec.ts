import { expect, test } from '@playwright/test';
import {
  createConnectedTabPlacementController,
  type TabPlacementCommitAcknowledgement,
  type TabPlacementControllerPorts,
  type TabPlacementSnapshot,
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

test('same-target concurrency commits once and the later request activates existing', async () => {
  const firstCommit = deferred<TabPlacementCommitAcknowledgement>();
  let state: unknown = snapshot();
  let commitCalls = 0;
  let reveals = 0;
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: (commitRequest) => {
      commitCalls += 1;
      state = commitRequest.nextSnapshot;
      return firstCommit.promise;
    },
    reveal: () => { reveals += 1; },
  });
  const first = controller.place(request('request-first'));
  const second = controller.place(request('request-second'));
  await Promise.resolve();
  firstCommit.resolve({ schemaVersion: 1, status: 'committed', snapshot: state });
  await expect(first).resolves.toMatchObject({ ok: true, outcome: 'filled_current' });
  await expect(second).resolves.toMatchObject({ ok: true, outcome: 'activated_existing' });
  expect(commitCalls).toBe(1);
  expect(reveals).toBe(1);
});

test('distinct concurrent requests consume one Empty in controller-arrival order', async () => {
  let state: unknown = snapshot();
  const outcomes: string[] = [];
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: (target) => resolved(target.presenterId, target.targetKey),
    mintTabId: () => 'tab-second',
    mintComponentInstanceId: (() => {
      let count = 0;
      return () => `component-${++count}`;
    })(),
    commit: async (commitRequest) => {
      outcomes.push((commitRequest.nextSnapshot.tabs.length === 1) ? 'fill' : 'append');
      state = commitRequest.nextSnapshot;
      return { schemaVersion: 1, status: 'committed', snapshot: state };
    },
  });
  const first = controller.place(request('request-a', 'current', 'presenter.files', 'file:a'));
  const second = controller.place(request('request-b', 'current', 'presenter.files', 'file:b'));
  await expect(first).resolves.toMatchObject({ ok: true, outcome: 'filled_current' });
  await expect(second).resolves.toMatchObject({ ok: true, outcome: 'appended_new' });
  expect(outcomes).toEqual(['fill', 'append']);
});

test('lane releases before reveal so a pending presenter cannot block later placement', async () => {
  const reveal = deferred<void>();
  let state: unknown = snapshot([componentRecord()], 'tab-alpha');
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => state,
    resolveTarget: (target) => resolved(target.presenterId, target.targetKey),
    mintTabId: () => 'tab-beta',
    mintComponentInstanceId: () => 'component-beta',
    commit: (commitRequest) => {
      state = commitRequest.nextSnapshot;
      return { schemaVersion: 1, status: 'committed', snapshot: state };
    },
    reveal: () => reveal.promise,
  });
  const first = controller.place(request('request-a'));
  const second = controller.place(request('request-b', 'new', 'presenter.files', 'file:beta'));
  await expect(second).resolves.toMatchObject({ ok: true, outcome: 'appended_new' });
  let firstSettled = false;
  void first.then(() => { firstSettled = true; });
  await Promise.resolve();
  expect(firstSettled).toBe(false);
  reveal.resolve();
  await expect(first).resolves.toMatchObject({ ok: true, reveal: 'completed' });
});

test('absent, thrown, rejected, and non-void reveal fail safely without undoing activation', async () => {
  const privateError = new Error('/Users/private/presenter.ts');
  const variants: Array<TabPlacementControllerPorts['reveal'] | undefined> = [
    undefined,
    () => { throw privateError; },
    () => Promise.reject(privateError),
    () => 'rewritten-result',
  ];
  for (const revealTarget of variants) {
    const harness = owner({
      initial: snapshot([emptyRecord('tab-current'), componentRecord()], 'tab-current'),
      reveal: revealTarget,
    });
    const result = await harness.controller.place(request());
    expect(result).toMatchObject({ ok: true, outcome: 'activated_existing', reveal: 'failed' });
    expect((harness.getState() as TabPlacementSnapshot).activeTabId).toBe('tab-alpha');
    expect(JSON.stringify(result)).not.toContain('/Users/private');
  }
});
