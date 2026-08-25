import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { getSegmentIconColor, getSegmentLabelColor, getSegmentVisual } from '../src/lib/catalog-visual';

const CHAT_FOREGROUND = 'var(--chat-foreground-color, var(--text-dim))';

test('Chat Foreground owns tool calls and completed reply chrome', async ({ page }) => {
  const shellVisual = getSegmentVisual('shell');
  expect(getSegmentIconColor('shell')).toBe(CHAT_FOREGROUND);
  expect(getSegmentLabelColor('shell')).toBe(CHAT_FOREGROUND);
  expect(shellVisual.contentColor).toBe(CHAT_FOREGROUND);

  const replyChromeCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/AssistantReplyChrome.css'),
    'utf8',
  );
  const toolsCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ToolsPanel.css'),
    'utf8',
  );

  await page.setContent(`
    <style>${toolsCss}\n${replyChromeCss}</style>
    <main style="--chat-foreground-color: #abcdef">
      <button class="rv-tool-header-btn" style="--tool-label-color: ${shellVisual.labelColor}">
        <span class="rv-tool-icon" style="--tool-icon-color: ${shellVisual.iconColor}">tool</span>
        <span class="rv-tool-label">Shell</span>
      </button>
      <div class="rv-tool-content-body" style="--tool-content-color: ${shellVisual.contentColor}">output</div>
      <div class="rv-assistant-reply-chrome">
        <button class="rv-assistant-reply-action">copy</button>
      </div>
    </main>
  `);

  for (const selector of [
    '.rv-tool-header-btn',
    '.rv-tool-icon',
    '.rv-tool-content-body',
    '.rv-assistant-reply-chrome',
    '.rv-assistant-reply-action',
  ]) {
    await expect(page.locator(selector)).toHaveCSS('color', 'rgb(171, 205, 239)');
  }
});
