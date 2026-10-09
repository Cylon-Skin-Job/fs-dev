'use strict';

const registryServiceDefault = require('../workspace/registry-service');
const { COLOR_PATTERN } = require('../office/palette-codec');
const { ERROR_MESSAGES } = require('../office/palette-errors');
const { createPaletteService } = require('../office/palette-service');

const MAX_REQUEST_ID_BYTES = 128;

function validRequestId(value) {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= MAX_REQUEST_ID_BYTES;
}

function validWorkspaceId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function safeCode(error) {
  return error && Object.hasOwn(ERROR_MESSAGES, error.code) ? error.code : 'READ_FAILED';
}

function protocolState(result, source) {
  return {
    customColors: result.visibleColors,
    syncEnabled: result.syncEnabled,
    source,
    availability: result.availability,
    syncStatus: 'ok',
  };
}

function unavailableState(error) {
  return {
    customColors: [],
    syncEnabled: typeof error?.syncEnabled === 'boolean' ? error.syncEnabled : true,
    source: 'error',
    availability: 'unavailable',
    syncStatus: 'degraded',
  };
}

function createOfficePaletteHandlers(options = {}) {
  const { ws, session } = options;
  const registryService = options.registryService || registryServiceDefault;
  const service = options.service || createPaletteService({ registryService });

  function send(payload) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
  }

  function sendError({ requestId, workspaceId, operation, error, code }) {
    const safe = code || safeCode(error);
    send({
      type: 'office:palette_error',
      ...(requestId ? { requestId } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      operation,
      code: safe,
      message: ERROR_MESSAGES[safe],
      ...(error ? { state: unavailableState(error) } : {}),
    });
  }

  async function validateRequest(message, operation) {
    const requestId = validRequestId(message?.requestId) ? message.requestId : null;
    const workspaceId = validWorkspaceId(message?.workspaceId) ? message.workspaceId : null;
    if (!requestId || !workspaceId) {
      sendError({ requestId, workspaceId, operation, code: 'INVALID_REQUEST' });
      return null;
    }
    let workspace;
    try {
      workspace = await registryService.getById(workspaceId);
    } catch {
      sendError({ requestId, workspaceId, operation, code: 'READ_FAILED' });
      return null;
    }
    if (!workspace) {
      sendError({ requestId, workspaceId, operation, code: 'UNKNOWN_WORKSPACE' });
      return null;
    }
    if (!session || session.currentWorkspaceId !== workspaceId) {
      sendError({ requestId, workspaceId, operation, code: 'WORKSPACE_NOT_ACTIVE' });
      return null;
    }
    return { requestId, workspaceId };
  }

  async function execute(message, operation, invoke) {
    const request = await validateRequest(message, operation);
    if (!request) return;
    try {
      const result = await invoke(request.workspaceId);
      if (!session || session.currentWorkspaceId !== request.workspaceId) {
        sendError({ ...request, operation, code: 'WORKSPACE_NOT_ACTIVE' });
        return;
      }
      send({
        type: 'office:palette_state',
        ...request,
        ...protocolState(result, operation === 'get' ? 'request' : 'mutation'),
        operation,
      });
    } catch (error) {
      if (!session || session.currentWorkspaceId !== request.workspaceId) return;
      sendError({ ...request, operation, error });
    }
  }

  function colorMutation(message, operation) {
    return execute(message, operation, async (workspaceId) => {
      if (typeof message?.color !== 'string' || !COLOR_PATTERN.test(message.color)) {
        const error = new Error();
        error.code = 'INVALID_REQUEST';
        throw error;
      }
      return service[operation](workspaceId, message.color.toLowerCase());
    });
  }

  return Object.freeze({
    'office:palette_get': (message) => execute(message, 'get', (workspaceId) => service.get(workspaceId)),
    'office:palette_add': (message) => colorMutation(message, 'add'),
    'office:palette_remove': (message) => colorMutation(message, 'remove'),
    'office:palette_set_sync': (message) => execute(message, 'set_sync', (workspaceId) => {
      if (typeof message?.enabled !== 'boolean') {
        const error = new Error();
        error.code = 'INVALID_REQUEST';
        throw error;
      }
      return service.setSync(workspaceId, message.enabled);
    }),
  });
}

module.exports = { MAX_REQUEST_ID_BYTES, createOfficePaletteHandlers, validRequestId };
