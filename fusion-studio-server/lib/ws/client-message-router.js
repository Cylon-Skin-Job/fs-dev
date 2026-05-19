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

const ThreadWebSocketHandler = require('../thread');
const { getWireForThread, sendToWire } = require('../wire/process-manager');
const views = require('../views');
const { redactWsMessage } = require('./redaction-map');
const { createThreadWsHandlers } = require('./thread-ws-handlers');
const { createHarnessWsHandlers } = require('./harness-ws-handlers');
const { createWorkspaceRequestHandlers } = require('./workspace-request-handlers');

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
 * @param {() => object} deps.getRecentDocsHandlers - getter closure over server.js let recentDocsHandlers
 * @param {() => object} deps.getThemeHandlers - getter closure over server.js let themeHandlers
 * @param {() => object} deps.getSecretsHandlers - getter closure over server.js let secretsHandlers
 * @param {() => object} deps.getScreenshotHandlers - getter closure over server.js let screenshotHandlers
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
  getRecentDocsHandlers,
  getThemeHandlers,
  getSecretsHandlers,
  getScreenshotHandlers,
}) {

  // Per-connection sub-factories for larger handler groups
  const threadHandlers = createThreadWsHandlers({ ws, session, wireLifecycle, projectRoot });
  const harnessHandlers = createHarnessWsHandlers({ ws });
  const workspaceRequestHandlers = createWorkspaceRequestHandlers({ ws, session });

  const { awaitHarnessReady, initializeWire, setupWireHandlers } = wireLifecycle;

  async function handleClientMessage(message) {
    const text = message.toString();
    try {
      const clientMsg = JSON.parse(text);
      // Redact credential-bearing fields before logging the payload.
      // See lib/ws/redaction-map.js + CLIPBOARD_KEYCHAIN_REDESIGN.md §3i.
      const safe = redactWsMessage(clientMsg);
      console.log('[WS →]:', JSON.stringify(safe).slice(0, 200));
      console.log('[WS] Message type:', clientMsg.type, 'Conn:', session.connectionId.slice(0,8), 'Has wire:', !!session.wire, 'Wire pid:', session.wire?.pid || 'none');

      // Client logging - forward to server logs
      if (clientMsg.type === 'client_log') {
        const { level, message, data } = clientMsg;
        console.log(`[CLIENT ${level.toUpperCase()}] ${message}`, data || '');
        return;
      }

      // Thread Management Messages
      // --------------------------------------------------

      if (clientMsg.type.startsWith('thread:')) {
        const handler = threadHandlers[clientMsg.type];
        if (handler) { await handler(clientMsg); return; }
      }

      // File Explorer Messages
      // --------------------------------------------------

      if (clientMsg.type === 'file_tree_request') {
        await fileExplorer.handleFileTreeRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'file_content_request') {
        await fileExplorer.handleFileContentRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'recent_files_request') {
        await fileExplorer.handleRecentFilesRequest(ws, clientMsg);
        return;
      }

      if (clientMsg.type === 'file_save') {
        await fileExplorer.handleFileSaveRequest(ws, clientMsg);
        return;
      }

      // Panel Management
      // --------------------------------------------------

      if (clientMsg.type === 'workspace:cache_push') {
        const stateCache = require('../workspace/state-cache');
        stateCache.save(clientMsg.workspaceId, clientMsg.state);
        return;
      }

      if (clientMsg.type === 'set_panel') {
        const { panel, rootFolder } = clientMsg;
        if (panel) {
          const projectRoot = session.projectRoot;
          if (!projectRoot) {
            ws.send(JSON.stringify({ type: 'error', message: 'No active workspace' }));
            return;
          }
          // CHAT_SCOPE_SPEC: track the current view name so view-bound chats
          // can resolve the correct scope string. resolveScope() only reads
          // this when session.currentScope === 'view', so setting it here
          // unconditionally is safe for workspace-universal chats too.
          session.currentViewId = panel;
          setSessionRoot(ws, panel, rootFolder || null);

          // Check if this view has chat before setting up threads
          const chatConfig = views.resolveChatConfig(projectRoot, panel);

          if (chatConfig) {
            ThreadWebSocketHandler.setPanel(ws, panel, {
              projectRoot,
              viewName: panel,
              workspaceId: session.currentWorkspaceId,
            });
            await ThreadWebSocketHandler.sendThreadList(ws);
          }

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

      // Prompt - look up wire from global registry
      if (clientMsg.type === 'prompt') {
        // SPEC-26b: scope comes from clientMsg or the session's active scope.
        const scope = clientMsg.scope === 'project' ? 'project' : (session.currentScope || 'view');
        console.log('[WS] PROMPT received:', clientMsg.user_input?.slice(0, 50), 'threadId:', clientMsg.threadId?.slice(0,8), 'scope:', scope);

        // Get wire from global registry using threadId from message
        const threadId = clientMsg.threadId;
        const wire = threadId ? getWireForThread(threadId) : session.wire;

        console.log('[WS] Thread:', threadId?.slice(0,8), 'Wire found:', !!wire);

        if (!wire) {
          ws.send(JSON.stringify({ type: 'error', message: 'No active wire for this thread. Please reopen the thread.' }));
          return;
        }

        // Track message in thread (need to ensure thread is "open" for this ws)
        const threadState = ThreadWebSocketHandler.getState(ws);
        if (threadState && threadId && !threadState.threadIds?.[scope]) {
          // This connection doesn't have this thread open for this scope - set it
          console.log(`[WS] Setting ${scope} thread for this connection:`, threadId.slice(0,8));
          threadState.threadIds[scope] = threadId;
        }

        await ThreadWebSocketHandler.handleMessageSend(ws, {
          content: clientMsg.user_input,
          scope
        });
        console.log('[WS] Message tracked in thread');

        // Send to wire — new harness wires use ACP sendMessage, legacy uses Kimi-wire format
        session.pendingUserInput = clientMsg.user_input;
        if (wire._sendMessage) {
          console.log('[WS] Sending via harness ACP sendMessage');
          (async () => {
            try {
              for await (const _ of wire._sendMessage(clientMsg.user_input, {})) {
                // Events flow via compatibleStdout → setupWireHandlers; just drain the iterator
              }
            } catch (err) {
              console.error('[WS] Harness sendMessage failed:', err);
            }
          })();
        } else {
          const id = generateId();
          const promptParams = { user_input: clientMsg.user_input };
          if (session.pendingSystemContext) {
            promptParams.system = session.pendingSystemContext;
            session.pendingSystemContext = null;
            console.log('[WS] Injecting system context on first prompt');
          }
          console.log('[WS] Sending to wire with id:', id);
          sendToWire(wire, 'prompt', promptParams, id);
          console.log('[WS] Prompt sent to wire');
        }
        return;
      }

      if (clientMsg.type === 'response') {
        // SPEC-26b: scope-aware lookup of active thread for wire routing.
        const scope = session.currentScope || 'view';
        const threadState = ThreadWebSocketHandler.getState(ws);
        const threadId = threadState?.threadIds?.[scope];
        const wire = threadId ? getWireForThread(threadId) : session.wire;
        if (wire) {
          sendToWire(wire, 'response', clientMsg.payload, clientMsg.requestId);
        }
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

      // ---- Recent docs manager ----

      if (clientMsg.type.startsWith('recent_docs:')) {
        const handler = getRecentDocsHandlers()[clientMsg.type];
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
      console.log('[WS] Unknown message type:', clientMsg.type);

    } catch (err) {
      console.error('[WS] Message handling error:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  function handleClientClose() {
    console.log('[WS] Client disconnected:', connectionId.slice(0,8));

    // Clean up thread state
    ThreadWebSocketHandler.cleanup(ws);

    // NOTE: We do NOT kill the wire here. The wire is tied to the thread,
    // not the WebSocket connection. Other connections may need to use it.
    // The wire will timeout naturally after 9 minutes of idle.
    if (session.wire) {
      console.log('[WS] Detaching from wire (not killing), pid:', session.wire.pid);
    }

    sessions.delete(ws);
    clearSessionRoot(ws);
  }

  return { handleClientMessage, handleClientClose };
}

module.exports = { createClientMessageRouter };
