const { spawn, execSync } = require('child_process');
const fs = require('fs');
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
 * @returns {Promise<{ port: number, process: ChildProcess }>}
 */
function spawnServer({ onExit, resourcesPath, userDataPath }) {
  return new Promise((resolve, reject) => {
    const serverPath = resolveServerPath(resourcesPath);
    const env = {
      ...process.env,
      PORT: '0',
    };
    if (resourcesPath) env.FUSION_RESOURCES_PATH = resourcesPath;
    if (userDataPath) env.FUSION_APP_USER_DATA = userDataPath;

    console.log(`[Resources] root=${env.FUSION_RESOURCES_PATH || ''} userData=${env.FUSION_APP_USER_DATA || ''}`);

    const child = spawn(NODE_BINARY, [serverPath], {
      env,   // PORT=0 → OS assigns free port
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
