/**
 * Fusion Studio Server with Thread Management
 *
 * Glue layer: wires the HTTP routes, WebSocket routers, and startup
 * orchestrator together. All domain logic lives in lib/ (see SPEC-01a–01g).
 *
 * @see lib/thread/README.md - Thread management documentation
 * @see ../ai/views/capture-viewer/specs/SPEC.md - Full specification
 */

const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const { v4: generateId } = require('uuid');

// Console tee — install before anything below logs so startup lines
// reach server-live.log.
const { installLogTee } = require('./lib/logging');
installLogTee(path.join(__dirname, 'server-live.log'));

// Thread management
const { ThreadWebSocketHandler } = require('./lib/thread');

// File explorer handlers
const { createFileExplorerHandlers } = require('./lib/file-explorer');

// Event bus for TRIGGERS.md automations
const { emit, on } = require('./lib/event-bus');
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

// View discovery and resolution (filesystem-driven, no database)

// Panel path resolution + shared session registries (extracted per SPEC-01g).
// `sessions` is the single server-wide Map — startup.js and the connection
// handler below must both use this instance.
const {
  sessions,
  getProjectRoot,
  setSessionRoot,
  clearSessionRoot,
  getPanelPath,
} = require('./lib/views/panel-paths');

// Initial connection payload builders (extracted per SPEC-01g)
const { buildWorkspaceInit, buildPanelConfig } = require('./lib/ws/connection-init');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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
  emit,
});

// ============================================================================
// WebSocket Connection Handler with Thread Support
// ============================================================================

wss.on('connection', async (ws) => {
  console.log('[WS] Client connected (thread-enabled)');

  const activeWs = workspaceController.getActiveWorkspaceSync();
  const projectRoot = activeWs ? activeWs.repo_path : null;
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
    projectRoot,         // Mutable per-connection root; updated on workspace:switched. null when no active workspace.
    currentWorkspaceId: activeWs ? activeWs.id : null,
    currentViewId: null  // CHAT_SCOPE_SPEC: reserved for view-bound scope strings (unused; single workspace chat)
  };
  sessions.set(ws, session);

  // Per-connection workspace switch listener: every connection tracks the
  // server-wide active workspace and mirrors its repoPath into its own
  // session so subsequent router/file/thread operations resolve against
  // the new root. One-active-workspace-server-wide model (see plan §1).
  const unsubscribeWorkspaceSwitched = on('workspace:switched', (event) => {
    if (event && event.repoPath) {
      session.projectRoot = event.repoPath;
      session.currentWorkspaceId = event.to;
    }
  });
  ws.on('close', unsubscribeWorkspaceSwitched);

  // Set up a default panel so ThreadManager exists for wire spawning.
  // Don't send the thread list yet — wait for the client's set_panel message.
  // RCC-0095: chat is a workspace-level feature — thread setup does not
  // depend on any view's config or folders (storage is unified at
  // ai/views/chat/threads/<user>/).
  if (projectRoot) {
    ThreadWebSocketHandler.setPanel(ws, 'file-viewer', {
      projectRoot,
      viewName: 'file-viewer',
      workspaceId: activeWs ? activeWs.id : null,
    });
  }

  // ==========================================================================
  // Wire Process Handlers
  // ==========================================================================

  // Per-connection wire message router (extracted per SPEC-01d).
  // Emits chat:* events to the bus (wire-broadcaster handles client
  // delivery); sends non-chat events directly via ws.
  const { handleMessage, handleCanonicalHarnessEvent } = createWireMessageRouter({
    session,
    ws,
    threadWebSocketHandler: ThreadWebSocketHandler,
    emit,
    checkSettingsBounce,
  });

  // Per-connection wire lifecycle helpers.
  const { awaitHarnessReady, initializeWire, setupWireHandlers } = createWireLifecycle({
    session,
    ws,
    connectionId,
    onWireMessage: handleMessage,
  });

  // ==========================================================================
  // Client Message Router (SPEC-01f)
  // ==========================================================================
  //
  // Per-connection client message router. Depends on the wire lifecycle
  // and file explorer — must be created AFTER those factories.
  // fusionHandlers / clipboardHandlers are injected as getter closures to
  // preserve the mutable-reference pattern from SPEC-01b (the
  // module-level `let` bindings are reassigned inside the
  // startServer().then() callback).
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
    getRecentDocsHandlers: () => recentDocsHandlers,
    getBookmarksHandlers: () => bookmarksHandlers,
    getEmojiRecentsHandlers: () => emojiRecentsHandlers,
    handleCanonicalHarnessEvent,
  });

  ws.on('message', handleClientMessage);
  ws.on('close', handleClientClose);

  // ==========================================================================
  // Initial Messages
  // ==========================================================================

  ws.send(JSON.stringify({
    type: 'connected',
    connectionId,
    message: 'Thread-enabled connection established'
  }));

  // Send current workspace registry and active workspace so the client
  // can gate its UI (empty state, switcher) before panel discovery runs.
  try {
    const msg = await buildWorkspaceInit(getProjectRoot);
    console.log('[WS] Sending workspace:init message');
    ws.send(JSON.stringify(msg));
  } catch (err) {
    console.error('[WS] workspace:init failed:', err);
  }

  // Send project root info without assuming a panel — the client will
  // send set_panel to identify itself. When no workspace is active,
  // projectRoot is null and the client renders the empty state.
  ws.send(JSON.stringify(buildPanelConfig(projectRoot)));
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
let recentDocsHandlers = {};
let bookmarksHandlers = {};
let emojiRecentsHandlers = {};
let themeHandlers = {};
let secretsHandlers = {};
let screenshotHandlers = {};

startServer({
  server,
  app,
  sessions,
  getProjectRoot,
})
  .then(result => {
    fusionHandlers = result.fusionHandlers;
    clipboardHandlers = result.clipboardHandlers;
    recentDocsHandlers = result.recentDocsHandlers;
    bookmarksHandlers = result.bookmarksHandlers;
    emojiRecentsHandlers = result.emojiRecentsHandlers;
    themeHandlers = result.themeHandlers;
    secretsHandlers = result.secretsHandlers;
    screenshotHandlers = result.screenshotHandlers || {};
  })
  .catch(err => {
    console.error('[Server] Startup failed:', err);
    process.exit(1);
  });
