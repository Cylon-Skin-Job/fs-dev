import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupFixture, closeOwnedApp, createChat, createProject, selectPanel, stageAndLaunch, waitFor, withDb,
} from './electron-case-helpers.mjs';
import { buildF2Exchanges } from './fixture-workloads.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
if (!token || !evidenceRoot || !tempRoot) throw new Error('R9 scenario arguments are required');
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const projectPath = path.join(tempRoot, 'r9-project');
const resultPath = path.join(evidenceRoot, 'r9-lifecycle-result.json');
const prompt = 'R9 deterministic lifecycle probe';
const f2 = buildF2Exchanges();
let fixture = null;
let runtime = null;
let failure = null;
let result = null;
let lingering = [];

function bootstrap() {
  const state = window.__chatArchR9 = { received: [], transitions: [], cleanup: null };
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (['message:sent', 'turn_begin', 'thinking', 'tool_call', 'status_update', 'content', 'turn_end', 'chat-turn:saved'].includes(frame.type)) {
            state.received.push({ type: frame.type, at: performance.now(), turnIdPresent: typeof frame.turnId === 'string' });
          }
        } catch {}
      });
    }
  };
  state.start = () => {
    state.transitions = [];
    let previous = '';
    const sample = () => {
      const root = document.querySelector('.rv-panel.active');
      const textarea = root?.querySelector('textarea.rv-chat-input');
      const snapshot = {
        at: performance.now(),
        composerDisabled: textarea?.disabled ?? null,
        acceptanceWheel: root?.querySelectorAll('button[title="Connecting thread runtime"] .rv-send-warming-wheel').length ?? 0,
        finalizingWheel: root?.querySelectorAll('.rv-chat-completing-indicator').length ?? 0,
        stop: root?.querySelectorAll('button[title="Stop generating"]').length ?? 0,
        send: root?.querySelectorAll('button[title="Send message"]').length ?? 0,
        assistantActivity: root?.querySelectorAll('.rv-message-assistant').length ?? 0,
      };
      const signature = JSON.stringify(snapshot, (key, value) => key === 'at' ? undefined : value);
      if (signature !== previous) { previous = signature; state.transitions.push(snapshot); }
    };
    const observer = new MutationObserver(sample);
    observer.observe(document.querySelector('.rv-panel.active'), { subtree: true, childList: true, attributes: true, characterData: true });
    const interval = setInterval(sample, 10);
    sample();
    state.cleanup = () => { observer.disconnect(); clearInterval(interval); sample(); };
  };
}

function seedHistory(dbPath, threadId) {
  withDb(dbPath, {}, (db) => {
    const insert = db.prepare('INSERT INTO exchanges (thread_id,seq,ts,user_input,assistant,metadata) VALUES (?,?,?,?,?,?)');
    db.transaction(() => {
      for (const exchange of f2.exchanges) {
        insert.run(threadId, exchange.seq, 1_780_000_000_000 + exchange.seq,
          exchange.user, JSON.stringify(exchange.assistant), JSON.stringify(exchange.metadata));
      }
      db.prepare('UPDATE threads SET message_count = ?, updated_at = ? WHERE thread_id = ?')
        .run(f2.exchanges.length, 1_780_000_000_030, threadId);
    })();
  });
}

try {
  fixture = await stageAndLaunch({
    repoRoot, tempRoot, token, casePrefix: 'r9', evidenceRoot, initScript: bootstrap,
    faultSchedule: { 'before-ack': { action: 'delay', delayMs: 400, occurrence: 1 } },
    eventScript: { frameIntervalMs: 50, textFrames: 20, includeThinking: true, includeTool: true, includeUsage: true },
  });
  runtime = await fixture.launch();
  await createProject(runtime.app, runtime.page, projectPath, `R9 F2 F5 ${token.slice(-8)}`);
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  await createChat(runtime.page, fixture.dbPath);
  const identity = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => db.prepare(
    'SELECT current_primary_thread_id AS threadId, group_id AS threadGroupId FROM thread_groups ORDER BY rowid DESC LIMIT 1',
  ).get());
  lingering.push(...await closeOwnedApp(runtime));
  runtime = null;
  seedHistory(fixture.dbPath, identity.threadId);
  runtime = await fixture.launch();
  const panel = await selectPanel(runtime.page, 'capture-viewer', 'Captures');
  await panel.locator(`.rv-chat-item[data-thread-group-id="${identity.threadGroupId}"]`).click();
  await waitFor(runtime.page, () => panel.locator('.rv-message').count().then((count) => count === 60), 'R9 F2 history');
  const textarea = panel.locator('textarea.rv-chat-input');
  await waitFor(runtime.page, () => textarea.isEnabled(), 'R9 composer');
  await textarea.fill(prompt);
  await runtime.page.evaluate(() => window.__chatArchR9.start());
  const sendAt = await runtime.page.evaluate(() => performance.now());
  await panel.getByRole('button', { name: 'Send message' }).click();
  await runtime.page.waitForFunction(() => window.__chatArchR9.transitions.some((item) => item.acceptanceWheel === 1), null, { timeout: 5_000 });
  await runtime.page.waitForFunction(() => window.__chatArchR9.received.some((item) => item.type === 'turn_begin'), null, { timeout: 15_000 });
  await runtime.page.waitForFunction(() => window.__chatArchR9.transitions.some((item) => item.stop === 1 && item.assistantActivity > 0), null, { timeout: 15_000 });
  await runtime.page.waitForFunction(() => window.__chatArchR9.received.some((item) => item.type === 'turn_end'), null, { timeout: 30_000 });
  await runtime.page.waitForFunction(() => window.__chatArchR9.transitions.some((item) => item.finalizingWheel === 1), null, { timeout: 10_000 });
  await waitFor(runtime.page, async () => (await panel.getByRole('button', { name: 'Send message' }).count()) === 1
    && await textarea.isEnabled(), 'R9 idle recovery', 30_000);
  const blockedRenderer = await runtime.page.evaluate(() => {
    const composer = document.querySelector('.rv-panel.active textarea.rv-chat-input');
    const startedAt = performance.now();
    const disabledBefore = composer?.disabled ?? null;
    while (performance.now() - startedAt < 75) {}
    return { startedAt, endedAt: performance.now(), disabledBefore, disabledAfter: composer?.disabled ?? null };
  });
  const observed = await runtime.page.evaluate(() => {
    window.__chatArchR9.cleanup?.();
    return { transitions: window.__chatArchR9.transitions, received: window.__chatArchR9.received };
  });
  const first = (predicate) => observed.transitions.find(predicate);
  const acceptance = first((item) => item.acceptanceWheel === 1);
  const activity = first((item) => item.stop === 1 && item.assistantActivity > 0);
  const finalizing = first((item) => item.finalizingWheel === 1);
  const idle = [...observed.transitions].reverse().find((item) => item.send === 1 && item.composerDisabled === false);
  assert.ok(acceptance && activity && finalizing && idle);
  assert.ok(acceptance.at >= sendAt && activity.at >= acceptance.at && finalizing.at >= activity.at && idle.at >= finalizing.at);
  assert.ok(blockedRenderer.endedAt - blockedRenderer.startedAt >= 75);
  assert.equal(blockedRenderer.disabledBefore, false);
  assert.equal(blockedRenderer.disabledAfter, false);
  for (const type of ['message:sent', 'turn_begin', 'thinking', 'tool_call', 'status_update', 'content', 'turn_end']) {
    assert.ok(observed.received.some((item) => item.type === type), `R9 did not observe ${type}`);
  }
  result = {
    status: 'passed', caseId: 'R9-INDICATOR-DISTINCTION', authenticatedShell: true,
    fixtures: { f2: f2.manifest, f5: { frameIntervalMs: 50, textFrames: 20 } },
    identity, startupPanelReadiness: 'exact-rail-before-activation', promptSha256: crypto.createHash('sha256').update(prompt).digest('hex'), promptContentRecorded: false,
    sendAt, transitions: { acceptance, activity, finalizing, idle }, received: observed.received,
    blockedRenderer, requestIdentityAvailable: false,
    requestIdentityBoundary: 'current prompt/message frames have no requestId; SPEC-02/02A owns that future contract',
  };
} catch (error) {
  failure = error;
  if (runtime?.page) await runtime.page.screenshot({ path: path.join(evidenceRoot, 'r9-lifecycle-failure.png'), fullPage: true }).catch(() => {});
} finally {
  if (runtime) lingering.push(...await closeOwnedApp(runtime));
  const cleanup = fixture ? cleanupFixture(fixture, token) : null;
  fs.writeFileSync(resultPath, `${JSON.stringify({ ...result, cleanup: { lingering, ...cleanup },
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null }, null, 2)}\n`);
}

assert.deepEqual(lingering, []);
if (failure) throw failure;
process.stdout.write('CHAT_ARCH_R9_LIFECYCLE_OK\n');
