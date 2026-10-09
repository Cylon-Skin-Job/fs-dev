import { expect, test } from '@playwright/test';
import {
  COMPONENT_TAB_LIMITS,
  COMPONENT_TAB_PRESENTATION_LIMITS,
  createTabPlacementFailure,
  planTabPlacement,
  validateResolvedTabPlacementTarget,
  validateTabPlacementRequest,
  validateTabPlacementResult,
  validateTabPlacementSnapshot,
  type ResolvedTabPlacementTarget,
  type TabPlacementRequest,
  type TabPlacementSnapshot,
} from '../src/components/view-tabs/componentTabDomain';

function request(): TabPlacementRequest {
  return {
    schemaVersion: 1,
    requestId: 'request-1',
    disposition: 'current',
    target: { presenterId: 'presenter.files', targetKey: 'file:alpha' },
  };
}

function resolved(): ResolvedTabPlacementTarget {
  return {
    schemaVersion: 1,
    presenterId: 'presenter.files',
    targetKey: 'file:alpha',
    componentTypeId: 'fixture.file',
    input: { url: 'https://example.test/a', nested: { count: 1 } },
    tab: {
      label: 'Alpha',
      icon: 'file',
      iconClassName: 'file-icon',
      closeLabel: 'Close Alpha',
      closable: true,
      closeDisabled: false,
    },
    location: { schemaVersion: 1, segments: [{ label: 'Files' }, { label: 'Alpha' }] },
  };
}

function emptySnapshot(): TabPlacementSnapshot {
  return {
    schemaVersion: 1,
    tabs: [{
      tabId: 'tab-empty',
      content: { kind: 'empty', revision: 2 },
      tab: { id: 'tab-empty', label: 'New Tab', icon: 'plus', closeLabel: 'Close New Tab' },
      shell: {
        schemaVersion: 2,
        tabId: 'tab-empty',
        presenterId: null,
        location: { schemaVersion: 1, segments: [{ label: 'New Tab' }] },
      },
    }],
    activeTabId: 'tab-empty',
    reservations: [],
  };
}

function withSymbol<T extends object>(value: T): T {
  Object.defineProperty(value, Symbol('private'), { value: true, enumerable: true });
  return value;
}

function withHidden<T extends object>(value: T): T {
  Object.defineProperty(value, 'private', { value: true, enumerable: false });
  return value;
}

test('request validation accepts exact byte boundaries and canonically clones identity', () => {
  const candidate = {
    schemaVersion: 1,
    requestId: 'r'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes),
    disposition: 'new',
    target: {
      presenterId: 'p'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes),
      targetKey: 'é'.repeat(COMPONENT_TAB_LIMITS.maxTargetKeyBytes / 2),
    },
  };
  const result = validateTabPlacementRequest(candidate);
  expect(result).toEqual({ ok: true, value: candidate });
  if (!result.ok) return;
  expect(result.value).not.toBe(candidate);
  expect(result.value.target).not.toBe(candidate.target);

  const invalidCases = [
    [{ ...request(), requestId: `r${'x'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes)}` }, null],
    { ...request(), target: { ...request().target, presenterId: '' } },
    { ...request(), target: { ...request().target, presenterId: 'presenter\u0085private' } },
    { ...request(), target: { ...request().target, targetKey: `t${'x'.repeat(COMPONENT_TAB_LIMITS.maxTargetKeyBytes)}` } },
    { ...request(), schemaVersion: 2 },
    { ...request(), disposition: 'replace' },
  ].map((candidate) => Array.isArray(candidate) ? candidate : [candidate, 'request-1']) as Array<[
    Record<string, unknown>,
    string | null,
  ]>;
  for (const [invalid, expectedRequestId] of invalidCases) {
    expect(validateTabPlacementRequest(invalid)).toMatchObject({
      ok: false,
      failure: { code: 'invalid_request', requestId: expectedRequestId },
    });
  }
});

test('request validation rejects hostile shapes without invoking accessors and safely recovers requestId', () => {
  let reads = 0;
  const accessor = {
    schemaVersion: 1,
    requestId: 'request-1',
    disposition: 'current',
    get target() { reads += 1; return request().target; },
  };
  const targetAccessor = {
    presenterId: 'presenter.files',
    get targetKey() { reads += 1; return 'file:alpha'; },
  };
  const inherited = Object.create(request());
  const hiddenId = { ...request() };
  Object.defineProperty(hiddenId, 'requestId', { value: 'request-1', enumerable: false });
  const accessorId = { ...request() };
  Object.defineProperty(accessorId, 'requestId', {
    get() { reads += 1; return 'request-1'; },
    enumerable: true,
  });
  for (const candidate of [
    { ...request(), future: true },
    withSymbol({ ...request() }),
    withHidden({ ...request() }),
    inherited,
    accessor,
    { ...request(), target: { ...request().target, future: true } },
    { ...request(), target: withSymbol({ ...request().target }) },
    { ...request(), target: Object.create(request().target) },
    { ...request(), target: targetAccessor },
  ]) {
    expect(validateTabPlacementRequest(candidate)).toMatchObject({
      ok: false,
      failure: { code: 'invalid_request', requestId: candidate === inherited ? null : 'request-1' },
    });
  }
  expect(validateTabPlacementRequest(hiddenId)).toMatchObject({
    ok: false, failure: { requestId: null },
  });
  expect(validateTabPlacementRequest(accessorId)).toMatchObject({
    ok: false, failure: { requestId: null },
  });
  expect(reads).toBe(0);
});

test('record validation uses one symbol-aware descriptor snapshot', () => {
  const symbol = Symbol('private');
  const candidate = { ...request(), [symbol]: true };
  let ownKeysCalls = 0;
  const stateful = new Proxy(candidate, {
    ownKeys(target) {
      ownKeysCalls += 1;
      return ownKeysCalls === 1
        ? Reflect.ownKeys(target)
        : Reflect.ownKeys(target).filter((key) => key !== symbol);
    },
  });
  expect(validateTabPlacementRequest(stateful)).toMatchObject({
    ok: false,
    failure: { code: 'invalid_request', requestId: 'request-1' },
  });
  expect(ownKeysCalls).toBe(1);
});

test('resolved-target validation enforces exact outer and display envelopes and canonical data', () => {
  const candidate = resolved();
  const validated = validateResolvedTabPlacementTarget(candidate);
  expect(validated).toEqual({ ok: true, value: candidate });
  if (!validated.ok) return;
  expect(validated.value).not.toBe(candidate);
  expect(validated.value.input).not.toBe(candidate.input);
  expect(validated.value.tab).not.toBe(candidate.tab);
  expect(validated.value.location).not.toBe(candidate.location);

  const exactDisplay = 'é'.repeat(COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes / 2);
  expect(validateResolvedTabPlacementTarget({
    ...resolved(),
    tab: { label: exactDisplay, icon: 'i'.repeat(256), closeLabel: exactDisplay },
  }).ok).toBe(true);
  for (const tab of [
    { ...resolved().tab, id: 'caller-selected-id' },
    { ...resolved().tab, future: true },
    { ...resolved().tab, label: '' },
    { ...resolved().tab, label: ' untrimmed' },
    { ...resolved().tab, closeLabel: 'private\npath' },
    { ...resolved().tab, label: 'x'.repeat(COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes + 1) },
    { ...resolved().tab, icon: 'x'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes + 1) },
    { ...resolved().tab, iconClassName: '' },
    { ...resolved().tab, closable: 'yes' },
  ]) {
    expect(validateResolvedTabPlacementTarget({ ...resolved(), tab }).ok).toBe(false);
  }
});

test('resolved-target validation rejects symbols, inheritance, hidden data, and accessors at each new envelope', () => {
  let reads = 0;
  const accessorTarget = {
    ...resolved(),
    get tab() { reads += 1; return resolved().tab; },
  };
  const accessorTab = {
    label: 'Alpha', icon: 'file',
    get closeLabel() { reads += 1; return 'Close Alpha'; },
  };
  for (const candidate of [
    { ...resolved(), future: true },
    withSymbol({ ...resolved() }),
    withHidden({ ...resolved() }),
    Object.create(resolved()),
    accessorTarget,
    { ...resolved(), tab: withSymbol({ ...resolved().tab }) },
    { ...resolved(), tab: withHidden({ ...resolved().tab }) },
    { ...resolved(), tab: Object.create(resolved().tab) },
    { ...resolved(), tab: accessorTab },
  ]) {
    expect(validateResolvedTabPlacementTarget(candidate).ok).toBe(false);
  }
  expect(reads).toBe(0);
});

test('snapshot validation accepts protected nested invalidity without reading it', () => {
  let reads = 0;
  const state = emptySnapshot();
  const protectedRecord = {
    tabId: 'tab-protected',
    content: {
      kind: 'component',
      revision: 1,
      get component() { reads += 1; return null; },
    },
    tab: withSymbol({ id: 'tab-protected', label: 'Protected', icon: 'x', closeLabel: 'Close' }),
    shell: undefined,
  };
  const protectedKind = {
    tabId: 'tab-protected-kind',
    content: {
      get kind() { reads += 1; return 'empty'; },
      revision: 0,
    },
    tab: undefined,
    shell: undefined,
  };
  const candidate = { ...state, tabs: [...state.tabs, protectedRecord, protectedKind] };
  const validated = validateTabPlacementSnapshot(candidate, 'request-1');
  expect(validated.ok).toBe(true);
  if (validated.ok) expect(validated.value.tabs[1].content).toBe(protectedRecord.content);
  expect(reads).toBe(0);
});

test('snapshot validation canonically clones valid nested content without ordinary property reads', () => {
  let reads = 0;
  const content = new Proxy({ kind: 'empty' as const, revision: 2 }, {
    get(target, property, receiver) {
      reads += 1;
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const state = emptySnapshot();
  const validated = validateTabPlacementSnapshot({
    ...state,
    tabs: [{ ...state.tabs[0], content }],
  }, 'request-1');
  expect(validated).toMatchObject({
    ok: true,
    value: { tabs: [{ content: { kind: 'empty', revision: 2 } }] },
  });
  if (validated.ok) expect(validated.value.tabs[0].content).not.toBe(content);
  expect(planTabPlacement(
    request(),
    { ...state, tabs: [{ ...state.tabs[0], content }] },
    resolved(),
    { componentInstanceId: 'component-new' },
  )).toMatchObject({ ok: true, plan: { outcome: 'filled_current' } });
  expect(reads).toBe(0);
});

test('snapshot outer collection, record, active identity, and reservations are strict', () => {
  const state = emptySnapshot();
  const reservation = {
    tabId: 'tab-empty', operationId: 'operation-1', expectedRevision: 2,
    launcherId: 'launcher-1', status: 'pending' as const,
  };
  expect(validateTabPlacementSnapshot({ ...state, reservations: [reservation] }).ok).toBe(true);
  expect(validateTabPlacementSnapshot({
    ...state,
    tabs: new Array(COMPONENT_TAB_LIMITS.maxContainerEntries + 1),
  }).ok).toBe(false);

  const sparse = Array.from({ length: 2 });
  sparse[0] = state.tabs[0];
  const symbolTabs = [...state.tabs];
  Object.defineProperty(symbolTabs, Symbol('private'), { value: true });
  const hiddenTabs = [...state.tabs];
  Object.defineProperty(hiddenTabs, 'private', { value: true, enumerable: false });
  let reads = 0;
  const accessorSnapshot = {
    schemaVersion: 1,
    get tabs() { reads += 1; return state.tabs; },
    activeTabId: 'tab-empty',
    reservations: [],
  };
  const accessorTabs: unknown[] = [];
  Object.defineProperty(accessorTabs, '0', {
    get() { reads += 1; return state.tabs[0]; },
    enumerable: true,
  });
  accessorTabs.length = 1;
  const accessorRecord = {
    tabId: 'tab-empty',
    get content() { reads += 1; return state.tabs[0].content; },
    tab: state.tabs[0].tab,
    shell: state.tabs[0].shell,
  };
  const accessorReservation = {
    tabId: 'tab-empty',
    get operationId() { reads += 1; return 'operation-1'; },
    expectedRevision: 2,
    launcherId: 'launcher-1',
    status: 'pending',
  };
  for (const candidate of [
    { ...state, future: true },
    withSymbol({ ...state }),
    withHidden({ ...state }),
    Object.create(state),
    accessorSnapshot,
    { ...state, tabs: sparse },
    { ...state, tabs: accessorTabs },
    { ...state, tabs: symbolTabs },
    { ...state, tabs: hiddenTabs },
    { ...state, tabs: [{ ...state.tabs[0], future: true }] },
    { ...state, tabs: [withSymbol({ ...state.tabs[0] })] },
    { ...state, tabs: [withHidden({ ...state.tabs[0] })] },
    { ...state, tabs: [Object.create(state.tabs[0])] },
    { ...state, tabs: [accessorRecord] },
    { ...state, tabs: [state.tabs[0], { ...state.tabs[0] }] },
    { ...state, activeTabId: 'missing' },
    { ...state, reservations: [{ ...reservation, expectedRevision: 1 }] },
    { ...state, reservations: [{ ...reservation, tabId: 'missing' }] },
    { ...state, reservations: [{ ...reservation, future: true }] },
    { ...state, reservations: [accessorReservation] },
    { ...state, reservations: [reservation, { ...reservation }] },
    { ...state, reservations: [reservation, { ...reservation, tabId: 'tab-other' }] },
  ]) {
    expect(validateTabPlacementSnapshot(candidate, 'request-1')).toMatchObject({
      ok: false,
      failure: { code: 'invalid_state', requestId: 'request-1' },
    });
  }
  expect(reads).toBe(0);
});

test('reservation error envelope is exact, bounded, and accessor safe', () => {
  let reads = 0;
  const state = emptySnapshot();
  const base = {
    tabId: 'tab-empty', operationId: 'operation-1', expectedRevision: 2,
    launcherId: 'launcher-1', status: 'failed' as const,
  };
  const canonicalErrors = [
    ['launch_failed', 'The component could not be opened. Try again.'],
    ['timed_out', 'The component took too long to open. Try again.'],
    ['unavailable', 'The component is currently unavailable. Try again.'],
    ['invalid_component', 'The component returned invalid content. Try again.'],
    ['component_instance_conflict', 'The component instance could not be opened. Try again.'],
  ] as const;
  for (const [code, message] of canonicalErrors) {
    expect(validateTabPlacementSnapshot({
      ...state,
      reservations: [{ ...base, error: { code, message } }],
    }).ok).toBe(true);
  }
  expect(validateTabPlacementSnapshot({
    ...state,
    reservations: [{
      ...base,
      status: 'pending',
      error: { code: canonicalErrors[0][0], message: canonicalErrors[0][1] },
    }],
  }).ok).toBe(false);
  expect(validateTabPlacementSnapshot({
    ...state,
    reservations: [{ ...base }],
  }).ok).toBe(false);
  for (const error of [
    { code: 'launch_failed', message: canonicalErrors[0][1], future: true },
    withSymbol({ code: 'launch_failed', message: canonicalErrors[0][1] }),
    withHidden({ code: 'launch_failed', message: canonicalErrors[0][1] }),
    Object.create({ code: 'launch_failed', message: canonicalErrors[0][1] }),
    { code: 'unknown', message: canonicalErrors[0][1] },
    { code: 'launch_failed', message: 'Try again.' },
    { code: 'launch_failed', message: 'x'.repeat(COMPONENT_TAB_LIMITS.maxErrorMessageBytes + 1) },
    { code: 'launch_failed', get message() { reads += 1; return 'private'; } },
  ]) {
    expect(validateTabPlacementSnapshot({
      ...state, reservations: [{ ...base, error }],
    }).ok).toBe(false);
  }
  expect(reads).toBe(0);
});

test('result validation accepts exact success/failure and rejects hostile or inconsistent outcomes', () => {
  const success = {
    schemaVersion: 1, ok: true, requestId: 'request-1', outcome: 'activated_existing',
    tabId: 'tab-1', componentTypeId: 'fixture.file', componentInstanceId: 'component-1',
    presenterId: 'presenter.files', targetKey: 'file:alpha', reveal: 'completed',
  } as const;
  const failure = createTabPlacementFailure('request-1', 'target_unavailable');
  expect(validateTabPlacementResult(success).ok).toBe(true);
  expect(validateTabPlacementResult(failure).ok).toBe(true);
  expect(validateTabPlacementResult({
    ...success,
    requestId: 'r'.repeat(COMPONENT_TAB_LIMITS.maxIdBytes),
    targetKey: 't'.repeat(COMPONENT_TAB_LIMITS.maxTargetKeyBytes),
  }).ok).toBe(true);
  expect(validateTabPlacementResult({
    ...failure,
    requestId: null,
  }).ok).toBe(true);
  let reads = 0;
  const accessorResult = {
    ...success,
    get targetKey() { reads += 1; return 'file:alpha'; },
  };
  let coercions = 0;
  const hostileCode = {
    [Symbol.toPrimitive]() {
      coercions += 1;
      return 'target_unavailable';
    },
  };
  for (const candidate of [
    { ...success, future: true },
    withSymbol({ ...success }),
    withHidden({ ...success }),
    Object.create(success),
    accessorResult,
    { ...success, reveal: 'not_required' },
    { ...success, outcome: 'filled_current', reveal: 'completed' },
    { ...failure, code: 'raw_exception' },
    { ...failure, code: hostileCode },
    withSymbol({ ...failure }),
    withHidden({ ...failure }),
    Object.create(failure),
    { ...failure, message: '' },
    { ...failure, message: ' private' },
    { ...failure, message: 'Resolver failed at /Users/alice/SecretProject/private.ts:42' },
    { ...failure, message: 'x'.repeat(COMPONENT_TAB_LIMITS.maxErrorMessageBytes + 1) },
  ]) {
    expect(validateTabPlacementResult(candidate).ok).toBe(false);
  }
  expect(reads).toBe(0);
  expect(coercions).toBe(0);
});
