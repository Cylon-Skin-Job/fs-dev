import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertDisposablePath, markOwnedDirectory, runOwnedCommand } from './fixture-lifecycle.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, '../../..');
const evidenceBase = path.join(repoRoot, 'ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-01/01C');
const [kind, mode] = process.argv.slice(2);
if (!['boot', 'server-focused'].includes(kind)
  || (kind === 'boot' && !['--all', '--smoke', '--working-return'].includes(mode))
  || (kind === 'server-focused' && mode !== undefined)
  || process.argv.length > (kind === 'boot' ? 4 : 3)) {
  throw new Error('usage: node owned-regression-launcher.mjs boot <--all|--smoke|--working-return> | server-focused');
}

const runId = `${kind}-${Date.now()}-${randomBytes(4).toString('hex')}`;
const token = `chat-architecture-owner-${runId}`;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${runId}-`));
markOwnedDirectory(tempRoot, token, `${kind}-run`);
const evidenceRoot = path.join(evidenceBase, runId);
fs.mkdirSync(evidenceRoot, { recursive: true });
const program = path.join(directory, kind === 'boot' ? 'boot-regressions.mjs' : 'server-focused-regressions.mjs');
const supervisor = path.join(directory, 'owned-regression-supervisor.mjs');
const args = [supervisor, token, String(process.pid), tempRoot, program, ...(mode ? [mode] : [])];
const controller = new AbortController();
const abort = () => controller.abort();
process.once('SIGINT', abort);
process.once('SIGTERM', abort);
let result = null;
let failure = null;

fs.writeFileSync(path.join(evidenceRoot, 'launcher-manifest.json'), `${JSON.stringify({
  runId, kind, mode: mode ?? null, token, ownerPid: process.pid, tempRoot,
  supervisedCommand: [process.execPath, ...args],
  parentLossPolicy: '01C supervisor watches owner PID including zombie state, kills target descendants and removes marked root',
  deadlineMs: kind === 'boot' ? 900_000 : 540_000,
}, null, 2)}\n`, { flag: 'wx' });

try {
  result = await runOwnedCommand({
    command: process.execPath,
    args,
    cwd: repoRoot,
    env: {
      ...process.env,
      CHAT_ARCH_REGRESSION_CONTEXT: JSON.stringify({ runId, token, tempRoot, evidenceRoot }),
    },
    token,
    logPath: path.join(evidenceRoot, 'launcher.log'),
    deadlineMs: kind === 'boot' ? 900_000 : 540_000,
    signal: controller.signal,
  });
  if (result.timedOut || result.interrupted || result.leakedOwnedPids.length) {
    failure = `owned regression lifecycle failure: timeout=${result.timedOut}, interrupted=${result.interrupted}, leaked=${result.leakedOwnedPids.join(',')}`;
  }
} catch (error) {
  failure = error.stack || error.message;
} finally {
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
  if (fs.existsSync(tempRoot)) {
    assertDisposablePath(tempRoot, token);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(evidenceRoot, 'launcher-result.json'), `${JSON.stringify({
    runId, kind, mode: mode ?? null, result, failure,
    ownedRunRootRemoved: !fs.existsSync(tempRoot),
  }, null, 2)}\n`, { flag: 'wx' });
}

if (failure) {
  process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.code ?? 1;
}
