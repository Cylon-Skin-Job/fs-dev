import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('user bubbles shrink-wrap on the right without moving the assistant anchor', async ({ page }) => {
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );

  await page.setContent(`
    <style>
      .fixture {
        display: flex;
        flex-direction: column;
        width: 600px;
        height: 260px;
      }
      ${chatAreaCss}
      .rv-message { max-width: 100%; }
      .rv-message-user { align-self: flex-end; max-width: 85%; }
      .rv-message-user-content { padding: 12px 16px; font-size: 14px; }
      .rv-message-assistant { align-self: flex-start; width: 100%; }
      .rv-orb-wrapper, .rv-tool-fade-in { padding: 4px 0; }
    </style>
    <div class="fixture">
      <div id="short-viewport" class="rv-chat-scroll-viewport">
        <div id="prior-assistant" class="rv-message rv-message-assistant">
          <div id="reply-chrome" class="rv-assistant-reply-shell">reply chrome</div>
        </div>
        <div id="short-user" class="rv-message rv-message-user">
          <div class="rv-message-user-content">Short reply</div>
        </div>
        <div id="assistant" class="rv-message rv-message-assistant">
          <div id="orb" class="rv-orb-wrapper">orb</div>
          <div id="tool" class="rv-tool-fade-in">tool</div>
        </div>
      </div>
    </div>
    <div class="fixture">
      <div id="long-viewport" class="rv-chat-scroll-viewport">
        <div id="long-user" class="rv-message rv-message-user">
          <div class="rv-message-user-content">
            This deliberately long user message should grow until it reaches the established maximum width and then wrap without expanding the bubble beyond that limit.
          </div>
        </div>
      </div>
    </div>
  `);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const value = document.querySelector(selector)!.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
      };
    };
    return {
      shortViewport: rect('#short-viewport'),
      replyChrome: rect('#reply-chrome'),
      shortUser: rect('#short-user'),
      assistant: rect('#assistant'),
      orb: rect('#orb'),
      tool: rect('#tool'),
      longViewport: rect('#long-viewport'),
      longUser: rect('#long-user'),
    };
  });

  expect(layout.shortUser.right).toBeCloseTo(layout.shortViewport.right, 1);
  expect(layout.shortUser.width).toBeLessThan(layout.shortViewport.width * 0.5);
  expect(layout.shortUser.top - layout.replyChrome.bottom).toBeCloseTo(12, 1);

  expect(layout.longUser.right).toBeCloseTo(layout.longViewport.right, 1);
  expect(layout.longUser.width).toBeGreaterThan(layout.longViewport.width * 0.8);
  expect(layout.longUser.width).toBeLessThanOrEqual(layout.longViewport.width * 0.85 + 1);

  expect(layout.assistant.top - layout.shortUser.bottom).toBeCloseTo(12, 1);
  expect(layout.assistant.left).toBeCloseTo(layout.shortViewport.left, 1);
  expect(layout.orb.left).toBeCloseTo(layout.assistant.left, 1);
  expect(layout.tool.left).toBeCloseTo(layout.assistant.left, 1);
});
