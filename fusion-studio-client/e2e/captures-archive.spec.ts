import { test, expect } from '@playwright/test';

test('Captures Archive uses the flat 999-Archive grid', async ({ page }) => {
  await page.goto('/');
  await page.locator('.rv-tool-btn[title="Captures"]').click();

  const panel = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  await expect(panel).toBeVisible();

  try {
    const openPreviewClose = page.getByRole('button', { name: /^Close .+ preview$/ });
    if (await openPreviewClose.count()) {
      await openPreviewClose.click();
    }

    const backButton = panel.getByRole('button', { name: 'Close document' });
    const gridTitle = panel.locator('.rv-capture-viewer-main-title');
    for (let attempt = 0; attempt < 3 && await gridTitle.count() === 0; attempt += 1) {
      if (await backButton.count()) {
        await backButton.click().catch(() => {});
      }
      await page.waitForTimeout(500);
    }

    await panel.getByRole('tab', { name: 'Home', exact: true }).click();
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.locator('.rv-capture-viewer-archive-grid')).toHaveCount(0);
    await expect(panel.locator('.rv-tile-row-label', { hasText: /archive/i })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Search captures' }).click();
    const searchBox = panel.getByRole('searchbox', { name: 'Search captures' });
    await expect(searchBox).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toHaveCount(0);
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toHaveCount(0);
    await expect(panel.locator('.rv-tile-row').first()).toBeVisible({ timeout: 15000 });

    await searchBox.fill('zzzz-no-match-captures');
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toHaveCount(0);

    await searchBox.press('Enter');
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Search results');
    await expect(panel.getByLabel('Filter by type')).toBeVisible();
    await expect(panel.getByLabel('Filter by modified date')).toBeVisible();
    await expect(panel.getByLabel('Filter by location')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Title only' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Starred only' })).toBeVisible();
    await expect(panel.locator('.rv-capture-viewer-search-grid .rv-doc-tile')).toHaveCount(0);
    await expect(panel.locator('.rv-tile-row-empty')).toContainText('No matches');

    await searchBox.fill('workspace');
    await expect(panel.locator('.rv-tile-row-empty')).toContainText('No matches');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toHaveCount(0);

    await searchBox.press('Enter');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toBeVisible({ timeout: 15000 });
    const searchResultCount = await panel.locator('.rv-capture-viewer-search-grid .rv-doc-tile').count();
    expect(searchResultCount).toBeGreaterThan(0);

    await panel.getByRole('button', { name: 'Dismiss search' }).click();
    await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();

    await panel.getByRole('tab', { name: 'Archive', exact: true }).click();
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Archive');
    await expect(panel.locator('.rv-capture-viewer-archive-grid')).toBeVisible({ timeout: 15000 });
    await expect(panel.locator('.rv-tile-row')).toHaveCount(0);

    const tileCount = await panel.locator('.rv-capture-viewer-archive-grid .rv-doc-tile').count();
    expect(tileCount).toBeGreaterThan(0);
  } finally {
    if (!page.isClosed()) {
      const homeButton = panel.getByRole('tab', { name: 'Home', exact: true });
      if (await homeButton.count()) {
        await homeButton.click().catch(() => {});
      }
    }
  }
});
