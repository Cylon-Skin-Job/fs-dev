const { BaseCLIHarness } = require('../base-cli-harness');
const { AcpWireParser } = require('./acp-wire-parser');
const { CodexEventTranslator } = require('./acp-event-translator');
const { CodexSessionState } = require('./session-state');
const { buildHarnessChildEnvironment } = require('../../child-environment');

/**
 * @typedef {import('../../types').HarnessConfig} HarnessConfig
 * @typedef {import('../../types').HarnessSession} HarnessSession
 * @typedef {import('../../types').CanonicalEvent} CanonicalEvent
 */

/**
 * Codex CLI harness implementation using ACP (Agent Client Protocol).
 * 
 * Wraps `codex-acp` (Zed's adapter) and translates the JSON-RPC protocol to canonical events.
 * 
 * ACP is an open protocol for IDE-agent communication:
 * @see https://agentclientprotocol.com/
 * 
 * Unlike the direct app-server mode, ACP provides:
 * - Standardized tool call lifecycle
 * - Session management
 * - Multi-turn conversation support
 */
class CodexHarness extends BaseCLIHarness {
  constructor() {
    super({
      id: 'codex',
      name: 'Codex (OpenAI)',
      cliName: 'codex-acp',
      provider: 'openai'
    });

    this.defaultModel = 'gpt-4o';
    this.defaultMode = 'full-auto';
    
    /** @type {Map<string, CodexSessionState>} */
    this.sessionStates = new Map();
    /** @type {Map<string, CodexEventTranslator>} */
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

    // If cliName is explicitly provided in config, use it
    if (config.cliName) {
      this.cliName = config.cliName;
    }

    await super.initialize(config);
  }

  /**
   * Get the installation command for Codex ACP adapter.
   * @returns {string}
   */
  getInstallCommand() {
    return 'npm install -g @openai/codex-acp';
  }

  /**
   * Get spawn arguments for Codex CLI in ACP mode.
   * 
   * @param {string} threadId
   * @param {string} projectRoot
   * @returns {string[]}
   */
  getSpawnArgs(threadId, projectRoot, runtimeConfig = this.config) {
    const args = [
      '--mode', runtimeConfig.mode || this.defaultMode,
      '--model', runtimeConfig.model || this.defaultModel
    ];

    // Note: codex-acp might not need --acp flag as it IS the acp adapter
    // but some versions might use it. Following spec examples:
    // codex-acp --mode full-auto --model gpt-4o

    return args;
  }

  /**
   * Create an ACP wire parser for Codex's protocol.
   * @returns {AcpWireParser}
   */
  createWireParser() {
    return new AcpWireParser();
  }

  /**
   * Start a new thread with this harness.
   * Spawns the Codex-ACP process and sets up ACP wire parsing.
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
      env: buildHarnessChildEnvironment('codex', {
        overrides: { TERM: 'xterm-256color' },
      })
    });

    console.log(`[${this.name}] Spawned ${cliPath} (pid: ${proc.pid})`);

    // Set up session state and translator
    const state = new CodexSessionState();
    this.sessionStates.set(sessionKey, state);
    
    const translator = new CodexEventTranslator(state);
    this.translators.set(sessionKey, translator);

    // Set up wire parsing
    const parser = this.createWireParser();

    // Compatible stdout stream for compat.js (Kimi-wire format)
    const { PassThrough } = require('stream');
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
      console.error(`[${this.name}:stderr] ${data.toString().trim()}`);
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
        reject(new Error('Codex ACP initialization timeout'));
      }, 30000);

      let initComplete = false;
      let sessionCreated = false;

      const checkComplete = () => {
        if (initComplete && sessionCreated) {
          clearTimeout(timeout);
          resolve();
        }
      };

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

      // Step 1: Initialize
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: 1,
          clientInfo: { name: 'fusion-studio', version: '1.0.0' }
        }
      };
      proc.stdin.write(JSON.stringify(initRequest) + '\n');

      // Step 2: Session/new
      setTimeout(() => {
        const sessionRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'session/new',
          params: {
            cwd: projectRoot
          }
        };
        proc.stdin.write(JSON.stringify(sessionRequest) + '\n');
      }, 100);
    });
  }

  /**
   * Translate an ACP message to canonical event(s).
   * 
   * @param {any} msg
   * @param {string} threadId
   * @returns {import('../../types').CanonicalEvent | import('../../types').CanonicalEvent[] | null}
   */
  translateMessage(msg, sessionKey) {
    const translator = this.translators.get(sessionKey);
    if (!translator) {
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

module.exports = { CodexHarness };
