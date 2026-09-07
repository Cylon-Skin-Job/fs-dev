/**
 * Fusion Studio Server with Thread Management
 *
 * Glue layer: wires the HTTP routes, WebSocket routers, and startup
 * orchestrator together. All domain logic lives in lib/ (see SPEC-01a–01g).
 *
 * @see lib/thread/README.md - Thread management documentation
 */

const {
  installEarlyIsolatedProvenanceGuards,
} = require('./lib/testing/isolated-provenance-runtime');
installEarlyIsolatedProvenanceGuards(process.env);

if (process.env.FUSION_SECURE_OBSERVER_HEALTH_ONLY === '1') {
  const observer = require('./native/secure-file-observer');
  if (!observer.available) {
    process.stderr.write('SECURE_FILE_OBSERVER_UNAVAILABLE\n');
    process.exitCode = 1;
  } else {
    (async () => {
      let fixture = 'load-only';
      if (process.env.FUSION_SECURE_OBSERVER_SMOKE === 'descriptor-swap-v1') {
        const { runSecureObserverRuntimeSmoke } = require('./native/secure-file-observer/runtime-smoke');
        const result = await runSecureObserverRuntimeSmoke({
          root: process.env.FUSION_PROVENANCE_TEST_ROOT,
          nonce: process.env.FUSION_PROVENANCE_TEST_NONCE,
        });
        fixture = result.fixture;
      }
      process.stdout.write(
        `SECURE_FILE_OBSERVER_READY:${process.platform}:${process.arch}:${process.versions.modules}:${fixture}\n`,
      );
    })().catch(() => {
      process.stderr.write('SECURE_FILE_OBSERVER_SMOKE_FAILED\n');
      process.exitCode = 1;
    });
  }
  return;
}

const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const { v4: generateId } = require('uuid');

// Console tee — install before anything below logs so startup lines
// reach server-live.log.
const { installLogTee, resolveServerLogPath } = require('./lib/logging');
installLogTee(resolveServerLogPath({
  appUserData: process.env.FUSION_APP_USER_DATA,
  serverDir: __dirname,
}));

// Thread management
const { ThreadWebSocketHandler } = require('./lib/thread');

// File explorer handlers
const { createFileExplorerHandlers } = require('./lib/file-explorer');

// Event bus for TRIGGERS.md automations
const { emit } = require('./lib/event-bus');
const workspaceController = require('./lib/workspace/workspace-controller');

// Harness compatibility layer for external CLI harnesses
const { getHarnessMode } = require('./lib/harness/feature-flags');

// Log current harness mode on startup
console.log('[Server] Harness mode:', getHarnessMode());

// Hardwired enforcement — settings/ folders are write-locked for AI
const { checkSettingsBounce } = require('./lib/enforcement');

// Server startup orchestrator (DB init, handlers, listen, watcher, triggers, shutdown)
const { start: startServer } = require('./lib/startup');

// Wire process manager — per-connection lifecycle
const { createWireLifecycle } = require('./lib/wire/process-manager');

// Wire message router — per-connection event switch (extracted per SPEC-01d)
const { createWireMessageRouter } = require('./lib/wire/message-router');

// Client message router — per-connection dispatch factory (extracted per SPEC-01f).
const { createClientMessageRouter } = require('./lib/ws/client-message-router');
const { createOfficePaletteDispatch } = require('./lib/ws/office-palette-dispatch');
const { readBootstrapAuthority } = require('./lib/shell-bootstrap');
const { createShellAuthOwner } = require('./lib/ws/shell-auth');
const { createShellAuthDispatch } = require('./lib/ws/shell-auth-dispatch');
const { createProductSessionRegistry } = require('./lib/ws/product-session-registry');
const { createDeferredProductConnection } = require('./lib/ws/deferred-product-connection');
const { createTransportConnectionRegistry } = require('./lib/ws/transport-connection-registry');
const { createServerRuntimeActivation } = require('./lib/ws/server-runtime-activation');
const {
  MAX_SHELL_AUTH_FRAME_BYTES,
  activateApplicationPayloadLimit,
} = require('./lib/ws/websocket-payload-boundary');

// View discovery and resolution (filesystem-driven, no database)

// Panel path resolution + shared session registries (extracted per SPEC-01g).
// `sessions` is the product-visible server-wide Map. Managed sockets remain
// outside it until shell proof and initialization both succeed.
const {
  sessions,
  getProjectRoot,
  setSessionRoot,
  clearSessionRoot,
  getPanelPath,
} = require('./lib/views/panel-paths');
const productSessionRegistry = createProductSessionRegistry({ sessions });
const transportConnectionRegistry = createTransportConnectionRegistry();
const serverRuntimeActivation = createServerRuntimeActivation();

// Initial connection payload builders (extracted per SPEC-01g)
const { buildWorkspaceInit, buildPanelConfig } = require('./lib/ws/connection-init');
const {
  beginWorkspaceBind,
  completeWorkspaceBind,
} = require('./lib/ws/workspace-session');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: MAX_SHELL_AUTH_FRAME_BYTES });
let shellAuthOwner = null;
const { createShellCorsMiddleware } = require('./lib/http/shell-cors');

app.use('/api', createShellCorsMiddleware());
app.use('/material-symbols', createShellCorsMiddleware());
app.use(express.json({ limit: '1mb' }));

// Serve static files from the React client dist folder
const clientDistPath = path.join(__dirname, '..', 'fusion-studio-client', 'dist');
app.use(
  express.static(clientDistPath, {
    setHeaders(res, filePath) {
      // Always revalidate HTML so new builds (new hashed JS/CSS names) load after refresh
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// ============================================================================
// HTTP API Routes
// ============================================================================
//
// Mount order is load-bearing: static dist above, API routes here, SPA
// fallback LAST or it swallows everything (SPEC-01 middleware gotcha).

app.use('/api/screenshot', require('./lib/screenshot/router').createRouter());
app.use('/api/capabilities', require('./lib/http/capabilities-routes').createRouter());
app.use('/api', require('./lib/transcription').createRouter());
app.use('/api/panel-file', require('./lib/http/panel-file-route').createRouter({ getProjectRoot, getPanelPath }));
app.use('/api/harnesses', require('./lib/http/harness-routes').createRouter());
app.use('/api/view-config', require('./lib/http/view-config-route').createRouter({ getProjectRoot }));
app.use('/api/calendar', require('./lib/http/calendar-routes').createRouter());

// Fallback to index.html for SPA routing
// Exclude /api/* and /material-symbols/* so backend routes and static assets
// are not swallowed by the SPA fallback.
app.get(/^(?!\/api\/|\/material-symbols\/)/, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const fileExplorer = createFileExplorerHandlers({
  getPanelPath,
  getProjectRoot,
});

// ============================================================================
// WebSocket Connection Handler with Thread Support
// ============================================================================

wss.on('connection', (ws, request) => {
  ws.on('error', () => console.warn('[WS] transport_error'));
  console.log('[WS] Client connected (thread-enabled)');
  const connectionId = generateId();

  // Session state
  const session = {
    connectionId,
    wire: null,
    currentTurn: null,
    buffer: '',
    toolArgs: {},
    activeToolId: null,
    hasToolCalls: false,
    currentThreadId: null,
    pendingAttachments: [],
    assistantParts: [],  // For exchange tracking (SQLite)
    contextUsage: null,  // Latest context usage from wire (0-1 decimal)
    tokenUsage: null,    // Latest token usage from wire
    messageId: null,     // OpenAI message ID from StatusUpdate
    planMode: false,     // Whether turn was in plan mode
    projectRoot: null,
    currentWorkspaceId: null,
    workspaceEpoch: null,
    workspaceBindingState: 'pending-auth',
    workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [],
    workspaceReplyBufferBytes: 0,
    currentViewId: null  // CHAT_SCOPE_SPEC: reserved for view-bound scope strings (unused; single workspace chat)
  };
  let activeWs = null;
  let projectRoot = null;
  const productConnection = createDeferredProductConnection({
    ws,
    build: async ({ ownCleanup }) => {
      activeWs = workspaceController.getActiveWorkspaceSync();
      projectRoot = activeWs ? activeWs.repo_path : null;
      const { handleMessage, handleCanonicalHarnessEvent } = createWireMessageRouter({
        session,
        ws,
        threadWebSocketHandler: ThreadWebSocketHandler,
        emit,
        checkSettingsBounce,
      });
      const { awaitHarnessReady, initializeWire, setupWireHandlers } = createWireLifecycle({
        session,
        ws,
        connectionId,
        onWireMessage: handleMessage,
      });
      const { handleClientMessage, handleClientClose } = createClientMessageRouter({
        ws,
        session,
        connectionId,
        projectRoot,
        fileExplorer,
        wireLifecycle: { awaitHarnessReady, initializeWire, setupWireHandlers },
        sessions,
        setSessionRoot,
        clearSessionRoot,
        getProjectRoot,
        getFusionHandlers: () => fusionHandlers,
        getClipboardHandlers: () => clipboardHandlers,
        getThemeHandlers: () => themeHandlers,
        getSecretsHandlers: () => secretsHandlers,
        getScreenshotHandlers: () => screenshotHandlers,
        getFileSaveRoute: () => fileSaveRoute,
        getResourceProvenanceRoute: () => resourceProvenanceRoute,
        getAgentActivityRoute: () => agentActivityRoute,
        getFileViewerReadRoute: () => fileViewerReadRoute,
        getAgentToolFixtureRoute: () => agentToolFixtureRoute,
        getBookmarksHandlers: () => bookmarksHandlers,
        getEmojiRecentsHandlers: () => emojiRecentsHandlers,
        handleCanonicalHarnessEvent,
      });
      ownCleanup(handleClientClose);
      return Object.freeze({
        handleMessage: createOfficePaletteDispatch({ ws, session, handleNext: handleClientMessage }),
        handleClose: handleClientClose,
      });
    },
  });
  transportConnectionRegistry.track(ws, productConnection.waitForCleanup);

  // ==========================================================================
  // Initial Messages
  // ==========================================================================

  const initializeConnection = async () => {
    // Manager initialization can read and normalize durable thread state, so it
    // belongs behind successful shell authentication. Standalone mode reaches
    // this same boundary without ever receiving a trusted connection role.
    await serverRuntimeActivation.wait();
    await productConnection.initialize();
    const initialWorkspacePair = beginWorkspaceBind(session, {
      workspaceId: activeWs ? activeWs.id : null,
      repoPath: projectRoot,
    });
    if (projectRoot) {
      ThreadWebSocketHandler.setPanel(ws, 'file-viewer', {
        projectRoot,
        viewName: 'file-viewer',
        workspaceId: activeWs ? activeWs.id : null,
      });
    }
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      message: 'Thread-enabled connection established',
    }));
    const msg = await buildWorkspaceInit(getProjectRoot, { ...initialWorkspacePair, repoPath: projectRoot });
    console.log('[WS] Sending workspace:init message');
    const bound = await completeWorkspaceBind(ws, session, msg, initialWorkspacePair);
    if (!bound) throw new Error('workspace_binding_retired');
    ws.send(JSON.stringify(buildPanelConfig(projectRoot)));
  };
  const authenticatedDispatch = createShellAuthDispatch({
    authOwner: shellAuthOwner,
    ws,
    session,
    origin: request?.headers?.origin,
    initialize: initializeConnection,
    activate: () => productSessionRegistry.activate({
      ws,
      session,
      managed: shellAuthOwner.available,
    }),
    activateTransport: () => activateApplicationPayloadLimit(ws),
    handleNext: productConnection.handleMessage,
    log: (code) => console.warn(`[WS] ${code}`),
  });
  ws.on('message', authenticatedDispatch);
});


// ============================================================================
// Server Startup
// ============================================================================

// Module-level mutable handler references. Populated when startServer() resolves.
// The client message router (lib/ws/client-message-router.js) reads from these
// via getFusionHandlers / getClipboardHandlers getter closures injected into
// createClientMessageRouter. See SPEC-01b for the mutable-reference rationale.
let fusionHandlers = {};
let clipboardHandlers = {};
let bookmarksHandlers = {};
let emojiRecentsHandlers = {};
let themeHandlers = {};
let secretsHandlers = {};
let screenshotHandlers = {};
// Slice 03d installs the coherently composed governed route here only after
// durable publishers, ledger handler/provider, subscription, and grants exist.
let fileSaveRoute = null;
let resourceProvenanceRoute = null;
let agentActivityRoute = null;
let fileViewerReadRoute = null;
let agentToolFixtureRoute = null;

readBootstrapAuthority()
  .then((authority) => {
    shellAuthOwner = createShellAuthOwner({
      authority,
      log: (code) => console.warn(`[WS] ${code}`),
    });
    return startServer({
  server,
  app,
  sessions,
  productSessionRegistry,
  transportConnectionRegistry,
  getProjectRoot,
  installProtocolRoutes(routes) {
    if (fileSaveRoute || resourceProvenanceRoute || agentActivityRoute || fileViewerReadRoute) {
      throw new Error('Protocol routes are already installed');
    }
    if (!routes?.fileSaveRoute || !routes?.resourceProvenanceRoute || !routes?.agentActivityRoute || !routes?.fileViewerReadRoute) {
      throw new Error('Complete governed protocol routes are required');
    }
    fileSaveRoute = routes.fileSaveRoute;
    resourceProvenanceRoute = routes.resourceProvenanceRoute;
    agentActivityRoute = routes.agentActivityRoute;
    fileViewerReadRoute = routes.fileViewerReadRoute;
    agentToolFixtureRoute = routes.agentToolFixtureRoute || null;
  },
    });
  })
  .then(result => {
    fusionHandlers = result.fusionHandlers;
    clipboardHandlers = result.clipboardHandlers;
    bookmarksHandlers = result.bookmarksHandlers;
    emojiRecentsHandlers = result.emojiRecentsHandlers;
    themeHandlers = result.themeHandlers;
    secretsHandlers = result.secretsHandlers;
    screenshotHandlers = result.screenshotHandlers || {};
    const boundPort = server.address()?.port;
    if (!Number.isSafeInteger(boundPort) || boundPort < 1 || boundPort > 65_535) {
      throw new Error('Server runtime endpoint is unavailable');
    }
    process.stdout.write(`SERVER_READY:${boundPort}\n`);
    serverRuntimeActivation.activate();
  })
  .catch(err => {
    serverRuntimeActivation.fail();
    console.error('[Server] Startup failed:', err);
    process.exit(1);
  });
