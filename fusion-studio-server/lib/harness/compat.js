/**
 * Compatibility shim for gradual harness migration.
 *
 * This module provides drop-in replacements for all wire-related
 * functions in server.js. The implementation chosen depends on
 * the current feature flag state.
 *
 * Usage in server.js:
 *   const { spawnThreadWire, getModeStatus } = require('./lib/harness/compat');
 *
 * @see ../specs/PHASE-2-COMPATIBILITY-LAYER-SPEC.md
 */

const path = require('path');

const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

const { KimiHarness } = require('./kimi');
const { registry } = require('./registry');
const { getDb } = require('../db');
const { resolveCliPolicy } = require('../cli-config');

// Singleton harness instance (lazy-loaded)
/** @type {KimiHarness | null} */
let defaultHarness = null;
/** @type {Promise<void> | null} */
let harnessInitPromise = null;

/**
 * Get or create the singleton default harness instance.
 * @returns {KimiHarness}
 */
function getDefaultHarness() {
  if (!defaultHarness) {
    defaultHarness = new KimiHarness();
    harnessInitPromise = defaultHarness.initialize({});
    harnessInitPromise.catch(err => {
      console.error('[Compat] Failed to initialize default harness:', err);
    });
  }
  return defaultHarness;
}

/**
 * Wait for harness initialization (call before using harness).
 * @returns {Promise<void>}
 */
async function ensureHarnessReady() {
  if (harnessInitPromise) {
    await harnessInitPromise;
  }
}

function parseHarnessConfig(rawConfig) {
  if (!rawConfig) return {};
  try {
    return JSON.parse(rawConfig) || {};
  } catch {
    return {};
  }
}

/**
 * Fetch harness metadata for a thread from the database.
 * @param {string} threadId
 * @returns {Promise<{ harnessId: string, harnessConfig: object }>}
 */
async function getHarnessInfoForThread(threadId) {
  try {
    const db = getDb();
    const row = await db('threads')
      .where('thread_id', threadId)
      .select('harness_id', 'harness_config')
      .first();
    return {
      harnessId: row?.harness_id || 'kimi',
      harnessConfig: parseHarnessConfig(row?.harness_config),
    };
  } catch (err) {
    // If DB not ready or thread not found, default to kimi
    return { harnessId: 'kimi', harnessConfig: {} };
  }
}

async function updateThreadHarnessConfig(threadId, patch) {
  const db = getDb();
  const row = await db('threads')
    .where('thread_id', threadId)
    .select('harness_config')
    .first();
  if (!row) return null;

  const harnessConfig = { ...parseHarnessConfig(row.harness_config), ...patch };
  await db('threads')
    .where('thread_id', threadId)
    .update({ harness_config: JSON.stringify(harnessConfig) });
  return harnessConfig;
}

function defaultRuntimeConfigForHarness(harnessId) {
  if (harnessId === 'opencode') {
    return {
      model: null,
      variant: null,
      thinking: false,
      pure: false,
    };
  }
  return {};
}

async function resolveRuntimeConfigForHarness(projectRoot, harnessId) {
  const defaults = defaultRuntimeConfigForHarness(harnessId);
  try {
    const policy = await resolveCliPolicy(projectRoot);
    const runtime = policy.config?.[harnessId]?.runtime || {};
    return { ...defaults, ...runtime };
  } catch (err) {
    console.warn(`[Compat] Failed to resolve runtime config for ${harnessId}: ${err.message}`);
    return defaults;
  }
}

// ============================================================================
// DIRECT HARNESS IMPLEMENTATION
// ============================================================================

// ============================================================================
// PROCESS PROXY
// ============================================================================

/**
 * Create a process-like placeholder while an async harness session starts.
 * It is intentionally not an OS child process: the real harness process is
 * wired in after startThread() resolves, and spawning a stand-in process here
 * can leak or fire misleading lifecycle events.
 * @returns {import('child_process').ChildProcess}
 */
function createDeferredProcessProxy() {
  const proc = new EventEmitter();
  proc.pid = null;
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.kill = (signal = 'SIGTERM') => {
    if (proc.killed) return false;
    proc.killed = true;
    process.nextTick(() => {
      proc.emit('exit', null, signal);
      proc.emit('close', null, signal);
    });
    return true;
  };
  return proc;
}

// ============================================================================
// PUBLIC API (exported functions)
// ============================================================================

/**
 * Spawn a wire process for a thread via the direct harness path.
 *
 * This is the drop-in replacement for server.js:spawnThreadWire().
 * Always uses the direct harness registry path; legacy and parallel
 * modes have been retired.
 *
 * @param {string} threadId
 * @param {string} projectRoot
 * @param {{ workspaceId?: string, viewId?: string|null }} [scopeContext]
 *   CHAT_SCOPE_SPEC: flows to the harness so its emit calls can build the
 *   structured `workspace:` string for the event bus. Falls back to
 *   `path.basename(projectRoot)` and `null` when absent.
 * @returns {import('child_process').ChildProcess}
 */
function spawnThreadWire(threadId, projectRoot, scopeContext = {}) {
  const workspaceId = scopeContext.workspaceId || path.basename(projectRoot);
  const viewId = scopeContext.viewId || null;
  const resolvedScope = { workspaceId, viewId };

  console.log(`[Compat] Using NEW harness for thread ${threadId.slice(0, 8)}...`);

  const dummyProc = createDeferredProcessProxy();

  const startHarness = async () => {
    const { harnessId, harnessConfig } = await getHarnessInfoForThread(threadId);
    const harness = registry.get(harnessId);

    if (!harness) {
      throw new Error(`Harness not found: ${harnessId}`);
    }

    const runtimeConfig = await resolveRuntimeConfigForHarness(projectRoot, harnessId);
    await harness.initialize(runtimeConfig);
    return await harness.startThread(threadId, projectRoot, resolvedScope, {
      harnessConfig,
      updateHarnessConfig: (patch) => updateThreadHarnessConfig(threadId, patch),
    });
  };

  const sessionPromise = startHarness();

  // Store the promise so callers can wait if needed
  /** @ts-ignore */
  dummyProc._harnessPromise = sessionPromise;

  sessionPromise.then(session => {
    if (dummyProc.killed) {
      session.stop?.().catch(err => {
        console.error('[Compat] Failed to stop cancelled harness session:', err);
      });
      return;
    }

    // Replace the dummy process properties with the real ones
    const realProc = session.process;
    dummyProc.pid = realProc.pid;
    dummyProc.stdin = realProc.stdin;

    // Prefer direct canonical events whenever sendMessage exists
    if (session.sendMessage) {
      dummyProc._usesDirectCanonicalEvents = true;
      // Provide an inert stdout so setupWireHandlers doesn't parse raw vendor output
      dummyProc.stdout = new PassThrough();
    } else if (session.compatibleStdout) {
      // Only if a non-sendMessage harness genuinely needs a temporary bridge
      dummyProc.stdout = session.compatibleStdout;
    } else {
      // Fallback: raw stdout
      dummyProc.stdout = realProc.stdout;
    }

    dummyProc.stderr = realProc.stderr;

    // The process exposed by a harness can be a placeholder rather than the
    // process used for an individual turn (OpenCode is one example). Keep the
    // outer wire's lifecycle authoritative so SessionManager idle expiry is
    // visible to the wire registry and runtime controller.
    let exitEmitted = false;
    const emitExitOnce = (code = null, signal = null) => {
      if (exitEmitted) return;
      exitEmitted = true;
      dummyProc.killed = true;
      dummyProc.emit('exit', code, signal);
      dummyProc.emit('close', code, signal);
    };

    dummyProc.killed = false;
    dummyProc.kill = (signal = 'SIGTERM') => {
      if (dummyProc.killed) return false;
      dummyProc.killed = true;
      Promise.resolve(session.stop?.()).catch(err => {
        console.error('[Compat] Failed to stop harness session:', err);
      });
      process.nextTick(() => emitExitOnce(null, signal));
      return true;
    };

    // Re-emit events from real process
    realProc.on('error', (err) => dummyProc.emit('error', err));
    realProc.on('exit', (code, signal) => emitExitOnce(code, signal));
    realProc.on('close', (code, signal) => emitExitOnce(code, signal));

    // Expose ACP sendMessage so server.js can route prompts correctly
    dummyProc._sendMessage = (message, options) => session.sendMessage(message, options);
    dummyProc._stopSession = () => session.stop?.();
    dummyProc._applyHarnessConfig = (patch) => session.applyHarnessConfig?.(patch);

    console.log(`[Compat] ${session.threadId} harness ready, pid: ${realProc.pid}, directCanonical: ${!!dummyProc._usesDirectCanonicalEvents}`);
  }).catch(err => {
    console.error('[Compat] Failed to start harness session:', err);
    dummyProc.emit('error', err);
  });

  return dummyProc;
}

/**
 * Send a message to a thread's wire process.
 *
 * This is a new function needed for the harness-based approach.
 * Legacy code writes directly to process.stdin.
 *
 * @param {string} threadId
 * @param {string} message
 * @param {Object} [options]
 * @param {string} [options.system]
 * @param {Array<{role: string; content: string}>} [options.history]
 * @returns {Promise<void>}
 */
async function sendToThread(threadId, message, options = {}) {
  await ensureHarnessReady();
  const harness = getDefaultHarness();

  const session = harness.getSession(threadId);
  if (!session) {
    throw new Error(`No active session for thread ${threadId}`);
  }

  // Send via harness
  harness.sendToThread(threadId, 'prompt', {
    message,
    system: options.system,
    history: options.history
  });
}

/**
 * Get current mode status for debugging.
 * @param {string} [threadId]
 * @returns {{
 *   mode: import('./feature-flags').HarnessMode;
 *   harnessInitialized: boolean;
 *   activeSessions: string[];
 * }}
 */
function getModeStatus(threadId) {
  return {
    mode: getHarnessMode(threadId),
    harnessInitialized: defaultHarness !== null,
    activeSessions: defaultHarness ? Array.from(defaultHarness.sessions.keys()) : []
  };
}

module.exports = {
  spawnThreadWire,
  sendToThread,
  getModeStatus,
  _test: {
    getHarnessInfoForThread,
    parseHarnessConfig,
  },
};
