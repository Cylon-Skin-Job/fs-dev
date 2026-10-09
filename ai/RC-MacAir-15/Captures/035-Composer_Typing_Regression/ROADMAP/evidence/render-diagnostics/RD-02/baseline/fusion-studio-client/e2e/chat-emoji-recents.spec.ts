import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __emojiPanelCalls?: number;
    __emojiRecordFrames?: Array<Record<string, unknown>>;
  }
}

test('right-click shows the emoji bar when there are no recents', async ({ page }) => {
  await page.addInitScript(() => {
    window.__emojiRecordFrames = [];
    const nativeSend = WebSocket.prototype.send;

    WebSocket.prototype.send = function respondWithEmptyEmojiRecents(data) {
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data) as Record<string, unknown>;
          if (message.type === 'emoji_recents:list') {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({ type: 'emoji_recents:list', items: [], total: 0 }),
            }));
            return;
          }
          if (message.type === 'emoji_recents:record') {
            window.__emojiRecordFrames?.push(message);
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
  const threadItems = page.locator('.rv-panel.active .rv-chat-item');
  await expect.poll(async () => threadItems.count()).toBeGreaterThan(0);
  const threadCount = await threadItems.count();
  expect(threadCount).toBeGreaterThan(0);
  await threadItems.first().click();

  const input = page.locator('.rv-panel.active textarea[placeholder="Ask about files..."]');
  await expect(input).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Open system emoji picker' })).toHaveCount(0);
  await input.fill('Unchanged draft');
  await input.click({ button: 'right' });

  const emojiBar = page.locator('.rv-panel.active').getByRole('menu', { name: 'Recent emojis' });
  await expect(emojiBar).toBeVisible();
  await expect(emojiBar).toContainText('No recent emojis yet');
  const composer = page.locator('.rv-panel.active .rv-chat-composer-shell');
  const emojiBarRadius = await emojiBar.evaluate((element) => getComputedStyle(element).borderRadius);
  const composerRadius = await composer.evaluate((element) => getComputedStyle(element).borderRadius);
  expect(emojiBarRadius).toBe(composerRadius);

  await page.evaluate(() => {
    window.__emojiPanelCalls = 0;
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        showEmojiPanel: async () => {
          window.__emojiPanelCalls = (window.__emojiPanelCalls ?? 0) + 1;
          return { success: true };
        },
      },
    });
  });

  const addEmoji = emojiBar.getByRole('button', { name: 'Add emoji to recents' });
  await expect(addEmoji).toBeVisible();
  await addEmoji.click();

  await expect.poll(async () => page.evaluate(() => window.__emojiPanelCalls ?? 0)).toBe(1);
  const captureInput = page.locator('.rv-panel.active .rv-chat-emoji-capture');
  await expect(captureInput).toBeFocused();

  await captureInput.evaluate((element) => {
    const inputElement = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(inputElement, '🎉');
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect.poll(async () => page.evaluate(() => window.__emojiRecordFrames ?? []))
    .toEqual([{ type: 'emoji_recents:record', emoji: '🎉' }]);
  await expect(emojiBar.getByRole('menuitem', { name: '🎉' })).toBeVisible();
  await expect(input).toHaveValue('Unchanged draft');
});
