import { test } from '@playwright/test';

test('hover diagnostic — what has a thick blue line', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Baseline, nothing hovered
  await page.screenshot({ path: 'e2e/screenshots/hover-0-baseline.png' });

  // Hover the resize handle
  const handles = page.locator('.rv-panel.active .rv-resize-handle');
  const count = await handles.count();
  console.log('[RESIZE HANDLES visible]', count);

  if (count > 0) {
    await handles.nth(0).hover({ force: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/hover-1-resize-handle.png' });

    // Capture computed styles AROUND the handle to find any thick blue line
    const nearby = await page.evaluate(() => {
      const h = document.querySelector('.rv-resize-handle');
      if (!h) return null;
      const box = h.getBoundingClientRect();
      // Look at every element in a vertical strip centered on the handle
      const results: { tag: string; cls: string; rect: DOMRect; styles: Record<string, string> }[] = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // elements near the handle column
        if (Math.abs(r.left - box.left) < 20 || Math.abs(r.right - box.right) < 20) {
          const cs = window.getComputedStyle(el);
          // Only capture if it has borders, box-shadow, or primary color
          const hasVisual = (
            (cs.borderLeftWidth !== '0px' && cs.borderLeftStyle !== 'none') ||
            (cs.borderRightWidth !== '0px' && cs.borderRightStyle !== 'none') ||
            (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none') ||
            (cs.borderBottomWidth !== '0px' && cs.borderBottomStyle !== 'none') ||
            (cs.boxShadow !== 'none')
          );
          if (hasVisual) {
            results.push({
              tag: el.tagName,
              cls: (el as HTMLElement).className?.toString().slice(0, 80),
              rect: r,
              styles: {
                borderLeft: cs.borderLeft,
                borderRight: cs.borderRight,
                borderTop: cs.borderTop,
                borderBottom: cs.borderBottom,
                boxShadow: cs.boxShadow,
              },
            });
          }
        }
      }
      return { handleRect: box, nearby: results.slice(0, 20) };
    });
    console.log('[NEARBY]', JSON.stringify(nearby, null, 2));
  }

  // Also check the collapse button hover
  const collapseBtns = page.locator('.rv-collapse-btn, .rv-collapse-rail-btn');
  const cc = await collapseBtns.count();
  console.log('[COLLAPSE BUTTONS]', cc);
  if (cc > 0) {
    await collapseBtns.nth(0).hover({ force: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/hover-2-collapse-btn.png' });
  }
});
