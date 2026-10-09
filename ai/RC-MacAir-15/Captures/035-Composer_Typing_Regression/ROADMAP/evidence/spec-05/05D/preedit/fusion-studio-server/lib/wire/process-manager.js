/**
 * Wire process manager.
 *
 * Extracted from server.js. Owns:
 *   - The global wireRegistry Map (threadId → { wire, projectRoot })
 *   - registerWire / attachClientToWire / unregisterWire / getWireForThread
 *   - sendToWire (JSON-RPC 2.0 marshalling to wire stdin)
 *   - createWireLifecycle factory (per-connection awaitHarnessReady /
 *     initializeWire / setupWireHandlers)
 *
 * The registry Map is module-private. All access goes through the exported
 * helper functions.
 *
 * Does NOT own:
 *   - agentWireSessions (per-agent persona wires) — still in server.js,
 *     assigned to global.__agentWireSessions for the runner to read
 *   - handleWireMessage (the event router) — SPEC-01d's territory
 *   - Wire spawning (that's in lib/harness/compat.js)
 */

const { randomUUID: generateId } = require('crypto');
const path = require('path');
const { logWire } = require('./wire-log');

// ── Registry ────────────────────────────────────────────────────────────────

// Module-private Map. Do not export.
// JSON([workspaceId, normalized projectRoot, threadId]) → exact provider resource.
// workspaceEpoch is mutable delivery ownership on that root-scoped provider.
const wireRegistry = new Map();
// The stdout/exit listeners are installed once, when a provider is spawned,
// but a live provider can later be reclaimed by another product connection.
// Resolve the current connection lifecycle at delivery time so those
// listeners never remain owned by the spawning connection.
const clientWireLifecycles = new WeakMap();

function normalizedRoot(projectRoot) {
  return typeof projectRoot === 'string' && projectRoot ? path.resolve(projectRoot) : null;
}

function wireKey(threadId, workspaceId, projectRoot) {
  if (typeof threadId !== 'string' || !threadId
    || typeof workspaceId !== 'string' || !workspaceId
    || !normalizedRoot(projectRoot)) return null;
  return JSON.stringify([workspaceId, normalizedRoot(projectRoot), threadId]);
}

function exactScope(scopeContext, projectRoot = null) {
  if (!scopeContext || typeof scopeContext !== 'object') return null;
  const root = normalizedRoot(scopeContext.projectRoot || projectRoot);
  if (typeof scopeContext.workspaceId !== 'string' || !scopeContext.workspaceId || !root) return null;
  return {
    workspaceId: scopeContext.workspaceId,
    projectRoot: root,
    workspaceEpoch: typeof scopeContext.workspaceEpoch === 'string' && scopeContext.workspaceEpoch
      ? scopeContext.workspaceEpoch
      : null,
  };
}

function getWireEntry(threadId, scopeContext) {
  const scope = exactScope(scopeContext);
  if (scope) {
    return wireRegistry.get(wireKey(threadId, scope.workspaceId, scope.projectRoot)) || null;
  }
  // Backward-compatible diagnostic/test lookup: a workspace-only query is
  // accepted only when it resolves to one unambiguous root-scoped provider.
  if (typeof scopeContext !== 'string' || !scopeContext) return null;
  const matches = [...wireRegistry.values()].filter((entry) => (
    entry.threadId === threadId && entry.workspaceId === scopeContext
  ));
  return matches.length === 1 ? matches[0] : null;
}

function getWireForThread(threadId, scopeContext) {
  return getWireEntry(threadId, scopeContext)?.wire || null;
}

function getClientForThread(threadId, scopeContext) {
  const scope = exactScope(scopeContext);
  // Client delivery is connection-generation scoped. Provider-resource
  // lookups may deliberately omit an epoch for explicit idle adoption, but
  // an outbound event without the exact epoch must never inherit the current
  // renderer binding.
  if (!scope?.workspaceEpoch) return null;
  const entry = getWireEntry(threadId, scopeContext);
  if (!entry) return null;
  if (entry.workspaceEpoch !== scope.workspaceEpoch) return null;
  return entry.ws || null;
}

/**
 * Rebind an existing wire's outbound delivery to a replacement client, but
 * only when the registered owner is absent or no longer open. The check and
 * Map replacement are synchronous so another passive viewer cannot take the
 * wire from a healthy owner between them.
 *
 * This changes client routing only. It does not start, stop, or otherwise
 * mutate the harness runtime.
 *
 * @param {string} threadId
 * @param {import('ws').WebSocket} ws
 * @returns {boolean} true when delivery ownership was reclaimed
 */
function reclaimClientForWire(threadId, ws, scopeContext = {}) {
  const scope = exactScope(scopeContext);
  const key = scope && wireKey(threadId, scope.workspaceId, scope.projectRoot);
  if (!key) return false;
  const existing = wireRegistry.get(key);
  if (!existing?.wire) return false;
  if (existing.projectRoot !== scope.projectRoot) return false;

  const currentClient = existing.ws;
  if (currentClient?.readyState === 1) return false;

  if (!ws || ws.readyState !== 1) {
    console.warn(
      `[WireRegistry] Cannot reclaim live delivery for thread ${threadId}: replacement client is not open`
    );
    return false;
  }

  clearTransferredClientWire(existing, ws);
  wireRegistry.set(key, { ...existing, ws, workspaceEpoch: scope.workspaceEpoch });
  const previousState = currentClient ? `readyState=${currentClient.readyState}` : 'absent';
  console.warn(
    `[WireRegistry] Reclaimed live delivery for thread ${threadId} from ${previousState}`
  );
  return true;
}

function clearTransferredClientWire(existing, nextWs) {
  if (!existing?.wire || !existing.ws || existing.ws === nextWs) return;
  const previousLifecycle = clientWireLifecycles.get(existing.ws);
  if (previousLifecycle?.session?.wire === existing.wire) {
    previousLifecycle.session.wire = null;
  }
}

function assertWireResourceIdentity(key, wire) {
  if (!wire) return;
  for (const [existingKey, entry] of wireRegistry.entries()) {
    if (existingKey !== key && entry?.wire === wire) {
      throw new Error('Provider wire belongs to a different workspace root');
    }
  }
}

function registerWire(threadId, wire, projectRoot, ws, scopeContext = {}) {
  const scope = exactScope(scopeContext, projectRoot);
  const workspaceId = scope?.workspaceId;
  const viewId = scopeContext.viewId || null;
  const key = scope && wireKey(threadId, workspaceId, scope.projectRoot);
  if (!key) throw new Error('Workspace-scoped wire identity is required');
  const existing = wireRegistry.get(key);
  if (existing?.wire && existing.wire !== wire) {
    throw new Error('A live provider already owns this workspace thread');
  }
  assertWireResourceIdentity(key, wire);
  wireRegistry.set(key, {
    threadId,
    wire,
    projectRoot: scope.projectRoot,
    workspaceEpoch: scope.workspaceEpoch,
    ws,
    workspaceId,
    viewId,
  });
  console.log(`[WireRegistry] Registered wire for thread ${threadId.slice(0,8)}, pid: ${wire?.pid}, scope: ${viewId ? `${workspaceId}/${viewId}` : workspaceId}`);
}

function attachClientToWire(threadId, wire, projectRoot, ws, scopeContext = {}) {
  const scope = exactScope(scopeContext, projectRoot);
  const workspaceId = scope?.workspaceId;
  const key = scope && wireKey(threadId, workspaceId, scope.projectRoot);
  if (!key) return false;
  const existing = wireRegistry.get(key);
  const nextWire = wire || existing?.wire || null;
  const nextProjectRoot = scope?.projectRoot || null;

  if (!nextWire || !nextProjectRoot) {
    return false;
  }

  const viewId = Object.prototype.hasOwnProperty.call(scopeContext, 'viewId')
    ? scopeContext.viewId
    : (existing?.viewId || null);

  if (existing?.wire && existing.wire !== nextWire) {
    throw new Error('A live provider already owns this workspace thread');
  }
  assertWireResourceIdentity(key, nextWire);
  clearTransferredClientWire(existing, ws);
  wireRegistry.set(key, {
    threadId,
    wire: nextWire,
    projectRoot: nextProjectRoot,
    workspaceEpoch: scope.workspaceEpoch,
    ws,
    workspaceId,
    viewId,
  });

  if (existing?.ws !== ws) {
    console.log(`[WireRegistry] Attached client for thread ${threadId.slice(0,8)}`);
  }

  return true;
}

function unregisterWire(threadId, scopeContext, expectedWire = null) {
  const entry = getWireEntry(threadId, scopeContext);
  if (!entry || (expectedWire && entry.wire !== expectedWire)) return false;
  const key = wireKey(threadId, entry.workspaceId, entry.projectRoot);
  if (!key) return false;
  wireRegistry.delete(key);
  console.log(`[WireRegistry] Unregistered wire for thread ${threadId.slice(0,8)}`);
  return true;
}

/**
 * Remove outbound delivery for an exact connection-owned wire. Workspace
 * retirement uses this before awaiting durable session suspension so stale
 * provider output cannot cross the new workspace bind.
 */
function unregisterWireForClient(threadId, scopeContext, ws) {
  const scope = exactScope(scopeContext);
  const key = scope && wireKey(threadId, scope.workspaceId, scope.projectRoot);
  if (!key) return false;
  const existing = wireRegistry.get(key);
  if (!existing || existing.ws !== ws
    || (scope.workspaceEpoch && existing.workspaceEpoch !== scope.workspaceEpoch)) return false;
  wireRegistry.delete(key);
  console.log(`[WireRegistry] Unregistered retired client wire for thread ${threadId.slice(0,8)}`);
  return true;
}

/**
 * CHAT_SCOPE_SPEC: return the structured `workspace:` string for a thread's
 * wire by reading the registry, for callers that don't have `session` access.
 * Returns null if the thread isn't registered.
 */
function getScopeForThread(threadId, scopeContext) {
  const entry = getWireEntry(threadId, scopeContext);
  if (!entry) return null;
  const { workspaceId: entryWorkspaceId, viewId } = entry;
  if (!entryWorkspaceId) return 'workspace:unknown';
  return viewId
    ? `workspace:${entryWorkspaceId}, ${viewId}`
    : `workspace:${entryWorkspaceId}`;
}

// ── Marshalling ─────────────────────────────────────────────────────────────

function sendToWire(wire, method, params, id = null) {
  const message = {
    jsonrpc: '2.0',
    method,
    params
  };
  if (id) {
    message.id = id;
  }
  const json = JSON.stringify(message);
  console.log('[→ Wire]:', method, json.slice(0, 300));
  if (wire && wire.stdin && !wire.killed) {
    wire.stdin.write(json + '\n');
    console.log('[→ Wire] SENT:', method);
  } else {
    console.error('[→ Wire] FAILED: wire not ready (killed:', wire?.killed, ', stdin:', !!wire?.stdin, ')');
  }
}

// ── Per-connection lifecycle ────────────────────────────────────────────────

/**
 * Create the per-connection wire lifecycle helpers. Call this once per
 * WebSocket connection inside wss.on('connection'), passing the connection's
 * session state object, the ws, the connection id, and a callback that
 * handles parsed wire messages (i.e. the current `handleWireMessage` inside
 * the connection handler).
 *
 * @param {object} deps
 * @param {object} deps.session - per-connection session state (mutated by setupWireHandlers)
 * @param {import('ws').WebSocket} deps.ws
 * @param {string} deps.connectionId
 * @param {(msg: object) => void} deps.onWireMessage - invoked per parsed wire line
 * @returns {{ awaitHarnessReady, initializeWire, setupWireHandlers }}
 */
function createWireLifecycle({ session, ws, connectionId, onWireMessage }) {
  const lifecycle = Object.freeze({ session, ws, connectionId, onWireMessage });
  clientWireLifecycles.set(ws, lifecycle);

  /**
   * If wire was spawned via the new harness (has _harnessPromise), wait for
   * it to resolve before attaching stdout listeners. For legacy Kimi wires
   * this is a no-op.
   */
  async function awaitHarnessReady(wire) {
    if (wire._harnessPromise) {
      console.log('[WS] Awaiting harness initialization...');
      await wire._harnessPromise;
      console.log('[WS] Harness ready');
    }
  }

  function initializeWire(wire) {
    // Skip for new-harness wires — ACP session is already initialized inside the harness
    if (wire._harnessPromise) {
      console.log('[Wire] Skipping initialize for new harness (ACP already initialized)');
      return;
    }
    const id = generateId();
    console.log('[Wire] Initializing wire...');
    sendToWire(wire, 'initialize', {
      protocol_version: '1.4',
      client: { name: 'fusion-studio', version: '0.1.0' },
      capabilities: { supports_question: true }
    }, id);
    console.log('[Wire] Initialize sent with id:', id);
  }

  function setupWireHandlers(wire, threadId, scopeContext = {}) {
    const scope = exactScope(scopeContext);
    if (!scope) throw new Error('Wire handlers require exact workspace/root identity');
    let buffer = '';
    wire.stdout.on('data', (data) => {
      const entry = getWireEntry(threadId, scope);
      // Before registration, the spawning lifecycle is authoritative. After
      // registration, only the registry's exact current client may consume
      // provider output.
      const currentLifecycle = entry?.wire === wire
        ? clientWireLifecycles.get(entry.ws)
        : (!entry ? lifecycle : null);
      if (!currentLifecycle) return;

      buffer += data.toString();

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        console.log('[← Wire]:', line.length > 500 ? line.slice(0, 500) + '...' : line);
        logWire('WIRE_IN', line);

        try {
          const msg = JSON.parse(line);
          currentLifecycle.onWireMessage(msg);
        } catch (err) {
          console.error('[Wire] Parse error:', err.message);
          if (currentLifecycle.ws.readyState === 1) {
            currentLifecycle.ws.send(JSON.stringify({ type: 'parse_error', line: line.slice(0, 200) }));
          }
        }
      }
    });

    wire.on('exit', (code) => {
      console.log(`[Wire] Session ${connectionId} exited with code ${code}`);
      const entry = getWireEntry(threadId, scope);
      const ownerLifecycle = entry?.wire === wire
        ? clientWireLifecycles.get(entry.ws)
        : null;
      const ownerStillOwnsWire = ownerLifecycle?.session?.wire === wire;
      if (ownerStillOwnsWire) ownerLifecycle.session.wire = null;
      // Only unregister and notify the exact current registry owner. A wire
      // exit after retirement, replacement, or transfer must not mutate or
      // notify the spawning connection.
      if (entry?.wire === wire) {
        unregisterWire(threadId, scope, wire);
      }
      if (ownerStillOwnsWire && ownerLifecycle.ws.readyState === 1) {
        ownerLifecycle.ws.send(JSON.stringify({ type: 'wire_disconnected', code }));
      }
    });
  }

  return { awaitHarnessReady, initializeWire, setupWireHandlers };
}

module.exports = {
  // Registry
  getWireForThread,
  getClientForThread,
  reclaimClientForWire,
  registerWire,
  attachClientToWire,
  unregisterWire,
  unregisterWireForClient,
  getScopeForThread,
  // Marshalling
  sendToWire,
  // Per-connection factory
  createWireLifecycle,
};
