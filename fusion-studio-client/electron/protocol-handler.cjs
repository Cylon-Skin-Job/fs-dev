const path = require('path');
const { protocol, net } = require('electron');
const { pathToFileURL } = require('url');

let activeWorkspacePath = null;

/**
 * Called by main.cjs IPC handler when the renderer signals a workspace change.
 * @param {string} repoPath - Absolute path to the workspace root.
 */
function setWorkspaceRoot(repoPath) {
  activeWorkspacePath = repoPath || null;
}

function getWorkspaceRoot() {
  return activeWorkspacePath;
}

/**
 * Register scheme privileges. MUST be called before app is ready — call this
 * at the module level of main.cjs, before app.whenReady().
 */
function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'fusion-studio',
    privileges: {
      standard: true,       // relative URLs within served HTML resolve correctly
      secure: true,         // treated as a secure origin (WebCrypto, etc.)
      supportFetchAPI: true, // iframes can fetch() back to localhost server
      corsEnabled: true,    // CORS requests from these iframes are allowed
    },
  }]);
}

/**
 * Register the request handler. Call inside app.whenReady().
 */
function registerHandler() {
  protocol.handle('fusion-studio', async (request) => {
    if (!activeWorkspacePath) {
      return new Response('No active workspace', { status: 503 });
    }

    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    const viewId = url.hostname;          // e.g. "wiki-viewer"
    const relPath = decodeURIComponent(url.pathname).replace(/^\//, '');

    if (!viewId) {
      return new Response('Missing view ID', { status: 400 });
    }

    const viewRoot = path.join(activeWorkspacePath, 'ai', 'views', viewId);
    const target = path.resolve(viewRoot, relPath || 'index.html');

    // Path traversal guard — target must stay inside viewRoot
    if (!target.startsWith(viewRoot + path.sep) && target !== viewRoot) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(target).toString());
  });
}

module.exports = { registerScheme, registerHandler, setWorkspaceRoot, getWorkspaceRoot };
