'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourceRoot = path.join(__dirname, '..', 'src');

function sourceFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx|js|jsx|mjs|css|html)$/.test(entry.name) ? [target] : [];
  });
}

test('all production renderer server transports are owned by runtime-transport', () => {
  const violations = [];
  for (const file of sourceFiles(sourceRoot)) {
    const relative = path.relative(sourceRoot, file);
    const source = fs.readFileSync(file, 'utf8');
    if (relative === path.join('lib', 'runtime-transport.ts')) continue;
    if (/\bnew\s+WebSocket\s*\(/.test(source)) violations.push(`${relative}: WebSocket constructor`);
    if (/\b(?:globalThis\.)?fetch\s*\(/.test(source)) violations.push(`${relative}: direct fetch`);
    if (/\b(?:axios|XMLHttpRequest|EventSource)\b/.test(source)) violations.push(`${relative}: alternate HTTP transport`);
    if (/(?:src|href)\s*=\s*[{'"`]*\/(?:api|material-symbols)\//.test(source)) {
      violations.push(`${relative}: relative server resource`);
    }
    if (/url\(\s*['"]?\/(?:api|material-symbols)\//.test(source)) {
      violations.push(`${relative}: stylesheet server resource`);
    }
    if (/window\.location\.(?:host|hostname|origin|port|protocol)/.test(source)) {
      violations.push(`${relative}: page-derived endpoint`);
    }
    if (/(?:localhost|127\.0\.0\.1):3001/.test(source)) violations.push(`${relative}: fixed development endpoint`);
  }
  assert.deepEqual(violations, []);
});

test('server restart targets only the tracked main shell, never a focused popup', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  const start = mainSource.indexOf('function handleServerExit');
  const end = mainSource.indexOf('function getElectronResourcesRoot');
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const restartSource = mainSource.slice(start, end);
  assert.match(restartSource, /const win = mainWindow && !mainWindow\.isDestroyed\(\) \? mainWindow : null/);
  assert.doesNotMatch(restartSource, /getFocusedWindow/);
  assert.match(restartSource, /const reloadWindow = mainWindow && !mainWindow\.isDestroyed\(\) \? mainWindow : null/);
  assert.match(restartSource, /reloadWindow\.webContents\.loadURL\(SHELL_URL\)/);
});

test('main navigation failure diagnostics never include requester-controlled URL or description', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  const start = mainSource.indexOf('function attachNavigationDiagnostics');
  const end = mainSource.indexOf('function nudgeRendererRepaint');
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const diagnosticsSource = mainSource.slice(start, end);
  assert.doesNotMatch(diagnosticsSource, /\$\{validatedURL\}|\$\{errorDescription\}/);
  assert.doesNotMatch(diagnosticsSource, /getURL\(\)/);
  assert.match(diagnosticsSource, /navigation-load-started/);
  assert.match(diagnosticsSource, /navigation-load-finished/);
  assert.match(diagnosticsSource, /navigation-load-failed stage=committed code=\$\{boundedCode\}/);
  assert.match(diagnosticsSource, /navigation-load-failed stage=provisional code=\$\{boundedCode\}/);
});
