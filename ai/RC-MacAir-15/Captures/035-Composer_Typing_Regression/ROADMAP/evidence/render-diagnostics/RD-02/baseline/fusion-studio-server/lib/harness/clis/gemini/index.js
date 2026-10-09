const { BaseCLIHarness } = require('../base-cli-harness');
const { AcpWireParser } = require('./acp-wire-parser');
const { AcpEventTranslator } = require('./acp-event-translator');
const { GeminiSessionState } = require('./session-state');
const { PassThrough } = require('stream');
const { buildHarnessChildEnvironment } = require('../../child-environment');

/**
 * @typedef {import('../../types').HarnessConfig} HarnessConfig
 * @typedef {import('../../types').HarnessSession} HarnessSession
 * @typedef {import('../../types').SendOptions} SendOptions
 * @typedef {import('../../types').CanonicalEvent} CanonicalEvent
 */

/**
 * Gemini CLI harness implementation using ACP (Agent Client Protocol).
 * 
 * Wraps `gemini --acp` and translates the JSON-RPC protocol to canonical events.
 * 
 * ACP is an open protocol for IDE-agent communication:
 * @see https://agentclientprotocol.com/
 * 
 * Unlike stream-json mode, ACP provides:
 * - Rich tool call metadata (titles, locations)
 * - Session management
 * - Permission handling
 * - Multi-turn conversation support
 */
class GeminiHarness extends BaseCLIHarness {
  constructor() {
    super({
      id: 'gemini',
      name: 'Gemini (Google)',
      cliName: 'gemini',
      provider: 'google'
    });

    this.defaultModel = 'auto-gemini-3';
    this.defaultMode = 'yolo';
    
    /** @type {Map<string, GeminiSessionState>} */
    this.sessionStates = new Map();
    /** @type {Map<string, AcpEventTranslator>} */
    this.translators = new Map();
  }

  /**
   * @param {HarnessConfig} config
   */
  async initialize(config) {
    this.config = {
      model: this.defaultModel,
      mode: this.defaultMode,
      ...config
    };

    await super.initialize(config);
  }

  /**
   * Get the installation command for Gemini CLI.
   * @returns {string}
   */
  getInstallCommand() {
    return 'npm install -g @google/gemini-cli';
  }

  /**
   * Get spawn arguments for Gemini CLI in ACP mode.
   * 
   * @param {string} threadId
   * @param {string} projectRoot
   * @returns {string[]}
   */
  getSpawnArgs(threadId, projectRoot, runtimeConfig = this.config) {
    const args = [
      '--acp',
      '--approval-mode', runtimeConfig.mode || this.defaultMode
    ];

    if (runtimeConfig.model) {
      args.push('--model', runtimeConfig.model);
    }

    return args;
  }

  /**
   * Create an ACP wire parser for Gemini's protocol.
   * @returns {AcpWireParser}
   */
  createWireParser() {
    return new AcpWireParser();
  }

  /**
   * Start a new thread with this harness.
   * Spawns the Gemini CLI process and sets up ACP wire parsing.
   *
   * @param {string} threadId
   * @param {string} projectRoot
   * @param {{ workspaceId?: string, viewId?: string|null }} [scopeContext]
   * @returns {Promise<HarnessSession>}
   */
  async startThread(threadId, projectRoot, scopeContext = {}, threadOptions = {}) {
    const runtimeConfig = { ...(threadOptions.runtimeConfig || this.config) };
    const cliPath = runtimeConfig.cliPath || this.cliPath;
    if (!cliPath) {
      throw new Error(`Harness not initialized. Call initialize() first.`);
    }

    const sessionKey = threadOptions.sessionKey
      || this._createSessionKey(threadId, projectRoot, scopeContext);
    this._captureScope(sessionKey, projectRoot, scopeContext);
    const args = this.getSpawnArgs(threadId, projectRoot, runtimeConfig);
    
    const { spawn } = require('child_process');
    const proc = spawn(cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: projectRoot,
      env: buildHarnessChildEnvironment('gemini', {
        overrides: { TERM: 'xterm-256color' },
      })
    });

    console.log(`[${this.name}] Spawned ${cliPath} (pid: ${proc.pid})`);

    // Set up session state and translator
    const state = new GeminiSessionState();
    this.sessionStates.set(sessionKey, state);
    
    const translator = new AcpEventTranslator(state);
    this.translators.set(sessionKey, translator);

    // Set up wire parsing
    const parser = this.createWireParser();
    
    // Create a compatible stdout stream for server.js
    const compatibleStdout = new PassThrough();

    // Set up stdout parsing
    proc.stdout.on('data', (data) => {
      parser.feed(data.toString());
    });

    // Handle parser events
    parser.on('message', (msg) => {
      const events = this.translateMessage(msg, sessionKey);
      if (events) {
        const eventArray = Array.isArray(events) ? events : [events];
        for (const event of eventArray) {
          this.emit('event', { threadId, sessionKey, event });
          // Emit Kimi-compatible JSON on compatibleStdout for server.js
          const kimiMsg = this.serializeToKimiWire(event);
          if (kimiMsg) {
            compatibleStdout.write(JSON.stringify(kimiMsg) + '\n');
          }
        }
      }
    });

    parser.on('parse_error', (line, err, lineNum) => {
      console.error(`[${this.name}] Parse error at line ${lineNum}:`, err.message);
      this.emit('parse_error', { threadId, sessionKey, line, error: err, lineNum });
    });

    // Handle process events
    proc.on('error', (err) => {
      console.error(`[${this.name}] Process error (pid: ${proc.pid}):`, err.message);
      this.emit('error', { threadId, sessionKey, error: err });
    });

    proc.on('exit', (code) => {
      console.log(`[${this.name}] Process exited (pid: ${proc.pid}, code: ${code})`);
      this.cleanupSession(sessionKey);
      this.emit('exit', { threadId, sessionKey, code });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      // Filter out non-error messages
      if (text && !text.includes('YOLO mode') && !text.includes('Ignore file') && !text.includes('Hook')) {
        console.error(`[${this.name}:stderr] ${text}`);
      }
    });

    // Initialize ACP session
    await this.initializeAcpSession(proc, sessionKey, projectRoot);

    const self = this;
    /** @type {HarnessSession} */
    const session = {
      threadId,
      sessionKey,
      process: proc,
      compatibleStdout,
      async *sendMessage(message, options = {}) {
        // Send prompt via ACP
        const requestId = Date.now();
        const acpRequest = {
          jsonrpc: '2.0',
          id: requestId,
          method: 'session/prompt',
          params: {
            sessionId: state.sessionId,
            prompt: [{ type: 'text', text: message }]
          }
        };

        yield* self._streamCanonicalEvents(threadId, () => {
          proc.stdin.write(JSON.stringify(acpRequest) + '\n');
        }, sessionKey);
      },
      async stop(signal = 'SIGTERM') {
        if (!proc.killed) {
          proc.kill(signal);
        }
      }
    };

    this.sessions.set(sessionKey, session);
    return session;
  }

  /**
   * Initialize the ACP session by sending initialize and session/new requests.
   * @private
   */
  async initializeAcpSession(proc, sessionKey, projectRoot) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ACP initialization timeout'));
      }, 30000);

      let initComplete = false;
      let sessionCreated = false;

      const checkComplete = () => {
        if (initComplete && sessionCreated) {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Set up one-time listener for initialization responses
      const handler = (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            
            if (msg.id === 1 && msg.result) {
              initComplete = true;
              checkComplete();
            }
            
            if (msg.id === 2 && msg.result?.sessionId) {
              const state = this.sessionStates.get(sessionKey);
              if (state) {
                state.setSessionInfo(
                  msg.result.sessionId,
                  msg.result.models,
                  msg.result.modes?.currentModeId
                );
              }
              sessionCreated = true;
              checkComplete();
            }
          } catch (e) {}
        }
      };

      proc.stdout.on('data', handler);

      // Send initialize
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: 1,
          capabilities: {},
          clientInfo: {
            name: 'fusion-studio',
            version: '1.0.0'
          }
        }
      };
      proc.stdin.write(JSON.stringify(initRequest) + '\n');

      // Send session/new after a short delay
      setTimeout(() => {
        const sessionRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'session/new',
          params: {
            cwd: projectRoot,
            mcpServers: []
          }
        };
        proc.stdin.write(JSON.stringify(sessionRequest) + '\n');
      }, 100);
    });
  }

  /**
   * Translate an ACP message to canonical event(s).
   * 
   * @param {import('./acp-wire-parser').AcpMessage} msg
   * @param {string} threadId
   * @returns {import('../../types').CanonicalEvent | import('../../types').CanonicalEvent[] | null}
   */
  translateMessage(msg, sessionKey) {
    const translator = this.translators.get(sessionKey);
    if (!translator) {
      console.warn(`[${this.name}] No translator found for thread ${threadId}`);
      return null;
    }
    return translator.translate(msg);
  }

  /**
   * Clean up session resources.
   * @private
   */
  cleanupSession(sessionKey) {
    this.sessionStates.delete(sessionKey);
    this.translators.delete(sessionKey);
    this.sessions.delete(sessionKey);
    this.threadScopes.delete(sessionKey);
  }

  /**
   * Get session state for debugging.
   * @param {string} threadId
   * @returns {GeminiSessionState | undefined}
   */
  getSessionState(threadId) {
    const exact = this.sessionStates.get(threadId);
    if (exact) return exact;
    const matches = [...this.sessions.entries()]
      .filter(([, session]) => session.threadId === threadId)
      .map(([sessionKey]) => this.sessionStates.get(sessionKey));
    return matches.length === 1 ? matches[0] : undefined;
  }

  /**
   * Dispose of all sessions and clean up.
   */
  async dispose() {
    for (const [threadId, session] of this.sessions) {
      await session.stop();
    }
    this.sessions.clear();
    this.sessionStates.clear();
    this.translators.clear();
  }
}

module.exports = { GeminiHarness };
