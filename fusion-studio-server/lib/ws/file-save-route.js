'use strict';

const { FIXED_ERRORS } = require('../file-mutations/save-controller');
const { UUID_PATTERN } = require('../file-mutations/validation-patterns');
const {
  currentWorkspacePair,
  sendWorkspaceBoundReply,
} = require('./workspace-session');

const SCHEMA_REFERENCE = Object.freeze({
  schemaKey: 'file_save',
  schemaVersion: 1,
  definitionKind: 'command',
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
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function independentlyValidRequestId(value) {
  return scalarStringWithin(value, 128);
}

function validEnvelope(message) {
  return message?.type === 'file_save'
    && message.version === 1
    && independentlyValidRequestId(message.requestId)
    && scalarStringWithin(message.workspaceId, 128)
    && typeof message.workspaceEpoch === 'string'
    && UUID_PATTERN.test(message.workspaceEpoch);
}

function response(errorCode, extra = {}) {
  return Object.freeze({
    type: 'file_save_response',
    version: 1,
    success: false,
    outcome: 'rejected',
    errorCode,
    error: FIXED_ERRORS[errorCode],
    retrySafe: true,
    ...extra,
  });
}

function hasInactiveSchema(errors) {
  return errors?.some((error) => error?.code === 'schema_inactive');
}

function classifyContentError(errors) {
  const semanticCodes = new Set(
    (errors || [])
      .filter((error) => error?.instancePath === '/content' && error?.keyword === 'fusionSemantic')
      .map((error) => error.code),
  );
  if (semanticCodes.has('utf8_bytes_exceed_10485760')) return 'too_large';
  if (semanticCodes.has('nul_not_allowed') || semanticCodes.has('unicode_scalar_required')) {
    return 'unsupported_text';
  }
  return null;
}

function createFileSaveRoute({
  registryAccess,
  fileSaveOwner,
  sendReply = sendWorkspaceBoundReply,
  writeDiagnostic = () => {},
} = {}) {
  if (typeof registryAccess?.validatePayload !== 'function') {
    throw new TypeError('registry validation access is required');
  }
  if (typeof fileSaveOwner?.save !== 'function') throw new TypeError('file-save owner is required');

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  function closeInvalidAuthority(ws) {
    diagnose('file_save_schema_unavailable');
    try { ws.close(1011, 'file save authority unavailable'); } catch (_error) {}
  }

  async function sendValidated(ws, session, value) {
    const validation = await registryAccess.validatePayload(SCHEMA_REFERENCE, value);
    if (!validation.valid) {
      diagnose('file_save_response_schema_invalid');
      try { ws.close(1011, 'file save response invalid'); } catch (_error) {}
      return false;
    }
    return sendReply(ws, session, value);
  }

  async function handleValidatedFileSave({ ws, session, message }) {
    const requestId = independentlyValidRequestId(message?.requestId) ? message.requestId : undefined;
    if (!validEnvelope(message)) {
      return sendValidated(ws, session, response('invalid_request', requestId ? { requestId } : {}));
    }

    const pair = currentWorkspacePair(session);
    if (!pair) {
      return sendValidated(ws, session, response('workspace_unavailable', { requestId: message.requestId }));
    }
    if (message.workspaceId !== pair.workspaceId || message.workspaceEpoch !== pair.workspaceEpoch) {
      return sendValidated(ws, session, response('stale_workspace', {
        requestId: message.requestId,
        ...pair,
      }));
    }

    const validation = await registryAccess.validatePayload(SCHEMA_REFERENCE, message);
    if (!validation.valid) {
      if (hasInactiveSchema(validation.errors)) {
        closeInvalidAuthority(ws);
        return false;
      }
      const contentErrorCode = classifyContentError(validation.errors);
      if (contentErrorCode) {
        // Confirm that content is the sole invalid field through the same
        // locked registry authority before returning its more precise code.
        const withoutInvalidContent = await registryAccess.validatePayload(
          SCHEMA_REFERENCE,
          { ...message, content: '' },
        );
        if (hasInactiveSchema(withoutInvalidContent.errors)) {
          closeInvalidAuthority(ws);
          return false;
        }
        if (withoutInvalidContent.valid) {
          return sendValidated(ws, session, response(contentErrorCode, {
            requestId: message.requestId,
            ...pair,
            panel: message.panel,
            path: message.path,
          }));
        }
      }
      return sendValidated(ws, session, response('invalid_request', {
        requestId: message.requestId,
        ...pair,
      }));
    }

    const result = await fileSaveOwner.save({
      session,
      capturedWorkspacePair: pair,
      intent: {
        requestId: message.requestId,
        expectedWorkspaceId: message.workspaceId,
        expectedWorkspaceEpoch: message.workspaceEpoch,
        panel: message.panel,
        path: message.path,
        content: message.content,
        saveReason: message.reason,
        milestone: message.milestone,
        clientActionId: message.clientActionId,
        reportedUiContext: message.reportedUiContext,
      },
    });
    return sendValidated(ws, session, result);
  }

  async function handleFileSave(input) {
    try {
      return await handleValidatedFileSave(input);
    } catch (_error) {
      diagnose('file_save_route_failed');
      try { input?.ws?.close(1011, 'file save processing failed'); } catch (_closeError) {}
      return false;
    }
  }

  return Object.freeze({ handleFileSave });
}

module.exports = {
  SCHEMA_REFERENCE,
  createFileSaveRoute,
  classifyContentError,
  independentlyValidRequestId,
};
