const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { seedPackagedGlobalConfigs } = require('./system-manager-seed.cjs');

// Resolve system node binary — Electron's process.execPath is the Electron
// binary, not node. The server uses native modules (better-sqlite3) compiled
// for system Node, so we must spawn with the same node that installed them.
function resolveNodeBinary() {
  try {
    return execSync('which node', { encoding: 'utf8' }).trim();
  } catch {
    return 'node'; // fallback to PATH
  }
}

const NODE_BINARY = resolveNodeBinary();

const CLOSED_OUTPUT_ERROR_CODES = new Set([
  'EPIPE',
  'ERR_STREAM_ALREADY_FINISHED',
  'ERR_STREAM_DESTROYED',
  'ERR_STREAM_PREMATURE_CLOSE',
  'ERR_STREAM_WRITE_AFTER_END',
]);

function isClosedOutputError(error) {
  return Boolean(error && CLOSED_OUTPUT_ERROR_CODES.has(error.code));
}

function createBestEffortStreamForwarder(destination) {
  let forwardingStopped = false;
  let pendingWrites = 0;
  let listenerAttached = false;
  let detachHandle = null;
  let failureThrowHandle = null;
  let pendingFailure = null;

  const removeErrorListener = () => {
    if (detachHandle) clearImmediate(detachHandle);
    detachHandle = null;
    if (!listenerAttached) return;
    listenerAttached = false;
    destination.removeListener('error', onError);
  };
  const attachErrorListener = () => {
    if (detachHandle) {
      clearImmediate(detachHandle);
      detachHandle = null;
    }
    if (listenerAttached) return;
    listenerAttached = true;
    destination.on('error', onError);
  };
  const scheduleDetach = () => {
    if (!listenerAttached || pendingWrites !== 0 || detachHandle) return;
    // Writable callbacks can receive an error immediately before the matching
    // `error` event. Keep the write-scoped guard through that final turn, then
    // remove it even while the server child remains open.
    detachHandle = setImmediate(() => {
      detachHandle = null;
      if (pendingWrites === 0) removeErrorListener();
    });
  };
  const onError = (error) => {
    if (isClosedOutputError(error)) {
      forwardingStopped = true;
      scheduleDetach();
      return;
    }
    if (failureThrowHandle) clearImmediate(failureThrowHandle);
    failureThrowHandle = null;
    pendingFailure = null;
    forwardingStopped = true;
    removeErrorListener();
    throw error;
  };

  return Object.freeze({
    write(value) {
      if (
        forwardingStopped
        || destination.destroyed === true
        || destination.writableEnded === true
        || destination.writable === false
      ) {
        forwardingStopped = true;
        return false;
      }
      attachErrorListener();
      pendingWrites += 1;
      let completed = false;
      const complete = (error) => {
        if (completed) return;
        completed = true;
        pendingWrites -= 1;
        if (isClosedOutputError(error)) forwardingStopped = true;
        else if (error && !pendingFailure) {
          forwardingStopped = true;
          pendingFailure = error;
          failureThrowHandle = setImmediate(() => {
            failureThrowHandle = null;
            const failure = pendingFailure;
            pendingFailure = null;
            removeErrorListener();
            throw failure;
          });
        }
        scheduleDetach();
      };
      try {
        destination.write(value, complete);
        return true;
      } catch (error) {
        complete();
        if (isClosedOutputError(error)) {
          forwardingStopped = true;
          return false;
        }
        throw error;
      }
    },
    close() {
      forwardingStopped = true;
      scheduleDetach();
    },
  });
}

function pipeServerOutput(child, options = {}) {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
    onStdout = () => {},
  } = options;
  const stdoutForwarder = createBestEffortStreamForwarder(stdout);
  const stderrForwarder = createBestEffortStreamForwarder(stderr);

  const handleStdout = (chunk) => {
    const text = chunk.toString();
    onStdout(text);
    stdoutForwarder.write(`[server] ${text}`);
  };
  const handleStderr = (chunk) => {
    stderrForwarder.write(`[server:err] ${chunk.toString()}`);
  };
  const cleanup = () => {
    child.stdout.removeListener('data', handleStdout);
    child.stderr.removeListener('data', handleStderr);
    stdoutForwarder.close();
    stderrForwarder.close();
  };

  child.stdout.on('data', handleStdout);
  child.stderr.on('data', handleStderr);
  child.once('close', cleanup);
  return cleanup;
}

function resolveServerPath(resourcesPath) {
  if (resourcesPath) {
    const packagedServerPath = path.join(resourcesPath, 'fusion-studio-server', 'server.js');
    if (fs.existsSync(packagedServerPath)) {
      return packagedServerPath;
    }
  }
  return path.join(__dirname, '..', '..', 'fusion-studio-server', 'server.js');
}

/**
 * Spawns fusion-studio-server/server.js as a child process.
 * Resolves with the port once the server emits SERVER_READY:{port} on stdout.
 * Rejects if the process exits before signalling ready.
 *
 * @param {object} opts
 * @param {Function} opts.onExit   — called when server process dies unexpectedly
 * @param {string} opts.resourcesPath   — root containing models/prompts/pandoc
 * @param {string} opts.userDataPath   — writable Electron userData directory
 * @param {string} opts.focusStatePath   — path to the focus-state JSON snapshot
 * @returns {Promise<{ port: number, process: ChildProcess }>}
 */
function spawnServer({ onExit, resourcesPath, userDataPath, focusStatePath }) {
  return new Promise((resolve, reject) => {
    const packaged = Boolean(resourcesPath && fs.existsSync(
      path.join(resourcesPath, 'fusion-studio-server', 'server.js'),
    ));
    seedPackagedGlobalConfigs({ resourcesPath, userDataPath, packaged });
    const serverPath = resolveServerPath(resourcesPath);
    const env = {
      ...process.env,
      PORT: '0',
    };
    if (resourcesPath) env.FUSION_RESOURCES_PATH = resourcesPath;
    if (userDataPath) env.FUSION_APP_USER_DATA = userDataPath;
    if (packaged) env.FUSION_APP_PACKAGED = '1';
    if (focusStatePath) env.FUSION_FOCUS_STATE_PATH = focusStatePath;

    console.log(`[Resources] root=${env.FUSION_RESOURCES_PATH || ''} userData=${env.FUSION_APP_USER_DATA || ''}`);

    const child = spawn(NODE_BINARY, [serverPath], {
      env,   // PORT=0 → OS assigns free port
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pipeServerOutput(child, {
      onStdout(text) {
        const match = text.match(/SERVER_READY:(\d+)/);
        if (match) resolve({ port: parseInt(match[1], 10), process: child });
      },
    });

    child.on('exit', (code) => {
      // If we already resolved, this is an unexpected crash
      onExit(code);
      reject(new Error(`Server exited with code ${code} before signalling ready`));
    });
  });
}

module.exports = { pipeServerOutput, spawnServer };
