import { test, expect } from '@playwright/test';

test('check layout and CSS variables', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the app to load at least something
  try {
    await page.waitForSelector('#root', { timeout: 5000 });
  } catch (e) {
    console.log('Root not found within 5s');
  }

  // Log page title and URL
  console.log('Title:', await page.title());
  console.log('URL:', page.url());

  // Check if .rv-panel exists
  const panel = page.locator('.rv-panel').first();
  const panelCount = await panel.count();
  console.log('Panel count:', panelCount);

  if (panelCount > 0) {
    const layoutInfo = await panel.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        leftSidebarW: style.getPropertyValue('--left-sidebar-w'),
        leftChatW: style.getPropertyValue('--left-chat-w'),
        rightColW: style.getPropertyValue('--right-col-w'),
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        width: el.clientWidth,
        height: el.clientHeight,
      };
    });
    console.log('Layout Info:', JSON.stringify(layoutInfo, null, 2));
  } else {
    const bodyContent = await page.evaluate(() => document.body.innerHTML.slice(0, 1000));
    console.log('Body HTML (first 1000 chars):', bodyContent);
  }
});
