/**
 * Server startup orchestrator.
 *
 * Extracted from server.js — handles the full bootstrap sequence:
 *   1. initDb
 *   2. createRobinHandlers + createClipboardHandlers
 *   3. startAuditSubscriber
 *   4. server.listen()
 *   5. wiki hooks
 *   6. project file watcher + loadComponents + createActionHandlers
 *   7. agent triggers + cron scheduler
 *   8. runner heartbeat monitor
 *   9. SIGTERM/SIGINT handlers for clean shutdown
 *
 * Ordering is load-bearing. Do not reorder steps. See the gotchas in
 * SPEC-01b for the specific hard dependencies.
 *
 * Returns { robinHandlers, clipboardHandlers } so server.js can wire
 * them into the client message router (which reads from module-level
 * mutable references).
 */

const path = require('path');
const fs = require('fs');

const { initDb, getDb, closeDb } = require('./db');
const createRobinHandlers = require('./robin/ws-handlers');
const createClipboardHandlers = require('./clipboard/ws-handlers');
const { startAuditSubscriber } = require('./audit/audit-subscriber');
const { startThreadLifecycle } = require('./thread/thread-lifecycle-controller');
const wikiHooks = require('./wiki/hooks');
const { loadComponents, getModalDefinition } = require('./components/component-loader');

const PORT = process.env.PORT || 3001;

/**
 * Bootstrap and start the server. Must be called after the http.Server
 * has been created but before any client connections can arrive.
 *
 * @param {object} deps
 * @param {import('http').Server} deps.server
 * @param {Map} deps.sessions
 * @param {(ws?: import('ws').WebSocket) => string|null} deps.getProjectRoot
 * @returns {Promise<{ robinHandlers: object, clipboardHandlers: object }>}
 */
async function start({ server, sessions, getProjectRoot }) {
  // 1. DB init — robin.db lives at <server>/data/robin.db (fixed,
  // workspace-independent). It is intentionally NOT tied to the active
  // workspace, because the workspace registry is *in* the DB —
  // chicken-and-egg. The DB is the registry's home; workspaces resolve
  // through it, not the other way around.
  await initDb();
  console.log('[DB] robin.db initialized');

  // 2. Handlers — depend on DB being ready
  const robinHandlers = createRobinHandlers({ getDb, sessions, getProjectRoot });
  const clipboardHandlers = createClipboardHandlers({ getDb });

  // 3. Audit subscriber — listens to event bus, persists exchange metadata
  startAuditSubscriber();

  // 3.5. Wire broadcaster — must subscribe before listen() so chat events
  // from the first connection are delivered.
  const { createWireBroadcaster } = require('./wire/wire-broadcaster');
  const { getClientForThread } = require('./wire/process-manager');
  createWireBroadcaster({ getClientForThread });

  // 3.6. Thread lifecycle controller — observes chat:turn_* via bus,
  // emits thread:state_changed / thread:idle_expired. Must subscribe
  // before listen() so the first connection's turns are observed.
  startThreadLifecycle({ idleTimeoutMinutes: 45 });

  // 3.7. Workspace broadcaster — bus → WebSocket fan-out for workspace
  // and thread lifecycle events. Must subscribe before listen() so events
  // from boot (e.g. workspace:culled_at_launch) are delivered.
  const getAllClients = () => {
    const clients = [];
    for (const [ws] of sessions) {
      if (ws.readyState === 1) clients.push(ws);
    }
    return clients;
  };
  const getClientByConnectionId = (connectionId) => {
    for (const [ws, session] of sessions) {
      if (session.connectionId === connectionId && ws.readyState === 1) return ws;
    }
    return null;
  };
  const { createWorkspaceBroadcaster } = require('./ws/workspace-broadcaster');
  createWorkspaceBroadcaster({ getAllClients, getClientByConnectionId });

  // 3.8. Workspace controller — workspace CRUD, launch validator, switch
  // logic. Must run before listen() so the registry is validated and the
  // active workspace is set before the first client connects.
  const workspaceController = require('./workspace/workspace-controller');
  await workspaceController.start();

  // 4. listen() — must come before watcher/hooks start, they broadcast to clients
  await new Promise((resolve, reject) => {
    server.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] Default CLI: ${process.env.KIMI_PATH || 'kimi'}`);

      try {
        _startPipeline({ sessions, getProjectRoot });
      } catch (err) {
        // Don't crash the server if pipeline init fails — log and continue
        console.error('[Server] Pipeline init error:', err);
      }

      resolve();
    });
    server.on('error', reject);
  });

  // 5. Signal handlers — register after successful startup
  process.on('SIGTERM', _handleShutdown);
  process.on('SIGINT', _handleShutdown);

  return { robinHandlers, clipboardHandlers };
}

/**
 * The post-listen pipeline: watcher, hold registry, action handlers,
 * filters, triggers, cron scheduler, heartbeat monitor.
 *
 * Split out of `start()` only for readability — the split has no
 * semantic effect. Everything here runs synchronously from inside the
 * `server.listen()` callback.
 *
 * @private
 */
function _startPipeline({ sessions, getProjectRoot }) {
  const projectRoot = getProjectRoot();
  if (!projectRoot) {
    console.log('[Server] No active workspace — pipeline skipped');
    return;
  }
  const viewsPath = path.join(projectRoot, 'ai', 'views');
  console.log(`[Server] Thread storage: ${viewsPath}`);

  // Start wiki hooks — watches ai/views/wiki-viewer/content/ tree (collections with topics)
  const wikiPath = path.join(viewsPath, 'wiki-viewer', 'content');
  if (fs.existsSync(wikiPath)) {
    wikiHooks.start(wikiPath);
  } else {
    console.log('[Server] wiki-viewer/content not found — wiki hooks skipped');
  }

  // Start project-wide file watcher
  const { createWatcher } = require('./watcher');
  const { loadFilters } = require('./watcher/filter-loader');
  const { createActionHandlers } = require('./watcher/actions');

  // Issues/tickets — optional, not every workspace has an issues-viewer
  const createTicketPath = path.join(viewsPath, 'issues-viewer', 'scripts', 'create-ticket.js');
  let createTicket = () => { console.warn('[Server] createTicket unavailable — issues-viewer not in this workspace'); return null; };
  if (fs.existsSync(createTicketPath)) {
    createTicket = require(createTicketPath);
  } else {
    console.log('[Server] issues-viewer/scripts/create-ticket not found — ticket creation disabled');
  }

  // Create hold registry for auto-block timers
  const { createHoldRegistry } = require('./triggers/hold-registry');
  const issuesDir = path.join(viewsPath, 'issues-viewer');
  const holdRegistry = global.__holdRegistry = createHoldRegistry(issuesDir);

  // Wrap createTicket to hook trigger-created tickets into the hold registry
  const wrappedCreateTicket = function(ticketData) {
    const result = createTicket(ticketData);
    if (ticketData.autoHold && ticketData.triggerName && result?.id) {
      holdRegistry.hold(ticketData.assignee, ticketData.triggerName, result.id);
    }
    return result;
  };

  const projectWatcher = createWatcher(projectRoot);

  // Load declarative filters (.md) from filters/
  const filterDir = path.join(__dirname, 'watcher', 'filters');
  // Load modal component definitions from ai/components/
  const componentsDir = path.join(projectRoot, 'ai', 'components');
  loadComponents(componentsDir);

  const actionHandlers = createActionHandlers({
    createTicket: wrappedCreateTicket,
    projectRoot,
    getModalDefinition,
    db: getDb(),
    sendChatMessage(target, message, role) {
      for (const [ws, sess] of sessions) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'system_message',
            content: message,
            role: role || 'system',
            target,
          }));
        }
      }
    },
    broadcastModal(config) {
      for (const [ws, sess] of sessions) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'modal:show', ...config }));
        }
      }
    },
    broadcastFileChange(payload) {
      for (const [ws, sess] of sessions) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(payload));
        }
      }
    },
  });
  const declFilters = loadFilters(filterDir, actionHandlers);
  for (const f of declFilters) projectWatcher.addFilter(f);

  // Load agent TRIGGERS.md files
  const { loadTriggers } = require('./triggers/trigger-loader');
  const { createCronScheduler } = require('./triggers/cron-scheduler');
  const { evaluateCondition } = require('./watcher/filter-loader');

  const agentsBasePath = path.join(viewsPath, 'agents-viewer');
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(agentsBasePath, 'registry.json'), 'utf8'));
    const { filters: triggerFilters, cronTriggers } = loadTriggers(
      projectRoot, agentsBasePath, registry, actionHandlers
    );

    for (const f of triggerFilters) projectWatcher.addFilter(f);

    if (cronTriggers.length > 0) {
      const cronScheduler = createCronScheduler(wrappedCreateTicket, { evaluateCondition });
      for (const { trigger, assignee } of cronTriggers) {
        cronScheduler.register(trigger, assignee);
      }
      cronScheduler.start();
    }
  } catch (err) {
    console.error(`[Server] Failed to load agent triggers: ${err.message}`);
  }

  // Start runner heartbeat monitor
  const { checkHeartbeats } = require('./runner');
  checkHeartbeats(projectRoot);
}

async function _handleShutdown() {
  await closeDb();
  process.exit(0);
}

module.exports = { start };
