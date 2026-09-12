'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createProtocolRequestHandler } = require('./protocol-handler.cjs');

test('canonical protocol map serves contained assets and rejects stale ids, traversal, encoding, and symlinks', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-protocol-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capsule = path.join(root, 'capsule');
  fs.mkdirSync(path.join(capsule, 'app'), { recursive: true });
  fs.writeFileSync(path.join(capsule, 'app', 'index.html'), 'ok');
  const outside = path.join(root, 'outside.txt');
  fs.writeFileSync(outside, 'secret');
  fs.symlinkSync(outside, path.join(capsule, 'app', 'escape.txt'));
  let current = { capsules: new Map([['custom-view', capsule]]) };
  const fetched = [];
  const handler = createProtocolRequestHandler({
    getViewCapsuleRegistry: () => current,
    fetch: async (url) => { fetched.push(url); return new Response('ok', { status: 200 }); },
  });

  assert.equal((await handler({ url: 'fusion-studio://custom-view/app/index.html' })).status, 200);
  assert.equal(fetched.length, 1);
  for (const url of [
    'fusion-studio://stale/app/index.html',
    'fusion-studio://custom-view/app/%252e%252e/outside.txt',
    'fusion-studio://custom-view/app/%00.txt',
    'fusion-studio://custom-view/app/escape.txt',
    'fusion-studio://custom-view/app/index.html?forged=1',
  ]) assert.notEqual((await handler({ url })).status, 200);
  current = null;
  assert.equal((await handler({ url: 'fusion-studio://custom-view/app/index.html' })).status, 503);
});
