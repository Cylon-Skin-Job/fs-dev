import { expect, test } from '@playwright/test';
import {
  createConnectedTabPlacementController,
  type TabPlacementSnapshotRecord,
} from '../src/components/view-tabs/componentTabDomain';
import {
  emptyPlacementRecord as emptyRecord,
  placementRequest as request,
  placementSnapshot as snapshot,
  resolvedTarget as resolved,
} from './component-tab-placement-controller-fixtures';

type ProtectedSlot = 'content' | 'tab' | 'shell';

function protectedValue(slot: ProtectedSlot, getterRead: () => void): Record<string, unknown> {
  if (slot === 'content') {
    return {
      kind: 'component',
      revision: 1,
      marker: 'before',
      get component() { getterRead(); return null; },
    };
  }
  if (slot === 'tab') {
    return {
      id: 'tab-protected',
      icon: 'file',
      closeLabel: 'Close protected',
      marker: 'before',
      get label() { getterRead(); return 'Protected'; },
    };
  }
  return {
    schemaVersion: 2,
    tabId: 'tab-protected',
    location: { schemaVersion: 1, segments: [{ label: 'Protected' }] },
    marker: 'before',
    get presenterId() { getterRead(); return null; },
  };
}

test('protected content/tab/shell descriptor mutations cannot redefine expected commit state', async () => {
  const cases: Array<{
    slot: ProtectedSlot;
    mutate: (value: Record<string, unknown>) => void;
  }> = [
    { slot: 'content', mutate: (value) => { value.tampered = true; } },
    { slot: 'tab', mutate: (value) => { delete value.marker; } },
    { slot: 'shell', mutate: (value) => { value.marker = 'after'; } },
  ];
  for (const { slot, mutate } of cases) {
    let getterReads = 0;
    const protectedSlot = protectedValue(slot, () => { getterReads += 1; });
    const record: TabPlacementSnapshotRecord = {
      ...emptyRecord('tab-protected'),
      [slot]: protectedSlot,
    };
    let state: unknown = snapshot([record], 'tab-protected');
    let commits = 0;
    const controller = createConnectedTabPlacementController({
      readSnapshot: () => state as never,
      resolveTarget: () => resolved(),
      mintTabId: () => 'tab-new',
      mintComponentInstanceId: () => 'component-new',
      commit: (commitRequest) => {
        commits += 1;
        mutate(protectedSlot);
        state = commitRequest.nextSnapshot;
        return { schemaVersion: 1, status: 'committed', snapshot: state as never };
      },
    });

    await expect(controller.place(request())).resolves.toEqual({
      schemaVersion: 1,
      ok: false,
      requestId: 'request-1',
      code: 'state_commit_failed',
      message: 'The tab placement could not be committed.',
    });
    expect(commits).toBe(1);
    expect(getterReads).toBe(0);
  }
});

test('hostile protected descriptor traps fail before commit without executing accessors', async () => {
  let getterReads = 0;
  let commits = 0;
  const protectedContent = new Proxy({
    kind: 'component',
    revision: 1,
    get component() { getterReads += 1; return null; },
  }, {
    ownKeys() { throw new Error('/private/protected-state.ts'); },
  });
  const record: TabPlacementSnapshotRecord = {
    ...emptyRecord('tab-protected'),
    content: protectedContent,
  };
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => snapshot([record], 'tab-protected'),
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: () => {
      commits += 1;
      throw new Error('must not run');
    },
  });
  await expect(controller.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'state_commit_failed',
  });
  expect(commits).toBe(0);
  expect(getterReads).toBe(0);
});

test('protected integrity, descriptor flags, prototypes, and aliases remain exact', async () => {
  const cases: Array<{
    nested: Record<string, unknown>;
    mutate: (content: Record<string, unknown>, nested: Record<string, unknown>) => void;
  }> = [
    {
      nested: { value: 'before' },
      mutate: (_content, nested) => { Object.preventExtensions(nested); },
    },
    {
      nested: { value: 'before' },
      mutate: (_content, nested) => {
        Object.defineProperty(nested, 'value', { writable: false });
      },
    },
    {
      nested: { value: 'before' },
      mutate: (_content, nested) => { Object.setPrototypeOf(nested, null); },
    },
    {
      nested: { value: 'shared' },
      mutate: (content, nested) => {
        const holder = content.holder as Record<string, unknown>;
        holder.right = { ...nested };
      },
    },
  ];
  for (const { nested, mutate } of cases) {
    let getterReads = 0;
    const content = {
      kind: 'component',
      revision: 1,
      nested,
      holder: { left: nested, right: nested },
      get component() { getterReads += 1; return null; },
    };
    const record: TabPlacementSnapshotRecord = {
      ...emptyRecord('tab-protected'),
      content,
    };
    let state: unknown = snapshot([record], 'tab-protected');
    let commits = 0;
    const controller = createConnectedTabPlacementController({
      readSnapshot: () => state as never,
      resolveTarget: () => resolved(),
      mintTabId: () => 'tab-new',
      mintComponentInstanceId: () => 'component-new',
      commit: (commitRequest) => {
        commits += 1;
        mutate(content, nested);
        state = commitRequest.nextSnapshot;
        return { schemaVersion: 1, status: 'committed', snapshot: state as never };
      },
    });
    await expect(controller.place(request())).resolves.toMatchObject({
      ok: false,
      code: 'state_commit_failed',
    });
    expect(commits).toBe(1);
    expect(getterReads).toBe(0);
  }
});

test('opaque built-in protected state is rejected before an unobservable internal-slot mutation', async () => {
  const nestedMap = new Map([['before', 1]]);
  let getterReads = 0;
  let commits = 0;
  const content = {
    kind: 'component',
    revision: 1,
    nestedMap,
    get component() { getterReads += 1; return null; },
  };
  const record: TabPlacementSnapshotRecord = {
    ...emptyRecord('tab-protected'),
    content,
  };
  const controller = createConnectedTabPlacementController({
    readSnapshot: () => snapshot([record], 'tab-protected'),
    resolveTarget: () => resolved(),
    mintTabId: () => 'tab-new',
    mintComponentInstanceId: () => 'component-new',
    commit: () => {
      commits += 1;
      nestedMap.set('after', 2);
      throw new Error('must not run');
    },
  });
  await expect(controller.place(request())).resolves.toMatchObject({
    ok: false,
    code: 'state_commit_failed',
  });
  expect(commits).toBe(0);
  expect(nestedMap.has('after')).toBe(false);
  expect(getterReads).toBe(0);
});

test('resolver and ID factories cannot redefine the captured protected prior state', async () => {
  for (const mutationSource of ['resolver', 'tab-id', 'component-id'] as const) {
    let getterReads = 0;
    const content = {
      kind: 'component',
      revision: 1,
      marker: 'before',
      get component() { getterReads += 1; return null; },
    };
    const record: TabPlacementSnapshotRecord = {
      ...emptyRecord('tab-protected'),
      content,
    };
    const calls = { resolver: 0, tabId: 0, componentId: 0, commit: 0 };
    const mutate = () => { content.marker = `mutated-by-${mutationSource}`; };
    const controller = createConnectedTabPlacementController({
      readSnapshot: () => snapshot([record], 'tab-protected'),
      resolveTarget: () => {
        calls.resolver += 1;
        if (mutationSource === 'resolver') mutate();
        return resolved();
      },
      mintTabId: () => {
        calls.tabId += 1;
        if (mutationSource === 'tab-id') mutate();
        return 'tab-new';
      },
      mintComponentInstanceId: () => {
        calls.componentId += 1;
        if (mutationSource === 'component-id') mutate();
        return 'component-new';
      },
      commit: () => {
        calls.commit += 1;
        throw new Error('must not run');
      },
    });
    await expect(controller.place(request())).resolves.toMatchObject({
      ok: false,
      code: 'state_commit_failed',
    });
    expect(calls).toEqual({
      resolver: 1,
      tabId: mutationSource === 'resolver' ? 0 : 1,
      componentId: mutationSource === 'component-id' ? 1 : 0,
      commit: 0,
    });
    expect(getterReads).toBe(0);
  }
});
