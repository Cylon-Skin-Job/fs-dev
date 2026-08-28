import { expect, test } from '@playwright/test';

test('capture tabs move the plus into the shell rail and remain visible over a document', async ({ page }) => {
  test.setTimeout(15_000);
  await page.goto('/');
  await page.locator('.rv-tool-btn[title="Captures"]').click();

  const panel = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  await expect(panel).toBeVisible();

  const existingRail = panel.locator('.rv-view-tab-bar');
  if (await existingRail.count()) {
    await existingRail.locator('.rv-view-tab-close').first().evaluate(
      (button: HTMLButtonElement) => button.click(),
    );
    await expect(existingRail).toHaveCount(0);
  }
  const classicBack = panel.locator('button[title="Back to tiles"]');
  if (await classicBack.count()) await classicBack.click();
  await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();

  const tile = panel.locator('.rv-doc-tile').first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  const fileName = await tile.locator('.rv-doc-tile-name').textContent();
  expect(fileName?.trim()).toBeTruthy();
  await tile.dispatchEvent('contextmenu', { button: 2 });

  const documentView = panel.locator('.rv-file-page-view--capture');
  await expect(documentView.locator('.rv-capture-viewer-chrome')).toBeVisible();
  await expect(documentView.locator('.rv-capture-viewer-file-identity')).toBeVisible();

  const preTabsPlus = panel.locator('.rv-view-layout-controls').getByRole('button', {
    name: 'New capture view',
  });
  await expect(preTabsPlus).toBeVisible();
  await expect(panel.locator('.rv-view-tab-bar')).toHaveCount(0);
  await preTabsPlus.click();

  const rail = panel.locator('.rv-view-tab-bar');
  await expect(rail).toBeVisible();
  await expect(preTabsPlus).toHaveCount(0);
  await expect(rail.getByRole('tab')).toHaveCount(2);
  const captureTab = rail.getByRole('tab').nth(1);
  await expect(captureTab.locator('.rv-view-tab-label')).toHaveText('CAPTURE');
  await expect(captureTab).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(rail.getByRole('button', { name: 'New capture view' })).toBeVisible();

  const docTab = rail.getByRole('tab').first();
  await expect(docTab.locator('.rv-view-tab-label')).not.toHaveText('CAPTURE');
  await docTab.click({ force: true });
  await expect(docTab).toHaveAttribute('aria-selected', 'true');
  await expect(rail).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Close document' })).toBeVisible();
  await expect(documentView.locator('.rv-capture-viewer-chrome')).toHaveCount(0);
  const tabbedSubheader = documentView.locator('.rv-capture-document-subheader.is-tabbed');
  await expect(tabbedSubheader).toBeVisible();
  await expect(tabbedSubheader.locator('.rv-capture-viewer-actions')).toBeVisible();
  const railBox = await rail.boundingBox();
  const subheaderBox = await tabbedSubheader.boundingBox();
  expect(railBox).not.toBeNull();
  expect(subheaderBox).not.toBeNull();
  expect(Math.abs(subheaderBox!.y - (railBox!.y + railBox!.height))).toBeLessThanOrEqual(1);

  // Leave the isolated runtime fixture in classic grid mode.
  await rail.locator('.rv-view-tab-close').first().evaluate(
    (button: HTMLButtonElement) => button.click(),
  );
  await expect(rail).toHaveCount(0);
  await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();
});
