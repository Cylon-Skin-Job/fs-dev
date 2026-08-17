'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { setWorkspaceRoot } = require('../protocol-handler.cjs');
const { registerScreenshotHandlers } = require('./screenshot-handlers.cjs');

test('screenshot listing returns saved file paths while reads provide preview bytes', async (context) => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-screenshot-'));
  const machineName = 'test-machine';
  const screenshotsDir = path.join(workspaceRoot, 'ai', machineName, 'Data', 'Screenshots');
  const screenshotPath = path.join(screenshotsDir, 'capture.png');
  const previousMachine = process.env.FUSION_LOCAL_MACHINE;

  context.after(() => {
    setWorkspaceRoot(null);
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  });

  fs.mkdirSync(path.join(workspaceRoot, 'ai', machineName, 'System'), { recursive: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.writeFileSync(screenshotPath, Buffer.from('png-preview'));
  fs.writeFileSync(path.join(screenshotsDir, 'ignore.txt'), 'not an image');
  process.env.FUSION_LOCAL_MACHINE = machineName;
  setWorkspaceRoot(workspaceRoot);

  const handlers = new Map();
  registerScreenshotHandlers({
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  });

  assert.deepEqual(await handlers.get('screenshots:list')(), [{
    name: 'capture.png',
    path: screenshotPath,
  }]);
  assert.deepEqual(await handlers.get('screenshots:read')(null, 'capture.png'), {
    base64: Buffer.from('png-preview').toString('base64'),
    mimeType: 'image/png',
  });
});
