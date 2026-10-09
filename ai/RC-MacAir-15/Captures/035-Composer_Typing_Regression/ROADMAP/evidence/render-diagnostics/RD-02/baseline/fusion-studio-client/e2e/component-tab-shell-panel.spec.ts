import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

let harnessBundle: Promise<string> | null = null;

async function buildHarness() {
  if (harnessBundle) return harnessBundle;
  harnessBundle = (async () => {
    const virtualId = 'virtual:component-tab-shell-panel-harness';
    const resolvedId = `\0${virtualId}`;
    const panelPath = path.resolve('src/components/view-tabs/ComponentTabShellPanel.tsx');
    const resolverPath = path.resolve('src/components/view-tabs/componentTabResolver.ts');
    const stripPath = path.resolve('src/components/view-tabs/ViewTabStrip.tsx');
    const domIdsPath = path.resolve('src/components/view-tabs/viewTabDomIds.ts');
    const railCssPath = path.resolve('src/components/view-tabs/ViewTabBar.css');
    const rootErrorPolicyPath = path.resolve('src/reactRootErrorPolicy.ts');
    const source = `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { ComponentTabShellPanel } from ${JSON.stringify(panelPath)};
      import { createFirstPartyComponentResolver } from ${JSON.stringify(resolverPath)};
      import { ViewTabStrip } from ${JSON.stringify(stripPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};
      import { viewTabDomId } from ${JSON.stringify(domIdsPath)};
      import ${JSON.stringify(railCssPath)};

      const evidence = {
        adds: 0, closes: [], addedFocus: [], closeFocus: [], mounts: 0,
        back: [], forward: [],
      };
      let addResult = 'tab-added';
      let options = {
        mode: 'single', body: 'ready', location: 'landing', navigation: 'absent',
        navigationTag: 'initial', closable: true, closeDisabled: false,
      };
      const descriptor = () => ({
        id: 'tab-active',
        label: options.label ?? 'CAPTURE',
        icon: options.icon ?? 'capture',
        iconClassName: 'rv-fixture-view-icon',
        closeLabel: options.closeLabel ?? 'Close CAPTURE',
        closable: options.closable,
        closeDisabled: options.closeDisabled,
      });
      const otherDescriptor = {
        id: 'tab-other', label: 'OTHER', icon: 'draft', closeLabel: 'Close OTHER', closable: true,
      };
      const componentDescriptor = {
        schemaVersion: 1,
        componentTypeId: 'fixture.surface',
        componentInstanceId: 'component-surface',
        input: { title: 'Persistent surface' },
        targetKey: 'target:stable',
      };
      const componentRecord = {
        tabId: 'tab-active',
        content: { kind: 'component', revision: 4, component: componentDescriptor },
      };
      const emptyRecord = { tabId: 'tab-active', content: { kind: 'empty', revision: 0 } };
      const locations = {
        landing: ['Capture Documents and Artifacts'],
        addressed: ['Capture', 'Collection with a deliberately long descriptive name', 'Final document name'],
        empty: ['New Tab'],
      };

      function StatefulSurface() {
        const [count, setCount] = useState(0);
        React.useEffect(() => {
          evidence.mounts += 1;
          return () => { evidence.mounts -= 1; };
        }, []);
        return React.createElement('button', {
          type: 'button',
          onClick: () => setCount((value) => value + 1),
        }, 'Presenter count ' + count);
      }

      const registration = {
        componentTypeId: 'fixture.surface',
        label: 'Fixture surface',
        render: () => React.createElement(StatefulSurface),
      };
      const readyResolver = createFirstPartyComponentResolver([registration]);
      const disabledResolver = createFirstPartyComponentResolver([{ ...registration, disabled: true }]);
      const unknownResolver = createFirstPartyComponentResolver([]);
      function ThrowingPresenter() {
        throw new Error('/Users/private/presenter-stack');
      }
      const throwingResolver = createFirstPartyComponentResolver([{
        ...registration,
        render: () => React.createElement(ThrowingPresenter),
      }]);
      const noIntent = () => {};
      const add = {
        label: 'New fixture tab',
        icon: 'add_box',
        onAdd: () => {
          evidence.adds += 1;
          return addResult;
        },
      };

      function shellModel() {
        const empty = options.body === 'empty' || options.body === 'pending';
        const active = empty
          ? emptyRecord
          : options.body === 'unsupported'
            ? { ...componentRecord, content: { ...componentRecord.content, component: { ...componentDescriptor, schemaVersion: 2 } } }
            : options.body === 'invalid'
              ? { ...componentRecord, content: { ...componentRecord.content, component: { ...componentDescriptor, privateCallback: () => {} } } }
              : componentRecord;
        if (options.mode === 'invalid') {
          return {
            active,
            shell: {
              schemaVersion: 2,
              tabId: 'tab-active',
              presenterId: 'private-provider',
              location: {
                schemaVersion: 1,
                segments: [{ label: 'SECRET LOCATION' }],
                internal: '/Users/private/secret.txt',
              },
            },
          };
        }
        const locationKey = options.location ?? (empty ? 'empty' : 'landing');
        return {
          active,
          shell: {
            schemaVersion: 2,
            tabId: 'tab-active',
            presenterId: empty ? null : 'presenter.fixture',
            location: {
              schemaVersion: 1,
              segments: locations[locationKey].map((label) => ({ label })),
            },
          },
        };
      }

      function navigationModel() {
        if (options.navigation === 'absent') return undefined;
        if (options.navigation === 'accessor') {
          const value = { tabId: 'tab-active', canGoForward: true, goBack: () => {}, goForward: () => {} };
          Object.defineProperty(value, 'canGoBack', { enumerable: true, get: () => true });
          return value;
        }
        const tag = options.navigationTag;
        return {
          tabId: options.navigation === 'stale' ? 'tab-stale' : 'tab-active',
          canGoBack: options.navigation === 'enabled' || options.navigation === 'back-only',
          canGoForward: options.navigation === 'enabled',
          goBack: (tabId) => evidence.back.push([tag, tabId]),
          goForward: (tabId) => evidence.forward.push([tag, tabId]),
        };
      }

      const root = createRoot(document.querySelector('#consumer-root'), reactRootErrorOptions);
      function render() {
        const model = shellModel();
        const single = options.mode === 'single';
        const tabbed = options.mode === 'tabbed';
        const resolver = options.body === 'disabled'
          ? disabledResolver
          : options.body === 'unknown'
            ? unknownResolver
            : options.body === 'throwing'
              ? throwingResolver
              : readyResolver;
        const reservation = options.body === 'pending'
          ? {
              tabId: 'tab-active', operationId: 'operation-pending', expectedRevision: 0,
              launcherId: 'capture', status: 'pending',
            }
          : null;
        root.render(React.createElement(React.Fragment, null,
          single || tabbed ? React.createElement(ViewTabStrip, {
            panelId: 'fixture-panel',
            label: 'Fixture tabs',
            tabs: single ? [descriptor()] : [descriptor(), otherDescriptor],
            activeId: 'tab-active',
            onActivate: noIntent,
            onClose: (tabId) => evidence.closes.push(tabId),
            add,
          }) : null,
          React.createElement('div', {
            className: 'rv-fixture-outer-panel',
            role: 'tabpanel',
            'aria-labelledby': single || tabbed
              ? viewTabDomId('fixture-panel', 'tab-active')
              : undefined,
            'aria-label': options.mode === 'invalid' ? 'Content unavailable' : undefined,
          },           React.createElement(ComponentTabShellPanel, {
            mode: options.mode,
            descriptor: descriptor(),
            shell: model.shell,
            navigation: navigationModel(),
            active: model.active,
            expectedActiveTabId: 'tab-active',
            reservation,
            reservationLabel: reservation ? 'Capture' : undefined,
            resolve: resolver,
            onRetryLauncher: noIntent,
            onCancelLauncher: noIntent,
          }))));
      }

      window.__componentTabShellHarness = {
        set: (next) => { options = { ...options, ...next }; render(); },
        setAddResult: (value) => { addResult = value; },
        evidence: () => JSON.parse(JSON.stringify(evidence)),
      };
      render();
    `;
    const result = await build({
      configFile: false,
      mode: 'production',
      logLevel: 'silent',
      plugins: [{
        name: 'component-tab-shell-panel-harness',
        resolveId(id) { return id === virtualId ? resolvedId : null; },
        load(id) { return id === resolvedId ? source : null; },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: virtualId, output: { format: 'iife', name: 'ComponentTabShellHarness' } },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Component tab shell harness did not build.');
    return chunk.code;
  })();
  return harnessBundle;
}

async function mount(page: Page, options: Record<string, unknown> = {}) {
  await page.setContent(`
    <main id="consumer-root" style="width: 100%; height: 500px; display: flex; flex-direction: column; --panel-chrome-bg: rgb(17, 23, 31)"></main>
  `);
  await page.addScriptTag({ content: await buildHarness() });
  if (Object.keys(options).length > 0) {
    await page.evaluate((next) => window.__componentTabShellHarness.set(next), options);
  }
}

test('single layout renders the universal strip and gives ready, landing, addressed, Empty, loading, and unavailable bodies universal rows', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await mount(page);
  const selectedTab = page.locator('.rv-view-tab-item.is-selected .rv-view-tab');
  await expect(page.getByRole('tablist', { name: 'Fixture tabs' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(selectedTab).toContainText('CAPTURE');
  await expect(page.locator('.rv-view-tab-item.is-selected .rv-view-tab-icon')).toHaveText('capture');
  await expect(page.getByRole('navigation', { name: 'Location: Capture Documents and Artifacts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Presenter count 0' })).toBeVisible();

  await page.evaluate(() => window.__componentTabShellHarness.set({ location: 'addressed' }));
  await expect(page.getByRole('navigation', { name: /Location: Capture > Collection/ })).toBeVisible();

  await page.evaluate(() => window.__componentTabShellHarness.set({ body: 'empty', location: 'empty' }));
  await expect(page.getByRole('heading', { name: 'Add content' })).toHaveCount(0);
  await expect(page.locator('.rv-empty-tab-launcher')).toHaveCount(0);
  await expect(page.locator('.rv-empty-tab-neutral')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Location: New Tab' })).toBeVisible();
  await expect(selectedTab).toContainText('CAPTURE');

  await page.evaluate(() => window.__componentTabShellHarness.set({ body: 'pending' }));
  await expect(page.getByRole('status')).toContainText('Opening Capture');
  await expect(page.getByRole('navigation', { name: 'Location: New Tab' })).toBeVisible();

  for (const body of ['disabled', 'unknown', 'unsupported', 'invalid', 'throwing']) {
    await page.evaluate((value) => window.__componentTabShellHarness.set({ body: value, location: 'addressed' }), body);
    await expect(page.locator('.rv-component-tab-unavailable')).toBeVisible();
    await expect(selectedTab).toContainText('CAPTURE');
    await expect(page.getByRole('navigation', { name: /Location: Capture > Collection/ })).toBeVisible();
    await expect(page.getByText('/Users/private/presenter-stack')).toHaveCount(0);
  }
  expect(consoleErrors).toEqual(['[Fusion Studio] A component error was contained.']);
  expect(consoleErrors.join('\n')).not.toMatch(/private|\/Users\/private|presenter-stack/i);
});

test('tabbed layout keeps the ordinary rail and gives active Empty and component bodies a location row', async ({ page }) => {
  await mount(page, { mode: 'tabbed', body: 'empty', location: 'empty' });
  await expect(page.getByRole('tablist', { name: 'Fixture tabs' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.locator('[class*="rv-component-tab-single-"]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Location: New Tab' })).toBeVisible();
  await expect(page.locator('.rv-empty-tab-neutral')).toBeVisible();

  await page.evaluate(() => window.__componentTabShellHarness.set({ body: 'disabled', location: 'landing' }));
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'disabled');
  await expect(page.getByRole('navigation', { name: 'Location: Capture Documents and Artifacts' })).toBeVisible();

  await page.evaluate(() => window.__componentTabShellHarness.set({ body: 'invalid', location: 'addressed' }));
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByRole('navigation', { name: /Final document name/ })).toBeVisible();
});

test('navigation controls remain stable, disable independently, invoke once, and reject stale capabilities', async ({ page }) => {
  await mount(page, { navigation: 'enabled', navigationTag: 'disabled-check' });
  const back = page.getByRole('button', { name: 'Back' });
  const forward = page.getByRole('button', { name: 'Forward' });
  await back.focus();
  await page.evaluate(() => window.__componentTabShellHarness.set({ navigation: 'disabled' }));
  await expect(back).toBeDisabled();
  await expect(forward).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence())).toMatchObject({
    back: [],
    forward: [],
  });

  await page.evaluate(() => window.__componentTabShellHarness.set({ navigation: 'back-only', navigationTag: 'first' }));
  await expect(back).toBeEnabled();
  await expect(forward).toBeDisabled();
  await back.click();
  await forward.evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence())).toMatchObject({
    back: [['first', 'tab-active']],
    forward: [],
  });

  await page.evaluate(() => window.__componentTabShellHarness.set({ navigation: 'enabled', navigationTag: 'second' }));
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence().forward)).toEqual([
    ['second', 'tab-active'],
  ]);

  for (const navigation of ['stale', 'accessor', 'absent']) {
    await page.evaluate((value) => window.__componentTabShellHarness.set({ navigation: value }), navigation);
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Forward' })).toHaveCount(0);
  }
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence())).toMatchObject({
    back: [['first', 'tab-active']],
    forward: [['second', 'tab-active']],
  });
});

test('semantic breadcrumb preserves full text and final-segment priority without becoming interactive', async ({ page }) => {
  await mount(page, { location: 'addressed', navigation: 'enabled' });
  await page.locator('#consumer-root').evaluate((root: HTMLElement) => { root.style.width = '260px'; });
  const breadcrumb = page.getByRole('navigation', {
    name: 'Location: Capture > Collection with a deliberately long descriptive name > Final document name',
  });
  await expect(breadcrumb).toHaveAttribute(
    'title',
    'Capture > Collection with a deliberately long descriptive name > Final document name',
  );
  await expect(breadcrumb.getByRole('list')).toBeVisible();
  await expect(breadcrumb.getByRole('listitem')).toHaveCount(3);
  await expect(breadcrumb.getByRole('button')).toHaveCount(0);
  await expect(breadcrumb.getByRole('link')).toHaveCount(0);
  const geometry = await page.locator('.rv-component-tab-location-rail').evaluate((rail) => {
    const final = rail.querySelector<HTMLElement>('.rv-component-tab-breadcrumb-segment:last-child');
    const context = rail.querySelector<HTMLElement>('.rv-component-tab-breadcrumb-segment:nth-child(2) .rv-component-tab-breadcrumb-label');
    const railBox = rail.getBoundingClientRect();
    const finalBox = final?.getBoundingClientRect();
    return {
      finalVisible: Boolean(finalBox && finalBox.width > 0 && finalBox.right <= railBox.right + 0.5),
      contextTruncated: Boolean(context && context.scrollWidth > context.clientWidth),
      noHorizontalOverflow: rail.scrollWidth <= rail.clientWidth,
    };
  });
  expect(geometry).toEqual({ finalVisible: true, contextTruncated: true, noHorizontalOverflow: true });
});

test('36/54 shell geometry, backgrounds, row order, and body mount continuity survive single-to-tabbed changes', async ({ page }) => {
  await mount(page, { location: 'addressed' });
  const presenter = page.getByRole('button', { name: 'Presenter count 0' });
  await presenter.click();
  const singleGeometry = await page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>('.rv-view-tab-rail')!;
    const location = document.querySelector<HTMLElement>('.rv-component-tab-location-rail')!;
    const body = document.querySelector<HTMLElement>('.rv-component-tab-shell-body')!;
    return {
      stripHeight: strip.getBoundingClientRect().height,
      locationHeight: location.getBoundingClientRect().height,
      stripBackground: getComputedStyle(strip).backgroundColor,
      locationBackground: getComputedStyle(location).backgroundColor,
      bodyBelowLocation: body.getBoundingClientRect().top >= location.getBoundingClientRect().bottom - 0.5,
    };
  });
  expect(singleGeometry).toEqual({
    stripHeight: 36,
    locationHeight: 54,
    stripBackground: 'rgb(17, 23, 31)',
    locationBackground: 'rgb(17, 23, 31)',
    bodyBelowLocation: true,
  });
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence().mounts)).toBe(1);

  await page.evaluate(() => window.__componentTabShellHarness.set({ mode: 'tabbed' }));
  await expect(page.getByRole('button', { name: 'Presenter count 1' })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.locator('.rv-view-tab-rail')).toHaveCSS('height', '36px');
  await expect(page.locator('.rv-component-tab-location-rail')).toHaveCSS('height', '54px');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence().mounts)).toBe(1);

  await page.evaluate(() => window.__componentTabShellHarness.set({ mode: 'single' }));
  await expect(page.getByRole('button', { name: 'Presenter count 1' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence().mounts)).toBe(1);
});

test('the strip owns single-tab add and close callbacks, disabled state, and accessibility contracts', async ({ page }) => {
  await mount(page);
  const panel = page.getByRole('tabpanel');
  const selectedTab = page.locator('.rv-view-tab-item.is-selected .rv-view-tab');
  await expect(panel).toHaveAttribute('aria-labelledby', await selectedTab.getAttribute('id') ?? '');
  await expect(panel).toHaveAccessibleName('CAPTURE');
  const add = page.locator('.rv-view-tab-add');
  await add.click();
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence())).toMatchObject({
    adds: 1,
  });
  await expect(add).toBeFocused();

  await page.evaluate(() => window.__componentTabShellHarness.setAddResult(null));
  await page.keyboard.press('Enter');
  await expect(add).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence().adds)).toBe(2);

  const close = page.getByRole('button', { name: 'Close CAPTURE' });
  await close.click();
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence())).toMatchObject({
    closes: ['tab-active'],
  });
  await page.evaluate(() => window.__componentTabShellHarness.set({ closeDisabled: true }));
  await expect(page.getByRole('button', { name: 'Close CAPTURE' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close CAPTURE' }).evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => page.evaluate(() => window.__componentTabShellHarness.evidence().closes)).toEqual(['tab-active']);
  await page.evaluate(() => window.__componentTabShellHarness.set({ closable: false, closeDisabled: false }));
  await expect(page.getByRole('button', { name: 'Close CAPTURE' })).toHaveCount(0);
});

test('invalid shell is bounded and portable files contain no private-state imports or stale shell system', async ({ page }) => {
  await mount(page, { mode: 'invalid' });
  await expect(page.locator('.rv-component-tab-shell')).toHaveClass(/rv-component-tab-shell--invalid/);
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByText('Component unavailable')).toBeVisible();
  await expect(page.getByText('SECRET LOCATION')).toHaveCount(0);
  await expect(page.getByText('/Users/private/secret.txt')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.getByRole('navigation')).toHaveCount(0);

  const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), 'utf8');
  const portableFiles = [
    'src/components/view-tabs/TabLocationRail.tsx',
    'src/components/view-tabs/ComponentTabShellPanel.tsx',
  ];
  const portable = portableFiles.map(read).join('\n');
  const css = read('src/components/view-tabs/componentTabShell.css');
  expect(portable).not.toMatch(/zustand|Store|Controller|Service|WebSocket|filesystem|event.?bus|plugin/i);
  expect(portable).not.toMatch(/src\/(state|lib\/ws|services|controllers|plugins)/);
  expect(portable).not.toMatch(/role=["'{]*(tablist|tabpanel)/);
  expect(portable).not.toMatch(/useState|useSyncExternalStore|localStorage|sessionStorage/);
  expect(`${portable}\n${css}`).not.toMatch(/CenteredHome|ContentLocation|centered-home|tabbed-home|tabbed-content|tabbed-empty|rv-centered-home|rv-content-location/i);
  for (const className of css.match(/\.[a-z][\w-]*/g) ?? []) {
    expect(className).toMatch(/^\.rv-/);
  }
  for (const line of css.split('\n').filter((candidate) => /#[0-9a-f]{3,8}/i.test(candidate))) {
    expect(line).toContain('var(');
  }
});

declare global {
  interface Window {
    __componentTabShellHarness: {
      set: (options: Record<string, unknown>) => void;
      setAddResult: (value: string | null) => void;
      evidence: () => {
        adds: number;
        closes: string[];
        addedFocus: string[];
        closeFocus: string[];
        mounts: number;
        back: Array<[string, string]>;
        forward: Array<[string, string]>;
      };
    };
  }
}
