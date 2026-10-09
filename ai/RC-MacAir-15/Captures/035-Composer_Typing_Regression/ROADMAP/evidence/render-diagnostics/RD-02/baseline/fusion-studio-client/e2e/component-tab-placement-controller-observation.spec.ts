import { expect, test } from '@playwright/test';
import {
  createConnectedTabPlacementController,
  type TabPlacementSnapshotRecord,
} from '../src/components/view-tabs/componentTabDomain';
import {
  componentPlacementRecord as componentRecord,
  emptyPlacementRecord as emptyRecord,
  placementRequest as request,
  placementSnapshot as snapshot,
} from './component-tab-placement-controller-fixtures';

function never(): never {
  throw new Error('must not run');
}

test('already-active observation mutation fails before reveal', async () => {
  let getterReads = 0;
  let reads = 0;
  let reveals = 0;
  const protectedContent = {
    kind: 'component',
    revision: 1,
    marker: 'before',
    get component() { getterReads += 1; return null; },
  };
  const protectedRecord: TabPlacementSnapshotRecord = {
    ...emptyRecord('tab-protected'),
    content: protectedContent,
  };
  const state = snapshot([componentRecord(), protectedRecord], 'tab-alpha');
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => {
      reads += 1;
      if (reads === 2) protectedContent.marker = 'mutated-by-observation';
      return state;
    },
    resolveTarget: never,
    mintTabId: never,
    mintComponentInstanceId: never,
    commit: never,
    reveal: () => { reveals += 1; },
  });
  await expect(controller.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'state_commit_failed',
  });
  expect(reads).toBe(2);
  expect(reveals).toBe(0);
  expect(getterReads).toBe(0);
});

test('already-active match rejects opaque and function-bearing protected graphs', async () => {
  for (const hiddenState of [new Map([['before', 1]]), () => 'hidden']) {
    let reads = 0;
    let getterReads = 0;
    let reveals = 0;
    const protectedContent = {
      kind: 'component',
      revision: 1,
      hiddenState,
      get component() { getterReads += 1; return null; },
    };
    const protectedRecord: TabPlacementSnapshotRecord = {
      ...emptyRecord('tab-protected'),
      content: protectedContent,
    };
    const state = snapshot([componentRecord(), protectedRecord], 'tab-alpha');
    const controller = createConnectedTabPlacementController({
      readSnapshot: () => { reads += 1; return state; },
      resolveTarget: never,
      mintTabId: never,
      mintComponentInstanceId: never,
      commit: never,
      reveal: () => { reveals += 1; },
    });
    await expect(controller.place(request())).resolves.toMatchObject({
      ok: false,
      code: 'state_commit_failed',
    });
    expect(reads).toBe(1);
    expect(reveals).toBe(0);
    expect(getterReads).toBe(0);
  }
});
