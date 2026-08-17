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
  const threadItems = page.locator('.rv-panel.active .rv-chat-item');
  const threadCount = await threadItems.count();
  expect(threadCount).toBeGreaterThan(0);
  await threadItems.first().click();
  await expect(page.locator('.rv-panel.active textarea[placeholder="Ask about files..."]'))
    .toBeEnabled();

  const attachmentSources = page.locator(
    '.rv-panel.active button[title="Send folder path to chat"]:visible',
  );
  const attachmentSourceCount = await attachmentSources.count();
  expect(attachmentSourceCount).toBeGreaterThan(0);
  await attachmentSources.first().click();

  const pill = page.locator('.rv-panel.active .rv-chat-attachment-pill');
  await expect(pill).toHaveCount(1);
  await pill.hover();

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
  await expect(pill).toHaveCount(0);

  const input = page.locator('.rv-panel.active textarea[placeholder="Ask about files..."]');
  await input.fill('attachment removal regression');
  await page.locator('.rv-panel.active').getByRole('button', { name: 'Send', exact: true }).click();

  await expect.poll(async () => page.evaluate(() => window.__capturedPromptFrames?.length ?? 0))
    .toBe(1);
  const [prompt] = await page.evaluate(() => window.__capturedPromptFrames ?? []);
  expect(prompt).not.toHaveProperty('attachments');
});
