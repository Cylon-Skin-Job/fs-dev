import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import {
  assertDisposablePath,
  markOwnedDirectory,
  runOwnedCommand,
} from './fixture-lifecycle.mjs';
import { ENFORCE_GROUPS, assertEnforcementCoverage } from './scenario-inventory.mjs';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const evidenceBase = path.join(
  repoRoot,
  'ai',
  'RC-MacAir-15',
  'Captures',
  '035-Composer_Typing_Regression',
  'ROADMAP',
  'evidence',
  'spec-01',
  '01B',
);
const namedSuites = new Set(['baseline', 'submit', 'actions', 'render', 'backend', 'all', 'soak', 'shell', 'native']);
const namedModes = new Set(['characterize', 'enforce']);
const caseCatalog = {
  'R8-PRE-RECEIPT-UPGRADE': {
    name: 'Pre-receipt SQLite upgrade preserves null-view and view-bound history through authenticated route and restart',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'r8-upgrade-electron.mjs'),
    scenarioIds: ['R8-PRE-RECEIPT-UPGRADE'],
  },
  'R8-OWNER-GRAPH': {
    name: 'Final backend owner graph, line limits and detector sensitivity',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'backend-owner-contract.test.mjs'),
    scenarioIds: ['R8-GROUP-BACKEND-MATRIX'],
  },
  'R8-EXACT-MEMBER-HYDRATION': {
    name: 'Exact member history-only hydration preserves Main and pending opens',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'r8-history-playwright.mjs'),
    deadlineMs: 150_000,
    scenarioIds: ['R8-EXACT-MEMBER-HYDRATION'],
  },
  'R8-UI-LIFECYCLE': {
    name: 'Authenticated production UI create, Send, Stop, Move, reconnect and Delete with durable readback',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'r8-ui-electron.mjs'),
    scenarioIds: ['R8-UI-LIFECYCLE'],
  },
  'R7-R8-RUNTIME-OWNERSHIP': {
    name: 'R7/R8 exact activation, drain, Stop and terminal ownership',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'server-focused-regressions.mjs'),
    scenarioIds: ['R7-R8-RUNTIME-OWNERSHIP'],
  },
  'R8-MIRROR-RECOVERY': {
    name: 'R8 mirror/delete/Move faults, receipt cascade and restart readback through isolated public routes',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'server-focused-regressions.mjs'),
    scenarioIds: ['R8-MIRROR-RECOVERY'],
  },
  'R8-SESSION-LIFECYCLE': {
    name: 'R8 session create/open/warm/close/capacity and transactional faults through isolated public routes',
    suites: ['backend', 'all'],
    program: path.join(import.meta.dirname, 'server-focused-regressions.mjs'),
    scenarioIds: ['R8-SESSION-LIFECYCLE'],
  },
  'F1-PUBLIC-ROUTE': {
    name: 'fresh empty Capture create/open/type/Send/Stop and DB/UI readback',
    suites: ['baseline', 'render', 'all'],
    program: path.join(import.meta.dirname, 'f1-electron.mjs'),
    scenarioIds: ['R7-STREAM-STOP-SAVE'],
  },
  'FAULT-SERVER-ADMISSION': {
    name: 'authenticated public-route server admission throw remains distinct from transport',
    suites: ['baseline', 'all'],
    program: path.join(import.meta.dirname, 'fault-route-electron.mjs'),
    extraArgs: ['server-admission'],
  },
  'FAULT-TRANSPORT-ACK': {
    name: 'authenticated public-route message acceptance with dropped outbound ACK',
    suites: ['baseline', 'all'],
    program: path.join(import.meta.dirname, 'fault-route-electron.mjs'),
    extraArgs: ['transport-ack'],
  },
  'FAULT-SAVE-ACK': {
    name: 'authenticated durable exchange with dropped saved-turn acknowledgement',
    suites: ['baseline', 'all'],
    program: path.join(import.meta.dirname, 'fault-route-electron.mjs'),
    extraArgs: ['save-ack'],
  },
  'SHELL-VIEW-BOUND': {
    name: 'existing authenticated view-bound production shell smoke',
    suites: ['shell'],
    program: path.join(repoRoot, 'fusion-studio-client', 'e2e', 'view-bound-shell-smoke.mjs'),
  },
  'R1-F2-F3-COMPOSER': {
    name: 'R1 matched startup, warm, and fixed-45-second-settled production composer observation over F2/F3',
    suites: ['baseline', 'render', 'all'],
    program: path.join(import.meta.dirname, 'r1-electron.mjs'),
    scenarioIds: ['R1-STARTUP-F2-F3', 'R1-WARM-F2-F3', 'R1-SETTLED45-F2-F3', 'R1-DENSE-F2'],
  },
  'R1-COMPOSER-CORRECTNESS': {
    name: 'R1 exact-session duplicate mount, input semantics, and draft-local render assertions',
    suites: ['render', 'all'],
    program: path.join(import.meta.dirname, 'r1-composer-playwright.mjs'),
    scenarioIds: ['R1-COMPOSER-INPUT', 'R1-COMPOSER-LOCALITY'],
  },
  'R9-NATIVE-INPUT': {
    name: 'Native keyboard/paste capability; optional bounded owner manual window',
    suites: ['native'],
    program: path.join(import.meta.dirname, 'native-input-electron.mjs'),
    scenarioIds: ['R9-NATIVE-OWNER-SYMPTOMS'],
  },
  'R9-45-MINUTE-SOAK': {
    name: 'Full persistent 45-minute F2-F5 input, lifecycle and resource workload',
    suites: ['soak'],
    program: path.join(import.meta.dirname, 'soak-electron.mjs'),
    scenarioIds: ['R9-45-MINUTE-SOAK'],
  },
  'R9-LIFECYCLE-RESOURCES': {
    name: 'Twenty persistent unique group lifecycle/resource cycles',
    suites: ['render'],
    explicitOnly: true,
    program: path.join(import.meta.dirname, 'soak-electron.mjs'),
    extraArgs: ['--lifecycle-only'],
    scenarioIds: ['R9-LIFECYCLE-RESOURCES'],
  },
  'R9-WATCHED-FOREGROUND-SETUP': {
    name: 'Watched setup only; no typing or performance enforcement credit',
    suites: ['render'], explicitOnly: true, diagnosticDeadlineMs: 240000,
    program: path.join(import.meta.dirname, 'r1-sustained-electron.mjs'),
    extraArgs: ['--setup-only'], scenarioIds: ['R9-WATCHED-FOREGROUND-SETUP'],
  },
  'R1-FIVE-MINUTE-TYPING': {
    name: 'R1 five-minute continuous 9,520-character typing observation over settled F2/F3',
    suites: ['render'],
    program: path.join(import.meta.dirname, 'r1-sustained-electron.mjs'),
    scenarioIds: ['R1-FIVE-MINUTE-TYPING'],
  },
  'R7-HISTORY-LIVE': {
    name: 'R7 completed-history revision/cache locality during 20fps live output and hydration',
    suites: ['render', 'all'],
    program: path.join(import.meta.dirname, 'r7-history-playwright.mjs'),
    scenarioIds: ['R7-HISTORY-LIVE-OBSERVATION'],
  },
  'R2-NO-ENQUEUE': {
    name: 'R2 authenticated disconnect-before-click and enqueue-throw/race characterization',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'r2-electron.mjs'),
    scenarioIds: ['R2-DISCONNECT-BEFORE-CLICK', 'R2-ENQUEUE-THROW-RACE'],
  },
  'R3-LOST-ACK-STATUS': {
    name: 'R3 authenticated lost-ACK reconnect/status probe with future receipt assertions',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'future-submit-electron.mjs'),
    extraArgs: ['R3-LOST-ACK-STATUS'],
    scenarioIds: ['R3-LOST-ACK-STATUS'],
  },
  'R3-RECONNECT-UI': {
    name: 'R3 same-renderer reconnect automatically recovers the dropped ACK through status',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'future-submit-electron.mjs'),
    extraArgs: ['R3-RECONNECT-UI'],
    scenarioIds: ['R3-RECONNECT-UI'],
  },
  'R4-DISTINCT-ATTEMPTS': {
    name: 'R4 authenticated deliberate distinct-attempt probe with future correlation assertions',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'future-submit-electron.mjs'),
    extraArgs: ['R4-DISTINCT-ATTEMPTS'],
    scenarioIds: ['R4-DISTINCT-ATTEMPTS'],
  },
  'R4-DISTINCT-RECEIPTS': {
    name: 'R4 two deliberate attempts produce two durable receipts after 02B',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'future-submit-electron.mjs'),
    extraArgs: ['R4-DISTINCT-RECEIPTS'],
    scenarioIds: ['R4-DISTINCT-RECEIPTS'],
  },
  'R4-LATE-DRAFT-RECOVERY': {
    name: 'R4 delayed original ACK, editable unknown state, remount/restart draft isolation',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'future-submit-electron.mjs'),
    extraArgs: ['R4-LATE-DRAFT-RECOVERY'],
    scenarioIds: ['R4-LATE-DRAFT-RECOVERY'],
  },
  'R4-DUPLICATE-MISMATCH': {
    name: 'R4 authenticated exact duplicate and mismatched fingerprint durable admission probe',
    suites: ['baseline', 'submit', 'all'],
    program: path.join(import.meta.dirname, 'future-submit-electron.mjs'),
    extraArgs: ['R4-DUPLICATE-MISMATCH'],
    scenarioIds: ['R4-DUPLICATE-MISMATCH'],
  },
  'R5-R6-PUBLIC-ACTIONS': {
    name: 'R5 actual action callers and R6 production consumer presence through authenticated shell',
    suites: ['baseline', 'actions', 'all'],
    program: path.join(import.meta.dirname, 'r5-r6-electron.mjs'),
    scenarioIds: ENFORCE_GROUPS.actions.filter((id) => id.startsWith('R5-')),
  },
  'R5-CURRENT-ACTIONS': {
    name: 'R5 current target File/Wiki/Office insertion, source switch and visible failure',
    suites: ['actions', 'all'],
    program: path.join(import.meta.dirname, 'r5-r6-electron.mjs'),
    extraArgs: ['r5-current'],
    scenarioIds: ENFORCE_GROUPS.actions.filter((id) => ['R5-FILE-ACTION', 'R5-WIKI-ACTION',
      'R5-OFFICE-ACTION', 'R5-SOURCE-SWITCH', 'R5-TEXT-INSERT', 'R5-NO-TARGET-CONSUMER'].includes(id)),
  },
  'R6-PRODUCTION-ACTION-OWNER': {
    name: 'conditional authenticated production prompt/create action-owner lifetime after SPEC-03 consumer',
    suites: ['actions', 'all'],
    program: path.join(import.meta.dirname, 'r5-r6-electron.mjs'),
    extraArgs: ['r6-owner'],
    scenarioIds: ['R6-PRODUCTION-ACTION-OWNER'],
  },
  'R5-DIAGNOSTIC-APPEND': {
    name: 'R5 actual diagnostic Ask AI append path preserves draft and does not auto-send',
    suites: ['baseline', 'actions', 'all'],
    program: path.join(import.meta.dirname, 'r5-diagnostic-playwright.mjs'),
    scenarioIds: ['R5-DIAGNOSTIC-APPEND'],
  },
  'R5-CURRENT-OWNER': {
    name: 'R5 exact current insert/send bridge across duplicate mounts',
    suites: ['actions', 'all'],
    program: path.join(import.meta.dirname, 'r5-diagnostic-playwright.mjs'),
    extraArgs: ['r5-current-owner'],
    scenarioIds: ['R5-TEXT-INSERT'],
  },
  'R6-LIFETIME-BOUNDARIES': {
    name: 'R6 authenticated application-owned prompt/create lifecycle and cleanup',
    suites: ['baseline', 'actions', 'all'],
    program: path.join(import.meta.dirname, 'r5-r6-electron.mjs'),
    extraArgs: ['r6-lifetime'],
    scenarioIds: ['R6-PROMPT-UNMOUNT', 'R6-CREATE-RECONNECT', 'R6-UNRELATED-OPEN-LISTENERS', 'R6-PROMPT-CREATE-COMPLETION'],
  },
  'R9-INDICATOR-DISTINCTION': {
    name: 'R9 authenticated F2/F5 prompt, turn, indicator, and blocked-renderer lifecycle distinctions',
    suites: ['baseline', 'render', 'all'],
    program: path.join(import.meta.dirname, 'r9-electron.mjs'),
    scenarioIds: ['R9-INDICATOR-DISTINCTION'],
  },
  'R1-R9-CONTRACT-INVENTORY': {
    name: 'R1-R9 concrete inventory, deterministic F2-F5 contracts, and fail-closed future assertions',
    suites: ['baseline'],
    program: path.join(import.meta.dirname, 'observation-contract.test.mjs'),
    scenarioIds: ['R8-GROUP-BACKEND-MATRIX'],
  },
};

function usageError(message) {
  throw new Error(`${message}\nusage: node fusion-studio-client/e2e/chat-architecture/run.mjs --suite <baseline|submit|actions|render|backend|all|soak|shell|native> --mode <characterize|enforce> [--cases <IDs>] [--duration-ms <milliseconds>]`);
}

function parseArgs(argv) {
  const allowed = new Set(['--suite', '--mode', '--cases', '--duration-ms']);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag)) usageError(`unknown flag: ${flag || '<empty>'}`);
    if (value === undefined || value.startsWith('--')) usageError(`missing value for ${flag}`);
    if (Object.hasOwn(parsed, flag)) usageError(`duplicate flag: ${flag}`);
    parsed[flag] = value;
  }
  if (!parsed['--suite']) usageError('missing --suite');
  if (!parsed['--mode']) usageError('missing --mode');
  if (!namedSuites.has(parsed['--suite'])) usageError(`unknown suite: ${parsed['--suite']}`);
  if (!namedModes.has(parsed['--mode'])) usageError(`unknown mode: ${parsed['--mode']}`);
  if (parsed['--duration-ms'] !== undefined) {
    if (parsed['--suite'] !== 'soak') usageError('--duration-ms is only valid with --suite soak');
    const durationMs = Number(parsed['--duration-ms']);
    if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > 3_300_000) {
      usageError('--duration-ms must be an integer from 1 through 3300000');
    }
    if (durationMs !== 2_700_000) usageError('V-SOAK requires exactly 2700000ms; short diagnostics cannot satisfy it');
    parsed.durationMs = durationMs;
  } else if (parsed['--suite'] === 'soak') {
    usageError('--suite soak requires --duration-ms');
  }
  const available = Object.entries(caseCatalog)
    .filter(([, entry]) => entry.suites.includes(parsed['--suite']))
    .map(([id]) => id);
  const enforcementGroup = ENFORCE_GROUPS[parsed['--suite']] || [];
  const defaultCases = available.filter(id => !caseCatalog[id].explicitOnly);
  assertEnforcementCoverage(parsed['--suite'], defaultCases, caseCatalog, enforcementGroup);
  let cases = defaultCases;
  if (parsed['--cases'] !== undefined) {
    cases = parsed['--cases'].split(',');
    if (cases.some((id) => !id) || new Set(cases).size !== cases.length) {
      usageError('--cases must contain unique, non-empty comma-separated IDs');
    }
    for (const id of cases) {
      if (!caseCatalog[id]) usageError(`unknown case: ${id}`);
      if (!available.includes(id)) usageError(`case ${id} is not part of suite ${parsed['--suite']}`);
    }
  }
  if (cases.length === 0) {
    usageError(`suite ${parsed['--suite']} is reserved but has no slice-owned cases yet`);
  }
  return {
    suite: parsed['--suite'],
    mode: parsed['--mode'],
    cases,
    diagnosticDeadlines:Object.fromEntries(cases.filter(id=>caseCatalog[id].diagnosticDeadlineMs).map(id=>[id,caseCatalog[id].diagnosticDeadlineMs])),
    enforcementGroup,
    durationMs: parsed.durationMs ?? null,
  };
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function hashFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return { relativePath, sha256: sha256Bytes(fs.readFileSync(absolutePath)) };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

const requested = parseArgs(process.argv.slice(2));
const suiteStartedAt = Date.now();
const suiteDeadlineMs = requested.suite === 'soak' ? 3_300_000 : 900_000;
const suiteDeadlineAt = suiteStartedAt + suiteDeadlineMs;
const runId = `chat-arch-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
const token = `chat-architecture-owner-${runId}`;
const evidenceRoot = path.join(evidenceBase, runId);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${runId}-`));
markOwnedDirectory(tempRoot, token, 'run');
fs.mkdirSync(evidenceRoot, { recursive: true });

const workload = {
  version: 1,
  cases: requested.cases.map((id) => ({ id, name: caseCatalog[id].name })),
  fixture: 'fresh disposable profile, migrated fusion.db, fresh empty Capture workspace',
  adapter: 'canonical deterministic OpenCode iterator at 20 text frames/second',
  scenarioInventory: 'R1-R9 concrete IDs and later owning contracts in scenario-inventory.mjs',
  enforcementGroup: requested.enforcementGroup,
};
const workloadBytes = Buffer.from(`${JSON.stringify(workload, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceRoot, 'workload-manifest.json'), workloadBytes, { flag: 'wx' });
const electronVersion = require('../../node_modules/electron/package.json').version;
const statusScope = [
  'fusion-studio-client/e2e/chat-architecture',
  'fusion-studio-client/playwright.chat-architecture.config.ts',
  'fusion-studio-client/electron/main.cjs',
  'fusion-studio-client/electron/server-spawn.cjs',
  'fusion-studio-server/server.js',
  'fusion-studio-server/lib/harness/registry.js',
  'fusion-studio-server/lib/db/migrations/044_thread_group_placement_outbox.js',
];
const gitStatus = spawnSync('git', ['status', '--short', '--', ...statusScope], { cwd: repoRoot, encoding: 'utf8' });
const manifest = {
  runId,
  token,
  requested,
  suiteDeadline: { startedAt: suiteStartedAt, durationMs: suiteDeadlineMs, deadlineAt: suiteDeadlineAt },
  source: {
    head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim(),
    statusScope,
    status: gitStatus.stdout.split('\n').filter(Boolean),
    files: [
      'fusion-studio-client/e2e/chat-architecture/run.mjs',
      'fusion-studio-client/e2e/chat-architecture/f1-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/fault-route-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/owned-case-supervisor.mjs',
      'fusion-studio-client/e2e/chat-architecture/fixture-fault-runtime.cjs',
      'fusion-studio-client/e2e/chat-architecture/fixture-lifecycle.mjs',
      'fusion-studio-client/e2e/chat-architecture/stage-fixture.mjs',
      'fusion-studio-client/e2e/chat-architecture/deterministic-opencode-adapter.cjs',
      'fusion-studio-client/e2e/chat-architecture/runner-lifecycle.test.mjs',
      'fusion-studio-client/e2e/chat-architecture/scenario-inventory.mjs',
      'fusion-studio-client/e2e/chat-architecture/fixture-workloads.mjs',
      'fusion-studio-client/e2e/chat-architecture/electron-case-helpers.mjs',
      'fusion-studio-client/e2e/chat-architecture/r1-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/r1-sustained-electron.mjs',
      ...['soak-electron.mjs','soak-actions.mjs','soak-resources.mjs','soak-measurement.mjs','native-input-electron.mjs','manual-input-window.mjs','owned-focus-observation.mjs',
  'watched-trace-core.mjs','watched-renderer-trace.mjs','watched-setup-trace.mjs','r1-sustained-observation.mjs','owner-foreground.mjs','watched-pointer.mjs','r1-sustained-fixture.mjs','message-list-observation.mjs','session-retirement.test.mjs'].map(name => `fusion-studio-client/e2e/chat-architecture/${name}`),
      'fusion-studio-client/e2e/chat-architecture/r7-history-playwright.mjs',
      'fusion-studio-client/e2e/chat-architecture/r2-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/r8-ui-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/r8-upgrade-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/r8-history-playwright.mjs',
      'fusion-studio-client/e2e/chat-surface-identity.spec.ts',
      'fusion-studio-client/e2e/chat-architecture/backend-owner-contract.mjs',
      'fusion-studio-client/e2e/chat-architecture/backend-owner-contract.test.mjs',
      'fusion-studio-client/e2e/chat-architecture/r5-r6-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/r5-diagnostic-playwright.mjs',
      'fusion-studio-client/e2e/chat-architecture/r6-boundaries-playwright.mjs',
      'fusion-studio-client/e2e/chat-architecture/r9-playwright.mjs',
      'fusion-studio-client/e2e/chat-architecture/r9-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/future-submit-electron.mjs',
      'fusion-studio-client/e2e/chat-architecture/observation-contract.test.mjs',
      'fusion-studio-client/e2e/chat-architecture/observation-boundaries.spec.ts',
      'fusion-studio-client/playwright.chat-architecture.config.ts',
      'fusion-studio-client/e2e/view-bound-shell-smoke.mjs',
      'fusion-studio-client/electron/main.cjs',
      'fusion-studio-server/server.js',
      'fusion-studio-server/lib/db/migrations/044_thread_group_placement_outbox.js',
    ].map(hashFile),
  },
  runtime: { node: process.version, electron: electronVersion, platform: process.platform, arch: process.arch },
  workloadHash: sha256Bytes(workloadBytes),
  paths: {
    evidenceRoot,
    ownedRunRoot: tempRoot,
    plannedProfile: path.join(tempRoot, 'profile'),
    plannedWorkspace: path.join(tempRoot, 'workspace'),
    plannedStage: path.join(tempRoot, 'stage'),
  },
  commands: requested.cases.map((id) => ({
    id,
    command: [process.execPath, path.join(import.meta.dirname, 'owned-case-supervisor.mjs'), token,
      String(process.pid), tempRoot, caseCatalog[id].program, token, evidenceRoot, tempRoot,
      ...(caseCatalog[id].extraArgs || [])],
  })),
};
writeJson(path.join(evidenceRoot, 'run-manifest.json'), manifest);
process.stdout.write(`CHAT_ARCH_RUN_MANIFEST ${JSON.stringify(manifest)}\n`);

const abortController = new AbortController();
const signalHandler = () => abortController.abort();
process.once('SIGINT', signalHandler);
process.once('SIGTERM', signalHandler);
const results = [];
let runFailure = null;

try {
  for (const id of requested.cases) {
    const remainingMs = suiteDeadlineAt - Date.now();
    if (remainingMs <= 0) throw Object.assign(new Error(`suite exceeded its ${suiteDeadlineMs}ms deadline before ${id}`), { exitCode: 124 });
    const caseEnv = { ...process.env, FUSION_CHAT_ARCH_MODE: requested.mode, FUSION_CHAT_ARCH_CASE_ID: id, FUSION_CHAT_ARCH_DURATION_MS: String(requested.durationMs || '') };
    if (id === 'SHELL-VIEW-BOUND') {
      const shellProfile = path.join(tempRoot, 'shell-profile');
      const shellWorkspace = path.join(tempRoot, 'shell-workspace');
      markOwnedDirectory(shellProfile, token, 'shell-profile');
      markOwnedDirectory(shellWorkspace, token, 'shell-workspace');
      caseEnv.FUSION_CHAT_ARCH_SHELL_PROFILE = shellProfile;
      caseEnv.FUSION_CHAT_ARCH_SHELL_WORKSPACE = shellWorkspace;
      caseEnv.FUSION_CHAT_ARCH_EVIDENCE_ROOT = evidenceRoot;
      caseEnv.FUSION_CHAT_ARCH_OWNER_TOKEN = token;
    }
    const targetArgs = [token, evidenceRoot, tempRoot, ...(caseCatalog[id].extraArgs || [])];
    const commandArgs = [path.join(import.meta.dirname, 'owned-case-supervisor.mjs'), token,
      String(process.pid), tempRoot, caseCatalog[id].program, ...targetArgs];
    const ownershipPath = path.join(evidenceRoot, `${id.toLowerCase()}-ownership.json`);
    const result = await runOwnedCommand({
      command: process.execPath,
      args: commandArgs,
      cwd: repoRoot,
      env: caseEnv,
      token,
      logPath: path.join(evidenceRoot, `${id.toLowerCase()}.log`),
      deadlineMs: Math.min(remainingMs,caseCatalog[id].diagnosticDeadlineMs||remainingMs),
      signal: abortController.signal,
      onStart(owned) {
        writeJson(ownershipPath, {
          ...owned,
          token,
          ownedRunRoot: tempRoot,
          refusalPolicy: ['live Fusion Studio profile', 'live Alpha profile', 'development fusion.db', 'unrelated PID', 'port 3001'],
        });
        process.stdout.write(`CHAT_ARCH_PROCESS_OWNERSHIP ${JSON.stringify({ id, ...owned, token, ownedRunRoot: tempRoot })}\n`);
      },
    });
    results.push({ id, ...result });
    if (result.leakedOwnedPids.length > 0) {
      throw new Error(`${id} leaked owned process group members: ${result.leakedOwnedPids.join(', ')}`);
    }
    if (result.timedOut) throw Object.assign(new Error(`${id} exceeded its owned deadline`), { exitCode: 124 });
    if (result.interrupted) throw Object.assign(new Error(`${id} interrupted`), { exitCode: 130 });
    if (result.code !== 0) {
      throw Object.assign(new Error(`${id} exited ${result.code ?? `by ${result.signal}`}`), { exitCode: result.code ?? 1 });
    }
    if (Date.now() > suiteDeadlineAt) throw Object.assign(new Error(`suite exceeded its ${suiteDeadlineMs}ms deadline after ${id}`), { exitCode: 124 });
  }
} catch (error) {
  runFailure = error;
} finally {
  process.removeListener('SIGINT', signalHandler);
  process.removeListener('SIGTERM', signalHandler);
  if (fs.existsSync(tempRoot)) {
    assertDisposablePath(tempRoot, token);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  writeJson(path.join(evidenceRoot, 'run-result.json'), {
    runId,
    status: runFailure ? 'failed' : 'passed',
    results,
    ownedRunRootRemoved: !fs.existsSync(tempRoot),
    failure: runFailure ? { name: runFailure.name, message: runFailure.message, stack: runFailure.stack } : null,
  });
}

if (runFailure) {
  process.stderr.write(`${runFailure.stack || runFailure.message}\n`);
  process.exitCode = runFailure.exitCode || 1;
} else {
  process.stdout.write(`CHAT_ARCH_RUN_OK ${runId}\n`);
}
