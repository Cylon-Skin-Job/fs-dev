'use strict';

const { SYSTEM_SCHEMA_SEEDS } = require('./seed-catalog');
const { SYSTEM_SUBSCRIPTION_SEEDS } = require('./subscription-seed-catalog');

function semanticWhere(seed) {
  return {
    schema_key: seed.schemaKey,
    schema_version: seed.schemaVersion,
    definition_kind: seed.definitionKind,
  };
}

function diagnostic(id, code) {
  return Object.freeze({ kind: 'schema', id, code });
}

async function reconcileSystemSchemas(knex, { now = Date.now } = {}) {
  if (typeof knex !== 'function') throw new TypeError('An initialized Knex instance is required');
  const timestamp = now();
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new TypeError('now() must return epoch milliseconds');
  }

  const diagnostics = [];
  const inserted = [];
  const preserved = [];
  const subscriptionsInserted = [];
  const subscriptionsPreserved = [];

  await knex.transaction(async (trx) => {
    for (const seed of SYSTEM_SCHEMA_SEEDS) {
      const [byId, bySemanticKey] = await Promise.all([
        trx('event_schema_registry').where({ schema_id: seed.schemaId }).first(),
        trx('event_schema_registry').where(semanticWhere(seed)).first(),
      ]);

      const hasIdCollision = Boolean(byId && (
        byId.schema_key !== seed.schemaKey
        || byId.schema_version !== seed.schemaVersion
        || byId.definition_kind !== seed.definitionKind
      ));
      const hasSemanticCollision = Boolean(
        bySemanticKey && bySemanticKey.schema_id !== seed.schemaId,
      );
      if (hasIdCollision) {
        diagnostics.push(diagnostic(byId.schema_id, 'schema_seed_id_collision'));
      }
      if (hasSemanticCollision) {
        diagnostics.push(diagnostic(bySemanticKey.schema_id, 'schema_seed_semantic_collision'));
      }
      if (hasIdCollision || hasSemanticCollision) {
        continue;
      }
      if (byId) {
        preserved.push(seed.schemaId);
        continue;
      }

      await trx('event_schema_registry').insert({
        schema_id: seed.schemaId,
        schema_key: seed.schemaKey,
        schema_version: seed.schemaVersion,
        definition_kind: seed.definitionKind,
        owner_kind: 'system',
        owner_id: seed.ownerId,
        locked: 1,
        status: 'enabled',
        definition_json: seed.definitionJson,
        definition_sha256: seed.definitionSha256,
        created_at: timestamp,
        updated_at: timestamp,
      });
      inserted.push(seed.schemaId);
    }

    for (const seed of SYSTEM_SUBSCRIPTION_SEEDS) {
      const [byId, lockedHandler] = await Promise.all([
        trx('event_subscription_registry').where({ subscription_id: seed.subscriptionId }).first(),
        trx('event_subscription_registry').where({
          handler_key: seed.handlerKey,
          owner_kind: 'system',
          locked: 1,
        }).first(),
      ]);
      const idCollision = Boolean(byId && (
        byId.handler_key !== seed.handlerKey
        || byId.owner_kind !== 'system'
        || byId.owner_id !== seed.ownerId
        || byId.locked !== 1
      ));
      const handlerCollision = Boolean(
        lockedHandler && lockedHandler.subscription_id !== seed.subscriptionId,
      );
      if (idCollision) diagnostics.push(Object.freeze({
        kind: 'subscription', id: byId.subscription_id, code: 'subscription_seed_id_collision',
      }));
      if (handlerCollision) diagnostics.push(Object.freeze({
        kind: 'subscription', id: lockedHandler.subscription_id, code: 'subscription_seed_handler_collision',
      }));
      if (!idCollision && !handlerCollision && !byId) {
        await trx('event_subscription_registry').insert({
          subscription_id: seed.subscriptionId,
          owner_kind: 'system',
          owner_id: seed.ownerId,
          locked: 1,
          status: 'enabled',
          handler_key: seed.handlerKey,
          priority: seed.priority,
          filter_json: seed.filterJson,
          requested_capabilities_json: seed.requestedCapabilitiesJson,
          definition_json: seed.definitionJson,
          definition_sha256: seed.definitionSha256,
          delivery_policy: seed.deliveryPolicy,
          installation_id: null,
          installation_revision: null,
          created_at: timestamp,
          updated_at: timestamp,
        });
        await trx('event_subscription_grants').insert(seed.grants.map((grant) => ({
          subscription_id: seed.subscriptionId,
          capability_key: grant.capabilityKey,
          state: 'granted',
          scope_json: grant.scopeJson,
          authorized_by_kind: 'system_seed',
          authorized_at: timestamp,
          created_at: timestamp,
          updated_at: timestamp,
        })));
        subscriptionsInserted.push(seed.subscriptionId);
      } else if (!idCollision && !handlerCollision) {
        subscriptionsPreserved.push(seed.subscriptionId);
      }
    }
  });

  return Object.freeze({
    inserted: Object.freeze(inserted),
    preserved: Object.freeze(preserved),
    subscriptionsInserted: Object.freeze(subscriptionsInserted),
    subscriptionsPreserved: Object.freeze(subscriptionsPreserved),
    diagnostics: Object.freeze(diagnostics),
  });
}

module.exports = { reconcileSystemSchemas };
