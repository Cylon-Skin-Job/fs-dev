/**
 * Client Message Router — dispatches incoming WebSocket client messages.
 *
 * Extracted from server.js per SPEC-01f. Handles the client message
 * switch for thread lifecycle (open-assistant / rename / delete /
 * copyLink / list), file explorer (tree / content / recent), panel
 * management (set_panel), wire protocol (initialize / prompt /
 * response), robin system panel (fusion:*), clipboard (clipboard:*),
 * and harness admin (harness:get_mode / set_mode / rollback / list /
 * check_install).
 *
 * Also handles ws.on('close') for per-connection cleanup.
 *
 * Per-connection factory. Called once per WebSocket connection inside
 * wss.on('connection'), after all the other factories have been
 * created (wire message router, wire lifecycle, file explorer).
 * Closes over ws, session, connectionId, projectRoot, and the
 * per-connection helpers.
 *
 * Architectural note: most handlers are thin delegations to already-
 * extracted modules. Thread, harness, workspace-request, and folder
 * handlers are delegated via per-connection sub-factories.
 */

const path = require('path');
const { v4: generateId } = require('uuid');

const { ThreadWebSocketHandler, threadRuntimeController } = require('../thread');
const { getWireForThread, sendToWire } = require('../wire/process-manager');
const views = require('../views');
const registry = require('../workspace/registry-service');
const { redactWsMessage } = require('./redaction-map');
const { createThreadWsHandlers, spawnAndSetupWire } = require('./thread-ws-handlers');
const { createHarnessWsHandlers } = require('./harness-ws-handlers');
const { createChatTurnMetadataHandlers } = require('./chat-turn-metadata-handlers');
const { createChatTurnDiagnosticHandlers } = require('./chat-turn-diagnostic-handlers');
const { createWorkspaceRequestHandlers } = require('./workspace-request-handlers');
const { resolvePrompt } = require('../prompts/prompt-registry');
const { ClientFrameError, decodeClientTextFrame } = require('./client-frame-decoder');
const { runWithRequestDiagnosticBoundary } = require('./request-diagnostic-context');
const { normalizePortableHarnessConfig } = require('../thread/thread-harness-config-policy');
const {
  denyThreadMutation,
  requireTrustedThreadAuthority,
} = require('./privileged-thread-guard');
const {
  isWorkspaceOperationLeaseError,
  runWorkspaceOperation,
} = require('./workspace-operation-lease');

/**
 * Create a per-connection client message router.
 *
 * @param {object} deps
 * @param {import('ws').WebSocket} deps.ws
 * @param {object} deps.session - per-connection session state (mutated)
 * @param {string} deps.connectionId
 * @param {string} deps.projectRoot
 * @param {object} deps.fileExplorer - from createFileExplorerHandlers (01a)
 * @param {{ awaitHarnessReady: Function, initializeWire: Function, setupWireHandlers: Function }} deps.wireLifecycle - from createWireLifecycle (01c)
 * @param {Map} deps.sessions - server.js module-level sessions Map (for close handler)
 * @param {Function} deps.setSessionRoot
 * @param {Function} deps.clearSessionRoot
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 * @param {() => object} deps.getFusionHandlers - getter closure over server.js let fusionHandlers
 * @param {() => object} deps.getClipboardHandlers - getter closure over server.js let clipboardHandlers
 * @param {() => object} deps.getBookmarksHandlers - getter closure over server.js let bookmarksHandlers
 * @param {() => object} deps.getEmojiRecentsHandlers - getter closure over server.js let emojiRecentsHandlers
 * @param {() => object} deps.getThemeHandlers - getter closure over server.js let themeHandlers
 * @param {() => object} deps.getSecretsHandlers - getter closure over server.js let secretsHandlers
 * @param {() => object} deps.getScreenshotHandlers - getter closure over server.js let screenshotHandlers
 * @param {Function} [deps.handleCanonicalHarnessEvent] - handler for direct canonical harness events
 * @returns {{ handleClientMessage: Function, handleClientClose: Function }}
 */
function createClientMessageRouter({
  ws,
  session,
  connectionId,
  projectRoot,
  fileExplorer,
  wireLifecycle,
  sessions,
  setSessionRoot,
  clearSessionRoot,
  getProjectRoot,
  getFusionHandlers,
  getClipboardHandlers,
  getBookmarksHandlers,
  getEmojiRecentsHandlers,
  getThemeHandlers,
  getSecretsHandlers,
  getScreenshotHandlers,
  getFileSaveRoute = () => null,
  getResourceProvenanceRoute = () => null,
  getAgentActivityRoute = () => null,
  getFileViewerReadRoute = () => null,
  getAgentToolFixtureRoute = () => null,
  handleCanonicalHarnessEvent,
}) {

  // Per-connection sub-factories for larger handler groups
  const getAllClients = (workspaceId) => Array.from(sessions.entries())
    .filter(([client, clientSession]) => (
      client.readyState === 1
      && (workspaceId === undefined || clientSession.currentWorkspaceId === workspaceId)
    ))
    .map(([client]) => client);

  const threadHandlers = createThreadWsHandlers({ ws, session, wireLifecycle, projectRoot });
  const harnessHandlers = createHarnessWsHandlers({ ws });
  const chatTurnMetadataHandlers = createChatTurnMetadataHandlers({ ws, session });
  const chatTurnDiagnosticHandlers = createChatTurnDiagnosticHandlers({ ws, session });
  const workspaceRequestHandlers = createWorkspaceRequestHandlers({ ws, session, getAllClients });

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

  async function handleClientMessageWithinBoundary(message, isBinary = false) {
    let clientMsg;
    try {
      clientMsg = decodeClientTextFrame(message, isBinary).value;
    } catch (error) {
      if (error instanceof ClientFrameError) {
        try { ws.close(error.closeCode, error.message.slice(0, 123)); } catch (_closeError) {}
        return;
      }
      throw error;
    }
    try {
      if (!clientMsg || typeof clientMsg !== 'object' || Array.isArray(clientMsg)) {
        throw new TypeError('Client message must be an object');
      }
      const diagnosticType = typeof clientMsg.type === 'string' ? '[declared]' : '[invalid]';
      // The general ingress diagnostic is deliberately value-free. A captured
      // proof/nonce placed under a neutral key (payload, detail, value, etc.)
      // must not become durable merely because its key is not auth-shaped.
      console.log('[WS →]:', diagnosticType);
      console.log('[WS] Message type:', diagnosticType, 'Conn:', session.connectionId.slice(0,8), 'Has wire:', !!session.wire, 'Wire pid:', session.wire?.pid || 'none');
      if (typeof clientMsg.type !== 'string') {
        throw new TypeError('Client message type is invalid');
      }

      // Client logging - forward to server logs
      if (clientMsg.type === 'client_log') {
        // `client_log` is the only message whose values are intentionally
        // forwarded to diagnostics; its entire value-bearing envelope is
        // redacted by the centralized map first.
        const { level, message, data } = redactWsMessage(clientMsg);
        const safeLevel = ['debug', 'info', 'warn', 'error'].includes(level)
          ? level.toUpperCase()
          : 'LOG';
        console.log(`[CLIENT ${safeLevel}] ${message}`, data || '');
        return;
      }

      // Thread Management Messages
      // --------------------------------------------------

      if (clientMsg.type.startsWith('thread:')) {
        const handler = threadHandlers[clientMsg.type];
        if (handler) { await handler(clientMsg); return; }
      }

      // RCC-0108 SPEC-03 Slice D: diagnostic retrieval is dispatched AHEAD
      // OF the chat-turn metadata handlers with EXPLICITLY NO fallthrough.
      // A diagnostic request must never reach metadata-update routing
      // semantics; an unknown diagnostic type returns no report and no
      // metadata handling.
      if (clientMsg.type.startsWith('chat-turn:diagnostic:')) {
        const handler = chatTurnDiagnosticHandlers[clientMsg.type];
        if (handler) { await handler(clientMsg); }
        return;
      }

      if (clientMsg.type.startsWith('chat-turn:')) {
        const handler = chatTurnMetadataHandlers[clientMsg.type];
        if (handler) {
          // Chat-turn metadata is durable thread state. Keep the private-role
          // gate at central ingress, after bounded decoding and before the
          // handler can acquire a workspace lease or touch persistence.
          if (!requireTrustedThreadAuthority(ws, session)) return;
          await handler(clientMsg);
          return;
        }
      }

      // File Explorer Messages
      // --------------------------------------------------

      if (clientMsg.type === 'file_tree_request') {
        if (
          clientMsg.panel == null
          || clientMsg.panel === 'file-viewer'
          || Object.prototype.hasOwnProperty.call(clientMsg, 'version')
        ) {
          const fileViewerReadRoute = getFileViewerReadRoute();
          if (fileViewerReadRoute) {
            await fileViewerReadRoute.handleTree({ ws, session, message: clientMsg });
          } else {
            try { ws.close(1011, 'file viewer read route unavailable'); } catch (_error) {}
          }
          return;
        }
        await fileExplorer.handleFileTreeRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'file_content_request') {
        if (
          clientMsg.panel == null
          || clientMsg.panel === 'file-viewer'
          || Object.prototype.hasOwnProperty.call(clientMsg, 'version')
        ) {
          const fileViewerReadRoute = getFileViewerReadRoute();
          if (fileViewerReadRoute) {
            await fileViewerReadRoute.handleContent({ ws, session, message: clientMsg });
          } else {
            try { ws.close(1011, 'file viewer read route unavailable'); } catch (_error) {}
          }
          return;
        }
        await fileExplorer.handleFileContentRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'recent_files_request') {
        await fileExplorer.handleRecentFilesRequest(ws, clientMsg);
        return;
      }

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

      if (clientMsg.type === 'file_save') {
        const fileSaveRoute = getFileSaveRoute();
        if (fileSaveRoute) {
          await fileSaveRoute.handleFileSave({ ws, session, message: clientMsg });
        } else {
          try { ws.close(1011, 'file save route unavailable'); } catch (_error) {}
        }
        return;
      }

      if (clientMsg.type === 'resource:provenance:query') {
        const resourceProvenanceRoute = getResourceProvenanceRoute();
        if (resourceProvenanceRoute) {
          await resourceProvenanceRoute.handleQuery({ ws, session, message: clientMsg });
        } else {
          try { ws.close(1011, 'resource provenance route unavailable'); } catch (_error) {}
        }
        return;
      }

      if (clientMsg.type === 'agent:activity:query') {
        const agentActivityRoute = getAgentActivityRoute();
        if (agentActivityRoute) {
          await agentActivityRoute.handleQuery({ ws, session, message: clientMsg });
        } else {
          try { ws.close(1011, 'agent activity route unavailable'); } catch (_error) {}
        }
        return;
      }

      if (clientMsg.type === 'provenance:test:agent_tool') {
        const fixtureRoute = getAgentToolFixtureRoute();
        if (!fixtureRoute) {
          try { ws.close(1008, 'test fixture route unavailable'); } catch (_error) {}
          return;
        }
        await fixtureRoute.handle({
          ws, session, message: clientMsg, handleCanonicalHarnessEvent,
        });
        return;
      }

      if (clientMsg.type === 'folder_create') {
        await fileExplorer.handleFolderCreateRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'document_create') {
        await fileExplorer.handleDocumentCreateRequest(ws, clientMsg);
        return;
      }

      // Panel Management
      // --------------------------------------------------

      if (clientMsg.type === 'workspace:state_push') {
        const workspaceState = require('../workspace/workspace-state');
        const workspace = await registry.getById(clientMsg.workspaceId);
        if (!workspace || workspace.ribbonVisible === false) {
          return;
        }
        const repoPath = workspace.repoPath || workspace.repo_path;
        const allowedViewIds = repoPath ? views.listViews(repoPath) : [];
        workspaceState.save(clientMsg.workspaceId, clientMsg.state, { repoPath, allowedViewIds });
        return;
      }

      if (clientMsg.type === 'workspace:view_update_requested') {
        try {
          const registry = views.updateWorkspaceViewRegistry(session.projectRoot, clientMsg);
          ws.send(JSON.stringify({
            type: 'workspace:view_registry_updated',
            registry,
          }));
        } catch (err) {
          void err;
          ws.send(JSON.stringify({
            type: 'workspace:view_update_rejected',
            message: 'Unable to update view',
          }));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_options_requested') {
        try {
          const options = views.getWorkspaceViewOptions(session.projectRoot);
          ws.send(JSON.stringify({
            type: 'workspace:view_options',
            hiddenViews: options.hiddenViews,
            availableTemplates: options.availableTemplates,
          }));
        } catch (err) {
          void err;
          ws.send(JSON.stringify({
            type: 'workspace:view_update_rejected',
            message: 'Unable to load view options',
          }));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_restore_requested') {
        try {
          const registry = views.restoreWorkspaceView(session.projectRoot, clientMsg.viewId);
          ws.send(JSON.stringify({
            type: 'workspace:view_registry_updated',
            registry,
          }));
        } catch (err) {
          void err;
          ws.send(JSON.stringify({
            type: 'workspace:view_update_rejected',
            message: 'Unable to restore view',
          }));
        }
        return;
      }

      if (clientMsg.type === 'workspace:view_add_requested') {
        try {
          const registry = views.addWorkspaceView(session.projectRoot, clientMsg.templateId);
          ws.send(JSON.stringify({
            type: 'workspace:view_registry_updated',
            registry,
          }));
        } catch (err) {
          void err;
          ws.send(JSON.stringify({
            type: 'workspace:view_update_rejected',
            message: 'Unable to add view',
          }));
        }
        return;
      }

      if (clientMsg.type === 'set_panel') {
        const { panel, rootFolder } = clientMsg;
        if (panel) {
          // Panel installation replaces ThreadWebSocketHandler's connection
          // state object. Keep it on the same queue as privileged thread work
          // and workspace binding so it cannot invalidate an admitted lease
          // halfway through persistence or provider activation.
          await runWorkspaceOperation(ws, () => true, async () => {
            const projectRoot = session.projectRoot;
            if (!projectRoot) {
              ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
              return;
            }
            setSessionRoot(ws, panel, rootFolder || null);

            // RCC-0095: chat is a workspace-level feature. Set up threads
            // unconditionally — a missing or malformed view folder must not
            // remove the workspace chat. resolveChatConfig() is only used
            // below for the declarative chatType/chatPosition payload fields.
            ThreadWebSocketHandler.setPanel(ws, panel, {
              projectRoot,
              viewName: panel,
              workspaceId: session.currentWorkspaceId,
              workspaceEpoch: session.workspaceEpoch,
            });
            await ThreadWebSocketHandler.sendThreadList(ws);

            const chatConfig = views.resolveChatConfig(projectRoot, panel);

            // Send view config to client (includes content.json + layout.json)
            const viewConfig = views.loadView(projectRoot, panel);
            // CLI_CONFIG_SPEC §7d: per-view override delta (may be {}).
            const { resolveViewDelta } = require('../cli-config');
            const cliConfigDelta = await resolveViewDelta(projectRoot, panel);
            ws.send(JSON.stringify({
              type: 'panel_changed',
              panel,
              rootFolder: rootFolder || projectRoot,
              contentConfig: viewConfig?.content || null,
              layoutConfig: viewConfig?.layout || null,
              hasChat: !!chatConfig,
              chatType: chatConfig?.chatType || null,
              chatPosition: chatConfig?.chatPosition || null,
              cliConfigDelta,
            }));

            if (rootFolder) {
              ws.send(JSON.stringify({
                type: 'panel_config',
                panel,
                projectRoot: rootFolder,
                projectName: path.basename(rootFolder)
              }));
            }
          });
        }
        return;
      }

      // Wire Protocol Messages
      // --------------------------------------------------

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
        if (!requireTrustedThreadAuthority(ws, session)) return;
        const harnessConfig = normalizePortableHarnessConfig(clientMsg.harnessConfig);
        if (!harnessConfig.ok) {
          denyThreadMutation(ws);
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
          denyThreadMutation(ws);
          return;
        }
        try {
          await runWorkspaceOperation(
            ws,
            () => ThreadWebSocketHandler.isActivationBindingCurrent(ws, binding),
            () => threadRuntimeController.acceptPromptThroughRuntime({
              ws,
              session,
              clientMsg: acceptedPrompt,
              wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
              projectRoot: binding.projectRoot,
              spawnAndSetupWire,
              handleCanonicalHarnessEvent,
            }),
          );
        } catch (error) {
          if (!isWorkspaceOperationLeaseError(error)) throw error;
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

      // ---- Robin system panel (delegated to lib/fusion/ws-handlers.js) ----

      if (clientMsg.type.startsWith('fusion:')) {
        const handler = getFusionHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // ---- Clipboard manager (delegated to lib/clipboard/ws-handlers.js) ----

      if (clientMsg.type.startsWith('clipboard:')) {
        const handler = getClipboardHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // ---- Bookmarks manager ----

      if (clientMsg.type.startsWith('bookmarks:')) {
        const handler = getBookmarksHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // ---- Emoji recents manager ----

      if (clientMsg.type.startsWith('emoji_recents:')) {
        const handler = getEmojiRecentsHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // ---- Theme picker (delegated to lib/ws/theme-handlers.js) ----

      if (clientMsg.type.startsWith('theme:')) {
        const handler = getThemeHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // ---- Secrets manager (delegated to lib/secrets/index.js) ----

      if (clientMsg.type.startsWith('secrets:')) {
        const handler = getSecretsHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // ---- Harness mode management + external CLI harnesses ----

      if (clientMsg.type.startsWith('harness:')) {
        const handler = harnessHandlers[clientMsg.type];
        if (handler) {
          await handler(clientMsg);
          return;
        }
      }

      // ---- Workspace lifecycle, folder browse, view state, file:move ----

      if (workspaceRequestHandlers[clientMsg.type]) {
        await workspaceRequestHandlers[clientMsg.type](clientMsg);
        return;
      }

      // ---- Screenshot manager (delegated to lib/screenshot/ws-handlers.js) ----

      if (clientMsg.type.startsWith('screenshot:')) {
        const handler = getScreenshotHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }

      // Unknown message type
      console.log('[WS] Unknown message type:', diagnosticType);

    } catch (err) {
      // This boundary can catch failures derived from requester-controlled
      // product payloads. Keep the durable diagnostic fixed rather than
      // serializing an Error whose message/properties may echo those bytes.
      console.error('[WS] Message handling error');
      ws.send(JSON.stringify({ type: 'error', message: 'Message handling failed' }));
    }
  }

  function handleClientMessage(message, isBinary = false) {
    return runWithRequestDiagnosticBoundary(
      () => handleClientMessageWithinBoundary(message, isBinary),
    );
  }

  function handleClientClose() {
    return runWithRequestDiagnosticBoundary(async () => {
      console.log('[WS] client_disconnected');
      try {
        // Clean up thread state, including durable session suspension.
        await ThreadWebSocketHandler.cleanup(ws);
      } finally {
        // ThreadWebSocketHandler.cleanup owns exact-session quiescence and
        // provider termination. Do not signal session.wire a second time here:
        // it may already have transferred to a different connection owner.
        if (session.wire) console.log('[WS] wire_detached');
        sessions.delete(ws);
        clearSessionRoot(ws);
      }
    });
  }

  return { handleClientMessage, handleClientClose };
}

module.exports = { createClientMessageRouter };
