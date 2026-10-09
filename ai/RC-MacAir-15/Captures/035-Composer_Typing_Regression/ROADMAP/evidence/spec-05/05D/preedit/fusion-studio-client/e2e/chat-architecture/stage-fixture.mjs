import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertDisposablePath, markOwnedDirectory } from './fixture-lifecycle.mjs';

const require = createRequire(import.meta.url);

function copyTree(source, target, excludedNames = new Set()) {
  fs.cpSync(source, target, {
    recursive: true,
    dereference: false,
    filter(candidate) {
      const name = path.basename(candidate);
      if (excludedNames.has(name)) return false;
      return candidate === source || !fs.lstatSync(candidate).isSymbolicLink();
    },
  });
}

function symlinkDirectory(source, target) {
  fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}

function replaceOnce(file, needle, replacement, label) {
  const source = fs.readFileSync(file, 'utf8');
  const occurrences = source.split(needle).length - 1;
  if (occurrences !== 1) {
    throw new Error(`staged patch ${label} expected one match, found ${occurrences}`);
  }
  fs.writeFileSync(file, source.replace(needle, replacement));
}

function installFaultSeams(stagedServer) {
  const runtimeControllerFile = path.join(stagedServer, 'lib', 'thread', 'runtime-prompt-admission.js');
  replaceOnce(
    runtimeControllerFile,
    "const { captureRuntimeTarget, activationBindingIsCurrent } = require('./runtime-session-binding');",
    `const { captureRuntimeTarget, activationBindingIsCurrent } = require('./runtime-session-binding');\nconst { evaluateGate, parseSchedule } = require('../harness/opencode/fixture-fault-runtime.cjs');`,
    'runtime controller fault import',
  );
  replaceOnce(
    runtimeControllerFile,
    '  const turnId = randomUUID();\n  let activityRecorded = false;',
    `  const turnId = randomUUID();\n  const faultSchedule = parseSchedule();\n  try {\n    await evaluateGate(faultSchedule, 'before-admission', 'server');\n  } catch {\n    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);\n    await rejectReserved('before_admission_fault');\n    reportPromptAcceptanceFailure(ws, threadId, requestId);\n    return;\n  }\n  let activityRecorded = false;`,
    'before durable admission',
  );
  replaceOnce(
    runtimeControllerFile,
    "  // The receipt is the acceptance authority. A failed compatibility counter",
    `  try {\n    await evaluateGate(faultSchedule, 'after-admission', 'server');\n  } catch {\n    threadRuntimeManager.markOwnedState(ownership, RUNTIME_STATES.READY);\n    reportAcceptedExecutionFailure(ws, threadId, requestId);\n    return;\n  }\n  // The receipt is the acceptance authority. A failed compatibility counter`,
    'after durable admission',
  );
  replaceOnce(
    runtimeControllerFile,
    "  try {\n    ws.send(JSON.stringify({ type: 'message:sent', workspaceId: target.workspaceId,",
    `  try {\n    const beforeAck = await evaluateGate(faultSchedule, 'before-ack', 'transport');\n    if (!beforeAck?.dropped) ws.send(JSON.stringify({ type: 'message:sent', workspaceId: target.workspaceId,`,
    'before receipt acknowledgement',
  );
  replaceOnce(
    runtimeControllerFile,
    "      content: acceptedReceipt.content }));\n  } catch (_error) { /* receipt readback owns delivery recovery */ }",
    `      content: acceptedReceipt.content }));\n    await evaluateGate(faultSchedule, 'after-ack', 'transport');\n  } catch (_error) { /* receipt readback owns delivery recovery */ }`,
    'after receipt acknowledgement',
  );

  const broadcasterFile = path.join(stagedServer, 'lib', 'wire', 'wire-broadcaster.js');
  replaceOnce(
    broadcasterFile,
    "const { on } = require('../event-bus');",
    `const { on } = require('../event-bus');\nconst { evaluateGate, parseSchedule } = require('../harness/opencode/fixture-fault-runtime.cjs');`,
    'broadcaster fault runtime import',
  );
  replaceOnce(
    broadcasterFile,
    "  on('chat-turn:saved', (event) => {\n    sendToThread(event, {",
    `  on('chat-turn:saved', async (event) => {\n    const faultSchedule = parseSchedule();\n    await evaluateGate(faultSchedule, 'before-save-ack', 'server');\n    const transport = await evaluateGate(faultSchedule, 'after-save-ack', 'transport');\n    if (transport?.dropped) return;\n    sendToThread(event, {`,
    'saved turn acknowledgement gates',
  );
}

export async function stageFixture({ repoRoot, stageRoot, profileRoot, workspaceRoot, token }) {
  markOwnedDirectory(stageRoot, token, 'stage');
  markOwnedDirectory(profileRoot, token, 'profile');
  markOwnedDirectory(workspaceRoot, token, 'workspace');
  const stagedClient = path.join(stageRoot, 'fusion-studio-client');
  const stagedServer = path.join(stageRoot, 'fusion-studio-server');
  const stagedSystemManager = path.join(stageRoot, 'System_Manager');
  fs.mkdirSync(stagedClient);
  copyTree(path.join(repoRoot, 'fusion-studio-client', 'electron'), path.join(stagedClient, 'electron'), new Set(['resources']));
  copyTree(path.join(repoRoot, 'fusion-studio-client', 'dist'), path.join(stagedClient, 'dist'));
  symlinkDirectory(path.join(repoRoot, 'fusion-studio-client', 'node_modules'), path.join(stagedClient, 'node_modules'));
  symlinkDirectory(
    path.join(repoRoot, 'fusion-studio-client', 'electron', 'resources'),
    path.join(stagedClient, 'electron', 'resources'),
  );
  copyTree(
    path.join(repoRoot, 'fusion-studio-server'),
    stagedServer,
    new Set(['node_modules', 'data', '.git', 'coverage', 'release']),
  );
  copyTree(
    path.join(repoRoot, 'System_Manager', 'ai-template'),
    path.join(stagedSystemManager, 'ai-template'),
  );
  symlinkDirectory(path.join(repoRoot, 'fusion-studio-server', 'node_modules'), path.join(stagedServer, 'node_modules'));
  fs.copyFileSync(
    path.join(import.meta.dirname, 'deterministic-opencode-adapter.cjs'),
    path.join(stagedServer, 'lib', 'harness', 'opencode', 'index.js'),
  );
  fs.copyFileSync(
    path.join(import.meta.dirname, 'fixture-fault-runtime.cjs'),
    path.join(stagedServer, 'lib', 'harness', 'opencode', 'fixture-fault-runtime.cjs'),
  );
  installFaultSeams(stagedServer);

  const previousUserData = process.env.FUSION_APP_USER_DATA;
  process.env.FUSION_APP_USER_DATA = profileRoot;
  const stagedRequire = createRequire(path.join(stagedServer, 'package.json'));
  const { initDb, closeDb } = stagedRequire('./lib/db.js');
  try {
    await initDb();
    await closeDb();
  } finally {
    if (previousUserData === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousUserData;
  }

  const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
  const dbPath = path.join(profileRoot, 'server-data', 'fusion.db');
  const db = new Database(dbPath);
  try {
    db.prepare('DELETE FROM workspaces').run();
    db.prepare("DELETE FROM system_config WHERE key = 'last_active_workspace_id'").run();
    if (db.prepare('SELECT COUNT(*) AS count FROM workspaces').get().count !== 0) {
      throw new Error('fixture workspace registry was not empty before Electron launch');
    }
    const migrations = db.prepare('SELECT name FROM knex_migrations ORDER BY id').all().map((row) => row.name);
    if (!migrations.includes('044_thread_group_placement_outbox.js')) {
      throw new Error('fixture database did not migrate through 044_thread_group_placement_outbox.js');
    }
  } finally {
    db.close();
  }
  assertDisposablePath(stageRoot, token);
  assertDisposablePath(profileRoot, token);
  assertDisposablePath(workspaceRoot, token);
  return { stagedClient, stagedServer, dbPath };
}
