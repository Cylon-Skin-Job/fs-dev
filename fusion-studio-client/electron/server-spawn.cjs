const { spawn, execSync } = require('child_process');
const path = require('path');

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

/**
 * Spawns fusion-studio-server/server.js as a child process.
 * Resolves with the port once the server emits SERVER_READY:{port} on stdout.
 * Rejects if the process exits before signalling ready.
 *
 * @param {object} opts
 * @param {Function} opts.onExit   — called when server process dies unexpectedly
 * @returns {Promise<{ port: number, process: ChildProcess }>}
 */
function spawnServer({ onExit }) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', '..', 'fusion-studio-server', 'server.js');

    const child = spawn(NODE_BINARY, [serverPath], {
      env: { ...process.env, PORT: '0' },   // PORT=0 → OS assigns free port
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[server] ${text}`);    // pipe to Electron console

      const match = text.match(/SERVER_READY:(\d+)/);
      if (match) resolve({ port: parseInt(match[1], 10), process: child });
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[server:err] ${chunk.toString()}`);
    });

    child.on('exit', (code) => {
      // If we already resolved, this is an unexpected crash
      onExit(code);
      reject(new Error(`Server exited with code ${code} before signalling ready`));
    });
  });
}

module.exports = { spawnServer };
