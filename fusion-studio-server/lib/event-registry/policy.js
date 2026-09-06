'use strict';

const {
  canonicalizeJson,
  canonicalizeJsonText,
  sha256CanonicalJson,
} = require('./canonical-json');
const {
  intersectCapabilityScopes,
  normalizeCapabilityScope,
  normalizeRequestedCapabilities,
} = require('./capability-catalog');
const { normalizeFilter } = require('./filter');
const { compareOrdinalStrings } = require('./ordinal');

const ENVELOPE_KEYS = new Set([
  'deliveryPolicy',
  'handlerKey',
  'locked',
  'owner',
  'priority',
  'requestedCapabilities',
  'schemaReferences',
  'filter',
]);
const OWNER_KEYS = new Set(['id', 'kind']);
const SCHEMA_REFERENCE_KEYS = new Set(['definitionKind', 'schemaKey', 'schemaVersion']);
const DEFINITION_KINDS = new Set(['event', 'projection', 'command', 'query']);
const REQUIRED_ACK_HANDLERS = new Set([
  'system.provenance-ledger',
  'system.agent-provenance-ledger',
  'system.agent-resource-observer',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function assertExactKeys(value, allowed, label) {
  const keys = Object.keys(value);
  if (keys.length !== allowed.size || keys.some((key) => !allowed.has(key))) {
    throw new TypeError(`${label} contains missing or unknown keys`);
  }
}

function assertBoundedString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > 128) {
    throw new TypeError(`${label} must be a non-empty string of at most 128 UTF-8 bytes`);
  }
  canonicalizeJson(value);
  return value;
}

function normalizeSchemaReferences(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('schemaReferences must be a non-empty array');
  }
  const normalized = value.map((reference) => {
    assertPlainObject(reference, 'schema reference');
    assertExactKeys(reference, SCHEMA_REFERENCE_KEYS, 'schema reference');
    const schemaKey = assertBoundedString(reference.schemaKey, 'schemaKey');
    if (!Number.isInteger(reference.schemaVersion) || reference.schemaVersion < 1) {
      throw new TypeError('schemaVersion must be a positive integer');
    }
    if (!DEFINITION_KINDS.has(reference.definitionKind)) {
      throw new TypeError('definitionKind is unsupported');
    }
    return {
      schemaKey,
      schemaVersion: reference.schemaVersion,
      definitionKind: reference.definitionKind,
    };
  });
  const keys = normalized.map(schemaReferenceKey);
  if (new Set(keys).size !== keys.length) throw new TypeError('schemaReferences contains duplicates');
  return normalized.sort((left, right) => compareOrdinalStrings(
    schemaReferenceKey(left),
    schemaReferenceKey(right),
  ));
}

function schemaReferenceKey(reference) {
  return `${reference.definitionKind}\u0000${reference.schemaKey}\u0000${reference.schemaVersion}`;
}

function normalizeSubscriptionEnvelope(envelope) {
  assertPlainObject(envelope, 'subscription definition');
  assertExactKeys(envelope, ENVELOPE_KEYS, 'subscription definition');
  assertPlainObject(envelope.owner, 'subscription owner');
  assertExactKeys(envelope.owner, OWNER_KEYS, 'subscription owner');
  if (!['system', 'extension'].includes(envelope.owner.kind)) {
    throw new TypeError('subscription owner kind is unsupported');
  }
  const owner = {
    kind: envelope.owner.kind,
    id: assertBoundedString(envelope.owner.id, 'subscription owner id'),
  };
  if (typeof envelope.locked !== 'boolean' || (envelope.locked && owner.kind !== 'system')) {
    throw new TypeError('subscription lock is invalid for its owner');
  }
  const handlerKey = assertBoundedString(envelope.handlerKey, 'handlerKey');
  if (!Number.isInteger(envelope.priority) || envelope.priority < -1000 || envelope.priority > 1000) {
    throw new TypeError('priority must be an integer from -1000 through 1000');
  }
  if (!['best_effort', 'required_ack'].includes(envelope.deliveryPolicy)) {
    throw new TypeError('deliveryPolicy is unsupported');
  }
  if (envelope.deliveryPolicy === 'required_ack' && (!envelope.locked || owner.kind !== 'system')) {
    throw new TypeError('required_ack is restricted to locked system subscriptions');
  }
  if (envelope.deliveryPolicy === 'required_ack' && !REQUIRED_ACK_HANDLERS.has(handlerKey)) {
    throw new TypeError('required_ack is restricted to locked durable system handlers');
  }

  return {
    handlerKey,
    priority: envelope.priority,
    filter: normalizeFilter(envelope.filter),
    requestedCapabilities: normalizeRequestedCapabilities(
      envelope.requestedCapabilities,
      { handlerKey },
    ),
    deliveryPolicy: envelope.deliveryPolicy,
    owner,
    locked: envelope.locked,
    schemaReferences: normalizeSchemaReferences(envelope.schemaReferences),
  };
}

function createSubscriptionEnvelope(input, { forcedExtension = false } = {}) {
  assertPlainObject(input, 'subscription input');
  return normalizeSubscriptionEnvelope({
    handlerKey: input.handlerKey,
    priority: input.priority === undefined ? 0 : input.priority,
    filter: input.filter,
    requestedCapabilities: input.requestedCapabilities || [],
    deliveryPolicy: forcedExtension ? 'best_effort' : (input.deliveryPolicy || 'best_effort'),
    owner: forcedExtension
      ? { kind: 'extension', id: input.ownerId }
      : input.owner,
    locked: forcedExtension ? false : Boolean(input.locked),
    schemaReferences: input.schemaReferences,
  });
}

function parseStoredCanonicalJson(text, label) {
  if (typeof text !== 'string') throw new TypeError(`${label} must be stored as TEXT`);
  const canonical = canonicalizeJsonText(text);
  if (canonical !== text) throw new TypeError(`${label} is not canonical JSON`);
  return JSON.parse(canonical);
}

function integrityCatalogHas(integrityCatalog, id) {
  if (!integrityCatalog) return false;
  if (integrityCatalog instanceof Map) return integrityCatalog.has(id);
  return Object.prototype.hasOwnProperty.call(integrityCatalog, id);
}

function integrityCatalogValue(integrityCatalog, id) {
  if (integrityCatalog instanceof Map) return integrityCatalog.get(id);
  return integrityCatalog[id];
}

function lockedSubscriptionIntegrityMatches(integrityCatalog, row, envelope) {
  if (!integrityCatalogHas(integrityCatalog, row.subscription_id)) return false;
  const expected = integrityCatalogValue(integrityCatalog, row.subscription_id);
  if (!expected || typeof expected !== 'object' || !expected.envelope) return false;
  try {
    const baseline = normalizeSubscriptionEnvelope(expected.envelope);
    if (sha256CanonicalJson(baseline) !== expected.checksum) return false;
    return row.definition_sha256 === expected.checksum
      && canonicalizeJson(envelope) === canonicalizeJson(baseline)
      && row.owner_kind === 'system'
      && row.owner_id === baseline.owner.id
      && row.locked === 1
      && baseline.locked === true;
  } catch (_error) {
    return false;
  }
}

function lockedSchemaIntegrityMatches(integrityCatalog, row) {
  if (!integrityCatalogHas(integrityCatalog, row.schema_id)) return false;
  const expected = integrityCatalogValue(integrityCatalog, row.schema_id);
  // A schema checksum covers only definition_json, so a complete descriptor is
  // mandatory to bind every immutable convenience-column identity projection.
  return Boolean(expected && typeof expected === 'object')
    && expected.checksum === row.definition_sha256
    && expected.schemaKey === row.schema_key
    && expected.schemaVersion === row.schema_version
    && expected.definitionKind === row.definition_kind
    && expected.ownerId === row.owner_id
    && row.owner_kind === 'system'
    && row.locked === 1;
}

function evaluateSchemaRow(row, {
  systemSchemaIntegrity,
  validateSchemaDefinition,
  additionalDiagnostics = [],
} = {}) {
  const diagnostics = [];
  let definition;
  try {
    definition = parseStoredCanonicalJson(row.definition_json, 'schema definition');
    assertPlainObject(definition, 'schema definition');
    if (sha256CanonicalJson(definition) !== row.definition_sha256) {
      diagnostics.push('schema_checksum_mismatch');
    }
    if (validateSchemaDefinition) validateSchemaDefinition(definition);
  } catch (_error) {
    diagnostics.push('schema_definition_invalid');
  }
  const schemaClaimsLockedSystem = row.owner_kind === 'system' && row.locked === 1;
  if (
    (schemaClaimsLockedSystem || integrityCatalogHas(systemSchemaIntegrity, row.schema_id))
    && !lockedSchemaIntegrityMatches(systemSchemaIntegrity, row)
  ) diagnostics.push('schema_locked_integrity_mismatch');
  if (!['event', 'projection', 'command', 'query'].includes(row.definition_kind)) {
    diagnostics.push('schema_projection_invalid');
  }
  if (!['system', 'extension'].includes(row.owner_kind) || ![0, 1].includes(row.locked)) {
    diagnostics.push('schema_projection_invalid');
  }
  if (row.locked === 1 && row.owner_kind !== 'system') diagnostics.push('schema_projection_invalid');
  if (row.status !== 'enabled') diagnostics.push(`schema_status_${row.status}`);
  diagnostics.push(...additionalDiagnostics);
  return {
    row,
    definition,
    effective: diagnostics.length === 0,
    diagnostics: [...new Set(diagnostics)],
  };
}

function compareSubscriptionProjections(row, envelope) {
  return row.handler_key === envelope.handlerKey
    && row.priority === envelope.priority
    && row.filter_json === canonicalizeJson(envelope.filter)
    && row.requested_capabilities_json === canonicalizeJson(envelope.requestedCapabilities)
    && row.delivery_policy === envelope.deliveryPolicy
    && row.owner_kind === envelope.owner.kind
    && row.owner_id === envelope.owner.id
    && row.locked === Number(envelope.locked);
}

function evaluateSubscriptionRow(row, grants, schemaStateByKey, {
  installedHandlers = new Set(),
  systemSubscriptionIntegrity,
} = {}) {
  const fatalDiagnostics = [];
  const grantDiagnostics = [];
  let envelope;
  try {
    envelope = normalizeSubscriptionEnvelope(
      parseStoredCanonicalJson(row.definition_json, 'subscription definition'),
    );
    if (sha256CanonicalJson(envelope) !== row.definition_sha256) {
      fatalDiagnostics.push('subscription_checksum_mismatch');
    }
    if (!compareSubscriptionProjections(row, envelope)) {
      fatalDiagnostics.push('subscription_projection_mismatch');
    }
  } catch (_error) {
    fatalDiagnostics.push('subscription_definition_invalid');
  }

  if (row.status !== 'enabled') fatalDiagnostics.push(`subscription_status_${row.status}`);
  if (envelope && !installedHandlers.has(envelope.handlerKey)) {
    fatalDiagnostics.push('handler_not_installed');
  }
  const subscriptionClaimsLockedSystem = row.owner_kind === 'system' && row.locked === 1;
  if (
    (subscriptionClaimsLockedSystem
      || integrityCatalogHas(systemSubscriptionIntegrity, row.subscription_id))
    && !lockedSubscriptionIntegrityMatches(systemSubscriptionIntegrity, row, envelope)
  ) fatalDiagnostics.push('subscription_locked_integrity_mismatch');

  const effectiveGrants = [];
  if (envelope) {
    for (const reference of envelope.schemaReferences) {
      const state = schemaStateByKey.get(schemaReferenceKey(reference));
      if (!state || !state.effective) fatalDiagnostics.push('referenced_schema_inactive');
    }
    const requestsByKey = new Map(
      envelope.requestedCapabilities.map((request) => [request.capabilityKey, request]),
    );
    const grantsByKey = new Map(grants.map((grant) => [grant.capability_key, grant]));
    for (const grant of grants) {
      try {
        normalizeCapabilityScope(
          grant.capability_key,
          parseStoredCanonicalJson(grant.scope_json, 'grant scope'),
          { handlerKey: envelope.handlerKey },
        );
      } catch (_error) {
        grantDiagnostics.push(`grant_scope_invalid:${grant.capability_key}`);
      }
      if (grant.state === 'granted' && !requestsByKey.has(grant.capability_key)) {
        grantDiagnostics.push(`grant_not_requested:${grant.capability_key}`);
      }
    }
    for (const request of envelope.requestedCapabilities) {
      const grant = grantsByKey.get(request.capabilityKey);
      if (!grant || grant.state !== 'granted') {
        const diagnostic = `capability_not_granted:${request.capabilityKey}`;
        if (request.capabilityKey === 'fact.consume') fatalDiagnostics.push(diagnostic);
        else grantDiagnostics.push(diagnostic);
        continue;
      }
      try {
        const scope = normalizeCapabilityScope(
          grant.capability_key,
          parseStoredCanonicalJson(grant.scope_json, 'grant scope'),
          { handlerKey: envelope.handlerKey },
        );
        const effectiveScope = intersectCapabilityScopes(
          request.capabilityKey,
          scope,
          request.scope,
          { handlerKey: envelope.handlerKey },
        );
        if (!effectiveScope) {
          const diagnostic = `grant_scope_mismatch:${request.capabilityKey}`;
          if (request.capabilityKey === 'fact.consume') fatalDiagnostics.push(diagnostic);
          else grantDiagnostics.push(diagnostic);
          continue;
        }
        effectiveGrants.push({ capabilityKey: request.capabilityKey, scope: effectiveScope });
      } catch (_error) {
        const diagnostic = `grant_scope_invalid:${request.capabilityKey}`;
        if (request.capabilityKey === 'fact.consume') fatalDiagnostics.push(diagnostic);
        else grantDiagnostics.push(diagnostic);
      }
    }
    if (!effectiveGrants.some((grant) => grant.capabilityKey === 'fact.consume')) {
      fatalDiagnostics.push('fact_consume_not_effective');
    }
  }

  return {
    row,
    envelope,
    effective: fatalDiagnostics.length === 0,
    effectiveGrants: fatalDiagnostics.length === 0 ? effectiveGrants : [],
    diagnostics: [...new Set([...fatalDiagnostics, ...grantDiagnostics])],
  };
}

module.exports = {
  createSubscriptionEnvelope,
  evaluateSchemaRow,
  evaluateSubscriptionRow,
  normalizeSchemaReferences,
  normalizeSubscriptionEnvelope,
  parseStoredCanonicalJson,
  schemaReferenceKey,
};
