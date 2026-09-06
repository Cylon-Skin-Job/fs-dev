import { expect, test } from '@playwright/test';
import {
  COMPONENT_TAB_LIMITS,
  cancelEmptyTabReservation,
  closeComponentTab,
  commitEmptyTabFill,
  createEmptyTab,
  failEmptyTabReservation,
  reserveEmptyTab,
  retryEmptyTabReservation,
  validateComponentDescriptor,
  validateTabContentDescriptor,
  validateTabContentRecord,
  type ComponentDescriptor,
  type ComponentTabCollectionState,
  type EmptyTabReservation,
} from '../src/components/view-tabs/componentTabDomain';

const EMPTY_STATE: ComponentTabCollectionState = {
  tabs: [],
  activeTabId: null,
  reservations: [],
};

function component(
  componentInstanceId: string,
  overrides: Partial<ComponentDescriptor> = {},
): ComponentDescriptor {
  return {
    schemaVersion: 1,
    componentTypeId: 'fixture.card',
    componentInstanceId,
    input: { title: 'Fixture', values: [1, true, null, { nested: 'value' }] },
    targetKey: 'fixture:target',
    ...overrides,
  };
}

function createReservedState(
  tabId = 'tab-a',
  operationId = 'operation-a',
  launcherId = 'launcher-a',
) {
  const created = createEmptyTab(EMPTY_STATE, () => tabId);
  if (!created.ok) throw new Error(created.message);
  const reserved = reserveEmptyTab(created.state, tabId, launcherId, () => operationId);
  if (!reserved.ok) throw new Error(reserved.message);
  return reserved;
}

function reservationIdentity(reservation: EmptyTabReservation) {
  return {
    tabId: reservation.tabId,
    operationId: reservation.operationId,
    expectedRevision: reservation.expectedRevision,
  };
}

test('valid component content is canonical JSON and preserves targetKey through round-trip', () => {
  const descriptor = component('component-a');
  const validated = validateTabContentRecord({
    tabId: 'tab-a',
    content: { kind: 'component', revision: 7, component: descriptor },
  });

  expect(validated.ok).toBe(true);
  if (!validated.ok) return;
  expect(validated.value.content.kind).toBe('component');
  expect(JSON.parse(JSON.stringify(validated.value))).toEqual(validated.value);
  if (validated.value.content.kind !== 'component') return;
  expect(validated.value.content.component.targetKey).toBe('fixture:target');
  expect(validated.value.content.component.input).toEqual(descriptor.input);
});

test('descriptor validation fails closed for versions, IDs, revisions, and unknown fields', () => {
  const cases: unknown[] = [
    { ...component('component-a'), schemaVersion: 2 },
    { ...component('component-a'), componentTypeId: '' },
    { ...component('component-a'), componentInstanceId: `x${'y'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes)}` },
    { ...component('component-a'), targetKey: '' },
    { ...component('component-a'), executable: 'not-allowed' },
  ];
  for (const candidate of cases) expect(validateComponentDescriptor(candidate).ok).toBe(false);

  expect(validateTabContentDescriptor({ kind: 'empty', revision: -1 }).ok).toBe(false);
  expect(validateTabContentDescriptor({ kind: 'empty', revision: 0, component: null }).ok).toBe(false);
  expect(validateTabContentDescriptor({
    kind: 'component',
    revision: 0,
    component: component('component-a'),
    futureField: true,
  }).ok).toBe(false);
  expect(validateTabContentRecord({
    tabId: 'tab-a',
    content: { kind: 'empty', revision: 0 },
    label: 'unsupported',
  }).ok).toBe(false);
});

test('descriptor validation rejects executable, cyclic, unsafe, deep, and oversized input', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const reactNodeLike = { type: 'div', props: {}, $$typeof: Symbol.for('react.transitional.element') };
  const unsafe = JSON.parse('{"safe":{"__proto__":{"polluted":true}}}') as Record<string, unknown>;
  const unsafeConstructor = JSON.parse('{"constructor":{"polluted":true}}') as Record<string, unknown>;
  const sparse = Array.from({ length: 2 }) as unknown[];
  sparse[0] = 'only-one-entry';
  const invalidInputs: unknown[] = [
    { callback: () => undefined },
    { symbol: Symbol('not-json') },
    { bigint: BigInt(1) },
    { missing: undefined },
    { nan: Number.NaN },
    { infinity: Number.POSITIVE_INFINITY },
    { date: new Date(0) },
    { node: reactNodeLike },
    cyclic,
    unsafe,
    unsafeConstructor,
    { sparse },
  ];

  for (const input of invalidInputs) {
    const result = validateComponentDescriptor(component('component-a', { input: input as ComponentDescriptor['input'] }));
    expect(result.ok).toBe(false);
  }

  let deep: Record<string, unknown> = { value: 'leaf' };
  for (let index = 0; index <= COMPONENT_TAB_LIMITS.maxJsonDepth; index += 1) deep = { child: deep };
  const deepResult = validateComponentDescriptor(component('component-a', {
    input: deep as ComponentDescriptor['input'],
  }));
  expect(deepResult).toMatchObject({ ok: false, error: { code: 'excessive_depth' } });

  const secret = `private-path-${'x'.repeat(COMPONENT_TAB_LIMITS.maxInputBytes)}`;
  const largeResult = validateComponentDescriptor(component('component-a', { input: { value: secret } }));
  expect(largeResult).toMatchObject({ ok: false, error: { code: 'excessive_size' } });
  if (!largeResult.ok) expect(largeResult.error.message).not.toContain(secret);
  expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
});

test('successive creation appends distinct active empties with independent reservations', () => {
  const first = createEmptyTab(EMPTY_STATE, () => 'tab-a');
  if (!first.ok) throw new Error(first.message);
  const second = createEmptyTab(first.state, () => 'tab-b');
  if (!second.ok) throw new Error(second.message);

  expect(second.state.tabs).toEqual([
    { tabId: 'tab-a', content: { kind: 'empty', revision: 0 } },
    { tabId: 'tab-b', content: { kind: 'empty', revision: 0 } },
  ]);
  expect(second.state.activeTabId).toBe('tab-b');

  const reservedA = reserveEmptyTab(second.state, 'tab-a', 'launcher-a', () => 'operation-a');
  if (!reservedA.ok) throw new Error(reservedA.message);
  const reservedB = reserveEmptyTab(reservedA.state, 'tab-b', 'launcher-b', () => 'operation-b');
  if (!reservedB.ok) throw new Error(reservedB.message);
  expect(reservedB.state.reservations).toEqual([
    expect.objectContaining({ tabId: 'tab-a', operationId: 'operation-a', launcherId: 'launcher-a' }),
    expect.objectContaining({ tabId: 'tab-b', operationId: 'operation-b', launcherId: 'launcher-b' }),
  ]);

  const duplicate = createEmptyTab(reservedB.state, () => 'tab-a');
  expect(duplicate).toMatchObject({ ok: false, code: 'id_conflict' });
  expect(duplicate.state).toBe(reservedB.state);
});

test('commit fills only the exact reserved tab in place and protects populated tabs', () => {
  const first = createEmptyTab(EMPTY_STATE, () => 'tab-a');
  if (!first.ok) throw new Error(first.message);
  const second = createEmptyTab(first.state, () => 'tab-b');
  if (!second.ok) throw new Error(second.message);
  const reserved = reserveEmptyTab(second.state, 'tab-a', 'launcher-a', () => 'operation-a');
  if (!reserved.ok) throw new Error(reserved.message);

  const committed = commitEmptyTabFill(
    reserved.state,
    reservationIdentity(reserved.reservation),
    component('component-a'),
  );
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.state.tabs.map((tab) => tab.tabId)).toEqual(['tab-a', 'tab-b']);
  expect(committed.state.activeTabId).toBe('tab-b');
  expect(committed.tab).toMatchObject({
    tabId: 'tab-a',
    content: {
      kind: 'component',
      revision: 1,
      component: { componentInstanceId: 'component-a', targetKey: 'fixture:target' },
    },
  });
  expect(committed.state.reservations).toEqual([]);

  const protectedResult = reserveEmptyTab(
    committed.state,
    'tab-a',
    'launcher-b',
    () => 'operation-b',
  );
  expect(protectedResult).toMatchObject({ ok: false, code: 'tab_not_empty' });
  expect(protectedResult.state).toBe(committed.state);
});

test('operation, revision, and tab ownership mismatches are stale and non-mutating', () => {
  const reserved = createReservedState();
  const mismatches = [
    { ...reservationIdentity(reserved.reservation), operationId: 'wrong-operation' },
    { ...reservationIdentity(reserved.reservation), expectedRevision: 1 },
    { ...reservationIdentity(reserved.reservation), tabId: 'wrong-tab' },
  ];
  for (const identity of mismatches) {
    const result = commitEmptyTabFill(reserved.state, identity, component('component-a'));
    expect(result).toMatchObject({ ok: false, code: 'stale_completion' });
    expect(result.state).toBe(reserved.state);
  }
});

test('cancel, re-reserve, retry, close, and prior fill invalidate old completions', () => {
  const cancelReservation = createReservedState('tab-cancel', 'operation-cancel');
  const cancelled = cancelEmptyTabReservation(
    cancelReservation.state,
    reservationIdentity(cancelReservation.reservation),
  );
  if (!cancelled.ok) throw new Error(cancelled.message);
  const afterCancel = commitEmptyTabFill(
    cancelled.state,
    reservationIdentity(cancelReservation.reservation),
    component('component-cancel'),
  );
  expect(afterCancel).toMatchObject({ ok: false, code: 'stale_completion' });
  expect(afterCancel.state).toBe(cancelled.state);

  const initial = createReservedState('tab-rereserve', 'operation-old');
  const rereserved = reserveEmptyTab(initial.state, 'tab-rereserve', 'launcher-new', () => 'operation-new');
  if (!rereserved.ok) throw new Error(rereserved.message);
  const afterRereserve = commitEmptyTabFill(
    rereserved.state,
    reservationIdentity(initial.reservation),
    component('component-old'),
  );
  expect(afterRereserve).toMatchObject({ ok: false, code: 'stale_completion' });
  expect(afterRereserve.state).toBe(rereserved.state);
  const staleFailure = failEmptyTabReservation(
    rereserved.state,
    reservationIdentity(initial.reservation),
    { code: 'timed_out', message: 'This old operation failed.' },
  );
  expect(staleFailure).toMatchObject({ ok: false, code: 'stale_completion' });
  expect(staleFailure.state).toBe(rereserved.state);

  const failed = failEmptyTabReservation(
    initial.state,
    reservationIdentity(initial.reservation),
    { code: 'timed_out', message: 'The component took too long to open.' },
  );
  if (!failed.ok) throw new Error(failed.message);
  const retried = retryEmptyTabReservation(failed.state, 'tab-rereserve', () => 'operation-retry');
  if (!retried.ok) throw new Error(retried.message);
  expect(retried.reservation.launcherId).toBe(initial.reservation.launcherId);
  expect(retried.reservation.operationId).not.toBe(initial.reservation.operationId);
  const afterRetry = commitEmptyTabFill(
    retried.state,
    reservationIdentity(initial.reservation),
    component('component-old'),
  );
  expect(afterRetry).toMatchObject({ ok: false, code: 'stale_completion' });
  expect(afterRetry.state).toBe(retried.state);

  const closeReservation = createReservedState('tab-close', 'operation-close');
  const closed = closeComponentTab(closeReservation.state, 'tab-close');
  if (!closed.ok) throw new Error(closed.message);
  expect(closed.state.reservations).toEqual([]);
  const afterClose = commitEmptyTabFill(
    closed.state,
    reservationIdentity(closeReservation.reservation),
    component('component-close'),
  );
  expect(afterClose).toMatchObject({ ok: false, code: 'stale_completion' });
  expect(afterClose.state).toBe(closed.state);

  const fillReservation = createReservedState('tab-fill', 'operation-fill');
  const filled = commitEmptyTabFill(
    fillReservation.state,
    reservationIdentity(fillReservation.reservation),
    component('component-fill'),
  );
  if (!filled.ok) throw new Error(filled.message);
  const afterFill = commitEmptyTabFill(
    filled.state,
    reservationIdentity(fillReservation.reservation),
    component('component-late'),
  );
  expect(afterFill).toMatchObject({ ok: false, code: 'stale_completion' });
  expect(afterFill.state).toBe(filled.state);
});

test('failure keeps the empty identity retryable and bounds unsafe error details', () => {
  const reserved = createReservedState();
  const failed = failEmptyTabReservation(
    reserved.state,
    reservationIdentity(reserved.reservation),
    {
      code: 'provider.failure',
      message: 'Provider failed at /Users/alice/SecretProject/credential.json',
    },
  );
  if (!failed.ok) throw new Error(failed.message);
  expect(failed.state.tabs).toEqual(reserved.state.tabs);
  expect(failed.reservation).toMatchObject({
    tabId: 'tab-a',
    operationId: 'operation-a',
    launcherId: 'launcher-a',
    status: 'failed',
    error: {
      code: 'launch_failed',
      message: 'The component could not be opened. Try again.',
    },
  });
  expect(failed.reservation.error?.message).not.toContain('/Users/alice/SecretProject');

  const retried = retryEmptyTabReservation(failed.state, 'tab-a', () => 'operation-b');
  if (!retried.ok) throw new Error(retried.message);
  const committed = commitEmptyTabFill(
    retried.state,
    reservationIdentity(retried.reservation),
    component('component-a'),
  );
  expect(committed.ok).toBe(true);
});

test('invalid commit content fails closed without storing or echoing it', () => {
  const reserved = createReservedState();
  const invalid = { ...component('component-a'), input: { callback: () => 'private-value' } };
  const result = commitEmptyTabFill(
    reserved.state,
    reservationIdentity(reserved.reservation),
    invalid,
  );
  expect(result).toMatchObject({
    ok: false,
    code: 'invalid_component',
    state: {
      tabs: [{ tabId: 'tab-a', content: { kind: 'empty', revision: 0 } }],
      reservations: [{ status: 'failed', launcherId: 'launcher-a' }],
    },
  });
  if (!result.ok) expect(result.message).not.toContain('private-value');
});

test('closing the active tab preserves order and uses previous-first activation recovery', () => {
  const first = createEmptyTab(EMPTY_STATE, () => 'tab-a');
  if (!first.ok) throw new Error(first.message);
  const second = createEmptyTab(first.state, () => 'tab-b');
  if (!second.ok) throw new Error(second.message);
  const third = createEmptyTab(second.state, () => 'tab-c');
  if (!third.ok) throw new Error(third.message);

  const closed = closeComponentTab(third.state, 'tab-c');
  if (!closed.ok) throw new Error(closed.message);
  expect(closed.state.tabs.map((tab) => tab.tabId)).toEqual(['tab-a', 'tab-b']);
  expect(closed.state.activeTabId).toBe('tab-b');
});
