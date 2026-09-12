'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let activeWorkspacePath = null;
function setWorkspaceRoot(repoPath) { activeWorkspacePath = repoPath || null; }
function getWorkspaceRoot() { return activeWorkspacePath; }

function registerScheme() {
  const { protocol } = require('electron');
  protocol.registerSchemesAsPrivileged([
    { scheme: 'fusion-shell', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true } },
    { scheme: 'fusion-studio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
}

function decodeRequestPath(url) {
  if (url.username || url.password || url.port || url.search || url.hash) return null;
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.includes('%')) return null;
  const relative = decoded.replace(/^\//, '') || 'index.html';
  if (path.isAbsolute(relative)) return null;
  const segments = relative.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return segments.join(path.sep);
}

function createProtocolRequestHandler({ getViewCapsuleRegistry, fetch }) {
  const fetchAsset = fetch || require('electron').net.fetch;
  return async function handle(request) {
    let url;
    try { url = new URL(request.url); } catch { return new Response('Invalid URL', { status: 400 }); }
    const registry = getViewCapsuleRegistry();
    if (!registry) return new Response('View registry unavailable', { status: 503 });
    const capsuleRoot = registry.capsules.get(url.hostname);
    const relative = decodeRequestPath(url);
    if (!capsuleRoot || !relative) return new Response('Unavailable', { status: 404 });
    const declaredTarget = path.resolve(capsuleRoot, relative);
    const lexicalRelative = path.relative(capsuleRoot, declaredTarget);
    if (lexicalRelative === '..' || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
      return new Response('Forbidden', { status: 403 });
    }
    try {
      const target = path.resolve(await fs.promises.realpath(declaredTarget));
      const physicalRelative = path.relative(capsuleRoot, target);
      if (physicalRelative === '..' || physicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(physicalRelative)) {
        return new Response('Forbidden', { status: 403 });
      }
      return fetchAsset(pathToFileURL(target).toString());
    } catch {
      return new Response('Unavailable', { status: 404 });
    }
  };
}

function registerHandler({ getViewCapsuleRegistry } = {}) {
  if (typeof getViewCapsuleRegistry !== 'function') throw new TypeError('view capsule registry owner is required');
  const { protocol } = require('electron');
  protocol.handle('fusion-studio', createProtocolRequestHandler({ getViewCapsuleRegistry }));
}

module.exports = { registerScheme, registerHandler, createProtocolRequestHandler, decodeRequestPath, setWorkspaceRoot, getWorkspaceRoot };
