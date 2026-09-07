'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildShellContentSecurityPolicy,
  isShellMainFrameUrl,
  isShellUrl,
  registerShellHandler,
  resolveShellRoot,
  resolveShellAsset,
} = require('./shell-protocol.cjs');

const descriptor = Object.freeze({
  generation: 'generation_000001',
  httpOrigin: 'http://127.0.0.1:41001',
  webSocketUrl: 'ws://127.0.0.1:41001',
});

test('shell root follows the development and packaged resource layouts', () => {
  assert.equal(
    resolveShellRoot({
      isPackaged: false,
      resourcesPath: '/resources',
      moduleDirectory: '/project/client/electron',
    }),
    '/project/client/dist',
  );
  assert.equal(
    resolveShellRoot({
      isPackaged: true,
      resourcesPath: '/bundle/Resources',
      moduleDirectory: '/bundle/Resources/app.asar/electron',
    }),
    '/bundle/Resources/fusion-studio-client/dist',
  );
});

test('shell asset resolution accepts only the app host and files inside dist', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shell-protocol-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<main>shell</main>');
  const external = path.join(os.tmpdir(), `fusion-shell-external-${process.pid}.txt`);
  fs.writeFileSync(external, 'not shell');
  t.after(() => fs.rmSync(external, { force: true }));
  fs.symlinkSync(external, path.join(root, 'external.txt'));
  assert.equal(resolveShellAsset(root, 'fusion-shell://app/'), fs.realpathSync(path.join(root, 'index.html')));
  assert.equal(resolveShellAsset(root, 'fusion-shell://other/'), null);
  assert.equal(resolveShellAsset(root, 'fusion-studio://app/index.html'), null);
  assert.equal(resolveShellAsset(root, 'fusion-shell://app/%2e%2e/secret'), null);
  assert.equal(resolveShellAsset(root, 'fusion-shell://app/?query=1'), null);
  assert.equal(resolveShellAsset(root, 'fusion-shell://app/external.txt'), null);
  assert.equal(isShellUrl('fusion-shell://app/assets/app.js'), true);
  assert.equal(isShellMainFrameUrl('fusion-shell://app/'), true);
  assert.equal(isShellMainFrameUrl('fusion-shell://app/settings'), false);
  assert.equal(isShellMainFrameUrl('fusion-shell://app/?query=1'), false);
  assert.equal(isShellUrl('fusion-shell://user@app/'), false);
});

test('shell CSP names the exact runtime and keeps shell framing closed', () => {
  const policy = buildShellContentSecurityPolicy(descriptor);
  assert.match(policy, /connect-src 'self' http:\/\/127\.0\.0\.1:41001 ws:\/\/127\.0\.0\.1:41001/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /img-src 'self' data: blob: http:\/\/127\.0\.0\.1:41001 https:\/\/www\.google\.com/);
  assert.doesNotMatch(policy, /localhost|\*/);
});

test('shell handler serves only shell assets with exact CSP', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-shell-handler-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<main>shell</main>');
  let handler;
  registerShellHandler({
    protocol: { handle: (scheme, value) => { assert.equal(scheme, 'fusion-shell'); handler = value; } },
    net: { fetch: async () => new Response('<main>shell</main>', { headers: { 'Content-Type': 'text/html' } }) },
    shellRoot: root,
    getRuntimeDescriptor: () => descriptor,
  });
  const response = await handler({ url: 'fusion-shell://app/' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.equal(response.headers.get('Cache-Control'), 'no-cache, no-store, must-revalidate');
  assert.match(response.headers.get('Content-Security-Policy'), /127\.0\.0\.1:41001/);
  assert.equal((await handler({ url: 'fusion-shell://app/missing.js' })).status, 404);
});
