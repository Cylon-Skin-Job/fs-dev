/** Controlled native/save delays exercise real camera source → shared commit → render. */
import { expect, test, type Page } from '@playwright/test';

export function registerScreenshotMaterialCases({ mount, call, snapshot, editor, noAutoSend, key }: any) {
  const camera = (page: Page, method: string, value?: any) => page.evaluate(({ method, value }) =>
    (window as any).__material.camera[method](value), { method, value });
  const requests = async (page: Page) => (await snapshot(page)).frames.filter((f: any) => f.type === 'screenshot:file-capture');
  async function begin(page: Page, host: string, global = false) {
    if (global) { await editor(page, host).click(); await page.locator('#camera').click(); }
    else { await page.locator(`#${host}`).getByRole('button', { name: 'Add', exact: true }).click();
      await page.locator(`#${host}`).getByRole('menuitem', { name: 'Take screenshot', exact: true }).click(); }
  }
  async function saved(page: Page, requestId: string, name = 'camera.png') {
    await call(page, 'sourceFrame', { type: 'screenshot:file-captured', requestId,
      savedPath: `/source/Data/Screenshots/${name}` });
  }
  for (const host of ['main', 'side']) for (const global of [false, true]) {
    test(`A02/A10 ${global ? 'global' : 'own'} camera ${host} survives other retained focus`, async ({ page }) => {
      await mount(page); const before = await snapshot(page);
      await begin(page, host, global);
      await editor(page, host === 'main' ? 'side' : 'main').click();
      await camera(page, 'finish'); await expect.poll(async () => (await requests(page)).length).toBe(1);
      const request = (await requests(page))[0];
      await call(page, 'foreignView', true);
      await saved(page, 'foreign'); expect((await snapshot(page)).attachments).toEqual({});
      await saved(page, request.requestId); await saved(page, request.requestId);
      await expect(page.locator(`#${host} .rv-chat-attachment-pill`)).toHaveCount(1);
      const after = await snapshot(page); const owner = key(host === 'main' ? 'main-session' : 'side-session');
      expect(Object.keys(after.attachments)).toEqual([owner]); expect(after.drafts).toEqual(before.drafts);
      expect(after.attachments[owner].attachments[0]).toMatchObject({ path: '/source/Data/Screenshots/camera.png', relativePath: 'Data/Screenshots/camera.png' });
      expect(after.cameraListeners).toEqual(before.cameraListeners);
      expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.closest('#main,#side')?.id)).toBe(host === 'main' ? 'side' : 'main');
      await noAutoSend(page);
    });
  }
  for (const phase of ['capture', 'save']) for (const loss of ['workspace', 'hydration', 'placement', 'binding', 'unmount']) {
    test(`A09/A11/A13 camera irreversible ${loss} during ${phase}`, async ({ page }) => {
      await mount(page); const before = await snapshot(page); await begin(page, 'side');
      if (phase === 'save') { await camera(page, 'finish'); await expect.poll(async () => (await requests(page)).length).toBe(1); }
      if (loss === 'unmount') { await call(page, 'render', { side: false }); await expect(page.locator('#side')).toHaveCount(0);
        await call(page, 'render', { side: true }); await expect(editor(page, 'side')).toHaveCount(1); }
      else await call(page, 'lose', loss);
      if (phase === 'save') await saved(page, (await requests(page))[0].requestId); else await camera(page, 'finish');
      await expect.poll(async () => (await snapshot(page)).notices.at(-1)).toBe('Screenshot was not attached because the chat changed.');
      const after = await snapshot(page); expect(after.attachments).toEqual(before.attachments); expect(after.drafts).toEqual(before.drafts);
      expect(await requests(page)).toHaveLength(phase === 'save' ? 1 : 0);
      expect(after.cameraListeners).toEqual(before.cameraListeners); await noAutoSend(page);
    });
  }
  test('A12 concurrent cameras own out-of-order/foreign/duplicate results and cleanup', async ({ page }) => {
    await mount(page); const before = await snapshot(page); await begin(page, 'main'); await begin(page, 'side');
    await camera(page, 'finish', 1); await camera(page, 'finish'); await expect.poll(async () => (await requests(page)).length).toBe(2);
    const [side, main] = await requests(page); expect(side.requestId).not.toBe(main.requestId);
    await saved(page, 'wrong');
    await call(page, 'sourceFrame', {type:'screenshot:file-captured', requestId:main.requestId,workspaceId:'foreign-workspace',savedPath:'/foreign.png'});
    expect((await snapshot(page)).attachments).toEqual(before.attachments);
    await saved(page, main.requestId, 'main.png'); await saved(page, side.requestId, 'side.png');
    await saved(page, side.requestId, 'duplicate.png');
    await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveAttribute('title', '/source/Data/Screenshots/main.png');
    await expect(page.locator('#side .rv-chat-attachment-pill')).toHaveAttribute('title', '/source/Data/Screenshots/side.png');
    expect((await snapshot(page)).cameraListeners).toEqual(before.cameraListeners); await noAutoSend(page);
  });
  for (const failure of ['unsupported', 'empty', 'error', 'save-error', 'malformed-save', 'send-throw', 'disconnect', 'deadline']) {
    test(`A14 camera ${failure} cleans terminal resources without insertion`, async ({ page }) => {
      await mount(page); const before = await snapshot(page);
      if (['unsupported', 'empty', 'error'].includes(failure)) await camera(page, 'mode', failure);
      if (failure === 'send-throw') await camera(page, 'saveMode', 'throw');
      if (failure === 'deadline') await page.clock.install();
      await begin(page, 'main');
      if (!['unsupported', 'empty', 'error'].includes(failure)) {
        await camera(page, 'finish'); await expect.poll(async () => (await requests(page)).length).toBe(1);
        if (failure === 'malformed-save') await call(page, 'sourceFrame', { type: 'screenshot:file-captured', requestId: (await requests(page))[0].requestId, savedPath: '' });
        if (failure === 'save-error') await call(page, 'sourceFrame', { type: 'screenshot:error', requestId: (await requests(page))[0].requestId, message: 'owned rejection' });
        if (failure === 'disconnect') await camera(page, 'disconnect');
        if (failure === 'deadline') await page.clock.fastForward(30_001);
      }
      await expect.poll(async () => (await snapshot(page)).notices.length).toBeGreaterThan(before.notices.length);
      const after = await snapshot(page); expect(after.attachments).toEqual(before.attachments); expect(after.drafts).toEqual(before.drafts);
      // Disconnect also retires the transport owner's listeners; the screenshot owner is always gone.
      if (failure !== 'disconnect') expect(after.cameraListeners).toEqual(before.cameraListeners);
      else { expect(after.cameraListeners.message).toBeLessThanOrEqual(before.cameraListeners.message); expect(after.cameraListeners.close).toBeLessThanOrEqual(before.cameraListeners.close); }
      await noAutoSend(page);
    });
  }
  test('A05/A15 no active owner and pending block native work; unknown composes without second Send', async ({ page }) => {
    await mount(page); await page.locator('#camera').click(); expect((await snapshot(page)).sourceCounts.capture ?? 0).toBe(0);
    await editor(page, 'main').click(); await call(page, 'pending', 'pending'); await page.locator('#camera').click(); expect((await snapshot(page)).sourceCounts.capture ?? 0).toBe(0);
    await call(page, 'pending', 'unknown'); await begin(page, 'main', true); await camera(page, 'finish');
    await expect.poll(async () => (await requests(page)).length).toBe(1); await saved(page, (await requests(page))[0].requestId);
    await expect(page.locator('#main .rv-chat-attachment-pill')).toHaveCount(1); await noAutoSend(page);
  });
}
