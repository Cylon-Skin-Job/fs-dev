import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __capturedPromptFrames?: Array<Record<string, unknown>>;
  }
}

test('removing an attachment excludes it from the outgoing prompt', async ({ page }) => {
  await page.addInitScript(() => {
    window.__capturedPromptFrames = [];
    const nativeSend = WebSocket.prototype.send;

    WebSocket.prototype.send = function capturePrompt(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as Record<string, unknown>;
          if (message.type === 'prompt') {
            window.__capturedPromptFrames?.push(message);
            return;
          }
        } catch {
          // Forward non-JSON socket traffic unchanged.
        }
      }

      nativeSend.call(this, data);
    };
  });

  await page.goto('/');
  await expect(page.locator('.rv-panel.active .rv-chat-footer')).toBeVisible();
  await expect(page.locator('.rv-panel.active textarea[placeholder="Ask about files..."]'))
    .toBeEnabled();

  const attachmentSources = page.locator(
    '.rv-panel.active button[title="Send folder path to chat"]:visible',
  );
  const attachmentSourceCount = await attachmentSources.count();
  expect(attachmentSourceCount).toBeGreaterThan(1);
  await attachmentSources.first().click();
  await attachmentSources.nth(1).click();

  const pills = page.locator('.rv-panel.active .rv-chat-attachment-pill');
  await expect(pills).toHaveCount(2);
  const pill = pills.first();

  const shell = page.locator('.rv-panel.active .rv-chat-composer-shell');
  const strip = shell.locator('.rv-chat-attachments-strip');
  await expect(strip).toHaveCount(1);
  await expect(pill.locator('.rv-chat-attachment-pill-label')).not.toBeEmpty();
  await expect(pill.locator('.rv-chat-attachment-type')).toHaveText('Folder');

  const trayLayout = await strip.evaluate((element) => {
    const shellElement = element.closest('.rv-chat-composer-shell');
    const card = element.querySelector('.rv-chat-attachment-pill');
    return {
      insideComposer: Boolean(shellElement?.contains(element)),
      overflowX: getComputedStyle(element).overflowX,
      shellRadius: shellElement ? getComputedStyle(shellElement).borderRadius : null,
      cardRadius: card ? getComputedStyle(card).borderRadius : null,
      horizontallyScrollable: element.scrollWidth > element.clientWidth,
    };
  });
  expect(trayLayout).toEqual(expect.objectContaining({
    insideComposer: true,
    overflowX: 'auto',
    shellRadius: '15px',
    cardRadius: '15px',
    horizontallyScrollable: true,
  }));

  const removeButton = pill.getByRole('button', { name: /Remove / });
  await expect(removeButton).toBeVisible();

  const pillBox = await pill.boundingBox();
  const removeBox = await removeButton.boundingBox();
  expect(pillBox).not.toBeNull();
  expect(removeBox).not.toBeNull();
  expect(removeBox!.x).toBeGreaterThanOrEqual(pillBox!.x);
  expect(removeBox!.y).toBeGreaterThanOrEqual(pillBox!.y);
  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(pillBox!.x + pillBox!.width);
  expect(removeBox!.y + removeBox!.height).toBeLessThanOrEqual(pillBox!.y + pillBox!.height);

  await removeButton.click();
  await expect(pills).toHaveCount(1);

  const finalRemoveButton = pills.getByRole('button', { name: /Remove / });
  await expect(finalRemoveButton).toBeVisible();
  await finalRemoveButton.click();
  await expect(pills).toHaveCount(0);

  const input = page.locator('.rv-panel.active textarea[placeholder="Ask about files..."]');
  await input.fill('attachment removal regression');
  await page.locator('.rv-panel.active').getByRole('button', { name: 'Send message', exact: true }).click();

  await expect.poll(async () => page.evaluate(() => window.__capturedPromptFrames?.length ?? 0))
    .toBe(1);
  const [prompt] = await page.evaluate(() => window.__capturedPromptFrames ?? []);
  expect(prompt).not.toHaveProperty('attachments');
});
