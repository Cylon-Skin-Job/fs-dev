import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupFixture, closeOwnedApp, createChat, createProject, stageAndLaunch, waitFor,
} from './electron-case-helpers.mjs';

const [token, evidenceRoot, tempRoot] = process.argv.slice(2);
if (!token || !evidenceRoot || !tempRoot) throw new Error('R2 scenario arguments are required');
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const projectPath = path.join(tempRoot, 'r2-project');
const resultPath = path.join(evidenceRoot, 'r2-result.json');
let fixture = null;
let runtime = null;
let failure = null;
let result = null;
let lingering = [];

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function socketBootstrap() {
  window.__chatArchTransport = { sockets: [], sentTypes: {}, forwardedTypes: {}, receivedTypes: {}, sendThrows: 0 };
  const state = window.__chatArchTransport;
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      state.sockets.push(this);
      this.addEventListener('message', (event) => {
        try { const type = JSON.parse(event.data).type || 'unknown'; state.receivedTypes[type] = (state.receivedTypes[type] || 0) + 1; } catch {}
      });
      const nativeSend = this.send.bind(this);
      this.send = (payload) => {
        let type = 'unparsed';
        try { type = JSON.parse(String(payload)).type || 'unknown'; } catch {}
        state.sentTypes[type] = (state.sentTypes[type] || 0) + 1;
        if (state.throwPrompt && type === 'prompt') { state.sendThrows += 1; throw new Error('R2 deterministic enqueue throw'); }
        const result = nativeSend(payload);
        state.forwardedTypes[type] = (state.forwardedTypes[type] || 0) + 1;
        return result;
      };
    }
  };
}

async function snapshot(page, panel, expected, id) {
  const textarea = panel.locator('textarea.rv-chat-input');
  const bodyText = await page.locator('body').innerText();
  const textareaPresent = await textarea.count() > 0;
  const send = panel.getByRole('button', { name: 'Send message' });
  const sendPresent = await send.count() > 0;
  const draft = textareaPresent ? await textarea.inputValue() : '';
  return {
    id, draftRetained: draft === expected, draftLength: draft.length, draftSha256: hash(draft), promptContentRecorded: false,
    composerPresent: textareaPresent, composerEnabled: textareaPresent ? await textarea.isEnabled() : false,
    sendPresent, sendDisabled: sendPresent ? await send.isDisabled() : null,
    userBubbleCount: await panel.locator('.rv-message-user').count(),
    acceptanceSpinnerCount: await panel.locator(
      '.rv-send-button-group .rv-send-warming-wheel, .rv-chat-sending, .rv-message-pending, [aria-label*="pending" i]',
    ).count(),
    visibleNotSent: /not sent|could not be sent|disconnected|connection.*lost|failed to send/i.test(bodyText),
    transport: await page.evaluate(() => ({ ...window.__chatArchTransport,
      sockets: window.__chatArchTransport.sockets.map((socket) => ({ readyState: socket.readyState })) })),
  };
}

try {
  fixture = await stageAndLaunch({ repoRoot, tempRoot, token, casePrefix: 'r2', evidenceRoot, initScript: socketBootstrap });
  runtime = await fixture.launch();
  await createProject(runtime.app, runtime.page, projectPath, `R2 ${token.slice(-8)}`);
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  let panel = await createChat(runtime.page, fixture.dbPath);
  let textarea = panel.locator('textarea.rv-chat-input');
  await waitFor(runtime.page, () => textarea.isEnabled(), 'composer activation');
  const disconnectText = 'R2 disconnect retention probe';
  await textarea.fill(disconnectText);
  const acceptedBeforeDisconnect = await runtime.page.evaluate(() => window.__chatArchTransport.receivedTypes['message:sent'] || 0);
  const forwardedBeforeDisconnect = await runtime.page.evaluate(() => window.__chatArchTransport.forwardedTypes.prompt || 0);
  await runtime.page.evaluate(() => window.__chatArchTransport.sockets.forEach((socket) => socket.close(4777, 'r2-test-disconnect')));
  await runtime.page.waitForTimeout(50);
  let send = panel.getByRole('button', { name: 'Send message' });
  if (!(await send.isDisabled())) await send.click();
  await runtime.page.waitForTimeout(250);
  const disconnected = await snapshot(runtime.page, panel, disconnectText, 'R2-DISCONNECT-BEFORE-CLICK');
  assert.equal(disconnected.transport.receivedTypes['message:sent'] || 0, acceptedBeforeDisconnect);

  lingering.push(...await closeOwnedApp(runtime));
  runtime = await fixture.launch();
  await runtime.page.reload();
  await runtime.page.waitForFunction(() => document.body?.innerText.includes('Connected'), null, { timeout: 30_000 });
  panel = runtime.page.locator('.rv-panel[data-panel="capture-viewer"].active');
  if (await panel.count() === 0) await runtime.page.locator('.rv-tool-btn[title="Captures"]').click();
  await panel.waitFor({ timeout: 15_000 });
  await panel.locator('.rv-chat-item[data-thread-group-id]').first().click();
  textarea = panel.locator('textarea.rv-chat-input');
  send = panel.getByRole('button', { name: 'Send message' });
  await waitFor(runtime.page, () => textarea.isEnabled(), 'composer re-enable after reconnect');
  const throwText = 'R2 enqueue exception race probe';
  await textarea.fill(throwText);
  await runtime.page.evaluate(() => { window.__chatArchTransport.throwPrompt = true; });
  await send.click();
  await runtime.page.waitForTimeout(300);
  const enqueueThrow = await snapshot(runtime.page, panel, throwText, 'R2-ENQUEUE-THROW-RACE');
  assert.equal(enqueueThrow.transport.sendThrows, 1, 'the production prompt send did not reach the injected enqueue throw');
  assert.equal(enqueueThrow.transport.receivedTypes['message:sent'] || 0, acceptedBeforeDisconnect);
  const violations = [];
  if (!disconnected.visibleNotSent) violations.push('disconnect_has_no_visible_not_sent_result');
  if (!disconnected.draftRetained) violations.push('disconnect_did_not_retain_draft');
  if (!disconnected.composerEnabled) violations.push('disconnect_retained_draft_not_editable');
  if ((disconnected.transport.forwardedTypes.prompt || 0) !== forwardedBeforeDisconnect) violations.push('disconnect_transmitted_prompt');
  if (disconnected.acceptanceSpinnerCount > 0) violations.push('disconnect_left_acceptance_spinner');
  if (disconnected.userBubbleCount > 0) violations.push('disconnect_committed_user_bubble_without_acceptance');
  if (!enqueueThrow.visibleNotSent) violations.push('enqueue_throw_has_no_visible_not_sent_result');
  if (!enqueueThrow.draftRetained) violations.push('enqueue_throw_did_not_retain_draft');
  if (!enqueueThrow.composerEnabled) violations.push('enqueue_throw_retained_draft_not_editable');
  if ((enqueueThrow.transport.forwardedTypes.prompt || 0) > 0) violations.push('enqueue_throw_transmitted_prompt');
  if (enqueueThrow.acceptanceSpinnerCount > 0) violations.push('enqueue_throw_left_acceptance_spinner');
  if (enqueueThrow.userBubbleCount > 0) violations.push('enqueue_throw_committed_user_bubble_without_acceptance');
  result = {
    status: 'passed', characterization: true, authenticatedShell: (enqueueThrow.transport.receivedTypes['shell-auth:authenticated'] || 0) >= 1,
    publicRouteResults: [disconnected, enqueueThrow], reproducedDefects: violations,
    hypothesis: violations.length ? 'confirmed-current-product-violation' : 'disproved-source-hypothesis',
    laterEnforceOwner: 'SPEC-02/02A',
  };
  assert.equal(result.authenticatedShell, true);
  if (process.env.FUSION_CHAT_ARCH_MODE === 'enforce') assert.deepEqual(violations, []);
} catch (error) {
  failure = error;
  if (runtime?.page) await runtime.page.screenshot({ path: path.join(evidenceRoot, 'r2-failure.png'), fullPage: true }).catch(() => {});
} finally {
  if (runtime) lingering.push(...await closeOwnedApp(runtime));
  const cleanup = fixture ? cleanupFixture(fixture, token) : null;
  fs.writeFileSync(resultPath, `${JSON.stringify({ ...result, cleanup: { lingering, ...cleanup },
    failure: failure ? { name: failure.name, message: failure.message, stack: failure.stack } : null }, null, 2)}\n`);
}

assert.deepEqual(lingering, []);
if (failure) throw failure;
process.stdout.write('CHAT_ARCH_R2_OK\n');
