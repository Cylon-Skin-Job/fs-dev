'use strict';

const { canonicalizeJson } = require('../event-registry/canonical-json');
const {
  assertNonemptyBoundedString,
  assertTimestamp,
  assertUuid,
  normalizeCanonicalPath,
} = require('../file-mutations/provenance-values');
const { deepFreeze } = require('../subscriptions/deep-freeze');
const {
  currentWorkspacePair,
  pendingWorkspacePair,
  sendWorkspaceBoundReply,
} = require('./workspace-session');

const OPEN = 1;
const CHANGED_KEYS = new Set([
  'type', 'version', 'eventId', 'operationId', 'workspaceId', 'resourceId',
  'resourceKind', 'operation', 'panel', 'path', 'occurredAt',
]);
const REFRESH_KEYS = new Set([
  'type', 'version', 'workspaceId', 'panel', 'path', 'operationId', 'reason',
]);
const OBSERVED_V2_BASE_KEYS = new Set([
  'type', 'version', 'projectionId', 'sourceActivityId', 'sourceEdgeId',
  'workspaceId', 'resourceKind', 'changeKind', 'relation', 'panel', 'path',
  'occurredAt', 'snapshotId', 'state', 'resourceId', 'checkpointEventId',
  'checkpointObservationId',
]);
const CONTROLLER_REASONS = new Set([
  'fact_publish_failed', 'projection_unavailable', 'mutation_outcome_unknown',
]);
const SUBSCRIBER_REASONS = new Set(['projection_failed']);
const AGENT_OBSERVER_REASONS = new Set([
  'fact_publish_failed', 'projection_failed', 'projection_unavailable',
]);

function snapshotExact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.size || actual.some((key) => !keys.has(key))) {
    throw new TypeError(`${label} contains missing or unknown fields`);
  }
  return deepFreeze(JSON.parse(canonicalizeJson(value)));
}

function validateChangedBase(value) {
  const message = snapshotExact(value, CHANGED_KEYS, 'resource changed projection');
  if (message.type !== 'resource:changed' || message.version !== 1) {
    throw new TypeError('resource changed projection type is invalid');
  }
  assertUuid(message.eventId, 'eventId');
  assertUuid(message.operationId, 'operationId');
  assertNonemptyBoundedString(message.workspaceId, 128, 'workspaceId');
  assertUuid(message.resourceId, 'resourceId');
  if (message.resourceKind !== 'file' || !['create', 'modify'].includes(message.operation)) {
    throw new TypeError('resource changed projection resource is invalid');
  }
  if (message.panel !== 'file-viewer') throw new TypeError('projection panel is invalid');
  normalizeCanonicalPath(message.path, 'path');
  assertTimestamp(message.occurredAt, 'occurredAt');
  return message;
}

function validateRefreshBase(value, allowedReasons) {
  const message = snapshotExact(value, REFRESH_KEYS, 'resource refresh-required projection');
  if (message.type !== 'resource:refresh_required' || message.version !== 1) {
    throw new TypeError('resource refresh-required projection type is invalid');
  }
  assertNonemptyBoundedString(message.workspaceId, 128, 'workspaceId');
  if (message.panel !== 'file-viewer') throw new TypeError('projection panel is invalid');
  normalizeCanonicalPath(message.path, 'path');
  assertUuid(message.operationId, 'operationId');
  if (!allowedReasons.has(message.reason)) {
    throw new TypeError('resource refresh-required reason exceeds publisher scope');
  }
  return message;
}

function validateObservedV2(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('resource observed projection must be an object');
  }
  const keys = new Set(Object.keys(value));
  const required = [
    'type', 'version', 'projectionId', 'sourceActivityId', 'sourceEdgeId',
    'workspaceId', 'resourceKind', 'changeKind', 'relation', 'panel', 'path',
    'occurredAt', 'snapshotId', 'state',
  ];
  if (required.some((key) => !keys.has(key)) || [...keys].some((key) => !OBSERVED_V2_BASE_KEYS.has(key))) {
    throw new TypeError('resource observed projection contains missing or unknown fields');
  }
  const message = deepFreeze(JSON.parse(canonicalizeJson(value)));
  if (message.type !== 'resource:changed' || message.version !== 2
    || message.resourceKind !== 'file' || message.changeKind !== 'state_observed'
    || message.panel !== 'file-viewer') throw new TypeError('resource observed projection type is invalid');
  assertUuid(message.projectionId, 'projectionId');
  assertUuid(message.sourceActivityId, 'sourceActivityId');
  assertUuid(message.sourceEdgeId, 'sourceEdgeId');
  if (message.projectionId !== message.sourceEdgeId) throw new TypeError('projection identity is invalid');
  assertNonemptyBoundedString(message.workspaceId, 128, 'workspaceId');
  normalizeCanonicalPath(message.path, 'path');
  assertTimestamp(message.occurredAt, 'occurredAt');
  assertUuid(message.snapshotId, 'snapshotId');
  if (!['first_observation', 'changed', 'unchanged'].includes(message.relation)) {
    throw new TypeError('resource observed relation is invalid');
  }
  if (!['bytes', 'absent'].includes(message.state)) throw new TypeError('resource observed state is invalid');
  if (message.state === 'bytes') assertUuid(message.resourceId, 'resourceId');
  else if ('resourceId' in message) throw new TypeError('absent projection cannot contain resource identity');
  if (message.relation === 'unchanged') {
    if ('checkpointEventId' in message || 'checkpointObservationId' in message) {
      throw new TypeError('unchanged projection cannot contain checkpoint fact identity');
    }
  } else {
    assertUuid(message.checkpointEventId, 'checkpointEventId');
    assertUuid(message.checkpointObservationId, 'checkpointObservationId');
  }
  return message;
}

function boundPairForWorkspace(session, workspaceId) {
  const pair = session?.workspaceBindingState === 'binding'
    ? pendingWorkspacePair(session)
    : currentWorkspacePair(session);
  if (!pair || pair.workspaceId !== workspaceId || pair.workspaceEpoch == null) return null;
  assertUuid(pair.workspaceEpoch, 'workspaceEpoch');
  return pair;
}

function sameWorkspacePair(left, right) {
  return left?.workspaceId === right?.workspaceId
    && left?.workspaceEpoch === right?.workspaceEpoch;
}

function closeForProjectionReconnect(ws) {
  try {
    if (typeof ws?.close === 'function') {
      ws.close(1011, 'resource projection requires reconnect');
      return;
    }
  } catch (_error) {}
  try { ws?.terminate?.(); } catch (_terminateError) {}
}

function assertNotAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('resource projection cancelled');
    error.code = 'projection_cancelled';
    throw error;
  }
}

function createResourceProjectionPublishers({
  sessions,
  registryAccess,
  sendBoundMessage = sendWorkspaceBoundReply,
} = {}) {
  if (!sessions || typeof sessions[Symbol.iterator] !== 'function') {
    throw new TypeError('workspace sessions are required');
  }
  if (!registryAccess || typeof registryAccess.validatePayload !== 'function') {
    throw new TypeError('initialized registry access is required');
  }
  if (typeof sendBoundMessage !== 'function') throw new TypeError('workspace-bound sender is required');

  async function publish(message, schemaKey, schemaVersion = 1, { signal } = {}) {
    assertNotAborted(signal);
    const recipients = [];
    for (const entry of sessions) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const [ws, session] = entry;
      if (!ws || ws.readyState !== OPEN) continue;
      const pair = boundPairForWorkspace(session, message.workspaceId);
      if (pair) recipients.push(Object.freeze({ ws, session, pair }));
    }

    const results = await Promise.allSettled(recipients.map(async ({ ws, session, pair }) => {
      assertNotAborted(signal);
      const finalMessage = deepFreeze({ ...message, workspaceEpoch: pair.workspaceEpoch });
      const validation = await registryAccess.validatePayload({
        schemaKey,
        schemaVersion,
        definitionKind: 'projection',
      }, finalMessage);
      if (!validation || validation.valid !== true) {
        throw new TypeError(`${schemaKey}@${schemaVersion} projection validation failed`);
      }
      assertNotAborted(signal);
      const deliveryPair = boundPairForWorkspace(session, message.workspaceId);
      if (!sameWorkspacePair(deliveryPair, pair)) {
        throw new Error(`${schemaKey}@${schemaVersion} projection recipient was superseded`);
      }
      const sent = await sendBoundMessage(ws, session, finalMessage);
      assertNotAborted(signal);
      if (sent !== true) throw new Error(`${schemaKey}@${schemaVersion} projection delivery failed`);
      return true;
    }));
    let failed = false;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed = true;
        closeForProjectionReconnect(recipients[index].ws);
      }
    });
    if (failed) {
      throw new Error(`${schemaKey}@${schemaVersion} projection delivery failed`);
    }
    return deepFreeze({ matched: recipients.length, delivered: results.length });
  }

  async function publishResourceChanged(value) {
    return publish(validateChangedBase(value), 'resource:changed');
  }

  async function publishSubscriberRefreshRequired(value) {
    return publish(
      validateRefreshBase(value, SUBSCRIBER_REASONS),
      'resource:refresh_required',
    );
  }

  async function publishControllerRefreshRequired(value) {
    return publish(
      validateRefreshBase(value, CONTROLLER_REASONS),
      'resource:refresh_required',
    );
  }

  async function publishResourceObservedV2(value, options) {
    return publish(validateObservedV2(value), 'resource:changed', 2, options);
  }

  async function publishAgentObservationRefreshRequired(value, options) {
    return publish(
      validateRefreshBase(value, AGENT_OBSERVER_REASONS),
      'resource:refresh_required',
      1,
      options,
    );
  }

  return Object.freeze({
    publishResourceChanged: Object.freeze(publishResourceChanged),
    publishSubscriberRefreshRequired: Object.freeze(publishSubscriberRefreshRequired),
    publishControllerRefreshRequired: Object.freeze(publishControllerRefreshRequired),
    publishResourceObservedV2: Object.freeze(publishResourceObservedV2),
    publishAgentObservationRefreshRequired: Object.freeze(publishAgentObservationRefreshRequired),
  });
}

module.exports = { createResourceProjectionPublishers };
