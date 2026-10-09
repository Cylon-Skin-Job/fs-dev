'use strict';

const { UUID_PATTERN } = require('../file-mutations/validation-patterns');
const {
  FileViewerReadError,
  createFileViewerReadService,
  errorMessage,
} = require('../file-reads/file-viewer-read-service');
const {
  currentWorkspacePair,
  pendingWorkspacePair,
  sendWorkspaceBoundReply,
} = require('./workspace-session');

const REFERENCES = Object.freeze({
  tree: Object.freeze({ schemaKey: 'file_tree', schemaVersion: 1, definitionKind: 'query' }),
  content: Object.freeze({ schemaKey: 'file_content', schemaVersion: 1, definitionKind: 'query' }),
});
const RESPONSE_TYPES = Object.freeze({
  tree: 'file_tree_response',
  content: 'file_content_response',
});
const REQUEST_TYPES = Object.freeze({
  tree: 'file_tree_request',
  content: 'file_content_request',
});
const PROTOCOL_ERRORS = Object.freeze({
  tree: Object.freeze({
    invalid_request: 'The file tree request is invalid.',
    workspace_unavailable: 'The workspace is not available.',
    stale_workspace: 'The workspace changed before this read was accepted.',
  }),
  content: Object.freeze({
    invalid_request: 'The file content request is invalid.',
    workspace_unavailable: 'The workspace is not available.',
    stale_workspace: 'The workspace changed before this read was accepted.',
  }),
});

function scalarStringWithin(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes) return false;
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

function recoverRequestId(message) {
  return scalarStringWithin(message?.requestId, 128) ? message.requestId : undefined;
}

function validEnvelope(kind, message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  return message.type === REQUEST_TYPES[kind]
    && message.version === 1
    && scalarStringWithin(message.requestId, 128)
    && scalarStringWithin(message.workspaceId, 128)
    && typeof message.workspaceEpoch === 'string'
    && UUID_PATTERN.test(message.workspaceEpoch);
}

function protocolError(kind, code, extra = {}) {
  return Object.freeze({
    type: RESPONSE_TYPES[kind],
    version: 1,
    success: false,
    code,
    error: PROTOCOL_ERRORS[kind][code],
    ...extra,
  });
}

function hasInactiveSchema(errors) {
  return errors?.some((error) => error?.code === 'schema_inactive');
}

function createFileViewerReadRoute({
  registryAccess,
  readService = createFileViewerReadService(),
  sendReply = sendWorkspaceBoundReply,
  writeDiagnostic = () => {},
} = {}) {
  if (typeof registryAccess?.validatePayload !== 'function') {
    throw new TypeError('registry validation access is required');
  }
  if (typeof readService?.readTree !== 'function' || typeof readService?.readContent !== 'function') {
    throw new TypeError('file-viewer read service is required');
  }

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  function closeInvalidAuthority(ws, reason = 'file viewer read authority unavailable') {
    diagnose('file_viewer_read_schema_unavailable');
    try { ws.close(1011, reason); } catch (_error) {}
  }

  async function sendValidated(kind, ws, session, value, transportPair = null) {
    const validation = await registryAccess.validatePayload(REFERENCES[kind], value);
    if (!validation.valid) {
      diagnose('file_viewer_read_response_schema_invalid');
      try { ws.close(1011, 'file viewer read response invalid'); } catch (_error) {}
      return false;
    }
    return sendReply(ws, session, value, transportPair);
  }

  async function handleValidated(kind, { ws, session, message }) {
    const requestId = recoverRequestId(message);
    if (!validEnvelope(kind, message)) {
      return sendValidated(kind, ws, session, protocolError(
        kind,
        'invalid_request',
        requestId ? { requestId } : {},
      ), pendingWorkspacePair(session));
    }

    const pair = currentWorkspacePair(session);
    if (!pair) {
      return sendValidated(kind, ws, session, protocolError(kind, 'workspace_unavailable', {
        requestId: message.requestId,
      }), pendingWorkspacePair(session));
    }
    if (message.workspaceId !== pair.workspaceId || message.workspaceEpoch !== pair.workspaceEpoch) {
      return sendValidated(kind, ws, session, protocolError(kind, 'stale_workspace', {
        requestId: message.requestId,
        ...pair,
      }));
    }

    const validation = await registryAccess.validatePayload(REFERENCES[kind], message);
    if (!validation.valid) {
      if (hasInactiveSchema(validation.errors)) {
        closeInvalidAuthority(ws);
        return false;
      }
      return sendValidated(kind, ws, session, protocolError(kind, 'invalid_request', {
        requestId: message.requestId,
        ...pair,
      }));
    }

    try {
      const result = kind === 'tree'
        ? await readService.readTree({
          workspaceId: pair.workspaceId,
          path: message.path,
          includeHiddenFolders: message.includeHiddenFolders === true,
        })
        : await readService.readContent({ workspaceId: pair.workspaceId, path: message.path });
      return sendValidated(kind, ws, session, Object.freeze({
        type: RESPONSE_TYPES[kind],
        version: 1,
        success: true,
        requestId: message.requestId,
        ...pair,
        panel: 'file-viewer',
        path: message.path,
        ...result,
      }));
    } catch (error) {
      const code = error instanceof FileViewerReadError ? error.code : 'read_failed';
      return sendValidated(kind, ws, session, Object.freeze({
        type: RESPONSE_TYPES[kind],
        version: 1,
        success: false,
        code,
        requestId: message.requestId,
        ...pair,
        panel: 'file-viewer',
        path: message.path,
        error: errorMessage(kind, code),
      }));
    }
  }

  async function handle(kind, input) {
    try {
      return await handleValidated(kind, input);
    } catch (_error) {
      diagnose('file_viewer_read_route_failed');
      closeInvalidAuthority(input?.ws, 'file viewer read processing failed');
      return false;
    }
  }

  return Object.freeze({
    handleTree: (input) => handle('tree', input),
    handleContent: (input) => handle('content', input),
  });
}

module.exports = {
  REFERENCES,
  createFileViewerReadRoute,
  recoverRequestId,
  validEnvelope,
};
