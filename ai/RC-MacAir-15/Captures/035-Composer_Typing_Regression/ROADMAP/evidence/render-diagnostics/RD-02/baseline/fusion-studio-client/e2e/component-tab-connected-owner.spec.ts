import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
import {
  parseTabPolicyProjection,
  type TabPolicy,
} from '../src/lib/tab-policy-projection';
import { readyTabPolicyFor } from '../src/components/view-tabs/componentTabConnectedAdapter';

const CAPTURE_EMPTY_POLICY_JSON = JSON.stringify({
  schemaVersion: 1,
  initial: { kind: 'empty' },
  plus: { enabled: true },
  empty: {
    tabLabel: 'New Capture Tab',
    locationLabel: 'New Capture Tab',
    launcherIds: ['capture.home'],
  },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 pinned Capture new-tab policy (the wire parser requires it).
  newTab: { blankKind: 'home', autoOpenDrawer: false },
});

const CAPTURE_LAUNCHER_POLICY_JSON = JSON.stringify({
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
});

const FILE_POLICY_JSON = JSON.stringify({
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
});

const PLAIN_POLICY_JSON = JSON.stringify({
  schemaVersion: 1,
  initial: { kind: 'empty' },
  plus: { enabled: false },
  empty: {
    tabLabel: 'Plain Tab',
    locationLabel: 'Plain Location',
    launcherIds: [],
  },
  location: { omitTerminalNames: [], historyControls: 'none' },
  // VIEW-02 §7 total defaults (the wire parser requires the record).
  newTab: { blankKind: 'empty', autoOpenDrawer: false },
});

test('activation gate supplies the connected projection only for a ready policy', () => {
  const ready = parseTabPolicyProjection({
    'capture-fixture': { schemaVersion: 1, status: 'ready', policy: JSON.parse(CAPTURE_EMPTY_POLICY_JSON) },
  });
  const unavailable = parseTabPolicyProjection({
    'capture-viewer': { schemaVersion: 1, status: 'unavailable', code: 'tab_configuration_unavailable' },
  });
  // Absent → legacy.
  expect(readyTabPolicyFor(null, 'capture-viewer')).toBeNull();
  expect(readyTabPolicyFor(undefined, 'capture-viewer')).toBeNull();
  // Present-but-unavailable → legacy in this slice (the bounded unavailable
  // surface with no launch actions is the Slice 3/4 production behavior).
  expect(readyTabPolicyFor(unavailable, 'capture-viewer')).toBeNull();
  // Ready → the policy drives the connected path.
  const policy = readyTabPolicyFor(ready, 'capture-fixture');
  expect(policy).not.toBeNull();
  expect((policy as TabPolicy).initial).toEqual({ kind: 'empty' });
  // An initial launcher outside the offered launcher set fails closed.
  const mismatched = parseTabPolicyProjection({
    'capture-fixture': {
      schemaVersion: 1,
      status: 'ready',
      policy: {
        schemaVersion: 1,
        initial: { kind: 'launcher', launcherId: 'capture.home' },
        plus: { enabled: true },
        empty: { tabLabel: 'T', locationLabel: 'L', launcherIds: [] },
        location: { omitTerminalNames: [], historyControls: 'none' },
        // Valid §7 record: the only failure cause must remain the
        // launcher-set mismatch checked by readyTabPolicyFor.
        newTab: { blankKind: 'home', autoOpenDrawer: false },
      },
    },
  });
  expect(readyTabPolicyFor(mismatched, 'capture-fixture')).toBeNull();
});

const bundles = new Map<string, Promise<string>>();

async function buildHarness(mode: 'test' | 'production') {
  const existing = bundles.get(mode);
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:connected-owner-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const virtualAdapters = '\0virtual:connected-owner-adapters';
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const connectedAdapterPath = path.resolve('src/components/view-tabs/componentTabConnectedAdapter.ts');
    const connectedOwnerPath = path.resolve('src/components/view-tabs/componentTabConnectedOwner.ts');
    const captureAdapterPath = path.resolve('src/components/view-tabs/captureViewTabAdapter.ts');
    const fileAdapterPath = path.resolve('src/components/view-tabs/fileViewTabAdapter.ts');
    const catalogPath = path.resolve('src/components/view-tabs/componentTabLauncherCatalog.ts');
    const policyProjectionPath = path.resolve('src/lib/tab-policy-projection.ts');
    const rootErrorPolicyPath = path.resolve('src/reactRootErrorPolicy.ts');

    const moduleSource = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ViewTabBar } from ${JSON.stringify(viewTabBarPath)};
      import {
        useConnectedComponentTabAdapter,
        describeComponentFromInputContract,
      } from ${JSON.stringify(connectedAdapterPath)};
      import {
        bindCatalogLaunchers,
      } from ${JSON.stringify(connectedOwnerPath)};
      import * as captureAdapter from ${JSON.stringify(captureAdapterPath)};
      import { resolveCapturePlacementTarget } from ${JSON.stringify(path.resolve('src/components/view-tabs/captureConnectedOwnerPorts.ts'))};
      import { createFileOpenPickerBinding } from ${JSON.stringify(fileAdapterPath)};
      import { COMPONENT_TAB_LAUNCHER_CATALOG } from ${JSON.stringify(catalogPath)};
      import { parseTabPolicyProjection } from ${JSON.stringify(policyProjectionPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};

      // Matches the established component-tab-host fixture id factory; this
      // page is not a secure context, so crypto.randomUUID is unavailable.
      const freshId = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
      };
      const panels = ['capture-fixture', 'file-fixture', 'plain-fixture'];
      // Catalog view identity per fixture panel (the closed catalog owns
      // capture-viewer / file-viewer).
      const catalogViewIds = {
        'capture-fixture': 'capture-viewer',
        'file-fixture': 'file-viewer',
        'plain-fixture': 'plain-fixture',
      };
      const workspaces = ['ws-1', 'ws-2'];
      const runtimeRefs = new Map();

      // ---- fixture policy store (parsed through the real wire parser) ----
      const defaultPolicies = parseTabPolicyProjection({
        'capture-fixture': { schemaVersion: 1, status: 'ready', policy: JSON.parse(${JSON.stringify(CAPTURE_EMPTY_POLICY_JSON)}) },
        'file-fixture': { schemaVersion: 1, status: 'ready', policy: JSON.parse(${JSON.stringify(FILE_POLICY_JSON)}) },
        'plain-fixture': { schemaVersion: 1, status: 'ready', policy: JSON.parse(${JSON.stringify(PLAIN_POLICY_JSON)}) },
      });
      const launcherPolicy = parseTabPolicyProjection({
        'capture-fixture': { schemaVersion: 1, status: 'ready', policy: JSON.parse(${JSON.stringify(CAPTURE_LAUNCHER_POLICY_JSON)}) },
      });
      let policies = defaultPolicies;
      const policyListeners = new Set();
      const policyStore = {
        subscribe: (l) => { policyListeners.add(l); return () => policyListeners.delete(l); },
        getSnapshot: () => policies,
      };

      // ---- fixture workspace store ----
      let activeWorkspaceId = 'ws-1';
      const workspaceListeners = new Set();
      const workspaceStore = {
        subscribe: (l) => { workspaceListeners.add(l); return () => workspaceListeners.delete(l); },
        getSnapshot: () => activeWorkspaceId,
      };

      // ---- fixture owner ports: one per (workspace, panel) ----
      const placementEvents = [];
      const failNextApplyByOwner = new Map();
      const owners = new Map();
      function createOwnerPorts(workspaceId, panelId) {
        let collection = { tabs: [], activeTabId: null, reservations: [] };
        const listeners = new Set();
        const key = workspaceId + ':' + panelId;
        const ports = {
          workspaceId,
          viewId: catalogViewIds[panelId],
          readCollection: () => collection,
          applyCollection: (next) => {
            if (failNextApplyByOwner.get(key)) {
              failNextApplyByOwner.set(key, false);
              throw new Error('Fixture acknowledged owner write failed.');
            }
            placementEvents.push(['applied', panelId, workspaceId]);
            collection = next;
            listeners.forEach((l) => l());
          },
          subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
          isCurrent: () => activeWorkspaceId === workspaceId,
          mintTabId: freshId,
          mintOperationId: freshId,
          mintComponentInstanceId: freshId,
          // VIEW-02 §4 blank capability: only the Capture fixture has a Home
          // blank; the File fixture's blank is the generic Empty tab (no
          // capability), and the plain fixture has no plus at all.
          blankPlacementTarget: panelId === 'capture-fixture'
            ? () => ({
              presenterId: captureAdapter.CAPTURE_LANDING_PRESENTER_ID,
              targetKey: 'capture:home',
            })
            : undefined,
          resolvePlacementTarget: (target) => {
            placementEvents.push(['resolve-target', panelId, target.presenterId, target.targetKey]);
            if (panelId === 'capture-fixture') {
              // The REAL code-owned Capture target resolution (home + docs).
              return resolveCapturePlacementTarget(target, 'note_stack');
            }
            if (panelId !== 'plain-fixture') return null;
            if (target.presenterId !== 'fixture.plain' || target.targetKey !== 'plain:one') return null;
            return {
              schemaVersion: 1,
              presenterId: 'fixture.plain',
              targetKey: 'plain:one',
              componentTypeId: 'fixture.plain',
              input: { title: 'PLAIN ONE', locationLabels: ['Plain', 'One'], icon: 'crop_square' },
              tab: { label: 'PLAIN ONE', icon: 'crop_square', closeLabel: 'Close PLAIN ONE', closable: true },
              location: { schemaVersion: 1, segments: [{ label: 'Plain' }, { label: 'One' }] },
            };
          },
        };
        owners.set(key, ports);
        return ports;
      }
      for (const workspaceId of workspaces) {
        for (const panelId of panels) createOwnerPorts(workspaceId, panelId);
      }
      const ownerPorts = (workspaceId, panelId) => owners.get(workspaceId + ':' + panelId);

      // ---- capture launcher binding modes (fixture-controlled behavior) ----
      let captureLauncherMode = 'normal';
      const pendingLaunches = [];
      function captureHomeDescriptor() {
        return {
          schemaVersion: 1,
          componentTypeId: captureAdapter.CAPTURE_LANDING_COMPONENT_TYPE,
          componentInstanceId: freshId(),
          input: { title: 'CAPTURE', locationLabels: ['Capture', 'Documents and Artifacts'] },
          targetKey: 'capture:home',
        };
      }
      function captureLauncherBinding() {
        return {
          kind: 'component',
          icon: 'home',
          launcher: () => {
            if (captureLauncherMode === 'throw') {
              throw new Error('PRIVATE /Users/owner/capture-launcher.ts failed');
            }
            if (captureLauncherMode === 'invalid-descriptor') {
              return { kind: 'component', descriptor: { schemaVersion: 2, componentTypeId: 'capture.landing' } };
            }
            if (captureLauncherMode === 'manual') {
              return new Promise((resolve) => { pendingLaunches.push(resolve); });
            }
            return { kind: 'component', descriptor: captureHomeDescriptor() };
          },
        };
      }

      // ---- file picker reveal evidence ----
      const revealEvents = [];
      let revealThrows = false;
      function filePickerBinding() {
        return createFileOpenPickerBinding({
          reveal: () => {
            if (revealThrows) throw new Error('PRIVATE /Users/owner/file-drawer.ts failed');
            revealEvents.push(activeWorkspaceId);
          },
        });
      }

      const launchers = {
        'capture-fixture': () => bindCatalogLaunchers([
          { launcherId: 'capture.home', binding: captureLauncherBinding() },
        ]),
        'file-fixture': () => bindCatalogLaunchers([
          { launcherId: 'file.open', binding: filePickerBinding() },
        ]),
        'plain-fixture': () => bindCatalogLaunchers([]),
      };

      const registrations = {
        'capture-fixture': () => captureAdapter.captureConnectedPresenterRegistrations(),
        'file-fixture': () => [],
        'plain-fixture': () => [{
          componentTypeId: 'fixture.plain',
          label: 'Plain fixture',
          render: ({ descriptor }) => React.createElement(
            'article',
            { 'data-plain-presenter': descriptor.targetKey },
            'Plain presenter ' + descriptor.targetKey,
          ),
        }],
      };

      function runtimeRefFor(panelId, workspaceId) {
        const key = workspaceId + ':' + panelId;
        if (!runtimeRefs.has(key)) runtimeRefs.set(key, { current: null });
        return runtimeRefs.get(key);
      }

      function configFor(panelId, workspaceId) {
        const ports = ownerPorts(workspaceId, panelId);
        return {
          enabled: true,
          panelId,
          label: 'Fixture tabs for ' + panelId,
          viewIcon: panelId === 'file-fixture' ? 'folder' : 'note_stack',
          plusLabel: 'New fixture tab for ' + panelId,
          policy: policies[panelId].policy,
          runtimeKey: workspaceId + ':' + panelId,
          ownerPorts: {
            ...ports,
            launcherFor: (launcherId) => launchers[panelId]()(launcherId, catalogViewIds[panelId]),
          },
          registrations: registrations[panelId](),
          describeComponent: describeComponentFromInputContract,
          runtimeRef: runtimeRefFor(panelId, workspaceId),
        };
      }

      // ---- the REAL connected hook behind the real ViewTabBar ----
      function useViewTabAdapter(panelId) {
        if (!panels.includes(panelId)) return null;
        const workspaceId = React.useSyncExternalStore(
          workspaceStore.subscribe,
          workspaceStore.getSnapshot,
          workspaceStore.getSnapshot,
        );
        React.useSyncExternalStore(
          policyStore.subscribe,
          policyStore.getSnapshot,
          policyStore.getSnapshot,
        );
        return useConnectedComponentTabAdapter(configFor(panelId, workspaceId));
      }
      globalThis.__useViewTabAdapter = useViewTabAdapter;

      // ---- test controller: same runtime instances the hook created ----
      function runtime(panelId) {
        const ref = runtimeRefFor(panelId, activeWorkspaceId);
        if (!ref.current) throw new Error('Runtime not mounted for ' + panelId);
        return ref.current;
      }
      function collection(panelId) {
        return JSON.parse(JSON.stringify(ownerPorts(activeWorkspaceId, panelId).readCollection()));
      }
      function collectionFor(panelId, workspaceId) {
        return JSON.parse(JSON.stringify(ownerPorts(workspaceId, panelId).readCollection()));
      }
      window.__connectedOwnerController = {
        subscribe: (l) => { workspaceListeners.add(l); return () => workspaceListeners.delete(l); },
        getSnapshot: () => activeWorkspaceId,
        catalog: () => JSON.parse(JSON.stringify(COMPONENT_TAB_LAUNCHER_CATALOG)),
        collection,
        collectionFor,
        picker: (panelId) => {
          const current = runtime(panelId).pickerCurrent();
          return current ? JSON.parse(JSON.stringify(current)) : null;
        },
        reveals: () => [...revealEvents],
        placementEvents: () => JSON.parse(JSON.stringify(placementEvents)),
        pendingLaunchCount: () => pendingLaunches.length,
        resolveLaunch: (index) => {
          const resolve = pendingLaunches[index];
          if (!resolve) return false;
          resolve({ kind: 'component', descriptor: captureHomeDescriptor() });
          return true;
        },
        setLauncherMode: (mode) => { captureLauncherMode = mode; },
        setPolicy: (panelId, which) => {
          policies = which === 'launcher'
            ? { ...policies, [panelId]: launcherPolicy[panelId] }
            : { ...policies, [panelId]: defaultPolicies[panelId] };
          policyListeners.forEach((l) => l());
        },
        switchWorkspace: (workspaceId) => {
          activeWorkspaceId = workspaceId;
          workspaceListeners.forEach((l) => l());
        },
        plus: (panelId) => runtime(panelId).createEmptyTab(),
        launch: (panelId, tabId, launcherId) => runtime(panelId).launchInTab(tabId, launcherId),
        cancel: (panelId, tabId) => runtime(panelId).cancelTab(tabId),
        activate: (panelId, tabId) => runtime(panelId).activateTab(tabId),
        place: (panelId, request) => runtime(panelId).place(request),
        commitStale: (panelId) => {
          const snapshot = { schemaVersion: 1, tabs: [], activeTabId: null, reservations: [] };
          return runtime(panelId).commit({ schemaVersion: 1, priorSnapshot: snapshot, nextSnapshot: snapshot });
        },
        failNextApply: (panelId) => {
          failNextApplyByOwner.set(activeWorkspaceId + ':' + panelId, true);
        },
        stuffTabs: (panelId, count) => {
          const ports = ownerPorts(activeWorkspaceId, panelId);
          const tabs = [];
          for (let index = 0; index < count; index += 1) {
            tabs.push({ tabId: 'bound-tab-' + index, content: { kind: 'empty', revision: 0 } });
          }
          ports.applyCollection({ schemaVersion: 1, tabs, activeTabId: 'bound-tab-0', reservations: [] });
        },
        // VIEW-02 §4/§9 test setup: apply an exact collection to THIS
        // workspace's owner ports (hydrated-records shape).
        applyTabs: (panelId, tabs, activeTabId, reservations) => {
          const ports = ownerPorts(activeWorkspaceId, panelId);
          ports.applyCollection({ tabs, activeTabId, reservations: reservations ?? [] });
        },
        // Seed ANOTHER workspace's owner ports before switching to it, so the
        // mounted runtime's initial turn hydrates from these records (§9).
        seedFor: (panelId, workspaceId, tabs, activeTabId, reservations) => {
          const ports = ownerPorts(workspaceId, panelId);
          ports.applyCollection({ tabs, activeTabId, reservations: reservations ?? [] });
        },
        blank: (panelId, blankKind) => runtime(panelId).createOrRecenterBlank(blankKind),
        prepareThenPlace: (panelId, identity, requestId) => {
          return runtime(panelId).runIntent(async (turn) => {
            placementEvents.push(['turn-started', panelId]);
            const preparation = turn.preparePickerSelection(identity);
            placementEvents.push(['prepared', preparation]);
            if (preparation !== 'ok') return { preparation, placed: null };
            const placed = await turn.place({
              schemaVersion: 1,
              requestId,
              disposition: 'current',
              target: { presenterId: 'fixture.plain', targetKey: 'plain:one' },
            });
            placementEvents.push(['placed', placed.ok ? placed.outcome : placed.code]);
            return { preparation, placed: JSON.parse(JSON.stringify(placed)) };
          });
        },
        runAfter: (panelId, marker) => {
          return runtime(panelId).runIntent(() => { placementEvents.push(['intent', marker]); return marker; });
        },
      };

      function mountPanel(panelId) {
        return React.createElement(
          'section',
          { className: 'rv-panel active', 'data-panel': panelId },
          React.createElement(
            'div',
            { className: 'rv-content-area', tabIndex: -1 },
            React.createElement(
              'main',
              { id: 'consumer-root-' + panelId },
              React.createElement(ViewTabBar, { panel: panelId },
                React.createElement('button', { type: 'button', id: 'legacy-child-' + panelId }, 'Legacy child'),
              ),
            ),
          ),
        );
      }
      createRoot(document.querySelector('#fixture-root'), reactRootErrorOptions).render(
        React.createElement(React.Fragment, null, panels.map(mountPanel)),
      );
    `;

    const adapterSource = `
      export function useViewTabAdapter(panelId) {
        return globalThis.__useViewTabAdapter(panelId);
      }
    `;

    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode,
      plugins: [{
        name: 'connected-owner-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === virtualEntry) return resolvedEntry;
          if (id.includes('viewTabAdapters') && importer?.split('?')[0] === viewTabBarPath) {
            return virtualAdapters;
          }
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return moduleSource;
          if (id === virtualAdapters) return adapterSource;
          return null;
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'ConnectedOwnerHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Connected owner harness did not build.');
    return chunk.code;
  })();
  bundles.set(mode, bundle);
  return bundle;
}

export async function mount(page: Page, mode: 'test' | 'production' = 'test') {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="fixture-root"></div></body>');
  await page.addScriptTag({ content: await buildHarness(mode) });
  await expect(page.locator('[data-panel="capture-fixture"] .rv-view-tab-item.is-selected .rv-view-tab-label'))
    .toHaveText('New Capture Tab');
  await expect(page.locator('[data-panel="file-fixture"] .rv-view-tab-item.is-selected .rv-view-tab-label'))
    .toHaveText('New File Tab');
  await expect(page.locator('[data-panel="plain-fixture"] .rv-view-tab-item.is-selected .rv-view-tab-label'))
    .toHaveText('Plain Tab');
  if (pageErrors.length > 0) throw new Error(pageErrors.join('\n'));
  return pageErrors;
}

function collection(page: Page, panelId: string) {
  return page.evaluate(
    (id) => window.__connectedOwnerController.collection(id),
    panelId,
  );
}

function collectionFor(page: Page, panelId: string, workspaceId: string) {
  return page.evaluate(
    ([id, workspace]) => window.__connectedOwnerController.collectionFor(id, workspace),
    [panelId, workspaceId],
  );
}

test.describe('VIEW-02 Slice 2 — connected adapter foundation', () => {
  test('initial Empty policy creates one centered tab with configured labels and location row', async ({ page }) => {
    await mount(page);
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    // Single tab → the same universal strip, left-aligned.
    await expect(capturePanel.getByRole('tablist')).toHaveCount(1);
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New Capture Tab');
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-icon')).toHaveText('note_stack');
    // Location row is present in single mode too, with the configured label.
    await expect(capturePanel.getByRole('navigation', { name: 'Location: New Capture Tab' })).toBeVisible();
    // Plus offered with the configured label.
    await expect(capturePanel.getByRole('button', { name: 'New fixture tab for capture-fixture' })).toHaveCount(1);

    const state = await collection(page, 'capture-fixture');
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content).toEqual({ kind: 'empty', revision: 0 });
    expect(state.activeTabId).toBe(state.tabs[0].tabId);
    expect(state.reservations).toEqual([]);
  });

  test('initial launcher runs the full reservation lifecycle and commits component content (VRT-011)', async ({ page }) => {
    await mount(page);
    // Start from the empty policy; flip the capture policy to the launcher
    // variant with a manually-resolving launcher so the reservation window is
    // observable.
    const before = await collection(page, 'capture-fixture');
    await page.evaluate(() => {
      window.__connectedOwnerController.setLauncherMode('manual');
      window.__connectedOwnerController.setPolicy('capture-fixture', 'launcher');
    });
    // Policy changes never rewrite the existing tab set, and the consumed
    // initial policy means the launcher path only runs on a fresh owner.
    expect(await collection(page, 'capture-fixture')).toEqual(before);

    // A fresh owner (workspace switch) initializes through the launcher policy:
    // one Empty tab, then reserve → launch (pending) → validate → commit.
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-2'));
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    const pending = capturePanel.locator('.rv-empty-tab-reservation');
    await expect(pending).toBeVisible();
    await expect(capturePanel.locator('.rv-empty-tab-panel')).toHaveAttribute('aria-busy', 'true');
    await expect(pending.locator('.rv-empty-tab-reservation-message')).toHaveText('Opening Capture Home…');

    const pendingState = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(pendingState.tabs).toHaveLength(1);
    expect(pendingState.tabs[0].content.kind).toBe('empty');
    expect(pendingState.reservations).toHaveLength(1);
    expect(pendingState.reservations[0].launcherId).toBe('capture.home');
    expect(pendingState.reservations[0].status).toBe('pending');
    expect(pendingState.reservations[0].tabId).toBe(pendingState.activeTabId);

    await page.evaluate(() => window.__connectedOwnerController.resolveLaunch(0));
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    await expect(capturePanel.getByRole('navigation', { name: 'Location: Capture > Documents and Artifacts' }))
      .toBeVisible();
    // VIEW-02 Slice 3: the placeholder landing presenter became the REAL
    // Capture landing content (the classic grid/landing projection).
    await expect(capturePanel.locator('[data-capture-landing] .rv-capture-viewer-main-title'))
      .toContainText('Document and Artifact Capture');
    const committedState = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(committedState.reservations).toEqual([]);
    expect(committedState.tabs[0].content.kind).toBe('component');
    expect(committedState.tabs[0].content.component).toMatchObject({
      schemaVersion: 1,
      componentTypeId: 'capture.landing',
      targetKey: 'capture:home',
    });
    expect(committedState.tabs[0].content.component.input).toEqual({
      title: 'CAPTURE',
      locationLabels: ['Capture', 'Documents and Artifacts'],
    });
  });

  test('failing launchers leave a retryable Empty tab; Cancel clears; Retry re-runs', async ({ page }) => {
    await mount(page);
    await page.evaluate(() => {
      window.__connectedOwnerController.setLauncherMode('throw');
      window.__connectedOwnerController.setPolicy('capture-fixture', 'launcher');
      window.__connectedOwnerController.switchWorkspace('ws-2');
    });
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    const body = capturePanel.locator('.rv-component-tab-panel');
    // Thrown launcher → product-safe retryable Empty tab.
    const failure = body.locator('.rv-empty-tab-reservation');
    await expect(failure).toBeVisible();
    await expect(failure.locator('.rv-empty-tab-error')).toHaveText(
      'The component could not be opened. Try again.',
    );
    let state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.kind).toBe('empty');
    expect(state.reservations[0].status).toBe('failed');
    expect(state.reservations[0].error.code).toBe('launch_failed');

    // Retry with a still-throwing launcher keeps the retryable Empty tab.
    await failure.getByRole('button', { name: 'Retry Capture Home' }).click();
    await expect(body.locator('.rv-empty-tab-reservation .rv-empty-tab-error')).toHaveText(
      'The component could not be opened. Try again.',
    );
    state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.kind).toBe('empty');
    expect(state.reservations[0].status).toBe('failed');

    // Cancel clears the reservation and restores the neutral Empty surface
    // (VIEW-02 §6: no launcher menu is ever presented).
    const tabId = state.tabs[0].tabId;
    await body.locator('.rv-empty-tab-reservation').getByRole('button', { name: 'Cancel' }).click();
    await expect(body.locator('.rv-empty-tab-launcher')).toHaveCount(0);
    state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.reservations).toEqual([]);
    expect(state.tabs[0].content.kind).toBe('empty');

    // A working launcher commits the component through the same lifecycle.
    await page.evaluate(({ panelId, targetTabId }) => {
      window.__connectedOwnerController.setLauncherMode('normal');
      return window.__connectedOwnerController.launch(panelId, targetTabId, 'capture.home');
    }, { panelId: 'capture-fixture', targetTabId: tabId });
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.tabs[0].content.kind).toBe('component');
  });

  test('invalid descriptors and unknown or wrong-view launchers use the accepted failure behavior', async ({ page }) => {
    await mount(page);
    await page.evaluate(() => {
      window.__connectedOwnerController.setLauncherMode('invalid-descriptor');
      window.__connectedOwnerController.setPolicy('capture-fixture', 'launcher');
      window.__connectedOwnerController.switchWorkspace('ws-2');
    });
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    await expect(capturePanel.locator('.rv-empty-tab-reservation .rv-empty-tab-error')).toHaveText(
      'The component returned invalid content. Try again.',
    );
    let state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.reservations[0].status).toBe('failed');
    expect(state.reservations[0].error.code).toBe('invalid_component');
    const tabId = state.tabs[0].tabId;
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.cancel(panelId, targetTabId)
    ), ['capture-fixture', tabId]);
    await expect(capturePanel.locator('.rv-empty-tab-launcher')).toHaveCount(0);

    // Unknown launcher ID driven directly: reserved then failed product-safely.
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.launch(panelId, targetTabId, 'does.not.exist')
    ), ['capture-fixture', tabId]);
    state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].launcherId).toBe('does.not.exist');
    expect(state.reservations[0].status).toBe('failed');
    expect(state.reservations[0].error.code).toBe('launch_failed');
    expect(state.tabs[0].content.kind).toBe('empty');
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.cancel(panelId, targetTabId)
    ), ['capture-fixture', tabId]);

    // Wrong-view launcher (file.open in the capture owner) fails closed too.
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.launch(panelId, targetTabId, 'file.open')
    ), ['capture-fixture', tabId]);
    state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.reservations[0].status).toBe('failed');
    expect(state.reservations[0].error.code).toBe('launch_failed');
  });

  test('stale async completion after cancel or replace does not corrupt state', async ({ page }) => {
    await mount(page);
    await page.evaluate(() => {
      window.__connectedOwnerController.setLauncherMode('manual');
      window.__connectedOwnerController.setPolicy('capture-fixture', 'launcher');
      window.__connectedOwnerController.switchWorkspace('ws-2');
    });
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    await expect(capturePanel.locator('.rv-empty-tab-reservation')).toBeVisible();
    expect(await page.evaluate(() => window.__connectedOwnerController.pendingLaunchCount())).toBe(1);

    // Cancel the initial reservation, then start a new manual launch in the
    // same tab. Resolving the FIRST (canceled) operation must be a no-op.
    const stateAfterCancel = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(stateAfterCancel.reservations).toHaveLength(1);
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.cancel(panelId, targetTabId)
    ), ['capture-fixture', stateAfterCancel.tabs[0].tabId]);
    await expect(capturePanel.locator('.rv-empty-tab-launcher')).toHaveCount(0);
    const cleared = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(cleared.reservations).toEqual([]);

    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.launch(panelId, targetTabId, 'capture.home')
    ), ['capture-fixture', cleared.tabs[0].tabId]);
    await expect(capturePanel.locator('.rv-empty-tab-reservation')).toBeVisible();
    const stateAfterRelaunch = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(stateAfterRelaunch.reservations).toHaveLength(1);
    expect(await page.evaluate(() => window.__connectedOwnerController.pendingLaunchCount())).toBe(2);

    // Stale completion for the canceled operation: nothing lands.
    await page.evaluate(() => window.__connectedOwnerController.resolveLaunch(0));
    await page.waitForTimeout(50);
    expect(await collectionFor(page, 'capture-fixture', 'ws-2')).toEqual(stateAfterRelaunch);

    // The current operation's completion commits exactly once.
    await page.evaluate(() => window.__connectedOwnerController.resolveLaunch(1));
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const committed = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(committed.tabs[0].content.kind).toBe('component');
    expect(committed.reservations).toEqual([]);
  });

  test('VIEW-02 §4: plus on the active Empty tab is a bounded no-op; the raw Empty creation stays bounded', async ({ page }) => {
    await mount(page);
    const filePanel = page.locator('[data-panel="file-fixture"]');
    const add = filePanel.getByRole('button', { name: 'New fixture tab for file-fixture' });
    const before = await collection(page, 'file-fixture');
    expect(before.tabs).toHaveLength(1);
    expect(before.tabs[0].content.kind).toBe('empty');

    // The active tab IS the view's blank (Empty): + does NOTHING.
    await add.click();
    await expect(filePanel.getByRole('tab')).toHaveCount(1);
    await expect(filePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    expect(await collection(page, 'file-fixture')).toEqual(before);
    // Plus never invokes a launcher: no picker reveal, no reservations.
    expect(await page.evaluate(() => window.__connectedOwnerController.reveals())).toEqual([]);

    // The raw runtime Empty creation (used by the initial policy and the
    // bounded lifecycle) keeps its maximum tab bound.
    await page.evaluate(() => window.__connectedOwnerController.stuffTabs('file-fixture', 512));
    expect(await page.evaluate(() => window.__connectedOwnerController.plus('file-fixture'))).toBeNull();
    const bounded = await collection(page, 'file-fixture');
    expect(bounded.tabs).toHaveLength(512);
  });

  test('disabled plus exposes no add action or keyboard-equivalent', async ({ page }) => {
    await mount(page);
    const plainPanel = page.locator('[data-panel="plain-fixture"]');
    await expect(plainPanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('Plain Tab');
    await expect(plainPanel.getByRole('button', { name: 'New fixture tab for plain-fixture' })).toHaveCount(0);
    // No keyboard-equivalent add action: the only button is the close control.
    const buttonLabels = await plainPanel.getByRole('button').evaluateAll(
      (elements) => elements.map((element) => element.getAttribute('aria-label')),
    );
    expect(buttonLabels).toEqual(['Close Plain Tab']);
    // The disabled-plus surface is the only plus gate: no add action exists in
    // the DOM (single identity or rail), so no keyboard path can reach one.
    const state = await collection(page, 'plain-fixture');
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].content.kind).toBe('empty');
  });

  test('picker replacement, focus invariance, and workspace-switch clearing (VRT-011A foundation)', async ({ page }) => {
    await mount(page);
    const filePanel = page.locator('[data-panel="file-fixture"]');
    // Two Empty tabs via the raw runtime creation (the + contract no-ops on
    // an active Empty tab; this fixture setup needs a second destination).
    await page.evaluate(() => window.__connectedOwnerController.plus('file-fixture'));
    await expect(filePanel.getByRole('tab')).toHaveCount(2);
    const tabs = filePanel.getByRole('tab');

    // Start file.open in the first tab: reservation pending, singleton context
    // bound, reveal effect fired. (VIEW-02 §6: the launcher grid is retired —
    // the reservation lifecycle is driven through the runtime's serialized
    // lane, exactly as the initial-policy lifecycle does.)
    const firstTabId = (await collection(page, 'file-fixture')).tabs[0].tabId;
    await tabs.nth(0).click();
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.launch(panelId, targetTabId, 'file.open')
    ), ['file-fixture', firstTabId]);
    await expect(filePanel.locator('.rv-empty-tab-reservation')).toBeVisible();
    expect(await page.evaluate(() => window.__connectedOwnerController.reveals())).toEqual(['ws-1']);
    let picker = await page.evaluate(() => window.__connectedOwnerController.picker('file-fixture'));
    expect(picker?.tabId).toBe(firstTabId);

    // Ordinary focus change does NOT clear the context or reservation.
    await tabs.nth(1).click();
    await expect(filePanel.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    picker = await page.evaluate(() => window.__connectedOwnerController.picker('file-fixture'));
    expect(picker?.tabId).toBe(firstTabId);
    let state = await collection(page, 'file-fixture');
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].tabId).toBe(firstTabId);

    // Starting file.open in another Empty tab atomically cancels the prior
    // pending reservation before binding/revealing the singleton context for
    // the new one.
    const secondTabId = (await collection(page, 'file-fixture')).tabs[1].tabId;
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.launch(panelId, targetTabId, 'file.open')
    ), ['file-fixture', secondTabId]);
    await expect(filePanel.locator('.rv-empty-tab-reservation')).toHaveCount(1);
    expect(await page.evaluate(() => window.__connectedOwnerController.reveals())).toEqual(['ws-1', 'ws-1']);
    state = await collection(page, 'file-fixture');
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].tabId).toBe(secondTabId);
    picker = await page.evaluate(() => window.__connectedOwnerController.picker('file-fixture'));
    expect(picker?.tabId).toBe(secondTabId);

    // Reservation Cancel clears that exact context and reservation.
    await filePanel.locator('.rv-empty-tab-reservation').getByRole('button', { name: 'Cancel' }).click();
    await expect(filePanel.locator('.rv-empty-tab-reservation')).toHaveCount(0);
    picker = await page.evaluate(() => window.__connectedOwnerController.picker('file-fixture'));
    expect(picker).toBeNull();
    state = await collection(page, 'file-fixture');
    expect(state.reservations).toEqual([]);

    // Workspace switch clears context + reservation; no cross-workspace tabs.
    await page.evaluate(([panelId, targetTabId]) => (
      window.__connectedOwnerController.launch(panelId, targetTabId, 'file.open')
    ), ['file-fixture', secondTabId]);
    await expect(filePanel.locator('.rv-empty-tab-reservation')).toHaveCount(1);
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-2'));
    await expect(filePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    const ws1State = await collectionFor(page, 'file-fixture', 'ws-1');
    expect(ws1State.reservations).toEqual([]);
    expect(ws1State.tabs).toHaveLength(2);
    const ws2State = await collectionFor(page, 'file-fixture', 'ws-2');
    expect(ws2State.tabs).toHaveLength(1);
    expect(ws2State.tabs[0].tabId).not.toBe(ws1State.tabs[0].tabId);
    expect(ws2State.reservations).toEqual([]);
    expect(await page.evaluate(() => window.__connectedOwnerController.picker('file-fixture'))).toBeNull();
  });

  test('workspace switch stale-aborts in-flight launch work with prior state intact', async ({ page }) => {
    await mount(page);
    await page.evaluate(() => {
      window.__connectedOwnerController.setLauncherMode('manual');
      window.__connectedOwnerController.setPolicy('capture-fixture', 'launcher');
      window.__connectedOwnerController.switchWorkspace('ws-2');
    });
    await expect(page.locator('[data-panel="capture-fixture"] .rv-empty-tab-reservation')).toBeVisible();
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-1'));
    // Resolve AFTER the switch: the stale continuation must not land.
    await page.evaluate(() => window.__connectedOwnerController.resolveLaunch(0));
    await page.waitForTimeout(50);
    const ws2State = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(ws2State.tabs).toHaveLength(1);
    expect(ws2State.tabs[0].content.kind).toBe('empty');
    expect(ws2State.reservations).toHaveLength(1);
    expect(ws2State.reservations[0].status).toBe('pending');
    // The prior workspace is intact and no tab leaked across workspaces.
    const ws1State = await collectionFor(page, 'capture-fixture', 'ws-1');
    expect(ws1State.tabs).toHaveLength(1);
    expect(ws1State.tabs[0].content.kind).toBe('empty');
    expect(ws1State.reservations).toEqual([]);
  });

  test('commit discipline: committed only on exact fresh read; concurrent mismatch rejects intact', async ({ page }) => {
    await mount(page);
    const plainPanel = page.locator('[data-panel="plain-fixture"]');

    // Stale prior snapshot (fresh owner read does not match) → rejected, state intact.
    const stale = await page.evaluate(() => window.__connectedOwnerController.commitStale('plain-fixture'));
    expect(stale.status).toBe('rejected');
    let state = await collection(page, 'plain-fixture');
    expect(state.tabs[0].content.kind).toBe('empty');

    // Failed acknowledged owner write → rejected with prior state intact.
    await page.evaluate(() => window.__connectedOwnerController.failNextApply('plain-fixture'));
    const failedResult = await page.evaluate((requestId) => window.__connectedOwnerController.place('plain-fixture', {
      schemaVersion: 1,
      requestId,
      disposition: 'current',
      target: { presenterId: 'fixture.plain', targetKey: 'plain:one' },
    }), 'req-commit-failed');
    expect(failedResult.ok).toBe(false);
    expect(failedResult.code).toBe('state_commit_failed');
    state = await collection(page, 'plain-fixture');
    expect(state.tabs[0].content.kind).toBe('empty');

    // Exact prior match + acknowledged write + fresh exact read → committed.
    const result = await page.evaluate((requestId) => window.__connectedOwnerController.place('plain-fixture', {
      schemaVersion: 1,
      requestId,
      disposition: 'current',
      target: { presenterId: 'fixture.plain', targetKey: 'plain:one' },
    }), 'req-commit-ok');
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('filled_current');
    state = await collection(page, 'plain-fixture');
    expect(state.tabs[0].content.kind).toBe('component');
    expect(state.tabs[0].content.component.targetKey).toBe('plain:one');
    await expect(plainPanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('PLAIN ONE');
  });

  test('picker preparation and TABS-03 current run in one serialized intent lane', async ({ page }) => {
    await mount(page);
    const filePanel = page.locator('[data-panel="file-fixture"]');
    // Second Empty tab via the raw runtime creation (the §4 plus contract
    // no-ops on an active Empty tab; this lane test needs a second destination).
    await page.evaluate(() => window.__connectedOwnerController.plus('file-fixture'));
    await expect(filePanel.getByRole('tab')).toHaveCount(2);
    const initial = await collection(page, 'file-fixture');
    const destinationId = initial.tabs[0].tabId;

    // Reserve the destination with the picker (activate it first so the
    // pending reservation is visible on the active tab).
    await page.evaluate(([panelId, tabId]) => (
      window.__connectedOwnerController.activate(panelId, tabId)
    ), ['file-fixture', destinationId]);
    await page.evaluate(([panelId, tabId]) => (
      window.__connectedOwnerController.launch(panelId, tabId, 'file.open')
    ), ['file-fixture', destinationId]);
    await expect(filePanel.locator('.rv-empty-tab-reservation')).toHaveCount(1);
    const reserved = await collection(page, 'file-fixture');
    const identity = {
      tabId: reserved.reservations[0].tabId,
      operationId: reserved.reservations[0].operationId,
      expectedRevision: reserved.reservations[0].expectedRevision,
    };

    // The file fixture resolves no placement targets: preparation succeeds
    // (reservation removed, destination activated, content/order/revision
    // unchanged), then the TABS-03 current call fails with a bounded placement
    // failure and the destination remains the active unreserved Empty tab.
    const outcome = await page.evaluate(({ panelId, identityValue, requestId }) => (
      window.__connectedOwnerController.prepareThenPlace(panelId, identityValue, requestId)
    ), { panelId: 'file-fixture', identityValue: identity, requestId: 'req-picker-prep' });
    expect(outcome.preparation).toBe('ok');
    expect(outcome.placed.ok).toBe(false);
    expect(outcome.placed.code).toBe('target_unavailable');
    const afterPrep = await collection(page, 'file-fixture');
    expect(afterPrep.reservations).toEqual([]);
    expect(afterPrep.activeTabId).toBe(destinationId);
    expect(afterPrep.tabs).toHaveLength(2);
    expect(afterPrep.tabs[0].content).toEqual({ kind: 'empty', revision: 0 });

    // The lane is FIFO: intents queued around the prep+place turn never
    // interleave with it.
    await page.evaluate(([panelId, marker]) => (
      window.__connectedOwnerController.runAfter(panelId, marker)
    ), ['file-fixture', 'after-marker']);
    const events = await page.evaluate(() => window.__connectedOwnerController.placementEvents());
    const labels = events.map((entry: string[]) => entry[0] === 'intent' ? `intent:${entry[1]}` : entry[0]);
    const turnStart = labels.indexOf('turn-started');
    expect(turnStart).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('prepared', turnStart)).toBe(turnStart + 2); // an owner write lands in between
    expect(labels.indexOf('resolve-target', turnStart)).toBeGreaterThan(turnStart);
    expect(labels.indexOf('placed', turnStart)).toBeGreaterThan(labels.indexOf('resolve-target', turnStart));
    expect(labels.indexOf('intent:after-marker')).toBeGreaterThan(labels.indexOf('placed', turnStart));

    // Stale identities (already released) return stale_completion with no
    // state change.
    const staleOutcome = await page.evaluate(({ panelId, identityValue, requestId }) => (
      window.__connectedOwnerController.prepareThenPlace(panelId, identityValue, requestId)
    ), { panelId: 'file-fixture', identityValue: identity, requestId: 'req-picker-stale' });
    expect(staleOutcome.preparation).toBe('stale_completion');
    expect(staleOutcome.placed).toBeNull();
    expect(await collection(page, 'file-fixture')).toEqual(afterPrep);
  });

  test('two tabs use the ordinary rail with policy labels and a location row in both modes', async ({ page }) => {
    await mount(page);
    const filePanel = page.locator('[data-panel="file-fixture"]');
    // Second tab via the raw runtime creation (the + contract no-ops on an
    // active Empty tab; this is chrome-geometry setup, not plus behavior).
    await page.evaluate(() => window.__connectedOwnerController.plus('file-fixture'));
    await expect(filePanel.getByRole('tab')).toHaveCount(2);
    await expect(filePanel.getByRole('tab')).toHaveText([/New File Tab/, /New File Tab/]);
    await expect(filePanel.getByRole('navigation', { name: 'Location: New File Tab' })).toBeVisible();
    // Tabbed mode renders the strip and the location rail together.
    await expect(filePanel.getByRole('tablist')).toHaveCount(1);
    await expect(filePanel.locator('.rv-component-tab-location-rail')).toHaveCount(1);
  });

  test('Side Chat does not exist anywhere in the closed catalog or launcher surfaces', async ({ page }) => {
    await mount(page);
    const catalog = await page.evaluate(() => window.__connectedOwnerController.catalog());
    expect(catalog.map((entry: { launcherId: string }) => entry.launcherId).sort()).toEqual([
      'capture.home',
      'file.open',
    ]);
    for (const entry of catalog) {
      expect(entry.launcherId.toLowerCase()).not.toContain('chat');
      expect(String(entry.label ?? '').toLowerCase()).not.toContain('chat');
    }
    const filePanel = page.locator('[data-panel="file-fixture"]');
    // VIEW-02 §6: the Empty surface presents no launcher menu — check the
    // whole Empty surface text instead.
    const surfaceText = await filePanel.locator('.rv-component-tab-panel').innerText();
    expect(surfaceText.toLowerCase()).not.toContain('chat');
  });
});

test.describe('VIEW-02 §4/§9 — plus blank contract and hydration dedupe', () => {
  function fixtureDocumentTab(tabId: string, instanceId: string) {
    return {
      tabId,
      content: {
        kind: 'component',
        revision: 0,
        component: {
          schemaVersion: 1,
          componentTypeId: 'fixture.doc',
          componentInstanceId: instanceId,
          input: { title: 'alpha.md', locationLabels: ['Docs', 'alpha.md'] },
          targetKey: 'fixture-doc:alpha.md',
        },
      },
    };
  }

  function fixtureHomeTab(tabId: string, instanceId: string) {
    return {
      tabId,
      content: {
        kind: 'component',
        revision: 0,
        component: {
          schemaVersion: 1,
          componentTypeId: 'capture.landing',
          componentInstanceId: instanceId,
          input: { title: 'CAPTURE', locationLabels: ['Capture', 'Documents and Artifacts'] },
          targetKey: 'capture:home',
        },
      },
    };
  }

  test('§4: plus on the active Home tab does nothing (no menu, no second blank)', async ({ page }) => {
    await mount(page);
    // Commit a real Capture Home tab through the launcher policy on a fresh owner.
    await page.evaluate(() => {
      window.__connectedOwnerController.setPolicy('capture-fixture', 'launcher');
      window.__connectedOwnerController.switchWorkspace('ws-2');
    });
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const before = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(before.tabs).toHaveLength(1);
    expect(before.tabs[0].content.component.targetKey).toBe('capture:home');

    // + on the Home tab: nothing happens at all.
    await capturePanel.getByRole('button', { name: 'New fixture tab for capture-fixture' }).click();
    await expect(capturePanel.getByRole('tab')).toHaveCount(1);
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    expect(await collectionFor(page, 'capture-fixture', 'ws-2')).toEqual(before);
    // No launcher ran and no reservation exists: + never opens anything.
    expect(await collectionFor(page, 'capture-fixture', 'ws-2')).toMatchObject({ reservations: [] });
  });

  test('§4: plus on a Document tab creates exactly one Home blank; plus again recenters it', async ({ page }) => {
    await mount(page);
    // Hydrated shape: one Document tab, active, no blank of any kind yet.
    await page.evaluate(({ doc }) => {
      window.__connectedOwnerController.applyTabs('capture-fixture', [doc], doc.tabId);
    }, { doc: fixtureDocumentTab('cap-doc-1', 'cvi-doc-1') });
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('alpha.md');

    // + on the Document tab: the configured blank (Home) is created and activated.
    await capturePanel.getByRole('button', { name: 'New fixture tab for capture-fixture' }).click();
    await expect(capturePanel.getByRole('tab')).toHaveCount(2);
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    let state = await collection(page, 'capture-fixture');
    expect(state.tabs.map((tab: { content: { kind: string; component?: { targetKey: string } } }) => (
      tab.content.kind === 'component' ? tab.content.component.targetKey : tab.content.kind
    ))).toEqual(['fixture-doc:alpha.md', 'capture:home']);
    expect(state.activeTabId).toBe(state.tabs[1].tabId);
    expect(state.reservations).toEqual([]);

    // + again: the existing blank is RECENTERED, never duplicated.
    await capturePanel.getByRole('button', { name: 'New fixture tab for capture-fixture' }).click();
    await expect(capturePanel.getByRole('tab')).toHaveCount(2);
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    state = await collection(page, 'capture-fixture');
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[1].content.component.targetKey).toBe('capture:home');
    expect(state.activeTabId).toBe(state.tabs[1].tabId);
  });

  test('§4: plus on a Document tab creates exactly one Empty blank; plus again recenters it', async ({ page }) => {
    await mount(page);
    await page.evaluate(({ doc }) => {
      window.__connectedOwnerController.applyTabs('file-fixture', [doc], doc.tabId);
    }, { doc: fixtureDocumentTab('file-doc-1', 'fvi-doc-1') });
    const filePanel = page.locator('[data-panel="file-fixture"]');
    await expect(filePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('alpha.md');

    // + on the Document tab: the configured blank (Empty) is created and activated.
    await filePanel.getByRole('button', { name: 'New fixture tab for file-fixture' }).click();
    await expect(filePanel.getByRole('tab')).toHaveCount(2);
    await expect(filePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    let state = await collection(page, 'file-fixture');
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[0].content.component.targetKey).toBe('fixture-doc:alpha.md');
    expect(state.tabs[1].content).toEqual({ kind: 'empty', revision: 0 });
    const blankTabId = state.tabs[1].tabId;
    expect(state.activeTabId).toBe(blankTabId);

    // + again: the existing blank is RECENTERED (same tab), never duplicated.
    await filePanel.getByRole('button', { name: 'New fixture tab for file-fixture' }).click();
    await expect(filePanel.getByRole('tab')).toHaveCount(2);
    await expect(filePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    state = await collection(page, 'file-fixture');
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(blankTabId);
  });

  test('§9: hydration with two Home tabs dedupes to one; hydrated records win over the initial policy', async ({ page }) => {
    await mount(page);
    // Cold-start shape: TWO Home duplicates + a document, the second home active.
    await page.evaluate(({ home1, home2, doc }) => {
      window.__connectedOwnerController.seedFor(
        'capture-fixture',
        'ws-2',
        [home1, doc, home2],
        home2.tabId,
      );
    }, {
      home1: fixtureHomeTab('cap-home-1', 'cvi-home-1'),
      home2: fixtureHomeTab('cap-home-2', 'cvi-home-2'),
      doc: fixtureDocumentTab('cap-doc-1', 'cvi-doc-1'),
    });
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-2'));
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    // Exactly one Home tab survives (the first); the document is intact; and
    // NO initial-policy tab was created (hydrated records win).
    await expect(capturePanel.getByRole('tab')).toHaveCount(2);
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.tabs.map((tab: { tabId: string }) => tab.tabId)).toEqual(['cap-home-1', 'cap-doc-1']);
    expect(state.activeTabId).toBe('cap-home-1');
    expect(state.reservations).toEqual([]);
  });

  test('§9: a lone persisted Home sentinel survives cold start exactly once, identity intact', async ({ page }) => {
    await mount(page);
    await page.evaluate(({ home }) => {
      window.__connectedOwnerController.seedFor('capture-fixture', 'ws-2', [home], home.tabId);
    }, { home: fixtureHomeTab('cap-home-1', 'cvi-home-1') });
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-2'));
    const capturePanel = page.locator('[data-panel="capture-fixture"]');
    await expect(capturePanel.getByRole('tab')).toHaveCount(1);
    await expect(capturePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('CAPTURE');
    const state = await collectionFor(page, 'capture-fixture', 'ws-2');
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].tabId).toBe('cap-home-1');
    expect(state.tabs[0].content.component.targetKey).toBe('capture:home');
    expect(state.activeTabId).toBe('cap-home-1');
  });

  test('§9: hydration with a reserved Empty and a plain Empty keeps exactly the reserved one', async ({ page }) => {
    await mount(page);
    await page.evaluate(({ docValue, plainEmpty, reservedEmpty }) => {
      window.__connectedOwnerController.seedFor(
        'file-fixture',
        'ws-2',
        [reservedEmpty, docValue, plainEmpty],
        docValue.tabId,
        [{
          tabId: reservedEmpty.tabId,
          operationId: 'fvo-reserved-1',
          expectedRevision: 0,
          launcherId: 'file.open',
          status: 'pending',
        }],
      );
    }, {
      docValue: fixtureDocumentTab('file-doc-1', 'fvi-doc-1'),
      plainEmpty: { tabId: 'file-empty-plain', content: { kind: 'empty', revision: 0 } },
      reservedEmpty: { tabId: 'file-empty-reserved', content: { kind: 'empty', revision: 0 } },
    });
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-2'));
    const filePanel = page.locator('[data-panel="file-fixture"]');
    await expect(filePanel.getByRole('tab')).toHaveCount(2);
    const state = await collectionFor(page, 'file-fixture', 'ws-2');
    // The reservation-carrying blank was kept (with its reservation); the
    // plain duplicate was dropped; the document and the active selection are
    // untouched; no initial-policy tab was appended.
    expect(state.tabs.map((tab: { tabId: string }) => tab.tabId)).toEqual([
      'file-empty-reserved',
      'file-doc-1',
    ]);
    expect(state.activeTabId).toBe('file-doc-1');
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0]).toMatchObject({
      tabId: 'file-empty-reserved',
      operationId: 'fvo-reserved-1',
      status: 'pending',
    });
  });

  test('§9: a lone persisted Empty sentinel survives cold start exactly once, reservation intact', async ({ page }) => {
    await mount(page);
    await page.evaluate(({ empty }) => {
      window.__connectedOwnerController.seedFor(
        'file-fixture',
        'ws-2',
        [empty],
        empty.tabId,
        [{
          tabId: empty.tabId,
          operationId: 'fvo-sentinel-1',
          expectedRevision: 0,
          launcherId: 'file.open',
          status: 'pending',
        }],
      );
    }, { empty: { tabId: 'file-empty-1', content: { kind: 'empty', revision: 0 } } });
    await page.evaluate(() => window.__connectedOwnerController.switchWorkspace('ws-2'));
    const filePanel = page.locator('[data-panel="file-fixture"]');
    await expect(filePanel.getByRole('tab')).toHaveCount(1);
    await expect(filePanel.locator('.rv-view-tab-item.is-selected .rv-view-tab-label')).toHaveText('New File Tab');
    const state = await collectionFor(page, 'file-fixture', 'ws-2');
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].tabId).toBe('file-empty-1');
    expect(state.activeTabId).toBe('file-empty-1');
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].tabId).toBe('file-empty-1');
  });
});

test.describe('connected owner harness bundle integrity', () => {
  test('harness bundle builds and mounts in production mode without page errors', async ({ page }) => {
    const pageErrors = await mount(page, 'production');
    expect(pageErrors).toEqual([]);
  });
});
