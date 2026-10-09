/** M1 real button → installed consumer → existing stores → connected rendered effects. */
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import path from 'node:path';
import { registerMaterialSourceCases } from './support/chat-material-source-cases';

let bundle: Promise<string>;
async function mount(page: Page) {
  bundle ??= build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    rollupOptions: { input: path.resolve('e2e/support/chat-material-fixture.tsx'), output: { format: 'iife' } } } })
    .then((result: any) => result.output.find((item: any) => item.type === 'chunk').code);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<html><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: await bundle });
  await expect(page.locator('#main textarea')).toHaveValue('MAIN DRAFT');
  await expect(page.locator('#side textarea')).toHaveValue('SIDE DRAFT');
  expect(errors).toEqual([]);
}
const call = (page: Page, name: string, arg?: any) => page.evaluate(({ name, arg }) => (window as any).__material[name](arg), { name, arg });
const snapshot = (page: Page) => call(page, 'snapshot');
const button = (page: Page) => page.locator('#resource > button[title="Send path to chat"]');
const editor = (page: Page, host: string) => page.locator(`#${host} textarea`);
const key = (thread: string) => JSON.stringify(['material-workspace', thread]);
async function noAutoSend(page: Page) {
  expect((await snapshot(page)).frames.filter((frame: any) => ['prompt', 'thread:open-assistant'].includes(frame.type))).toEqual([]);
}

test('A01/A02/A04 pointer Main and Side activity wins over persistent row/tab and source panel focus', async ({ page }) => {
  await mount(page);
  await editor(page, 'main').click();
  await call(page, 'placementSelect');
  await button(page).click();
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(1);
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(0);
  let state = await snapshot(page);
  expect(state.attachments[key('main-session')].attachments[0]).toMatchObject({ path: '/source-workspace/files/real-source.ts', panel: 'file-viewer' });
  expect(state.drafts[key('side-session')]).toBe('SIDE DRAFT');
  await editor(page, 'side').click();
  await call(page, 'selectMain');
  await page.locator('#resource button[title="Attach wiki"]').click();
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  state = await snapshot(page);
  expect(state.active).toBe('side-session');
  expect(state.attachments[key('side-session')].attachments[0].path).toBe('/source-workspace/wiki/Topic/PAGE.md');
  await noAutoSend(page);
});

test('A03 keyboard focus switches both directions; duplicate attachment is a truthful no-op', async ({ page }) => {
  await mount(page);
  await editor(page, 'side').focus();
  await page.keyboard.press('ArrowLeft');
  await button(page).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  await editor(page, 'main').focus(); await page.keyboard.press('ArrowRight');
  await button(page).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(1);
  const before = await snapshot(page);
  await button(page).click();
  const after = await snapshot(page);
  expect(after.generations).toEqual(before.generations);
  expect(after.attachments).toEqual(before.attachments);
  expect(after.notices.at(-1)).toBe('Link attached to chat');
  await noAutoSend(page);
});

test('A03 registration, rerender, StrictMode and late history cannot steal activation', async ({ page }) => {
  await mount(page);
  expect((await snapshot(page)).active).toBeNull();
  await editor(page, 'side').click();
  await call(page, 'render', { extra: true });
  await expect(page.locator('#extra textarea')).toHaveCount(1);
  await call(page, 'frame', { type: 'thread:opened', historyOnly: true, workspaceId: 'material-workspace', viewId: 'wiki-viewer',
    threadGroupId: 'material-group', threadId: 'main-session', thread: { name: 'Late', status: 'active' }, exchanges: [] });
  await button(page).click();
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  expect((await snapshot(page)).active).toBe('side-session');
  await call(page, 'render', { extra: false });
  await noAutoSend(page);
});

test('A03 real rail selection explicitly activates its exact mounted Main', async ({ page }) => {
  await mount(page);
  await editor(page, 'side').click();
  await page.locator('#main .rv-chat-item-text[title="Main material"]').first().click();
  await expect.poll(async () => (await snapshot(page)).active).toBe('main-session');
  await button(page).click();
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(1);
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(0);
});

test('A03 delayed Main population and automatic MRU open cannot steal retained foreground Side', async ({ page }) => {
  await mount(page); await editor(page, 'side').click();
  await call(page, 'adapterless');
  await expect(editor(page, 'main')).toHaveValue('');
  await call(page, 'restoreMain');
  await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
  expect((await snapshot(page)).active).toBe('side-session');
  await button(page).click();
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(0);
  await noAutoSend(page);
});

test('A05 unhydrated Main population denies the former active owner before source work', async ({ page }) => {
  await mount(page); await editor(page, 'main').click();
  await call(page, 'adapterless');
  await button(page).click();
  const state = await snapshot(page);
  expect(state.sourceReads).toBe(0); expect(state.attachments).toEqual({});
  await noAutoSend(page);
});

test('A05 no activation rejects before reading a source root despite stale global thread', async ({ page }) => {
  await mount(page);
  await button(page).click();
  const state = await snapshot(page);
  expect(state.sourceReads).toBe(0); expect(state.attachments).toEqual({});
  expect(state.notices.at(-1)).toBe('Chat target unavailable');
  await noAutoSend(page);
});

for (const loss of ['collapsed', 'closed', 'foreground', 'foreign', 'unhydrated'] as const) {
  test(`A05/A13 ${loss} active owner gives no target or source preparation`, async ({ page }) => {
    await mount(page); await editor(page, 'side').click();
    if (loss === 'collapsed') {
      await editor(page, 'main').click(); await call(page, 'render', { collapsed: true });
      await expect(editor(page, 'main')).toHaveCount(0);
    }
    if (loss === 'closed') { await call(page, 'render', { side: false }); await expect(editor(page, 'side')).toHaveCount(0); }
    if (loss === 'foreground') await call(page, 'foreignView', true);
    if (loss === 'foreign') { await call(page, 'render', { foreign: true }); await expect(editor(page, 'side')).toHaveCount(0); }
    if (loss === 'unhydrated') await call(page, 'lose', 'group');
    await button(page).click();
    const state = await snapshot(page);
    // Side placements remain independently authoritative when only Main rows disappear.
    if (loss === 'unhydrated') {
      await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
    } else {
      expect(state.sourceReads).toBe(0); expect(state.attachments).toEqual({});
      expect(state.notices.at(-1)).toBe('Chat target unavailable');
    }
    await noAutoSend(page);
  });
}

test('A02 adapterless Side requires its exact service placement, no Main population', async ({ page }) => {
  await mount(page); await call(page, 'adapterless'); await editor(page, 'side').focus();
  await button(page).click();
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  expect((await snapshot(page)).attachments[key('main-session')]).toBeUndefined();
  await noAutoSend(page);
});

test('A07 shared commit retains exact owner through unrelated focus/view and preserves latest typed draft', async ({ page }) => {
  await mount(page); await editor(page, 'main').click();
  expect(await call(page, 'begin')).toBe('ready');
  await editor(page, 'main').fill('NEW TYPING');
  await editor(page, 'side').focus(); await call(page, 'foreignView', true);
  expect(await call(page, 'complete')).toBe('applied');
  await expect(editor(page, 'main')).toHaveValue('NEW TYPING\n\nPREPARED');
  await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
  expect(await editor(page, 'side').evaluate(el => el === document.activeElement)).toBe(true);
  expect(await call(page, 'complete')).toBe('noop');
  await noAutoSend(page);
});

for (const loss of ['workspace', 'hydration', 'placement', 'socket', 'binding']) {
  test(`A09/A13 ${loss} loss and return permanently cancels captured operation`, async ({ page }) => {
    await mount(page); await editor(page, 'side').click();
    expect(await call(page, 'begin')).toBe('ready');
    await call(page, 'lose', loss);
    expect(await call(page, 'complete')).toBe('cancelled');
    await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
    expect((await snapshot(page)).attachments).toEqual({}); await noAutoSend(page);
  });
}

test('A09 actual unmount/remount with equal tuple cannot revive a captured lease', async ({ page }) => {
  await mount(page); await editor(page, 'side').click(); await call(page, 'begin');
  await call(page, 'render', { side: false }); await expect(editor(page, 'side')).toHaveCount(0);
  await call(page, 'render', { side: true }); await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
  expect(await call(page, 'complete')).toBe('cancelled');
});

test('A13 invalid material changes no store; A16 exact selection uses latest matching revision', async ({ page }) => {
  await mount(page); await editor(page, 'main').click(); await call(page, 'begin');
  const before = await snapshot(page);
  expect(await call(page, 'complete', { attachment: { kind: 'bad', id: 'bad' } })).toBe('invalid');
  expect((await snapshot(page)).attachments).toEqual(before.attachments);
  const owner = before.mounts.find((item: any) => item.threadId === 'main-session');
  expect(await call(page, 'complete', { text: 'INSERT', selection: { ...owner, value: 'MAIN DRAFT',
    revision: before.revisions[key('main-session')], start: 0, end: 4 } })).toBe('applied');
  await expect(editor(page, 'main')).toHaveValue('INSERT DRAFT');
  await noAutoSend(page);
});

for (const phase of ['pending', 'unknown'] as const) {
  test(`A15 ${phase} acceptance preserves existing composer admission`, async ({ page }) => {
    await mount(page); await editor(page, 'main').click(); await call(page, 'pending', phase);
    await button(page).click();
    const state = await snapshot(page);
    if (phase === 'pending') { expect(state.attachments).toEqual({}); expect(state.sourceReads).toBe(0); }
    else await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(1);
    await noAutoSend(page);
  });
}


test('A03 Side tab selection through the real connected bridge publishes exact placement activation', async ({ page }) => {
  await mount(page); await editor(page, 'main').click();
  await page.locator('#side').getByRole('tab', { name: 'Side Chat' }).click();
  await button(page).click();
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(0);
  await noAutoSend(page);
});

test('A05 duplicate view bindings cannot win a pending activation by registration order', async ({ page }) => {
  await mount(page);
  await call(page, 'render', { main: false }); await expect(editor(page, 'main')).toHaveCount(0);
  await call(page, 'requestMain');
  await call(page, 'render', { main: true, extra: true });
  await expect(page.locator('#extra textarea')).toHaveCount(1);
  await button(page).click();
  const state = await snapshot(page);
  expect(state.active).toBeNull(); expect(state.attachments).toEqual({}); expect(state.sourceReads).toBe(0);
});

test('A09 view-bound Main rebind and return invalidates old operation', async ({ page }) => {
  await mount(page); await editor(page, 'main').click(); await call(page, 'begin');
  await page.locator('#main .rv-chat-item-text[title="Other material"]').first().click();
  await expect(editor(page, 'main')).toHaveValue('');
  await page.locator('#main .rv-chat-item-text[title="Main material"]').first().click();
  await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
  expect(await call(page, 'complete')).toBe('cancelled');
});

test('A03/A08 duplicate explicit Main keeps its independent lifetime; rail activation identifies view Main', async ({ page }) => {
  await mount(page); await call(page, 'render', { explicit: true });
  await expect(editor(page, 'explicit')).toHaveValue('MAIN DRAFT');
  await editor(page, 'explicit').click();
  let state = await snapshot(page);
  const explicit = state.mounts.find((item: any) => item.componentInstanceId === 'material-main-component');
  expect(state.activeSurface).toBe(explicit.surfaceId);
  await page.locator('#main .rv-chat-item-text[title="Main material"]').first().click();
  state = await snapshot(page);
  expect(state.activeSurface).toBe(state.mounts.find((item: any) => item.threadId === 'main-session' && item.binding === 'view').surfaceId);
  await editor(page, 'explicit').click(); expect(await call(page, 'begin')).toBe('ready');
  await page.locator('#main .rv-chat-item-text[title="Other material"]').first().click();
  await expect(editor(page, 'main')).toHaveValue('');
  await call(page, 'render', { main: false }); await expect(editor(page, 'main')).toHaveCount(0);
  expect(await call(page, 'complete')).toBe('applied');
  await expect(editor(page, 'explicit')).toHaveValue('MAIN DRAFT\n\nPREPARED');
  await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
  await noAutoSend(page);
});

test('A17 resource wrapper keeps source and attachment order; independent Send waits for exact ACK', async ({ page }) => {
  await mount(page); await editor(page, 'main').click();
  await button(page).click();
  await page.locator('#resource [role="group"] button[title="Send path to chat"]').click();
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(2);
  await noAutoSend(page);
  await page.locator('#main').getByRole('button', { name: 'Send message', exact: true }).click();
  let state = await snapshot(page);
  const prompt = state.frames.find((frame: any) => frame.type === 'prompt');
  expect(prompt.threadId).toBe('main-session');
  await expect(page.locator('#main .rv-message-user-content')).toHaveCount(0);
  await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(2);
  await call(page, 'frame', { type: 'message:sent', workspaceId: 'material-workspace', threadId: 'main-session',
    requestId: prompt.requestId, turnId: 'accepted-material-turn', content: prompt.user_input });
  await expect(page.locator('#main .rv-message-user-content')).toHaveText('MAIN DRAFT');
  await expect(editor(page, 'main')).toHaveValue('');
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(0);
  await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
});

test('A17 ordinary New Chat activates the acknowledged new Main without material send/create modes', async ({ page }) => {
  await mount(page); await editor(page, 'side').click();
  await page.locator('#main .rv-new-chat-btn').click();
  await expect.poll(async () => (await snapshot(page)).active).toBe('created-main');
  await button(page).click();
  await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(1);
  const state = await snapshot(page);
  expect(state.attachments[key('created-main')].attachments).toHaveLength(1);
  expect(state.frames.filter((frame: any) => frame.type === 'thread:open-assistant')).toHaveLength(1);
  expect(state.frames.filter((frame: any) => frame.type === 'prompt')).toEqual([]);
});

test('A13 source failure are distinct terminal results with no mutation', async ({ page }) => {
  await mount(page); await editor(page, 'main').click(); await call(page, 'begin');
  expect(await call(page, 'complete', { sourceFailure: true })).toBe('source_failed');
  expect(await call(page, 'complete', { sourceFailure: true })).toBe('source_failed');
  expect((await snapshot(page)).attachments).toEqual({});
  await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
});


test('A13 source abort cancels before shared commit', async ({ page }) => {
  await mount(page); await editor(page, 'main').click();
  expect(await call(page, 'beginAbort')).toBe('ready');
  await call(page, 'abort');
  expect(await call(page, 'complete')).toBe('cancelled');
  await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
  expect((await snapshot(page)).attachments).toEqual({});
});

registerMaterialSourceCases({ mount, call, snapshot, editor, key, noAutoSend });
