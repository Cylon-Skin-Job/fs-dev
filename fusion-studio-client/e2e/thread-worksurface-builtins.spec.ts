/**
 * @module e2e/thread-worksurface-builtins.spec
 * @role CHAT-03 / SPEC-03 §10 03D gate: remaining built-in view adapters.
 *
 * Proves the Capture Viewer, Office Viewer, and Email Viewer adapters (plus the
 * policy-ready VIEW-02 connected Capture records lane) over the real controller,
 * real adapter registry, real store, and real frame handlers:
 *   - two groups retain distinct classic content and restore on switch-back;
 *   - first selection with no entry preserves the current/default content;
 *   - unavailable selected content fails inertly with a classified warning;
 *   - the group-bound cutover routes elected content facts into the lane while
 *     non-content facts keep the global writer;
 *   - the production components mount the collapsed group-selection dock.
 *
 * No owner workspace, dev database, or port 3001 is used.
 */

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAPTURE_GROUP_A,
  CAPTURE_GROUP_B,
  CAPTURE_VIEW,
  EMAIL_GROUP_A,
  EMAIL_GROUP_B,
  EMAIL_VIEW,
  FILE_GROUP_A,
  FILE_VIEW,
  fileTab,
  OFFICE_GROUP_A,
  OFFICE_GROUP_B,
  OFFICE_VIEW,
  fixtureStore,
  mountHarness,
  sentFrames,
  serverEntries,
} from './worksurface-harness';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.resolve(ROOT, relative), 'utf8');
}

async function callFixture<T>(page: Page, method: string, args: unknown[] = []): Promise<T> {
  return page.evaluate(([name, methodArgs]) => {
    const record = (window as unknown as {
      __wsFixture: Record<string, (...inner: unknown[]) => unknown>;
    }).__wsFixture;
    return record[name](...(methodArgs as unknown[])) as never;
  }, [method, args] as const) as Promise<T>;
}

async function waitForGroup(page: Page, groupId: string): Promise<void> {
  await expect.poll(async () => (await fixtureStore(page)).currentGroup).toBe(groupId);
}

async function clickGroup(page: Page, groupId: string): Promise<void> {
  await page.locator(`[data-thread-group-id="${groupId}"] .rv-chat-item-text`).click();
}

/** A valid `CaptureTabRecordsDocument` with one component tab + scroll fact. */
function captureRecords(tabId: string, path: string, docScroll: number) {
  return {
    schemaVersion: 1,
    tabs: [{
      tabId,
      content: {
        kind: 'component',
        revision: 1,
        component: {
          schemaVersion: 1,
          componentTypeId: 'capture.document',
          componentInstanceId: `cvi-${tabId}`,
          input: { docScroll, locationLabels: ['Capture', path] },
          targetKey: `capture:${path}`,
        },
      },
    }],
    activeTabId: tabId,
    reservations: [],
  };
}

function worksurfaceEntry(adapterId: string, content: unknown) {
  return {
    schemaVersion: 1,
    adapterId,
    adapterVersion: 1,
    contentRevision: 'seed-cr',
    placementRevision: 'seed-pr',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content,
    managedComponentPlacements: {},
  };
}

// ── Source sweeps ───────────────────────────────────────────────────────────

test('the remaining built-in adapters are registered and the docks are mounted', () => {
  const builtins = readSource('src/lib/worksurface/builtins.ts');
  expect(builtins).toContain('captureViewerWorksurfaceAdapter');
  expect(builtins).toContain('officeViewerWorksurfaceAdapter');
  expect(builtins).toContain('emailViewerWorksurfaceAdapter');

  const captureAdapter = readSource('src/lib/worksurface/captureViewerWorksurfaceAdapter.ts');
  expect(captureAdapter).toContain('sanitize');
  expect(captureAdapter).toContain('restore');
  expect(captureAdapter).not.toContain('surfaceId');
  const officeAdapter = readSource('src/lib/worksurface/officeViewerWorksurfaceAdapter.ts');
  expect(officeAdapter).toContain('sanitize');
  expect(officeAdapter).toContain('restore');
  expect(officeAdapter).not.toContain('surfaceId');

  const capture = readSource('src/components/capture/CaptureTiles.tsx');
  expect(capture).toContain('ViewWorksurfaceDock');
  const office = readSource('src/components/office/OfficeGrid.tsx');
  expect(office).toContain('ViewWorksurfaceDock');
  const email = readSource('src/components/email/EmailGrid.tsx');
  expect(email).toContain('ViewWorksurfaceDock');
  const emailAdapter = readSource('src/lib/worksurface/emailViewerWorksurfaceAdapter.ts');
  expect(emailAdapter).toContain('sanitize');
  expect(emailAdapter).toContain('restore');
  expect(emailAdapter).not.toContain('surfaceId');

  // Cutover: group-bound views route the elected content facts into the lane.
  const captureState = readSource('src/hooks/useDocViewerState.ts');
  expect(captureState).toContain('onViewContentChanged');
  const captureTabs = readSource('src/components/view-tabs/captureTabsController.ts');
  expect(captureTabs).toContain('onViewContentChanged');
  const officePersistence = readSource('src/components/office/officeViewerPersistence.ts');
  expect(officePersistence).toContain('onViewContentChanged');
  expect(officePersistence).toContain('OFFICE_VIEWER_CONTENT_KEYS');
  // M-1 repair: the VIEW-02 compat writers are suppressed while group-bound and
  // the connected records lane is elected + routed through the controller.
  expect(readSource('src/components/view-tabs/captureConnectedTabs.ts')).toContain('isViewWorksurfaceBound');
  expect(readSource('src/components/view-tabs/captureTabsController.ts')).toContain('isViewWorksurfaceBound');
  expect(readSource('src/components/view-tabs/captureConnectedOwnerPorts.ts')).toContain('onViewContentChanged');
  expect(readSource('src/lib/worksurface/viewContentKeys.ts')).toContain('captureTabRecords');
  // Path-reference activity rewrites are gated for bound views too.
  expect(readSource('src/lib/viewCollections.ts')).toContain('onViewContentChanged');
  // A1 hardening: bound views pin their elected top-level keys on global echo.
  expect(readSource('src/lib/ws-client.ts')).toContain('boundViewContentKeys');
});

// ── Capture Viewer ──────────────────────────────────────────────────────────

test('capture-viewer: two groups retain distinct classic content and restore on switch-back', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  await waitForGroup(page, CAPTURE_GROUP_A); // MRU first selection

  await callFixture(page, 'setViewState', [
    CAPTURE_VIEW,
    { docViewerMode: 'active', docViewerActiveSelectedPath: 'docs/a.md', docViewerLastOpenedPath: 'docs/a.md' },
  ]);
  expect(await callFixture<boolean>(page, 'persistContent', [CAPTURE_VIEW])).toBe(true);

  await clickGroup(page, CAPTURE_GROUP_B);
  await waitForGroup(page, CAPTURE_GROUP_B);
  // No entry for B yet: established default/current content is preserved.
  const bDefault = await callFixture<Record<string, unknown>>(page, 'viewState', [CAPTURE_VIEW]);
  expect(bDefault.docViewerActiveSelectedPath).toBe('docs/a.md');

  await callFixture(page, 'setViewState', [
    CAPTURE_VIEW,
    { docViewerMode: 'archive', docViewerArchiveSelectedPath: 'archive/b.md' },
  ]);
  expect(await callFixture<boolean>(page, 'persistContent', [CAPTURE_VIEW])).toBe(true);

  await clickGroup(page, CAPTURE_GROUP_A);
  await waitForGroup(page, CAPTURE_GROUP_A);
  const aRestored = await callFixture<Record<string, unknown>>(page, 'viewState', [CAPTURE_VIEW]);
  expect(aRestored.docViewerMode).toBe('active');
  expect(aRestored.docViewerActiveSelectedPath).toBe('docs/a.md');

  await clickGroup(page, CAPTURE_GROUP_B);
  await waitForGroup(page, CAPTURE_GROUP_B);
  const bRestored = await callFixture<Record<string, unknown>>(page, 'viewState', [CAPTURE_VIEW]);
  expect(bRestored.docViewerMode).toBe('archive');
  expect(bRestored.docViewerArchiveSelectedPath).toBe('archive/b.md');
});

test('capture-viewer: unavailable selected content fails inertly with a classified warning', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  await waitForGroup(page, CAPTURE_GROUP_A);
  // The folder tree is loaded but does not contain the stored selection.
  await callFixture(page, 'seedFileTree', [
    CAPTURE_VIEW,
    'docs',
    [{ name: 'other.md', path: 'docs/other.md', type: 'file' }],
  ]);
  await callFixture(page, 'setEntry', [
    CAPTURE_VIEW,
    CAPTURE_GROUP_A,
    worksurfaceEntry(CAPTURE_VIEW, {
      mode: 'active',
      activeSelectedPath: 'docs/missing.md',
      archiveSelectedPath: null,
      lastOpenedPath: 'docs/missing.md',
      tabs: [],
      activeTabId: null,
      activity: { recents: [], navigation: { stack: [], index: -1 }, tabs: [], activeTabId: null },
    }),
  ]);

  // Re-read acknowledged server truth for the bound group (a reconnect read).
  await callFixture(page, 'reconnect');
  await expect.poll(async () => (await fixtureStore(page)).warnings).toContain('unavailable_content');
  const state = await callFixture<Record<string, unknown>>(page, 'viewState', [CAPTURE_VIEW]);
  // The sanitized value is hydrated; the view's own missing-file resolution
  // renders its empty representation without rebinding the group.
  expect(state.docViewerActiveSelectedPath).toBe('docs/missing.md');
});

test('capture-viewer: the policy-ready connected records lane is group-elected and never globally written while bound', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  await waitForGroup(page, CAPTURE_GROUP_A);
  expect(await callFixture<boolean>(page, 'capturePolicyReady')).toBe(true);

  const recordsA = captureRecords('cvt-a', 'docs/a.md', 111);
  const recordsB = captureRecords('cvt-b', 'docs/b.md', 222);

  // Bind A, change the visible connected tab content/scroll, then switch to B.
  await callFixture(page, 'applyCaptureRecords', [recordsA]);
  await clickGroup(page, CAPTURE_GROUP_B);
  await waitForGroup(page, CAPTURE_GROUP_B);
  await callFixture(page, 'applyCaptureRecords', [recordsB]);

  // Switch-back restores A's exact visible connected records + scroll.
  await clickGroup(page, CAPTURE_GROUP_A);
  await waitForGroup(page, CAPTURE_GROUP_A);
  const restoredA = await callFixture<Record<string, any>>(page, 'viewState', [CAPTURE_VIEW]);
  expect(restoredA.captureTabRecords?.activeTabId).toBe('cvt-a');
  expect(restoredA.captureTabRecords?.tabs[0]?.content?.component?.input?.docScroll).toBe(111);

  await clickGroup(page, CAPTURE_GROUP_B);
  await waitForGroup(page, CAPTURE_GROUP_B);
  const restoredB = await callFixture<Record<string, any>>(page, 'viewState', [CAPTURE_VIEW]);
  expect(restoredB.captureTabRecords?.activeTabId).toBe('cvt-b');
  expect(restoredB.captureTabRecords?.tabs[0]?.content?.component?.input?.docScroll).toBe(222);

  // No global `state:set` ever carried the elected connected content while bound.
  const boundSets = (await sentFrames(page)).filter((frame) => frame.type === 'state:set');
  expect(boundSets.some((frame) => JSON.stringify(frame.state ?? {}).includes('captureTabRecords'))).toBe(false);
  // The group lane persisted the exact visible records per group (restart/readback).
  const entries = await serverEntries(page);
  expect(entries[`${CAPTURE_VIEW}::${CAPTURE_GROUP_A}`]?.content?.captureTabRecords?.activeTabId).toBe('cvt-a');
  expect(entries[`${CAPTURE_VIEW}::${CAPTURE_GROUP_B}`]?.content?.captureTabRecords?.activeTabId).toBe('cvt-b');

  // Unbound (non-group/Legacy): the same connected write keeps the global path.
  await callFixture(page, 'clearBinding', [CAPTURE_VIEW]);
  await callFixture(page, 'clearSent');
  await callFixture(page, 'applyCaptureRecords', [captureRecords('cvt-c', 'docs/c.md', 333)]);
  const unboundSets = (await sentFrames(page)).filter((frame) => frame.type === 'state:set');
  expect(unboundSets.some((frame) => JSON.stringify(frame.state ?? {}).includes('captureTabRecords'))).toBe(true);
});

// ── Office Viewer ───────────────────────────────────────────────────────────

test('office-viewer: two groups retain distinct document navigation and restore on switch-back', async ({ page }) => {
  await mountHarness(page, OFFICE_VIEW);
  await waitForGroup(page, OFFICE_GROUP_A);

  await callFixture(page, 'setViewState', [
    OFFICE_VIEW,
    { officeViewerMode: 'home', officeViewerCurrentFolder: 'docs', officeViewerSelectedPath: 'docs/a.md' },
  ]);
  expect(await callFixture<boolean>(page, 'persistContent', [OFFICE_VIEW])).toBe(true);

  await clickGroup(page, OFFICE_GROUP_B);
  await waitForGroup(page, OFFICE_GROUP_B);
  const bDefault = await callFixture<Record<string, unknown>>(page, 'viewState', [OFFICE_VIEW]);
  expect(bDefault.officeViewerSelectedPath).toBe('docs/a.md');

  await callFixture(page, 'setViewState', [
    OFFICE_VIEW,
    { officeViewerMode: 'archive', officeViewerCurrentFolder: 'archive', officeViewerSelectedPath: 'archive/b.md', officeDocumentSidePanel: 'files' },
  ]);
  expect(await callFixture<boolean>(page, 'persistContent', [OFFICE_VIEW])).toBe(true);

  await clickGroup(page, OFFICE_GROUP_A);
  await waitForGroup(page, OFFICE_GROUP_A);
  const aRestored = await callFixture<Record<string, unknown>>(page, 'viewState', [OFFICE_VIEW]);
  expect(aRestored.officeViewerMode).toBe('home');
  expect(aRestored.officeViewerSelectedPath).toBe('docs/a.md');
  expect(aRestored.officeDocumentSidePanel).toBe('none');

  await clickGroup(page, OFFICE_GROUP_B);
  await waitForGroup(page, OFFICE_GROUP_B);
  const bRestored = await callFixture<Record<string, unknown>>(page, 'viewState', [OFFICE_VIEW]);
  expect(bRestored.officeViewerMode).toBe('archive');
  expect(bRestored.officeViewerSelectedPath).toBe('archive/b.md');
  expect(bRestored.officeDocumentSidePanel).toBe('files');
});

test('office-viewer: unsupported stored adapter data fails inertly with a classified warning', async ({ page }) => {
  await mountHarness(page, OFFICE_VIEW);
  await waitForGroup(page, OFFICE_GROUP_A);
  await callFixture(page, 'setViewState', [OFFICE_VIEW, { officeViewerSelectedPath: 'default.md' }]);
  await callFixture(page, 'setEntry', [
    OFFICE_VIEW,
    OFFICE_GROUP_A,
    worksurfaceEntry(OFFICE_VIEW, { mode: 'home' }),
  ]);
  // Make the stored entry an unsupported future schema version.
  await page.evaluate(([viewId, groupId]) => {
    const fixture = (window as unknown as {
      __wsFixture: { setEntry: (v: string, g: string, e: unknown) => void };
    }).__wsFixture;
    fixture.setEntry(viewId, groupId, {
      schemaVersion: 99,
      adapterId: viewId,
      adapterVersion: 99,
      contentRevision: 'future-cr',
      placementRevision: 'future-pr',
      updatedAt: '2026-01-01T00:00:00.000Z',
      content: { mode: 'home' },
      managedComponentPlacements: {},
    });
  }, [OFFICE_VIEW, OFFICE_GROUP_A] as const);

  await callFixture(page, 'reconnect');
  await expect.poll(async () => (await fixtureStore(page)).warnings).toContain('unsupported_adapter_version');
  const warnings = (await fixtureStore(page)).warnings;
  expect(warnings).toContain('unsupported_adapter_version');
  // Inert: the view keeps its current/default content instead of rewriting.
  const state = await callFixture<Record<string, unknown>>(page, 'viewState', [OFFICE_VIEW]);
  expect(state.officeViewerSelectedPath).toBe('default.md');
});

test('office-viewer: the group-bound cutover routes content but keeps non-content facts global', async ({ page }) => {
  await mountHarness(page, OFFICE_VIEW);
  await waitForGroup(page, OFFICE_GROUP_A);
  await callFixture(page, 'clearSent');

  await callFixture(page, 'persistOfficePatch', [
    { officeViewerMode: 'archive', officeDocumentSidePanel: 'files', officePaperBrightness: 0.5 },
  ]);
  await expect.poll(async () => (await sentFrames(page)).some((frame) => frame.type === 'state:worksurface_put')).toBe(true);
  const sent = await sentFrames(page);
  const worksurfacePut = sent.find((frame) => frame.type === 'state:worksurface_put');
  expect(worksurfacePut).toBeTruthy();
  expect((worksurfacePut?.content as Record<string, unknown>)?.mode).toBe('archive');
  expect((worksurfacePut?.content as Record<string, unknown>)?.sidePanel).toBe('files');

  const stateSet = sent.filter((frame) => frame.type === 'state:set');
  expect(stateSet).toHaveLength(1);
  expect(stateSet[0].state).toEqual({ officePaperBrightness: 0.5 });
});

test('group-bound views route path-reference activity rewrites into the lane, never the global writer', async ({ page }) => {
  await mountHarness(page, FILE_VIEW);
  await waitForGroup(page, FILE_GROUP_A); // bound
  await callFixture(page, 'replaceTabs', [[fileTab('ai/a.md', 'a.md')], `${FILE_VIEW}:ai/a.md`]);
  expect(await callFixture<boolean>(page, 'persistContent', [FILE_VIEW])).toBe(true);
  await callFixture(page, 'clearSent');

  // Bound: a file rename rewrite of `activity` routes into the group lane.
  await callFixture(page, 'rewritePathReferences', [{
    panel: FILE_VIEW,
    path: 'ai/a.md',
    nextPanel: FILE_VIEW,
    nextPath: 'ai/b.md',
    title: 'b.md',
  }]);
  const boundSent = await sentFrames(page);
  expect(boundSent.some((frame) => frame.type === 'state:worksurface_put')).toBe(true);
  expect(
    boundSent.filter((frame) => frame.type === 'state:set')
      .some((frame) => JSON.stringify(frame.state ?? {}).includes('"activity"')),
  ).toBe(false);

  // Unbound (non-group/Legacy): the same rewrite keeps the global path.
  await callFixture(page, 'clearBinding', [FILE_VIEW]);
  await callFixture(page, 'clearSent');
  await callFixture(page, 'rewritePathReferences', [{
    panel: FILE_VIEW,
    path: 'ai/b.md',
    nextPanel: FILE_VIEW,
    nextPath: 'ai/c.md',
    title: 'c.md',
  }]);
  const unboundSent = await sentFrames(page);
  expect(
    unboundSent.filter((frame) => frame.type === 'state:set')
      .some((frame) => JSON.stringify(frame.state ?? {}).includes('"activity"')),
  ).toBe(true);
});

test('capture-viewer: the VIEW-02 classic conversion/handoff writer is suppressed while group-bound', async ({ page }) => {
  await mountHarness(page, CAPTURE_VIEW);
  await waitForGroup(page, CAPTURE_GROUP_A); // bound
  const docTab = {
    id: 't1',
    kind: 'doc',
    path: 'docs/a.md',
    name: 'a.md',
    extension: 'md',
    ui: {
      mode: 'active',
      lastOpenedPath: 'docs/a.md',
      byMode: {
        active: { selectedPath: 'docs/a.md', gridScroll: 0, docScroll: 0 },
        archive: { selectedPath: null, gridScroll: 0, docScroll: 0 },
      },
    },
  };
  await callFixture(page, 'setViewState', [
    CAPTURE_VIEW,
    { docViewerTabs: [docTab], docViewerActiveTabId: 't1' },
  ]);
  await callFixture(page, 'clearSent');

  // Bound: the conversion must not move the elected classic tab facts into the
  // VIEW-02 records lane or write them through the global writer.
  const appliedWhileBound = await callFixture<boolean>(page, 'applyClassicConversion');
  expect(appliedWhileBound).toBe(false);
  expect((await sentFrames(page)).some((frame) => frame.type === 'state:set')).toBe(false);

  // Unbound (non-group/Legacy): the same compatibility transition runs.
  await callFixture(page, 'clearBinding', [CAPTURE_VIEW]);
  const appliedWhileUnbound = await callFixture<boolean>(page, 'applyClassicConversion');
  expect(appliedWhileUnbound).toBe(true);
});

// ── Email Viewer ────────────────────────────────────────────────────────────

test('email-viewer: two groups retain distinct document navigation and restore on switch-back', async ({ page }) => {
  await mountHarness(page, EMAIL_VIEW);
  await waitForGroup(page, EMAIL_GROUP_A);

  await callFixture(page, 'setViewState', [
    EMAIL_VIEW,
    { emailViewerMode: 'inbox', emailViewerCurrentFolder: 'inbox', emailViewerSelectedPath: 'inbox/a.md' },
  ]);
  expect(await callFixture<boolean>(page, 'persistContent', [EMAIL_VIEW])).toBe(true);

  await clickGroup(page, EMAIL_GROUP_B);
  await waitForGroup(page, EMAIL_GROUP_B);
  const bDefault = await callFixture<Record<string, unknown>>(page, 'viewState', [EMAIL_VIEW]);
  expect(bDefault.emailViewerSelectedPath).toBe('inbox/a.md');

  await callFixture(page, 'setViewState', [
    EMAIL_VIEW,
    { emailViewerMode: 'drafts', emailViewerCurrentFolder: 'drafts', emailViewerSelectedPath: 'drafts/b.md', emailDocumentSidePanel: 'files' },
  ]);
  expect(await callFixture<boolean>(page, 'persistContent', [EMAIL_VIEW])).toBe(true);

  await clickGroup(page, EMAIL_GROUP_A);
  await waitForGroup(page, EMAIL_GROUP_A);
  const aRestored = await callFixture<Record<string, unknown>>(page, 'viewState', [EMAIL_VIEW]);
  expect(aRestored.emailViewerMode).toBe('inbox');
  expect(aRestored.emailViewerSelectedPath).toBe('inbox/a.md');

  await clickGroup(page, EMAIL_GROUP_B);
  await waitForGroup(page, EMAIL_GROUP_B);
  const bRestored = await callFixture<Record<string, unknown>>(page, 'viewState', [EMAIL_VIEW]);
  expect(bRestored.emailViewerMode).toBe('drafts');
  expect(bRestored.emailViewerSelectedPath).toBe('drafts/b.md');
  expect(bRestored.emailDocumentSidePanel).toBe('files');
});

test('email-viewer: the group-bound cutover routes content but keeps brightness global', async ({ page }) => {
  await mountHarness(page, EMAIL_VIEW);
  await waitForGroup(page, EMAIL_GROUP_A);
  await callFixture(page, 'clearSent');

  await callFixture(page, 'persistEmailPatch', [
    { emailViewerMode: 'sent', emailDocumentSidePanel: 'files', emailPaperBrightness: 0.4 },
  ]);
  await expect.poll(async () => (await sentFrames(page)).some((frame) => frame.type === 'state:worksurface_put')).toBe(true);
  const sent = await sentFrames(page);
  const worksurfacePut = sent.find((frame) => frame.type === 'state:worksurface_put');
  expect((worksurfacePut?.content as Record<string, unknown>)?.mode).toBe('sent');
  expect((worksurfacePut?.content as Record<string, unknown>)?.sidePanel).toBe('files');

  const stateSet = sent.filter((frame) => frame.type === 'state:set');
  expect(stateSet).toHaveLength(1);
  expect(stateSet[0].state).toEqual({ emailPaperBrightness: 0.4 });
});

// ── Shared invariants ───────────────────────────────────────────────────────

test('office-viewer: no worksurface lane carries surfaceId or chat runtime state', async ({ page }) => {
  await mountHarness(page, OFFICE_VIEW);
  await waitForGroup(page, OFFICE_GROUP_A);
  await callFixture(page, 'setViewState', [OFFICE_VIEW, { officeViewerSelectedPath: 'docs/a.md' }]);
  await callFixture(page, 'persistContent', [OFFICE_VIEW]);
  const sent = await sentFrames(page);
  const serialized = JSON.stringify(sent.filter((frame) => frame.type === 'state:worksurface_put'));
  expect(serialized).not.toContain('surfaceId');
  expect(serialized).not.toContain('transcript');
});
