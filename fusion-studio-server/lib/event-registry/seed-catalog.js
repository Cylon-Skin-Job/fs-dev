'use strict';

const { canonicalizeJson, sha256CanonicalJson } = require('./canonical-json');
const fileCommandAcceptedV1 = require('./schemas/file-command-accepted-v1.json');
const fileContentV1 = require('./schemas/file-content-v1.json');
const fileSaveV1 = require('./schemas/file-save-v1.json');
const fileTreeV1 = require('./schemas/file-tree-v1.json');
const resourceChangedV1 = require('./schemas/resource-changed-v1.json');
const resourceChangedV2 = require('./schemas/resource-changed-v2.json');
const resourceMutatedV1 = require('./schemas/resource-mutated-v1.json');
const resourceProvenanceV1 = require('./schemas/resource-provenance-v1.json');
const resourceRefreshRequiredV1 = require('./schemas/resource-refresh-required-v1.json');
const agentToolCompletedV1 = require('./schemas/agent-tool-completed-v1.json');
const resourceStateObservedV1 = require('./schemas/resource-state-observed-v1.json');
const agentActivityV1 = require('./schemas/agent-activity-v1.json');

const OWNER_ID = 'fusion-studio';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createSeed(schemaId, schemaKey, definitionKind, definition, schemaVersion = 1) {
  deepFreeze(definition);
  const definitionJson = canonicalizeJson(definition);
  return Object.freeze({
    schemaId,
    schemaKey,
    schemaVersion,
    definitionKind,
    ownerId: OWNER_ID,
    definition,
    definitionJson,
    definitionSha256: sha256CanonicalJson(definition),
  });
}

// These opaque IDs are application constants, not migration ordinals. They
// remain stable when migrations are squashed or the catalog is reconstructed.
const SYSTEM_SCHEMA_SEEDS = Object.freeze([
  createSeed(
    '27c767a2-c48e-4dad-bfec-2e16429be9e4',
    'resource.mutated',
    'event',
    resourceMutatedV1,
  ),
  createSeed(
    '8188e044-d893-4961-aa0f-6f12da755896',
    'resource:changed',
    'projection',
    resourceChangedV1,
  ),
  createSeed(
    'e9dfdb74-96ef-4c6b-a521-07727ae6d59a',
    'resource:changed',
    'projection',
    resourceChangedV2,
    2,
  ),
  createSeed(
    'b4587e3c-4e61-4076-97b4-d34884c15097',
    'resource:refresh_required',
    'projection',
    resourceRefreshRequiredV1,
  ),
  createSeed(
    'd8ba7295-e7c1-46a7-aa87-e295d6776c26',
    'file.command_accepted',
    'event',
    fileCommandAcceptedV1,
  ),
  createSeed(
    '3c728bed-889f-4e9f-92f5-2d43b50dc97d',
    'file_save',
    'command',
    fileSaveV1,
  ),
  createSeed(
    'e4d64cbc-1ce9-46fd-8bb4-07368e2fe4f5',
    'resource:provenance',
    'query',
    resourceProvenanceV1,
  ),
  createSeed(
    'bb403f95-625a-4e0b-8a13-e192737654c8',
    'file_tree',
    'query',
    fileTreeV1,
  ),
  createSeed(
    '9263ddf1-f7b7-40d0-b177-9cf843b91064',
    'file_content',
    'query',
    fileContentV1,
  ),
  createSeed(
    '6656a4ee-b1a2-4e07-8ea7-a2bbeb2929bb',
    'agent.tool_completed',
    'event',
    agentToolCompletedV1,
  ),
  createSeed(
    'a4070b63-bffe-4a9f-9b7f-4c3ff2da8d60',
    'resource.state_observed',
    'event',
    resourceStateObservedV1,
  ),
  createSeed(
    'da63b7c4-55d1-4cee-9a13-95cc2621bb64',
    'agent:activity',
    'query',
    agentActivityV1,
  ),
]);

function createSystemSchemaIntegrityCatalog() {
  return new Map(SYSTEM_SCHEMA_SEEDS.map((seed) => [seed.schemaId, Object.freeze({
    checksum: seed.definitionSha256,
    schemaKey: seed.schemaKey,
    schemaVersion: seed.schemaVersion,
    definitionKind: seed.definitionKind,
    ownerId: seed.ownerId,
  })]));
}

module.exports = {
  SYSTEM_SCHEMA_SEEDS,
  createSystemSchemaIntegrityCatalog,
};
