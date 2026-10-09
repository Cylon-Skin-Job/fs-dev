'use strict';

const { canonicalizeJson } = require('../event-registry/canonical-json');
const { normalizeCapabilityScope } = require('../event-registry/capability-catalog');
const { deepFreeze } = require('./deep-freeze');

const PROVIDER_KEYS = new Set([
  'appendResourceFact',
  'appendAgentFact',
  'scheduleAgentObservation',
  'publishResourceChanged',
  'publishResourceRefreshRequired',
  'writeDiagnostic',
]);
const RESOURCE_CHANGED_KEYS = new Set([
  'type', 'version', 'eventId', 'operationId', 'workspaceId', 'resourceId',
  'resourceKind', 'operation', 'panel', 'path', 'occurredAt',
]);
const REFRESH_REQUIRED_KEYS = new Set([
  'type', 'version', 'workspaceId', 'panel', 'path', 'operationId', 'reason',
]);
const PROVIDER_BY_CAPABILITY = Object.freeze({
  'ledger.append_resource_fact': 'appendResourceFact',
  'ledger.append_agent_fact': 'appendAgentFact',
  'agent.schedule_observation': 'scheduleAgentObservation',
  'renderer.publish_resource_changed': 'publishResourceChanged',
  'renderer.publish_resource_refresh_required': 'publishResourceRefreshRequired',
  'diagnostic.write_fixed': 'writeDiagnostic',
});

function assertProviders(providers) {
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
    throw new TypeError('capability providers must be an object');
  }
  for (const [key, value] of Object.entries(providers)) {
    if (!PROVIDER_KEYS.has(key)) throw new TypeError(`Unknown capability provider ${key}`);
    if (typeof value !== 'function') throw new TypeError(`Capability provider ${key} must be a function`);
  }
}

function sameFact(candidate, fact) {
  return candidate === fact || canonicalizeJson(candidate) === canonicalizeJson(fact);
}

function snapshotExactMessage(message, allowedKeys, label) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new TypeError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(message);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const keys = Object.keys(message);
  if (keys.length !== allowedKeys.size || keys.some((key) => !allowedKeys.has(key))) {
    throw new TypeError(`${label} contains missing or unknown fields`);
  }
  return deepFreeze(JSON.parse(canonicalizeJson(message)));
}

function createScopedCapabilityFactory(providers) {
  assertProviders(providers);
  const provider = Object.freeze({ ...providers });

  function assertAvailable({ handlerKey, grants }) {
    if (!Array.isArray(grants)) throw new TypeError('effective grants must be an array');
    for (const grant of grants) {
      if (!grant || typeof grant !== 'object') throw new TypeError('effective grant is malformed');
      normalizeCapabilityScope(grant.capabilityKey, grant.scope, { handlerKey });
      const providerKey = PROVIDER_BY_CAPABILITY[grant.capabilityKey];
      if (providerKey && typeof provider[providerKey] !== 'function') {
        throw new TypeError(`${providerKey} provider is unavailable`);
      }
    }
    return true;
  }

  function createScopedContext({ handlerKey, grants, fact }) {
    assertAvailable({ handlerKey, grants });
    if (!fact || typeof fact !== 'object') throw new TypeError('admitted fact is required');
    const context = {};
    for (const grant of grants) {
      const scope = normalizeCapabilityScope(grant.capabilityKey, grant.scope, { handlerKey });
      switch (grant.capabilityKey) {
        case 'fact.consume':
          break;
        case 'ledger.append_resource_fact':
          context.appendResourceFact = (candidate) => {
            if (!sameFact(candidate, fact)) throw new Error('appendResourceFact is scoped to the admitted fact');
            return provider.appendResourceFact(fact);
          };
          break;
        case 'ledger.append_agent_fact':
          context.appendAgentFact = (candidate) => {
            if (!sameFact(candidate, fact)) throw new Error('appendAgentFact is scoped to the admitted fact');
            return provider.appendAgentFact(fact);
          };
          break;
        case 'agent.schedule_observation':
          context.scheduleAgentObservation = (candidate) => {
            if (!sameFact(candidate, fact)) {
              throw new Error('scheduleAgentObservation is scoped to the admitted fact');
            }
            return provider.scheduleAgentObservation(fact);
          };
          break;
        case 'renderer.publish_resource_changed':
          context.publishResourceChanged = (message) => {
            const projection = snapshotExactMessage(
              message,
              RESOURCE_CHANGED_KEYS,
              'resource changed projection',
            );
            if (
              projection.type !== scope.messageType
              || projection.version !== scope.messageVersion
              || projection.panel !== scope.panel
              || projection.workspaceId !== fact.workspaceId
              || projection.eventId !== fact.eventId
              || projection.operationId !== fact.operationId
              || projection.resourceId !== fact.resource.resourceId
              || projection.resourceKind !== fact.resource.kind
              || projection.operation !== fact.mutation.kind
              || projection.path !== fact.resource.path
              || projection.occurredAt !== fact.occurredAt
            ) throw new Error('publishResourceChanged message exceeds its event scope');
            return provider.publishResourceChanged(projection);
          };
          break;
        case 'renderer.publish_resource_refresh_required':
          context.publishResourceRefreshRequired = (message) => {
            const projection = snapshotExactMessage(
              message,
              REFRESH_REQUIRED_KEYS,
              'resource refresh-required projection',
            );
            if (
              projection.type !== scope.messageType
              || projection.version !== scope.messageVersion
              || projection.panel !== scope.panel
              || projection.workspaceId !== fact.workspaceId
              || projection.operationId !== fact.operationId
              || projection.path !== fact.resource.path
              || !scope.reasons.includes(projection.reason)
            ) throw new Error('publishResourceRefreshRequired message exceeds its event scope');
            return provider.publishResourceRefreshRequired(projection);
          };
          break;
        case 'diagnostic.write_fixed':
          context.writeDiagnostic = (code) => {
            if (!scope.codes.includes(code)) throw new Error('diagnostic code exceeds its grant');
            return provider.writeDiagnostic(code);
          };
          break;
        default:
          throw new TypeError(`Unknown effective capability ${grant.capabilityKey}`);
      }
    }
    return deepFreeze(context);
  }

  // Compiler-only preflight: reveals only whether the closed grant set is
  // usable. Provider functions and the provider object remain lexical.
  Object.defineProperty(createScopedContext, 'assertAvailable', {
    value: Object.freeze(assertAvailable),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(createScopedContext);
}

module.exports = { createScopedCapabilityFactory };
