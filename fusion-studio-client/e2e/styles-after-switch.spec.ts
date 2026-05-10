import { test, expect } from '@playwright/test';

test('shared styles reload after reset (simulated switch)', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Initial state
  const initial = await page.evaluate(() => {
    const el = document.getElementById('ws-shared-styles-views');
    return { exists: !!el, length: el?.textContent?.length ?? 0 };
  });
  console.log('[INITIAL]', JSON.stringify(initial));
  expect(initial.exists).toBeTruthy();
  expect(initial.length).toBeGreaterThan(1000);

  // Switch via the WebSocket: send workspace:switch_requested for a different workspace
  const didSwitch = await page.evaluate(async () => {
    // Find ws on any global shim — we'll send directly via the existing socket
    const wsObj = (window as any).WebSocket;
    // Get the live socket from the panelStore via a side-channel: the running app
    // already has a socket. We can find all sockets via the React devtools shim.
    // Instead, fire a custom event that we listen for in the app? Too invasive.
    // Simpler: find any open WS connection in the page.
    // The panelStore ws is the only one. We can't access store directly without exposing it.
    // So: just use the DOM — click the menu button to open switcher, then click another workspace.
    return false;
  });

  // Use the UI
  await page.click('.rv-menu-btn');
  await page.waitForTimeout(400);

  const workspaceItems = await page.locator('.rv-switcher-item').count();
  console.log('[WORKSPACE ITEMS]', workspaceItems);

  // Find the inactive workspace (one without the active class)
  const inactiveCount = await page.locator('.rv-switcher-item:not(.is-active)').count();
  console.log('[INACTIVE ITEMS]', inactiveCount);

  if (inactiveCount > 0) {
    await page.locator('.rv-switcher-item:not(.is-active)').first().click();
    await page.waitForTimeout(2000);

    // After switch
    const afterSwitch = await page.evaluate(() => {
      const el = document.getElementById('ws-shared-styles-views');
      return { exists: !!el, length: el?.textContent?.length ?? 0 };
    });
    console.log('[AFTER SWITCH]', JSON.stringify(afterSwitch));
    await page.screenshot({ path: 'e2e/screenshots/after-switch-1.png' });

    // Switch back
    await page.click('.rv-menu-btn');
    await page.waitForTimeout(400);
    await page.locator('.rv-switcher-item:not(.is-active)').first().click();
    await page.waitForTimeout(2000);

    // After switching back
    const afterBack = await page.evaluate(() => {
      const el = document.getElementById('ws-shared-styles-views');
      return { exists: !!el, length: el?.textContent?.length ?? 0 };
    });
    console.log('[AFTER BACK]', JSON.stringify(afterBack));
    await page.screenshot({ path: 'e2e/screenshots/after-back.png' });

    expect(afterBack.exists).toBeTruthy();
    expect(afterBack.length).toBeGreaterThan(1000);
  } else {
    console.log('[SKIP] No other workspace to switch to');
  }
});
