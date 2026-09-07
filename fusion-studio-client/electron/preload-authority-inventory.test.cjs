'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('every preload-exposed native authority channel is registered through the shell guard', () => {
  const preload = fs.readFileSync(path.join(__dirname, 'preload-source.cjs'), 'utf8');
  const direct = [...preload.matchAll(/ipcRenderer\.(?:invoke|send)\('([^']+)'/g)].map((match) => match[1]);
  const documents = [...preload.matchAll(/invokeDocumentChannel\('([^']+)'/g)].map((match) => match[1]);
  const exposed = new Set([...direct, ...documents]);
  assert.deepEqual([...exposed].sort(), [
    'capture-page',
    'capture-rect',
    'export-document',
    'fusion-runtime:get',
    'fusion-shell-auth:sign',
    'print-document',
    'screenshots:list',
    'screenshots:read',
    'send-document-email',
    'show-emoji-panel',
    'workspace-menu:set-state',
    'workspace:set-root',
  ]);

  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /registerRuntimeDescriptorIpc\(\{/);
  assert.match(main, /createAuthorizedIpcMain\(ipcMain,/);
  assert.match(main, /registerCaptureHandlers\(authorizedIpcMain\)/);
  assert.match(main, /registerScreenshotHandlers\(authorizedIpcMain\)/);
  assert.match(main, /registerDocumentHandlers\(authorizedIpcMain,/);
  assert.match(main, /authorizedIpcMain\.on\('workspace:set-root'/);
  assert.match(main, /authorizedIpcMain\.on\('workspace-menu:set-state'/);
  assert.match(main, /authorizedIpcMain\.handle\('show-emoji-panel'/);
  assert.match(main, /registerShellProofIpc\(\{/);
  assert.doesNotMatch(main, /ipcMain\.(?:handle|on)\('(?!fusion-runtime:get)/);
});

test('renderer-directed preload events require current committed shell authority', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  const menuStart = main.indexOf('function sendMenuAction');
  const menuEnd = main.indexOf('function sanitizeWorkspaceMenuState');
  const menu = main.slice(menuStart, menuEnd);
  assert.match(menu, /mainWindow && !mainWindow\.isDestroyed\(\)/);
  assert.match(menu, /runtimeDescriptorIpc\?\.hasCommittedShellAuthority\(\)/);
  assert.doesNotMatch(menu, /getFocusedWindow/);
  assert.match(main, /frame\.parent === wc\.mainFrame && runtimeDescriptorIpc\?\.hasCommittedShellAuthority\(\)/);
});
