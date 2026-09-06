'use strict';

const nodePath = require('path');
const Ajv2020 = require('ajv/dist/2020');

const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function createAjv() {
  return new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    validateFormats: false,
  });
}

function assertSchemaDefinition(definition) {
  const ajv = createAjv();
  if (!ajv.validateSchema(definition)) {
    throw new TypeError('Schema definition is not valid JSON Schema 2020-12');
  }
  ajv.compile(definition);
  return true;
}

function semanticError(path, code) {
  return Object.freeze({ instancePath: path, keyword: 'fusionSemantic', code });
}

function validateUnicodeString(value, instancePath, byteLimit, errors, { nonempty = true } = {}) {
  if (typeof value !== 'string') return;
  if (UNPAIRED_SURROGATE.test(value)) errors.push(semanticError(instancePath, 'unicode_scalar_required'));
  if (nonempty && value.length === 0) errors.push(semanticError(instancePath, 'nonempty_required'));
  if (Buffer.byteLength(value, 'utf8') > byteLimit) {
    errors.push(semanticError(instancePath, `utf8_bytes_exceed_${byteLimit}`));
  }
}

function validateNulFreeString(value, instancePath, errors) {
  if (typeof value === 'string' && value.includes('\u0000')) {
    errors.push(semanticError(instancePath, 'nul_not_allowed'));
  }
}

function validateNormalizedPath(value, instancePath, errors, { allowEmpty = false } = {}) {
  validateUnicodeString(value, instancePath, 4096, errors, { nonempty: !allowEmpty });
  if (typeof value !== 'string' || value.length === 0) return;
  if (
    value.includes('\\')
    || value.includes('\u0000')
    || nodePath.posix.isAbsolute(value)
    || nodePath.posix.normalize(value) !== value
    || value === '.'
    || value === '..'
    || value.startsWith('../')
    || value.endsWith('/')
  ) errors.push(semanticError(instancePath, 'normalized_workspace_relative_path_required'));
}

function validateFileReadSemantics(schemaKey, value, errors) {
  validateUnicodeString(value.requestId, '/requestId', 128, errors);
  validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
  validateUnicodeString(value.error, '/error', 256, errors);
  if (schemaKey === 'file_tree') {
    validateNormalizedPath(value.path, '/path', errors, { allowEmpty: true });
    for (let index = 0; index < (value.nodes || []).length; index += 1) {
      const node = value.nodes[index];
      validateUnicodeString(node?.name, `/nodes/${index}/name`, 255, errors);
      validateNormalizedPath(node?.path, `/nodes/${index}/path`, errors);
      validateUnicodeString(
        node?.extension,
        `/nodes/${index}/extension`,
        Number.MAX_SAFE_INTEGER,
        errors,
        { nonempty: false },
      );
      validateUnicodeString(node?.symlinkTarget, `/nodes/${index}/symlinkTarget`, 4096, errors);
    }
  } else {
    validateNormalizedPath(value.path, '/path', errors);
    if (value.type === 'file_content_response' && value.success === true) {
      validateUnicodeString(value.content, '/content', Number.MAX_SAFE_INTEGER, errors, { nonempty: false });
      validateNulFreeString(value.content, '/content', errors);
      if (Number.isSafeInteger(value.size) && Buffer.byteLength(value.content, 'utf8') !== value.size) {
        errors.push(semanticError('/size', 'exact_utf8_byte_length_required'));
      }
      if (!Number.isSafeInteger(value.size)) errors.push(semanticError('/size', 'safe_integer_required'));
      if (!Number.isSafeInteger(value.lastModified)) {
        errors.push(semanticError('/lastModified', 'safe_integer_required'));
      }
    }
  }
  validateUnicodeString(value.symlinkTarget, '/symlinkTarget', 4096, errors);
}

function validateAgentToolSemantics(value, errors) {
  validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
  validateUnicodeString(value.origin?.harnessId, '/origin/harnessId', 128, errors);
  validateUnicodeString(value.origin?.provider, '/origin/provider', 128, errors);
  validateUnicodeString(value.thread?.threadId, '/thread/threadId', 128, errors);
  validateUnicodeString(value.thread?.turnId, '/thread/turnId', 128, errors);
  validateUnicodeString(value.tool?.toolCallId, '/tool/toolCallId', 512, errors);
  validateUnicodeString(value.tool?.name, '/tool/name', 128, errors);
  validateUnicodeString(value.tool?.nativeName, '/tool/nativeName', 128, errors);
  if (value.occurredAt !== value.timing?.terminalObservedAt) {
    errors.push(semanticError('/occurredAt', 'terminal_observed_time_required'));
  }
  if (value.timing?.argumentsReportedAt != null && value.timing?.argumentsObservedAt == null) {
    errors.push(semanticError('/timing/argumentsReportedAt', 'arguments_observed_time_required'));
  }
  if (value.timing?.argumentsObservedAt != null
    && value.timing.argumentsObservedAt < value.timing.announcedObservedAt) {
    errors.push(semanticError('/timing/argumentsObservedAt', 'fusion_receipt_order_required'));
  }
  if (value.timing?.terminalObservedAt != null
    && value.timing.terminalObservedAt < value.timing.announcedObservedAt) {
    errors.push(semanticError('/timing/terminalObservedAt', 'fusion_receipt_order_required'));
  }
  if (value.timing?.reconciledAt != null && value.tool?.status !== 'interrupted') {
    errors.push(semanticError('/timing/reconciledAt', 'interrupted_status_required'));
  }
  const edgeIds = new Set();
  for (let index = 0; index < (value.resources || []).length; index += 1) {
    const resource = value.resources[index];
    validateNormalizedPath(resource?.path, `/resources/${index}/path`, errors);
    if (resource?.edgeId && edgeIds.has(resource.edgeId)) {
      errors.push(semanticError(`/resources/${index}/edgeId`, 'unique_edge_required'));
    }
    if (resource?.edgeId) edgeIds.add(resource.edgeId);
    if (resource?.rejectionReason == null && resource?.path == null) {
      errors.push(semanticError(`/resources/${index}/path`, 'accepted_path_required'));
    }
    if (['outside_workspace', 'invalid_path'].includes(resource?.rejectionReason)
      && resource?.path != null) {
      errors.push(semanticError(`/resources/${index}/path`, 'rejected_path_must_be_omitted'));
    }
  }
}

function validateResourceObservationSemantics(value, errors) {
  validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
  validateUnicodeString(value.source?.threadId, '/source/threadId', 128, errors);
  validateUnicodeString(value.source?.turnId, '/source/turnId', 128, errors);
  validateUnicodeString(value.source?.toolCallId, '/source/toolCallId', 512, errors);
  validateUnicodeString(value.source?.harnessId, '/source/harnessId', 128, errors);
  validateNormalizedPath(value.resource?.path, '/resource/path', errors);
  if (value.observation?.state === 'bytes' && value.resource?.resourceId == null) {
    errors.push(semanticError('/resource/resourceId', 'bytes_resource_identity_required'));
  }
  if (value.observation?.state === 'absent' && value.resource?.resourceId != null) {
    errors.push(semanticError('/resource/resourceId', 'absent_resource_identity_forbidden'));
  }
  if (value.observation?.relation === 'first_observation'
    && value.observation?.previousSnapshotId != null) {
    errors.push(semanticError('/observation/previousSnapshotId', 'first_observation_has_no_previous'));
  }
  if (value.observation?.relation === 'changed'
    && value.observation?.previousSnapshotId == null) {
    errors.push(semanticError('/observation/previousSnapshotId', 'changed_requires_previous'));
  }
}

function validateAgentActivityCursor(value, instancePath, errors) {
  if (typeof value !== 'string') return;
  if (!/^[1-9][0-9]{0,19}$/u.test(value)
    || !Number.isSafeInteger(Number(value))
    || Number(value) <= 0) {
    errors.push(semanticError(instancePath, 'safe_integer_cursor_required'));
  }
}

function validateAgentActivitySemantics(value, errors) {
  validateUnicodeString(value.requestId, '/requestId', 128, errors);
  validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
  if (value.type === 'agent:activity:query') {
    validateUnicodeString(value.panel, '/panel', 128, errors);
    validateUnicodeString(value.threadId, '/threadId', 128, errors);
    validateUnicodeString(value.turnId, '/turnId', 128, errors);
    validateUnicodeString(value.toolCallId, '/toolCallId', 512, errors);
    validateUnicodeString(value.harnessId, '/harnessId', 128, errors);
    validateNormalizedPath(value.path, '/path', errors);
    if (value.folderPrefix === '') {
      // The exact empty string selects only root-level accepted resources.
    } else {
      validateNormalizedPath(value.folderPrefix, '/folderPrefix', errors);
    }
    validateUnicodeString(value.fileName, '/fileName', 255, errors);
    if (typeof value.fileName === 'string' && (
      value.fileName.includes('/')
      || value.fileName.includes('\\')
      || value.fileName.includes('\u0000')
      || value.fileName === '.'
      || value.fileName === '..'
      || nodePath.posix.basename(value.fileName) !== value.fileName
    )) errors.push(semanticError('/fileName', 'normalized_basename_required'));
    for (let index = 0; index < (value.toolNames || []).length; index += 1) {
      validateUnicodeString(value.toolNames[index], `/toolNames/${index}`, 128, errors);
    }
    if (typeof value.since === 'number' && !Number.isSafeInteger(value.since)) {
      errors.push(semanticError('/since', 'safe_integer_required'));
    }
    if (typeof value.until === 'number' && !Number.isSafeInteger(value.until)) {
      errors.push(semanticError('/until', 'safe_integer_required'));
    }
    if (Number.isSafeInteger(value.since) && Number.isSafeInteger(value.until) && value.since > value.until) {
      errors.push(semanticError('/until', 'ordered_time_range_required'));
    }
    validateAgentActivityCursor(value.cursor, '/cursor', errors);
    return;
  }
  if (value.type !== 'agent:activity:result') return;
  validateAgentActivityCursor(value.nextCursor, '/nextCursor', errors);
  for (let index = 0; index < (value.items || []).length; index += 1) {
    const item = value.items[index];
    const base = `/items/${index}`;
    validateUnicodeString(item?.workspaceId, `${base}/workspaceId`, 128, errors);
    validateUnicodeString(item?.threadId, `${base}/threadId`, 128, errors);
    validateUnicodeString(item?.turnId, `${base}/turnId`, 128, errors);
    validateUnicodeString(item?.harnessId, `${base}/harnessId`, 128, errors);
    validateUnicodeString(item?.toolCallId, `${base}/toolCallId`, 512, errors);
    validateUnicodeString(item?.toolName, `${base}/toolName`, 128, errors);
    if (item?.kind === 'tool_call') {
      validateUnicodeString(item?.provider, `${base}/provider`, 128, errors);
      validateUnicodeString(item?.nativeToolName, `${base}/nativeToolName`, 128, errors);
      if ((item?.resources?.changedCount ?? 0) > (item?.resources?.count ?? 0)) {
        errors.push(semanticError(`${base}/resources/changedCount`, 'changed_count_within_resource_count_required'));
      }
    }
    if (item?.resource) {
      validateNormalizedPath(item.resource.path, `${base}/resource/path`, errors);
      validateUnicodeString(item.resource.fileName, `${base}/resource/fileName`, 255, errors);
      if (item.resource.folderPath === '') {
        // Root-level resource summary.
      } else {
        validateNormalizedPath(item.resource.folderPath, `${base}/resource/folderPath`, errors);
      }
      const expectedFolder = nodePath.posix.dirname(item.resource.path) === '.'
        ? ''
        : nodePath.posix.dirname(item.resource.path);
      if (nodePath.posix.basename(item.resource.path) !== item.resource.fileName
        || expectedFolder !== item.resource.folderPath) {
        errors.push(semanticError(`${base}/resource`, 'canonical_path_components_required'));
      }
    }
    if (item?.detailRef) {
      validateUnicodeString(item.detailRef.toolCallId, `${base}/detailRef/toolCallId`, 512, errors);
      if (item.exchangeId !== item.detailRef.exchangeId || item.toolCallId !== item.detailRef.toolCallId) {
        errors.push(semanticError(`${base}/detailRef`, 'bound_exchange_tool_identity_required'));
      }
    }
    const hasExchange = item?.exchangeId != null;
    const hasDetail = item?.detailRef != null;
    if (hasExchange !== hasDetail) {
      errors.push(semanticError(`${base}/detailRef`, 'bound_detail_reference_required'));
    }
    if (item?.kind === 'tool_call') {
      const hasSaved = item.timing?.exchangeSavedAt != null;
      const hasBound = item.timing?.exchangeBoundAt != null;
      if (hasExchange !== hasSaved || hasExchange !== hasBound) {
        errors.push(semanticError(`${base}/timing`, 'bound_exchange_timing_required'));
      }
    }
  }
}

function validateKnownSemantics(schemaKey, value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return errors;

  if (schemaKey === 'agent.tool_completed') {
    validateAgentToolSemantics(value, errors);
  } else if (schemaKey === 'resource.state_observed') {
    validateResourceObservationSemantics(value, errors);
  } else if (schemaKey === 'resource.mutated' || schemaKey === 'file.command_accepted') {
    validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
    if (value.origin) {
      validateUnicodeString(value.origin.connectionId, '/origin/connectionId', 128, errors);
      if (value.origin.reportedUiContext) {
        validateUnicodeString(value.origin.reportedUiContext.viewId, '/origin/reportedUiContext/viewId', 128, errors);
        validateUnicodeString(value.origin.reportedUiContext.viewInstanceId, '/origin/reportedUiContext/viewInstanceId', 128, errors);
      }
    }
    if (value.resource) {
      validateNormalizedPath(value.resource.path, '/resource/path', errors);
      if (value.resource.access) {
        validateUnicodeString(value.resource.access.panel, '/resource/access/panel', 128, errors);
        validateNormalizedPath(value.resource.access.path, '/resource/access/path', errors);
      }
    }
    const detail = schemaKey === 'resource.mutated' ? value.mutation : value.intent;
    if (detail) {
      validateUnicodeString(detail.milestone, `/${schemaKey === 'resource.mutated' ? 'mutation' : 'intent'}/milestone`, 256, errors, { nonempty: false });
      if (schemaKey === 'file.command_accepted') {
        validateUnicodeString(detail.clientActionId, '/intent/clientActionId', 128, errors);
      }
    }
  } else if (schemaKey === 'resource:changed' || schemaKey === 'resource:refresh_required') {
    validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
    validateNormalizedPath(value.path, '/path', errors);
  } else if (schemaKey === 'file_save') {
    if (value.type === 'file_save') {
      validateUnicodeString(value.requestId, '/requestId', 128, errors);
      validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
      validateUnicodeString(value.panel, '/panel', 128, errors);
      validateNormalizedPath(value.path, '/path', errors);
      validateUnicodeString(value.content, '/content', 10 * 1024 * 1024, errors, { nonempty: false });
      validateNulFreeString(value.content, '/content', errors);
      validateUnicodeString(value.milestone, '/milestone', 256, errors, { nonempty: false });
      validateUnicodeString(value.clientActionId, '/clientActionId', 128, errors);
      if (value.reportedUiContext) {
        validateUnicodeString(value.reportedUiContext.viewId, '/reportedUiContext/viewId', 128, errors);
        validateUnicodeString(value.reportedUiContext.viewInstanceId, '/reportedUiContext/viewInstanceId', 128, errors);
      }
    } else if (value.type === 'file_save_response') {
      validateUnicodeString(value.requestId, '/requestId', 128, errors);
      validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
      validateUnicodeString(value.panel, '/panel', 128, errors);
      validateNormalizedPath(value.path, '/path', errors);
      validateNormalizedPath(value.canonicalPath, '/canonicalPath', errors);
      validateUnicodeString(value.error, '/error', 256, errors);
    }
  } else if (schemaKey === 'resource:provenance') {
    validateUnicodeString(value.requestId, '/requestId', 128, errors);
    validateUnicodeString(value.workspaceId, '/workspaceId', 128, errors);
    if (value.type === 'resource:provenance:query') {
      validateUnicodeString(value.panel, '/panel', 128, errors);
      validateNormalizedPath(value.path, '/path', errors);
      validateUnicodeString(value.fileName, '/fileName', 255, errors);
      if (typeof value.since === 'number' && !Number.isSafeInteger(value.since)) {
        errors.push(semanticError('/since', 'safe_integer_required'));
      }
      if (typeof value.fileName === 'string' && (
        value.fileName.includes('/')
        || value.fileName.includes('\\')
        || value.fileName.includes('\u0000')
        || value.fileName === '.'
        || value.fileName === '..'
        || nodePath.posix.basename(value.fileName) !== value.fileName
      )) errors.push(semanticError('/fileName', 'normalized_basename_required'));
      if (value.folderPrefix === '') {
        // The empty folder prefix names the panel/workspace root.
      } else {
        validateNormalizedPath(value.folderPrefix, '/folderPrefix', errors);
      }
    } else if (value.type === 'resource:provenance:result') {
      for (let index = 0; index < (value.items || []).length; index += 1) {
        const item = value.items[index];
        validateNormalizedPath(item?.canonicalPath, `/items/${index}/canonicalPath`, errors);
        validateUnicodeString(item?.ingress?.panel, `/items/${index}/ingress/panel`, 128, errors);
        validateNormalizedPath(item?.ingress?.path, `/items/${index}/ingress/path`, errors);
        validateUnicodeString(item?.origin?.connectionId, `/items/${index}/origin/connectionId`, 128, errors);
      }
    }
  } else if (schemaKey === 'agent:activity') {
    validateAgentActivitySemantics(value, errors);
  } else if (schemaKey === 'file_tree' || schemaKey === 'file_content') {
    validateFileReadSemantics(schemaKey, value, errors);
  }

  return errors;
}

function createPayloadValidator(definition, schemaKey) {
  assertSchemaDefinition(definition);
  const validateJsonSchema = createAjv().compile(definition);
  return (value) => {
    const schemaValid = validateJsonSchema(value);
    const schemaErrors = schemaValid ? [] : (validateJsonSchema.errors || []).map((error) => ({
      instancePath: error.instancePath,
      keyword: error.keyword,
      code: error.message,
    }));
    const semanticErrors = validateKnownSemantics(schemaKey, value);
    const errors = [...schemaErrors, ...semanticErrors];
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  };
}

module.exports = {
  assertSchemaDefinition,
  createPayloadValidator,
  validateKnownSemantics,
};
