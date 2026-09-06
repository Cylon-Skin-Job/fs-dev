'use strict';

const { matchesFilter } = require('../../lib/event-registry/filter');
const {
  compileGeneration,
  createHandlerCatalog,
  createScopedCapabilityFactory,
} = require('../../lib/subscriptions');

const EVENT_TYPES = [{ eventType: 'resource.mutated', schemaVersion: 1 }];
const FACT = Object.freeze({
  eventId: 'event-1',
  eventType: 'resource.mutated',
  schemaVersion: 1,
  workspaceId: 'workspace-1',
  operationId: 'operation-1',
  occurredAt: 1234,
  mutation: Object.freeze({ kind: 'modify' }),
  resource: Object.freeze({
    resourceId: 'resource-1',
    kind: 'file',
    path: 'a.md',
    access: Object.freeze({ panel: 'file-viewer', path: 'a.md' }),
  }),
});

function schemaState(effective = true) {
  return {
    effective,
    row: { schema_key: 'resource.mutated', schema_version: 1, definition_kind: 'event' },
  };
}

function projectionSchema(schemaKey, overrides = {}) {
  return {
    effective: true,
    row: { schema_key: schemaKey, schema_version: 1, definition_kind: 'projection' },
    ...overrides,
  };
}

function defaultSchemas() {
  return [schemaState(), projectionSchema('resource:changed'), projectionSchema('resource:refresh_required')];
}

function subscription(overrides = {}) {
  return {
    subscriptionId: 'sub-b',
    handlerKey: 'system.provenance-ledger',
    priority: 10,
    filter: { eventTypes: EVENT_TYPES },
    deliveryPolicy: 'required_ack',
    grants: [
      { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
      { capabilityKey: 'ledger.append_resource_fact', scope: { workspaceScope: 'event' } },
      {
        capabilityKey: 'diagnostic.write_fixed',
        scope: { codes: ['ledger_write_failed', 'ledger_duplicate_conflict'] },
      },
    ],
    ...overrides,
  };
}

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
    scope: {
      codes: ['render_projection_failed', 'render_projection_duplicate_conflict'],
    },
  },
];

function rendererSubscription(overrides = {}) {
  return subscription({
    handlerKey: 'system.resource-render-projection',
    deliveryPolicy: 'best_effort',
    grants: RENDERER_GRANTS,
    ...overrides,
  });
}

function compile(entries, options = {}) {
  const calls = options.calls || [];
  const handlers = options.handlers || {
    'system.provenance-ledger': async (fact, context) => {
      calls.push({ fact, context });
      return context.appendResourceFact(fact);
    },
  };
  const createScopedContext = createScopedCapabilityFactory(options.providers || {
    appendResourceFact: async (fact) => calls.push({ appended: fact }),
    writeDiagnostic: (code) => calls.push({ diagnostic: code }),
  });
  return compileGeneration({
    effectiveState: {
      schemas: options.schemas || defaultSchemas(),
      subscriptions: options.allRows || [],
      effectiveSubscriptions: entries,
    },
    handlerCatalog: createHandlerCatalog(handlers),
    createScopedContext,
    generationId: options.generationId || 1,
  });
}

describe('immutable governed subscription generation compiler', () => {
  test('compiles only effective rows in priority then ordinal subscription order', () => {
    const generation = compile([
      subscription({ subscriptionId: 'sub-z', priority: 10 }),
      subscription({ subscriptionId: 'sub-a', priority: 10 }),
      subscription({ subscriptionId: 'sub-low', priority: -5 }),
    ], { allRows: [{ effective: false, subscriptionId: 'pending-row' }] });
    expect(generation.descriptors.map((item) => item.subscriptionId))
      .toEqual(['sub-low', 'sub-a', 'sub-z']);
    expect(Object.isFrozen(generation)).toBe(true);
    expect(Object.isFrozen(generation.descriptors)).toBe(true);
    expect(generation.descriptors.every(Object.isFrozen)).toBe(true);
    expect(generation.descriptors.some((item) => item.subscriptionId === 'pending-row')).toBe(false);
  });

  test('does not retain mutable authority fields from the registry state input', async () => {
    const calls = [];
    const entry = subscription();
    const generation = compile([entry], { calls });
    entry.handlerKey = 'system.resource-render-projection';
    entry.grants.length = 0;
    await generation.descriptors[0].invoke(FACT);
    expect(generation.descriptors[0].handlerKey).toBe('system.provenance-ledger');
    expect(calls).toContainEqual({ appended: FACT });
  });

  test('reuses the closed exact filter with AND semantics', () => {
    const [descriptor] = compile([subscription({
      filter: {
        eventTypes: EVENT_TYPES,
        resource: { operations: ['modify'], kinds: ['file'], ingressPanels: ['file-viewer'] },
      },
    })]).descriptors;
    expect(matchesFilter(descriptor.filter, FACT)).toBe(true);
    expect(matchesFilter(descriptor.filter, {
      ...FACT,
      resource: { ...FACT.resource, access: { panel: 'office-viewer', path: 'a.md' } },
    })).toBe(false);
    expect(matchesFilter(descriptor.filter, { ...FACT, mutation: { kind: 'create' } })).toBe(false);
    expect(matchesFilter(descriptor.filter, { ...FACT, eventType: 'file.command_accepted' })).toBe(false);
  });

  test('invokes an allowlisted handler with only its granted scoped methods', async () => {
    const calls = [];
    const [descriptor] = compile([subscription()], { calls }).descriptors;
    await descriptor.invoke(FACT);
    const context = calls.find((item) => item.context).context;
    expect(Object.keys(context).sort()).toEqual(['appendResourceFact', 'writeDiagnostic']);
    expect(context.db).toBeUndefined();
    expect(context.fs).toBeUndefined();
    expect(context.sockets).toBeUndefined();
    expect(context.emit).toBeUndefined();
    expect(context.command).toBeUndefined();
    expect(() => context.appendResourceFact({ ...FACT, workspaceId: 'other' }))
      .toThrow(/scoped|admitted fact/);
    expect(() => context.writeDiagnostic('arbitrary')).toThrow(/exceeds/);
  });

  test('binds renderer projection capabilities to the admitted event and granted reason', async () => {
    let context;
    let changedGateRelease;
    let refreshGateRelease;
    const changedGate = new Promise((resolve) => { changedGateRelease = resolve; });
    const refreshGate = new Promise((resolve) => { refreshGateRelease = resolve; });
    let observedChanged;
    let observedRefresh;
    const entry = rendererSubscription();
    const generation = compile([entry], {
      handlers: { 'system.resource-render-projection': (_fact, value) => { context = value; } },
      providers: {
        publishResourceChanged: async (message) => {
          await changedGate;
          observedChanged = message;
        },
        publishResourceRefreshRequired: async (message) => {
          await refreshGate;
          observedRefresh = message;
        },
        writeDiagnostic: () => {},
      },
    });
    await generation.descriptors[0].invoke(FACT);
    expect(Object.keys(context).sort()).toEqual([
      'publishResourceChanged', 'publishResourceRefreshRequired', 'writeDiagnostic',
    ]);
    const changed = {
      type: 'resource:changed',
      version: 1,
      eventId: FACT.eventId,
      operationId: FACT.operationId,
      workspaceId: FACT.workspaceId,
      resourceId: FACT.resource.resourceId,
      resourceKind: FACT.resource.kind,
      operation: FACT.mutation.kind,
      panel: 'file-viewer',
      path: FACT.resource.path,
      occurredAt: FACT.occurredAt,
    };
    const changedPending = context.publishResourceChanged(changed);
    changed.workspaceId = 'workspace-2';
    changed.path = 'other.md';
    changedGateRelease();
    await expect(changedPending).resolves.toBeUndefined();
    expect(observedChanged).not.toBe(changed);
    expect(observedChanged.workspaceId).toBe(FACT.workspaceId);
    expect(observedChanged.path).toBe(FACT.resource.path);
    expect(Object.isFrozen(observedChanged)).toBe(true);
    expect(() => context.publishResourceChanged({ ...changed, operationId: 'other' }))
      .toThrow(/exceeds/);
    expect(() => context.publishResourceChanged({
      ...changed,
      workspaceId: FACT.workspaceId,
      path: FACT.resource.path,
      workspaceEpoch: 'caller-selected',
    })).toThrow(/unknown fields/);
    expect(() => context.publishResourceRefreshRequired({
      type: 'resource:refresh_required',
      version: 1,
      workspaceId: FACT.workspaceId,
      panel: 'file-viewer',
      path: FACT.resource.path,
      operationId: FACT.operationId,
      reason: 'fact_publish_failed',
    })).toThrow(/exceeds/);
    const refresh = {
      type: 'resource:refresh_required',
      version: 1,
      workspaceId: FACT.workspaceId,
      panel: 'file-viewer',
      path: FACT.resource.path,
      operationId: FACT.operationId,
      reason: 'projection_failed',
    };
    const refreshPending = context.publishResourceRefreshRequired(refresh);
    refresh.path = 'other.md';
    refresh.workspaceId = 'workspace-2';
    refreshGateRelease();
    await expect(refreshPending).resolves.toBeUndefined();
    expect(observedRefresh).not.toBe(refresh);
    expect(observedRefresh.workspaceId).toBe(FACT.workspaceId);
    expect(observedRefresh.path).toBe(FACT.resource.path);
    expect(Object.isFrozen(observedRefresh)).toBe(true);
    expect(() => context.publishResourceRefreshRequired({
      ...refresh,
      workspaceId: FACT.workspaceId,
      path: FACT.resource.path,
      workspaceEpoch: 'caller-selected',
    })).toThrow(/unknown fields/);
  });

  test.each([
    ['unknown handler', subscription({ handlerKey: 'extension.dynamic-code' }), {}, /Unknown handler/],
    ['unknown capability', subscription({ grants: [
      { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
      { capabilityKey: 'raw.db', scope: {} },
    ] }), {}, /Unknown capability/],
    ['inactive schema', subscription(), { schemas: [schemaState(false), ...defaultSchemas().slice(1)] }, /Unknown effective schema/],
    ['bad filter', subscription({ filter: { eventTypes: EVENT_TYPES, regex: '.*' } }), {}, /unknown key/],
    ['missing consume grant', subscription({ grants: [
      { capabilityKey: 'ledger.append_resource_fact', scope: { workspaceScope: 'event' } },
    ] }), {}, /Missing required capabilities/],
    ['duplicate grant', subscription({ grants: [
      { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
      { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
    ] }), {}, /Duplicate effective capability/],
    ['bad required ack', subscription({
      handlerKey: 'system.resource-render-projection', deliveryPolicy: 'required_ack',
    }), {
      handlers: { 'system.resource-render-projection': async () => {} },
    }, /required_ack/],
  ])('rejects %s without producing a partial generation', (_label, entry, options, error) => {
    expect(() => compile([entry], options)).toThrow(error);
  });

  test('rejects a whole generation when an effective ledger grant lacks its provider', () => {
    const entries = [
      subscription({ subscriptionId: 'ledger-missing-provider' }),
    ];
    expect(() => compile(entries, {
      providers: { writeDiagnostic: () => {} },
    })).toThrow(/appendResourceFact provider is unavailable/);
  });

  test.each(subscription().grants.map((grant) => grant.capabilityKey))(
    'rejects ledger descriptor missing required grant %s',
    (missingCapability) => {
      const grants = subscription().grants
        .filter((grant) => grant.capabilityKey !== missingCapability);
      expect(() => compile([subscription({ grants })])).toThrow(/Missing required capabilities/);
    },
  );

  test.each(RENDERER_GRANTS.map((grant) => grant.capabilityKey))(
    'rejects renderer descriptor missing required grant %s',
    (missingCapability) => {
      const grants = RENDERER_GRANTS
        .filter((grant) => grant.capabilityKey !== missingCapability);
      expect(() => compile([rendererSubscription({ grants })], {
        handlers: { 'system.resource-render-projection': async () => {} },
        providers: {
          publishResourceChanged: async () => {},
          publishResourceRefreshRequired: async () => {},
          writeDiagnostic: () => {},
        },
      })).toThrow(/Missing required capabilities/);
    },
  );

  test.each([
    [
      'ledger',
      subscription({
        grants: subscription().grants.map((grant) => (
          grant.capabilityKey === 'diagnostic.write_fixed'
            ? { ...grant, scope: { codes: ['ledger_write_failed'] } }
            : grant
        )),
      }),
      {},
    ],
    [
      'renderer',
      rendererSubscription({
        grants: RENDERER_GRANTS.map((grant) => (
          grant.capabilityKey === 'diagnostic.write_fixed'
            ? { ...grant, scope: { codes: ['render_projection_failed'] } }
            : grant
        )),
      }),
      {
        handlers: { 'system.resource-render-projection': async () => {} },
        providers: {
          publishResourceChanged: async () => {},
          publishResourceRefreshRequired: async () => {},
          writeDiagnostic: () => {},
        },
      },
    ],
  ])('rejects a partial %s diagnostic scope without producing a generation', (_label, entry, options) => {
    expect(() => compile([entry], options)).toThrow(/scope does not match handler contract/);
  });

  test.each([
    [
      'ledger',
      subscription({
        grants: subscription().grants.map((grant) => (
          grant.capabilityKey === 'diagnostic.write_fixed'
            ? { ...grant, scope: { codes: [...grant.scope.codes, 'arbitrary'] } }
            : grant
        )),
      }),
      {},
    ],
    [
      'renderer',
      rendererSubscription({
        grants: RENDERER_GRANTS.map((grant) => (
          grant.capabilityKey === 'diagnostic.write_fixed'
            ? { ...grant, scope: { codes: [...grant.scope.codes, 'arbitrary'] } }
            : grant
        )),
      }),
      {
        handlers: { 'system.resource-render-projection': async () => {} },
        providers: {
          publishResourceChanged: async () => {},
          publishResourceRefreshRequired: async () => {},
          writeDiagnostic: () => {},
        },
      },
    ],
  ])('rejects a widened %s diagnostic scope without producing a generation', (_label, entry, options) => {
    expect(() => compile([entry], options)).toThrow(/code not owned/);
  });

  test('accepts the complete exact ledger and renderer handler scopes', () => {
    expect(compile([subscription()]).descriptors).toHaveLength(1);
    expect(compile([rendererSubscription()], {
      handlers: { 'system.resource-render-projection': async () => {} },
      providers: {
        publishResourceChanged: async () => {},
        publishResourceRefreshRequired: async () => {},
        writeDiagnostic: () => {},
      },
    }).descriptors).toHaveLength(1);
  });

  test.each([
    [{ publishResourceRefreshRequired: async () => {} }, /publishResourceChanged provider is unavailable/],
    [{ publishResourceChanged: async () => {} }, /publishResourceRefreshRequired provider is unavailable/],
  ])('rejects a renderer generation with an unavailable projection provider %#', (providers, error) => {
    const renderer = rendererSubscription();
    expect(() => compile([renderer], {
      handlers: { 'system.resource-render-projection': async () => {} },
      providers: { ...providers, writeDiagnostic: () => {} },
    })).toThrow(error);
  });

  test.each([
    [
      defaultSchemas().filter((schema) => schema.row.schema_key !== 'resource:changed'),
      /resource:changed@1/,
    ],
    [
      defaultSchemas().map((schema) => (
        schema.row.schema_key === 'resource:changed' ? { ...schema, effective: false } : schema
      )),
      /resource:changed@1/,
    ],
    [
      defaultSchemas().map((schema) => (
        schema.row.schema_key === 'resource:changed'
          ? { ...schema, row: { ...schema.row, schema_version: 2 } }
          : schema
      )),
      /resource:changed@1/,
    ],
    [
      defaultSchemas().map((schema) => (
        schema.row.schema_key === 'resource:refresh_required'
          ? { ...schema, row: { ...schema.row, definition_kind: 'event' } }
          : schema
      )),
      /resource:refresh_required@1/,
    ],
  ])('rejects missing or incompatible renderer output schema authority %#', (schemas, error) => {
    const renderer = rendererSubscription();
    expect(() => compile([renderer], {
      schemas,
      handlers: { 'system.resource-render-projection': async () => {} },
      providers: {
        publishResourceChanged: async () => {},
        publishResourceRefreshRequired: async () => {},
        writeDiagnostic: () => {},
      },
    })).toThrow(error);
  });

  test('provider preflight exposes no provider functions or raw authority', () => {
    const appendResourceFact = async () => {};
    const createScopedContext = createScopedCapabilityFactory({ appendResourceFact });
    expect(createScopedContext.assertAvailable({
      handlerKey: 'system.provenance-ledger',
      grants: [
        { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
        { capabilityKey: 'ledger.append_resource_fact', scope: { workspaceScope: 'event' } },
      ],
    })).toBe(true);
    expect(Object.keys(createScopedContext)).toEqual([]);
    expect(createScopedContext.appendResourceFact).toBeUndefined();
    expect(createScopedContext.providers).toBeUndefined();
    expect(createScopedContext.db).toBeUndefined();
  });

  test('handler catalog rejects non-allowlisted code and does not expose capability providers', () => {
    expect(() => createHandlerCatalog({ 'extension.dynamic': () => {} })).toThrow(/Unknown handler/);
    const catalog = createHandlerCatalog({ 'system.provenance-ledger': () => {} });
    expect(catalog.keys()).toEqual(['system.provenance-ledger']);
    expect(catalog.db).toBeUndefined();
    expect(catalog.capabilities).toBeUndefined();
  });
});
