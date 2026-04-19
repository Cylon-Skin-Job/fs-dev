import { test } from '@playwright/test';

test('header hover screenshot', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Hover the menu button
  await page.locator('.rv-menu-btn').hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/screenshots/header-hover-menu.png', clip: { x: 0, y: 0, width: 900, height: 120 } });

  // Hover a tool button
  const toolBtn = page.locator('.rv-tool-btn').first();
  if (await toolBtn.count() > 0) {
    await toolBtn.hover({ force: true });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'e2e/screenshots/header-hover-tool.png', clip: { x: 0, y: 0, width: 900, height: 300 } });
  }

  // Inspect header shadow
  const header = await page.evaluate(() => {
    const h = document.querySelector('.rv-header');
    if (!h) return null;
    const cs = window.getComputedStyle(h);
    return {
      boxShadow: cs.boxShadow,
      borderBottom: cs.borderBottom,
      height: cs.height,
    };
  });
  console.log('[HEADER]', JSON.stringify(header));
});
