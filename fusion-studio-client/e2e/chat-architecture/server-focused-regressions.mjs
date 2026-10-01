import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertDisposablePath, markOwnedDirectory, runOwnedCommand } from './fixture-lifecycle.mjs';
import { stageFixture } from './stage-fixture.mjs';

// Run the VALIDATION.md focused backend list against copied/staged code and a
// private migrated profile. npm test intentionally invokes its native pretest.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const slice05A = ['R8-SESSION-LIFECYCLE', 'R8-MIRROR-RECOVERY', 'R7-R8-RUNTIME-OWNERSHIP'].includes(process.env.FUSION_CHAT_ARCH_CASE_ID);
const fullServer = process.env.CHAT_ARCH_REGRESSION_CONTEXT
  && JSON.parse(process.env.CHAT_ARCH_REGRESSION_CONTEXT).kind === 'server-full';
const testPaths = fullServer ? [] : [
  ...(process.env.FUSION_CHAT_ARCH_CASE_ID === 'R7-R8-RUNTIME-OWNERSHIP' ? [
    'test/wire/canonical-harness-event-bridge.test.js',
    'test/wire/canonical-chat-event-applier.test.js',
  ] : []),
  ...(['R8-MIRROR-RECOVERY', 'R7-R8-RUNTIME-OWNERSHIP'].includes(process.env.FUSION_CHAT_ARCH_CASE_ID) ? [
    'test/thread/thread-runtime-automation.test.js',
    'test/ws/privileged-thread-handlers.test.js',
    'test/ws/privileged-thread-persistence.integration.test.js',
    'test/ws/thread-group-protocol.integration.test.js',
    'test/thread/history-file.test.js', 'test/thread/audit-subscriber-chatlog-finalize.test.js',
    'test/thread/thread-manager-chatlog-path.test.js',
    'test/agent-provenance/exchange-bind-and-query.test.js', 'test/agent-provenance/exchange-binder.test.js',
  ] : []),
  'test/ws/prompt-canonical-route.integration.test.js',
  'test/ws/privileged-thread-public-route.integration.test.js',
  'test/thread/thread-runtime-controller.test.js',
  'test/thread/stop-timeout-recovery.test.js',
  'test/thread/exited-drain-retirement.test.js',
  'test/thread/provider-termination.test.js',
  'test/thread/thread-activation-lifecycle.test.js',
  'test/thread/thread-panel-rebind.test.js',
  'test/thread/thread-crud-active-turn-reconnect.test.js',
  'test/thread/thread-group-lifecycle.test.js',
  'test/thread/thread-group-delete-recovery.test.js',
  'test/thread/thread-manager-chatlog-sync.test.js',
  'test/ws/thread-group-move-side-chat.integration.test.js',
  'test/ws/thread-group-worksurface-cleanup.integration.test.js',
  ...(slice05A ? ['test/thread/session-manager.test.js',
    'test/ws/prompt-submission-recovery.integration.test.js'] : []),
];
const sourcePaths = [
  'fusion-studio-client/e2e/chat-architecture/run.mjs',
  'fusion-studio-server/lib/thread/prompt-submission-service.js',
  'fusion-studio-server/lib/thread/prompt-submission-repository.js',
  'fusion-studio-server/lib/wire/canonical-harness-event-bridge.js',
  'fusion-studio-server/lib/wire/canonical-chat-event-applier.js',
  'fusion-studio-server/lib/wire/canonical-chat-terminal-events.js',
  'fusion-studio-server/lib/wire/canonical-chat-text-events.js',
  'fusion-studio-server/lib/wire/canonical-chat-tool-events.js',

  'fusion-studio-server/lib/thread/runtime-prompt-admission.js',
  'fusion-studio-server/lib/thread/canonical-drain-context.js',
  'fusion-studio-server/lib/thread/automation-drain.js',
  'fusion-studio-server/lib/thread/runtime-dispatch.js',
  'fusion-studio-server/lib/thread/runtime-session-binding.js',
  'fusion-studio-server/lib/thread/runtime-response.js',
  'fusion-studio-server/lib/thread/turn-application-context.js',
  'fusion-studio-server/lib/thread/runtime-activation.js',
  'fusion-studio-server/lib/thread/runtime-session-activation.js',
  'fusion-studio-server/lib/thread/automation-runtime-activation.js',
  'fusion-studio-server/lib/thread/runtime-stop.js',
  'fusion-studio-server/lib/thread/automation-turn-context.js',
  'fusion-studio-server/lib/thread/runtime-identity.js',

  'fusion-studio-client/e2e/chat-architecture/server-focused-regressions.mjs',
  'fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs',
  'fusion-studio-client/e2e/chat-architecture/owned-regression-supervisor.mjs',
  'fusion-studio-client/e2e/chat-architecture/owned-regression-lifecycle.test.mjs',
  'fusion-studio-client/e2e/chat-architecture/fixture-lifecycle.mjs',
  'fusion-studio-client/e2e/chat-architecture/stage-fixture.mjs',
  'fusion-studio-server/lib/ws/thread-ws-handlers.js',
  'fusion-studio-server/lib/thread/ThreadManager.js',
  'fusion-studio-server/lib/thread/thread-runtime-controller.js',
  'fusion-studio-server/lib/thread/thread-runtime-manager.js',
  'fusion-studio-server/lib/thread/ThreadWebSocketHandler.js',
  'fusion-studio-server/lib/thread/thread-runtime-automation.js',
  'fusion-studio-server/lib/thread/session-manager.js',
  'fusion-studio-server/lib/thread/session-lifecycle.js',
  'fusion-studio-server/lib/thread/chatlog-mirror.js',
  'fusion-studio-server/lib/thread/mirror-journal.js',
  'fusion-studio-server/lib/thread/HistoryFile.js',
  'fusion-studio-server/lib/thread-groups/repository.js',
  'fusion-studio-server/lib/thread-groups/placement-delivery.js',
  'fusion-studio-server/lib/thread/session-repository.js',
  'fusion-studio-server/lib/thread-groups/session-transactions.js',
  'fusion-studio-server/lib/thread-groups/service.js',
  ...testPaths.map((testPath) => `fusion-studio-server/${testPath}`),
];

const ownership = process.env.CHAT_ARCH_REGRESSION_CONTEXT
  ? JSON.parse(process.env.CHAT_ARCH_REGRESSION_CONTEXT)
  : (slice05A ? { runId: process.env.FUSION_CHAT_ARCH_CASE_ID, token: process.argv[2],
    evidenceRoot: path.join(process.argv[3], process.env.FUSION_CHAT_ARCH_CASE_ID.toLowerCase()), tempRoot: process.argv[4] } : null);
if (!ownership) throw new Error('focused server worker requires owned-regression-launcher.mjs');
const { runId, token, evidenceRoot } = ownership;
assertDisposablePath(ownership.tempRoot, token);
// A catalog case owns a child, not the shared suite root needed by later cases.
const tempRoot = slice05A ? path.join(ownership.tempRoot, process.env.FUSION_CHAT_ARCH_CASE_ID.toLowerCase()) : ownership.tempRoot;
if (slice05A) markOwnedDirectory(tempRoot, token, 'session-lifecycle');
fs.mkdirSync(evidenceRoot, { recursive: true });
assertDisposablePath(tempRoot, token);
const stageRoot = path.join(tempRoot, 'stage');
const profileRoot = path.join(tempRoot, 'profile');
const workspaceRoot = path.join(tempRoot, 'workspace');
const startedAt = new Date().toISOString();
const testTmp = path.join(tempRoot, 'test-tmp');
fs.mkdirSync(testTmp, { recursive: true });
// All os.tmpdir fixtures, including suite-internal workspaces, stay owned.
const testEnvironment = { ...process.env, TMPDIR: testTmp, TMP: testTmp, TEMP: testTmp,
  FUSION_APP_USER_DATA: profileRoot, FUSION_LOCAL_MACHINE: 'ChatArchitectureFixture', PORT: '0' };
function sourceInventory(directory, prefix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || ['node_modules', 'data', '.git', 'coverage', 'release'].includes(entry.name)) return [];
    const relative = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? sourceInventory(path.join(directory, entry.name), relative) : [relative];
  });
}
let result = null;
let failure = null;

try {
  const staged = await stageFixture({ repoRoot, stageRoot, profileRoot, workspaceRoot, token, realServer: true });
  const command = ['npm', 'test', '--', '--runInBand', ...(fullServer ? [] : ['--runTestsByPath', ...testPaths])];
  const dependencies = [...new Set([...sourcePaths,
    ...sourceInventory(path.join(repoRoot, 'fusion-studio-server'), 'fusion-studio-server'),
    ...sourceInventory(path.join(repoRoot, 'fusion-studio-client/src'), 'fusion-studio-client/src'),
    ...sourceInventory(path.join(repoRoot, 'System_Manager/ai-template'), 'System_Manager/ai-template'),
    ...sourceInventory(path.join(repoRoot, 'System_Manager/global-configs'), 'System_Manager/global-configs'),
    'fusion-studio-client/package.json'])];
  fs.writeFileSync(path.join(evidenceRoot, 'manifest.json'), `${JSON.stringify({
    runId,
    startedAt,
    token,
    command,
    testPaths, fullServer, testTmp, provider: 'real current source; tests declare their own mocks',
    sourceHashes: Object.fromEntries(dependencies.map((sourcePath) => [
      sourcePath,
      createHash('sha256').update(fs.readFileSync(path.join(repoRoot, sourcePath))).digest('hex'),
    ])),
    stagedServer: staged.stagedServer,
    profileRoot,
    workspaceRoot,
    portPolicy: 'PORT=0, no server listener; port 3001 refused',
    nativePretest: 'npm test invokes build:native-observer',
  }, null, 2)}\n`, { flag: 'wx' });

  // Keep the test process and all of npm/node-gyp/Jest descendants in the
  // runner-owned process group. The token is an argv identity for PID checks.
  const npmWrapper = `
    const { spawnSync } = require('node:child_process');
    const [ownerToken, cwd, ...npmArgs] = process.argv.slice(1);
    if (!ownerToken.startsWith('chat-architecture-owner-')) process.exit(77);
    const child = spawnSync('npm', npmArgs, {
      cwd, env: process.env, stdio: 'inherit', timeout: 480000,
    });
    if (child.error) { console.error(child.error.message); process.exit(78); }
    process.exit(child.status ?? 79);
  `;
  const signalController = new AbortController();
  const abort = () => signalController.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    result = await runOwnedCommand({
      command: process.execPath,
      args: ['-e', npmWrapper, token, staged.stagedServer, ...command.slice(1)],
      cwd: staged.stagedServer,
      env: testEnvironment,
      token,
      logPath: path.join(evidenceRoot, 'focused-tests.log'),
      deadlineMs: 540_000,
      signal: signalController.signal,
    });
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
  if (result.code !== 0 || result.timedOut || result.interrupted || result.leakedOwnedPids.length) {
    failure = `focused backend exit=${result.code}, timeout=${result.timedOut}, interrupted=${result.interrupted}, leaked=${result.leakedOwnedPids.join(',')}`;
  }
} catch (error) {
  failure = error.stack || error.message;
} finally {
  assertDisposablePath(tempRoot, token);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.writeFileSync(path.join(evidenceRoot, 'result.json'), `${JSON.stringify({
    runId,
    status: failure ? 'failed' : 'passed',
    result,
    failure,
    ownedRunRootRemoved: !fs.existsSync(tempRoot),
  }, null, 2)}\n`, { flag: 'wx' });
}

if (failure) {
  process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`CHAT_ARCH_SERVER_FOCUSED_OK ${runId}\n`);
}
