import { expect, test } from '@playwright/test';
import {
  COMPONENT_TAB_LIMITS,
  classifyTabPlacement,
  planTabPlacement,
  type ResolvedTabPlacementTarget,
  type TabPlacementRequest,
  type TabPlacementSnapshot,
  type TabPlacementSnapshotRecord,
} from '../src/components/view-tabs/componentTabDomain';

function request(
  disposition: 'current' | 'new' = 'current',
  presenterId = 'presenter.files',
  targetKey = 'file:alpha',
): TabPlacementRequest {
  return { schemaVersion: 1, requestId: 'request-1', disposition, target: { presenterId, targetKey } };
}

function resolved(
  presenterId = 'presenter.files',
  targetKey = 'file:alpha',
): ResolvedTabPlacementTarget {
  return {
    schemaVersion: 1,
    presenterId,
    targetKey,
    componentTypeId: 'fixture.file',
    input: { url: 'https://example.test/private-looking-but-inert' },
    tab: { label: 'Alpha', icon: 'file', closeLabel: 'Close Alpha', closable: true },
    location: { schemaVersion: 1, segments: [{ label: 'Files' }, { label: 'Alpha' }] },
  };
}

function emptyRecord(tabId: string, revision = 0): TabPlacementSnapshotRecord {
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

function componentRecord(
  tabId: string,
  presenterId: string,
  targetKey: string,
  instanceId = `component-${tabId}`,
  componentTypeId = 'fixture.file',
): TabPlacementSnapshotRecord {
  return {
    tabId,
    content: {
      kind: 'component',
      revision: 3,
      component: {
        schemaVersion: 1,
        componentTypeId,
        componentInstanceId: instanceId,
        input: { targetKey },
        targetKey,
      },
    },
    tab: { id: tabId, label: 'Same Display', icon: 'file', closeLabel: 'Close Same Display' },
    shell: {
      schemaVersion: 2,
      tabId,
      presenterId,
      location: { schemaVersion: 1, segments: [{ label: 'Same Breadcrumb' }] },
    },
  };
}

function snapshot(
  tabs: readonly TabPlacementSnapshotRecord[],
  activeTabId: string | null = tabs[0]?.tabId ?? null,
  reservations: TabPlacementSnapshot['reservations'] = [],
): TabPlacementSnapshot {
  return { schemaVersion: 1, tabs, activeTabId, reservations };
}

const generated = { tabId: 'tab-generated', componentInstanceId: 'component-generated' };

test('current directly fills the active valid unreserved Empty in place', () => {
  const protectedBefore = componentRecord('tab-before', 'presenter.other', 'other');
  const active = emptyRecord('tab-empty', 7);
  const state = snapshot([protectedBefore, active], 'tab-empty');
  const result = planTabPlacement(request(), state, resolved(), generated);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.plan).toMatchObject({
    outcome: 'filled_current',
    tabId: 'tab-empty',
    componentInstanceId: 'component-generated',
    requiresCommit: true,
    nextSnapshot: { activeTabId: 'tab-empty' },
  });
  expect(result.plan.nextSnapshot.tabs[0]).toEqual(protectedBefore);
  expect(result.plan.nextSnapshot.tabs[1]).toMatchObject({
    tabId: 'tab-empty',
    content: {
      kind: 'component',
      revision: 8,
      component: { targetKey: 'file:alpha', componentInstanceId: 'component-generated' },
    },
    tab: { id: 'tab-empty', label: 'Alpha' },
    shell: { tabId: 'tab-empty', presenterId: 'presenter.files' },
  });
  expect(result.plan.nextSnapshot.reservations).toBe(result.plan.priorSnapshot.reservations);
});

test('new, populated current, no-active current, and empty collection append deterministically', () => {
  const populated = componentRecord('tab-existing', 'presenter.other', 'other');
  for (const [candidateRequest, state] of [
    [request('new'), snapshot([emptyRecord('tab-empty')], 'tab-empty')],
    [request('current'), snapshot([populated], 'tab-existing')],
    [request('current'), snapshot([populated], null)],
    [request('current'), snapshot([], null)],
  ] as const) {
    const result = planTabPlacement(candidateRequest, state, resolved(), generated);
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    expect(result.plan.outcome).toBe('appended_new');
    expect(result.plan.nextSnapshot.tabs).toHaveLength(state.tabs.length + 1);
    expect(result.plan.nextSnapshot.tabs.slice(0, state.tabs.length)).toEqual(state.tabs);
    expect(result.plan.nextSnapshot.activeTabId).toBe('tab-generated');
  }
});

test('a pending or failed reservation protects Empty and is preserved on append', () => {
  for (const status of ['pending', 'failed'] as const) {
    const reservation = {
      tabId: 'tab-empty',
      operationId: `operation-${status}`,
      expectedRevision: 2,
      launcherId: 'launcher-a',
      status,
      ...(status === 'failed' ? {
        error: {
          code: 'launch_failed',
          message: 'The component could not be opened. Try again.',
        },
      } : {}),
    };
    const state = snapshot([emptyRecord('tab-empty', 2)], 'tab-empty', [reservation]);
    const result = planTabPlacement(request(), state, resolved(), generated);
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    expect(result.plan.outcome).toBe('appended_new');
    expect(result.plan.nextSnapshot.reservations).toEqual([reservation]);
  }
});

test('exact presenter and target wins before disposition, resolution, and generated IDs', () => {
  const exact = componentRecord('tab-exact', 'presenter.files', 'file:alpha');
  const state = snapshot([emptyRecord('tab-active'), exact], 'tab-active');
  for (const disposition of ['current', 'new'] as const) {
    const result = planTabPlacement(
      request(disposition),
      state,
      { get schemaVersion() { throw new Error('resolver output must remain unread'); } },
      { componentInstanceId: '', tabId: '' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    expect(result.plan).toMatchObject({
      outcome: 'activated_existing',
      tabId: 'tab-exact',
      componentInstanceId: 'component-tab-exact',
      requiresCommit: true,
      nextSnapshot: { activeTabId: 'tab-exact' },
    });
    expect(result.plan.nextSnapshot.tabs).toEqual(state.tabs);
  }
  const alreadyActive = planTabPlacement(request(), snapshot([exact], 'tab-exact'));
  expect(alreadyActive).toMatchObject({ ok: true, plan: { requiresCommit: false } });
});

test('matching uses only exact presenterId plus targetKey, never display projection', () => {
  const sameTargetOtherPresenter = componentRecord('tab-p', 'presenter.other', 'file:alpha');
  const samePresenterOtherTarget = componentRecord('tab-t', 'presenter.files', 'file:other');
  const displayCollision = componentRecord('tab-d', 'presenter.other', 'file:other');
  const state = snapshot([sameTargetOtherPresenter, samePresenterOtherTarget, displayCollision]);
  const result = planTabPlacement(request('new'), state, resolved(), generated);
  expect(result).toMatchObject({ ok: true, plan: { outcome: 'appended_new' } });
});

test('duplicate exact targets and collection/type identity conflicts fail closed', () => {
  const duplicates = snapshot([
    componentRecord('tab-a', 'presenter.files', 'file:alpha'),
    componentRecord('tab-b', 'presenter.files', 'file:alpha'),
  ]);
  expect(classifyTabPlacement(request(), duplicates)).toMatchObject({
    ok: false,
    failure: { code: 'ambiguous_existing_target' },
  });

  const duplicateInstance = snapshot([
    componentRecord('tab-a', 'presenter.a', 'a', 'shared-instance', 'fixture.a'),
    componentRecord('tab-b', 'presenter.b', 'b', 'shared-instance', 'fixture.b'),
  ]);
  expect(classifyTabPlacement(request(), duplicateInstance)).toMatchObject({
    ok: false,
    failure: { code: 'invalid_state' },
  });
});

test('capacity permits exact activation and direct fill but rejects append', () => {
  const full = Array.from(
    { length: COMPONENT_TAB_LIMITS.maxContainerEntries },
    (_, index) => componentRecord(`tab-${index}`, 'presenter.other', `other-${index}`),
  );
  full[100] = componentRecord('tab-100', 'presenter.files', 'file:alpha');
  expect(planTabPlacement(request('new'), snapshot(full, 'tab-0'))).toMatchObject({
    ok: true,
    plan: { outcome: 'activated_existing', tabId: 'tab-100' },
  });

  full[100] = emptyRecord('tab-100', 4);
  expect(planTabPlacement(request(), snapshot(full, 'tab-100'), resolved(), generated)).toMatchObject({
    ok: true,
    plan: { outcome: 'filled_current' },
  });
  expect(planTabPlacement(request('new'), snapshot(full, 'tab-0'), resolved(), generated)).toMatchObject({
    ok: false,
    failure: { code: 'capacity_exceeded' },
  });
});

test('invalid, mismatched, and unavailable targets fail without a transition', () => {
  const state = snapshot([]);
  expect(planTabPlacement(request(), state, null, generated)).toMatchObject({
    ok: false,
    failure: { code: 'target_unavailable' },
  });
  expect(planTabPlacement(request(), state, { ...resolved(), executable: true }, generated)).toMatchObject({
    ok: false,
    failure: { code: 'target_unavailable' },
  });
  expect(planTabPlacement(request(), state, resolved('presenter.wrong'), generated)).toMatchObject({
    ok: false,
    failure: { code: 'target_contract_conflict' },
  });
  expect(planTabPlacement(request(), state, resolved('presenter.files', 'file:wrong'), generated)).toMatchObject({
    ok: false,
    failure: { code: 'target_contract_conflict' },
  });
});

test('generated identifiers are validated and checked in their owned namespaces', () => {
  const existing = componentRecord('tab-existing', 'presenter.other', 'other', 'component-existing');
  const state = snapshot([existing]);
  for (const ids of [
    { tabId: '', componentInstanceId: 'component-new' },
    { tabId: 'tab-new', componentInstanceId: '' },
    { tabId: `x${'y'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes)}`, componentInstanceId: 'component-new' },
  ]) {
    expect(planTabPlacement(request('new'), state, resolved(), ids)).toMatchObject({
      ok: false,
      failure: { code: 'invalid_generated_id' },
    });
  }
  expect(planTabPlacement(request('new'), state, resolved(), {
    tabId: 'tab-existing', componentInstanceId: 'component-new',
  })).toMatchObject({ ok: false, failure: { code: 'id_conflict' } });
  expect(planTabPlacement(request('new'), state, resolved(), {
    tabId: 'tab-new', componentInstanceId: 'component-existing',
  })).toMatchObject({ ok: false, failure: { code: 'id_conflict' } });
  let reads = 0;
  expect(planTabPlacement(request('new'), state, resolved(), {
    tabId: 'tab-new',
    get componentInstanceId() { reads += 1; throw new Error('private'); },
  })).toMatchObject({ ok: false, failure: { code: 'invalid_generated_id' } });
  expect(reads).toBe(0);
  const hostileIds = new Proxy({}, {
    getPrototypeOf() { throw new Error('hostile generated-id proxy'); },
  });
  expect(planTabPlacement(request('new'), state, resolved(), hostileIds as never)).toMatchObject({
    ok: false,
    failure: { code: 'invalid_generated_id', message: 'A fresh valid placement identifier is required.' },
  });
});

test('protected nested invalid, legacy, and unaddressed records are skipped and preserved', () => {
  const invalidBody = componentRecord('tab-invalid', 'presenter.files', 'file:alpha');
  Object.defineProperty(invalidBody, 'content', {
    enumerable: true,
    value: { kind: 'component', revision: 1, get component() { throw new Error('private'); } },
  });
  const legacy = { ...componentRecord('tab-legacy', 'presenter.files', 'file:alpha'), shell: undefined };
  const unaddressed = componentRecord('tab-unaddressed', 'presenter.files', 'file:alpha');
  if (typeof unaddressed.content === 'object' && unaddressed.content !== null) {
    const descriptor = (unaddressed.content as { component: Record<string, unknown> }).component;
    delete descriptor.targetKey;
  }
  const records = [invalidBody, legacy, unaddressed];
  const result = planTabPlacement(request('new'), snapshot(records), resolved(), generated);
  expect(result).toMatchObject({ ok: true, plan: { outcome: 'appended_new' } });
  if (!result.ok) return;
  expect(result.plan.nextSnapshot.tabs.slice(0, 3)).toEqual(records);
});

test('protected active nested invalidity appends, while outer active and reservation corruption reject', () => {
  const protectedActive = { ...emptyRecord('tab-active'), tab: { label: 'missing-id' } };
  expect(planTabPlacement(
    request(),
    snapshot([protectedActive], 'tab-active'),
    resolved(),
    generated,
  )).toMatchObject({ ok: true, plan: { outcome: 'appended_new' } });
  const hostileTab = new Proxy({}, {
    getPrototypeOf() { throw new Error('hostile tab proxy'); },
  });
  expect(planTabPlacement(
    request(),
    snapshot([{ ...emptyRecord('tab-hostile'), tab: hostileTab }], 'tab-hostile'),
    resolved(),
    generated,
  )).toMatchObject({ ok: true, plan: { outcome: 'appended_new' } });
  expect(classifyTabPlacement(request(), snapshot([emptyRecord('tab-a')], 'missing'))).toMatchObject({
    ok: false,
    failure: { code: 'invalid_state' },
  });
  expect(classifyTabPlacement(request(), {
    ...snapshot([emptyRecord('tab-a')]),
    reservations: [{
      tabId: 'missing', operationId: 'op', expectedRevision: 0, launcherId: 'launcher', status: 'pending',
    }],
  })).toMatchObject({ ok: false, failure: { code: 'invalid_state' } });
  expect(classifyTabPlacement(request(), {
    ...snapshot([emptyRecord('tab-a')]),
    reservations: [
      { tabId: 'tab-a', operationId: 'op-a', expectedRevision: 0, launcherId: 'a', status: 'pending' },
      { tabId: 'tab-a', operationId: 'op-b', expectedRevision: 0, launcherId: 'b', status: 'pending' },
    ],
  })).toMatchObject({ ok: false, failure: { code: 'invalid_state' } });
});

test('maximum revision cannot be incremented and invalid requests retain no state effect', () => {
  expect(classifyTabPlacement(
    request(),
    snapshot([emptyRecord('tab-max', Number.MAX_SAFE_INTEGER)], 'tab-max'),
  )).toMatchObject({ ok: false, failure: { code: 'invalid_state' } });
  expect(classifyTabPlacement({ ...request(), disposition: 'replace' }, snapshot([]))).toMatchObject({
    ok: false,
    failure: { code: 'invalid_request', requestId: 'request-1' },
  });
});
