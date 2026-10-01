/** Adapt canonical chat ingress to existing prompt, runtime, and provider owners. */
const { v4: generateId } = require('uuid');
const { ThreadWebSocketHandler, threadRuntimeController } = require('../thread');
const { getWireForThread, sendToWire } = require('../wire/process-manager');
const { spawnAndSetupWire } = require('./thread-ws-handlers');
const { resolvePrompt } = require('../prompts/prompt-registry');
const { normalizePortableHarnessConfig } = require('../thread/thread-harness-config-policy');
const { logTemporaryChatBoundary } = require('../logging');
const { denyThreadMutation, requireTrustedThreadAuthority } = require('./privileged-thread-guard');
const { isWorkspaceOperationLeaseError, runWorkspaceOperation } = require('./workspace-operation-lease');

function createChatRuntimeWsHandlers({ ws, session, wireLifecycle, handleCanonicalHarnessEvent }) {
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;
  const captureOwnedProviderBinding = (requestedThreadId = null) => {
    const binding = ThreadWebSocketHandler.captureActivationBinding(ws, session);
    if (!binding || !ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding)) return null;
    const state = binding.state;
    const activeThreadId = Object.prototype.hasOwnProperty.call(state, 'activatedThreadId')
      ? state.activatedThreadId
      : state.threadId;
    const threadId = requestedThreadId || activeThreadId;
    if (typeof threadId !== 'string' || !threadId) return null;
    const manager = state.threadManager;
    const managedSession = typeof manager?.getSession === 'function'
      ? manager.getSession(threadId)
      : null;
    const wire = getWireForThread(threadId, binding);
    if (!managedSession || managedSession.ws !== ws || !wire
      || managedSession.wireProcess !== wire) return null;
    return { ...binding, threadId, manager, managedSession, wire };
  };

  const runOwnedProviderOperation = async (requestedThreadId, operation) => {
    const binding = captureOwnedProviderBinding(requestedThreadId);
    if (!binding) {
      denyThreadMutation(ws);
      return null;
    }
    try {
      return await runWorkspaceOperation(
        ws,
        () => {
          const current = captureOwnedProviderBinding(binding.threadId);
          return Boolean(current
            && current.state === binding.state
            && current.managedSession === binding.managedSession
            && current.wire === binding.wire);
        },
        () => operation(binding),
      );
    } catch (error) {
      if (!isWorkspaceOperationLeaseError(error)) throw error;
      denyThreadMutation(ws);
      return null;
    }
  };

  async function handlePromptResolve(clientMsg) {
      if (clientMsg.type === 'prompt:resolve') {
        try {
          const resolved = resolvePrompt(clientMsg.promptId, clientMsg.variables || {});
          ws.send(JSON.stringify({
            type: 'prompt:resolved',
            requestId: clientMsg.requestId || null,
            promptId: resolved.promptId,
            content: resolved.content,
            metadata: resolved.metadata,
            frontmatter: resolved.frontmatter,
            path: resolved.path,
          }));
        } catch (err) {
          void err;
          ws.send(JSON.stringify({
            type: 'prompt:resolve_error',
            requestId: clientMsg.requestId || null,
            promptId: null,
            message: 'Prompt resolution failed',
          }));
        }
        return;
      }

  }

  async function handleRuntime(clientMsg) {
      // Initialize can be called manually (but we also auto-initialize)
      if (clientMsg.type === 'initialize') {
        if (!session.wire) {
          ws.send(JSON.stringify({ type: 'error', message: 'No thread open. Create or open a thread first.' }));
          return;
        }
        const id = generateId();
        sendToWire(session.wire, 'initialize', {
          protocol_version: '1.4',
          client: { name: 'fusion-studio', version: '0.1.0' },
          capabilities: { supports_question: true }
        }, id);
        return;
      }

      // Prompt - route through server-owned thread runtime acceptance
      if (clientMsg.type === 'prompt') {
        logTemporaryChatBoundary('prompt_frame', {
          requestId: clientMsg.requestId, hasThreadId: Boolean(clientMsg.threadId),
        });
        if (!requireTrustedThreadAuthority(ws, session)) {
          logTemporaryChatBoundary('prompt_denied', { requestId: clientMsg.requestId });
          return;
        }
        if (typeof clientMsg.requestId !== 'string'
          || !/^[A-Za-z0-9_-]{8,128}$/.test(clientMsg.requestId)) {
          ws.send(JSON.stringify({ type: 'error', code: 'invalid_request_id',
            message: 'Invalid prompt request ID', threadId: clientMsg.threadId,
            workspaceId: session.currentWorkspaceId,
            scope: 'project' }));
          return;
        }
        const harnessConfig = normalizePortableHarnessConfig(clientMsg.harnessConfig);
        if (!harnessConfig.ok) {
          ws.send(JSON.stringify({ type: 'error', code: 'invalid_prompt',
            message: 'Prompt selection unavailable', threadId: clientMsg.threadId,
            workspaceId: session.currentWorkspaceId,
            scope: 'project',
            ...(clientMsg.requestId ? { requestId: clientMsg.requestId } : {}) }));
          return;
        }
        const acceptedPrompt = harnessConfig.value === undefined
          ? clientMsg
          : { ...clientMsg, harnessConfig: harnessConfig.value };
        const threadState = ThreadWebSocketHandler.getState(ws);
        const binding = {
          state: threadState,
          session,
          projectRoot: session.projectRoot,
          workspaceId: session.currentWorkspaceId,
          workspaceEpoch: session.workspaceEpoch,
        };
        if (typeof binding.workspaceEpoch !== 'string' || !binding.workspaceEpoch
          || !ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding)) {
          logTemporaryChatBoundary('prompt_denied', { requestId: clientMsg.requestId });
          denyThreadMutation(ws);
          return;
        }
        logTemporaryChatBoundary('prompt_routed', { requestId: clientMsg.requestId });
        try {
          await runWorkspaceOperation(
            ws,
            () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
            () => require('../thread/prompt-submission-service').withAttemptLock({
              workspaceId: binding.workspaceId,
              threadId: acceptedPrompt.threadId,
              requestId: acceptedPrompt.requestId,
            }, () => threadRuntimeController.acceptPromptThroughRuntime({
              ws,
              session,
              clientMsg: acceptedPrompt,
              wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
              projectRoot: binding.projectRoot,
              spawnAndSetupWire,
              handleCanonicalHarnessEvent,
            })),
          );
        } catch (error) {
          if (!isWorkspaceOperationLeaseError(error)) throw error;
          logTemporaryChatBoundary('prompt_lease_denied', { requestId: clientMsg.requestId });
          denyThreadMutation(ws);
        }
        return;
      }

      if (clientMsg.type === 'turn:stop') {
        if (!requireTrustedThreadAuthority(ws, session)) return;
        await runOwnedProviderOperation(clientMsg.threadId, () => (
          threadRuntimeController.stopRuntimeTurn({
            ws,
            session,
            clientMsg,
            handleCanonicalHarnessEvent,
          })
        ));
        return;
      }

      if (clientMsg.type === 'response') {
        if (!requireTrustedThreadAuthority(ws, session)) return;
        await runOwnedProviderOperation(clientMsg.threadId, ({ wire }) => {
          sendToWire(wire, 'response', clientMsg.payload, clientMsg.requestId);
        });
        return;
      }

  }

  return { handlePromptResolve, handleRuntime };
}

module.exports = { createChatRuntimeWsHandlers };
