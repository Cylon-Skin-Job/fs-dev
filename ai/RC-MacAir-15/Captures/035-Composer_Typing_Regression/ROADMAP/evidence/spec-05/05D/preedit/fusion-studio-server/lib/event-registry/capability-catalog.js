'use strict';

const { canonicalizeJson } = require('./canonical-json');
const { compareOrdinalStrings } = require('./ordinal');

const CAPABILITY_KEYS = new Set([
  'fact.consume',
  'ledger.append_resource_fact',
  'ledger.append_agent_fact',
  'agent.schedule_observation',
  'renderer.publish_resource_changed',
  'renderer.publish_resource_refresh_required',
  'diagnostic.write_fixed',
]);

const DIAGNOSTIC_CODES_BY_HANDLER = Object.freeze({
  'system.provenance-ledger': Object.freeze([
    'ledger_duplicate_conflict',
    'ledger_write_failed',
  ]),
  'system.resource-render-projection': Object.freeze([
    'render_projection_duplicate_conflict',
    'render_projection_failed',
  ]),
  'system.agent-provenance-ledger': Object.freeze([
    'agent_ledger_conflict',
    'agent_ledger_source_missing',
    'agent_ledger_write_failed',
  ]),
  'system.agent-resource-observer': Object.freeze([
    'agent_observation_schedule_failed',
  ]),
});

const EVENT_TYPES_BY_HANDLER = Object.freeze({
  'system.provenance-ledger': Object.freeze(['resource.mutated@1']),
  'system.resource-render-projection': Object.freeze(['resource.mutated@1']),
  'system.agent-provenance-ledger': Object.freeze([
    'agent.tool_completed@1',
    'resource.state_observed@1',
  ]),
  'system.agent-resource-observer': Object.freeze(['agent.tool_completed@1']),
});
const ALL_CONSUMABLE_EVENT_TYPES = Object.freeze([
  'resource.mutated@1',
  'agent.tool_completed@1',
  'resource.state_observed@1',
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

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} must contain exactly ${expected.join(', ')}`);
  }
}

function assertLiteral(value, expected, label) {
  if (value !== expected) throw new TypeError(`${label} must be ${JSON.stringify(expected)}`);
}

function normalizeDiagnosticScope(scope, handlerKey) {
  assertExactKeys(scope, ['codes'], 'diagnostic.write_fixed scope');
  if (!Array.isArray(scope.codes) || scope.codes.length === 0) {
    throw new TypeError('diagnostic.write_fixed codes must be a non-empty array');
  }
  const allowed = DIAGNOSTIC_CODES_BY_HANDLER[handlerKey];
  if (!allowed) {
    throw new TypeError('diagnostic.write_fixed is not owned by this handler');
  }
  if (scope.codes.some((code) => typeof code !== 'string' || !allowed.includes(code))) {
    throw new TypeError('diagnostic.write_fixed contains a code not owned by this handler');
  }
  if (new Set(scope.codes).size !== scope.codes.length) {
    throw new TypeError('diagnostic.write_fixed contains duplicate codes');
  }
  return { codes: [...scope.codes].sort() };
}

function normalizeCapabilityScope(capabilityKey, scope, { handlerKey } = {}) {
  if (!CAPABILITY_KEYS.has(capabilityKey)) {
    throw new TypeError(`Unknown capability ${capabilityKey}`);
  }
  assertPlainObject(scope, `${capabilityKey} scope`);

  switch (capabilityKey) {
    case 'fact.consume': {
      assertExactKeys(scope, ['eventTypes'], 'fact.consume scope');
      const allowed = EVENT_TYPES_BY_HANDLER[handlerKey] || ALL_CONSUMABLE_EVENT_TYPES;
      if (!Array.isArray(scope.eventTypes) || scope.eventTypes.length === 0) {
        throw new TypeError('fact.consume is not owned by this handler');
      }
      const seen = new Set();
      const eventTypes = scope.eventTypes.map((eventType) => {
        assertPlainObject(eventType, 'fact.consume event type');
        assertExactKeys(eventType, ['eventType', 'schemaVersion'], 'fact.consume event type');
        const key = `${eventType.eventType}@${eventType.schemaVersion}`;
        if (!allowed.includes(key) || seen.has(key)) {
          throw new TypeError('fact.consume contains an unsupported or duplicate event type');
        }
        seen.add(key);
        return { eventType: eventType.eventType, schemaVersion: eventType.schemaVersion };
      });
      return { eventTypes: eventTypes.sort((left, right) => compareOrdinalStrings(
        `${left.eventType}@${left.schemaVersion}`,
        `${right.eventType}@${right.schemaVersion}`,
      )) };
    }
    case 'ledger.append_resource_fact':
      if (handlerKey !== 'system.provenance-ledger') {
        throw new TypeError('ledger.append_resource_fact is not owned by this handler');
      }
      assertExactKeys(scope, ['workspaceScope'], 'ledger.append_resource_fact scope');
      assertLiteral(scope.workspaceScope, 'event', 'ledger.append_resource_fact workspaceScope');
      return { workspaceScope: 'event' };
    case 'ledger.append_agent_fact':
      if (handlerKey !== 'system.agent-provenance-ledger') {
        throw new TypeError('ledger.append_agent_fact is not owned by this handler');
      }
      assertExactKeys(scope, ['workspaceScope'], 'ledger.append_agent_fact scope');
      assertLiteral(scope.workspaceScope, 'event', 'ledger.append_agent_fact workspaceScope');
      return { workspaceScope: 'event' };
    case 'agent.schedule_observation':
      if (handlerKey !== 'system.agent-resource-observer') {
        throw new TypeError('agent.schedule_observation is not owned by this handler');
      }
      assertExactKeys(scope, ['workspaceScope'], 'agent.schedule_observation scope');
      assertLiteral(scope.workspaceScope, 'event', 'agent.schedule_observation workspaceScope');
      return { workspaceScope: 'event' };
    case 'renderer.publish_resource_changed':
      if (handlerKey !== 'system.resource-render-projection') {
        throw new TypeError('renderer.publish_resource_changed is not owned by this handler');
      }
      assertExactKeys(
        scope,
        ['workspaceScope', 'messageType', 'messageVersion', 'panel'],
        'renderer.publish_resource_changed scope',
      );
      assertLiteral(scope.workspaceScope, 'event', 'renderer.publish_resource_changed workspaceScope');
      assertLiteral(scope.messageType, 'resource:changed', 'renderer.publish_resource_changed messageType');
      assertLiteral(scope.messageVersion, 1, 'renderer.publish_resource_changed messageVersion');
      assertLiteral(scope.panel, 'file-viewer', 'renderer.publish_resource_changed panel');
      return {
        workspaceScope: 'event',
        messageType: 'resource:changed',
        messageVersion: 1,
        panel: 'file-viewer',
      };
    case 'renderer.publish_resource_refresh_required':
      if (handlerKey !== 'system.resource-render-projection') {
        throw new TypeError('renderer.publish_resource_refresh_required is not owned by this handler');
      }
      assertExactKeys(
        scope,
        ['workspaceScope', 'messageType', 'messageVersion', 'panel', 'reasons'],
        'renderer.publish_resource_refresh_required scope',
      );
      assertLiteral(scope.workspaceScope, 'event', 'renderer.publish_resource_refresh_required workspaceScope');
      assertLiteral(scope.messageType, 'resource:refresh_required', 'renderer.publish_resource_refresh_required messageType');
      assertLiteral(scope.messageVersion, 1, 'renderer.publish_resource_refresh_required messageVersion');
      assertLiteral(scope.panel, 'file-viewer', 'renderer.publish_resource_refresh_required panel');
      if (
        !Array.isArray(scope.reasons)
        || scope.reasons.length !== 1
        || scope.reasons[0] !== 'projection_failed'
      ) throw new TypeError('renderer refresh reasons must be exactly projection_failed');
      return {
        workspaceScope: 'event',
        messageType: 'resource:refresh_required',
        messageVersion: 1,
        panel: 'file-viewer',
        reasons: ['projection_failed'],
      };
    case 'diagnostic.write_fixed':
      return normalizeDiagnosticScope(scope, handlerKey);
    default:
      throw new TypeError(`Unknown capability ${capabilityKey}`);
  }
}

function normalizeRequestedCapabilities(value, { handlerKey } = {}) {
  if (!Array.isArray(value)) throw new TypeError('requestedCapabilities must be an array');
  const seen = new Set();
  const normalized = value.map((request) => {
    assertPlainObject(request, 'requested capability');
    assertExactKeys(request, ['capabilityKey', 'scope'], 'requested capability');
    if (typeof request.capabilityKey !== 'string' || seen.has(request.capabilityKey)) {
      throw new TypeError('requestedCapabilities contains an invalid or duplicate capability key');
    }
    seen.add(request.capabilityKey);
    return {
      capabilityKey: request.capabilityKey,
      scope: normalizeCapabilityScope(request.capabilityKey, request.scope, { handlerKey }),
    };
  });
  return normalized.sort((left, right) => compareOrdinalStrings(
    left.capabilityKey,
    right.capabilityKey,
  ));
}

function requestSetIsNarrowerOrEqual(candidateValue, currentValue, { handlerKey } = {}) {
  const candidate = normalizeRequestedCapabilities(candidateValue, { handlerKey });
  const current = normalizeRequestedCapabilities(currentValue, { handlerKey });
  const currentByKey = new Map(current.map((request) => [request.capabilityKey, request]));
  for (const request of candidate) {
    const previous = currentByKey.get(request.capabilityKey);
    if (!previous) return false;
    if (request.capabilityKey === 'diagnostic.write_fixed') {
      if (!request.scope.codes.every((code) => previous.scope.codes.includes(code))) return false;
    } else if (request.capabilityKey === 'fact.consume') {
      const previousKeys = previous.scope.eventTypes.map((item) => `${item.eventType}@${item.schemaVersion}`);
      if (!request.scope.eventTypes.every((item) => previousKeys.includes(`${item.eventType}@${item.schemaVersion}`))) return false;
    } else if (canonicalizeJson(request.scope) !== canonicalizeJson(previous.scope)) {
      return false;
    }
  }
  return true;
}

function capabilityScopeAuthorizes(capabilityKey, grantScope, requestedScope, { handlerKey } = {}) {
  const grant = normalizeCapabilityScope(capabilityKey, grantScope, { handlerKey });
  const requested = normalizeCapabilityScope(capabilityKey, requestedScope, { handlerKey });
  if (capabilityKey === 'diagnostic.write_fixed') {
    return requested.codes.every((code) => grant.codes.includes(code));
  }
  if (capabilityKey === 'fact.consume') {
    const granted = grant.eventTypes.map((item) => `${item.eventType}@${item.schemaVersion}`);
    return requested.eventTypes.every((item) => granted.includes(`${item.eventType}@${item.schemaVersion}`));
  }
  return canonicalizeJson(grant) === canonicalizeJson(requested);
}

function intersectCapabilityScopes(capabilityKey, grantScope, requestedScope, { handlerKey } = {}) {
  const grant = normalizeCapabilityScope(capabilityKey, grantScope, { handlerKey });
  const requested = normalizeCapabilityScope(capabilityKey, requestedScope, { handlerKey });
  if (capabilityKey === 'diagnostic.write_fixed') {
    const codes = requested.codes.filter((code) => grant.codes.includes(code));
    return codes.length > 0 ? { codes } : null;
  }
  if (capabilityKey === 'fact.consume') {
    const granted = new Set(grant.eventTypes.map((item) => `${item.eventType}@${item.schemaVersion}`));
    const eventTypes = requested.eventTypes.filter((item) => granted.has(`${item.eventType}@${item.schemaVersion}`));
    return eventTypes.length > 0 ? { eventTypes } : null;
  }
  return canonicalizeJson(grant) === canonicalizeJson(requested) ? requested : null;
}

module.exports = {
  CAPABILITY_KEYS,
  DIAGNOSTIC_CODES_BY_HANDLER,
  capabilityScopeAuthorizes,
  intersectCapabilityScopes,
  normalizeCapabilityScope,
  normalizeRequestedCapabilities,
  requestSetIsNarrowerOrEqual,
};
