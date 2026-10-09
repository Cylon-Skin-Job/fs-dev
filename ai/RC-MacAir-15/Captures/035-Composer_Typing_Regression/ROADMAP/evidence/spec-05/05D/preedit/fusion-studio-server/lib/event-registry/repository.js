'use strict';

const crypto = require('crypto');
const { canonicalizeJson, sha256CanonicalJson } = require('./canonical-json');
const {
  capabilityScopeAuthorizes,
  normalizeCapabilityScope,
  normalizeRequestedCapabilities,
  requestSetIsNarrowerOrEqual,
} = require('./capability-catalog');
const { filterIsNarrowerOrEqual, normalizeFilter } = require('./filter');
const {
  createSubscriptionEnvelope,
  evaluateSchemaRow,
  evaluateSubscriptionRow,
  normalizeSubscriptionEnvelope,
  parseStoredCanonicalJson,
  schemaReferenceKey,
} = require('./policy');

class RegistryConflictError extends Error {
  constructor(message = 'Registry row changed concurrently') {
    super(message);
    this.name = 'RegistryConflictError';
    this.code = 'registry_conflict';
  }
}

class RegistryAuthorizationError extends Error {
  constructor(message = 'Human authorization capability required') {
    super(message);
    this.name = 'RegistryAuthorizationError';
    this.code = 'human_authorization_required';
  }
}

const HUMAN_AUTHORIZATION_CAPABILITY = Object.freeze(Object.create(null));

function nowInteger(now) {
  const value = now();
  if (!Number.isInteger(value) || value < 0) throw new TypeError('now() must return epoch milliseconds');
  return value;
}

function nextUpdatedAt(row, now) {
  return Math.max(nowInteger(now), row.updated_at + 1);
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function requireExpectedUpdatedAt(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError('expectedUpdatedAt must be a nonnegative integer');
  }
}

function createRepository(knex, options = {}, authorizationCapability = null) {
  if (typeof knex !== 'function') throw new TypeError('An initialized Knex instance is required');
  const now = options.now || Date.now;
  const installedHandlers = new Set(options.installedHandlers || []);
  const systemSchemaIntegrity = new Map(options.systemSchemaIntegrity || []);
  const systemSubscriptionIntegrity = new Map(options.systemSubscriptionIntegrity || []);
  const validateSchemaDefinition = options.validateSchemaDefinition || null;
  const schemaDiagnosticsById = new Map(options.schemaDiagnosticsById || []);

  async function createSchema(input, system = false) {
    if (!input || typeof input !== 'object') throw new TypeError('schema input is required');
    const definitionJson = canonicalizeJson(input.definition);
    const timestamp = nowInteger(now);
    const row = {
      schema_id: input.schemaId || makeId(system ? 'system-schema' : 'extension-schema'),
      schema_key: input.schemaKey,
      schema_version: input.schemaVersion,
      definition_kind: input.definitionKind,
      owner_kind: system ? 'system' : 'extension',
      owner_id: input.ownerId,
      locked: system ? 1 : 0,
      status: system ? 'enabled' : 'pending',
      definition_json: definitionJson,
      definition_sha256: sha256CanonicalJson(input.definition),
      created_at: timestamp,
      updated_at: timestamp,
    };
    await knex('event_schema_registry').insert(row);
    if (system) systemSchemaIntegrity.set(row.schema_id, {
      checksum: row.definition_sha256,
      schemaKey: row.schema_key,
      schemaVersion: row.schema_version,
      definitionKind: row.definition_kind,
      ownerId: row.owner_id,
    });
    return row;
  }

  async function createSubscription(input, system = false) {
    if (!input || typeof input !== 'object') throw new TypeError('subscription input is required');
    const envelope = createSubscriptionEnvelope(
      system ? {
        ...input,
        owner: { kind: 'system', id: input.ownerId },
        locked: true,
      } : input,
      { forcedExtension: !system },
    );
    const timestamp = nowInteger(now);
    const row = {
      subscription_id: input.subscriptionId || makeId(system ? 'system-subscription' : 'extension-subscription'),
      owner_kind: envelope.owner.kind,
      owner_id: envelope.owner.id,
      locked: Number(envelope.locked),
      status: system ? 'enabled' : 'pending',
      handler_key: envelope.handlerKey,
      priority: envelope.priority,
      filter_json: canonicalizeJson(envelope.filter),
      requested_capabilities_json: canonicalizeJson(envelope.requestedCapabilities),
      definition_json: canonicalizeJson(envelope),
      definition_sha256: sha256CanonicalJson(envelope),
      delivery_policy: envelope.deliveryPolicy,
      installation_id: input.installationId || null,
      installation_revision: input.installationRevision || null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await knex('event_subscription_registry').insert(row);
    if (system) systemSubscriptionIntegrity.set(row.subscription_id, {
      checksum: row.definition_sha256,
      ownerId: row.owner_id,
      envelope,
    });
    return row;
  }

  async function listSchemas() {
    return knex('event_schema_registry')
      .select('*')
      .orderBy([
        { column: 'definition_kind', order: 'asc' },
        { column: 'schema_key', order: 'asc' },
        { column: 'schema_version', order: 'asc' },
      ]);
  }

  async function listSubscriptions() {
    return knex('event_subscription_registry')
      .select('*')
      .orderBy([{ column: 'priority', order: 'asc' }, { column: 'subscription_id', order: 'asc' }]);
  }

  async function getSubscription(subscriptionId) {
    return knex('event_subscription_registry').where({ subscription_id: subscriptionId }).first();
  }

  async function getSchema(schemaId) {
    return knex('event_schema_registry').where({ schema_id: schemaId }).first();
  }

  async function updateSchema(schemaId, expectedUpdatedAt, buildPatch) {
    requireExpectedUpdatedAt(expectedUpdatedAt);
    return knex.transaction(async (trx) => {
      const row = await trx('event_schema_registry').where({ schema_id: schemaId }).first();
      if (!row) throw new Error(`Unknown schema ${schemaId}`);
      if (row.updated_at !== expectedUpdatedAt) throw new RegistryConflictError();
      const updatedAt = nextUpdatedAt(row, now);
      const changed = await trx('event_schema_registry')
        .where({ schema_id: schemaId, updated_at: expectedUpdatedAt })
        .update({ ...(await buildPatch(row)), updated_at: updatedAt });
      if (changed !== 1) throw new RegistryConflictError();
      return trx('event_schema_registry').where({ schema_id: schemaId }).first();
    });
  }

  function transitionSchemaStatus(
    schemaId,
    expectedUpdatedAt,
    target,
    allowedFrom,
    { authorization, requireHumanAuthorization = false } = {},
  ) {
    return updateSchema(schemaId, expectedUpdatedAt, (row) => {
      if (!allowedFrom.includes(row.status)) {
        throw new Error(`Cannot transition schema from ${row.status} to ${target}`);
      }
      if (
        requireHumanAuthorization
        && (authorizationCapability !== HUMAN_AUTHORIZATION_CAPABILITY
          || authorization !== HUMAN_AUTHORIZATION_CAPABILITY)
      ) throw new RegistryAuthorizationError();
      return { status: target };
    });
  }

  async function updateSubscription(subscriptionId, expectedUpdatedAt, buildPatch) {
    requireExpectedUpdatedAt(expectedUpdatedAt);
    return knex.transaction(async (trx) => {
      const row = await trx('event_subscription_registry')
        .where({ subscription_id: subscriptionId })
        .first();
      if (!row) throw new Error(`Unknown subscription ${subscriptionId}`);
      if (row.updated_at !== expectedUpdatedAt) throw new RegistryConflictError();
      const patch = await buildPatch(row);
      const updatedAt = nextUpdatedAt(row, now);
      const changed = await trx('event_subscription_registry')
        .where({ subscription_id: subscriptionId, updated_at: expectedUpdatedAt })
        .update({ ...patch, updated_at: updatedAt });
      if (changed !== 1) throw new RegistryConflictError();
      return trx('event_subscription_registry').where({ subscription_id: subscriptionId }).first();
    });
  }

  async function changeSubscriptionRequest(
    subscriptionId,
    change,
    { expectedUpdatedAt, authorization } = {},
  ) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) {
      throw new TypeError('request change must be an object');
    }
    return updateSubscription(subscriptionId, expectedUpdatedAt, (row) => {
      const envelope = normalizeSubscriptionEnvelope(
        parseStoredCanonicalJson(row.definition_json, 'subscription definition'),
      );
      if (row.locked === 1) {
        throw new RegistryAuthorizationError(
          'Locked system definitions are immutable; use grant or lifecycle reductions',
        );
      }
      const filter = Object.prototype.hasOwnProperty.call(change, 'filter')
        ? normalizeFilter(change.filter)
        : envelope.filter;
      const requestedCapabilities = Object.prototype.hasOwnProperty.call(change, 'requestedCapabilities')
        ? normalizeRequestedCapabilities(change.requestedCapabilities, { handlerKey: envelope.handlerKey })
        : envelope.requestedCapabilities;
      const isDownward = filterIsNarrowerOrEqual(filter, envelope.filter)
        && requestSetIsNarrowerOrEqual(
          requestedCapabilities,
          envelope.requestedCapabilities,
          { handlerKey: envelope.handlerKey },
        );
      const isHumanAuthorized = authorizationCapability === HUMAN_AUTHORIZATION_CAPABILITY
        && authorization === HUMAN_AUTHORIZATION_CAPABILITY;
      if (!isDownward && !isHumanAuthorized) {
        throw new RegistryAuthorizationError();
      }
      const nextEnvelope = normalizeSubscriptionEnvelope({
        ...envelope,
        filter,
        requestedCapabilities,
      });
      return {
        filter_json: canonicalizeJson(nextEnvelope.filter),
        requested_capabilities_json: canonicalizeJson(nextEnvelope.requestedCapabilities),
        definition_json: canonicalizeJson(nextEnvelope),
        definition_sha256: sha256CanonicalJson(nextEnvelope),
      };
    });
  }

  function transitionStatus(
    subscriptionId,
    expectedUpdatedAt,
    target,
    allowedFrom,
    { authorization, requireHumanAuthorization = false } = {},
  ) {
    return updateSubscription(subscriptionId, expectedUpdatedAt, (row) => {
      if (!allowedFrom.includes(row.status)) {
        throw new Error(`Cannot transition subscription from ${row.status} to ${target}`);
      }
      if (
        requireHumanAuthorization
        && (authorizationCapability !== HUMAN_AUTHORIZATION_CAPABILITY
          || authorization !== HUMAN_AUTHORIZATION_CAPABILITY)
      ) {
        throw new RegistryAuthorizationError();
      }
      return { status: target };
    });
  }

  async function revokeCapability(subscriptionId, capabilityKey, { expectedUpdatedAt } = {}) {
    requireExpectedUpdatedAt(expectedUpdatedAt);
    return knex.transaction(async (trx) => {
      const grant = await trx('event_subscription_grants')
        .where({ subscription_id: subscriptionId, capability_key: capabilityKey })
        .first();
      if (!grant) throw new Error(`Unknown grant ${subscriptionId}/${capabilityKey}`);
      if (grant.updated_at !== expectedUpdatedAt) throw new RegistryConflictError();
      const updatedAt = nextUpdatedAt(grant, now);
      const changed = await trx('event_subscription_grants')
        .where({
          subscription_id: subscriptionId,
          capability_key: capabilityKey,
          updated_at: expectedUpdatedAt,
        })
        .update({ state: 'revoked', updated_at: updatedAt });
      if (changed !== 1) throw new RegistryConflictError();
      return trx('event_subscription_grants')
        .where({ subscription_id: subscriptionId, capability_key: capabilityKey })
        .first();
    });
  }

  async function narrowCapabilityGrant(
    subscriptionId,
    capabilityKey,
    scope,
    { expectedUpdatedAt } = {},
  ) {
    requireExpectedUpdatedAt(expectedUpdatedAt);
    return knex.transaction(async (trx) => {
      const [grant, subscription] = await Promise.all([
        trx('event_subscription_grants')
          .where({ subscription_id: subscriptionId, capability_key: capabilityKey })
          .first(),
        trx('event_subscription_registry').where({ subscription_id: subscriptionId }).first(),
      ]);
      if (!grant || !subscription) throw new Error(`Unknown grant ${subscriptionId}/${capabilityKey}`);
      if (grant.updated_at !== expectedUpdatedAt) throw new RegistryConflictError();
      if (grant.state !== 'granted') throw new Error('Only a granted capability scope can be narrowed');
      const envelope = normalizeSubscriptionEnvelope(
        parseStoredCanonicalJson(subscription.definition_json, 'subscription definition'),
      );
      const currentScope = normalizeCapabilityScope(
        capabilityKey,
        parseStoredCanonicalJson(grant.scope_json, 'grant scope'),
        { handlerKey: envelope.handlerKey },
      );
      const nextScope = normalizeCapabilityScope(
        capabilityKey,
        scope,
        { handlerKey: envelope.handlerKey },
      );
      if (!capabilityScopeAuthorizes(
        capabilityKey,
        currentScope,
        nextScope,
        { handlerKey: envelope.handlerKey },
      )) throw new RegistryAuthorizationError('Capability scope expansion requires human authorization');
      const updatedAt = nextUpdatedAt(grant, now);
      const changed = await trx('event_subscription_grants')
        .where({
          subscription_id: subscriptionId,
          capability_key: capabilityKey,
          updated_at: expectedUpdatedAt,
        })
        .update({ scope_json: canonicalizeJson(nextScope), updated_at: updatedAt });
      if (changed !== 1) throw new RegistryConflictError();
      return trx('event_subscription_grants')
        .where({ subscription_id: subscriptionId, capability_key: capabilityKey })
        .first();
    });
  }

  async function grantCapability(
    subscriptionId,
    capabilityKey,
    scope,
    { expectedUpdatedAt, authorization } = {},
  ) {
    if (authorization !== authorizationCapability) throw new RegistryAuthorizationError();
    requireExpectedUpdatedAt(expectedUpdatedAt);
    return knex.transaction(async (trx) => {
      const subscription = await trx('event_subscription_registry')
        .where({ subscription_id: subscriptionId })
        .first();
      if (!subscription) throw new Error(`Unknown subscription ${subscriptionId}`);
      const envelope = normalizeSubscriptionEnvelope(
        parseStoredCanonicalJson(subscription.definition_json, 'subscription definition'),
      );
      const normalizedScope = normalizeCapabilityScope(
        capabilityKey,
        scope,
        { handlerKey: envelope.handlerKey },
      );
      const request = envelope.requestedCapabilities.find((item) => item.capabilityKey === capabilityKey);
      if (!request || canonicalizeJson(request.scope) !== canonicalizeJson(normalizedScope)) {
        throw new RegistryAuthorizationError('Grant must exactly match a valid current request');
      }
      const existing = await trx('event_subscription_grants')
        .where({ subscription_id: subscriptionId, capability_key: capabilityKey })
        .first();
      if (existing && existing.updated_at !== expectedUpdatedAt) throw new RegistryConflictError();
      if (!existing && subscription.updated_at !== expectedUpdatedAt) throw new RegistryConflictError();
      const timestamp = existing ? nextUpdatedAt(existing, now) : nowInteger(now);
      const row = {
        subscription_id: subscriptionId,
        capability_key: capabilityKey,
        state: 'granted',
        scope_json: canonicalizeJson(normalizedScope),
        authorized_by_kind: 'human',
        authorized_at: timestamp,
        created_at: existing ? existing.created_at : timestamp,
        updated_at: timestamp,
      };
      if (existing) {
        await trx('event_subscription_grants')
          .where({ subscription_id: subscriptionId, capability_key: capabilityKey })
          .update(row);
      } else {
        await trx('event_subscription_grants').insert(row);
      }
      return row;
    });
  }

  async function calculateEffectiveState() {
    const [schemaRows, subscriptionRows, grants] = await Promise.all([
      listSchemas(),
      listSubscriptions(),
      knex('event_subscription_grants').select('*'),
    ]);
    const schemas = schemaRows.map((row) => evaluateSchemaRow(row, {
      systemSchemaIntegrity,
      validateSchemaDefinition,
      additionalDiagnostics: schemaDiagnosticsById.get(row.schema_id) || [],
    }));
    const schemaStateByKey = new Map(schemas.map((state) => [schemaReferenceKey({
      schemaKey: state.row.schema_key,
      schemaVersion: state.row.schema_version,
      definitionKind: state.row.definition_kind,
    }), state]));
    const grantsBySubscription = new Map();
    for (const grant of grants) {
      if (!grantsBySubscription.has(grant.subscription_id)) {
        grantsBySubscription.set(grant.subscription_id, []);
      }
      grantsBySubscription.get(grant.subscription_id).push(grant);
    }
    const subscriptions = subscriptionRows.map((row) => evaluateSubscriptionRow(
      row,
      grantsBySubscription.get(row.subscription_id) || [],
      schemaStateByKey,
      { installedHandlers, systemSubscriptionIntegrity },
    ));
    return {
      schemas,
      subscriptions,
      effectiveSubscriptions: subscriptions
        .filter((state) => state.effective)
        .map((state) => ({
          subscriptionId: state.row.subscription_id,
          handlerKey: state.envelope.handlerKey,
          priority: state.envelope.priority,
          filter: state.envelope.filter,
          deliveryPolicy: state.envelope.deliveryPolicy,
          grants: state.effectiveGrants,
        })),
      diagnostics: [
        ...schemas.flatMap((state) => state.diagnostics.map((code) => ({
          kind: 'schema', id: state.row.schema_id, code,
        }))),
        ...subscriptions.flatMap((state) => state.diagnostics.map((code) => ({
          kind: 'subscription', id: state.row.subscription_id, code,
        }))),
      ],
    };
  }

  const publicRepository = Object.freeze({
    calculateEffectiveState,
    changeSubscriptionRequest,
    createPendingSchema: (input) => createSchema(input, false),
    createPendingSubscription: (input) => createSubscription(input, false),
    disableSchema: (id, options = {}) => transitionSchemaStatus(
      id, options.expectedUpdatedAt, 'disabled', ['enabled'],
    ),
    disableSubscription: (id, options = {}) => transitionStatus(
      id, options.expectedUpdatedAt, 'disabled', ['enabled'],
    ),
    getSubscription,
    getSchema,
    listSchemas,
    listSubscriptions,
    narrowCapabilityGrant,
    quarantineSubscription: (id, options = {}) => transitionStatus(
      id, options.expectedUpdatedAt, 'quarantined', ['enabled', 'disabled', 'pending'],
    ),
    quarantineSchema: (id, options = {}) => transitionSchemaStatus(
      id, options.expectedUpdatedAt, 'quarantined', ['enabled', 'disabled', 'pending'],
    ),
    revokeCapability,
    revokeSubscription: (id, options = {}) => transitionStatus(
      id, options.expectedUpdatedAt, 'revoked', ['enabled', 'disabled', 'pending', 'quarantined'],
    ),
    revokeSchema: (id, options = {}) => transitionSchemaStatus(
      id, options.expectedUpdatedAt, 'revoked', ['enabled', 'disabled', 'pending', 'quarantined'],
    ),
  });

  if (authorizationCapability !== HUMAN_AUTHORIZATION_CAPABILITY) return publicRepository;
  return Object.freeze({
    repository: publicRepository,
    authorization: HUMAN_AUTHORIZATION_CAPABILITY,
    authorized: Object.freeze({
      changeSubscriptionRequest: (id, change, options = {}) => changeSubscriptionRequest(
        id,
        change,
        { ...options, authorization: options.authorization },
      ),
      createSystemSchema: (input, authorization) => {
        if (authorization !== HUMAN_AUTHORIZATION_CAPABILITY) throw new RegistryAuthorizationError();
        return createSchema(input, true);
      },
      createSystemSubscription: (input, authorization) => {
        if (authorization !== HUMAN_AUTHORIZATION_CAPABILITY) throw new RegistryAuthorizationError();
        return createSubscription(input, true);
      },
      grantCapability,
      setSchemaStatus: (id, target, options = {}) => {
        const allowed = {
          enabled: ['disabled', 'pending', 'quarantined', 'revoked'],
          pending: ['revoked'],
        }[target];
        if (!allowed) throw new TypeError('Unsupported authorized schema status transition');
        return transitionSchemaStatus(
          id,
          options.expectedUpdatedAt,
          target,
          allowed,
          { authorization: options.authorization, requireHumanAuthorization: true },
        );
      },
      setStatus: (id, target, options = {}) => {
        const allowed = {
          enabled: ['disabled', 'pending', 'quarantined', 'revoked'],
          pending: ['revoked'],
        }[target];
        if (!allowed) throw new TypeError('Unsupported authorized status transition');
        return transitionStatus(
          id,
          options.expectedUpdatedAt,
          target,
          allowed,
          { authorization: options.authorization, requireHumanAuthorization: true },
        );
      },
    }),
  });
}

function createRegistryRepository(knex, options) {
  return createRepository(knex, options, null);
}

module.exports = {
  RegistryAuthorizationError,
  RegistryConflictError,
  createRegistryRepository,
};

if (process.env.NODE_ENV === 'test') {
  // This hook is absent from production exports. It exists solely so focused
  // repository tests can exercise the otherwise unreachable human boundary.
  module.exports.createTestOnlyAuthorizedRegistry = (knex, options) => (
    createRepository(knex, options, HUMAN_AUTHORIZATION_CAPABILITY)
  );
}
