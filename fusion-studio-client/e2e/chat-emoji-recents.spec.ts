import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __emojiPanelCalls?: number;
  }
}

test('right-click shows the emoji bar when there are no recents', async ({ page }) => {
  await page.addInitScript(() => {
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
  await input.click({ button: 'right' });

  const emojiBar = page.locator('.rv-panel.active').getByRole('menu', { name: 'Recent emojis' });
  await expect(emojiBar).toBeVisible();
  await expect(emojiBar).toContainText('No recent emojis yet');

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
  await expect(input).toBeFocused();
});
