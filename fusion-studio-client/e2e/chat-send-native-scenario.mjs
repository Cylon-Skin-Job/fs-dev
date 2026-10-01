/** Isolated real Electron/public-route C2 scenario, composed into the auth smoke. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupFixture, closeOwnedApp, createChat, createProject, stageAndLaunch,
  waitFor, withDb } from './chat-architecture/electron-case-helpers.mjs';

export async function runChatSendNativeScenario() {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-c2-native-'));
  const token = `chat-architecture-owner-chat-arch-c2-${process.pid}`;
  let fixture;
  let runtime;
  try {
    fixture = await stageAndLaunch({ repoRoot, tempRoot, evidenceRoot: tempRoot, token,
      casePrefix: 'c2-native', eventScript: { frameIntervalMs: 30, textFrames: 3 } });
    runtime = await fixture.launch();
    const { app, page } = runtime;
    page.setDefaultTimeout(30_000);
    const sent = [];
    const received = [];
    page.on('websocket', (socket) => {
      socket.on('framesent', ({ payload }) => {
        try { const frame = JSON.parse(String(payload)); if (frame.type === 'prompt') sent.push(frame); } catch {}
      });
      socket.on('framereceived', ({ payload }) => {
        try { const frame = JSON.parse(String(payload)); if (frame.type === 'message:sent') received.push(frame); } catch {}
      });
    });
    const projectPath = path.join(fixture.workspaceRoot, 'c2-project');
    await createProject(app, page, projectPath, 'C2 Native Fixture');
    await page.reload();
    await page.waitForFunction(() => document.body.innerText.includes('Connected'));
    const panel = await createChat(page, fixture.dbPath);
    const read = (fn) => withDb(fixture.dbPath, { readonly: true, fileMustExist: true }, fn);
    const group = read((db) => db.prepare('SELECT group_id, current_primary_thread_id FROM thread_groups ORDER BY rowid DESC LIMIT 1').get());
    assert.ok(group?.group_id && group.current_primary_thread_id);
    const sideThreadId = group.current_primary_thread_id;
    // The public action is the durable setup and readback assertion.
    await panel.locator('.rv-chat-header-btn[aria-label="More options"]').first().click();
    await page.getByRole('menu', { name: 'Chat options' }).getByRole('menuitem', { name: 'Move Chat to Side Chat' }).click();
    await waitFor(page, () => read((db) => db.prepare('SELECT COUNT(*) n FROM thread_group_members WHERE group_id = ?')
      .get(group.group_id).n === 2), 'durable Move action');
    const mainThreadId = read((db) => db.prepare('SELECT current_primary_thread_id id FROM thread_groups WHERE group_id = ?')
      .get(group.group_id).id);
    assert.notEqual(mainThreadId, sideThreadId);
    const sideTab = page.locator('.rv-view-tab-list [role="tab"]', { hasText: 'Side Chat' });
    await sideTab.waitFor(); await sideTab.click();
    const side = panel.locator(`.rv-chat-area[data-chat-thread-id="${sideThreadId}"]`);
    const main = panel.locator(`.rv-chat-area[data-chat-thread-id="${mainThreadId}"]`);
    async function send(surface, threadId, text) {
      await surface.waitFor();
      const composer = surface.locator('textarea.rv-chat-input');
      await waitFor(page, () => composer.isEnabled(), 'exact native composer');
      assert.equal(await surface.locator('.rv-message-user-content', { hasText: text }).count(), 0);
      await composer.fill(text);
      await surface.getByRole('button', { name: 'Send message' }).click();
      await waitFor(page, () => received.some((frame) => frame.threadId === threadId
        && frame.content === text), 'server-owned message:sent ACK');
      await surface.locator('.rv-message-user-content', { hasText: text }).waitFor();
      await surface.locator('.rv-message-assistant', { hasText: 'Deterministic fixture reply' }).waitFor();
      await waitFor(page, () => read((db) => db.prepare('SELECT COUNT(*) n FROM exchanges WHERE thread_id = ? AND user_input = ?')
        .get(threadId, text).n === 1), 'durable exact-thread exchange');
      assert.equal(sent.filter((frame) => frame.threadId === threadId && frame.user_input === text).length, 1);
      assert.equal(received.filter((frame) => frame.threadId === threadId && frame.content === text).length, 1);
    }
    await send(side, sideThreadId, 'C2 exact Side prompt');
    await send(main, mainThreadId, 'C2 exact Main prompt');
    assert.equal(read((db) => db.prepare('SELECT COUNT(*) n FROM thread_group_members WHERE group_id = ?')
      .get(group.group_id).n), 2);
    assert.equal(read((db) => db.prepare('SELECT COUNT(*) n FROM exchanges WHERE thread_id IN (?, ?)')
      .get(sideThreadId, mainThreadId).n), 2);
    return { prompts: sent.length, acknowledgements: received.length, exchanges: 2, movedMembers: 2 };
  } finally {
    if (runtime) {
      const lingering = await closeOwnedApp(runtime);
      assert.deepEqual(lingering, [], 'isolated native process survived cleanup');
    }
    if (fixture) cleanupFixture(fixture, token);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
