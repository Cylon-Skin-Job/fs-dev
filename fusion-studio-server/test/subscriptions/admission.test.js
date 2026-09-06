'use strict';

const knex = require('knex');
const migration = require('../../lib/db/migrations/034_event_registry_authority');
const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { canonicalizeJson, sha256CanonicalJson } = require('../../lib/event-registry/canonical-json');

const IDS = Object.freeze({
  event: '123e4567-e89b-42d3-a456-426614174000',
  operation: '123e4567-e89b-42d3-a456-426614174001',
  command: '123e4567-e89b-42d3-a456-426614174002',
  resource: '123e4567-e89b-42d3-a456-426614174003',
});

function createDb() {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  });
}

function commandBody(overrides = {}) {
  return {
    commandId: IDS.command,
    origin: {
      kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only',
    },
    resource: {
      resourceId: IDS.resource,
      kind: 'file',
      path: 'notes/a.md',
      access: { panel: 'file-viewer', path: 'notes/a.md' },
    },
    intent: { kind: 'save', saveReason: 'manual' },
    ...overrides,
  };
}

function mutationBody(overrides = {}) {
  return {
    commandId: IDS.command,
    commandAcceptedEventId: '123e4567-e89b-42d3-a456-426614174004',
    origin: {
      kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only',
    },
    resource: {
      resourceId: IDS.resource,
      kind: 'file',
      path: 'notes/a.md',
      access: { panel: 'file-viewer', path: 'notes/a.md' },
    },
    mutation: { kind: 'modify', saveReason: 'manual' },
    fileVersionId: '123e4567-e89b-42d3-a456-426614174005',
    ...overrides,
  };
}

function createReservationAuthority() {
  const bindings = new WeakMap();
  return Object.freeze({
    reserve({ producerId, schemaKey, schemaVersion, workspaceId, operationId, eventId, occurredAt, body }) {
      const reservation = Object.freeze(Object.create(null));
      const identity = {
        producerId,
        schemaKey,
        schemaVersion,
        workspaceId,
        operationId,
        eventId,
        occurredAt,
      };
      bindings.set(reservation, Object.freeze({
        ...identity,
        canonicalHash: sha256CanonicalJson({ ...identity, body: JSON.parse(canonicalizeJson(body)) }),
      }));
      return reservation;
    },
    async verify({ reservation }) {
      const binding = bindings.get(reservation);
      if (!binding) throw new Error('unknown reservation');
      return binding;
    },
  });
}

describe('governed event admission and sealed host bootstrap', () => {
  let db;
  let registryAccess;
  let publishers;
  let authority;
  let admitted;
  let diagnostics;
  let eventBus;
  let bootstrapGovernedEventBus;

  beforeAll(async () => {
    jest.resetModules();
    db = createDb();
    await migration.up(db);
    registryAccess = (await createInitializedEventRegistry(db, { now: () => 1_000 })).access;
    authority = createReservationAuthority();
    admitted = [];
    diagnostics = [];
    eventBus = require('../../lib/event-bus');
    ({ bootstrapGovernedEventBus } = require('../../lib/subscriptions/host-bootstrap'));
    bootstrapGovernedEventBus({
      registryAccess,
      verifyReservation: authority.verify,
      deliverAdmittedFact: async (fact) => {
        admitted.push(fact);
        return [{ subscriptionId: 'sub-1', handlerKey: 'system.provenance-ledger', status: 'completed' }];
      },
      writeDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      installFileSavePublishers: (value) => { publishers = value; },
    });
  });

  afterAll(async () => db.destroy());

  function reserve(body = commandBody(), overrides = {}) {
    return authority.reserve({
      producerId: 'system.file-save-controller',
      schemaKey: 'file.command_accepted',
      schemaVersion: 1,
      workspaceId: 'workspace-1',
      operationId: IDS.operation,
      eventId: IDS.event,
      occurredAt: 1234,
      body,
      ...overrides,
    });
  }

  test('public legacy exports cannot mint, enumerate, or deliver governed publishers', async () => {
    expect(Object.keys(eventBus).sort()).toEqual(['bus', 'emit', 'on']);
    expect(eventBus.publishFact).toBeUndefined();
    expect(eventBus.bootstrapGovernedEventBus).toBeUndefined();
    const count = admitted.length;
    eventBus.emit('file.command_accepted', {
      eventId: IDS.event,
      eventType: 'file.command_accepted',
      schemaVersion: 1,
    });
    expect(admitted).toHaveLength(count);
  });

  test('admits a registry-valid exact reservation, deep clones/freezes, and reports exact delivery', async () => {
    const body = commandBody();
    const reservation = reserve(body);
    const result = await publishers.publishFileCommandAccepted({ reservation, body });

    expect(result).toEqual({
      admitted: true,
      eventId: IDS.event,
      deliveries: [{
        subscriptionId: 'sub-1', handlerKey: 'system.provenance-ledger', status: 'completed',
      }],
    });
    expect(Object.isFrozen(result)).toBe(true);
    const fact = admitted.at(-1);
    expect(fact).toMatchObject({
      eventId: IDS.event,
      eventType: 'file.command_accepted',
      schemaVersion: 1,
      occurredAt: 1234,
      workspaceId: 'workspace-1',
      operationId: IDS.operation,
      commandId: IDS.command,
    });
    expect(Object.isFrozen(fact)).toBe(true);
    expect(Object.isFrozen(fact.resource)).toBe(true);
    body.resource.path = 'changed-after-admission.md';
    expect(fact.resource.path).toBe('notes/a.md');
  });

  test('mints only the two fixed file-save producer/schema publishers', async () => {
    expect(Object.keys(publishers).sort()).toEqual([
      'publishFileCommandAccepted', 'publishResourceMutated',
    ]);
    expect(publishers.forProducer).toBeUndefined();
    expect(publishers.forSchema).toBeUndefined();
    expect(publishers.catalog).toBeUndefined();

    const body = mutationBody();
    const reservation = authority.reserve({
      producerId: 'system.file-save-controller',
      schemaKey: 'resource.mutated',
      schemaVersion: 1,
      workspaceId: 'workspace-1',
      operationId: IDS.operation,
      eventId: '123e4567-e89b-42d3-a456-426614174006',
      occurredAt: 2345,
      body,
    });
    await expect(publishers.publishResourceMutated({ reservation, body }))
      .resolves.toMatchObject({ admitted: true, eventId: '123e4567-e89b-42d3-a456-426614174006' });
  });

  test('delivers an exact replay again but rejects any changed durable input', async () => {
    const body = commandBody();
    const reservation = reserve(body);
    const before = admitted.length;
    await expect(publishers.publishFileCommandAccepted({ reservation, body }))
      .resolves.toMatchObject({ admitted: true });
    await expect(publishers.publishFileCommandAccepted({ reservation, body: commandBody() }))
      .resolves.toMatchObject({ admitted: true });
    expect(admitted).toHaveLength(before + 2);

    await expect(publishers.publishFileCommandAccepted({
      reservation,
      body: commandBody({ intent: { kind: 'save', saveReason: 'autosave' } }),
    })).resolves.toEqual({ admitted: false, eventId: null, deliveries: [] });
    expect(admitted).toHaveLength(before + 2);
  });

  test.each([
    ['malformed input', null],
    ['raw complete fact', { reservation: Object.freeze({}), body: commandBody() }],
    ['caller event ID', { reservation: null, body: commandBody({ eventId: IDS.event }) }],
    ['caller timestamp', { reservation: null, body: commandBody({ occurredAt: 1234 }) }],
    ['caller schema version', { reservation: null, body: commandBody({ schemaVersion: 1 }) }],
  ])('rejects %s without private delivery', async (_label, input) => {
    const before = admitted.length;
    await expect(publishers.publishFileCommandAccepted(input))
      .resolves.toEqual({ admitted: false, eventId: null, deliveries: [] });
    expect(admitted).toHaveLength(before);
  });

  test('rejects reservations bound to the wrong producer/schema and schema-invalid bodies', async () => {
    const wrong = reserve(commandBody(), {
      producerId: 'system.other-controller',
      schemaKey: 'resource.mutated',
    });
    const before = admitted.length;
    await expect(publishers.publishFileCommandAccepted({ reservation: wrong, body: commandBody() }))
      .resolves.toMatchObject({ admitted: false });

    const invalidBody = commandBody({ commandId: 'caller-chosen-not-a-uuid' });
    await expect(publishers.publishFileCommandAccepted({
      reservation: reserve(invalidBody), body: invalidBody,
    })).resolves.toMatchObject({ admitted: false });
    expect(admitted).toHaveLength(before);
  });

  test('late or duplicate bootstrap is irreversibly rejected and diagnostics remain bounded', () => {
    expect(() => bootstrapGovernedEventBus({
      registryAccess,
      verifyReservation: authority.verify,
      deliverAdmittedFact: async () => [],
      writeDiagnostic: () => {},
      installFileSavePublishers: () => {},
    })).toThrow(/already sealed/);
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of diagnostics) {
      expect(Object.keys(diagnostic).sort()).toEqual([
        'code', 'producerId', 'schemaKey', 'schemaVersion',
      ]);
      expect(JSON.stringify(diagnostic)).not.toContain('notes/a.md');
    }
  });

  test('internal admission bootstrap accepts no caller producer catalog or bus identity', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/subscriptions/admission.js'),
      'utf8',
    );
    const signature = source.slice(source.indexOf('function bootstrapAdmission'), source.indexOf(') {', source.indexOf('function bootstrapAdmission')));
    expect(signature).not.toContain('publishers');
    expect(signature).not.toContain('legacyBus');
    expect(source).not.toMatch(/publishers\s*:\s*options|options\.publishers|legacyBus\s*:/u);
  });

  test('caller-supplied catalog input is ignored and a failed installer cannot reopen minting', () => {
    jest.isolateModules(() => {
      const { bootstrapGovernedEventBus: isolatedBootstrap } = require('../../lib/subscriptions/host-bootstrap');
      let captured;
      isolatedBootstrap({
        registryAccess: { validatePayload: async () => ({ valid: true }) },
        verifyReservation: async () => { throw new Error('unused'); },
        deliverAdmittedFact: async () => [],
        writeDiagnostic: () => {},
        installFileSavePublishers: (value) => { captured = value; },
        publishers: [{ producerId: 'attacker', schemaKey: 'attacker.fact', schemaVersion: 99 }],
        legacyBus: {},
      });
      expect(Object.keys(captured).sort()).toEqual([
        'publishFileCommandAccepted', 'publishResourceMutated',
      ]);
    });

    jest.isolateModules(() => {
      const { bootstrapGovernedEventBus: isolatedBootstrap } = require('../../lib/subscriptions/host-bootstrap');
      const options = {
        registryAccess: { validatePayload: async () => ({ valid: true }) },
        verifyReservation: async () => { throw new Error('unused'); },
        deliverAdmittedFact: async () => [],
        writeDiagnostic: () => {},
        installFileSavePublishers: () => { throw new Error('installation failed'); },
      };
      expect(() => isolatedBootstrap(options)).toThrow(/installation failed/);
      expect(() => isolatedBootstrap({ ...options, installFileSavePublishers: () => {} }))
        .toThrow(/already sealed/);
    });
  });

  test('snapshots body bytes before asynchronous reservation verification', async () => {
    let publication;
    jest.isolateModules(() => {
      const { bootstrapGovernedEventBus: isolatedBootstrap } = require('../../lib/subscriptions/host-bootstrap');
      const body = commandBody();
      const identity = {
        producerId: 'system.file-save-controller',
        schemaKey: 'file.command_accepted',
        schemaVersion: 1,
        workspaceId: 'workspace-1',
        operationId: IDS.operation,
        eventId: IDS.event,
        occurredAt: 1234,
      };
      const verified = Object.freeze({
        ...identity,
        canonicalHash: sha256CanonicalJson({ ...identity, body: JSON.parse(canonicalizeJson(body)) }),
      });
      let release;
      const gate = new Promise((resolve) => { release = () => resolve(verified); });
      let isolatedPublishers;
      let delivered;
      isolatedBootstrap({
        registryAccess: { validatePayload: async () => ({ valid: true }) },
        verifyReservation: async () => gate,
        deliverAdmittedFact: async (fact) => { delivered = fact; return []; },
        writeDiagnostic: () => {},
        installFileSavePublishers: (value) => { isolatedPublishers = value; },
      });
      publication = (async () => {
        const pending = isolatedPublishers.publishFileCommandAccepted({ reservation: {}, body });
        body.resource.path = 'mutated-during-verification.md';
        release();
        const result = await pending;
        expect(result.admitted).toBe(true);
        expect(delivered.resource.path).toBe('notes/a.md');
      })();
    });
    await publication;
  });

  test('reports private typed agent commit failures without widening the public rejection body', async () => {
    let publication;
    jest.isolateModules(() => {
      const { bootstrapGovernedEventBus: isolatedBootstrap } = require('../../lib/subscriptions/host-bootstrap');
      const body = { fixture: true };
      const reservation = Object.freeze(Object.create(null));
      const identity = {
        producerId: 'system.agent-tool-activity-controller', schemaKey: 'agent.tool_completed',
        schemaVersion: 1, workspaceId: 'workspace-1', operationId: IDS.operation,
        eventId: IDS.event, occurredAt: 1234,
      };
      const rejected = jest.fn();
      let agentPublishers;
      isolatedBootstrap({
        registryAccess: { validatePayload: async () => ({ valid: true }) },
        verifyReservation: async () => { throw new Error('unused'); },
        verifyAgentReservation: async () => ({
          ...identity,
          canonicalHash: sha256CanonicalJson({ ...identity, body }),
        }),
        commitVerifiedAgentAdmission: async () => {
          const error = new Error('disk I/O failure'); error.code = 'SQLITE_IOERR'; throw error;
        },
        deliverAdmittedFact: async () => [],
        writeDiagnostic: () => {},
        installFileSavePublishers: () => {},
        installAgentPublishers: (value) => { agentPublishers = value; },
        onAgentAdmissionRejected: rejected,
      });
      publication = agentPublishers.publishAgentToolCompleted({ reservation, body }).then((result) => {
        expect(result).toEqual({ admitted: false, eventId: null, deliveries: [] });
        expect(Object.getOwnPropertySymbols(result)).toEqual([]);
        expect(rejected).toHaveBeenCalledWith(reservation, 'operational', false);
      });
    });
    await publication;
  });

  test('an owner closed during admission commit leaves durable truth for restart without late delivery', async () => {
    let publication;
    jest.isolateModules(() => {
      const { bootstrapGovernedEventBus: isolatedBootstrap } = require('../../lib/subscriptions/host-bootstrap');
      const body = { fixture: true };
      const reservation = Object.freeze(Object.create(null));
      const identity = {
        producerId: 'system.agent-tool-activity-controller', schemaKey: 'agent.tool_completed',
        schemaVersion: 1, workspaceId: 'workspace-1', operationId: IDS.operation,
        eventId: IDS.event, occurredAt: 1234,
      };
      let current = true;
      let releaseCommit;
      const commitGate = new Promise((resolve) => { releaseCommit = resolve; });
      const delivered = jest.fn(async () => []);
      const committed = jest.fn();
      let agentPublishers;
      isolatedBootstrap({
        registryAccess: { validatePayload: async () => ({ valid: true }) },
        verifyReservation: async () => { throw new Error('unused'); },
        verifyAgentReservation: async () => ({
          ...identity,
          canonicalHash: sha256CanonicalJson({ ...identity, body }),
        }),
        commitVerifiedAgentAdmission: async () => commitGate,
        deliverAdmittedFact: delivered,
        writeDiagnostic: () => {},
        installFileSavePublishers: () => {},
        installAgentPublishers: (value) => { agentPublishers = value; },
        onAgentAdmissionCommitted: committed,
        isAgentAdmissionCurrent: () => current,
      });
      publication = (async () => {
        const pending = agentPublishers.publishAgentToolCompleted({ reservation, body });
        await new Promise((resolve) => setImmediate(resolve));
        current = false;
        releaseCommit();
        await expect(pending).resolves.toEqual({ admitted: true, eventId: IDS.event, deliveries: [] });
        expect(delivered).not.toHaveBeenCalled();
        expect(committed).not.toHaveBeenCalled();
      })();
    });
    await publication;
  });
});
