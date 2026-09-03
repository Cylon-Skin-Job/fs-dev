import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(process.cwd(), '..');

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function snapshotGeneratedThemes() {
  const aiRoot = path.join(workspaceRoot, 'ai');
  return Object.fromEntries(
    fs.readdirSync(aiRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(aiRoot, entry.name, 'System', 'styles', 'themes.css'))
      .filter((themePath) => fs.existsSync(themePath))
      .map((themePath) => [themePath, fs.readFileSync(themePath, 'utf8')]),
  );
}

async function computed(locator: Locator, property: string) {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

async function mixedColor(page: Page, surface: string, contrast: string, surfaceWeight: number) {
  return page.evaluate(({ surface, contrast, surfaceWeight }) => {
    const probe = document.createElement('div');
    probe.style.color = `color-mix(in srgb, ${surface} ${surfaceWeight}%, ${contrast} ${100 - surfaceWeight}%)`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, { surface, contrast, surfaceWeight });
}

async function cssColor(page: Page, value: string) {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, value);
}

async function computedTokenColor(locator: Locator, token: string) {
  return locator.evaluate((element, token) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${token})`;
    element.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

async function focusWithKeyboard(page: Page, locator: Locator) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Target was not reached through the header keyboard order.');
}

test('publishes one canonical interaction context and matching live-preview ownership', () => {
  const variables = read('src/styles/variables.css');
  const livePreview = read('src/lib/theme/live-preview.ts');
  const appSource = read('src/components/App.tsx');
  const appCss = read('src/components/App.css');
  const selectorCss = read('src/components/AiSourceSelector.css');
  const toolsSource = read('src/components/ToolsPanel.tsx');
  const toolsCss = read('src/components/ToolsPanel.css');
  const titleCss = read('src/components/WorkspaceTitle.css');
  const fusionCss = read('src/components/Fusion/fusion.css');

  expect(variables.match(/\.rv-interaction-context\s*\{/g)).toHaveLength(1);
  expect(variables).toContain('--interactive-contrast-foreground: #ffffff;');
  expect(variables).toContain('--interactive-focus-ring: color-mix(in srgb, var(--interactive-contrast-foreground) 75%, transparent);');
  expect(variables).toContain('--view-tab-rail-bg: var(--panel-chrome-bg);');
  expect(variables).toMatch(/\.rv-interaction-context\s*\{[^}]*--interactive-surface-bg: var\(--panel-chrome-bg, #1a1a1a\);[^}]*--interactive-hover-bg: color-mix\(in srgb, var\(--interactive-surface-bg\) 92%, var\(--interactive-contrast-foreground\) 8%\);[^}]*--interactive-pressed-bg: color-mix\(in srgb, var\(--interactive-surface-bg\) 88%, var\(--interactive-contrast-foreground\) 12%\);[^}]*--interactive-selected-bg: color-mix\(in srgb, var\(--interactive-surface-bg\) 84%, var\(--interactive-contrast-foreground\) 16%\);/s);
  expect(variables.slice(0, variables.indexOf('.rv-interaction-context'))).not.toContain('--interactive-hover-bg');
  expect(livePreview).toContain("'--interactive-contrast-foreground'");
  expect(livePreview).toContain("root.setProperty('--interactive-contrast-foreground', isLight ? '#000000' : '#ffffff')");
  expect(appSource.match(/<header className="rv-header rv-interaction-context">/g)).toHaveLength(3);
  expect(toolsSource.match(/<nav className="[^"]*rv-interaction-context[^"]*"/g)).toHaveLength(2);
  expect(selectorCss).not.toContain('--workspace-accent-color');
  expect(selectorCss).toMatch(/\.rv-ai-source-selector__trigger:hover\s*\{[^}]*background: var\(--interactive-hover-bg,/s);
  expect(selectorCss).toMatch(/\.rv-ai-source-selector__trigger:active\s*\{[^}]*background: var\(--interactive-pressed-bg,/s);
  expect(titleCss).not.toMatch(/\.rv-header-(?:center-title|nav-btn):hover\s*\{[^}]*(?:--theme-primary|--workspace-accent-color)/s);
  expect(toolsCss).toMatch(/\.rv-tool-btn\.active\s*\{[^}]*--workspace-accent-color/s);
  expect(toolsCss).toMatch(/\.rv-tool-btn\.active::before\s*\{[^}]*--workspace-accent-color/s);
  expect(toolsCss).not.toMatch(/\.rv-tool-btn:hover[^}]*--(?:theme-primary|workspace-accent-color)/s);
  expect(appCss).toMatch(/\.rv-connection-status\.connected\s*\{[^}]*--workspace-accent-color/s);
  expect(fusionCss).not.toMatch(/\.rv-fusion-icon-btn\s*\{[^}]*transition:\s*all/s);
});

test('workspace shell derives dark and light states from each mounted surface', async ({ page }) => {
  const generatedThemesBefore = snapshotGeneratedThemes();

  await page.goto('/');
  await expect(page.locator('.rv-header')).toBeVisible();
  await expect(page.locator('.rv-tools-panel')).toBeVisible();

  const header = page.locator('.rv-header');
  const rail = page.locator('.rv-tools-panel');
  const selector = page.locator('.rv-ai-source-selector__trigger');
  const selectorArrow = page.locator('.rv-ai-source-selector__arrow');
  const title = page.locator('.rv-header-center-title');
  const headerNav = page.locator('.rv-header-nav-btn').first();
  const workspaceControls = page.getByRole('button', { name: 'Open workspace controls' });
  const ordinaryRail = page.locator('.rv-tool-btn:not(.active)').first();
  const selectedRail = page.locator('.rv-tool-btn.active').first();
  const connected = page.locator('.rv-connection-status.connected');
  const testDisabledControl = page.locator('.rv-header .rv-fusion-icon-btn').first();
  const originalRootStyle = await page.locator('html').getAttribute('style');
  const originalRailStyle = await rail.getAttribute('style');
  const disabledInitially = await testDisabledControl.isDisabled();

  try {
    await expect(selector).toBeVisible();
    await expect(title).toBeVisible();
    await expect(headerNav).toBeVisible();
    await expect(workspaceControls).toBeVisible();
    await expect(ordinaryRail).toBeVisible();
    await expect(selectedRail).toBeVisible();
    await expect(connected).toBeVisible();

    for (const mode of [
      { surface: '#202020', contrast: '#ffffff', foreground: '#45a56b', accent: '#d23d78' },
      { surface: '#e2e2e2', contrast: '#000000', foreground: '#315d86', accent: '#9b2f67' },
    ]) {
      await page.evaluate((tokens) => {
        const root = document.documentElement.style;
        root.setProperty('--panel-chrome-bg', tokens.surface);
        root.setProperty('--interactive-contrast-foreground', tokens.contrast);
        root.setProperty('--workspace-foreground-color', tokens.foreground);
        root.setProperty('--workspace-accent-color', tokens.accent);
      }, mode);
      await page.mouse.move(600, 500);
      await page.waitForTimeout(220);

      const foreground = await cssColor(page, mode.foreground);
      const accent = await cssColor(page, mode.accent);
      const contrast = await cssColor(page, mode.contrast);
      const hover = await mixedColor(page, mode.surface, mode.contrast, 92);
      const pressed = await mixedColor(page, mode.surface, mode.contrast, 88);
      const focusRing = await mixedColor(page, 'transparent', mode.contrast, 25);

      expect((await computed(header, '--interactive-surface-bg')).trim()).toBe(mode.surface);
      expect((await computed(rail, '--interactive-surface-bg')).trim()).toBe(mode.surface);
      expect((await computed(selector, 'color')).trim()).toBe(foreground);
      expect((await computed(selectorArrow, 'color')).trim()).toBe(foreground);
      expect((await computed(title, 'color')).trim()).toBe(foreground);
      expect((await computed(headerNav, 'color')).trim()).toBe(foreground);
      expect((await computed(workspaceControls, 'color')).trim()).toBe(foreground);
      expect((await computed(ordinaryRail, 'color')).trim()).toBe(foreground);
      expect((await computed(selectedRail, 'color')).trim()).toBe(accent);
      expect((await computed(selectedRail, '--interactive-selected-bg')).trim()).toContain('84%');
      expect((await computed(connected, 'color')).trim()).toBe(accent);

      await selector.hover();
      expect((await computed(selector, 'background-color')).trim()).toBe(hover);
      expect((await computed(selector, 'color')).trim()).toBe(contrast);
      expect((await computed(selectorArrow, 'color')).trim()).toBe(contrast);
      expect((await computedTokenColor(selector, '--interactive-pressed-bg')).trim()).toBe(pressed);

      await title.hover();
      await page.waitForTimeout(160);
      expect((await computed(title, 'background-color')).trim()).toBe(hover);
      expect((await computed(title, 'color')).trim()).toBe(contrast);
      await page.evaluate(() => {
        window.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        }, { capture: true, once: true });
      });
      await page.mouse.down();
      await page.waitForTimeout(160);
      expect((await computed(title, 'background-color')).trim()).toBe(pressed);
      await page.mouse.up();

      await headerNav.hover();
      await page.waitForTimeout(160);
      expect((await computed(headerNav, 'background-color')).trim()).toBe('rgba(0, 0, 0, 0)');
      expect((await computed(headerNav, 'color')).trim()).toBe(contrast);

      await workspaceControls.hover();
      await page.waitForTimeout(220);
      expect((await computed(workspaceControls, 'background-color')).trim()).toBe('rgba(0, 0, 0, 0)');
      expect((await computed(workspaceControls, 'color')).trim()).toBe(contrast);
      await focusWithKeyboard(page, workspaceControls);
      expect((await computed(workspaceControls, 'outline-color')).trim()).toBe(focusRing);

      await ordinaryRail.hover();
      expect((await computed(ordinaryRail, 'background-color')).trim()).toBe('rgba(0, 0, 0, 0)');
      expect((await computed(ordinaryRail, 'color')).trim()).toBe(contrast);

      await selector.focus();
      expect((await computed(selector, 'outline-color')).trim()).toBe(focusRing);
      expect((await computed(selector, 'outline-style')).trim()).toBe('solid');

      if (!disabledInitially) {
        await testDisabledControl.evaluate((element) => { (element as HTMLButtonElement).disabled = true; });
      }
      await testDisabledControl.hover({ force: true });
      await page.waitForTimeout(220);
      expect((await computed(testDisabledControl, 'background-color')).trim()).toBe('rgba(0, 0, 0, 0)');
      expect((await computed(testDisabledControl, 'color')).trim()).toBe(foreground);
      if (!disabledInitially) {
        await testDisabledControl.evaluate((element) => { (element as HTMLButtonElement).disabled = false; });
      }

      const accentBeforeForegroundMove = await computed(selectedRail, 'color');
      await page.evaluate(() => document.documentElement.style.setProperty('--workspace-foreground-color', '#7345c2'));
      await page.mouse.move(600, 500);
      await page.waitForTimeout(220);
      expect((await computed(selector, 'color')).trim()).toBe('rgb(115, 69, 194)');
      expect((await computed(title, 'color')).trim()).toBe('rgb(115, 69, 194)');
      expect((await computed(ordinaryRail, 'color')).trim()).toBe('rgb(115, 69, 194)');
      expect(await computed(selectedRail, 'color')).toBe(accentBeforeForegroundMove);

      await page.evaluate(() => document.documentElement.style.setProperty('--workspace-accent-color', '#168caa'));
      expect((await computed(selectedRail, 'color')).trim()).toBe('rgb(22, 140, 170)');
      expect((await computed(selectedRail, 'background-color')).trim()).toBe('rgba(0, 0, 0, 0)');
      expect((await selectedRail.evaluate((element) => getComputedStyle(element, '::before').backgroundColor)).trim()).toBe('rgb(22, 140, 170)');
      expect((await computed(connected, 'color')).trim()).toBe('rgb(22, 140, 170)');
      expect((await connected.evaluate((element) => getComputedStyle(element, '::before').backgroundColor)).trim()).toBe('rgb(22, 140, 170)');
      expect((await computed(selector, 'color')).trim()).toBe('rgb(115, 69, 194)');
    }

    const workspaceControlsBox = await workspaceControls.boundingBox();
    const railBox = await ordinaryRail.boundingBox();
    expect(workspaceControlsBox).toMatchObject({ width: 32, height: 32 });
    expect(railBox).toMatchObject({ width: 40, height: 40 });
    expect(await computed(workspaceControls.locator('.material-symbols-outlined'), 'font-size')).toBe('18px');
    expect(await computed(ordinaryRail.locator('.material-symbols-outlined'), 'font-size')).toBe('24px');
    expect(await computed(page.locator('.rv-header-right'), 'gap')).toBe('4px');
    expect(Math.round((await page.evaluate(() => innerWidth)) - (workspaceControlsBox?.x ?? 0) - (workspaceControlsBox?.width ?? 0))).toBe(8);

    await rail.evaluate((element) => element.style.setProperty('--interactive-surface-bg', '#404040'));
    expect((await computed(rail, '--interactive-surface-bg')).trim()).toBe('#404040');
    expect((await computed(rail, '--interactive-hover-bg')).trim()).toContain('#404040');
    await ordinaryRail.hover();
    expect((await computed(ordinaryRail, 'color')).trim()).toBe('rgb(0, 0, 0)');
  } finally {
    await page.locator('html').evaluate((element, style) => {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }, originalRootStyle);
    await rail.evaluate((element, style) => {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    }, originalRailStyle);
    if (!disabledInitially) {
      await testDisabledControl.evaluate((element) => { (element as HTMLButtonElement).disabled = false; });
    }
  }

  expect(snapshotGeneratedThemes()).toEqual(generatedThemesBefore);
});
