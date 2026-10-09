import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('chat composer exposes one send action without a dropdown', async ({ page }) => {
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );
  const sendButtonSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/SendButtonGroup.tsx'),
    'utf8',
  );

  expect(sendButtonSource).toContain('className="rv-send-btn-main"');
  expect(sendButtonSource).toContain('onClick={handleSendClick}');
  expect(sendButtonSource).toContain('rv-send-warming-wheel');
  expect(sendButtonSource).toContain('arrow_upward');
  expect(sendButtonSource).not.toContain(" : 'Send'");
  expect(sendButtonSource).not.toContain('rv-send-btn-secondary');
  expect(sendButtonSource).not.toContain('arrow_drop_down');
  expect(sendButtonSource).not.toContain('HoverIconModal');

  await page.setContent(`
    <style>${chatAreaCss}</style>
    <div class="rv-send-button-group">
      <button class="rv-send-btn-main" aria-label="Send message">
        <span class="material-symbols-outlined rv-icon-md" aria-hidden="true">arrow_upward</span>
      </button>
    </div>
  `);

  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(page.locator('.rv-send-button-group button')).toHaveCount(1);
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toHaveCSS('width', '32px');
  await expect(sendButton).toHaveCSS('height', '32px');
  await expect(sendButton).toHaveCSS('border-radius', '50%');
  await expect(sendButton).toHaveText('arrow_upward');
  await expect(page.locator('.rv-send-btn-secondary')).toHaveCount(0);
  await expect(page.locator('.rv-send-dropdown-modal')).toHaveCount(0);
});
