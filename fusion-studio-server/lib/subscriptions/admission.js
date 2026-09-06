'use strict';

const { canonicalizeJson, sha256CanonicalJson } = require('../event-registry/canonical-json');
const { bus } = require('../event-bus');
const { deepFreeze } = require('./deep-freeze');

const RUNTIMES = new WeakMap();
const RESERVED_BODY_KEYS = new Set([
  'eventId',
  'eventType',
  'schemaVersion',
  'occurredAt',
  'producerId',
  'workspaceId',
  'operationId',
  'reservation',
  'type',
  'timestamp',
]);
const DELIVERY_STATUSES = new Set([
  'completed',
  'invoked',
  'failed',
  'timed_out',
  'skipped',
]);
// This is the only publisher catalog. It is lexical, immutable, and cannot be
// supplied, widened, selected, or enumerated by a bootstrap caller.
const STATIC_PUBLISHERS = deepFreeze([
  {
    producerId: 'system.file-save-controller',
    schemaKey: 'file.command_accepted',
    schemaVersion: 1,
  },
  {
    producerId: 'system.file-save-controller',
    schemaKey: 'resource.mutated',
    schemaVersion: 1,
  },
  {
    producerId: 'system.agent-tool-activity-controller',
    schemaKey: 'agent.tool_completed',
    schemaVersion: 1,
    preDispatchCommit: true,
  },
  {
    producerId: 'system.agent-resource-observer',
    schemaKey: 'resource.state_observed',
    schemaVersion: 1,
    preDispatchCommit: true,
  },
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} must contain exactly ${expected.join(', ')}`);
  }
}

function assertIdentity(identity) {
  assertPlainObject(identity, 'verified reservation identity');
  assertExactKeys(identity, [
    'producerId',
    'schemaKey',
    'schemaVersion',
    'workspaceId',
    'operationId',
    'eventId',
    'occurredAt',
    'canonicalHash',
  ], 'verified reservation identity');
  if (
    typeof identity.producerId !== 'string'
    || typeof identity.schemaKey !== 'string'
    || !Number.isInteger(identity.schemaVersion)
    || typeof identity.workspaceId !== 'string'
    || typeof identity.operationId !== 'string'
    || typeof identity.eventId !== 'string'
    || !Number.isInteger(identity.occurredAt)
    || typeof identity.canonicalHash !== 'string'
    || !/^[0-9a-f]{64}$/u.test(identity.canonicalHash)
  ) throw new TypeError('verified reservation identity is malformed');
}

function rejectionReport() {
  return deepFreeze({ admitted: false, eventId: null, deliveries: [] });
}

function diagnose(runtime, code, publisher) {
  try {
    const result = runtime.writeDiagnostic(deepFreeze({
      code,
      producerId: publisher.producerId,
      schemaKey: publisher.schemaKey,
      schemaVersion: publisher.schemaVersion,
    }));
    if (result && typeof result.then === 'function') result.catch(() => {});
  } catch (_error) {
    // Diagnostics are intentionally best effort and never expose candidate data.
  }
}

function normalizeDeliveries(deliveries) {
  if (!Array.isArray(deliveries)) throw new TypeError('delivery result must be an array');
  return deliveries.map((delivery) => {
    assertPlainObject(delivery, 'delivery result');
    assertExactKeys(delivery, ['subscriptionId', 'handlerKey', 'status'], 'delivery result');
    if (
      typeof delivery.subscriptionId !== 'string'
      || delivery.subscriptionId.length === 0
      || typeof delivery.handlerKey !== 'string'
      || delivery.handlerKey.length === 0
      || !DELIVERY_STATUSES.has(delivery.status)
    ) throw new TypeError('delivery result is malformed');
    return {
      subscriptionId: delivery.subscriptionId,
      handlerKey: delivery.handlerKey,
      status: delivery.status,
    };
  });
}

function durableInput(publisher, identity, body) {
  return {
    producerId: publisher.producerId,
    schemaKey: publisher.schemaKey,
    schemaVersion: publisher.schemaVersion,
    eventId: identity.eventId,
    occurredAt: identity.occurredAt,
    workspaceId: identity.workspaceId,
    operationId: identity.operationId,
    body,
  };
}

function createPublisher(runtime, publisher) {
  return Object.freeze(async function publishFact(input) {
    let rejectionKind = 'semantic';
    let rejectionRetryable = false;
    let reservation = null;
    try {
      assertPlainObject(input, 'publishFact input');
      assertExactKeys(input, ['reservation', 'body'], 'publishFact input');
      assertPlainObject(input.body, 'publishFact body');
      for (const key of Object.keys(input.body)) {
        if (RESERVED_BODY_KEYS.has(key)) throw new TypeError(`publishFact body contains reserved field ${key}`);
      }
      // Snapshot the candidate before any asynchronous reservation lookup so
      // callers cannot change the value while verification is in flight.
      const canonicalBody = JSON.parse(canonicalizeJson(input.body));

      // The injected verifier is the only component allowed to interpret the
      // opaque reservation. It must return the identity bound by durable state.
      reservation = input.reservation;
      rejectionKind = 'operational';
      const identity = await runtime.verifyReservation(Object.freeze({
        reservation,
        producerId: publisher.producerId,
        schemaKey: publisher.schemaKey,
        schemaVersion: publisher.schemaVersion,
      }));
      assertIdentity(identity);
      rejectionKind = 'semantic';
      if (
        identity.producerId !== publisher.producerId
        || identity.schemaKey !== publisher.schemaKey
        || identity.schemaVersion !== publisher.schemaVersion
      ) throw new Error('reservation authority mismatch');

      // Canonicalization both rejects non-data values/accessors and ensures
      // the hash covers the complete durable envelope/body input.
      const expectedHash = sha256CanonicalJson(durableInput(publisher, identity, canonicalBody));
      if (identity.canonicalHash !== expectedHash) throw new Error('reservation input mismatch');

      const fact = JSON.parse(canonicalizeJson({
        eventId: identity.eventId,
        eventType: publisher.schemaKey,
        schemaVersion: publisher.schemaVersion,
        occurredAt: identity.occurredAt,
        workspaceId: identity.workspaceId,
        operationId: identity.operationId,
        ...canonicalBody,
      }));
      const validation = await runtime.validatePayload({
        schemaKey: publisher.schemaKey,
        schemaVersion: publisher.schemaVersion,
        definitionKind: 'event',
      }, fact);
      if (!validation || validation.valid !== true) throw new Error('schema validation failed');

      const admittedFact = deepFreeze(fact);
      if (publisher.preDispatchCommit) {
        if (!runtime.isAgentAdmissionCurrent(reservation)) {
          const error = new Error('agent fact admission owner is shutting down');
          error.code = 'agent_fact_admission_shutdown';
          throw error;
        }
        rejectionKind = 'operational';
        await runtime.commitVerifiedAgentAdmission({
          reservation,
          fact: admittedFact,
        });
        if (!runtime.isAgentAdmissionCurrent(reservation)) {
          return deepFreeze({ admitted: true, eventId: admittedFact.eventId, deliveries: [] });
        }
        runtime.onAgentAdmissionCommitted(admittedFact);
      }
      let deliveries = [];
      try {
        deliveries = normalizeDeliveries(await runtime.deliverAdmittedFact(admittedFact));
      } catch (_error) {
        diagnose(runtime, 'governed_delivery_failed', publisher);
      }
      return deepFreeze({ admitted: true, eventId: admittedFact.eventId, deliveries });
    } catch (error) {
      if (error?.code === 'agent_fact_admission_conflict') rejectionKind = 'semantic';
      rejectionRetryable = error?.code === 'agent_fact_admission_transition_failed'
        || error?.code === 'SQLITE_BUSY'
        || error?.code === 'SQLITE_CONSTRAINT_UNIQUE'
        || /database is locked|cannot start a transaction within a transaction/iu.test(String(error?.message));
      if (publisher.preDispatchCommit && reservation) {
        runtime.onAgentAdmissionRejected(reservation, rejectionKind, rejectionRetryable);
      }
      diagnose(runtime, 'governed_admission_rejected', publisher);
      return rejectionReport();
    }
  });
}

function bootstrapAdmission({
  registryAccess,
  verifyReservation,
  verifyAgentReservation = async () => { throw new Error('agent reservation authority is unavailable'); },
  commitVerifiedAgentAdmission = async () => { throw new Error('agent admission authority is unavailable'); },
  deliverAdmittedFact,
  writeDiagnostic,
  installFileSavePublishers,
  installAgentPublishers = () => {},
  onAgentAdmissionCommitted = () => {},
  onAgentAdmissionRejected = () => {},
  isAgentAdmissionCurrent = () => true,
}) {
  if (RUNTIMES.has(bus)) throw new Error('Governed event admission is already sealed');
  if (!registryAccess || typeof registryAccess.validatePayload !== 'function') {
    throw new TypeError('initialized registry access is required');
  }
  if (typeof verifyReservation !== 'function') throw new TypeError('reservation verifier is required');
  if (typeof verifyAgentReservation !== 'function') throw new TypeError('agent reservation verifier is required');
  if (typeof commitVerifiedAgentAdmission !== 'function') {
    throw new TypeError('agent pre-dispatch admission commit is required');
  }
  if (typeof deliverAdmittedFact !== 'function') throw new TypeError('private admitted-fact delivery is required');
  if (typeof writeDiagnostic !== 'function') throw new TypeError('diagnostic writer is required');
  if (typeof installFileSavePublishers !== 'function') {
    throw new TypeError('file-save publisher installer is required');
  }
  if (typeof installAgentPublishers !== 'function') {
    throw new TypeError('agent publisher installer is required');
  }
  if (typeof onAgentAdmissionCommitted !== 'function') {
    throw new TypeError('agent admission continuation is required');
  }
  if (typeof onAgentAdmissionRejected !== 'function') {
    throw new TypeError('agent admission rejection continuation is required');
  }
  if (typeof isAgentAdmissionCurrent !== 'function') {
    throw new TypeError('agent admission lifecycle verifier is required');
  }
  const runtime = Object.freeze({
    validatePayload: registryAccess.validatePayload.bind(registryAccess),
    verifyReservation(input) {
      const agentFact = (input.producerId === 'system.agent-tool-activity-controller'
          && input.schemaKey === 'agent.tool_completed' && input.schemaVersion === 1)
        || (input.producerId === 'system.agent-resource-observer'
          && input.schemaKey === 'resource.state_observed' && input.schemaVersion === 1);
      return agentFact
        ? verifyAgentReservation(input)
        : verifyReservation(input);
    },
    commitVerifiedAgentAdmission,
    deliverAdmittedFact,
    writeDiagnostic,
    onAgentAdmissionCommitted(fact) {
      try {
        const result = onAgentAdmissionCommitted(fact);
        if (result && typeof result.then === 'function') result.catch(() => {});
      } catch (_error) {}
    },
    onAgentAdmissionRejected(reservation, kind, retryable) {
      try { onAgentAdmissionRejected(reservation, kind, retryable); } catch (_error) {}
    },
    isAgentAdmissionCurrent(reservation) {
      try { return isAgentAdmissionCurrent(reservation) === true; } catch (_error) { return false; }
    },
  });
  // Seal before invoking injection code. A failing installer cannot reopen or
  // repeat privileged publisher minting.
  RUNTIMES.set(bus, runtime);
  const minted = STATIC_PUBLISHERS.map((publisher) => createPublisher(runtime, publisher));
  const fileSavePublishers = deepFreeze({
    publishFileCommandAccepted: minted[0],
    publishResourceMutated: minted[1],
  });
  const agentPublishers = deepFreeze({
    publishAgentToolCompleted: minted[2],
    publishResourceStateObserved: minted[3],
  });
  installFileSavePublishers(fileSavePublishers);
  installAgentPublishers(agentPublishers);
  return Object.freeze({ sealed: true });
}

module.exports = { bootstrapAdmission };
