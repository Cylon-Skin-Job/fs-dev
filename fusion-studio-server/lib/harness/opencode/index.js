const { EventEmitter } = require('events');
const os = require('os');
const { PassThrough } = require('stream');
const { spawn } = require('child_process');
const { createNativeDiagnosticTap } = require('./native-diagnostic-tap');
const { JsonLineParser } = require('./json-line-parser');
const {
  OpenCodeJsonEventTranslator,
  mapOpenCodeToolName,
  mapOpenCodeTokenUsage,
} = require('./json-event-translator');
const { buildHarnessFailureMarker } = require('./failure-marker-builder');
const { createConfiguredSecretsProvider } = require('./configured-secrets-provider');
const { buildHarnessChildEnvironment } = require('../child-environment');
const { retireSession } = require('./session-retirement');
const { OpenCodeTurnOutcome } = require('./turn-outcome');
const { sanitizeRuntimeHarnessConfig } = require('../../thread/thread-harness-config-policy');
const { logTemporaryChatBoundary } = require('../../logging');

/**
 * Native OpenCode protocol error observation — adapter boundary ONLY
 * (SPEC-03 §A3). Detects the -32004 authentication protocol error in parsed
 * JSON lines so shared runtime code never parses raw provider codes.
 */
function isOpenCodeNativeAuthFailure(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.code === -32004) return true;
  return event.error?.code === -32004;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createProcessProxy() {
  const proc = new EventEmitter();
  proc.pid = null;
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.kill = () => {
    proc.killed = true;
    return true;
  };
  return proc;
}

function buildRunArgs(config, projectRoot, openCodeSessionId, message) {
  const args = ['run', '--auto', '--format', 'json'];

  if (projectRoot) {
    args.push('--dir', projectRoot);
  }

  if (config.model) {
    args.push('--model', config.model);
  }

  if (config.variant) {
    args.push('--variant', config.variant);
  }

  if (config.pure === true) {
    args.push('--pure');
  }

  if (config.thinking === true) {
    args.push('--thinking');
  }

  if (openCodeSessionId) {
    args.push('--session', openCodeSessionId);
  }

  args.push(String(message || ''));
  return args;
}

function createSessionIdPatch(openCodeSessionId) {
  return { opencodeSessionId: openCodeSessionId };
}

function getEventSessionId(event) {
  return event?.sessionID || event?.part?.sessionID || null;
}

function createSyntheticTurnEnd(translator) {
  const terminalState = translator.getTerminalState();
  const observedAt = translator.now();
  return {
    type: 'turn_end',
    timestamp: observedAt,
    timestampSource: 'host_observed',
    observedAt,
    reason: 'complete',
    fullText: terminalState.fullText,
    hasToolCalls: terminalState.hasToolCalls,
    _meta: {
      harnessId: 'opencode',
      provider: 'opencode',
      terminalSource: 'process_exit_missing_step_finish',
    },
  };
}

class OpenCodeHarness extends EventEmitter {
  constructor() {
    super();
    this.id = 'opencode';
    this.name = 'OpenCode';
    this.provider = 'opencode';
    this.cliName = 'opencode';
    this.config = {};
    this.sessions = new Map();
    // Default real configured-secrets provider; initialize(config) may
    // override it with config.getConfiguredSecrets (documented injection
    // point for tests/alternative owners).
    this.getConfiguredSecrets = createConfiguredSecretsProvider();
  }

  async initialize(config = {}) {
    this.config = { ...this.config, ...config };
  }

  async startThread(threadId, projectRoot, scopeContext = {}, threadOptions = {}) {
    const harness = this;
    const sessionKey = threadOptions.sessionKey || threadId;
    // The registry owns one adapter instance, but runtime policy is scoped to
    // the workspace that created this session. Capture it now so a later
    // workspace initialization cannot retarget this session's prompts.
    const runtimeConfig = { ...(threadOptions.runtimeConfig || harness.config) };
    const harnessConfig = sanitizeRuntimeHarnessConfig(
      'opencode',
      threadOptions.harnessConfig,
    );
    const storedSessionId = harnessConfig.opencodeSessionId || null;
    const updateHarnessConfig = threadOptions.updateHarnessConfig;
    const session = {
      threadId,
      sessionKey,
      process: createProcessProxy(),
      activeProcess: null,
      activeProcessClose: null,
      openCodeSessionId: storedSessionId,
      stopRequested: false,
      projectRoot,
      scopeContext,
      // Live per-thread config. Mutated by applyHarnessConfig() so mid-thread
      // model/effort changes take effect on the next prompt without a re-spawn.
      harnessConfig,
      applyHarnessConfig(patch) {
        session.harnessConfig = { ...session.harnessConfig, ...patch };
      },
      async *sendMessage(message, options = {}) {
        const translator = new OpenCodeJsonEventTranslator();
        const events = [translator.beginTurn(message)];
        const parser = new JsonLineParser();
        const cliPath = runtimeConfig.cliPath || process.env.OPENCODE_PATH || 'opencode';
        const runConfig = {
          ...runtimeConfig,
          // Live per-thread model + effort override the workspace defaults.
          ...(session.harnessConfig.model ? { model: session.harnessConfig.model } : {}),
          ...(session.harnessConfig.variant ? { variant: session.harnessConfig.variant } : {}),
        };
        const args = buildRunArgs(runConfig, projectRoot, session.openCodeSessionId, message);
        let done = false;
        let sawTurnEnd = false;
        const outcome = new OpenCodeTurnOutcome();
        let sawNativeAuthFailure = false;
        let sawRenderableOutput = false;
        let sawNativeJson = false;
        let sawSessionId = false;
        let sawToolCalls = false;
        let lastTranslatedType = null;
        // SPEC-03 Slice A: exit/close failures are described, then translated
        // into a genuine HarnessRuntimeError marker at throw time (the
        // builder is async). Spawn errors stay raw — they are not one of the
        // three native signals and take the shared generic path unchanged.
        let failureDescriptor = null;
        let spawnFailure = null;
        let stderr = '';
        const envSnapshot = buildHarnessChildEnvironment('opencode', {
          overrides: { TERM: 'xterm-256color' },
        });
        const getConfiguredSecrets = typeof runtimeConfig.getConfiguredSecrets === 'function'
          ? runtimeConfig.getConfiguredSecrets
          : harness.getConfiguredSecrets;
        const diagnosticTap = createNativeDiagnosticTap(options.nativeDiagnostic, {
          getConfiguredSecrets, env: envSnapshot, workspaceRoot: projectRoot || '', homePath: os.homedir(),
        });
        let capturedOpenCodeSessionId = session.openCodeSessionId;
        let capturedSessionIdPatch = null;

        const commitSessionIdPatch = (openCodeSessionId) => {
          session.openCodeSessionId = openCodeSessionId;
        };

        const diagnosticIdentity = { threadId, turnId: options.turnId, harnessId: 'opencode' };
        logTemporaryChatBoundary('spawn_attempt', {
          ...diagnosticIdentity, hadStoredSessionId: Boolean(session.openCodeSessionId),
        });
        let proc;
        let environmentReady = false;
        try {
          // The diagnostic snapshot above has already verified this family and
          // its overrides. Keep spawn's env owned directly by the central
          // builder so the child-launch inventory can verify the boundary.
          environmentReady = true;
          proc = spawn(cliPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: projectRoot || process.cwd(),
            env: buildHarnessChildEnvironment('opencode', {
              overrides: { TERM: 'xterm-256color' },
            }),
          });
        } catch (err) {
          logTemporaryChatBoundary('spawn_throw', {
            ...diagnosticIdentity, errorCode: err?.code, errorName: err?.name,
            errno: err?.errno, environmentReady,
          });
          diagnosticTap.finish();
          throw err;
        }
        logTemporaryChatBoundary('spawn_return', { ...diagnosticIdentity, pid: proc.pid });

        session.activeProcess = proc;
        session.activeProcessClose = new Promise((resolve) => {
          proc.once('close', resolve);
        });
        session.process = proc;
        session.stopRequested = false;

        parser.on('message', (openCodeEvent, originalLine) => {
          sawNativeJson = true;
          diagnosticTap.push(originalLine);
          if (isOpenCodeNativeAuthFailure(openCodeEvent)) {
            sawNativeAuthFailure = true;
          }
          const openCodeSessionId = getEventSessionId(openCodeEvent);
          if (openCodeSessionId) sawSessionId = true;
          if (!capturedOpenCodeSessionId && openCodeSessionId) {
            const sessionIdPatch = createSessionIdPatch(openCodeSessionId);
            capturedOpenCodeSessionId = openCodeSessionId;
            if (typeof updateHarnessConfig === 'function') {
              capturedSessionIdPatch = sessionIdPatch;
            } else {
              commitSessionIdPatch(openCodeSessionId);
            }
          }

          const translated = translator.translate(openCodeEvent);
          outcome.observe(openCodeEvent, translated);
          for (const event of translated) {
            events.push(event);
            lastTranslatedType = event.type;
            if (event.type === 'content' || event.type === 'thinking') {
              sawRenderableOutput = true;
            }
            if (event.type === 'tool_call' || event.type === 'tool_call_args'
              || event.type === 'tool_result' || event.type === 'tool_snapshot') {
              sawToolCalls = true;
            }
            if (event.type === 'turn_end') {
              sawTurnEnd = true;
            }
          }
        });

        // Malformed lines are recoverable; valid surrounding JSON continues.
        parser.on('parse_error', (line, err, lineNumber) => {
          harness.emit('parse_error', { threadId, line, error: err, lineNumber });
        });

        proc.stdout.on('data', (data) => parser.feed(data.toString()));
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        proc.on('error', (err) => {
          logTemporaryChatBoundary('spawn_error', {
            ...diagnosticIdentity, pid: proc.pid, errorCode: err?.code,
          });
          if (!session.stopRequested) spawnFailure = err;
          done = true;
        });
        proc.on('close', (code, signal) => {
          parser.flush();
          logTemporaryChatBoundary('child_close', {
            ...diagnosticIdentity, pid: proc.pid, exitCode: code, signal,
            sawNativeJson, sawSessionId, sawTurnEnd,
            stopRequested: session.stopRequested,
          });
          if (session.stopRequested) {
            done = true;
            return;
          }
          if (code !== 0) {
            failureDescriptor = { exitCode: code, signal };
          } else if (!sawTurnEnd && outcome.permitsCleanExitCompletion()) {
            events.push(createSyntheticTurnEnd(translator));
            sawTurnEnd = true;
          } else if (!sawTurnEnd) {
            failureDescriptor = { exitCode: code, signal };
          }
          done = true;
        });
        proc.on('exit', (code, signal) => {
          if (!session.stopRequested && code !== 0 && !sawTurnEnd && !failureDescriptor) {
            failureDescriptor = { exitCode: code, signal };
          }
        });

        try {
          while (!done || events.length > 0) {
            while (events.length > 0) yield events.shift();
            if (!done) await delay(options.pollIntervalMs || 10);
          }
          if (capturedSessionIdPatch && !session.openCodeSessionId) {
            try {
              await updateHarnessConfig(capturedSessionIdPatch);
            } catch (err) {
              logTemporaryChatBoundary('session_patch_error', {
                ...diagnosticIdentity, pid: proc.pid, errorCode: err?.code,
              });
              throw err;
            }
            commitSessionIdPatch(capturedOpenCodeSessionId);
            logTemporaryChatBoundary('session_patch_committed', { ...diagnosticIdentity, pid: proc.pid });
          }
          if (spawnFailure) throw spawnFailure;
          if (failureDescriptor) {
            // SPEC-03 Slice A: translate the native exit signal into a
            // provider-neutral marker AT THE ADAPTER BOUNDARY. The thrown
            // message is fixed internal text; stderr survives only inside
            // the already-redacted candidate.
            throw await buildHarnessFailureMarker({
              nativeAuthFailure: sawNativeAuthFailure,
              stderr,
              nativeDetail: outcome.toolError,
              exitCode: failureDescriptor.exitCode,
              signal: failureDescriptor.signal,
              harnessId: harness.id,
              workspaceRoot: projectRoot || undefined,
              homePath: os.homedir(),
              envSnapshot,
              lastCanonicalEventType: lastTranslatedType || undefined,
              hadRenderableOutput: sawRenderableOutput,
              hadToolCalls: sawToolCalls,
              getConfiguredSecrets,
            });
          }
          if (!session.stopRequested && !session.openCodeSessionId) {
            logTemporaryChatBoundary('missing_session_id', {
              ...diagnosticIdentity, pid: proc.pid, sawNativeJson, sawSessionId,
            });
            // Missing-sessionID stays a generic error by contract (not one of
            // the three native signals; semantics unchanged).
            throw new Error('OpenCode JSON run completed without a sessionID; cannot preserve thread continuity');
          }
        } finally {
          diagnosticTap.finish();
          if (session.activeProcess === proc) {
            session.activeProcess = null;
            session.activeProcessClose = null;
          }
        }
      },
      async stop(signal) {
        await retireSession(harness.sessions, sessionKey, session, signal);
      },
    };

    this.sessions.set(sessionKey, session);
    return session;
  }

  getSession(threadId) {
    const exact = this.sessions.get(threadId);
    if (exact) return exact;
    const matches = [...this.sessions.values()].filter((session) => session.threadId === threadId);
    return matches.length === 1 ? matches[0] : undefined;
  }

  async dispose() {
    for (const session of this.sessions.values()) {
      await session.stop();
    }
    this.sessions.clear();
  }

  async isInstalled() {
    return new Promise((resolve) => {
      const cliPath = this.config.cliPath || process.env.OPENCODE_PATH || 'opencode';
      const proc = spawn(cliPath, ['--version'], {
        stdio: 'pipe',
        env: buildHarnessChildEnvironment('probe'),
      });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
      proc.on('exit', (code) => resolve(code === 0));
    });
  }

  async getVersion() {
    return new Promise((resolve, reject) => {
      const cliPath = this.config.cliPath || process.env.OPENCODE_PATH || 'opencode';
      const proc = spawn(cliPath, ['--version'], {
        stdio: 'pipe',
        env: buildHarnessChildEnvironment('probe'),
      });
      let output = '';

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });
      proc.on('error', (err) => reject(new Error(`Failed to run ${cliPath}: ${err.message}`)));
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`${cliPath} --version exited with code ${code}`));
        }
      });
    });
  }
}

module.exports = {
  OpenCodeHarness,
  OpenCodeJsonEventTranslator,
  JsonLineParser,
  mapOpenCodeToolName,
  mapOpenCodeTokenUsage,
  createConfiguredSecretsProvider,
  isOpenCodeNativeAuthFailure,
};
