/** Per-connection decoded product ingress, ordered delegation, and close cleanup. */

const { ThreadWebSocketHandler } = require('../thread');
const { redactWsMessage } = require('./redaction-map');
const { createThreadWsHandlers } = require('./thread-ws-handlers');
const { createHarnessWsHandlers } = require('./harness-ws-handlers');
const { createChatTurnMetadataHandlers } = require('./chat-turn-metadata-handlers');
const { createLiveDiagnosticHandlers } = require('./live-diagnostic-handlers');
const { createChatTurnDiagnosticHandlers } = require('./chat-turn-diagnostic-handlers');
const { createWorkspaceRequestHandlers } = require('./workspace-request-handlers');
const { ClientFrameError, decodeClientTextFrame } = require('./client-frame-decoder');
const { runWithRequestDiagnosticBoundary } = require('./request-diagnostic-context');
const { requireTrustedThreadAuthority } = require('./privileged-thread-guard');
const { createViewWorkspaceWsHandlers } = require('./view-workspace-ws-handlers');
const { createChatRuntimeWsHandlers } = require('./chat-runtime-ws-handlers');
const { createFileRequestDispatch } = require('./file-request-dispatch');

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

  // Per-recipient, workspace-qualified delivery for committed thread:action
  // fan-out. Each recipient send is attempted independently by the handler.
  const getWorkspaceRecipients = ({ workspaceId, projectRoot, workspaceEpoch, excludeWs } = {}) => {
    const recipients = [];
    for (const [client, clientSession] of sessions.entries()) {
      if (client === excludeWs || client.readyState !== 1) continue;
      if (clientSession.workspaceBindingState !== 'active') continue;
      if (clientSession.currentWorkspaceId !== workspaceId) continue;
      if (clientSession.projectRoot !== projectRoot) continue;
      if (typeof workspaceEpoch === 'string'
        && clientSession.workspaceEpoch !== workspaceEpoch) continue;
      recipients.push({ ws: client, session: clientSession });
    }
    return recipients;
  };

  const threadHandlers = createThreadWsHandlers({
    ws, session, wireLifecycle, projectRoot, getWorkspaceRecipients,
  });
  const harnessHandlers = createHarnessWsHandlers({ ws });
  const chatTurnMetadataHandlers = createChatTurnMetadataHandlers({ ws, session });
  const liveDiagnosticHandlers = createLiveDiagnosticHandlers({ ws, session });
  const chatTurnDiagnosticHandlers = createChatTurnDiagnosticHandlers({ ws, session });
  const workspaceRequestHandlers = createWorkspaceRequestHandlers({ ws, session, getAllClients });

  const viewHandlers = createViewWorkspaceWsHandlers({ ws, session, sessions, setSessionRoot });
  const chatRuntimeHandlers = createChatRuntimeWsHandlers({
    ws, session, wireLifecycle, handleCanonicalHarnessEvent,
  });
  const fileRequests = createFileRequestDispatch({
    ws, session, fileExplorer,
    runViewDiscoveryRequest: viewHandlers.runViewDiscoveryRequest,
    getFileViewerReadRoute, getFileSaveRoute, getResourceProvenanceRoute,
    getAgentActivityRoute, getAgentToolFixtureRoute, handleCanonicalHarnessEvent,
  });


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
        const handler = liveDiagnosticHandlers[clientMsg.type] ?? chatTurnDiagnosticHandlers[clientMsg.type];
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

      if (clientMsg.type === 'file_tree_request'
        || clientMsg.type === 'file_content_request'
        || clientMsg.type === 'recent_files_request') {
        await fileRequests.handleRead(clientMsg);
        return;
      }


      if (clientMsg.type === 'prompt:resolve') {
        await chatRuntimeHandlers.handlePromptResolve(clientMsg);
        return;
      }


      if (clientMsg.type === 'file_save'
        || clientMsg.type === 'resource:provenance:query'
        || clientMsg.type === 'agent:activity:query'
        || clientMsg.type === 'provenance:test:agent_tool'
        || clientMsg.type === 'folder_create'
        || clientMsg.type === 'document_create') {
        await fileRequests.handleMutation(clientMsg);
        return;
      }


      // Panel Management
      // --------------------------------------------------

      if (clientMsg.type === 'workspace:state_push'
        || clientMsg.type === 'workspace:view_update_requested'
        || clientMsg.type === 'workspace:view_options_requested'
        || clientMsg.type === 'workspace:view_restore_requested'
        || clientMsg.type === 'workspace:view_add_requested'
        || clientMsg.type === 'set_panel') {
        await viewHandlers.handle(clientMsg);
        return;
      }


      // Wire Protocol Messages
      // --------------------------------------------------

      if (clientMsg.type === 'initialize'
        || clientMsg.type === 'prompt'
        || clientMsg.type === 'turn:stop'
        || clientMsg.type === 'response') {
        await chatRuntimeHandlers.handleRuntime(clientMsg);
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
      liveDiagnosticHandlers.dispose();
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
