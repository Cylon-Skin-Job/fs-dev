'use strict';

const { canonicalizeJson, sha256CanonicalJson } = require('./canonical-json');
const { createSubscriptionEnvelope } = require('./policy');

const PROVENANCE_LEDGER_SUBSCRIPTION_ID = '5a936691-c114-46c0-8540-4bf6a68011a5';
const RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_ID = '713ad4f0-fc40-4f08-8f18-c6e3cbde62dc';
const AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_ID = 'd64557f0-49fb-4cb1-bc62-d2e70c1d16b1';
const AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_ID = '5442f168-edc3-44f9-9000-b2548f3882e6';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createSeed(subscriptionId, input) {
  const seedEnvelope = createSubscriptionEnvelope(input);
  return deepFreeze({
    subscriptionId,
    ownerId: 'fusion-studio',
    handlerKey: seedEnvelope.handlerKey,
    priority: seedEnvelope.priority,
    filterJson: canonicalizeJson(seedEnvelope.filter),
    requestedCapabilitiesJson: canonicalizeJson(seedEnvelope.requestedCapabilities),
    definitionJson: canonicalizeJson(seedEnvelope),
    definitionSha256: sha256CanonicalJson(seedEnvelope),
    deliveryPolicy: seedEnvelope.deliveryPolicy,
    envelope: seedEnvelope,
    grants: seedEnvelope.requestedCapabilities.map((request) => ({
      capabilityKey: request.capabilityKey,
      scopeJson: canonicalizeJson(request.scope),
    })),
  });
}

const PROVENANCE_LEDGER_SUBSCRIPTION_SEED = createSeed(PROVENANCE_LEDGER_SUBSCRIPTION_ID, {
  handlerKey: 'system.provenance-ledger',
  priority: -100,
  filter: {
    eventTypes: [{ eventType: 'resource.mutated', schemaVersion: 1 }],
  },
  requestedCapabilities: [
    {
      capabilityKey: 'fact.consume',
      scope: { eventTypes: [{ eventType: 'resource.mutated', schemaVersion: 1 }] },
    },
    {
      capabilityKey: 'ledger.append_resource_fact',
      scope: { workspaceScope: 'event' },
    },
    {
      capabilityKey: 'diagnostic.write_fixed',
      scope: { codes: ['ledger_duplicate_conflict', 'ledger_write_failed'] },
    },
  ],
  deliveryPolicy: 'required_ack',
  owner: { kind: 'system', id: 'fusion-studio' },
  locked: true,
  schemaReferences: [
    { definitionKind: 'event', schemaKey: 'resource.mutated', schemaVersion: 1 },
  ],
});

const RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED = createSeed(
  RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_ID,
  {
    handlerKey: 'system.resource-render-projection',
    priority: 0,
    filter: {
      eventTypes: [{ eventType: 'resource.mutated', schemaVersion: 1 }],
    },
    requestedCapabilities: [
      {
        capabilityKey: 'fact.consume',
        scope: { eventTypes: [{ eventType: 'resource.mutated', schemaVersion: 1 }] },
      },
      {
        capabilityKey: 'renderer.publish_resource_changed',
        scope: {
          workspaceScope: 'event',
          messageType: 'resource:changed',
          messageVersion: 1,
          panel: 'file-viewer',
        },
      },
      {
        capabilityKey: 'renderer.publish_resource_refresh_required',
        scope: {
          workspaceScope: 'event',
          messageType: 'resource:refresh_required',
          messageVersion: 1,
          panel: 'file-viewer',
          reasons: ['projection_failed'],
        },
      },
      {
        capabilityKey: 'diagnostic.write_fixed',
        scope: {
          codes: ['render_projection_failed', 'render_projection_duplicate_conflict'],
        },
      },
    ],
    deliveryPolicy: 'best_effort',
    owner: { kind: 'system', id: 'fusion-studio' },
    locked: true,
    schemaReferences: [
      { definitionKind: 'event', schemaKey: 'resource.mutated', schemaVersion: 1 },
      { definitionKind: 'projection', schemaKey: 'resource:changed', schemaVersion: 1 },
      { definitionKind: 'projection', schemaKey: 'resource:refresh_required', schemaVersion: 1 },
    ],
  },
);

const AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_SEED = createSeed(
  AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_ID,
  {
    handlerKey: 'system.agent-provenance-ledger',
    priority: -100,
    filter: {
      eventTypes: [
        { eventType: 'agent.tool_completed', schemaVersion: 1 },
        { eventType: 'resource.state_observed', schemaVersion: 1 },
      ],
    },
    requestedCapabilities: [
      {
        capabilityKey: 'fact.consume',
        scope: {
          eventTypes: [
            { eventType: 'agent.tool_completed', schemaVersion: 1 },
            { eventType: 'resource.state_observed', schemaVersion: 1 },
          ],
        },
      },
      {
        capabilityKey: 'ledger.append_agent_fact',
        scope: { workspaceScope: 'event' },
      },
      {
        capabilityKey: 'diagnostic.write_fixed',
        scope: {
          codes: [
            'agent_ledger_conflict',
            'agent_ledger_source_missing',
            'agent_ledger_write_failed',
          ],
        },
      },
    ],
    deliveryPolicy: 'required_ack',
    owner: { kind: 'system', id: 'fusion-studio' },
    locked: true,
    schemaReferences: [
      { definitionKind: 'event', schemaKey: 'agent.tool_completed', schemaVersion: 1 },
      { definitionKind: 'event', schemaKey: 'resource.state_observed', schemaVersion: 1 },
    ],
  },
);

const AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_SEED = createSeed(
  AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_ID,
  {
    handlerKey: 'system.agent-resource-observer',
    priority: -50,
    filter: {
      eventTypes: [{ eventType: 'agent.tool_completed', schemaVersion: 1 }],
    },
    requestedCapabilities: [
      {
        capabilityKey: 'fact.consume',
        scope: { eventTypes: [{ eventType: 'agent.tool_completed', schemaVersion: 1 }] },
      },
      {
        capabilityKey: 'agent.schedule_observation',
        scope: { workspaceScope: 'event' },
      },
      {
        capabilityKey: 'diagnostic.write_fixed',
        scope: { codes: ['agent_observation_schedule_failed'] },
      },
    ],
    deliveryPolicy: 'required_ack',
    owner: { kind: 'system', id: 'fusion-studio' },
    locked: true,
    schemaReferences: [
      { definitionKind: 'event', schemaKey: 'agent.tool_completed', schemaVersion: 1 },
      { definitionKind: 'event', schemaKey: 'resource.state_observed', schemaVersion: 1 },
      { definitionKind: 'projection', schemaKey: 'resource:changed', schemaVersion: 2 },
      { definitionKind: 'projection', schemaKey: 'resource:refresh_required', schemaVersion: 1 },
    ],
  },
);

const SYSTEM_SUBSCRIPTION_SEEDS = Object.freeze([
  PROVENANCE_LEDGER_SUBSCRIPTION_SEED,
  AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_SEED,
  AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_SEED,
  RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED,
]);

function createSystemSubscriptionIntegrityCatalog() {
  return new Map(SYSTEM_SUBSCRIPTION_SEEDS.map((seed) => [seed.subscriptionId, Object.freeze({
    checksum: seed.definitionSha256,
    ownerId: seed.ownerId,
    envelope: seed.envelope,
  })]));
}

module.exports = {
  PROVENANCE_LEDGER_SUBSCRIPTION_ID,
  PROVENANCE_LEDGER_SUBSCRIPTION_SEED,
  AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_ID,
  AGENT_PROVENANCE_LEDGER_SUBSCRIPTION_SEED,
  AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_ID,
  AGENT_RESOURCE_OBSERVER_SUBSCRIPTION_SEED,
  RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_ID,
  RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_SEED,
  SYSTEM_SUBSCRIPTION_SEEDS,
  createSystemSubscriptionIntegrityCatalog,
};
