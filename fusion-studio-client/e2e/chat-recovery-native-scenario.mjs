/** Disposable Electron/SQLite receipt recovery through the authenticated public route. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupFixture, closeOwnedApp, createChat, createProject, stageAndLaunch,
  waitFor, withDb } from './chat-architecture/electron-case-helpers.mjs';

function instrumentReceiptTransport() {
  const Native = window.WebSocket;
  const state = { sent: [], received: [], refuseStatus: false, uncertainStatus: false, uncertainThrows: 0 };
  window.__nativeReceipt = state;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === 'message:sent' || frame.action === 'prompt_receipt_status') state.received.push(frame);
        } catch {}
      });
    }
    get readyState() { return state.refuseStatus ? Native.CLOSED : super.readyState; }
    send(payload) {
      let status = false;
      try {
        const frame = JSON.parse(String(payload));
        status = frame.action === 'prompt_receipt_status';
        if (frame.type === 'prompt' || frame.action === 'prompt_receipt_status') state.sent.push(frame);
      } catch {}
      const sent = super.send(payload);
      if (status && state.uncertainStatus) {
        state.uncertainStatus = false;
        state.uncertainThrows += 1;
        throw new Error('fixture send outcome unknown after native enqueue');
      }
      return sent;
    }
  };
}

export async function runChatRecoveryNativeScenario() {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-c3-native-'));
  const token = `chat-architecture-owner-chat-arch-c3-${process.pid}`;
  let fixture;
  let runtime;
  try {
    fixture = await stageAndLaunch({ repoRoot, tempRoot, evidenceRoot: tempRoot, token,
      casePrefix: 'c3-native', faultSchedule: { 'before-ack': { action: 'drop' } },
      eventScript: { frameIntervalMs: 30, textFrames: 3 }, initScript: instrumentReceiptTransport });
    runtime = await fixture.launch();
    const { app, page } = runtime;
    page.setDefaultTimeout(30_000);
    const projectPath = path.join(fixture.workspaceRoot, 'c3-project');
    await createProject(app, page, projectPath, 'C3 Native Fixture');
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.includes('Connected'));
    const panel = await createChat(page, fixture.dbPath);
    const threadId = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) =>
      db.prepare('SELECT current_primary_thread_id id FROM thread_groups ORDER BY rowid DESC LIMIT 1').get().id);
    await page.clock.install();
    const composer = panel.locator('textarea.rv-chat-input').first();
    await waitFor(page, () => composer.isEnabled(), 'C3 native exact composer');
    await composer.fill('C3 lost acknowledgement');
    await panel.getByRole('button', { name: 'Send message', exact: true }).click();
    await waitFor(page, () => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) =>
      db.prepare('SELECT COUNT(*) n FROM prompt_submission_receipts WHERE thread_id = ?').get(threadId).n === 1),
    'durable accepted receipt');
    const sent = () => page.evaluate(() => window.__nativeReceipt.sent);
    const prompt = (await sent()).find((frame) => frame.type === 'prompt' && frame.threadId === threadId);
    assert.ok(prompt?.requestId);
    // The first status inquiry is definitely refused by the real C2 product
    // boundary because this test-owned socket reports CLOSED for one clock tick.
    await page.evaluate(() => { window.__nativeReceipt.refuseStatus = true; });
    await page.clock.runFor(15_000);
    assert.equal((await sent()).filter((frame) => frame.action === 'prompt_receipt_status').length, 0);
    await panel.getByRole('button', { name: 'Check status' }).first().waitFor();
    await page.evaluate(() => { window.__nativeReceipt.refuseStatus = false; });
    await panel.getByRole('button', { name: 'Check status' }).first().click();
    await waitFor(page, async () => (await sent()).filter((frame) => frame.action === 'prompt_receipt_status'
      && frame.requestId === prompt.requestId).length === 1, 'one manual status inquiry');
    await waitFor(page, () => panel.locator('.rv-message-user-content', { hasText: 'C3 lost acknowledgement' }).count()
      .then((count) => count === 1), 'recovered server-owned user bubble');
    const facts = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => ({
      receipts: db.prepare('SELECT COUNT(*) n FROM prompt_submission_receipts WHERE thread_id = ? AND request_id = ?')
        .get(threadId, prompt.requestId).n,
      exchanges: db.prepare('SELECT COUNT(*) n FROM exchanges WHERE thread_id = ?').get(threadId).n,
    }));
    assert.deepEqual(facts, { receipts: 1, exchanges: 1 });
    const snapshot = await page.evaluate(() => window.__nativeReceipt);
    assert.equal(snapshot.sent.filter((frame) => frame.type === 'prompt' && frame.requestId === prompt.requestId).length, 1);
    assert.equal(snapshot.sent.filter((frame) => frame.action === 'prompt_receipt_status').length, 1);
    assert.equal(snapshot.received.filter((frame) => frame.type === 'message:sent').length, 0);
    assert.equal(snapshot.received.filter((frame) => frame.action === 'prompt_receipt_status'
      && frame.requestId === prompt.requestId).length, 1);
    await page.clock.resume();
    // A second lost ACK uses the actual native send before a fixture throw.
    // The resulting uncertainty must not release the original attempt or
    // replay its prompt; authenticated reconnect can query that one receipt.
    await waitFor(page, () => composer.isEnabled(), 'second C3 native composer');
    await composer.fill('C3 uncertain inquiry');
    await panel.getByRole('button', { name: 'Send message', exact: true }).click();
    await waitFor(page, () => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) =>
      db.prepare('SELECT COUNT(*) n FROM prompt_submission_receipts WHERE thread_id = ?').get(threadId).n === 2),
    'second durable accepted receipt');
    const second = (await sent()).filter((frame) => frame.type === 'prompt' && frame.threadId === threadId).at(-1);
    assert.ok(second?.requestId && second.requestId !== prompt.requestId);
    await page.evaluate(() => { window.__nativeReceipt.uncertainStatus = true; });
    await waitFor(page, () => panel.getByRole('button', { name: 'Check status' }).first().isVisible(),
      'uncertain status remains visible after socket retirement');
    const final = await page.evaluate(() => window.__nativeReceipt);
    const secondQueries = final.sent.filter((frame) => frame.action === 'prompt_receipt_status'
      && frame.requestId === second.requestId).length;
    assert.equal(final.uncertainThrows, 1);
    assert.equal(final.sent.filter((frame) => frame.type === 'prompt' && frame.requestId === second.requestId).length, 1);
    assert.equal(secondQueries, 1, 'one possible status inquiry before socket retirement');
    const finalFacts = withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, (db) => ({
      receipts: db.prepare('SELECT COUNT(*) n FROM prompt_submission_receipts WHERE thread_id = ?').get(threadId).n,
      exchanges: db.prepare('SELECT COUNT(*) n FROM exchanges WHERE thread_id = ?').get(threadId).n,
    }));
    assert.deepEqual(finalFacts, { receipts: 2, exchanges: 2 });
    return { prompts: 2, receipts: 2, exchanges: 2, statusQueries: 1 + secondQueries,
      definiteRefusals: 1, uncertainThrows: 1 };
  } finally {
    if (runtime) {
      const lingering = await closeOwnedApp(runtime);
      assert.deepEqual(lingering, [], 'isolated C3 native process survived cleanup');
    }
    if (fixture) cleanupFixture(fixture, token);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
