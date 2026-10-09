'use strict';

const { normalizeCapabilityScope } = require('../event-registry/capability-catalog');
const { canonicalizeJson, sha256CanonicalJson } = require('../event-registry/canonical-json');
const { normalizeFilter } = require('../event-registry/filter');
const { compareOrdinalStrings } = require('../event-registry/ordinal');
const { deepFreeze } = require('./deep-freeze');

const REQUIRED_GRANTS_BY_HANDLER = Object.freeze({
  'system.provenance-ledger': Object.freeze([
    Object.freeze({
      capabilityKey: 'fact.consume',
      scope: Object.freeze({
        eventTypes: Object.freeze([
          Object.freeze({ eventType: 'resource.mutated', schemaVersion: 1 }),
        ]),
      }),
    }),
    Object.freeze({
      capabilityKey: 'ledger.append_resource_fact',
      scope: Object.freeze({ workspaceScope: 'event' }),
    }),
    Object.freeze({
      capabilityKey: 'diagnostic.write_fixed',
      scope: Object.freeze({
        codes: Object.freeze(['ledger_duplicate_conflict', 'ledger_write_failed']),
      }),
    }),
  ]),
  'system.resource-render-projection': Object.freeze([
    Object.freeze({
      capabilityKey: 'fact.consume',
      scope: Object.freeze({
        eventTypes: Object.freeze([
          Object.freeze({ eventType: 'resource.mutated', schemaVersion: 1 }),
        ]),
      }),
    }),
    Object.freeze({
      capabilityKey: 'renderer.publish_resource_changed',
      scope: Object.freeze({
        workspaceScope: 'event',
        messageType: 'resource:changed',
        messageVersion: 1,
        panel: 'file-viewer',
      }),
    }),
    Object.freeze({
      capabilityKey: 'renderer.publish_resource_refresh_required',
      scope: Object.freeze({
        workspaceScope: 'event',
        messageType: 'resource:refresh_required',
        messageVersion: 1,
        panel: 'file-viewer',
        reasons: Object.freeze(['projection_failed']),
      }),
    }),
    Object.freeze({
      capabilityKey: 'diagnostic.write_fixed',
      scope: Object.freeze({
        codes: Object.freeze([
          'render_projection_duplicate_conflict',
          'render_projection_failed',
        ]),
      }),
    }),
  ]),
  'system.agent-provenance-ledger': Object.freeze([
    Object.freeze({
      capabilityKey: 'fact.consume',
      scope: Object.freeze({
        eventTypes: Object.freeze([
          Object.freeze({ eventType: 'agent.tool_completed', schemaVersion: 1 }),
          Object.freeze({ eventType: 'resource.state_observed', schemaVersion: 1 }),
        ]),
      }),
    }),
    Object.freeze({
      capabilityKey: 'ledger.append_agent_fact',
      scope: Object.freeze({ workspaceScope: 'event' }),
    }),
    Object.freeze({
      capabilityKey: 'diagnostic.write_fixed',
      scope: Object.freeze({
        codes: Object.freeze([
          'agent_ledger_conflict',
          'agent_ledger_source_missing',
          'agent_ledger_write_failed',
        ]),
      }),
    }),
  ]),
  'system.agent-resource-observer': Object.freeze([
    Object.freeze({
      capabilityKey: 'fact.consume',
      scope: Object.freeze({
        eventTypes: Object.freeze([
          Object.freeze({ eventType: 'agent.tool_completed', schemaVersion: 1 }),
        ]),
      }),
    }),
    Object.freeze({
      capabilityKey: 'agent.schedule_observation',
      scope: Object.freeze({ workspaceScope: 'event' }),
    }),
    Object.freeze({
      capabilityKey: 'diagnostic.write_fixed',
      scope: Object.freeze({ codes: Object.freeze(['agent_observation_schedule_failed']) }),
    }),
  ]),
});
const OUTPUT_SCHEMA_BY_CAPABILITY = Object.freeze({
  'renderer.publish_resource_changed': Object.freeze({
    schemaKey: 'resource:changed', schemaVersion: 1, definitionKind: 'projection',
  }),
  'renderer.publish_resource_refresh_required': Object.freeze({
    schemaKey: 'resource:refresh_required', schemaVersion: 1, definitionKind: 'projection',
  }),
});

function schemaKey(reference) {
  return `${reference.definitionKind}\u0000${reference.schemaKey}\u0000${reference.schemaVersion}`;
}

function schemaAuthority(schema) {
  return {
    definitionKind: schema.row.definition_kind,
    schemaKey: schema.row.schema_key,
    schemaVersion: schema.row.schema_version,
    definitionSha256: schema.row.definition_sha256 || null,
  };
}

function compileGeneration({ effectiveState, handlerCatalog, createScopedContext, generationId }) {
  if (!effectiveState || !Array.isArray(effectiveState.effectiveSubscriptions)) {
    throw new TypeError('effective registry state is required');
  }
  if (!Array.isArray(effectiveState.schemas)) throw new TypeError('effective schema state is required');
  if (!handlerCatalog || typeof handlerCatalog.get !== 'function') {
    throw new TypeError('handler catalog is required');
  }
  if (typeof createScopedContext !== 'function') throw new TypeError('scoped capability factory is required');
  if (typeof createScopedContext.assertAvailable !== 'function') {
    throw new TypeError('scoped capability provider preflight is required');
  }
  if (!Number.isInteger(generationId) || generationId < 1) {
    throw new TypeError('generationId must be a positive integer');
  }

  const activeSchemas = new Set(effectiveState.schemas
    .filter((schema) => schema && schema.effective && schema.row)
    .map((schema) => schemaKey({
      definitionKind: schema.row.definition_kind,
      schemaKey: schema.row.schema_key,
      schemaVersion: schema.row.schema_version,
    })));

  const seenSubscriptionIds = new Set();
  const descriptors = effectiveState.effectiveSubscriptions.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new TypeError('effective subscription is malformed');
    if (typeof entry.subscriptionId !== 'string' || entry.subscriptionId.length === 0) {
      throw new TypeError('effective subscription ID is invalid');
    }
    if (seenSubscriptionIds.has(entry.subscriptionId)) {
      throw new TypeError(`Duplicate effective subscription ${entry.subscriptionId}`);
    }
    seenSubscriptionIds.add(entry.subscriptionId);
    const handlerKey = entry.handlerKey;
    const handler = handlerCatalog.get(handlerKey);
    if (!handler) throw new TypeError(`Unknown handler ${handlerKey}`);
    if (!Number.isInteger(entry.priority) || entry.priority < -1000 || entry.priority > 1000) {
      throw new TypeError(`Invalid priority for ${entry.subscriptionId}`);
    }
    if (!['best_effort', 'required_ack'].includes(entry.deliveryPolicy)) {
      throw new TypeError(`Invalid delivery policy for ${entry.subscriptionId}`);
    }
    if (entry.deliveryPolicy === 'required_ack'
      && !['system.provenance-ledger', 'system.agent-provenance-ledger', 'system.agent-resource-observer'].includes(handlerKey)) {
      throw new TypeError('required_ack is restricted to locked durable system handlers');
    }
    const filter = normalizeFilter(entry.filter);
    for (const eventType of filter.eventTypes) {
      if (!activeSchemas.has(schemaKey({
        definitionKind: 'event',
        schemaKey: eventType.eventType,
        schemaVersion: eventType.schemaVersion,
      }))) {
        throw new TypeError(`Unknown effective schema ${eventType.eventType}@${eventType.schemaVersion}`);
      }
    }
    if (!Array.isArray(entry.grants)) throw new TypeError('effective grants must be an array');
    const seenCapabilities = new Set();
    const grants = entry.grants.map((grant) => {
      if (!grant || typeof grant.capabilityKey !== 'string') {
        throw new TypeError('effective grant is malformed');
      }
      if (seenCapabilities.has(grant.capabilityKey)) {
        throw new TypeError(`Duplicate effective capability ${grant.capabilityKey}`);
      }
      seenCapabilities.add(grant.capabilityKey);
      return deepFreeze({
        capabilityKey: grant.capabilityKey,
        scope: normalizeCapabilityScope(grant.capabilityKey, grant.scope, { handlerKey }),
      });
    });
    const requiredGrants = REQUIRED_GRANTS_BY_HANDLER[handlerKey];
    if (!requiredGrants) throw new TypeError(`Unknown handler ${handlerKey}`);
    const requiredCapabilities = requiredGrants.map((grant) => grant.capabilityKey);
    const grantedCapabilities = new Set(grants.map((grant) => grant.capabilityKey));
    const missingCapabilities = requiredCapabilities.filter((key) => !grantedCapabilities.has(key));
    if (missingCapabilities.length > 0) {
      throw new TypeError(
        `Missing required capabilities for ${entry.subscriptionId}: ${missingCapabilities.join(', ')}`,
      );
    }
    const unexpectedCapabilities = [...grantedCapabilities]
      .filter((key) => !requiredCapabilities.includes(key));
    if (unexpectedCapabilities.length > 0) {
      throw new TypeError(
        `Unexpected capabilities for ${entry.subscriptionId}: ${unexpectedCapabilities.join(', ')}`,
      );
    }
    const requiredGrantByCapability = new Map(requiredGrants.map((grant) => [
      grant.capabilityKey,
      normalizeCapabilityScope(grant.capabilityKey, grant.scope, { handlerKey }),
    ]));
    for (const grant of grants) {
      if (canonicalizeJson(grant.scope) !== canonicalizeJson(
        requiredGrantByCapability.get(grant.capabilityKey),
      )) {
        throw new TypeError(
          `Capability scope does not match handler contract for ${entry.subscriptionId}: ${grant.capabilityKey}`,
        );
      }
    }
    for (const grant of grants) {
      const outputSchema = OUTPUT_SCHEMA_BY_CAPABILITY[grant.capabilityKey];
      if (outputSchema && !activeSchemas.has(schemaKey(outputSchema))) {
        throw new TypeError(
          `Unknown effective schema ${outputSchema.schemaKey}@${outputSchema.schemaVersion}`,
        );
      }
    }
    createScopedContext.assertAvailable({ handlerKey, grants });
    const referencedSchemas = filter.eventTypes.map((eventType) => schemaAuthority(
      effectiveState.schemas.find((schema) => schema && schema.effective && schemaKey({
        definitionKind: schema.row.definition_kind,
        schemaKey: schema.row.schema_key,
        schemaVersion: schema.row.schema_version,
      }) === schemaKey({
        definitionKind: 'event',
        schemaKey: eventType.eventType,
        schemaVersion: eventType.schemaVersion,
      })),
    ));
    for (const grant of grants) {
      const outputSchema = OUTPUT_SCHEMA_BY_CAPABILITY[grant.capabilityKey];
      if (outputSchema) {
        referencedSchemas.push(schemaAuthority(effectiveState.schemas.find((schema) => (
          schema && schema.effective && schemaKey({
            definitionKind: schema.row.definition_kind,
            schemaKey: schema.row.schema_key,
            schemaVersion: schema.row.schema_version,
          }) === schemaKey(outputSchema)
        ))));
      }
    }
    const descriptor = {
      subscriptionId: entry.subscriptionId,
      handlerKey,
      priority: entry.priority,
      filter,
      deliveryPolicy: entry.deliveryPolicy,
      grants,
      authorityFingerprint: sha256CanonicalJson({
        subscriptionId: entry.subscriptionId,
        handlerKey,
        priority: entry.priority,
        filter,
        deliveryPolicy: entry.deliveryPolicy,
        grants,
        schemas: referencedSchemas,
      }),
      invoke(fact) {
        return handler(fact, createScopedContext({ handlerKey, grants, fact }));
      },
    };
    return deepFreeze(descriptor);
  });

  descriptors.sort((left, right) => (
    left.priority - right.priority || compareOrdinalStrings(left.subscriptionId, right.subscriptionId)
  ));
  return deepFreeze({ generationId, descriptors });
}

module.exports = { compileGeneration };
