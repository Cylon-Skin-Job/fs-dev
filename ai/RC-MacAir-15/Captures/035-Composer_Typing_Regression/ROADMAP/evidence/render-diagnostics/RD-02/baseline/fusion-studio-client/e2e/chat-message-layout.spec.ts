import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('user bubbles shrink-wrap on the right without moving the assistant anchor', async ({ page }) => {
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );

  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project \.rv-message-user-content\s*\{[^}]*background: var\(--chat-content-bg,[^}]*border: none;/s,
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

test('turn finalization keeps the CSS spinner and does not swap to a GIF', async ({ page }) => {
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );
  const footerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatAreaFooter.tsx'),
    'utf8',
  );

  expect(footerSource).toContain('className="rv-send-warming-wheel"');
  expect(footerSource).not.toContain('chat-completing-pinwheel.gif');

  await page.setContent(`
    <style>${chatAreaCss}</style>
    <div class="rv-chat-completing-indicator" aria-label="Completing">
      <span class="rv-send-warming-wheel" aria-hidden="true"></span>
    </div>
  `);

  const indicator = page.locator('.rv-chat-completing-indicator');
  await expect(indicator.locator('img')).toHaveCount(0);
  await expect(indicator.locator('.rv-send-warming-wheel')).toHaveCSS(
    'animation-name',
    'rv-send-warming-spin',
  );
});

test('condensed composer reserves separate growing text and control rows', async ({ page }) => {
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );
  const chatInputSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatInput.tsx'),
    'utf8',
  );

  expect(chatInputSource).toContain('rows={2}');
  expect(chatInputSource).toContain('lineHeight * 12');
  expect(chatInputSource).toContain("textarea.style.overflowY = overflowing ? 'auto' : 'hidden'");

  await page.setContent(`
    <style>
      ${chatAreaCss}
      .rv-chat-input-wrapper { border-radius: 10px; }
      .rv-chat-composer-meta-row { padding: 6px 0 0; margin-top: 4px; }
    </style>
    <div class="rv-chat-composer-shell" style="width: 360px">
      <div class="rv-chat-input-container">
        <div class="rv-chat-input-wrapper">
          <div class="rv-chat-input-text-stack">
            <textarea class="rv-chat-input"></textarea>
          </div>
        </div>
      </div>
      <div class="rv-chat-composer-meta-row">
        <div><button>Tool</button></div>
        <div class="rv-send-button-group"><button class="rv-send-btn-main">Send</button></div>
      </div>
    </div>
  `);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const value = document.querySelector(selector)!.getBoundingClientRect();
      return { top: value.top, right: value.right, bottom: value.bottom, height: value.height };
    };
    return {
      shell: rect('.rv-chat-composer-shell'),
      input: rect('.rv-chat-input'),
      controls: rect('.rv-chat-composer-meta-row'),
      send: rect('.rv-send-button-group'),
    };
  });

  await expect(page.locator('.rv-chat-composer-shell')).toHaveCSS('border-radius', '15px');
  expect(layout.input.height).toBeCloseTo(42, 1);
  expect(layout.controls.top - layout.input.bottom).toBeCloseTo(10, 1);
  expect(layout.shell.right - layout.send.right).toBeCloseTo(10, 1);
  expect(layout.shell.bottom - layout.send.bottom).toBeCloseTo(10, 1);

});

test('conversation surface blends into the chat column and scrolls beneath the composer', () => {
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );

  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project > \.rv-chat-messages\s*\{[^}]*background: var\(--chat-surface-bg,[^}]*border-radius: 0;[^}]*margin-bottom: -24px;/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project > \.rv-chat-footer\s*\{[^}]*position: relative;[^}]*z-index: 1;/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-shell\s*\{[^}]*background: var\(--chat-content-bg,/s,
  );
});
