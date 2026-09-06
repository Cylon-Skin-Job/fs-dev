'use strict';

const { UUID_PATTERN } = require('../file-mutations/validation-patterns');
const {
  ProvenanceQuerySelectorError,
  createProvenanceQueryPathNormalizer,
} = require('../ledger/provenance-query-paths');
const { currentWorkspacePair, sendWorkspaceBoundReply } = require('./workspace-session');

const SCHEMA_REFERENCE = Object.freeze({
  schemaKey: 'resource:provenance',
  schemaVersion: 1,
  definitionKind: 'query',
});

function scalarStringWithin(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function validRequestId(value) {
  return scalarStringWithin(value, 128);
}

function validEnvelope(message) {
  return message?.type === 'resource:provenance:query'
    && message.version === 1
    && validRequestId(message.requestId)
    && scalarStringWithin(message.workspaceId, 128)
    && typeof message.workspaceEpoch === 'string'
    && UUID_PATTERN.test(message.workspaceEpoch);
}

function error(code, extra = {}) {
  return Object.freeze({
    type: 'resource:provenance:error',
    version: 1,
    code,
    ...extra,
  });
}

function hasInactiveSchema(errors) {
  return errors?.some((item) => item?.code === 'schema_inactive');
}

function createResourceProvenanceRoute({
  registryAccess,
  repository,
  pathNormalizer = createProvenanceQueryPathNormalizer(),
  sendReply = sendWorkspaceBoundReply,
  writeDiagnostic = () => {},
} = {}) {
  if (typeof registryAccess?.validatePayload !== 'function') {
    throw new TypeError('registry validation access is required');
  }
  if (typeof repository?.query !== 'function') throw new TypeError('provenance repository is required');
  if (typeof pathNormalizer?.normalize !== 'function') throw new TypeError('query path normalizer is required');

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  function closeInvalidAuthority(ws) {
    diagnose('resource_provenance_schema_unavailable');
    try { ws.close(1011, 'resource provenance authority unavailable'); } catch (_error) {}
  }

  async function sendFixedQueryFailure(ws, session, requestId, pair) {
    diagnose('resource_provenance_query_failed');
    try {
      return await sendReply(ws, session, error('query_failed', { requestId, ...pair }));
    } catch (_error) {
      try { ws.close(1011, 'resource provenance query failed'); } catch (_closeError) {}
      return false;
    }
  }

  async function sendValidated(ws, session, value) {
    let validation;
    try {
      validation = await registryAccess.validatePayload(SCHEMA_REFERENCE, value);
    } catch (_error) {
      if (validRequestId(value?.requestId)
        && scalarStringWithin(value?.workspaceId, 128)
        && typeof value?.workspaceEpoch === 'string'
        && UUID_PATTERN.test(value.workspaceEpoch)) {
        return sendFixedQueryFailure(ws, session, value.requestId, {
          workspaceId: value.workspaceId,
          workspaceEpoch: value.workspaceEpoch,
        });
      }
      diagnose('resource_provenance_query_failed');
      try { ws.close(1011, 'resource provenance query failed'); } catch (_closeError) {}
      return false;
    }
    if (!validation.valid) {
      closeInvalidAuthority(ws);
      return false;
    }
    return sendReply(ws, session, value);
  }

  async function handleValidatedQuery({ ws, session, message }) {
    const requestId = validRequestId(message?.requestId) ? message.requestId : undefined;
    if (!validEnvelope(message)) {
      return sendValidated(ws, session, error('invalid_request', requestId ? { requestId } : {}));
    }

    const pair = currentWorkspacePair(session);
    if (!pair) {
      return sendValidated(ws, session, error('workspace_unavailable', { requestId: message.requestId }));
    }
    if (message.workspaceId !== pair.workspaceId || message.workspaceEpoch !== pair.workspaceEpoch) {
      return sendValidated(ws, session, error('stale_workspace', {
        requestId: message.requestId,
        ...pair,
      }));
    }

    let validation;
    try {
      validation = await registryAccess.validatePayload(SCHEMA_REFERENCE, message);
    } catch (_error) {
      return sendFixedQueryFailure(ws, session, message.requestId, pair);
    }
    if (!validation.valid) {
      if (hasInactiveSchema(validation.errors)) {
        closeInvalidAuthority(ws);
        return false;
      }
      return sendValidated(ws, session, error('invalid_request', {
        requestId: message.requestId,
        ...pair,
      }));
    }

    let normalizedPaths;
    try {
      normalizedPaths = await pathNormalizer.normalize({
        workspaceId: pair.workspaceId,
        panel: message.panel,
        path: message.path,
        folderPrefix: message.folderPrefix,
      });
    } catch (normalizationError) {
      if (normalizationError instanceof ProvenanceQuerySelectorError) {
        return sendValidated(ws, session, error('invalid_request', {
          requestId: message.requestId,
          ...pair,
        }));
      }
      return sendFixedQueryFailure(ws, session, message.requestId, pair);
    }

    let items;
    try {
      items = await repository.query({
        workspaceId: pair.workspaceId,
        ...normalizedPaths,
        ...(message.fileName == null ? {} : { fileName: message.fileName }),
        ...(message.operationId == null ? {} : { operationId: message.operationId }),
        ...(message.since == null ? {} : { since: message.since }),
        ...(message.limit == null ? {} : { limit: message.limit }),
      });
    } catch (_error) {
      return sendFixedQueryFailure(ws, session, message.requestId, pair);
    }

    return sendValidated(ws, session, Object.freeze({
      type: 'resource:provenance:result',
      version: 1,
      requestId: message.requestId,
      ...pair,
      items,
    }));
  }

  async function handleQuery(input) {
    try {
      return await handleValidatedQuery(input);
    } catch (_error) {
      const requestId = validRequestId(input?.message?.requestId) ? input.message.requestId : null;
      const pair = currentWorkspacePair(input?.session);
      if (requestId && pair) {
        return sendFixedQueryFailure(input.ws, input.session, requestId, pair);
      }
      diagnose('resource_provenance_query_failed');
      try { input?.ws?.close(1011, 'resource provenance query failed'); } catch (_closeError) {}
      return false;
    }
  }

  return Object.freeze({ handleQuery });
}

module.exports = { SCHEMA_REFERENCE, createResourceProvenanceRoute, validRequestId };
