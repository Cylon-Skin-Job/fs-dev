import { test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, 'screenshots', 'ellipsis-debug');

test('ellipsis menu opacity diagnostic', async ({ page }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Screenshot: initial
  await page.screenshot({ path: path.join(OUT_DIR, '01-initial.png'), fullPage: true });

  // Find the active panel's sidebar → first chat-item (target only visible)
  const chatItem = page.locator('.rv-panel.active .chat-item:not(.active)').first();
  const chatItemCount = await page.locator('.rv-panel.active .chat-item').count();
  console.log('[DEBUG] active panel chat-item count:', chatItemCount);

  await chatItem.waitFor({ state: 'visible' });
  await chatItem.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, '02-hovered.png'), fullPage: true });

  // Inspect the menu button
  const btnDiag = await page.evaluate(() => {
    const btn = document.querySelector('.thread-menu-btn') as HTMLElement | null;
    if (!btn) return { found: false };
    const cs = getComputedStyle(btn);
    const rect = btn.getBoundingClientRect();
    return {
      found: true,
      opacity: cs.opacity,
      display: cs.display,
      visibility: cs.visibility,
      pointerEvents: cs.pointerEvents,
      color: cs.color,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      innerHTML: btn.innerHTML,
    };
  });
  console.log('[DEBUG] thread-menu-btn:', JSON.stringify(btnDiag, null, 2));

  // Click the kebab in the hovered row
  const kebab = chatItem.locator('.thread-menu-btn');
  await kebab.click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '03-menu-open.png'), fullPage: true });

  // Inspect the dropdown + its ancestors
  const dropdownDiag = await page.evaluate(() => {
    const dd = document.querySelector('.thread-menu-dropdown') as HTMLElement | null;
    if (!dd) return { found: false, allElements: document.querySelectorAll('.thread-menu-dropdown').length };
    const cs = getComputedStyle(dd);
    const rect = dd.getBoundingClientRect();
    const buttons = Array.from(dd.querySelectorAll('button')).map((b) => {
      const bcs = getComputedStyle(b);
      return {
        text: b.textContent?.trim(),
        opacity: bcs.opacity,
        color: bcs.color,
        background: bcs.backgroundColor,
        display: bcs.display,
        visibility: bcs.visibility,
      };
    });
    // Walk ancestors collecting opacity
    const ancestry: Array<{ tag: string; cls: string; opacity: string; visibility: string; display: string }> = [];
    let el: HTMLElement | null = dd;
    while (el && el !== document.body) {
      const acs = getComputedStyle(el);
      ancestry.push({
        tag: el.tagName,
        cls: el.className,
        opacity: acs.opacity,
        visibility: acs.visibility,
        display: acs.display,
      });
      el = el.parentElement;
    }
    return {
      found: true,
      opacity: cs.opacity,
      background: cs.backgroundColor,
      border: cs.border,
      display: cs.display,
      visibility: cs.visibility,
      pointerEvents: cs.pointerEvents,
      zIndex: cs.zIndex,
      position: cs.position,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      buttons,
      ancestry,
    };
  });
  console.log('[DEBUG] thread-menu-dropdown:', JSON.stringify(dropdownDiag, null, 2));

  // Close-up of the dropdown area
  if (dropdownDiag.found && dropdownDiag.rect.width > 0) {
    const box = dropdownDiag.rect;
    await page.screenshot({
      path: path.join(OUT_DIR, '04-dropdown-closeup.png'),
      clip: {
        x: Math.max(0, box.x - 40),
        y: Math.max(0, box.y - 40),
        width: Math.min(500, box.width + 80),
        height: Math.min(500, box.height + 80),
      },
    });
  }

  console.log('[DEBUG] page errors:', errors);
});
