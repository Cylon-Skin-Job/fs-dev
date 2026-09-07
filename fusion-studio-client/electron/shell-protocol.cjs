'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SHELL_ORIGIN = 'fusion-shell://app';
const SHELL_URL = `${SHELL_ORIGIN}/`;

function resolveShellRoot({ isPackaged, resourcesPath, moduleDirectory }) {
  if (isPackaged) {
    return path.join(resourcesPath, 'fusion-studio-client', 'dist');
  }
  return path.join(moduleDirectory, '..', 'dist');
}

function isShellUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'fusion-shell:'
      && url.hostname === 'app'
      && url.port === ''
      && url.username === ''
      && url.password === '';
  } catch {
    return false;
  }
}

function isShellMainFrameUrl(value) {
  return value === SHELL_URL;
}

function buildShellContentSecurityPolicy(descriptor) {
  if (!descriptor) throw new Error('Runtime descriptor is unavailable');
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${descriptor.httpOrigin} https://www.google.com`,
    `media-src 'self' blob: ${descriptor.httpOrigin}`,
    `connect-src 'self' ${descriptor.httpOrigin} ${descriptor.webSocketUrl}`,
    "frame-src fusion-studio: http: https: data: blob:",
    "worker-src 'self' blob:",
  ].join('; ');
}

function resolveShellAsset(shellRoot, requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!isShellUrl(requestUrl) || url.search || url.hash) return null;

  let relativePath;
  try {
    relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  } catch {
    return null;
  }
  let root;
  let target;
  try {
    root = fs.realpathSync(shellRoot);
    target = fs.realpathSync(path.resolve(root, relativePath));
  } catch {
    return null;
  }
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.statSync(target)?.isFile()) return null;
  return target;
}

function registerShellHandler({ protocol, net, shellRoot, getRuntimeDescriptor }) {
  protocol.handle('fusion-shell', async (request) => {
    const target = resolveShellAsset(shellRoot, request.url);
    if (!target) return new Response('Not found', { status: 404 });
    const descriptor = getRuntimeDescriptor();
    if (!descriptor) return new Response('Runtime unavailable', { status: 503 });

    const source = await net.fetch(pathToFileURL(target).toString());
    const headers = new Headers(source.headers);
    headers.set('Content-Security-Policy', buildShellContentSecurityPolicy(descriptor));
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (path.basename(target) === 'index.html') {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    return new Response(source.body, {
      status: source.status,
      statusText: source.statusText,
      headers,
    });
  });
}

module.exports = {
  SHELL_ORIGIN,
  SHELL_URL,
  buildShellContentSecurityPolicy,
  isShellUrl,
  isShellMainFrameUrl,
  registerShellHandler,
  resolveShellRoot,
  resolveShellAsset,
};
