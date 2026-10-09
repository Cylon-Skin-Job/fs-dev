/**
 * @module thread-ws-handlers
 * @role Per-connection handlers for all thread: WebSocket messages.
 *
 * Factory — call once per connection inside createClientMessageRouter.
 * Returns a handler map keyed by message type. The router dispatches
 * any clientMsg.type that starts with 'thread:' through this map.
 *
 * Owns the wire-spawn sequence for thread:open-assistant. Thin delegations to
 * ThreadWebSocketHandler for list/search, plus the canonical `thread:action`
 * route (rename/delete/copy_link/resolve_link/view_markdown/
 * set_harness_selection). The raw `thread:copyLink` and `thread:touch` routes
 * were removed with no aliases (slices 01B/01C).
 */

const {
  RUNTIME_STATES,
  ThreadWebSocketHandler,
  threadRuntimeController,
  threadRuntimeManager,
} = require('../thread');
const { spawnAndSetupWire, resumeLiveProvider } = require('./thread-provider-binding');
const { boundedActionError } = require('./thread-action-protocol');
const { createThreadActionHandler } = require('./thread-action-handler');
const { normalizeOpenAssistantRequest } = require('../thread/thread-harness-config-policy');
const {
  denyThreadFork,
  denyThreadMutation,
  requireTrustedThreadAuthority,
} = require('./privileged-thread-guard');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('./workspace-operation-lease');

/**
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session
 * @param {{ awaitHarnessReady: Function, initializeWire: Function, setupWireHandlers: Function }} deps.wireLifecycle
 * @param {string} deps.projectRoot
 * @param {Function} [deps.getWorkspaceRecipients] - other-window delivery provider
 * @returns {Record<string, (msg: object) => Promise<void>>}
 */
function createThreadWsHandlers({
  ws, session, wireLifecycle, projectRoot, getWorkspaceRecipients = () => [],
}) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  const denyOpenAssistant = (requestId) => {
    // The trusted caller must receive an exact rejection for a correlated
    // create. Keep the public/untrusted denial generic and echo only a bounded
    // request identifier, never an unvalidated caller payload.
    if (typeof requestId !== 'string' || !requestId
      || Buffer.byteLength(requestId, 'utf8') > 128) return denyThreadMutation(ws);
    ws.send(JSON.stringify({ type: 'error', requestId,
      code: 'THREAD_MUTATION_DENIED', message: 'Thread mutation denied' }));
    return false;
  };

  const currentBinding = () => {
    const state = ThreadWebSocketHandler.getState(ws);
    const manager = state?.threadManager;
    const currentRoot = session.projectRoot;
    const currentWorkspaceId = session.currentWorkspaceId;
    const currentWorkspaceEpoch = session.workspaceEpoch;
    if (!manager || typeof currentRoot !== 'string' || !currentRoot
      || typeof currentWorkspaceId !== 'string' || !currentWorkspaceId
      || typeof currentWorkspaceEpoch !== 'string' || !currentWorkspaceEpoch
      || (session.workspaceBindingState !== undefined
        && session.workspaceBindingState !== 'active')
      || manager.projectRoot !== currentRoot
      || manager.workspaceId !== currentWorkspaceId) {
      return null;
    }
    return {
      state,
      session,
      projectRoot: currentRoot,
      workspaceId: currentWorkspaceId,
      workspaceEpoch: currentWorkspaceEpoch,
    };
  };

  const runBoundMutation = async (binding, operation, openAssistantRequestId = null) => {
    try {
      return await runWorkspaceOperation(
        ws,
        () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
        operation,
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      if (openAssistantRequestId) denyOpenAssistant(openAssistantRequestId);
      else denyThreadMutation(ws);
      return null;
    }
  };

  const denyUnavailableRead = () => {
    ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
  };

  const runBoundRead = async (binding, operation) => {
    if (!binding) {
      denyUnavailableRead();
      return null;
    }
    try {
      return await runWorkspaceOperation(
        ws,
        () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
        operation,
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      denyUnavailableRead();
      return null;
    }
  };


  return {
    async 'thread:open'(clientMsg) {
      const binding = currentBinding();
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadOpen(ws, clientMsg));
    },

    async 'thread:open-assistant'(clientMsg) {
      // Existing assistant resume marks the thread resumed and advances its
      // durable MRU timestamp, so this route is privileged for both branches.
      // Passive thread:open remains available to untrusted standalone clients.
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const acceptedRequest = normalizeOpenAssistantRequest(clientMsg);
      if (!acceptedRequest) {
        denyThreadMutation(ws);
        return;
      }
      const binding = currentBinding();
      if (!binding) {
        denyOpenAssistant(acceptedRequest.requestId);
        return;
      }
      console.log('[WS] thread:open-assistant received, threadId:', acceptedRequest.threadId?.slice(0, 8) || '(new)');

      await runBoundMutation(binding, async () => {
        if (acceptedRequest.threadId) {
          const runtimeKey = {
            workspaceId: binding.workspaceId,
            projectRoot: binding.projectRoot,
            workspaceEpoch: binding.workspaceEpoch,
            scope: 'project',
            threadId: acceptedRequest.threadId,
          };
          const existingSession = binding.state.threadManager.getSession?.(acceptedRequest.threadId);
          if (threadRuntimeManager.getRuntimeState(runtimeKey) === RUNTIME_STATES.STOPPING
            || existingSession?.state === 'stopping') {
            denyOpenAssistant(acceptedRequest.requestId);
            return;
          }
        }
        // Dispatcher: create or resume based on whether msg.threadId exists.
        const threadId = await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, acceptedRequest);
        if (!threadId) return;

        // Creation/resume, its response frames, and provider admission are one
        // workspace-leased operation. A queued workspace bind cannot split
        // durable metadata from activation.
        const { withSessionAdmission } = require('../thread-groups/session-transactions');
        await withSessionAdmission(binding.workspaceId, threadId, async () => {
          if (await resumeLiveProvider({ ws, session, threadId, binding })) return;
          await spawnAndSetupWire({
            ws,
            session,
            wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
            threadId,
            projectRoot: binding.projectRoot,
            expectedBinding: binding,
          });
        });
      }, acceptedRequest.requestId);
    },

    'thread:action': createThreadActionHandler({ ws, session, currentBinding, runBoundMutation, getWorkspaceRecipients }),

    async 'thread:fork'() {
      // SPEC-00 owns the unconditional unavailability of Fork. Thread Group
      // Foundation removes every Fork capability, composer, service, config,
      // and provider argument while this accepted denial remains the sole
      // bounded response and never reaches a service effect.
      denyThreadFork(ws);
    },

    async 'thread:warm'(clientMsg) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      if (!binding) {
        denyThreadMutation(ws);
        return;
      }
      await runBoundMutation(binding, () => threadRuntimeController.warmRuntimeForIntent({
        ws,
        session,
        clientMsg,
        wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
        projectRoot: binding.projectRoot,
        spawnAndSetupWire,
      }));
    },

    async 'thread:search'(clientMsg) {
      const binding = currentBinding();
      if (!binding) {
        denyUnavailableRead();
        return;
      }
      if (clientMsg.workspaceId !== undefined
        && clientMsg.workspaceId !== binding.workspaceId) {
        denyUnavailableRead();
        return;
      }
      await runBoundRead(binding, () => ThreadWebSocketHandler.handleThreadSearch(ws, {
        ...clientMsg,
        workspaceId: binding.workspaceId,
      }));
    },

    async 'thread:list'(clientMsg = {}) {
      const binding = currentBinding();
      await runBoundRead(binding, () => {
        let viewId = null;
        if (clientMsg.viewId !== undefined && clientMsg.viewId !== null) {
          const target = binding?.state?.threadManager?.threadGroups?.resolveViewTarget(clientMsg.viewId);
          if (!target || !target.ok) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'view_not_found',
              message: 'Requested view is not available',
            }));
            return;
          }
          viewId = target.viewId;
        }
        return ThreadWebSocketHandler.sendThreadList(ws, viewId);
      });
    },

    /**
     * `thread:members` — the registered qualified read for one validated group
     * (`SPEC-04 §8`). Workspace is server-derived from the bound connection and
     * the server returns the group's authoritative nullable view. It returns
     * ordered member projections only; transcript content is never included.
     */
    async 'thread:members'(clientMsg = {}) {
      if (!requireTrustedThreadAuthority(ws, session)) return;
      const binding = currentBinding();
      await runBoundRead(binding, async () => {
        const service = binding?.state?.threadManager?.threadGroups;
        if (!service || typeof service.listGroupMembers !== 'function') {
          ws.send(JSON.stringify({
            type: 'thread:members:error',
            threadGroupId: clientMsg.threadGroupId ?? null,
            code: 'action_unavailable',
            message: 'Thread members are unavailable',
          }));
          return;
        }
        let outcome;
        try {
          outcome = await service.listGroupMembers({
            threadGroupId: clientMsg.threadGroupId ?? null,
          });
        } catch (_error) {
          ws.send(JSON.stringify({
            type: 'thread:members:error',
            threadGroupId: clientMsg.threadGroupId ?? null,
            code: 'members_failed',
            message: 'Thread members are unavailable',
          }));
          return;
        }
        if (!outcome?.ok) {
          const code = outcome?.code || 'not_found';
          ws.send(JSON.stringify({
            type: 'thread:members:error',
            threadGroupId: clientMsg.threadGroupId ?? null,
            code,
            message: boundedActionError(code),
          }));
          return;
        }
        ws.send(JSON.stringify({
          type: 'thread:members',
          threadGroupId: outcome.result.threadGroupId,
          workspaceId: outcome.result.workspaceId,
          viewId: outcome.result.viewId,
          members: outcome.result.members,
        }));
      });
    },
  };
}

module.exports = { createThreadWsHandlers, spawnAndSetupWire };
