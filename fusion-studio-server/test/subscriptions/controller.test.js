'use strict';

const {
  createHandlerCatalog,
  createScopedCapabilityFactory,
  createSubscriptionController,
} = require('../../lib/subscriptions');
const { createProvenanceLedgerHandler } = require('../../lib/ledger/provenance-ledger-handler');
const { createShutdownHandler } = require('../../lib/shutdown');

const EVENT_TYPES = [{ eventType: 'resource.mutated', schemaVersion: 1 }];
const LEDGER_GRANTS = [
  { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
  { capabilityKey: 'ledger.append_resource_fact', scope: { workspaceScope: 'event' } },
  {
    capabilityKey: 'diagnostic.write_fixed',
    scope: { codes: ['ledger_duplicate_conflict', 'ledger_write_failed'] },
  },
];
const RENDERER_GRANTS = [
  { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
  {
    capabilityKey: 'renderer.publish_resource_changed',
    scope: {
      workspaceScope: 'event', messageType: 'resource:changed', messageVersion: 1,
      panel: 'file-viewer',
    },
  },
  {
    capabilityKey: 'renderer.publish_resource_refresh_required',
    scope: {
      workspaceScope: 'event', messageType: 'resource:refresh_required', messageVersion: 1,
      panel: 'file-viewer', reasons: ['projection_failed'],
    },
  },
  {
    capabilityKey: 'diagnostic.write_fixed',
    scope: { codes: ['render_projection_duplicate_conflict', 'render_projection_failed'] },
  },
];
const FACT = {
  eventId: 'event-1', eventType: 'resource.mutated', schemaVersion: 1,
  occurredAt: 1000, workspaceId: 'workspace-1', operationId: 'operation-1',
  mutation: { kind: 'modify' },
  resource: {
    resourceId: 'resource-1', kind: 'file', path: 'notes/a.md',
    access: { panel: 'file-viewer', path: 'notes/a.md' },
  },
};

function schemas(overrides = {}) {
  return [
    {
      effective: true,
      row: {
        schema_key: 'resource.mutated', schema_version: 1, definition_kind: 'event',
        definition_sha256: 'event-hash',
      },
    },
    {
      effective: true,
      row: {
        schema_key: 'resource:changed', schema_version: 1, definition_kind: 'projection',
        definition_sha256: 'changed-hash',
      },
    },
    {
      effective: true,
      row: {
        schema_key: 'resource:refresh_required', schema_version: 1,
        definition_kind: 'projection', definition_sha256: 'refresh-hash',
      },
    },
  ].map((schema) => ({ ...schema, ...overrides[schema.row.schema_key] }));
}

function ledgerSubscription(subscriptionId, overrides = {}) {
  return {
    subscriptionId,
    handlerKey: 'system.provenance-ledger',
    priority: 0,
    filter: { eventTypes: EVENT_TYPES },
    deliveryPolicy: 'best_effort',
    grants: LEDGER_GRANTS,
    ...overrides,
  };
}

function rendererSubscription(subscriptionId, overrides = {}) {
  return ledgerSubscription(subscriptionId, {
    handlerKey: 'system.resource-render-projection',
    grants: RENDERER_GRANTS,
    ...overrides,
  });
}

function state(entries, overrides = {}) {
  return {
    schemas: schemas(),
    subscriptions: entries,
    effectiveSubscriptions: entries,
    diagnostics: [],
    ...overrides,
  };
}

function createHarness({ entries = [], handlers = {}, providers = {}, states, diagnostics } = {}) {
  let currentState = state(entries);
  const stateQueue = states ? [...states] : null;
  const getEffectiveState = jest.fn(async () => {
    const next = stateQueue && stateQueue.length ? stateQueue.shift() : currentState;
    return typeof next === 'function' ? next() : next;
  });
  let delivery;
  const installer = jest.fn((value) => { delivery = value; });
  const externalDiagnostics = diagnostics || [];
  const capabilityProviders = {
    appendResourceFact: async () => {},
    publishResourceChanged: async () => {},
    publishResourceRefreshRequired: async () => {},
    writeDiagnostic: () => {},
    ...providers,
  };
  const controller = createSubscriptionController({
    registryAccess: { getEffectiveState },
    handlerCatalog: createHandlerCatalog(handlers),
    createScopedContext: createScopedCapabilityFactory(capabilityProviders),
    installAdmittedFactDelivery: installer,
    writeDiagnostic: (item) => externalDiagnostics.push(item),
  });
  return {
    controller,
    diagnostics: externalDiagnostics,
    getEffectiveState,
    installer,
    deliver: (...args) => delivery(...args),
    setState(value) { currentState = value; },
  };
}

describe('governed subscription controller lifecycle and delivery', () => {
  test('installs one endpoint, starts once, avoids duplicate descriptors, and stops cleanly', async () => {
    const handler = jest.fn();
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a')],
      handlers: { 'system.provenance-ledger': handler },
    });
    expect(harness.installer).toHaveBeenCalledTimes(1);

    await Promise.all([harness.controller.start(), harness.controller.start()]);
    expect(harness.getEffectiveState).toHaveBeenCalledTimes(1);
    expect(harness.controller.inspectGeneration()).toMatchObject({
      lifecycle: 'started', generationId: 1, descriptorCount: 1,
    });
    await harness.controller.start();
    expect(harness.getEffectiveState).toHaveBeenCalledTimes(1);
    expect(await harness.deliver(FACT)).toEqual([
      { subscriptionId: 'sub-a', handlerKey: 'system.provenance-ledger', status: 'invoked' },
    ]);
    expect(handler).toHaveBeenCalledTimes(1);

    await harness.controller.stop();
    await harness.controller.stop();
    expect(harness.controller.inspectGeneration()).toMatchObject({
      lifecycle: 'stopped', generationId: 2, descriptorCount: 0,
    });
    expect(await harness.deliver(FACT)).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('dispatches by priority then ordinal ID with exact filters and once per attempt', async () => {
    const seen = [];
    const source = JSON.parse(JSON.stringify(FACT));
    const harness = createHarness({
      entries: [
        ledgerSubscription('sub-z', { priority: 2 }),
        ledgerSubscription('sub-b', { priority: 1 }),
        ledgerSubscription('sub-a', { priority: 1 }),
        ledgerSubscription('sub-no-match', {
          priority: -1,
          filter: { eventTypes: EVENT_TYPES, resource: { operations: ['create'] } },
        }),
      ],
      handlers: {
        'system.provenance-ledger': (fact) => {
          seen.push(fact);
          expect(fact.resource.path).toBe('notes/a.md');
          expect(Object.isFrozen(fact)).toBe(true);
          expect(Object.isFrozen(fact.resource)).toBe(true);
          try { fact.resource.path = 'tampered'; } catch (_error) {}
        },
      },
    });
    await harness.controller.start();
    const first = await harness.deliver(source);
    expect(first.map((delivery) => delivery.subscriptionId)).toEqual(['sub-a', 'sub-b', 'sub-z']);
    expect(seen).toHaveLength(3);
    expect(source).toEqual(FACT);
    expect(Object.isFrozen(source)).toBe(false);

    const replay = await harness.deliver(source);
    expect(replay).toEqual(first);
    expect(seen).toHaveLength(6);
  });

  test('isolates synchronous throw and observes best-effort asynchronous rejection', async () => {
    let calls = 0;
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a'), ledgerSubscription('sub-b'), ledgerSubscription('sub-c')],
      handlers: {
        'system.provenance-ledger': () => {
          calls += 1;
          if (calls === 1) throw new Error('sync payload-secret');
          if (calls === 2) return Promise.reject(new Error('async payload-secret'));
          return undefined;
        },
      },
    });
    await harness.controller.start();
    expect(await harness.deliver(FACT)).toEqual([
      { subscriptionId: 'sub-a', handlerKey: 'system.provenance-ledger', status: 'failed' },
      { subscriptionId: 'sub-b', handlerKey: 'system.provenance-ledger', status: 'invoked' },
      { subscriptionId: 'sub-c', handlerKey: 'system.provenance-ledger', status: 'invoked' },
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls).toBe(3);
    expect(harness.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      'subscription_handler_sync_failed', 'subscription_handler_async_failed',
    ]));
    expect(JSON.stringify(harness.diagnostics)).not.toContain('payload-secret');
  });

  test('reports required acknowledgement completion and rejection', async () => {
    const outcomes = [Promise.resolve(), Promise.reject(new Error('nope'))];
    const harness = createHarness({
      entries: [ledgerSubscription('sub-required', { deliveryPolicy: 'required_ack' })],
      handlers: { 'system.provenance-ledger': () => outcomes.shift() },
    });
    await harness.controller.start();
    await expect(harness.deliver(FACT)).resolves.toMatchObject([{ status: 'completed' }]);
    await expect(harness.deliver(FACT)).resolves.toMatchObject([{ status: 'failed' }]);
  });

  test('uses the exact 2000ms required-ack deadline and observes late rejection', async () => {
    jest.useFakeTimers();
    try {
      let rejectLate;
      const pending = new Promise((_resolve, reject) => { rejectLate = reject; });
      const harness = createHarness({
        entries: [ledgerSubscription('sub-required', { deliveryPolicy: 'required_ack' })],
        handlers: { 'system.provenance-ledger': () => pending },
      });
      await harness.controller.start();
      const delivery = harness.deliver(FACT);
      await jest.advanceTimersByTimeAsync(1999);
      let settled = false;
      delivery.then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(delivery).resolves.toMatchObject([{ status: 'timed_out' }]);
      rejectLate(new Error('late hidden payload'));
      await Promise.resolve();
      await Promise.resolve();
      expect(harness.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
        'subscription_handler_timed_out', 'subscription_handler_async_failed',
      ]));
    } finally {
      jest.useRealTimers();
    }
  });

  test('uses one immutable generation snapshot for an in-flight admission attempt', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const calls = [];
    const first = state([
      ledgerSubscription('sub-a', { deliveryPolicy: 'required_ack' }),
      ledgerSubscription('sub-b'),
    ]);
    const harness = createHarness({
      entries: first.effectiveSubscriptions,
      handlers: {
        'system.provenance-ledger': () => {
          calls.push(calls.length + 1);
          return calls.length === 1 ? gate : undefined;
        },
      },
    });
    await harness.controller.start();
    const delivery = harness.deliver(FACT);
    harness.setState(state([]));
    await harness.controller.reload();
    release();
    await expect(delivery).resolves.toHaveLength(2);
    expect(calls).toEqual([1, 2]);
    await expect(harness.deliver(FACT)).resolves.toEqual([]);
  });

  test('stop waits for an in-flight reload and finishes with an empty generation', async () => {
    let releaseReload;
    const reloadState = new Promise((resolve) => { releaseReload = resolve; });
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a')],
      handlers: { 'system.provenance-ledger': () => {} },
    });
    await harness.controller.start();
    harness.setState(reloadState);
    const reload = harness.controller.reload();
    const stop = harness.controller.stop();
    let stopped = false;
    stop.then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    releaseReload(state([ledgerSubscription('sub-a'), ledgerSubscription('sub-b')]));
    await reload;
    await stop;
    expect(harness.controller.inspectGeneration()).toMatchObject({
      lifecycle: 'stopped', descriptorCount: 0, generationId: 3,
    });
    await expect(harness.deliver(FACT)).resolves.toEqual([]);
  });

  test('stop retains a timed-out required-ack handler until its late rejection settles', async () => {
    jest.useFakeTimers();
    try {
      let rejectLate;
      const pending = new Promise((_resolve, reject) => { rejectLate = reject; });
      const harness = createHarness({
        entries: [ledgerSubscription('sub-required', { deliveryPolicy: 'required_ack' })],
        handlers: { 'system.provenance-ledger': () => pending },
      });
      await harness.controller.start();
      const delivery = harness.deliver(FACT);
      const stop = harness.controller.stop();
      let stopped = false;
      stop.then(() => { stopped = true; });
      await jest.advanceTimersByTimeAsync(1999);
      expect(stopped).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(delivery).resolves.toMatchObject([{ status: 'timed_out' }]);
      expect(stopped).toBe(false);
      rejectLate(new Error('late rejection after stop'));
      await Promise.resolve();
      await Promise.resolve();
      await expect(stop).resolves.toMatchObject({ lifecycle: 'stopped', descriptorCount: 0 });
      expect(harness.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
        'subscription_handler_timed_out', 'subscription_handler_async_failed',
      ]));
      await expect(harness.deliver(FACT)).resolves.toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  test('stop sweeps a required handler registered by an already-owned multi-delivery', async () => {
    jest.useFakeTimers();
    try {
      let releaseFirst;
      let releaseSecond;
      let calls = 0;
      const first = new Promise((resolve) => { releaseFirst = resolve; });
      const second = new Promise((resolve) => { releaseSecond = resolve; });
      const harness = createHarness({
        entries: [
          ledgerSubscription('sub-required-a', { deliveryPolicy: 'required_ack' }),
          ledgerSubscription('sub-required-b', { deliveryPolicy: 'required_ack' }),
        ],
        handlers: {
          'system.provenance-ledger': () => {
            calls += 1;
            return calls === 1 ? first : second;
          },
        },
      });
      await harness.controller.start();
      const delivery = harness.deliver(FACT);
      const stop = harness.controller.stop();
      let stopped = false;
      stop.then(() => { stopped = true; });

      releaseFirst();
      for (let attempt = 0; attempt < 10 && calls < 2; attempt += 1) await Promise.resolve();
      expect(calls).toBe(2);
      await jest.advanceTimersByTimeAsync(2_000);
      await expect(delivery).resolves.toMatchObject([
        { status: 'completed' },
        { status: 'timed_out' },
      ]);
      expect(stopped).toBe(false);

      releaseSecond();
      await expect(stop).resolves.toMatchObject({ lifecycle: 'stopped', descriptorCount: 0 });
    } finally {
      jest.useRealTimers();
    }
  });

  test('timed-out real ledger handler blocks database close until force failure', async () => {
    jest.useFakeTimers();
    try {
      let releaseAppend;
      let databaseClosed = false;
      let appendReachedClosedDatabase = false;
      const appendGate = new Promise((resolve) => { releaseAppend = resolve; });
      const harness = createHarness({
        entries: [ledgerSubscription('sub-required', { deliveryPolicy: 'required_ack' })],
        handlers: { 'system.provenance-ledger': createProvenanceLedgerHandler() },
        providers: {
          appendResourceFact: async () => {
            await appendGate;
            appendReachedClosedDatabase = databaseClosed;
            return { status: 'stored' };
          },
        },
      });
      await harness.controller.start();
      const delivery = harness.deliver(FACT);
      const exits = [];
      const closeDatabase = jest.fn(async () => { databaseClosed = true; });
      const requestShutdown = createShutdownHandler({
        server: { close() {}, closeIdleConnections() {}, closeAllConnections() {} },
        sessions: new Map(),
        terminateTransports() {},
        closeWatchers: async () => true,
        beginQuiesce: () => harness.controller.quiesce(),
        stopSubscriptions: () => harness.controller.stop(),
        closeDatabase,
        exit: (code) => exits.push(code),
        logger: { log() {}, error() {} },
        forceAfterMs: 2_500,
        ownerDeadlineMs: 100,
        subscriptionDeadlineMs: 2_100,
        databaseDeadlineMs: 2_300,
        monotonicNow: () => Date.now(),
      });
      const shutdown = requestShutdown('SIGTERM');

      await jest.advanceTimersByTimeAsync(2_000);
      await expect(delivery).resolves.toMatchObject([{ status: 'timed_out' }]);
      expect(closeDatabase).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(100);
      await shutdown;
      expect(closeDatabase).not.toHaveBeenCalled();
      expect(exits).toEqual([]);
      await jest.advanceTimersByTimeAsync(400);
      expect(exits).toEqual([1]);

      releaseAppend();
      await harness.controller.stop();
      expect(appendReachedClosedDatabase).toBe(false);
      expect(closeDatabase).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('subtractive-first atomic reload', () => {
  test('registry-read failure clears prior authority and requires a successful reload to reactivate', async () => {
    const calls = [];
    const active = state([ledgerSubscription('sub-a')]);
    const harness = createHarness({
      states: [active, () => Promise.reject(new Error('registry unavailable')), active],
      handlers: { 'system.provenance-ledger': () => calls.push('call') },
    });
    await harness.controller.start();
    await harness.deliver(FACT);
    expect(calls).toHaveLength(1);

    await expect(harness.controller.reload()).rejects.toThrow('registry unavailable');
    expect(harness.controller.inspectGeneration()).toMatchObject({
      lifecycle: 'started', generationId: 2, descriptorCount: 0,
    });
    await expect(harness.deliver(FACT)).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
    // A healthy state is now available, but authority remains empty until the
    // controller consumes it through a fresh explicit reload.
    expect(harness.controller.inspectGeneration().descriptorCount).toBe(0);

    await expect(harness.controller.reload()).resolves.toMatchObject({
      applied: true, mode: 'complete', generationId: 3, descriptorCount: 1,
    });
    await harness.deliver(FACT);
    expect(calls).toHaveLength(2);
    expect(harness.diagnostics).toContainEqual(expect.objectContaining({
      code: 'subscription_registry_read_failed', generationId: 2, errorName: 'Error',
    }));
    expect(JSON.stringify(harness.diagnostics)).not.toContain('registry unavailable');
  });

  test('failed additive reload retains only byte/authority-equivalent prior descriptors', async () => {
    const calls = [];
    const originalA = ledgerSubscription('sub-a');
    const originalB = ledgerSubscription('sub-b');
    const harness = createHarness({
      entries: [originalA, originalB],
      handlers: { 'system.provenance-ledger': () => calls.push('call') },
    });
    await harness.controller.start();
    const failedCandidate = state([
      JSON.parse(JSON.stringify(originalA)),
      ledgerSubscription('sub-b', { priority: 99 }),
      ledgerSubscription('sub-unknown', { handlerKey: 'extension.unknown' }),
    ]);
    const persistedBefore = JSON.parse(JSON.stringify(failedCandidate));
    harness.setState(failedCandidate);

    await expect(harness.controller.reload()).resolves.toMatchObject({
      applied: false, mode: 'subtractive', generationId: 2, descriptorCount: 1,
    });
    expect(harness.controller.inspectGeneration().subscriptions.map((item) => item.subscriptionId))
      .toEqual(['sub-a']);
    expect(failedCandidate).toEqual(persistedBefore);
    await harness.deliver(FACT);
    expect(calls).toHaveLength(1);
  });

  test.each([
    ['revoked or removed', state([])],
    ['disabled/inactive', state([], { subscriptions: [{ subscriptionId: 'sub-a', effective: false }] })],
    ['ungranted', state([], { subscriptions: [{ subscriptionId: 'sub-a', diagnostics: ['capability_not_granted'] }] })],
    ['checksum-invalid', state([], { subscriptions: [{ subscriptionId: 'sub-a', diagnostics: ['subscription_checksum_mismatch'] }] })],
  ])('immediately removes %s authority even when another addition breaks compilation', async (_label, reduced) => {
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a')],
      handlers: { 'system.provenance-ledger': () => {} },
    });
    await harness.controller.start();
    harness.setState({
      ...reduced,
      schemas: schemas(),
      effectiveSubscriptions: [
        ...(reduced.effectiveSubscriptions || []),
        ledgerSubscription('bad', { handlerKey: 'unknown.handler' }),
      ],
    });
    await harness.controller.reload();
    expect(harness.controller.inspectGeneration().descriptorCount).toBe(0);
  });

  test('atomically swaps a complete additive generation and does not duplicate delivery', async () => {
    const calls = [];
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a')],
      handlers: { 'system.provenance-ledger': () => calls.push('call') },
    });
    await harness.controller.start();
    harness.setState(state([ledgerSubscription('sub-a'), ledgerSubscription('sub-b')]));
    await expect(harness.controller.reload()).resolves.toMatchObject({
      applied: true, mode: 'complete', generationId: 2, descriptorCount: 2,
    });
    await harness.deliver(FACT);
    expect(calls).toHaveLength(2);
  });

  test.each([
    [
      'unknown handler',
      state([ledgerSubscription('bad', { handlerKey: 'extension.unknown' })]),
      { 'system.provenance-ledger': () => {} },
      {},
    ],
    [
      'unknown schema',
      state([ledgerSubscription('bad')], { schemas: schemas().slice(1) }),
      { 'system.provenance-ledger': () => {} },
      {},
    ],
    [
      'unavailable provider',
      state([ledgerSubscription('bad')]),
      { 'system.provenance-ledger': () => {} },
      { appendResourceFact: undefined },
    ],
  ])('fails closed and diagnoses %s without throwing startup', async (_label, candidate, handlers, providers) => {
    const diagnostics = [];
    let delivery;
    const providerSet = {
      publishResourceChanged: async () => {},
      publishResourceRefreshRequired: async () => {},
      writeDiagnostic: () => {},
      ...providers,
    };
    for (const [key, value] of Object.entries(providerSet)) {
      if (value === undefined) delete providerSet[key];
    }
    const controller = createSubscriptionController({
      registryAccess: { getEffectiveState: async () => candidate },
      handlerCatalog: createHandlerCatalog(handlers),
      createScopedContext: createScopedCapabilityFactory(providerSet),
      installAdmittedFactDelivery: (value) => { delivery = value; },
      writeDiagnostic: (item) => diagnostics.push(item),
    });
    await expect(controller.start()).resolves.toMatchObject({ descriptorCount: 0 });
    await expect(delivery(FACT)).resolves.toEqual([]);
    expect(diagnostics.some((item) => item.code === 'subscription_reload_failed')).toBe(true);
  });

  test('schema checksum authority change removes a prior descriptor on failed reload', async () => {
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a')],
      handlers: { 'system.provenance-ledger': () => {} },
    });
    await harness.controller.start();
    const changedSchemas = schemas();
    changedSchemas[0].row.definition_sha256 = 'changed-event-hash';
    harness.setState(state([
      ledgerSubscription('sub-a'),
      ledgerSubscription('bad', { handlerKey: 'unknown.handler' }),
    ], { schemas: changedSchemas }));
    await harness.controller.reload();
    expect(harness.controller.inspectGeneration().descriptorCount).toBe(0);
    expect(harness.diagnostics.some((item) => item.code === 'subscription_authority_changed')).toBe(true);
  });

  test('diagnostics are bounded and omit event payloads and unbounded error text', async () => {
    const harness = createHarness({
      entries: [ledgerSubscription('sub-a')],
      handlers: { 'system.provenance-ledger': () => { throw new Error('x'.repeat(1000)); } },
    });
    await harness.controller.start();
    for (let index = 0; index < 105; index += 1) await harness.deliver(FACT);
    const diagnostics = harness.controller.getDiagnostics();
    expect(diagnostics).toHaveLength(100);
    expect(diagnostics.every((item) => !Object.prototype.hasOwnProperty.call(item, 'fact'))).toBe(true);
    expect(diagnostics.every((item) => !item.errorName || item.errorName.length <= 160)).toBe(true);
  });
});
