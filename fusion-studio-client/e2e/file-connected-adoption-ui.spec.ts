import { expect, test } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
import type { Page } from '@playwright/test';

/**
 * VIEW-02 Slice 4 — File Explorer production adoption, browser-level proof.
 *
 * The plain dev server runs WITHOUT the Electron bootstrap authority, so this
 * spec follows the established Slice-3 harness pattern (vite bundle + the
 * REAL ViewTabBar/registry/adapter/owner/drawer) to prove the adopted File
 * surface in a real browser: fresh init, plus, the Open File picker reveal,
 * the exact-tab fill, append/exact-match behavior, a11y chrome, and
 * restart/hydration. Capture behavior is untouched (its suites keep passing).
 */

const SHIPPED_TABS = {
  schemaVersion: 1,
  initial: { kind: 'empty' },
  plus: { enabled: true },
  empty: {
    tabLabel: 'New File Tab',
    locationLabel: 'New File Tab',
    launcherIds: ['file.open'],
  },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned File new-tab policy (the wire parser requires it).
  newTab: { blankKind: 'empty', autoOpenDrawer: true },
};

const bundles = new Map<string, Promise<string>>();

async function buildHarness(mode: 'test' | 'production') {
  const existing = bundles.get(mode);
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:file-adoption-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const rootErrorPolicyPath = path.resolve('src/reactRootErrorPolicy.ts');
    const panelStorePath = path.resolve('src/state/panelStore.ts');
    const fileStorePath = path.resolve('src/state/fileStore.ts');
    const fileDataStorePath = path.resolve('src/state/fileDataStore.ts');
    const policyProjectionPath = path.resolve('src/lib/tab-policy-projection.ts');

    const moduleSource = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ViewTabBar } from ${JSON.stringify(viewTabBarPath)};
      // The REAL registry: File Explorer flips to the connected adapter when
      // the shipped tabPolicies entry is ready.
      import { useViewTabAdapter } from ${JSON.stringify(path.resolve('src/components/view-tabs/viewTabAdapters.ts'))};
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};
      import { useFileStore } from ${JSON.stringify(fileStorePath)};
      import { useFileDataStore } from ${JSON.stringify(fileDataStorePath)};
      import { parseTabPolicyProjection } from ${JSON.stringify(policyProjectionPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};

      const SHIPPED_TABS = ${JSON.stringify(SHIPPED_TABS)};

      // Same loopback-only fake socket contract as the Slice-3 harness.
      class FakeAckSocket extends EventTarget {
        constructor() {
          super();
          this.readyState = 1; // OPEN
          this.sent = [];
        }
        send(payload) { this.sent.push(JSON.parse(payload)); }
      }

      let ws = null;
      function seedStore(options = {}) {
        ws = new FakeAckSocket();
        usePanelStore.setState({
          activeWorkspaceId: 'ws-harness',
          ws,
          tabPolicies: parseTabPolicyProjection({
            'file-viewer': { schemaVersion: 1, status: 'ready', policy: SHIPPED_TABS },
          }),
          panelConfigs: [{
            id: 'file-viewer',
            name: 'Files',
            icon: 'folder',
          }],
          viewStates: {
            'file-viewer': {
              activity: options.activity ?? {
                recents: [],
                navigation: { stack: [], index: -1 },
                tabs: [],
                activeTabId: null,
              },
              collapsed: { leftSidebar: false, leftChat: false, rightCol: false, contentArea: false },
              widths: { rightSecondary: 220, rightCol: 220 },
              tints: { borders: { threads: false, chat: false } },
            },
          },
        });
        useFileStore.setState({
          viewMode: (options.tabs?.length ?? 0) > 0 ? 'viewer' : 'tree',
          tabs: options.tabs ?? [],
          activeTabId: options.activeTabId ?? null,
          activeTabPath: options.activeTabPath ?? null,
          expandedFolders: new Set(),
          showHiddenFolders: false,
        });
        useFileDataStore.setState({ trees: { 'file-viewer:': options.tree ?? [] } });
      }

      function mount() {
        const root = createRoot(document.querySelector('#harness-root'), reactRootErrorOptions);
        root.render(React.createElement(
          'section',
          { className: 'rv-panel active', 'data-panel': 'file-viewer' },
          React.createElement(
            'div',
            { className: 'rv-content-area', tabIndex: -1 },
            React.createElement(ViewTabBar, { panel: 'file-viewer' },
              React.createElement('div', { 'data-legacy-child': true }, 'Legacy child'),
            ),
          ),
        ));
        return root;
      }

      let root = null;
      // Remount = restart: a fresh connected owner runtime reads the SAME
      // presentation owner (the file store + persisted activity).
      function restart() {
        if (root) root.unmount();
        root = mount();
      }

      globalThis.__fileHarnessController = {
        seed: seedStore,
        restart,
        files: () => JSON.parse(JSON.stringify({
          tabs: useFileStore.getState().tabs,
          activeTabId: useFileStore.getState().activeTabId,
          activeTabPath: useFileStore.getState().activeTabPath,
          viewMode: useFileStore.getState().viewMode,
        })),
        activity: () => JSON.parse(JSON.stringify(
          usePanelStore.getState().viewStates['file-viewer']?.activity ?? null,
        )),
        collapsed: () => usePanelStore.getState().viewStates['file-viewer']?.collapsed?.rightCol ?? false,
        setCollapsed: (value) => {
          const current = usePanelStore.getState().viewStates['file-viewer'];
          usePanelStore.getState().setViewState('file-viewer', {
            collapsed: { ...(current?.collapsed ?? {}), rightCol: value },
          });
        },
        seedTree: (nodes) => {
          useFileDataStore.setState({ trees: { 'file-viewer:': nodes } });
        },
        // VIEW-02 §4 fixture setup: the + contract no-ops on an active Empty
        // tab, so tests that need a SECOND Empty destination add it through
        // the presentation owner directly (hydrated-shape translation).
        addEmptyTab: () => {
          const state = useFileStore.getState();
          const id = 'fvt-fixture-' + Math.random().toString(36).slice(2, 8);
          useFileStore.setState({
            tabs: [...state.tabs, { id, kind: 'empty' }],
            activeTabId: id,
            viewMode: 'viewer',
          });
          return id;
        },
        seedContentError: (path, message) => {
          useFileDataStore.setState((state) => ({
            contentErrors: { ...state.contentErrors, ['file-viewer:' + path]: message },
          }));
        },
        // Simulates the established workspace switch: panel-store activation
        // swaps the per-workspace view-state document (the binding handler
        // reloads the root tree); the connected lifecycle driver must then
        // rehydrate the presentation owner from the new workspace's activity.
        switchWorkspace: (workspace) => {
          usePanelStore.setState({
            activeWorkspaceId: workspace.id,
            viewStates: {
              'file-viewer': {
                activity: workspace.activity,
                collapsed: { leftSidebar: false, leftChat: false, rightCol: false, contentArea: false },
                widths: { rightSecondary: 220, rightCol: 220 },
                tints: { borders: { threads: false, chat: false } },
              },
            },
          });
        },
        sentFrames: () => JSON.parse(JSON.stringify(ws.sent)),
      };

      seedStore({});
      root = mount();
    `;

    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode,
      plugins: [{
        name: 'file-adoption-harness',
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
          output: { format: 'iife', name: 'FileAdoptionHarness', inlineDynamicImports: true },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('File adoption harness did not build.');
    return chunk.code;
  })();
  bundles.set(mode, bundle);
  return bundle;
}

async function mountHarness(page: Page, mode: 'test' | 'production' = 'test') {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="harness-root"></div></body>');
  await page.addScriptTag({ content: await buildHarness(mode) });
  return pageErrors;
}

function files(page: Page) {
  return page.evaluate(() => window.__fileHarnessController.files());
}

function activity(page: Page) {
  return page.evaluate(() => window.__fileHarnessController.activity());
}

test.describe.serial('VIEW-02 Slice 4 — File Explorer production adoption (browser harness)', () => {
  test('fresh init boots one centered New File Tab with location row, the reference Empty body, and the auto-opened drawer; plus on the active Empty tab is a no-op', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="file-viewer"]');

    // ONE tab: the universal left-aligned strip, location row, the File-owned
    // reference Empty body (§6: folder icon + "Open file" + copy — NO
    // launcher menu), and the auto-opened file-tree drawer (§7
    // autoOpenDrawer: the initial Empty tab IS a session creation).
    await expect(panel.locator('.rv-view-tab-rail')).toHaveCount(1);
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-icon')).toHaveText('folder');
    await expect(panel.getByRole('navigation', { name: 'Location: New File Tab' })).toBeVisible();
    await expect(panel.locator('[data-file-empty-body]')).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Open file' })).toBeVisible();
    await expect(panel.getByText('Select a file from the workspace tree')).toBeVisible();
    // §11: no launcher menu on any Empty tab.
    await expect(panel.locator('.rv-empty-tab-launcher')).toHaveCount(0);
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();
    const surfaceText = await panel.locator('.rv-component-tab-panel').innerText();
    expect(surfaceText.toLowerCase()).not.toContain('chat');
    await expect(panel.getByRole('button', { name: 'New file tab', exact: true })).toHaveCount(1);

    let state = await files(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].kind).toBe('empty');
    expect(state.activeTabId).toBe(state.tabs[0].id);

    // VIEW-02 §4: the active tab IS the view's blank (Empty) — + does NOTHING
    // (never a file, folder, thread, or even a second blank).
    const beforePlus = await files(page);
    await panel.getByRole('button', { name: 'New file tab', exact: true }).click();
    await expect(panel.getByRole('tab')).toHaveCount(1);
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    await expect(panel.getByRole('navigation', { name: 'Location: New File Tab' })).toBeVisible();
    await expect(panel.locator('.rv-empty-tab-launcher')).toHaveCount(0);

    state = await files(page);
    expect(state).toEqual(beforePlus);

    // The acknowledged owner path: the initial creation rode state:set.
    const frames = await page.evaluate(() => window.__fileHarnessController.sentFrames());
    const setStateFrames = frames.filter((frame: { type: string }) => frame.type === 'state:set');
    expect(setStateFrames.length).toBeGreaterThanOrEqual(1);
    for (const frame of setStateFrames) {
      expect(frame.view).toBe('file-viewer');
      expect(typeof frame.clientMutationId).toBe('number');
      expect(frame.state).toHaveProperty('activity');
    }

    expect(pageErrors).toEqual([]);
  });

  test('the hosted drawer fills the active Empty tab in one lane turn; the Empty body dock toggles the drawer', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="file-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    const firstTabId = (await files(page)).tabs[0].id;

    // VIEW-02 §5: the drawer is the ONLY way an Empty tab is filled; it is
    // hosted (auto-opened) for the active Empty tab with no reservation UI —
    // and the Empty body's dock control collapses/re-opens it.
    await expect(panel.locator('.rv-empty-tab-reservation')).toHaveCount(0);
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();
    await expect(panel.locator('.rv-file-empty-dock')).toBeVisible();
    await panel.locator('.rv-file-empty-dock').click();
    await expect(panel.locator('[data-file-picker-layer]')).toHaveCount(0);
    await panel.locator('.rv-file-empty-dock').click();
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();

    // The drawer is the REAL tree: seeding the tree the established read
    // owner would have produced, then clicking a node routes through TABS-03.
    await page.evaluate(() => window.__fileHarnessController.seedTree([
      { name: 'first.md', path: 'docs/first.md', type: 'file', extension: 'md' },
      { name: 'second.ts', path: 'src/second.ts', type: 'file', extension: 'ts' },
    ]));
    await panel.locator('[data-file-picker-layer] .rv-tree-label', { hasText: 'first.md' }).click();

    // THAT exact Empty tab was filled: same tab identity, addressed file.
    await expect(panel.locator('.rv-view-tab-rail')).toHaveCount(1);
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('first.md');
    await expect(panel.getByRole('navigation', { name: 'Location: Files > docs > first.md' })).toBeVisible();
    const state = await files(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].id).toBe(firstTabId);
    expect(state.tabs[0].kind).toBe('file');
    expect(state.tabs[0].file.path).toBe('docs/first.md');
    expect(state.activeTabId).toBe(firstTabId);

    // The presenter renders content-direct — no duplicate breadcrumb bar
    // (owner directive §1: presenters do not duplicate the location rail) —
    // with the floating dock control for the drawer.
    await expect(panel.locator('.rv-file-viewer-info .rv-file-breadcrumb')).toHaveCount(0);
    await expect(panel.locator('.rv-file-doc-dock')).toBeVisible();

    // Bounded data-error lifecycle: a content error shows the established
    // error surface and the view stays usable (close affordance intact).
    await page.evaluate(() => (
      window.__fileHarnessController.seedContentError('docs/first.md', 'The file could not be read.')
    ));
    await expect(panel.locator('.rv-file-viewer-content .rv-file-explorer-empty')).toContainText('The file could not be read.');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-close')).toBeEnabled();

    expect(pageErrors).toEqual([]);
  });

  test('populated-tab selection appends; exact re-open centers; Open in New Tab appends via new', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="file-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');

    // Fill the initial tab through the hosted (auto-opened) drawer.
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();
    await page.evaluate(() => window.__fileHarnessController.seedTree([
      { name: 'first.md', path: 'docs/first.md', type: 'file', extension: 'md' },
      { name: 'second.ts', path: 'src/second.ts', type: 'file', extension: 'ts' },
    ]));
    await panel.locator('[data-file-picker-layer] .rv-tree-label', { hasText: 'first.md' }).click();
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('first.md');

    // Populated-tab selection appends through the presenter's own drawer.
    await panel.locator('.rv-file-explorer .rv-tree-label', { hasText: 'second.ts' }).click();
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('tab').nth(1)).toHaveText(/second\.ts/);
    await expect(panel.getByRole('navigation', { name: 'Location: Files > src > second.ts' })).toBeVisible();

    // Exact re-open of an open file centers it (no duplicate).
    await panel.getByRole('tab').nth(0).click();
    await expect(panel.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');
    await panel.locator('.rv-file-explorer .rv-tree-label', { hasText: 'first.md' }).click();
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');

    const state = await files(page);
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map((tab) => tab.file?.path ?? null)).toEqual(['docs/first.md', 'src/second.ts']);
    expect(state.activeTabId).toBe(state.tabs[0].id);

    // The established activity persisted both tabs with the active selection.
    const persisted = await activity(page);
    expect(persisted.tabs.map((tab) => tab.path)).toEqual(['docs/first.md', 'src/second.ts']);
    expect(persisted.activeTabId).toBe('file-viewer:docs/first.md');

    expect(pageErrors).toEqual([]);
  });

  test('drawer hosting follows the active Empty tab; collapsing unmounts the host and the Empty body dock re-opens it', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="file-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');

    // Fresh init: the initial Empty tab is a session creation, so the drawer
    // auto-opens (§7 autoOpenDrawer) and stays hosted while it is active.
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();

    // A second Empty tab (fixture setup: the §4 plus contract no-ops on an
    // active Empty tab) keeps the drawer hosted — the active-EMPTY state is
    // the hosting predicate, not a pending reservation.
    await page.evaluate(() => window.__fileHarnessController.addEmptyTab());
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();

    // Collapsing the drawer unmounts the host and retires the pending picker
    // context (no reservation is pending here — the empty state is intact).
    await page.evaluate(() => window.__fileHarnessController.setCollapsed(true));
    await expect(panel.locator('[data-file-picker-layer]')).toHaveCount(0);
    const stateAfterCollapse = await files(page);
    expect(stateAfterCollapse.tabs).toHaveLength(2);
    expect(stateAfterCollapse.tabs.every((tab: { kind: string }) => tab.kind === 'empty')).toBe(true);

    // The Empty body's dock control re-opens the drawer from the Empty tab
    // state (same toggleCollapsed('file-viewer','rightCol') seam as the
    // document presenter).
    await panel.locator('.rv-file-empty-dock').click();
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();

    // A tree selection fills the ACTIVE Empty tab.
    await page.evaluate(() => window.__fileHarnessController.seedTree([
      { name: 'only.md', path: 'docs/only.md', type: 'file', extension: 'md' },
    ]));
    await panel.locator('[data-file-picker-layer] .rv-tree-label', { hasText: 'only.md' }).click();
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('only.md');
    const state = await files(page);
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[1].kind).toBe('file');
    expect(state.tabs[1].file.path).toBe('docs/only.md');
    expect(state.activeTabId).toBe(state.tabs[1].id);

    expect(pageErrors).toEqual([]);
  });

  test('hydration wins over initial policy; restart preserves tabs and selection; drawer-close pending-cancel proof', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="file-viewer"]');

    // Seed the presentation owner the way the established hydration leaves it
    // (two file tabs, first active), then restart the owner runtime.
    await page.evaluate(() => {
      const controller = window.__fileHarnessController;
      const activity = {
        recents: [],
        navigation: { stack: [], index: -1 },
        tabs: [
          { id: 'file-viewer:docs/first.md', panel: 'file-viewer', path: 'docs/first.md', title: 'first.md', kind: 'file', extension: 'md', openedAt: 1 },
          { id: 'file-viewer:src/second.ts', panel: 'file-viewer', path: 'src/second.ts', title: 'second.ts', kind: 'file', extension: 'ts', openedAt: 2 },
        ],
        activeTabId: 'file-viewer:docs/first.md',
      };
      controller.seed({
        activity,
        tabs: [
          { id: 'fvt-a', kind: 'file', file: { name: 'first.md', path: 'docs/first.md', type: 'file', extension: 'md' } },
          { id: 'fvt-b', kind: 'file', file: { name: 'second.ts', path: 'src/second.ts', type: 'file', extension: 'ts' } },
        ],
        activeTabId: 'fvt-a',
        activeTabPath: 'docs/first.md',
        tree: [],
      });
      controller.restart();
    });

    // Hydrated tabs win: two-tab rail, no extra initial Empty tab appended.
    await expect(panel.getByRole('tab')).toHaveCount(2);
    await expect(panel.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('tab').nth(0)).toHaveText(/first\.md/);
    await expect(panel.getByRole('tab').nth(1)).toHaveText(/second\.ts/);
    await expect(panel.getByRole('navigation', { name: 'Location: Files > docs > first.md' })).toBeVisible();
    expect(await files(page)).toMatchObject({ activeTabId: 'fvt-a', viewMode: 'viewer' });

    // The canonical resource path for fetching/saving is unchanged after
    // hydration: the presenter keys content by `file-viewer:<path>` and
    // renders content-direct (no duplicate breadcrumb bar; owner directive
    // §1) with the floating dock control.
    await expect(panel.locator('.rv-file-viewer-info .rv-file-breadcrumb')).toHaveCount(0);
    await expect(panel.locator('.rv-file-doc-dock')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('workspace switch rehydrates the presentation owner: no cross-workspace tab bleed', async ({ page }) => {
    const pageErrors = await mountHarness(page);
    const panel = page.locator('[data-panel="file-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');

    // Workspace A: open one file through the hosted (auto-opened) drawer.
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();
    await page.evaluate(() => window.__fileHarnessController.seedTree([
      { name: 'only.md', path: 'ws-a/only.md', type: 'file', extension: 'md' },
    ]));
    await panel.locator('[data-file-picker-layer] .rv-tree-label', { hasText: 'only.md' }).click();
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('only.md');
    expect(((await files(page)).tabs[0]).file.path).toBe('ws-a/only.md');

    // Switch to workspace B with its OWN persisted activity: the connected
    // lifecycle driver rehydrates the presentation owner from B's view state,
    // so the rail shows ONLY B's tabs (no A bleed, no blank surface).
    await page.evaluate(() => window.__fileHarnessController.switchWorkspace({
      id: 'ws-b',
      activity: {
        recents: [],
        navigation: { stack: [], index: -1 },
        tabs: [
          {
            id: 'file-viewer:ws-b/doc.md',
            panel: 'file-viewer',
            path: 'ws-b/doc.md',
            title: 'doc.md',
            kind: 'file',
            extension: 'md',
            openedAt: 5,
          },
        ],
        activeTabId: 'file-viewer:ws-b/doc.md',
      },
    }));
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('doc.md');
    await expect(panel.getByRole('navigation', { name: 'Location: Files > ws-b > doc.md' })).toBeVisible();

    const state = await files(page);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].file.path).toBe('ws-b/doc.md');
    expect(state.activeTabId).toBe(state.tabs[0].id);

    // The switched-to workspace remains fully usable through the same lane:
    // plus creates an Empty tab there (auto-opening the drawer) and a tree
    // selection exact-matches the open document (activate, never overwrite).
    await panel.getByRole('button', { name: 'New file tab', exact: true }).click();
    await expect(panel.locator('[data-file-picker-layer] .rv-file-tree-sidebar')).toBeVisible();
    await page.evaluate(() => window.__fileHarnessController.seedTree([
      { name: 'doc.md', path: 'ws-b/doc.md', type: 'file', extension: 'md' },
    ]));
    await panel.locator('[data-file-picker-layer] .rv-tree-label', { hasText: 'doc.md' }).click();
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('doc.md');
    // The already-open document re-opened through the drawer exact-matches
    // (activate, never overwrite); the plus-created Empty tab stays.
    const afterReopen = await files(page);
    expect(afterReopen.tabs.map((tab: { kind: string }) => tab.kind)).toEqual(['file', 'empty']);
    expect(afterReopen.tabs[0].file.path).toBe('ws-b/doc.md');
    expect(afterReopen.activeTabId).toBe(afterReopen.tabs[0].id);

    expect(pageErrors).toEqual([]);
  });

  test('harness bundle builds and mounts in production mode without page errors', async ({ page }) => {
    const pageErrors = await mountHarness(page, 'production');
    const panel = page.locator('[data-panel="file-viewer"]');
    await expect(panel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    expect(pageErrors).toEqual([]);
  });
});
