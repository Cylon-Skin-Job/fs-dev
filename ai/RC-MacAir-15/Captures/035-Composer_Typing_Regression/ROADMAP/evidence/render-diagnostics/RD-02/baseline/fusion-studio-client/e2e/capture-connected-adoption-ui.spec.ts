import { expect, test } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
import type { Page } from '@playwright/test';

/**
 * VIEW-02 Slice 3 — Capture production adoption, browser-level proof.
 *
 * The plain dev server runs WITHOUT the Electron bootstrap authority, and the
 * accepted VIEW-01 workspace-exposure machinery keeps browser-fixture boots
 * behind the loading gate (revert-proven pre-existing: with the Slice-2
 * registry restored the failure is identical, so it is not a Slice-3
 * regression). This spec therefore follows the established Slice-2 harness
 * pattern (vite bundle + the REAL ViewTabBar/registry/adapter/owner) to prove
 * the adopted Capture surface in a real browser: fresh init, plus, classic
 * conversion, bounded unavailable, hydration/restart, and TABS-03 placement.
 */

const SHIPPED_TABS = {
  schemaVersion: 1,
  initial: { kind: 'launcher', launcherId: 'capture.home' },
  plus: { enabled: true },
  empty: {
    tabLabel: 'New Capture Tab',
    locationLabel: 'New Capture Tab',
    launcherIds: ['capture.home'],
  },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned Capture new-tab policy (the wire parser requires it).
  newTab: { blankKind: 'home', autoOpenDrawer: false },
};

const CLASSIC_CLEAR = {
  docViewerTabs: [],
  docViewerActiveTabId: null,
  docViewerFullPage: false,
  docViewerMode: 'active',
  docViewerActiveSelectedPath: null,
  docViewerArchiveSelectedPath: null,
  docViewerLastOpenedPath: null,
  docViewerActiveGridScroll: 0,
  docViewerArchiveGridScroll: 0,
  docViewerActiveDocScroll: 0,
  docViewerArchiveDocScroll: 0,
  captureTabRecords: null,
};

const bundles = new Map<string, Promise<string>>();

async function buildHarness(mode: 'test' | 'production', withRuntime = false) {
  const existing = bundles.get(`${mode}:${withRuntime}`);
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:capture-adoption-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const rootErrorPolicyPath = path.resolve('src/reactRootErrorPolicy.ts');
    const panelStorePath = path.resolve('src/state/panelStore.ts');
    const fileDataStorePath = path.resolve('src/state/fileDataStore.ts');
    const policyProjectionPath = path.resolve('src/lib/tab-policy-projection.ts');
    const connectedTabsPath = path.resolve('src/components/view-tabs/captureConnectedTabs.ts');
    const runtimeTransportPath = path.resolve('src/lib/runtime-transport.ts');

    const moduleSource = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ViewTabBar } from ${JSON.stringify(viewTabBarPath)};
      // The REAL registry: Capture flips to the connected adapter when the
      // shipped tabPolicies entry is ready.
      import { useViewTabAdapter } from ${JSON.stringify(path.resolve('src/components/view-tabs/viewTabAdapters.ts'))};
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};
      import { useFileDataStore } from ${JSON.stringify(fileDataStorePath)};
      import { parseTabPolicyProjection } from ${JSON.stringify(policyProjectionPath)};
      import { openCaptureDocument } from ${JSON.stringify(connectedTabsPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};
      ${withRuntime ? `
      // §8 harness option: start the REAL runtime transport against the stubbed
      // window.electronAPI descriptor so document presenters render fully
      // (getPanelFileUrl requires a ready runtime origin).
      import { startRuntimeTransport, getRuntimeTransportSnapshot } from ${JSON.stringify(runtimeTransportPath)};
      void startRuntimeTransport();
      ` : ''}

      const SHIPPED_TABS = ${JSON.stringify(SHIPPED_TABS)};
      const CLASSIC_CLEAR = ${JSON.stringify(CLASSIC_CLEAR)};

      // Same loopback-only fake socket contract as the Node-level spec.
      class FakeAckSocket extends EventTarget {
        constructor() {
          super();
          this.readyState = 1; // OPEN
          this.sent = [];
        }
        send(payload) { this.sent.push(JSON.parse(payload)); }
      }

      let ws = null;
      function seedStore(classicPatch, records) {
        ws = new FakeAckSocket();
        usePanelStore.setState({
          activeWorkspaceId: 'ws-harness',
          ws,
          tabPolicies: parseTabPolicyProjection({
            'capture-viewer': { schemaVersion: 1, status: 'ready', policy: SHIPPED_TABS },
          }),
          panelConfigs: [{
            id: 'capture-viewer',
            name: 'Capture',
            icon: 'note_stack',
          }],
          viewStates: {
            'capture-viewer': { ...CLASSIC_CLEAR, ...classicPatch,
              ...(records ? { captureTabRecords: records } : { captureTabRecords: null }) },
          },
        });
      }

      function mount() {
        const root = createRoot(document.querySelector('#harness-root'), reactRootErrorOptions);
        root.render(React.createElement(
          'section',
          { className: 'rv-panel active', 'data-panel': 'capture-viewer' },
          React.createElement(
            'div',
            { className: 'rv-content-area', tabIndex: -1 },
            React.createElement(ViewTabBar, { panel: 'capture-viewer' },
              React.createElement('div', { 'data-legacy-child': true }, 'Classic child'),
            ),
          ),
        ));
        return root;
      }

      let root = null;
      // Remount = restart: a fresh connected owner runtime hydrates from the
      // SAME panelStore view-state document (the acknowledged owner's store).
      function restart() {
        if (root) root.unmount();
        root = mount();
      }

      globalThis.__captureHarnessController = {
        seed: (classicPatch, records) => seedStore(classicPatch, records),
        restart,
        // VIEW-02 §9 hydration-gate fixture: simulates the cold-start window
        // where the persisted per-view state document has NOT landed yet.
        clearPersisted: () => {
          usePanelStore.setState({ viewStates: {} });
        },
        records: () => JSON.parse(JSON.stringify(
          usePanelStore.getState().viewStates['capture-viewer']?.captureTabRecords ?? null,
        )),
        classic: () => {
          const state = usePanelStore.getState().viewStates['capture-viewer'] ?? {};
          const keys = Object.keys(CLASSIC_CLEAR).filter((key) => key !== 'captureTabRecords');
          const projection = {};
          for (const key of keys) projection[key] = state[key];
          return projection;
        },
        openDocument: (path, name, disposition) => openCaptureDocument({ path, name, disposition }),
        sentFrames: () => JSON.parse(JSON.stringify(ws.sent)),
        rtStatus: () => (typeof getRuntimeTransportSnapshot === 'function'
          ? getRuntimeTransportSnapshot().status
          : 'unavailable'),
      };

      seedStore({}, null);
      root = mount();
    `;

    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode,
      plugins: [{
        name: 'capture-adoption-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === virtualEntry) return resolvedEntry;
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return moduleSource;
          return null;
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'CaptureAdoptionHarness', inlineDynamicImports: true },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Capture adoption harness did not build.');
    return chunk.code;
  })();
  bundles.set(mode, bundle);
  return bundle;
}

async function mountHarness(
  page: Page,
  mode: 'test' | 'production' = 'test',
  options: { withRuntime?: boolean } = {},
) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="harness-root"></div><div id="preview-root"></div></body>');
  if (options.withRuntime) {
    // §8 harness option: a loopback runtime descriptor so the REAL runtime
    // transport reports ready and document presenters render fully.
    await page.evaluate(() => {
      const descriptor = {
        generation: 'harness-runtime-descriptor-0001',
        httpOrigin: 'http://127.0.0.1:3001',
        webSocketUrl: 'ws://127.0.0.1:3001',
      };
      Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        value: {
          getRuntimeDescriptor: async () => descriptor,
          onRuntimeDescriptorChanged: (callback: (candidate: unknown) => void) => {
            window.setTimeout(() => callback(descriptor), 0);
            return () => {};
          },
        },
      });
    });
  }
  await page.addScriptTag({ content: await buildHarness(mode, options.withRuntime === true) });
  return pageErrors;
}

function records(page: Page) {
  return page.evaluate(() => window.__captureHarnessController.records());
}

test.describe.serial('VIEW-02 Slice 3 — Capture production adoption (browser harness)', () => {
  test('fresh init boots one centered CAPTURE home tab; plus on Home is a no-op; Empty tabs present no menu', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="capture-viewer"]');

    // ONE tab: the universal left-aligned strip (the chrome tablist is the
    // rail labeled 'Open captures'), location row present, and the REAL
    // Capture landing content beneath.
    await expect(panel.getByRole('tablist', { name: 'Open captures' })).toHaveCount(1);
    await expect(panel.locator('.rv-view-tab-rail')).toHaveCount(1);
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-icon')).toHaveText('note_stack');
    await expect(panel.getByRole('navigation', { name: 'Location: Capture > Documents and Artifacts' }))
      .toBeVisible();
    await expect(panel.locator('[data-capture-landing]')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'New capture tab' })).toHaveCount(1);

    // The launcher lifecycle committed through the acknowledged owner.
    let state = await records(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.kind).toBe('component');
    expect(state.tabs[0].content.component.targetKey).toBe('capture:home');
    expect(state.reservations).toEqual([]);

    // VIEW-02 §4: + on the Home tab does NOTHING — no menu, no second blank.
    await panel.getByRole('button', { name: 'New capture tab' }).click();
    await expect(panel.getByRole('tablist', { name: 'Open captures' }).getByRole('tab')).toHaveCount(1);
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    state = await records(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.component.targetKey).toBe('capture:home');

    // The acknowledged owner path: the fresh-init commit carried a state:set frame.
    const frames = await page.evaluate(() => window.__captureHarnessController.sentFrames());
    const setStateFrames = frames.filter((frame: { type: string }) => frame.type === 'state:set');
    expect(setStateFrames.length).toBeGreaterThanOrEqual(1);
    for (const frame of setStateFrames) {
      expect(frame.view).toBe('capture-viewer');
      expect(typeof frame.clientMutationId).toBe('number');
      expect(frame.state).toHaveProperty('captureTabRecords');
    }

    // VIEW-02 §6: an Empty tab presents NO launcher menu (fixture-seeded
    // hydrated Empty tab, not plus-created) — the minimal neutral surface
    // only, and Side Chat is nowhere in it.
    await page.evaluate(() => {
      window.__captureHarnessController.seed({}, {
        schemaVersion: 1,
        tabs: [{ tabId: 'cap-empty-1', content: { kind: 'empty', revision: 0 } }],
        activeTabId: 'cap-empty-1',
        reservations: [],
      });
      window.__captureHarnessController.restart();
    });
    await expect(panel.locator('.rv-empty-tab-panel')).toBeVisible();
    await expect(panel.locator('.rv-empty-tab-launcher')).toHaveCount(0);
    await expect(panel.locator('.rv-empty-tab-neutral')).toBeVisible();
    const surfaceText = await panel.locator('.rv-component-tab-panel').innerText();
    expect(surfaceText.toLowerCase()).not.toContain('chat');

    expect(pageErrors).toEqual([]);
  });

  test('classic zero-tab full-page conversion preserves path, mode, and scroll across restart', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    await page.evaluate(() => window.__captureHarnessController.restart());
    const panel = page.locator('[data-panel="capture-viewer"]');

    // Seed the asserted full-page classic state and restart the owner: the
    // one-time conversion produces ONE addressed document tab.
    await page.evaluate(() => {
      window.__captureHarnessController.seed({
        docViewerFullPage: true,
        docViewerActiveSelectedPath: '001-Docs/alpha.md',
        docViewerLastOpenedPath: '001-Docs/alpha.md',
        docViewerActiveDocScroll: 421,
      }, null);
      window.__captureHarnessController.restart();
    });

    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('alpha.md');
    await expect(panel.getByRole('navigation', { name: 'Location: Capture > Docs > alpha.md' })).toBeVisible();

    const state = await records(page);
    expect(state.tabs).toHaveLength(1);
    const content = state.tabs[0].content;
    expect(content.kind).toBe('component');
    expect(content.component.targetKey).toBe('capture:doc:001-Docs/alpha.md');
    expect(content.component.input).toMatchObject({
      path: '001-Docs/alpha.md',
      mode: 'active',
      docScroll: 421,
      lastOpenedPath: '001-Docs/alpha.md',
    });
    // The classic full-page mode was expressed by the connected tab.
    expect(await page.evaluate(() => window.__captureHarnessController.classic())).toMatchObject({
      docViewerFullPage: false,
      docViewerTabs: [],
    });

    // Restart: hydrated generic records win and keep the exact tab identity.
    await page.evaluate(() => window.__captureHarnessController.restart());
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('alpha.md');
    const afterRestart = await records(page);
    expect(afterRestart.tabs[0].tabId).toBe(state.tabs[0].tabId);
    expect(afterRestart.tabs[0].content.component.input).toMatchObject({ docScroll: 421 });

    expect(pageErrors).toEqual([]);
  });

  test('landing/preview conversion preserves the classic projection; default shape uses the initial policy', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="capture-viewer"]');

    await page.evaluate(() => {
      window.__captureHarnessController.seed({
        docViewerMode: 'recent',
        docViewerActiveSelectedPath: '001-Docs/alpha.md',
        docViewerActiveGridScroll: 88,
      }, null);
      window.__captureHarnessController.restart();
    });

    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const state = await records(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.component.targetKey).toBe('capture:home');
    expect(state.tabs[0].content.component.input.classic).toMatchObject({
      mode: 'recent',
      selectedPath: '001-Docs/alpha.md',
      gridScroll: 88,
    });

    // Default shape: initial launcher policy (the fresh-init behavior above).
    await page.evaluate(() => {
      window.__captureHarnessController.seed({}, null);
      window.__captureHarnessController.restart();
    });
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const fresh = await records(page);
    expect(fresh.tabs[0].content.component.targetKey).toBe('capture:home');

    expect(pageErrors).toEqual([]);
  });

  test('asserted full-page state without a valid document is bounded unavailable', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    await page.evaluate(() => {
      window.__captureHarnessController.seed({ docViewerFullPage: true }, null);
      window.__captureHarnessController.restart();
    });
    const panel = page.locator('[data-panel="capture-viewer"]');

    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Unavailable');
    await expect(panel.locator('[data-capture-unavailable]')).toBeVisible();

    const state = await records(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.component.componentTypeId).toBe('capture.unavailable');
    // Never silently reset: the asserted classic state is intact.
    expect(await page.evaluate(() => window.__captureHarnessController.classic()))
      .toMatchObject({ docViewerFullPage: true });

    expect(pageErrors).toEqual([]);
  });

  test('preview opens route through TABS-03: current appends, exact re-open activates, no overwrite', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="capture-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');

    // Current disposition with a populated active tab appends (never overwrites).
    await page.evaluate(() => (
      window.__captureHarnessController.openDocument('001-Docs/alpha.md', 'alpha.md', 'current')
    ));
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('tab').nth(1)).toHaveText(/alpha\.md/);
    await expect(panel.getByRole('navigation', { name: 'Location: Capture > Docs > alpha.md' })).toBeVisible();

    // Exact re-open (new disposition) activates the existing tab: no duplicate.
    await panel.getByRole('tab').nth(0).click();
    await expect(panel.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(panel.locator('[data-capture-landing]')).toBeVisible();
    await page.evaluate(() => (
      window.__captureHarnessController.openDocument('001-Docs/alpha.md', 'alpha.md', 'new')
    ));
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');

    // A different document through `new` appends; the home tab is intact.
    await page.evaluate(() => (
      window.__captureHarnessController.openDocument('001-Docs/beta.md', 'beta.md', 'new')
    ));
    await expect(panel.getByRole('tab')).toHaveCount(3);
    await expect(panel.getByRole('tab').nth(2)).toHaveText(/beta\.md/);
    await panel.getByRole('tab').nth(0).click();
    await expect(panel.locator('[data-capture-landing]')).toBeVisible();

    const state = await records(page);
    expect(state.tabs.map((tab: { content: { kind: string; component?: { targetKey: string } } }) => (
      tab.content.kind === 'component' ? tab.content.component.targetKey : null
    ))).toEqual([
      'capture:home',
      'capture:doc:001-Docs/alpha.md',
      'capture:doc:001-Docs/beta.md',
    ]);

    expect(pageErrors.filter((error) => !error.includes('Fusion runtime is disconnected'))).toEqual([]);
  });

  test('VIEW-02 §8: opening a document in tab B leaves tab A\'s rendered state untouched', async ({ page }) => {
    // The real runtime transport + loopback descriptor stub let the REAL
    // document presenters render (getPanelFileUrl requires a ready origin).
    const pageErrors = await mountHarness(page, 'test', { withRuntime: true });
    const panel = page.locator('[data-panel="capture-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    await page.waitForFunction(() => window.__captureHarnessController.rtStatus() === 'ready');

    // Tab A: open alpha.md through the connected owner (new disposition).
    await page.evaluate(() => (
      window.__captureHarnessController.openDocument('001-Docs/alpha.md', 'alpha.md', 'new')
    ));
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.locator('.rv-capture-document-subheader-title')).toHaveText('alpha.md');
    const collection = await records(page);
    const tabARecord = collection.tabs.find((tab: { content: { component?: { targetKey?: string } } }) => (
      tab.content.component?.targetKey === 'capture:doc:001-Docs/alpha.md'
    ));
    expect(tabARecord).toBeTruthy();
    const tabASnapshot = JSON.parse(JSON.stringify(tabARecord));

    // Tab B: opening beta.md must not mutate tab A's committed record (its own
    // descriptor is the only presenter state) nor the shared classic slot.
    await page.evaluate(() => (
      window.__captureHarnessController.openDocument('001-Docs/beta.md', 'beta.md', 'new')
    ));
    await expect(panel.getByRole('tab')).toHaveCount(3);
    await expect(panel.locator('.rv-capture-document-subheader-title')).toHaveText('beta.md');

    const after = await records(page);
    const tabAAfter = after.tabs.find((tab: { content: { component?: { targetKey?: string } } }) => (
      tab.content.component?.targetKey === 'capture:doc:001-Docs/alpha.md'
    ));
    expect(tabAAfter).toEqual(tabASnapshot);
    expect(await page.evaluate(() => window.__captureHarnessController.classic())).toEqual({
      docViewerTabs: [],
      docViewerActiveTabId: null,
      docViewerFullPage: false,
      docViewerMode: 'active',
      docViewerActiveSelectedPath: null,
      docViewerArchiveSelectedPath: null,
      docViewerLastOpenedPath: null,
      docViewerActiveGridScroll: 0,
      docViewerArchiveGridScroll: 0,
      docViewerActiveDocScroll: 0,
      docViewerArchiveDocScroll: 0,
    });

    // Re-activate tab A: its rendered state derives from its own record.
    await panel.getByRole('tab').nth(1).click();
    await expect(panel.locator('.rv-capture-document-subheader-title')).toHaveText('alpha.md');

    // Source contract: the app-wide active-resource slot is retired — presenters
    // never write a global slot for refresh, and the ws file handlers never
    // read one.
    const fs = await import('node:fs');
    expect(fs.existsSync(path.resolve('src/state/activeResourceStore.ts'))).toBe(false);
    const pageView = fs.readFileSync(path.resolve('src/components/capture/FilePageView.tsx'), 'utf8');
    expect(pageView).not.toContain('activeResource');
    const handlers = fs.readFileSync(path.resolve('src/lib/ws/file-handlers.ts'), 'utf8');
    expect(handlers).not.toContain('activeResource');

    expect(pageErrors.filter((error) => !error.includes('Fusion runtime is disconnected'))).toEqual([]);
  });

  test('preview action plumbing: Open-in-New-Tab is wired to the new disposition', async () => {
    // The live modal surface requires a connected runtime (its iframe/cache
    // helpers assert one), so the preview action wiring is proven at source
    // level in the established source-contract style.
    const fs = await import('node:fs');
    const modal = fs.readFileSync(
      path.resolve('src/components/capture/DocumentPreviewModal.tsx'),
      'utf8',
    );
    const tiles = fs.readFileSync(
      path.resolve('src/components/capture/CaptureTiles.tsx'),
      'utf8',
    );
    const connectedTabs = fs.readFileSync(
      path.resolve('src/components/view-tabs/captureConnectedTabs.ts'),
      'utf8',
    );
    const adapter = fs.readFileSync(
      path.resolve('src/components/view-tabs/captureViewTabAdapter.ts'),
      'utf8',
    );
    expect(modal).toContain('onOpenInNewTab');
    expect(modal).toContain('aria-label={`Open ${file.name} in new tab`}');
    // VIEW-02 §4 consolidation (owner directive §4.1/§4.3): the presenter is
    // dumb — the open/disposition decision lives in the connected layer, and
    // no presenter surface selects a disposition or branches to a fallback.
    expect(connectedTabs).toContain('openCaptureDocument({ ...request, disposition: \'new\' })');
    expect(adapter).toContain('onOpenDocument: openCaptureDocumentFromPresenter');
    expect(tiles).toContain('onOpenInNewTab={() => openDocInNewTab(selected.folder, selected.file)}');
    expect(tiles).toContain('onOpenDocument({ folder, path: file.path, name: file.name })');
    expect(tiles).not.toContain('openCaptureDocument');
    expect(tiles).not.toContain("disposition:");
  });

  test('VIEW-02 §9 hydration gate: no session blank before the persisted state lands; classic tabs convert when it does', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="capture-viewer"]');
    await expect(panel.locator('[data-capture-landing]')).toBeVisible();

    // Cold-start window: the persisted per-view state document has NOT landed.
    // The initial policy must NOT create (or persist) a session blank during
    // this window — that premature blank is what stranded persisted classic
    // tabs (the verified silent live-state reset).
    const setStateFramesBefore = (await page.evaluate(() => (
      window.__captureHarnessController.sentFrames()
    ))).filter((frame: { type: string }) => frame.type === 'state:set').length;
    await page.evaluate(() => window.__captureHarnessController.clearPersisted());
    await page.waitForTimeout(300);
    expect(await records(page)).toBeNull();
    const setStateFramesAfter = (await page.evaluate(() => (
      window.__captureHarnessController.sentFrames()
    ))).filter((frame: { type: string }) => frame.type === 'state:set').length;
    expect(setStateFramesAfter).toBe(setStateFramesBefore);

    // The persisted classic tabs land: they hydrate through the accepted
    // one-time conversion — no stranded tabs, no duplicate blank, no reset.
    await page.evaluate(() => {
      window.__captureHarnessController.seed({
        docViewerTabs: [
          {
            id: 'legacy-doc',
            kind: 'doc',
            path: '001-Captures/alpha.md',
            name: 'alpha.md',
            extension: 'md',
            ui: {
              mode: 'active',
              lastOpenedPath: '001-Captures/alpha.md',
              byMode: {
                active: { selectedPath: '001-Captures/alpha.md', gridScroll: 0, docScroll: 0 },
                archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
              },
            },
          },
          {
            id: 'legacy-home',
            kind: 'capture',
            ui: {
              mode: 'active',
              lastOpenedPath: null,
              byMode: {
                active: { selectedPath: null, gridScroll: 0, docScroll: 0 },
                archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
              },
            },
          },
        ],
        docViewerActiveTabId: 'legacy-home',
      }, null);
      window.__captureHarnessController.restart();
    });
    await expect(panel.getByRole('tablist', { name: 'Open captures' }).getByRole('tab')).toHaveCount(2);
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const state = await records(page);
    expect(state.tabs.map((tab: { content: { kind: string; component?: { targetKey: string } } }) => (
      tab.content.kind === 'component' ? tab.content.component.targetKey : null
    ))).toEqual([
      'capture:doc:001-Captures/alpha.md',
      'capture:home',
    ]);
    expect(await page.evaluate(() => window.__captureHarnessController.classic()))
      .toMatchObject({ docViewerTabs: [], docViewerActiveTabId: null });

    expect(pageErrors).toEqual([]);
  });

  test('harness bundle builds and mounts in production mode without page errors', async ({ page }) => {
    const pageErrors = await mountHarness(page, 'production');
    const panel = page.locator('[data-panel="capture-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    expect(pageErrors).toEqual([]);
  });
});
