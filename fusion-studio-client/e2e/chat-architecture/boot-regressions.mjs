import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  assertDisposablePath, assertSafePort,
  runOwnedCommand, terminateOwnedProcess,
} from './fixture-lifecycle.mjs';
import { stageFixture } from './stage-fixture.mjs';

const require = createRequire(import.meta.url);
const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const clientRoot = path.join(repoRoot, 'fusion-studio-client');
const testPaths = [
  'e2e/chat-surface-identity.spec.ts',
  'e2e/chat-surface-isolation.spec.ts',
  'e2e/threaded-chat-host.spec.ts',
  'e2e/prompt-ownership.slice-c.spec.ts',
  'e2e/working-activity.spec.ts',
  'e2e/move-chat-to-side-chat.spec.ts',
  'e2e/side-chat-isolation.spec.ts',
  'e2e/side-chat-placement-recovery.spec.ts',
];
const ownership = process.env.CHAT_ARCH_REGRESSION_CONTEXT
  ? JSON.parse(process.env.CHAT_ARCH_REGRESSION_CONTEXT) : null;
if (!ownership) throw new Error('boot regression worker requires owned-regression-launcher.mjs');
const { runId, token, tempRoot, evidenceRoot } = ownership;
assertDisposablePath(tempRoot, token);
const mode = process.argv[2] ?? '--all';
if (!['--all', '--smoke', '--working-return'].includes(mode) || process.argv.length > 3) {
  throw new Error('usage: node boot-regressions.mjs [--smoke|--working-return|--all]');
}
const stageRoot = path.join(tempRoot, 'stage');
const profileRoot = path.join(tempRoot, 'profile');
const workspaceRoot = path.join(tempRoot, 'workspace');
const serverLogPath = path.join(evidenceRoot, 'server.log');
const resultPath = path.join(evidenceRoot, 'playwright-results.json');
let server = null;
let serverLog = null;
let testResult = null;
let failure = null;
let port = null;

function sha256(relativePath) {
  return createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function findCases(suites, parent = []) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) => (spec.tests ?? []).map((entry) => ({
      id: [...parent, suite.title, spec.title].filter(Boolean).join(' > '),
      file: suite.file,
      status: entry.status,
      projectName: entry.projectName,
      results: (entry.results ?? []).map((result) => ({ status: result.status, error: result.error?.message ?? null })),
    }))),
    ...findCases(suite.suites ?? [], [...parent, suite.title].filter(Boolean)),
  ]);
}

async function waitReady(child) {
  return new Promise((resolve, reject) => {
    let pending = '';
    const timeout = setTimeout(() => finish(new Error('staged server readiness exceeded 45 seconds')), 45_000);
    const onExit = (code, signal) => finish(new Error(`staged server exited before ready: ${code ?? signal}`));
    const onData = (chunk) => {
      const data = chunk.toString();
      serverLog.write(data);
      pending += data;
      const match = pending.match(/SERVER_READY:(\d+)/);
      if (match) finish(null, Number(match[1]));
      if (pending.length > 4096) pending = pending.slice(-4096);
    };
    const onErrorData = (chunk) => serverLog.write(chunk);
    function finish(error, readyPort) {
      clearTimeout(timeout);
      child.removeListener('exit', onExit);
      child.stdout.removeListener('data', onData);
      child.stderr.removeListener('data', onErrorData);
      child.stdout.on('data', (chunk) => serverLog.write(chunk));
      child.stderr.on('data', (chunk) => serverLog.write(chunk));
      if (error) reject(error);
      else resolve(readyPort);
    }
    child.once('exit', onExit);
    child.stdout.on('data', onData);
    child.stderr.on('data', onErrorData);
  });
}

try {
  const staged = await stageFixture({ repoRoot, stageRoot, profileRoot, workspaceRoot, token });
  const projectRoot = path.join(workspaceRoot, 'boot-project');
  fs.mkdirSync(path.join(projectRoot, 'ai', 'RC-MacAir-15', 'System', 'Views'), { recursive: true });
  const db = new Database(staged.dbPath);
  try {
    db.prepare(`INSERT INTO workspaces (id, label, icon, description, repo_path, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)`).run('boot-fixture', 'Boot Fixture', 'folder', 'Isolated legacy regression boot', projectRoot, 0);
    db.prepare(`INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run('last_active_workspace_id', 'boot-fixture', Date.now());
  } finally { db.close(); }

  const selectedPaths = mode === '--smoke'
    ? ['e2e/prompt-ownership.slice-c.spec.ts']
    : mode === '--working-return' ? ['e2e/working-activity.spec.ts'] : testPaths;
  const grepArgs = mode === '--smoke'
    ? ['--grep', 'composer drafts swap immediately']
    : mode === '--working-return' ? ['--grep', 'in-flight return restores original startedAt'] : [];
  const command = ['npx', 'playwright', 'test', '--config=e2e/chat-architecture/playwright.boot.config.ts', ...selectedPaths, ...grepArgs];
  fs.writeFileSync(path.join(evidenceRoot, 'manifest.json'), `${JSON.stringify({
    runId, mode, token, command, selectedPaths,
    sourceHashes: Object.fromEntries([
      'fusion-studio-client/e2e/chat-architecture/boot-regressions.mjs',
      'fusion-studio-client/e2e/chat-architecture/playwright.boot.config.ts',
      'fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs',
      'fusion-studio-client/e2e/chat-architecture/owned-regression-supervisor.mjs',
      'fusion-studio-client/e2e/chat-architecture/owned-regression-lifecycle.test.mjs',
      'fusion-studio-client/e2e/chat-architecture/fixture-lifecycle.mjs',
      'fusion-studio-client/e2e/chat-architecture/stage-fixture.mjs',
      'fusion-studio-client/e2e/support/working-activity-ws-fixture.ts',
      'fusion-studio-client/playwright.chat-architecture.config.ts',
      'fusion-studio-client/dist/index.html',
      'fusion-studio-server/server.js',
      ...testPaths.map((testPath) => `fusion-studio-client/${testPath}`),
    ].map((file) => [file, sha256(file)])),
    stagedServer: staged.stagedServer, profileRoot, workspaceRoot,
    serverPolicy: 'private migrated DB, test-owned workspace, PORT=0, loopback only; never port 3001',
    nativeAuthentication: 'existing trusted-shell browser fixture; Electron public route separately covered by V-SHELL/V-BASE',
  }, null, 2)}\n`, { flag: 'wx' });

  serverLog = fs.createWriteStream(serverLogPath, { flags: 'wx' });
  server = spawn(process.execPath, [path.join(staged.stagedServer, 'server.js'), token], {
    cwd: staged.stagedServer,
    env: { ...process.env, FUSION_APP_USER_DATA: profileRoot, FUSION_LOCAL_MACHINE: 'RC-MacAir-15', PORT: '0' },
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  port = await waitReady(server);
  assertSafePort(port);
  if (port === 0) throw new Error('staged server did not bind an ephemeral port');
  const baseURL = `http://127.0.0.1:${port}`;

  const wrapper = `
    const { spawnSync } = require('node:child_process');
    const [ownerToken, cwd, ...args] = process.argv.slice(1);
    if (!ownerToken.startsWith('chat-architecture-owner-')) process.exit(77);
    const child = spawnSync('npx', ['playwright', 'test', ...args], {
      cwd, env: process.env, stdio: 'inherit', timeout: 840000,
    });
    if (child.error) { console.error(child.error.message); process.exit(78); }
    process.exit(child.status ?? 79);
  `;
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    testResult = await runOwnedCommand({
      command: process.execPath,
      args: ['-e', wrapper, token, clientRoot, '--config=e2e/chat-architecture/playwright.boot.config.ts', ...selectedPaths, ...grepArgs],
      cwd: clientRoot,
      env: {
        ...process.env,
        CHAT_ARCH_BOOT_BASE_URL: baseURL,
        CHAT_ARCH_BOOT_RESULT_PATH: resultPath,
        CHAT_ARCH_BOOT_OUTPUT_DIR: path.join(tempRoot, 'playwright-output'),
        FUSION_APP_USER_DATA: profileRoot,
        FUSION_LOCAL_MACHINE: 'RC-MacAir-15',
      },
      token,
      logPath: path.join(evidenceRoot, 'playwright.log'),
      deadlineMs: 900_000,
      signal: controller.signal,
    });
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
  if (!fs.existsSync(resultPath)) throw new Error('Playwright did not emit case-level JSON');
  const playwrightOutput = path.join(tempRoot, 'playwright-output');
  if (fs.existsSync(playwrightOutput)) {
    fs.cpSync(playwrightOutput, path.join(evidenceRoot, 'playwright-output'), { recursive: true });
  }
  const report = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const cases = findCases(report.suites ?? []);
  if (!cases.length) throw new Error('Playwright selected zero cases');
  const setupFailures = cases.filter((entry) => entry.results.some((result) =>
    /Cannot navigate to invalid URL|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE/.test(result.error ?? '')));
  fs.writeFileSync(path.join(evidenceRoot, 'case-summary.json'), `${JSON.stringify({
    runId, mode, port, baseURL, total: cases.length,
    byStatus: Object.fromEntries([...new Set(cases.map((entry) => entry.status))].map((status) => [status, cases.filter((entry) => entry.status === status).length])),
    setupFailures, cases,
  }, null, 2)}\n`, { flag: 'wx' });
  if (testResult.timedOut || testResult.interrupted || testResult.leakedOwnedPids.length || setupFailures.length) {
    throw new Error(`boot lane invalid: timeout=${testResult.timedOut}, interrupted=${testResult.interrupted}, leaked=${testResult.leakedOwnedPids.length}, setup=${setupFailures.length}`);
  }
} catch (error) {
  failure = error.stack || error.message;
} finally {
  if (server) {
    try { await terminateOwnedProcess(server, token); }
    catch (error) { failure ||= `server teardown: ${error.stack || error.message}`; }
  }
  if (serverLog) await new Promise((resolve) => serverLog.end(resolve));
  assertDisposablePath(tempRoot, token);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.writeFileSync(path.join(evidenceRoot, 'result.json'), `${JSON.stringify({
    runId, mode, status: failure ? 'failed' : testResult?.code === 0 ? 'passed' : 'observed-red', port, testResult, failure,
    ownedRunRootRemoved: !fs.existsSync(tempRoot),
  }, null, 2)}\n`, { flag: 'wx' });
}

if (failure) {
  process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`CHAT_ARCH_BOOT_REGRESSIONS_OBSERVED ${runId}\n`);
  // Characterization may observe product-red cases, but the underlying
  // Playwright exit remains visible to callers and cannot be mistaken for a
  // green regression gate.
  process.exitCode = testResult.code ?? 1;
}
