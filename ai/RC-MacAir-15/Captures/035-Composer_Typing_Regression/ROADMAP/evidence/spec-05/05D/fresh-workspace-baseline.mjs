import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanupFixture, closeOwnedApp, createChat, createProject, selectPanel,
  stageAndLaunch, waitFor, withDb } from '/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/e2e/chat-architecture/electron-case-helpers.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
assert.match(token || '', /^chat-architecture-owner-chat-arch-/);
const repoRoot = '/Users/rccurtrightjr./projects/fs-dev';
let fixture; let runtime; let failure; let cleanup; let lingering = [];
const evidence = { flows: {}, screenshots: [], frameCounts: {}, errors: [], consoleErrors: [] };
const readDb = (fn) => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, fn);
const prompt = '05D public UI exact partial persistence';
try {
  fixture = await stageAndLaunch({ repoRoot, token, tempRoot, evidenceRoot, casePrefix: 'r8-ui',
    eventScript: { frameIntervalMs: 50, textFrames: 200 } });
  // Controlled comparison only: restore captured accepted05C server libraries
  // inside this already-marked stage, keeping only the declared GUI adapter.
  const baselineLib = path.join(import.meta.dirname, 'preedit/fusion-studio-server/lib');
  const restored = [];
  function restore(directory, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = path.join(relative, entry.name);
      if (entry.isDirectory()) restore(path.join(directory, entry.name), rel);
      else if (rel !== 'harness/opencode/index.js') {
        fs.mkdirSync(path.dirname(path.join(fixture.stagedServer, 'lib', rel)), { recursive: true });
        fs.copyFileSync(path.join(directory, entry.name), path.join(fixture.stagedServer, 'lib', rel));
        restored.push(rel);
      }
    }
  }
  restore(baselineLib); evidence.baselineLibraries = restored;
  runtime = await fixture.launch();
  const { page, app } = runtime;
  page.setDefaultTimeout(30_000);
  page.on('dialog', dialog => dialog.accept());
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
  // Observation only: production sockets retain the real Electron proof.
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    try { const frame = JSON.parse(String(payload)); const { type } = frame;
      if (type === 'error' || type === 'state:error' || type === 'thread:action:error') evidence.errors.push(frame);
      evidence.frameCounts[type] = (evidence.frameCounts[type] || 0) + 1;
    } catch {}
  }));
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Connected'));
  const project = path.join(fixture.workspaceRoot, 'ui-lifecycle');
  await createProject(app, page, project, '05D Lifecycle');
  const panel = await createChat(page, fixture.dbPath);
  evidence.flows.create = { succeeded: true };
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  if (fixture && /locked/i.test(error.message)) {
    evidence.lockDiagnostic = { at: new Date().toISOString(),
      holders: spawnSync('lsof', ['-Fpcn', fixture.dbPath], { encoding: 'utf8' }).stdout,
      files: fs.readdirSync(path.dirname(fixture.dbPath)),
      serverTail: fs.existsSync(path.join(fixture.profileRoot, 'server-live.log'))
        ? fs.readFileSync(path.join(fixture.profileRoot, 'server-live.log'), 'utf8').slice(-16384) : null };
  }
  await runtime?.page.screenshot({ path: path.join(evidenceRoot, 'r8-ui-failure.png'), fullPage: true }).catch(() => {});
} finally {
  lingering = await closeOwnedApp(runtime);
  if (fixture) cleanup = cleanupFixture(fixture, token);
  fs.writeFileSync(path.join(evidenceRoot, 'r8-ui-result.json'), JSON.stringify({
    status: failure ? 'failed' : 'passed', ...evidence, failure, lingering, cleanup,
  }, null, 2));
}
assert.deepEqual(lingering, []);
assert.equal(cleanup?.dbQuickCheck, 'ok');
assert.equal(cleanup?.fixtureRootsRemoved, true);
if (failure && failure.message !== 'timed out waiting for public New Chat') throw new Error(failure.stack);
console.log('CHAT_ARCH_FRESH_WORKSPACE_BASELINE_OBSERVED', failure?.message || 'created');
