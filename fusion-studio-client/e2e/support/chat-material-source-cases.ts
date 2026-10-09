/** Source-focused cases registered in the cumulative material suite. */
import { expect, test, type Page } from '@playwright/test';
interface Context {
  mount: (page: Page) => Promise<void>;
  call: (page: Page, name: string, arg?: any) => Promise<any>;
  snapshot: (page: Page) => Promise<any>;
  editor: (page: Page, host: string) => ReturnType<Page['locator']>;
  key: (thread: string) => string;
  noAutoSend: (page: Page) => Promise<void>;
}
export function registerMaterialSourceCases({ mount, call, snapshot, editor, key, noAutoSend }: Context) {

const addMenu = async (page: Page, host: string) => page.locator(`#${host}`).getByRole('button', { name: 'Add', exact: true }).click();
const sourceAction = async (page: Page, host: string, kind: string, row = 1) => {
  await addMenu(page, host);
  const scope = page.locator(`#${host}`);
  if (kind === 'clipboard-top') await scope.getByRole('menuitem', { name: 'Insert top clipboard item' }).click();
  if (kind === 'recent-top') await scope.getByRole('menuitem', { name: 'Insert most recently edited file' }).click();
  if (kind === 'clipboard-row') {
    await scope.getByRole('menuitem', { name: 'Browse clipboard history' }).click();
    await page.locator('.rv-hover-icon-modal-row').filter({ hasText: `Clipboard row ${row}` }).click();
  }
  if (kind === 'recent-row') {
    await scope.getByRole('menuitem', { name: 'Browse recent edits' }).click();
    await page.locator('.rv-hover-icon-modal-row').filter({ hasText: 'recent.ts' }).click();
  }
  if (kind === 'gallery') {
    await scope.getByRole('menuitem', { name: 'Browse screenshots' }).click();
    await page.locator('.rv-hover-icon-modal-row').filter({ hasText: 'gallery' }).click();
  }
};
for (const host of ['main', 'side']) for (const kind of ['clipboard-top', 'clipboard-row', 'recent-top', 'recent-row', 'gallery']) {
  test(`A06 ${host} ${kind} begins at actual action and uses its own composer`, async ({ page }) => {
    await mount(page);
    await editor(page, host).evaluate(el => (el as HTMLTextAreaElement).setSelectionRange(0, 4));
    await editor(page, host === 'main' ? 'side' : 'main').focus();
    await sourceAction(page, host, kind);
    const content = kind.startsWith('clipboard') ? 'CLIPBOARD 1' : '/source/recent.ts';
    if (kind === 'gallery') {
      await expect(page.locator(`#${host} .rv-chat-attachment-pill`)).toHaveCount(1);
      expect((await snapshot(page)).attachments[key(host === 'main' ? 'main-session' : 'side-session')].attachments[0].path).toBe('/source/Data/Screenshots/gallery.png');
    } else await expect(editor(page, host)).toHaveValue(`${content} DRAFT`);
    await expect(editor(page, host === 'main' ? 'side' : 'main')).toHaveValue(host === 'main' ? 'SIDE DRAFT' : 'MAIN DRAFT');
    await noAutoSend(page);
  });
}
for (const kind of ['clipboard-top', 'recent-top']) {
  test(`A07/A16 deferred ${kind} keeps retained owner and fresh selection after typing/focus`, async ({ page }) => {
    await mount(page); await call(page, 'holdSource', kind === 'clipboard-top' ? 'clipboard-list' : 'recent');
    await sourceAction(page, 'main', kind);
    await editor(page, 'main').fill('INTERVENING TYPING');
    await editor(page, 'main').evaluate(el => (el as HTMLTextAreaElement).setSelectionRange(0, 0));
    await editor(page, 'side').focus(); await call(page, 'foreignView', true);
    await call(page, 'releaseSource', kind === 'clipboard-top' ? 'clipboard-list' : 'recent');
    await expect(editor(page, 'main')).toHaveValue(`${kind === 'clipboard-top' ? 'CLIPBOARD 1' : '/source/recent.ts'}INTERVENING TYPING`);
    await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
    expect(await editor(page, 'side').evaluate(el => el === document.activeElement)).toBe(true);
    await noAutoSend(page);
  });
}
test('A16 stale editor value safely paragraph-appends to latest owner draft', async ({ page }) => {
  await mount(page); await call(page, 'holdSource', 'clipboard-use-1');
  await sourceAction(page, 'main', 'clipboard-top');
  await editor(page, 'main').fill('LATEST OWNER');
  await editor(page, 'main').evaluate(el => { (el as HTMLTextAreaElement).value = 'STALE DOM'; (el as HTMLTextAreaElement).setSelectionRange(0, 5); });
  await call(page, 'releaseSource', 'clipboard-use-1');
  await expect(editor(page, 'main')).toHaveValue('LATEST OWNER\n\nCLIPBOARD 1');
});
for (const host of ['side', 'explicit']) {
  test(`A08 deferred ${host} source survives unrelated Main selection`, async ({ page }) => {
    await mount(page); if (host === 'explicit') { await call(page, 'render', { explicit: true }); await expect(editor(page, host)).toHaveValue('MAIN DRAFT'); }
    await call(page, 'holdSource', 'recent');
    await sourceAction(page, host, 'recent-top');
    await page.locator('#main .rv-chat-item-text[title="Other material"]').first().click();
    await expect(editor(page, 'main')).toHaveValue('');
    await call(page, 'releaseSource', 'recent');
    await expect(editor(page, host)).toHaveValue(/\/source\/recent.ts/);
    await noAutoSend(page);
  });
}
for (const loss of ['rebind', 'unmount', 'placement', 'hydration', 'workspace', 'binding']) {
  test(`A09/A11/A13 real deferred clipboard cancels on ${loss} and does not revive`, async ({ page }) => {
    await mount(page); const host = loss === 'rebind' ? 'main' : 'side';
    await call(page, 'holdSource', 'clipboard-use-1'); await sourceAction(page, host, 'clipboard-top');
    if (loss === 'rebind') {
      await page.locator('#main .rv-chat-item-text[title="Other material"]').first().click();
      await page.locator('#main .rv-chat-item-text[title="Main material"]').first().click();
    } else if (loss === 'unmount') {
      await call(page, 'render', { side: false }); await expect(editor(page, 'side')).toHaveCount(0);
      await call(page, 'render', { side: true }); await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
    } else await call(page, 'lose', loss);
    const before = await snapshot(page);
    await call(page, 'releaseSource', 'clipboard-use-1');
    await expect.poll(async () => (await snapshot(page)).notices.at(-1)).toBe('Unable to add material to chat');
    expect((await snapshot(page)).drafts).toEqual(before.drafts);
    expect((await snapshot(page)).attachments).toEqual(before.attachments);
    await noAutoSend(page);
  });
}
test('A09/A16 old callbacks after genuine same-instance tuple reuse reject before write or focus', async ({ page }) => {
  await mount(page); await call(page, 'render', { reuse: true }); await expect(editor(page, 'reuse')).toHaveValue('MAIN DRAFT');
  const node = await editor(page, 'reuse').elementHandle();
  await call(page, 'captureCallback');
  await call(page, 'render', { reuseThread: 'other-main' }); await expect(editor(page, 'reuse')).toHaveValue('');
  expect(await editor(page, 'reuse').evaluate((el, old: any) => el === old, node)).toBe(true);
  await editor(page, 'side').focus();
  const before = await snapshot(page);
  expect(await call(page, 'staleBegin')).toBe('unavailable');
  expect(await call(page, 'staleText')).toBe('cancelled');
  expect(await call(page, 'staleAttachment')).toBe('cancelled');
  expect((await snapshot(page)).drafts).toEqual(before.drafts); expect((await snapshot(page)).attachments).toEqual(before.attachments);
  expect(await editor(page, 'side').evaluate(el => el === document.activeElement)).toBe(true);
  await call(page, 'render', { reuseThread: 'main-session' }); await expect(editor(page, 'reuse')).toHaveValue('MAIN DRAFT');
  expect(await call(page, 'staleText')).toBe('cancelled');
});
test('A12 concurrent source requests complete out of order only once in their own owners', async ({ page }) => {
  await mount(page); await call(page, 'holdSource', 'clipboard-use-1'); await call(page, 'holdSource', 'clipboard-use-2');
  await sourceAction(page, 'main', 'clipboard-row', 1); await sourceAction(page, 'side', 'clipboard-row', 2);
  await call(page, 'releaseSource', 'clipboard-use-2'); await expect(editor(page, 'side')).toHaveValue(/CLIPBOARD 2/);
  await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
  await call(page, 'releaseSource', 'clipboard-use-1'); await expect(editor(page, 'main')).toHaveValue(/CLIPBOARD 1/);
  const before = await snapshot(page);
  await call(page, 'sourceFrame', { type: 'clipboard:use', id: 1, value: 'WRONG DUPLICATE' });
  expect((await snapshot(page)).revisions).toEqual(before.revisions);
  await noAutoSend(page);
});
for (const phase of ['pending', 'unknown']) {
  test(`A15 ${phase} gates actual source preparation and suppresses warm as appropriate`, async ({ page }) => {
    await mount(page); await call(page, 'pending', phase); const before = await snapshot(page);
    await sourceAction(page, 'main', 'clipboard-top');
    if (phase === 'pending') {
      expect((await snapshot(page)).sourceCounts['clipboard-list']).toBeUndefined();
      expect((await snapshot(page)).drafts).toEqual(before.drafts);
    } else await expect(editor(page, 'main')).toHaveValue(/CLIPBOARD 1/);
    expect((await snapshot(page)).frames.filter((f: any) => f.type === 'thread:warm' && f.threadId === 'main-session')).toEqual([]);
    await noAutoSend(page);
  });
}
test('A15 own source warms captured thread; suppressed/failed warming preserves valid insertion', async ({ page }) => {
  await mount(page); await call(page, 'cold', 'side-session'); await sourceAction(page, 'side', 'gallery');
  await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
  expect((await snapshot(page)).frames.filter((f: any) => f.type === 'thread:warm').map((f: any) => f.threadId)).toEqual(['side-session']);
  await call(page, 'render', { reuse: true, active: false }); await expect(editor(page, 'reuse')).toHaveValue('MAIN DRAFT');
  await call(page, 'cold', 'main-session'); await sourceAction(page, 'reuse', 'gallery');
  await expect(page.locator('#reuse .rv-chat-attachment-pill')).toHaveCount(1);
  expect((await snapshot(page)).frames.filter((f: any) => f.type === 'thread:warm').map((f: any) => f.threadId)).toEqual(['side-session']);
  await call(page, 'render', { active: true }); await call(page, 'failWarm');
  await sourceAction(page, 'reuse', 'clipboard-top'); await expect(editor(page, 'reuse')).toHaveValue(/CLIPBOARD 1/);
  await noAutoSend(page);
});
for (const host of ['main', 'side']) {
  test(`A16 ${host} microphone completion keeps own material lease`, async ({ page }) => {
    await mount(page); await page.locator(`#${host}`).getByRole('button', { name: 'Voice input (click to open)', exact: true }).click();
    await expect(page.locator('.rv-voice-recorder__title')).toHaveText('Recording');
    await call(page, 'holdSource', 'transcribe'); await page.locator('.rv-voice-recorder').getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).sourceCounts.transcribe).toBe(1);
    await editor(page, host === 'main' ? 'side' : 'main').focus();
    await call(page, 'releaseSource', 'transcribe');
    await expect(editor(page, host)).toHaveValue(/MIC TRANSCRIPT/);
    expect(await editor(page, host === 'main' ? 'side' : 'main').evaluate(el => el === document.activeElement)).toBe(true);
    await noAutoSend(page);
  });
}
for (const phase of ['permission', 'recording', 'processing']) {
  test(`A09/A11 mic explicit cancel during ${phase} prevents late source completion`, async ({ page }) => {
    await mount(page); if (phase === 'permission') await call(page, 'holdSource', 'permission');
    await page.locator('#main').getByRole('button', { name: 'Voice input (click to open)', exact: true }).click();
    await expect(page.locator('.rv-voice-recorder__title')).toHaveText('Recording');
    if (phase === 'processing') {
      await call(page, 'holdSource', 'transcribe'); await page.locator('.rv-voice-recorder').getByRole('button', { name: 'Send', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).sourceCounts.transcribe).toBe(1);
      await page.keyboard.press('Escape'); await call(page, 'releaseSource', 'transcribe');
    } else {
      await page.locator('.rv-voice-recorder').getByRole('button', { name: 'Cancel', exact: true }).click();
      if (phase === 'permission') await call(page, 'releaseSource', 'permission');
    }
    await expect(page.locator('.rv-voice-recorder')).toHaveCount(0);
    await expect(editor(page, 'main')).toHaveValue('MAIN DRAFT');
    if (phase !== 'processing') expect((await snapshot(page)).sourceCounts.transcribe).toBeUndefined();
    if (phase === 'permission') {
      expect((await snapshot(page)).sourceCounts['recorder-start']).toBeUndefined();
      await expect.poll(async () => (await snapshot(page)).sourceCounts['track-stop']).toBe(1);
    }
    await noAutoSend(page);
  });
}
for (const cancel of [false, true]) {
  test(`A16 diagnostic begins before retrieval and ${cancel ? 'cancels on real rebind' : 'survives other focus'}`, async ({ page }) => {
    await mount(page); await call(page, 'diagnostic', 'main-session');
    await call(page, 'holdSource', 'diagnostic');
    await page.locator('#main').getByRole('button', { name: 'Ask AI', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).sourceCounts.diagnostic).toBe(1);
    if (cancel) await page.locator('#main .rv-chat-item-text[title="Other material"]').first().click();
    await editor(page, 'side').focus(); await call(page, 'releaseSource', 'diagnostic');
    if (cancel) {
      await expect(editor(page, 'main')).toHaveValue('');
      expect((await snapshot(page)).drafts[key('main-session')]).toBe('MAIN DRAFT');
    } else await expect(editor(page, 'main')).toHaveValue(/MAIN DRAFT\n\nPlease help.*[\s\S]*SAFE REDACTED DETAIL/);
    await expect(editor(page, 'side')).toHaveValue('SIDE DRAFT');
    expect((await snapshot(page)).frames.filter((f: any) => f.type === 'thread:warm' && f.threadId === 'main-session')).toEqual([]);
    await noAutoSend(page);
  });
}

for (const kind of ['clipboard-top', 'recent-top', 'gallery']) {
  test(`A06 adapterless Side ${kind} uses placement authority without Main rows`, async ({ page }) => {
    await mount(page); await call(page, 'adapterless'); await sourceAction(page, 'side', kind);
    if (kind === 'gallery') await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveCount(1);
    else await expect(editor(page, 'side')).toHaveValue(kind === 'clipboard-top' ? /CLIPBOARD 1/ : /recent.ts/);
    await noAutoSend(page);
  });
}
for (const phase of ['permission', 'processing']) {
  test(`A09 microphone tuple rebind during ${phase} cancels old preparation permanently`, async ({ page }) => {
    await mount(page); await call(page, 'render', { reuse: true }); await expect(editor(page, 'reuse')).toHaveValue('MAIN DRAFT');
    await call(page, 'holdSource', phase === 'permission' ? 'permission' : 'transcribe');
    await page.locator('#reuse').getByRole('button', { name: 'Voice input (click to open)', exact: true }).click();
    await expect(page.locator('.rv-voice-recorder__title')).toHaveText('Recording');
    if (phase === 'processing') {
      await page.locator('.rv-voice-recorder').getByRole('button', { name: 'Send', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).sourceCounts.transcribe).toBe(1);
    }
    await call(page, 'render', { reuseThread: 'other-main' }); await expect(editor(page, 'reuse')).toHaveValue('');
    await call(page, 'releaseSource', phase === 'permission' ? 'permission' : 'transcribe');
    await call(page, 'render', { reuseThread: 'main-session' }); await expect(editor(page, 'reuse')).toHaveValue('MAIN DRAFT');
    if (phase === 'permission') {
      expect((await snapshot(page)).sourceCounts['recorder-start']).toBeUndefined();
      await expect.poll(async () => (await snapshot(page)).sourceCounts['track-stop']).toBe(1);
    }
    await noAutoSend(page);
  });
}
for (const failure of ['unavailable', 'malformed']) {
  test(`A16 direct Ask AI ${failure} preserves fixed source failure and disabled actions`, async ({ page }) => {
    await mount(page); await call(page, 'diagnostic', 'main-session'); await call(page, 'holdSource', 'diagnostic');
    const before = await snapshot(page); const detail = page.locator('#main .rv-chat-diagnostic-details');
    await detail.getByRole('button', { name: 'Ask AI', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).sourceCounts.diagnostic).toBe(1);
    const request = (await snapshot(page)).frames.find((f: any) => f.type === 'chat-turn:diagnostic:get');
    await call(page, 'sourceFrame', { ...request, type: failure === 'unavailable' ? 'chat-turn:diagnostic:unavailable' : 'chat-turn:diagnostic:report',
      ...(failure === 'malformed' ? { report: { version: 1, harnessId: 'opencode', message: 'REJECTED REPORT', hadRenderableOutput: false, hadToolCalls: false, truncatedFields: [] } } : {}) });
    await expect(detail.locator('.rv-chat-diagnostic-status')).toHaveText('Diagnostic details are unavailable.');
    for (const name of ['View', 'Copy', 'Ask AI']) await expect(detail.getByRole('button', { name, exact: true })).toBeDisabled();
    await expect(detail.locator('.rv-chat-diagnostic-report')).toHaveCount(0);
    await call(page, 'releaseSource', 'diagnostic');
    await expect(detail.locator('.rv-chat-diagnostic-status')).toHaveText('Diagnostic details are unavailable.');
    expect((await snapshot(page)).drafts).toEqual(before.drafts); expect((await snapshot(page)).attachments).toEqual(before.attachments);
    expect((await snapshot(page)).frames.filter((f: any) => f.type === 'thread:warm')).toEqual([]);
    await noAutoSend(page);
  });
}
for (const kind of ['clipboard-top', 'recent-top']) {
  test(`A13 source failure from actual ${kind} leaves composer owners unchanged`, async ({ page }) => {
    await mount(page); const held = kind === 'clipboard-top' ? 'clipboard-use-1' : 'recent';
    await call(page, 'holdSource', held); const before = await snapshot(page);
    await sourceAction(page, 'main', kind);
    await expect.poll(async () => (await snapshot(page)).sourceCounts[kind === 'clipboard-top' ? 'clipboard-use' : 'recent']).toBe(1);
    await call(page, 'sourceFrame', kind === 'clipboard-top'
      ? { type: 'clipboard:error', requestType: 'clipboard:use', id: 1, message: 'source failed' }
      : { type: 'recent_files_response', panel: 'wiki-viewer', success: false, error: 'source failed' });
    await expect.poll(async () => (await snapshot(page)).notices.at(-1)).toBe('Unable to add material to chat');
    await call(page, 'releaseSource', held);
    expect((await snapshot(page)).drafts).toEqual(before.drafts);
    expect((await snapshot(page)).attachments).toEqual(before.attachments);
    await noAutoSend(page);
  });
}
test('A16 prepared emoji records once through its existing editor side effect', async ({ page }) => {
  await mount(page); await call(page, 'holdSource', 'clipboard-use-1'); await sourceAction(page, 'main', 'clipboard-top');
  await call(page, 'sourceFrame', { type: 'clipboard:use', id: 1, value: '😀' });
  await expect(editor(page, 'main')).toHaveValue(/😀/);
  await call(page, 'releaseSource', 'clipboard-use-1');
  expect((await snapshot(page)).frames.filter((f: any) => f.type === 'emoji_recents:record' && f.emoji === '😀')).toHaveLength(1);
  await noAutoSend(page);
});
}
