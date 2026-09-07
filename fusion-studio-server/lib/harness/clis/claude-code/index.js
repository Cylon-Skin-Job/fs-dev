const { BaseCLIHarness } = require('../base-cli-harness');
const { AcpWireParser } = require('./acp-wire-parser');
const { ClaudeAcpEventTranslator } = require('./acp-event-translator');
const { ClaudeSessionState } = require('./session-state');
const { PassThrough } = require('stream');
const { buildHarnessChildEnvironment } = require('../../child-environment');

/**
 * @typedef {import('../../types').HarnessConfig} HarnessConfig
 * @typedef {import('../../types').HarnessSession} HarnessSession
 * @typedef {import('../../types').SendOptions} SendOptions
 * @typedef {import('../../types').CanonicalEvent} CanonicalEvent
 */

/**
 * Claude Code CLI harness implementation using ACP (Agent Client Protocol).
 * 
 * Wraps `claude --acp` and translates the JSON-RPC protocol to canonical events.
 */
class ClaudeCodeHarness extends BaseCLIHarness {
  constructor() {
    super({
      id: 'claude-code',
      name: 'Claude Code (Anthropic)',
      cliName: 'claude',
      provider: 'anthropic'
    });

    this.defaultModel = 'claude-3-5-sonnet-latest';
    this.defaultMode = 'auto';
    
    /** @type {Map<string, ClaudeSessionState>} */
    this.sessionStates = new Map();
    /** @type {Map<string, ClaudeAcpEventTranslator>} */
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
   * Get the installation command for Claude Code CLI.
   * @returns {string}
   */
  getInstallCommand() {
    return 'npm install -g @anthropic-ai/claude-code';
  }

  /**
   * Get spawn arguments for Claude Code CLI in ACP mode.
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
   * Create an ACP wire parser.
   * @returns {AcpWireParser}
   */
  createWireParser() {
    return new AcpWireParser();
  }

  /**
   * Start a new thread with this harness.
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
      env: buildHarnessChildEnvironment('claude-code', {
        overrides: { TERM: 'xterm-256color' },
      })
    });

    console.log(`[${this.name}] Spawned ${cliPath} (pid: ${proc.pid})`);

    // Set up session state and translator
    const state = new ClaudeSessionState();
    this.sessionStates.set(sessionKey, state);
    
    const translator = new ClaudeAcpEventTranslator(state);
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
          // Emit canonical event for bus
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
      compatibleStdout.end();
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.error(`[${this.name}:stderr] ${text}`);
      }
    });

    // Initialize ACP session
    await this.initializeAcpSession(proc, sessionKey, projectRoot);

    const self = this;
    /** @type {HarnessSession & {process: import('child_process').ChildProcess, compatibleStdout: PassThrough}} */
    const session = {
      threadId,
      sessionKey,
      process: proc,
      compatibleStdout,
      async *sendMessage(message, options = {}) {
        // Start turn in state
        const turnId = `turn-${Date.now()}`;
        state.startTurn(turnId, message);
        
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
   * Initialize the ACP session.
   * @private
   */
  async initializeAcpSession(proc, sessionKey, projectRoot) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Claude Code ACP initialization timeout'));
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

      // Send initialize
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

      // Send session/new
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
   */
  translateMessage(msg, sessionKey) {
    const translator = this.translators.get(sessionKey);
    if (!translator) return null;
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

module.exports = { ClaudeCodeHarness };
