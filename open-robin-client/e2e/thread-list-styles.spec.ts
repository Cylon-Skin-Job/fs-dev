import { test, expect } from '@playwright/test';

test('thread list styling diagnostic', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 1) Are the three shared style tags injected?
  const styleTags = await page.evaluate(() => {
    const ids = ['ws-shared-styles-themes', 'ws-shared-styles-components', 'ws-shared-styles-views'];
    return ids.map((id) => {
      const el = document.getElementById(id);
      return {
        id,
        exists: !!el,
        length: el?.textContent?.length ?? 0,
        hasThreadList: el?.textContent?.includes('.thread-list') ?? false,
        hasChatItem: el?.textContent?.includes('.chat-item') ?? false,
      };
    });
  });
  console.log('[STYLE TAGS]', JSON.stringify(styleTags, null, 2));

  // 2) Is the sidebar rendered, and what does it look like?
  const sidebarInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return { found: false };
    const cs = window.getComputedStyle(sidebar);
    return {
      found: true,
      background: cs.background,
      display: cs.display,
      flexDirection: cs.flexDirection,
      padding: cs.padding,
      borderRight: cs.borderRight,
    };
  });
  console.log('[SIDEBAR]', JSON.stringify(sidebarInfo, null, 2));

  // 3) Is there a thread-list element, and are chat-items styled?
  const threadListInfo = await page.evaluate(() => {
    const list = document.querySelector('.thread-list');
    const items = document.querySelectorAll('.chat-item');
    const firstItem = items[0] as HTMLElement | undefined;
    return {
      listFound: !!list,
      itemCount: items.length,
      firstItemStyles: firstItem ? {
        padding: window.getComputedStyle(firstItem).padding,
        background: window.getComputedStyle(firstItem).background,
        borderRadius: window.getComputedStyle(firstItem).borderRadius,
        cursor: window.getComputedStyle(firstItem).cursor,
        fontSize: window.getComputedStyle(firstItem).fontSize,
      } : null,
    };
  });
  console.log('[THREAD LIST]', JSON.stringify(threadListInfo, null, 2));

  // 4) All <style> tag IDs in the head (diagnostic)
  const allStyleIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('head style[id]')).map((s) => s.id);
  });
  console.log('[ALL STYLE IDS]', JSON.stringify(allStyleIds, null, 2));

  // 5) Workspace state
  const wsState = await page.evaluate(() => {
    // @ts-expect-error - we stash the ws on window for debugging
    const store = (window as any).__store;
    return store ? { hasWs: !!store } : 'no store';
  });
  console.log('[WS STATE]', wsState);

  // 6) Console errors
  if (errors.length) console.log('[ERRORS]', errors);
  if (warnings.length) console.log('[WARNINGS]', warnings.slice(0, 5));

  // Screenshot
  await page.screenshot({ path: 'e2e/screenshots/thread-list-diagnostic.png', fullPage: true });

  // Basic assertion
  expect(styleTags.find((s) => s.id === 'ws-shared-styles-views')?.exists).toBeTruthy();
});
