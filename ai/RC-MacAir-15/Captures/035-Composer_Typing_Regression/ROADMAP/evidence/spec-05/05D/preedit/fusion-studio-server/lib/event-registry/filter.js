'use strict';

const { canonicalizeJson } = require('./canonical-json');
const { compareOrdinalStrings } = require('./ordinal');

const TOP_LEVEL_KEYS = new Set(['eventTypes', 'resource']);
const EVENT_TYPE_KEYS = new Set(['eventType', 'schemaVersion']);
const RESOURCE_KEYS = new Set(['operations', 'kinds', 'ingressPanels']);
const OPERATIONS = new Set(['create', 'modify']);
const ACTIVE_EVENT_TYPES = new Set([
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

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label} contains unknown key ${key}`);
  }
}

function normalizeUniqueArray(value, label, normalizeItem) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty array`);
  }
  const normalized = value.map(normalizeItem);
  const canonicalItems = normalized.map((item) => canonicalizeJson(item));
  if (new Set(canonicalItems).size !== canonicalItems.length) {
    throw new TypeError(`${label} contains duplicate values`);
  }
  return normalized
    .map((item, index) => ({ item, key: canonicalItems[index] }))
    .sort((left, right) => compareOrdinalStrings(left.key, right.key))
    .map(({ item }) => item);
}

function normalizeEventTypes(value) {
  return normalizeUniqueArray(value, 'filter.eventTypes', (entry) => {
    assertPlainObject(entry, 'filter.eventTypes entry');
    assertExactKeys(entry, EVENT_TYPE_KEYS, 'filter.eventTypes entry');
    if (!ACTIVE_EVENT_TYPES.has(`${entry.eventType}@${entry.schemaVersion}`)) {
      throw new TypeError('filter.eventTypes contains an unsupported event type');
    }
    return { eventType: entry.eventType, schemaVersion: entry.schemaVersion };
  });
}

function normalizeStringEnumArray(value, label, allowed) {
  return normalizeUniqueArray(value, label, (entry) => {
    if (typeof entry !== 'string' || !allowed.has(entry)) {
      throw new TypeError(`${label} contains an unsupported value`);
    }
    return entry;
  });
}

function normalizeIngressPanels(value) {
  if (!Array.isArray(value) || value.length > 16) {
    throw new TypeError('filter.resource.ingressPanels must contain 1 through 16 panels');
  }
  return normalizeUniqueArray(value, 'filter.resource.ingressPanels', (entry) => {
    if (typeof entry !== 'string' || entry.length === 0 || Buffer.byteLength(entry, 'utf8') > 128) {
      throw new TypeError('filter.resource.ingressPanels contains an invalid panel key');
    }
    // Canonical JSON also rejects unpaired surrogates.
    canonicalizeJson(entry);
    return entry;
  });
}

function normalizeFilter(filter) {
  assertPlainObject(filter, 'filter');
  assertExactKeys(filter, TOP_LEVEL_KEYS, 'filter');
  if (!Object.prototype.hasOwnProperty.call(filter, 'eventTypes')) {
    throw new TypeError('filter.eventTypes is required');
  }

  const normalized = { eventTypes: normalizeEventTypes(filter.eventTypes) };
  if (Object.prototype.hasOwnProperty.call(filter, 'resource')) {
    assertPlainObject(filter.resource, 'filter.resource');
    assertExactKeys(filter.resource, RESOURCE_KEYS, 'filter.resource');
    const resource = {};
    if (Object.prototype.hasOwnProperty.call(filter.resource, 'operations')) {
      resource.operations = normalizeStringEnumArray(
        filter.resource.operations,
        'filter.resource.operations',
        OPERATIONS,
      );
    }
    if (Object.prototype.hasOwnProperty.call(filter.resource, 'kinds')) {
      resource.kinds = normalizeStringEnumArray(
        filter.resource.kinds,
        'filter.resource.kinds',
        new Set(['file']),
      );
    }
    if (Object.prototype.hasOwnProperty.call(filter.resource, 'ingressPanels')) {
      resource.ingressPanels = normalizeIngressPanels(filter.resource.ingressPanels);
    }
    normalized.resource = resource;
  }
  return normalized;
}

function matchesFilter(filter, fact) {
  const normalized = normalizeFilter(filter);
  if (!fact || typeof fact !== 'object') return false;
  if (!normalized.eventTypes.some((entry) => (
    entry.eventType === fact.eventType && entry.schemaVersion === fact.schemaVersion
  ))) return false;

  if (!normalized.resource) return true;
  if (!fact.resource || typeof fact.resource !== 'object') return false;
  if (
    normalized.resource.operations
    && (!fact.mutation || !normalized.resource.operations.includes(fact.mutation.kind))
  ) return false;
  if (normalized.resource.kinds && !normalized.resource.kinds.includes(fact.resource.kind)) {
    return false;
  }
  if (
    normalized.resource.ingressPanels
    && (!fact.resource.access
      || !normalized.resource.ingressPanels.includes(fact.resource.access.panel))
  ) return false;
  return true;
}

function arrayIsSubset(candidate, current) {
  return candidate.every((value) => current.includes(value));
}

function filterIsNarrowerOrEqual(candidateFilter, currentFilter) {
  const candidate = normalizeFilter(candidateFilter);
  const current = normalizeFilter(currentFilter);
  if (!arrayIsSubset(
    candidate.eventTypes.map(canonicalizeJson),
    current.eventTypes.map(canonicalizeJson),
  )) return false;

  const predicates = ['operations', 'kinds', 'ingressPanels'];
  for (const predicate of predicates) {
    const previous = current.resource && current.resource[predicate];
    const next = candidate.resource && candidate.resource[predicate];
    if (previous && !next) return false;
    if (previous && next && !arrayIsSubset(next, previous)) return false;
  }
  return true;
}

module.exports = {
  filterIsNarrowerOrEqual,
  matchesFilter,
  normalizeFilter,
};
