const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { WireParser } = require('./wire-parser');
const { EventTranslator } = require('./event-translator');
const { KimiSessionState } = require('./session-state');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// CHAT_SCOPE_SPEC: build the structured `workspace:` string from spawn-time
// context. Matches lib/chat-scope.js::resolveScope but without a session —
// harnesses capture the scope at startThread() and keep it for the thread's
// lifetime.
function buildScopeString(workspaceId, viewId) {
  if (!workspaceId) return 'workspace:unknown';
  return viewId ? `workspace:${workspaceId}, ${viewId}` : `workspace:${workspaceId}`;
}

function makeWireError(error) {
  const err = new Error(error.message || 'Wire error');
  if (error.code !== undefined) {
    err.code = error.code;
  }
  return err;
}

/**
 * @typedef {Object} KimiSession
 * @property {string} threadId
 * @property {import('child_process').ChildProcess} process
 * @property {KimiSessionState} state
 * @property {WireParser} parser
 * @property {(message: string, options?: import('../types').SendOptions) => AsyncIterable<import('../types').CanonicalEvent>} sendMessage
 * @property {() => Promise<void>} stop
 */

/**
 * KIMI CLI harness implementation.
 *
 * Wraps `kimi --wire --yolo` and translates JSON-RPC protocol
 * to canonical events.
 */
class KimiHarness extends EventEmitter {
  constructor() {
    super();
    this.id = 'kimi';
    this.name = 'KIMI CLI';
    this.provider = 'kimi';

    /** @type {import('../types').HarnessConfig} */
    this.config = {};
    /** @type {Map<string, RobinSession>} */
    this.sessions = new Map();
  }

  /**
   * @param {import('../types').HarnessConfig} config
   */
  async initialize(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * @param {string} threadId
   * @param {string} projectRoot
   * @param {{ workspaceId?: string, viewId?: string|null }} [scopeContext]
   * @returns {Promise<import('../types').HarnessSession>}
   */
  async startThread(threadId, projectRoot, scopeContext = {}) {
    const workspaceId = scopeContext.workspaceId || (projectRoot ? path.basename(projectRoot) : null);
    const viewId = scopeContext.viewId || null;
    const scopeString = buildScopeString(workspaceId, viewId);
    const robinPath = this.config.cliPath || process.env.KIMI_PATH || 'kimi';
    const args = ['--wire', '--yolo', '--session', threadId];

    if (projectRoot) {
      args.push('--work-dir', projectRoot);
    }

    const proc = spawn(robinPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'xterm-256color' }
    });

    // Log spawn for debugging
    console.log(`[KimiHarness] Spawned ${robinPath} ${args.join(' ')} (pid: ${proc.pid})`);

    const harness = this;
    const state = new KimiSessionState();
    const parser = new WireParser();
    const translator = new EventTranslator(state);

    /** @type {Set<string>} */
    const initializedSessions = new Set();
    let nextRequestId = 1;

    const session = {
      threadId,
      process: proc,
      state,
      parser,
      scopeString,
      stopRequested: false,
      async *sendMessage(message, options = {}) {
        const events = [];
        let done = false;
        let failure = null;

        const onEvent = ({ threadId: tid, event }) => {
          if (tid !== threadId) return;
          events.push(event);
          if (event.type === 'turn_end') done = true;
        };

        const onError = ({ threadId: tid, id, error }) => {
          if (tid !== threadId) return;
          failure = makeWireError(error);
          done = true;
        };

        const onExit = ({ threadId: tid, code }) => {
          if (tid !== threadId) return;
          if (!session.stopRequested) {
            failure = new Error(`Kimi process exited during active send (code: ${code ?? 'unknown'})`);
          }
          done = true;
        };

        harness.on('event', onEvent);
        harness.on('response_error', onError);
        harness.on('exit', onExit);

        try {
          // Send initialize once per session
          if (!initializedSessions.has(threadId)) {
            const initId = String(nextRequestId++);
            harness.sendToThread(threadId, 'initialize', {
              protocol_version: '1.4',
              client: { name: 'fusion-studio', version: '0.1.0' },
              capabilities: { supports_question: true }
            }, initId);
            initializedSessions.add(threadId);
          }

          // Send prompt
          const promptId = String(nextRequestId++);
          const params = { user_input: message };
          if (options.system !== undefined) {
            params.system = options.system;
          }
          harness.sendToThread(threadId, 'prompt', params, promptId);

          while (!done || events.length > 0) {
            while (events.length > 0) yield events.shift();
            if (failure) throw failure;
            if (!done) await delay(25);
          }
          if (failure) throw failure;
        } finally {
          harness.off('event', onEvent);
          harness.off('response_error', onError);
          harness.off('exit', onExit);
        }
      },
      async stop() {
        session.stopRequested = true;
        if (!proc.killed) {
          proc.kill('SIGTERM');
        }
      }
    };

    // Set up stdout parsing
    proc.stdout.on('data', (data) => {
      parser.feed(data.toString());
    });

    // Handle parse errors
    parser.on('parse_error', (line, err, lineNum) => {
      console.error(`[KimiHarness] Parse error at line ${lineNum}:`, err.message);
      this.emit('parse_error', { threadId, line, error: err, lineNum });
    });

    // Handle wire messages
    parser.on('message', (msg) => {
      if (msg.method === 'event') {
        const events = translator.translate(msg);
        if (events) {
          const eventArray = Array.isArray(events) ? events : [events];
          for (const event of eventArray) {
            this.emit('event', { threadId, event });
          }
        }
        return;
      }

      if (msg.id !== undefined && msg.error) {
        this.emit('response_error', { threadId, id: msg.id, error: msg.error });
        return;
      }

      if (msg.id !== undefined && msg.result !== undefined) {
        this.emit('response_result', { threadId, id: msg.id, result: msg.result });
      }
    });

    // Handle process events
    proc.on('error', (err) => {
      console.error(`[KimiHarness] Process error (pid: ${proc.pid}):`, err.message);
      this.emit('error', { threadId, error: err });
    });

    proc.on('exit', (code) => {
      console.log(`[KimiHarness] Process exited (pid: ${proc.pid}, code: ${code})`);
      this.sessions.delete(threadId);
      this.emit('exit', { threadId, code });
    });

    proc.stderr.on('data', (data) => {
      console.error(`[KimiHarness:stderr] ${data.toString().trim()}`);
    });

    this.sessions.set(threadId, session);
    return session;
  }

  async dispose() {
    // Kill all active sessions
    for (const [threadId, session] of this.sessions) {
      await session.stop();
    }
    this.sessions.clear();
  }

  /**
   * Get an active session by thread ID.
   * @param {string} threadId
   * @returns {RobinSession | undefined}
   */
  getSession(threadId) {
    return this.sessions.get(threadId);
  }

  /**
   * Send a message to a specific thread's wire process.
   * This is the low-level method; most callers should use session.sendMessage().
   * @param {string} threadId
   * @param {string} method
   * @param {unknown} params
   * @param {string} [id]
   * @returns {boolean}
   */
  sendToThread(threadId, method, params, id) {
    const session = this.sessions.get(threadId);
    if (!session || session.process.killed) {
      return false;
    }

    const message = {
      jsonrpc: '2.0',
      method,
      params,
      ...(id && { id })
    };

    const json = JSON.stringify(message);
    session.process.stdin.write(json + '\n');
    return true;
  }
}

module.exports = { KimiHarness };
