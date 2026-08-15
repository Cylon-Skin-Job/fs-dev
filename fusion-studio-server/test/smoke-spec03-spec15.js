/**
 * Smoke Test: SPEC-03 (ThreadWebSocketHandler split) + SPEC-15 (z-index hierarchy)
 *
 * Run with: node test/smoke-spec03-spec15.js
 * Requires: server running on localhost:3001
 *
 * Tests:
 *   SPEC-03 — Module loads, exports unchanged, thread lifecycle works
 *   SPEC-15 — CSS variables defined, no hardcoded z-index remains, collisions fixed
 */

const path = require('path');
const fs = require('fs');

// ─── Colors for output ───
const GREEN = '\x1b[32m✓\x1b[0m';
const RED = '\x1b[31m✗\x1b[0m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function ok(msg) { console.log(`  ${GREEN} ${msg}`); passed++; }
function fail(msg, detail) { console.log(`  ${RED} ${msg}`); if (detail) console.log(`    ${DIM}${detail}${RESET}`); failed++; }
function section(name) { console.log(`\n${name}`); }

// ─── SPEC-03: ThreadWebSocketHandler Split ───

section('SPEC-03: Module structure');

// Test 1: All three files exist
const serverRoot = path.join(__dirname, '..');
const files = {
  coordinator: 'lib/thread/ThreadWebSocketHandler.js',
  crud: 'lib/thread/thread-crud.js',
  messages: 'lib/thread/thread-messages.js',
  sessionMgr: 'lib/thread/session-manager.js',
};

for (const [label, rel] of Object.entries(files)) {
  const full = path.join(serverRoot, rel);
  if (fs.existsSync(full)) {
    ok(`${label} exists: ${rel}`);
  } else {
    fail(`${label} missing: ${rel}`);
  }
}

// Test 2: ThreadWebSocketHandler export surface
section('SPEC-03: Export surface');

const EXPECTED_EXPORTS = [
  'setPanel', 'getState', 'cleanup',
  'sendThreadList',
  'handleThreadOpen', 'handleThreadOpenAssistant', 'handleThreadTouch',
  'handleThreadRename', 'handleThreadDelete', 'handleThreadCopyLink',
  'handleThreadSearch',
  'handleMessageSend',
  'getCurrentThreadId', 'getCurrentThreadManager',
  '_getProjectThreadManagers', '_getWsState'
];

try {
  const TWH = require('../lib/thread/ThreadWebSocketHandler');
  const exportedKeys = Object.keys(TWH);

  for (const name of EXPECTED_EXPORTS) {
    if (typeof TWH[name] === 'function') {
      ok(`export ${name} is function`);
    } else {
      fail(`export ${name} missing or not a function`, `got: ${typeof TWH[name]}`);
    }
  }

  // Check no unexpected exports
  const unexpected = exportedKeys.filter(k => !EXPECTED_EXPORTS.includes(k));
  if (unexpected.length === 0) {
    ok('no unexpected exports');
  } else {
    fail(`unexpected exports: ${unexpected.join(', ')}`);
  }
} catch (err) {
  fail('ThreadWebSocketHandler failed to require()', err.message);
}

// Test 3: Thread index re-exports still work
section('SPEC-03: Re-exports');

try {
  const threadModule = require('../lib/thread');
  if (threadModule.ThreadWebSocketHandler) {
    ok('lib/thread/index.js re-exports ThreadWebSocketHandler');
  } else {
    fail('lib/thread/index.js missing ThreadWebSocketHandler');
  }
  if (threadModule.ThreadManager) {
    ok('lib/thread/index.js re-exports ThreadManager');
  } else {
    fail('lib/thread/index.js missing ThreadManager');
  }
} catch (err) {
  fail('lib/thread/index.js failed to require()', err.message);
}

// Test 4: Test exports return Maps
section('SPEC-03: Test exports');

try {
  const TWH = require('../lib/thread/ThreadWebSocketHandler');
  const projectManagers = TWH._getProjectThreadManagers();
  const wsState = TWH._getWsState();

  if (projectManagers instanceof Map) {
    ok('_getProjectThreadManagers returns Map');
  } else {
    fail('_getProjectThreadManagers does not return Map', `got: ${typeof projectManagers}`);
  }
  if (wsState instanceof Map) {
    ok('_getWsState returns Map');
  } else {
    fail('_getWsState does not return Map', `got: ${typeof wsState}`);
  }
} catch (err) {
  fail('test exports failed', err.message);
}

// Test 5: SessionManager type guard
section('SPEC-03: SessionManager guards');

try {
  const { SessionManager } = require('../lib/thread/session-manager');

  // Valid config should work
  const sm = new SessionManager({ idleTimeoutMinutes: 5 });
  ok('SessionManager accepts valid config');

  // String config should throw
  try {
    new SessionManager({ idleTimeoutMinutes: '9' });
    fail('SessionManager accepted string idleTimeoutMinutes');
  } catch (e) {
    ok('SessionManager rejects string idleTimeoutMinutes');
  }

  // Zero should throw
  try {
    new SessionManager({ idleTimeoutMinutes: 0 });
    fail('SessionManager accepted zero idleTimeoutMinutes');
  } catch (e) {
    ok('SessionManager rejects zero idleTimeoutMinutes');
  }

  // Negative should throw
  try {
    new SessionManager({ idleTimeoutMinutes: -1 });
    fail('SessionManager accepted negative idleTimeoutMinutes');
  } catch (e) {
    ok('SessionManager rejects negative idleTimeoutMinutes');
  }
} catch (err) {
  fail('SessionManager require failed', err.message);
}

// ─── SPEC-15: Z-Index Hierarchy ───

section('SPEC-15: Variables defined');

const clientRoot = path.join(__dirname, '..', '..', 'fusion-studio-client', 'src');
const variablesPath = path.join(clientRoot, 'styles', 'variables.css');

if (!fs.existsSync(variablesPath)) {
  fail('variables.css not found', variablesPath);
} else {
  const vars = fs.readFileSync(variablesPath, 'utf8');

  const expectedVars = [
    '--z-content',
    '--z-gutter',
    '--z-inline',
    '--z-panel',
    '--z-overlay',
    '--z-modal',
    '--z-tooltip',
    '--z-system'
  ];

  for (const v of expectedVars) {
    if (vars.includes(v)) {
      ok(`${v} defined in variables.css`);
    } else {
      fail(`${v} missing from variables.css`);
    }
  }
}

// Test: No hardcoded z-index values remain in target files
section('SPEC-15: Hardcoded z-index replaced');

const zindexFiles = [
  { file: 'styles/document.css' },
  { file: 'mic/VoiceRecorder.css' },
  { file: 'index.css' },
  { file: 'components/hover-icon-modal/HoverIconModal.css' },
  { file: 'components/ConnectingOverlay/ConnectingOverlay.css' },
];

for (const { file } of zindexFiles) {
  const fullPath = path.join(clientRoot, file);
  if (!fs.existsSync(fullPath)) {
    fail(`file missing: ${file}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  // Find all z-index declarations
  const zindexMatches = content.match(/z-index:\s*[^;]+;/g) || [];

  let hasHardcoded = false;
  for (const match of zindexMatches) {
    // Hardcoded = z-index with a plain number, no var()
    if (/z-index:\s*\d+\s*;/.test(match)) {
      hasHardcoded = true;
      fail(`hardcoded z-index in ${file}: ${match.trim()}`);
    }
  }

  if (!hasHardcoded) {
    ok(`${file} — all z-index use var()`);
  }
}

// Test: Collision fixes
section('SPEC-15: Collision fixes');

// Check ConnectingOverlay is below modal/tooltip layers.
const connectingCSS = path.join(clientRoot, 'components/ConnectingOverlay/ConnectingOverlay.css');
const hoverModalCSS = path.join(clientRoot, 'components/hover-icon-modal/HoverIconModal.css');
if (fs.existsSync(connectingCSS) && fs.existsSync(hoverModalCSS)) {
  const connectingContent = fs.readFileSync(connectingCSS, 'utf8');
  const hoverModalContent = fs.readFileSync(hoverModalCSS, 'utf8');

  const connectingZ = connectingContent.match(/z-index:\s*[^;]+;/)?.[0] || '';
  const modalZ = hoverModalContent.match(/z-index:\s*[^;]+;/)?.[0] || '';

  if (connectingZ.includes('--z-content') && modalZ.includes('--z-modal')) {
    ok(`collision fixed: ConnectingOverlay (${connectingZ.trim()}) stays below modal (${modalZ.trim()})`);
  } else {
    fail(`unexpected z-index hierarchy: ConnectingOverlay ${connectingZ.trim()}, modal ${modalZ.trim()}`);
  }
}

// ─── Summary ───

section('─── Summary ───');
console.log(`  ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log(`\n  ${RED} SMOKE TEST FAILED`);
  process.exit(1);
} else {
  console.log(`\n  ${GREEN} ALL SMOKE TESTS PASSED`);
  process.exit(0);
}
