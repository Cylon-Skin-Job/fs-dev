import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatContextTokenSummary,
  formatTokenAmount,
  getContextInputTokens,
  getContextTokenLimit,
  readTokenUsage,
} from '../src/lib/chat/context-usage';

test('composer context meter replaces the old bar and owns the Compact stub', async ({ page }) => {
  const footerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatAreaFooter.tsx'),
    'utf8',
  );
  const meterSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatComposerContextMeter.tsx'),
    'utf8',
  );
  const replyChromeSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/AssistantReplyChrome.tsx'),
    'utf8',
  );
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );

  expect(footerSource.indexOf('<ChatComposerContextMeter')).toBeLessThan(
    footerSource.indexOf('<ChatComposerModelMenu'),
  );
  expect(footerSource).not.toContain('rv-context-usage-bar-standalone');
  expect(replyChromeSource).not.toContain('aria-label="Compress"');
  expect(meterSource).toContain('data-stub="true"');
  expect(meterSource).toContain('>compress</span>');
  expect(meterSource).toContain('className="rv-chat-context-percent"');
  expect(meterSource).not.toContain('action: \'compact\'');
  expect(chatAreaCss).toContain('conic-gradient(');
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-context-trigger\s*\{[^}]*background: conic-gradient\(\s*var\(--theme-primary,[\s\S]*?var\(--chat-foreground-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-context-trigger::before\s*\{[^}]*background: var\(--chat-content-bg,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-context-bar-fill\s*\{[^}]*background: var\(--theme-primary,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-context-percent\s*\{[^}]*color: var\(--theme-primary,/s,
  );

  const usage = readTokenUsage({
    input_other: 5_961,
    input_cache_read: 6_400,
    input_cache_creation: 0,
    output: 61,
  });
  const contextUsage = 12_361 / 262_144;
  expect(getContextInputTokens(usage)).toBe(12_361);
  expect(getContextTokenLimit(contextUsage, usage)).toBe(262_144);
  expect(formatTokenAmount(12_361)).toBe('12.4k');
  expect(formatContextTokenSummary(contextUsage, usage)).toBe('12.4k of 262k tokens');

  await page.setContent(`
    <style>${chatAreaCss}</style>
    <div class="rv-chat-composer-actions" style="--theme-primary: #123456; --chat-foreground-color: #abcdef; --chat-content-bg: #102030">
      <div class="rv-chat-composer-context">
        <button class="rv-chat-composer-context-trigger" style="--ctx-fill: 5%"></button>
      </div>
      <div class="rv-chat-composer-model"><button class="rv-chat-composer-model-trigger">Deepseek V4 Flash</button></div>
    </div>
    <div class="rv-hover-icon-modal open rv-chat-context-menu" style="position: static; --hover-modal-bg: #111">
      <div class="rv-chat-context-details">
        <div class="rv-chat-context-bar"><div class="rv-chat-context-bar-fill" style="--ctx-fill: 5%"></div></div>
        <span class="rv-chat-context-token-summary">12.4k of 262k tokens · <span class="rv-chat-context-percent">5%</span></span>
      </div>
      <button class="rv-chat-context-compact"><span class="material-symbols-outlined" aria-hidden="true">compress</span><span>Compact</span></button>
    </div>
  `);

  const meterBox = await page.locator('.rv-chat-composer-context-trigger').boundingBox();
  const modelBox = await page.locator('.rv-chat-composer-model-trigger').boundingBox();
  expect(meterBox).not.toBeNull();
  expect(modelBox).not.toBeNull();
  expect(meterBox!.width).toBe(12);
  expect(meterBox!.height).toBe(12);
  expect(await page.locator('.rv-chat-composer-context-trigger').evaluate(
    (element) => getComputedStyle(element, '::before').inset,
  )).toBe('3px');
  expect(await page.locator('.rv-chat-composer-context-trigger').evaluate(
    (element) => getComputedStyle(element, '::before').backgroundColor,
  )).toBe('rgb(16, 32, 48)');
  expect(await page.locator('.rv-chat-composer-context-trigger').evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )).toContain('rgb(18, 52, 86)');
  expect(await page.locator('.rv-chat-composer-context-trigger').evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )).toContain('rgb(171, 205, 239)');
  expect(meterBox!.x).toBeLessThan(modelBox!.x);
  await expect(page.getByText('12.4k of 262k tokens · 5%', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compact', exact: true })).toContainText('compress');
});
