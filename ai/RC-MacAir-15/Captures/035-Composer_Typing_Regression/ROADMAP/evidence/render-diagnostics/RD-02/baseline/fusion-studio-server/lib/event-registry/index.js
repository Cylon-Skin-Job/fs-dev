'use strict';

const { createRegistryRepository } = require('./repository');
const { reconcileSystemSchemas } = require('./reconcile');
const { createSystemSchemaIntegrityCatalog } = require('./seed-catalog');
const { createSystemSubscriptionIntegrityCatalog } = require('./subscription-seed-catalog');
const { assertSchemaDefinition, createPayloadValidator } = require('./schema-validator');
const { schemaReferenceKey } = require('./policy');

let initializedRegistry = null;

function diagnosticMap(diagnostics, kind) {
  const result = new Map();
  for (const item of diagnostics) {
    if (item.kind !== kind) continue;
    if (!result.has(item.id)) result.set(item.id, []);
    result.get(item.id).push(item.code);
  }
  return result;
}

function createReadAccess(repository) {
  async function getEffectiveState() {
    return repository.calculateEffectiveState();
  }

  async function validatePayload(reference, value) {
    const state = await getEffectiveState();
    const key = schemaReferenceKey(reference);
    const schema = state.schemas.find((entry) => schemaReferenceKey({
      schemaKey: entry.row.schema_key,
      schemaVersion: entry.row.schema_version,
      definitionKind: entry.row.definition_kind,
    }) === key);
    if (!schema || !schema.effective) {
      return Object.freeze({
        valid: false,
        errors: Object.freeze([{ instancePath: '', keyword: 'registry', code: 'schema_inactive' }]),
      });
    }
    return createPayloadValidator(schema.definition, schema.row.schema_key)(value);
  }

  return Object.freeze({
    getEffectiveState,
    listSchemas: repository.listSchemas,
    listSubscriptions: repository.listSubscriptions,
    validatePayload,
  });
}

async function createInitializedEventRegistry(knex, options = {}) {
  const reconciliation = await reconcileSystemSchemas(knex, options);
  const repository = createRegistryRepository(knex, {
    installedHandlers: options.installedHandlers || [],
    systemSchemaIntegrity: createSystemSchemaIntegrityCatalog(),
    systemSubscriptionIntegrity: options.systemSubscriptionIntegrity
      || createSystemSubscriptionIntegrityCatalog(),
    validateSchemaDefinition: assertSchemaDefinition,
    schemaDiagnosticsById: diagnosticMap(reconciliation.diagnostics, 'schema'),
  });
  const access = createReadAccess(repository);
  const state = await access.getEffectiveState();
  return Object.freeze({ access, reconciliation, state });
}

async function initializeEventRegistry(knex, options = {}) {
  const initialized = await createInitializedEventRegistry(knex, options);
  initializedRegistry = initialized.access;

  const logger = options.logger || console;
  logger.log(`[EventRegistry] schemas=${initialized.state.schemas.length} subscriptions=${initialized.state.subscriptions.length} activeSubscriptions=${initialized.state.effectiveSubscriptions.length}`);
  for (const item of initialized.state.diagnostics) {
    logger.warn(`[EventRegistry] ${item.kind}:${item.id}:${item.code}`);
  }
  return initializedRegistry;
}

function getInitializedEventRegistry() {
  if (!initializedRegistry) throw new Error('Event registry is not initialized');
  return initializedRegistry;
}

module.exports = {
  createInitializedEventRegistry,
  getInitializedEventRegistry,
  initializeEventRegistry,
};
