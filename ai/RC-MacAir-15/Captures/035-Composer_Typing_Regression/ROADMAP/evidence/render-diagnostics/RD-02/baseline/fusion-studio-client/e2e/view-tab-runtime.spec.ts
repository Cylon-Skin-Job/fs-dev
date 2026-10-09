import { expect, test } from '@playwright/test';

async function resolvedColor(page: import('@playwright/test').Page, value: string) {
  return page.evaluate((cssValue) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = cssValue;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, value);
}

test.describe.serial('universal view tabs runtime contract', () => {
  test('Capture creates, restores, deduplicates, morphs, and unwinds tabs', async ({ page }) => {
    await page.goto('/');
    await page.locator('.rv-tool-btn[title="Captures"]').click();

    const panel = page.locator('.rv-panel[data-panel="capture-viewer"].active');
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.getByRole('tablist', { name: 'Open captures' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'New capture view' })).toHaveCount(0);

    const firstTile = panel.locator('.rv-doc-tile[title="Capture-A.md"]');
    const secondTile = panel.locator('.rv-doc-tile[title="Capture-A-Second.md"]');
    await expect(firstTile).toBeVisible();
    await firstTile.click({ button: 'right' });
    await expect(panel.getByRole('button', { name: 'New capture view' })).toBeVisible();
    await expect(panel.getByRole('tablist', { name: 'Open captures' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'New capture view' }).click();
    let tablist = panel.getByRole('tablist', { name: 'Open captures' });
    await expect(tablist).toBeVisible();
    await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    expect(await panel.getByRole('button', { name: 'New capture view' }).evaluate((element) => (
      element.closest('[role="tablist"]') === null
    ))).toBe(true);
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    const documentTab = tablist.getByRole('tab', { name: 'Capture-A.md', exact: true });
    const captureTab = tablist.getByRole('tab', { name: 'CAPTURE', exact: true });
    await expect(captureTab).toHaveAttribute('aria-selected', 'true');
    await expect(captureTab).toBeFocused();
    await expect(panel.locator('.rv-capture-viewer-main-title')).toHaveCount(0);
    await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
    const tabpanel = panel.getByRole('tabpanel');
    await expect(tabpanel).toHaveAttribute('aria-labelledby', await captureTab.getAttribute('id') ?? 'missing');

    await captureTab.focus();
    await page.keyboard.press('Tab');
    await expect(tablist.getByRole('button', { name: 'Close capture view' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'New capture view' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button', { name: 'New capture view' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(tablist.getByRole('button', { name: 'Close capture view' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(captureTab).toBeFocused();

    await captureTab.press('ArrowLeft');
    await expect(documentTab).toBeFocused();
    await expect(captureTab).toHaveAttribute('aria-selected', 'true');
    await documentTab.press('ArrowLeft');
    await expect(captureTab).toBeFocused();
    await captureTab.press('Home');
    await expect(documentTab).toBeFocused();
    await documentTab.press('End');
    await expect(captureTab).toBeFocused();
    await captureTab.press('ArrowRight');
    await expect(documentTab).toBeFocused();
    await documentTab.press(' ');
    await expect(documentTab).toHaveAttribute('aria-selected', 'true');
    await documentTab.press('End');
    await captureTab.press('Enter');
    await expect(captureTab).toHaveAttribute('aria-selected', 'true');
    await captureTab.press('Home');
    await documentTab.press('Enter');
    await expect(documentTab).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('button', { name: 'Close document' })).toBeVisible();

    await page.reload();
    await page.locator('.rv-tool-btn[title="Captures"]').click();
    tablist = panel.getByRole('tablist', { name: 'Open captures' });
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'Capture-A.md', exact: true })).toHaveAttribute('aria-selected', 'true');

    await tablist.getByRole('tab', { name: 'CAPTURE', exact: true }).click();
    await expect(secondTile).toBeVisible();
    await secondTile.click({ button: 'right' });
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'CAPTURE', exact: true })).toHaveCount(0);
    await expect(tablist.getByRole('tab', { name: 'Capture-A-Second.md', exact: true })).toHaveAttribute('aria-selected', 'true');

    await panel.getByRole('button', { name: 'New capture view' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(3);
    await expect(tablist.getByRole('tab', { name: 'CAPTURE', exact: true })).toHaveAttribute('aria-selected', 'true');
    await tablist.getByRole('tab', { name: 'Capture-A-Second.md', exact: true }).click();
    await panel.getByRole('button', { name: 'Close document' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'CAPTURE', exact: true })).toHaveCount(1);

    await panel.getByRole('button', { name: 'New capture view' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'CAPTURE', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(secondTile).toBeVisible();
    await secondTile.click({ button: 'right' });
    await panel.getByRole('button', { name: 'New capture view' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(3);
    await tablist.getByRole('tab', { name: 'CAPTURE', exact: true }).press('Delete');
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'Capture-A-Second.md', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(tablist.getByRole('tab', { name: 'Capture-A-Second.md', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'New capture view' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(3);
    const inactiveSecondDocument = tablist.getByRole('tab', { name: 'Capture-A-Second.md', exact: true });
    await inactiveSecondDocument.focus();
    await inactiveSecondDocument.press('Delete');
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'CAPTURE', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(tablist.getByRole('tab', { name: 'CAPTURE', exact: true })).toBeFocused();

    await tablist.getByRole('button', { name: 'Close capture view' }).click();
    await expect(panel.getByRole('tablist', { name: 'Open captures' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'New capture view' })).toBeVisible();
    await expect(panel.locator('.rv-content-area')).toBeFocused();

    await panel.getByRole('button', { name: 'Close document' }).click();
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.getByRole('button', { name: 'New capture view' })).toHaveCount(0);
  });

  test('File enters tab mode on selection and keeps its home tab session-only', async ({ page }) => {
    await page.goto('/');
    await page.locator('.rv-tool-btn[title="Files"]').click();

    const panel = page.locator('.rv-panel[data-panel="file-viewer"].active');
    await expect(panel.getByRole('tablist', { name: 'Open files' })).toHaveCount(0);
    await expect(panel.getByRole('tabpanel')).toHaveCount(0);
    await expect(panel.getByText('Select a file to view', { exact: true })).toBeVisible();

    await panel.locator('.rv-file-tree-item', { hasText: 'Tab-A-One' }).click();
    let tablist = panel.getByRole('tablist', { name: 'Open files' });
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab')).toHaveCount(1);
    await expect(panel.getByRole('tabpanel')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Hide file tree' })).toBeVisible();

    await panel.getByRole('button', { name: 'Hide file tree' }).click();
    await panel.getByRole('button', { name: 'New file tab' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'FILES', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByText('Select File', { exact: true })).toBeVisible();
    await expect(panel.locator('.rv-file-tree-sidebar')).toBeVisible();

    await panel.getByRole('button', { name: 'New file tab' }).click();
    await expect(tablist.getByRole('tab', { name: 'FILES', exact: true })).toHaveCount(1);
    await panel.locator('.rv-file-tree-item', { hasText: 'Tab-A-Two' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'FILES', exact: true })).toHaveCount(0);
    await expect(tablist.getByRole('tab', { name: 'Tab-A-Two.md', exact: true })).toHaveAttribute('aria-selected', 'true');

    await panel.getByRole('button', { name: 'New file tab' }).click();
    await tablist.getByRole('tab', { name: 'Tab-A-One.md', exact: true }).click();
    await panel.locator('.rv-file-tree-item', { hasText: 'Tab-A-Two' }).click();
    await expect(tablist.getByRole('tab')).toHaveCount(3);
    await expect(tablist.getByRole('tab', { name: 'FILES', exact: true })).toHaveCount(1);
    await expect(tablist.getByRole('tab', { name: 'Tab-A-Two.md', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(tablist.getByRole('tab')).toHaveText([
      /Tab-A-Two\.md/,
      /Tab-A-One\.md/,
      /FILES/,
    ]);

    const inactiveTab = tablist.getByRole('tab', { name: 'Tab-A-One.md', exact: true });
    const selectedTab = tablist.getByRole('tab', { name: 'Tab-A-Two.md', exact: true });
    const selectedItem = selectedTab.locator('..');
    const addGap = await page.evaluate(() => {
      const items = document.querySelectorAll('.rv-panel[data-panel="file-viewer"].active .rv-view-tab-item');
      const last = items.item(items.length - 1).getBoundingClientRect();
      const add = document.querySelector('.rv-panel[data-panel="file-viewer"].active .rv-view-tab-add')!
        .getBoundingClientRect();
      return add.left - last.right;
    });
    expect(addGap).toBeGreaterThanOrEqual(0);
    expect(addGap).toBeLessThanOrEqual(4);
    await selectedTab.focus();
    await selectedTab.press('ArrowRight');
    await expect(inactiveTab).toBeFocused();
    await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
    await inactiveTab.press('Enter');
    await expect(inactiveTab).toHaveAttribute('aria-selected', 'true');
    await inactiveTab.press('End');
    const homeTab = tablist.getByRole('tab', { name: 'FILES', exact: true });
    await expect(homeTab).toBeFocused();
    await expect(inactiveTab).toHaveAttribute('aria-selected', 'true');
    await homeTab.press('Home');
    await expect(selectedTab).toBeFocused();
    await selectedTab.press(' ');
    await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
    for (const mode of [
      { surface: '#202020', contrast: '#ffffff', foreground: '#45a56b', accent: '#d23d78' },
      { surface: '#e2e2e2', contrast: '#000000', foreground: '#315d86', accent: '#9b2f67' },
    ]) {
      await page.evaluate((tokens) => {
        const root = document.documentElement.style;
        root.setProperty('--panel-chrome-bg', tokens.surface === '#202020' ? '#151515' : '#f5f5f5');
        root.setProperty('--view-tab-rail-bg', tokens.surface);
        root.setProperty('--interactive-contrast-foreground', tokens.contrast);
        root.setProperty('--workspace-foreground-color', tokens.foreground);
        root.setProperty('--workspace-accent-color', tokens.accent);
      }, mode);
      await page.mouse.move(700, 600);
      await page.waitForTimeout(150);
      const foreground = await resolvedColor(page, mode.foreground);
      const contrast = await resolvedColor(page, mode.contrast);
      const accent = await resolvedColor(page, mode.accent);
      const surface = await resolvedColor(page, mode.surface);
      const selected = await resolvedColor(
        page,
        `color-mix(in srgb, ${mode.surface} 84%, ${mode.contrast} 16%)`,
      );
      const hover = await resolvedColor(
        page,
        `color-mix(in srgb, ${mode.surface} 92%, ${mode.contrast} 8%)`,
      );

      await expect(panel.locator('.rv-view-tab-rail')).toHaveCSS('background-color', surface);
      await expect(tablist).toHaveCSS('--interactive-surface-bg', mode.surface);
      await expect(tablist).toHaveCSS('--view-tab-rail-bg', mode.surface);
      await expect(inactiveTab).toHaveCSS('color', foreground);
      await expect(selectedTab).toHaveCSS('color', contrast);
      await expect(selectedItem).toHaveCSS('background-color', selected);
      expect(await selectedItem.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(accent);
      await inactiveTab.hover();
      await page.waitForTimeout(150);
      await expect(inactiveTab).toHaveCSS('background-color', hover);
      await expect(inactiveTab).toHaveCSS('color', contrast);

      for (const className of ['rv-view-tab-close', 'rv-view-tab-add']) {
        const probe = page.locator(`#pressed-${className}`);
        await page.evaluate((name) => {
          const button = document.createElement('button');
          button.id = `pressed-${name}`;
          button.className = name;
          button.style.position = 'fixed';
          button.style.left = '20px';
          button.style.top = '20px';
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
          document.body.append(button);
        }, className);
        const box = await probe.boundingBox();
        if (!box) throw new Error(`missing ${className} pressed-state probe`);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await expect(probe).toHaveCSS('color', contrast);
        await page.mouse.up();
        await probe.evaluate((element) => element.remove());
      }
    }

    await page.reload();
    await page.locator('.rv-tool-btn[title="Files"]').click();
    tablist = panel.getByRole('tablist', { name: 'Open files' });
    await expect(tablist.getByRole('tab')).toHaveCount(2);
    await expect(tablist.getByRole('tab', { name: 'FILES', exact: true })).toHaveCount(0);

    await tablist.getByRole('button', { name: 'Close Tab-A-Two.md' }).click();
    await expect(tablist.getByRole('tab', { name: 'Tab-A-One.md', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(tablist.getByRole('tab', { name: 'Tab-A-One.md', exact: true })).toBeFocused();
    await tablist.getByRole('button', { name: 'Close Tab-A-One.md' }).click();
    await expect(panel.getByRole('tablist', { name: 'Open files' })).toHaveCount(0);
    await expect(panel.getByRole('tabpanel')).toHaveCount(0);
    await expect(panel.getByText('Select a file to view', { exact: true })).toBeVisible();
    await expect(panel.locator('.rv-content-area')).toBeFocused();
  });
});
