import { expect, test } from '@playwright/test';

function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `Line ${index + 1}`).join('\n');
}

test('composer grows through twelve lines, then scrolls while attachments stay above it', async ({ page }) => {
  await page.goto('/');

  const input = page.locator('.rv-panel.active textarea[placeholder="Ask about files..."]');
  await expect(input).toBeEnabled();
  const shell = page.locator('.rv-panel.active .rv-chat-composer-shell');
  const messages = page.locator('.rv-panel.active .rv-chat-messages');

  const initial = await page.evaluate(() => {
    const inputElement = document.querySelector('.rv-panel.active .rv-chat-input')!;
    const shellElement = document.querySelector('.rv-panel.active .rv-chat-composer-shell')!;
    const messagesElement = document.querySelector('.rv-panel.active .rv-chat-messages')!;
    return {
      inputHeight: inputElement.getBoundingClientRect().height,
      shellHeight: shellElement.getBoundingClientRect().height,
      messagesHeight: messagesElement.getBoundingClientRect().height,
    };
  });
  expect(initial.inputHeight).toBeCloseTo(42, 1);

  await input.fill(lines(6));
  const sixLines = await input.evaluate((element) => element.getBoundingClientRect().height);
  expect(sixLines).toBeGreaterThan(initial.inputHeight);

  await input.fill(lines(12));
  const twelve = await page.evaluate(() => {
    const inputElement = document.querySelector('.rv-panel.active .rv-chat-input')! as HTMLTextAreaElement;
    const shellElement = document.querySelector('.rv-panel.active .rv-chat-composer-shell')!;
    const messagesElement = document.querySelector('.rv-panel.active .rv-chat-messages')!;
    return {
      inputHeight: inputElement.getBoundingClientRect().height,
      shellHeight: shellElement.getBoundingClientRect().height,
      messagesHeight: messagesElement.getBoundingClientRect().height,
      overflowY: getComputedStyle(inputElement).overflowY,
    };
  });
  expect(twelve.inputHeight).toBeGreaterThan(sixLines);
  expect(twelve.shellHeight).toBeGreaterThan(initial.shellHeight);
  expect(twelve.messagesHeight).toBeLessThan(initial.messagesHeight);
  expect(twelve.overflowY).toBe('hidden');

  const attachmentSources = page.locator(
    '.rv-panel.active button[title="Send folder path to chat"]:visible',
  );
  expect(await attachmentSources.count()).toBeGreaterThan(0);
  await attachmentSources.first().click();
  const tray = shell.locator('.rv-chat-attachments-strip');
  await expect(tray).toBeVisible();

  const withAttachment = await page.evaluate(() => {
    const shellElement = document.querySelector('.rv-panel.active .rv-chat-composer-shell')!;
    const trayElement = document.querySelector('.rv-panel.active .rv-chat-attachments-strip')!;
    const inputElement = document.querySelector('.rv-panel.active .rv-chat-input')!;
    const trayRect = trayElement.getBoundingClientRect();
    const inputRect = inputElement.getBoundingClientRect();
    return {
      shellHeight: shellElement.getBoundingClientRect().height,
      trayAboveInput: trayRect.bottom <= inputRect.top,
    };
  });
  expect(withAttachment.shellHeight).toBeGreaterThan(twelve.shellHeight);
  expect(withAttachment.trayAboveInput).toBe(true);

  await input.fill(lines(13));
  const overflow = await input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return {
      height: textarea.getBoundingClientRect().height,
      clientHeight: textarea.clientHeight,
      scrollHeight: textarea.scrollHeight,
      scrollTop: textarea.scrollTop,
      overflowY: getComputedStyle(textarea).overflowY,
    };
  });
  expect(overflow.height).toBeCloseTo(twelve.inputHeight, 1);
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
  expect(overflow.scrollTop).toBeGreaterThan(0);
  expect(overflow.overflowY).toBe('auto');

  await shell.getByRole('button', { name: /Remove / }).click();
  await input.fill('');
  await expect.poll(async () => input.evaluate((element) => element.getBoundingClientRect().height))
    .toBeCloseTo(42, 1);
});
