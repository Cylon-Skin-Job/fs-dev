/**
 * @module e2e/thread-worksurface-switching.spec
 * @role CHAT-03 / SPEC-03 §10 03A gate: one-view worksurface continuity.
 *
 * Proof strategy:
 *  - source sweeps for the versioned adapter contract, the focused registry,
 *    the global-writer cutover, and the non-group hydration guard;
 *  - a real Vite-rendered fixture mounting the production `ViewChatHost` for the
 *    File Viewer over the real store, the real worksurface controller, and the
 *    real WebSocket frame handlers, with a deterministic in-fixture server model
 *    driving `state:worksurface_get/put/result/error`;
 *  - restart/readback by remounting the fixture over the same acknowledged
 *    server entries.
 *
 * No owner workspace, dev database, or port 3001 is used. The isolated config
 * (port 3317, /tmp profile) is only needed for the app-boot lane.
 */

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.resolve(ROOT, relative), 'utf8');
}

// ── Constants ───────────────────────────────────────────────────────────────

const WORKSPACE = 'worksurface-workspace';
const VIEW = 'file-viewer';
const GROUP_A = 'group-a';
const GROUP_B = 'group-b';
const THREAD_A = 'thread-a';
const THREAD_B = 'thread-b';

function projection(groupId: string, threadId: string, name: string) {
  return {
    threadId,
    threadGroupId: groupId,
    workspaceId: WORKSPACE,
    viewId: VIEW,
    name,
    currentPrimaryThreadId: threadId,
    currentPrimarySequence: 1,
    memberCount: 1,
    createdAt: 1000,
    updatedAt: 2000,
    entry: {
      name,
      createdAt: '2026-01-01T00:00:00.000Z',
      messageCount: 1,
      status: 'active',
      harnessId: 'opencode',
      harnessConfig: { model: 'm1', variant: 'high' },
    },
  };
}

// ── Source sweeps ───────────────────────────────────────────────────────────

test('the worksurface adapter contract is versioned and JSON-safe', () => {
  const types = readSource('src/lib/worksurface/types.ts');
  expect(types).toContain('interface WorksurfaceAdapter');
  expect(types).toContain('adapterId');
  expect(types).toContain('adapterVersion');
  expect(types).toContain('capture()');
  expect(types).toContain('sanitize(');
  expect(types).toContain('restore(');
  expect(types).toContain('interface ThreadWorksurfaceEntry');
  expect(types).toContain('contentRevision');
  expect(types).toContain('placementRevision');
  expect(types).toContain('managedComponentPlacements');

  const registry = readSource('src/lib/worksurface/registry.ts');
  expect(registry).toContain('registerWorksurfaceAdapter');
  expect(registry).toContain('getWorksurfaceAdapter');
  const builtins = readSource('src/lib/worksurface/builtins.ts');
  expect(builtins).toContain('fileViewerWorksurfaceAdapter');
});

test('no worksurface module or frame carries surfaceId or chat/runtime state', () => {
  const worksurfaceDir = 'src/lib/worksurface';
  const modulePaths = fs.readdirSync(path.resolve(worksurfaceDir))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => `${worksurfaceDir}/${name}`);
  for (const relative of [
    ...modulePaths,
    'src/lib/ws/worksurface-handlers.ts',
  ]) {
    const source = readSource(relative);
    expect(source, `${relative} must not reference surfaceId`).not.toContain('surfaceId');
  }
});

test('group-bound views write through the adapter/controller and never the global activity writer', () => {
  const activity = readSource('src/lib/viewActivity.ts');
  expect(activity).toContain('onViewContentChanged(view)');
  expect(activity).toContain('_persistViewPatch(view, { activity })');
  const explorer = readSource('src/components/file-explorer/FileExplorer.tsx');
  expect(explorer).toContain('getWorksurfaceBinding');
  expect(explorer).toContain('if (worksurfaceBound) return;');
});

// ── Rendered fixture (real hosts, controller, and handlers) ─────────────────

let cachedBundle: Promise<string> | null = null;

async function buildWorksurfaceHarness(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  cachedBundle = (async () => {
    const virtualEntry = 'virtual:thread-worksurface-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const modulePaths = {
      panelStore: path.resolve('src/state/panelStore.ts'),
      workspaceStore: path.resolve('src/state/workspaceStore.ts'),
      fileStore: path.resolve('src/state/fileStore.ts'),
      viewActivity: path.resolve('src/lib/viewActivity.ts'),
      host: path.resolve('src/components/chat/ViewChatHost.tsx'),
      threadHandlers: path.resolve('src/lib/ws/thread-handlers.ts'),
      worksurfaceHandlers: path.resolve('src/lib/ws/worksurface-handlers.ts'),
      controller: path.resolve('src/lib/worksurface/worksurfaceController.ts'),
      builtins: path.resolve('src/lib/worksurface/builtins.ts'),
    };
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { usePanelStore } from ${JSON.stringify(modulePaths.panelStore)};
      import { useWorkspaceStore } from ${JSON.stringify(modulePaths.workspaceStore)};
      import { useFileStore } from ${JSON.stringify(modulePaths.fileStore)};
      import { replaceViewTabs, getViewActivity } from ${JSON.stringify(modulePaths.viewActivity)};
      import { ViewChatHost } from ${JSON.stringify(modulePaths.host)};
      import { handleThreadMessage } from ${JSON.stringify(modulePaths.threadHandlers)};
      import { handleWorksurfaceMessage } from ${JSON.stringify(modulePaths.worksurfaceHandlers)};
      import { resetWorksurfaceController, setWorksurfaceRequestTimeout } from ${JSON.stringify(modulePaths.controller)};
      import ${JSON.stringify(modulePaths.builtins)};

      var WS = ${JSON.stringify(WORKSPACE)};
      var VIEW = ${JSON.stringify(VIEW)};
      var GROUP_A = ${JSON.stringify(GROUP_A)};
      var GROUP_B = ${JSON.stringify(GROUP_B)};
      var THREAD_A = ${JSON.stringify(THREAD_A)};
      var THREAD_B = ${JSON.stringify(THREAD_B)};
      var PROJ_A = ${JSON.stringify(projection(GROUP_A, THREAD_A, 'Alpha'))};
      var PROJ_B = ${JSON.stringify(projection(GROUP_B, THREAD_B, 'Beta'))};

      var sent = [];
      var counter = 0;
      var forcePutError = false;
      var holdNextPutActive = false;
      var heldPutFrame = null;
      var holdPutRemaining = 0;
      var heldPuts = [];
      var holdNextGetActive = false;
      var heldGetFrame = null;
      var server = { entries: {} };

      function mint(prefix) { counter += 1; return prefix + '-' + counter; }

      function deliver(msg) {
        if (handleThreadMessage(msg)) return;
        handleWorksurfaceMessage(msg);
      }

      function replyLater(fn) { setTimeout(fn, 0); }

      function handlePut(frame) {
        var current = server.entries[frame.threadGroupId] || null;
        var currentRev = current ? current.contentRevision : null;
        if (forcePutError) {
          forcePutError = false;
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'content', code: 'revision_conflict',
            entry: current, contentRevision: currentRev, placementRevision: current ? current.placementRevision : null });
          return;
        }
        if (frame.expectedContentRevision !== currentRev) {
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'content', code: 'revision_conflict',
            entry: current, contentRevision: currentRev, placementRevision: current ? current.placementRevision : null });
          return;
        }
        var entry = {
          schemaVersion: 1,
          adapterId: frame.adapterId,
          adapterVersion: frame.adapterVersion,
          contentRevision: mint('cr'),
          placementRevision: current ? current.placementRevision : mint('pr'),
          updatedAt: new Date().toISOString(),
          content: frame.content,
          managedComponentPlacements: current ? current.managedComponentPlacements : {},
        };
        server.entries[frame.threadGroupId] = entry;
        deliver({ type: 'state:worksurface_result', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
          requestId: frame.requestId, workspaceId: WS, lane: 'content', applied: true,
          entry: entry, contentRevision: entry.contentRevision, placementRevision: entry.placementRevision });
      }

      function replyGet(frame) {
        var entry = server.entries[frame.threadGroupId] || null;
        replyLater(function () { deliver({ type: 'state:worksurface_result', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
          requestId: frame.requestId, workspaceId: WS, lane: 'content', entry: entry,
          contentRevision: entry ? entry.contentRevision : null, placementRevision: entry ? entry.placementRevision : null }); });
      }

      function handleClientFrame(frame) {
        if (frame.type === 'thread:list') {
          replyLater(function () { deliver({ type: 'thread:list', viewId: frame.viewId === undefined ? null : frame.viewId, threads: [PROJ_A, PROJ_B] }); });
        } else if (frame.type === 'thread:open') {
          var threadId = frame.threadGroupId === GROUP_B ? THREAD_B : THREAD_A;
          replyLater(function () { deliver({ type: 'thread:opened', threadId: threadId, threadGroupId: frame.threadGroupId,
            workspaceId: WS, viewId: VIEW, thread: { name: 't', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
            history: [{ role: 'user', content: 'hi' }], exchanges: [] }); });
        } else if (frame.type === 'state:worksurface_get') {
          if (holdNextGetActive) { holdNextGetActive = false; heldGetFrame = frame; return; }
          replyGet(frame);
        } else if (frame.type === 'state:worksurface_put') {
          if (holdNextPutActive) { holdNextPutActive = false; heldPutFrame = frame; return; }
          if (holdPutRemaining > 0) { holdPutRemaining -= 1; heldPuts.push(frame); return; }
          replyLater(function () { handlePut(frame); });
        }
      }

      var fakeWs = {
        readyState: 1,
        send: function (data) { var frame = JSON.parse(data); sent.push(frame); handleClientFrame(frame); },
        addEventListener: function () {}, removeEventListener: function () {}, close: function () {},
      };

      function emptyChat(label) {
        return { messages: [{ id: label + '-u1', type: 'user', content: label, timestamp: 1 }],
          currentTurn: null, pendingTurnEnd: false, pendingPromptAcceptance: null,
          retryPromptDraft: null, pendingMessage: null, segments: [], lastReleasedSegmentCount: 0, activity: null };
      }

      function resetStore() {
        resetWorksurfaceController();
        usePanelStore.setState({
          activeWorkspaceId: WS,
          currentPanel: VIEW,
          ws: fakeWs,
          currentThreadId: null,
          chatActive: false,
          threads: [],
          threadGroupsByWorkspaceAndView: { [WS]: { [VIEW]: [PROJ_A, PROJ_B] } },
          currentThreadGroupIdByWorkspaceAndView: {},
          legacyThreadGroupsByWorkspaceId: {},
          currentLegacyThreadGroupIdByWorkspaceId: {},
          pendingThreadOpens: [],
          projectChats: { [THREAD_A]: emptyChat('A'), [THREAD_B]: emptyChat('B') },
          contextUsageByThread: {}, tokenUsageByThread: {}, wireReadyByThread: {}, harnessSelectionByThread: {},
          viewStates: {},
          worksurfaceBindings: {}, worksurfacePendingCaptures: {}, worksurfaceEntries: {},
          worksurfaceRemoteRevisions: {}, worksurfaceWarnings: [],
        });
        useWorkspaceStore.setState({ hasReceivedInit: true });
        useFileStore.getState().reset();
      }

      var gen = 0;
      var root = null;

      function Fixture() {
        return React.createElement('div', { id: 'worksurface-host' },
          React.createElement(ViewChatHost, { panel: VIEW, workspaceId: WS, viewId: VIEW, isActive: true }));
      }

      function render() { gen += 1; root.render(React.createElement(Fixture, { key: gen })); }

      function install() {
        setWorksurfaceRequestTimeout(1500);
        resetStore();
        root = createRoot(document.querySelector('#root'));
        render();
        window.__worksurfaceFixture = {
          deliver: deliver,
          sentRaw: function () { return sent.slice(); },
          clearSent: function () { sent.length = 0; },
          entries: function () { return JSON.parse(JSON.stringify(server.entries)); },
          setEntry: function (groupId, entry) { server.entries[groupId] = entry; },
          failNextPut: function () { forcePutError = true; },
          holdNextPut: function () { holdNextPutActive = true; },
          releasePut: function () {
            holdNextPutActive = false;
            if (heldPutFrame) { var frame = heldPutFrame; heldPutFrame = null; handlePut(frame); }
          },
          holdPuts: function (count) { holdPutRemaining = count; },
          releaseOneHeldPut: function () {
            if (heldPuts.length === 0) return;
            var frame = heldPuts.shift();
            handlePut(frame);
          },
          heldPutCount: function () { return heldPuts.length; },
          holdNextGet: function () { holdNextGetActive = true; },
          releaseGet: function () {
            holdNextGetActive = false;
            if (heldGetFrame) { var frame = heldGetFrame; heldGetFrame = null; replyGet(frame); }
          },
          forceBinding: function (groupId) {
            usePanelStore.getState().setWorksurfaceBinding({
              workspaceId: WS, viewId: VIEW, threadGroupId: groupId,
              adapterId: VIEW, adapterVersion: 1,
              contentRevision: 'forced-cr', placementRevision: 'forced-pr',
            });
          },
          replaceTabs: function (tabs, activeTabId) { replaceViewTabs(VIEW, tabs, activeTabId); },
          activity: function () { return getViewActivity(VIEW); },
          fileTabs: function () { return useFileStore.getState().tabs.map(function (t) { return t.file ? t.file.path : t.id; }); },
          store: function () { var s = usePanelStore.getState(); return {
            currentGroup: (s.currentThreadGroupIdByWorkspaceAndView[WS] || {})[VIEW] || null,
            binding: s.worksurfaceBindings[WS + '::' + VIEW] || null,
            pending: s.worksurfacePendingCaptures[WS + '::' + VIEW] || null,
            warnings: s.worksurfaceWarnings.slice(),
          }; },
          remount: function () { resetStore(); render(); },
        };
      }

      install();
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'thread-worksurface-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === virtualEntry) return resolvedEntry;
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return source;
          return null;
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'ThreadWorksurfaceHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Thread worksurface harness did not build.');
    return chunk.code;
  })();
  return cachedBundle;
}

async function mountFixture(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await buildWorksurfaceHarness() });
  try {
    await expect(page.locator('#worksurface-host [data-threaded-chat]')).toHaveCount(1);
    await expect(page.locator(`[data-thread-group-id="${GROUP_A}"]`)).toHaveCount(1);
  } catch (error) {
    if (errors.length > 0) throw new Error(errors.join('\n'));
    throw error;
  }
}

async function fixtureState(page: Page): Promise<{
  currentGroup: string | null;
  binding: Record<string, unknown> | null;
  pending: Record<string, unknown> | null;
  warnings: string[];
}> {
  return page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { store: () => never } }
  ).__worksurfaceFixture.store());
}

async function sentFrames(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { sentRaw: () => Array<Record<string, unknown>> } }
  ).__worksurfaceFixture.sentRaw());
}

async function fixtureActivity(page: Page): Promise<{ tabs: Array<{ path: string }>; activeTabId: string | null }> {
  return page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { activity: () => never } }
  ).__worksurfaceFixture.activity());
}

function tab(pathname: string, title: string) {
  return {
    id: `${VIEW}:${pathname}`,
    panel: VIEW,
    path: pathname,
    title,
    kind: 'file' as const,
    openedAt: 1,
  };
}

async function waitForGroup(page: Page, groupId: string): Promise<void> {
  await expect.poll(async () => (await fixtureState(page)).currentGroup).toBe(groupId);
}

async function replaceFixtureTabs(
  page: Page,
  tabs: Array<ReturnType<typeof tab>>,
  activeTabId: string,
): Promise<void> {
  await page.evaluate(([nextTabs, nextActive]) => (
    window as unknown as {
      __worksurfaceFixture: { replaceTabs: (t: unknown, a: string) => void };
    }
  ).__worksurfaceFixture.replaceTabs(nextTabs, nextActive), [tabs, activeTabId] as const);
}

async function seedFixtureEntry(
  page: Page,
  groupId: string,
  entry: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(([groupIdArg, entryArg]) => (
    window as unknown as {
      __worksurfaceFixture: { setEntry: (groupId: string, entry: unknown) => void };
    }
  ).__worksurfaceFixture.setEntry(groupIdArg, entryArg), [groupId, entry] as const);
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('two groups retain distinct content and restore selection on switch-back', async ({ page }) => {
  await mountFixture(page);
  // First selection with no entry preserves the established current content.
  await waitForGroup(page, GROUP_A);
  expect((await fixtureActivity(page)).tabs).toEqual([]);

  const tabsA = [tab('ai/A1.md', 'A1.md'), tab('ai/A2.md', 'A2.md')];
  await replaceFixtureTabs(page, tabsA, `${VIEW}:ai/A1.md`);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toContain(GROUP_A);

  await page.locator(`[data-thread-group-id="${GROUP_B}"] .rv-chat-item-text`).click();
  await waitForGroup(page, GROUP_B);
  // B had no entry: the established current content is preserved, not cleared.
  expect((await fixtureActivity(page)).tabs.map((t) => t.path)).toEqual(['ai/A1.md', 'ai/A2.md']);

  const tabsB = [tab('ai/B1.md', 'B1.md'), tab('ai/B2.md', 'B2.md'), tab('ai/B3.md', 'B3.md')];
  await replaceFixtureTabs(page, tabsB, `${VIEW}:ai/B3.md`);
  await expect.poll(async () => (await fixtureState(page)).binding?.threadGroupId).toBe(GROUP_B);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toEqual(
    expect.arrayContaining([GROUP_A, GROUP_B]),
  );

  await page.locator(`[data-thread-group-id="${GROUP_A}"] .rv-chat-item-text`).click();
  await waitForGroup(page, GROUP_A);
  await expect.poll(async () => (await fixtureActivity(page)).tabs.map((t) => t.path))
    .toEqual(['ai/A1.md', 'ai/A2.md']);
  expect((await fixtureActivity(page)).activeTabId).toBe(`${VIEW}:ai/A1.md`);

  const entries = await sentEntries(page);
  expect((entries[GROUP_A].content as { tabs: unknown[] }).tabs).toHaveLength(2);
  expect((entries[GROUP_B].content as { tabs: unknown[] }).tabs).toHaveLength(3);
  expect(JSON.stringify(entries)).not.toContain('surfaceId');
});

test('the global activity writer is cut over while group-bound', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { clearSent: () => void } }
  ).__worksurfaceFixture.clearSent());

  const tabsA = [tab('ai/C1.md', 'C1.md')];
  await replaceFixtureTabs(page, tabsA, `${VIEW}:ai/C1.md`);
  await expect.poll(async () => (await sentFrames(page)).some((f) => f.type === 'state:worksurface_put')).toBe(true);

  const frames = await sentFrames(page);
  // Exactly one owner while group-bound: the adapter/controller content lane.
  expect(frames.some((f) => f.type === 'state:set')).toBe(false);
  const puts = frames.filter((f) => f.type === 'state:worksurface_put');
  for (const put of puts) {
    expect(put.viewId).toBe(VIEW);
    expect(put.threadGroupId).toBe(GROUP_A);
    expect(JSON.stringify(put)).not.toContain('surfaceId');
    expect(JSON.stringify(put)).not.toContain('threadId');
  }
});

test('a rejected switch retains the pending capture and keeps the outgoing group selected', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);
  const tabsA = [tab('ai/D1.md', 'D1.md')];
  await replaceFixtureTabs(page, tabsA, `${VIEW}:ai/D1.md`);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toContain(GROUP_A);

  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { failNextPut: () => void } }
  ).__worksurfaceFixture.failNextPut());
  await page.locator(`[data-thread-group-id="${GROUP_B}"] .rv-chat-item-text`).click();

  await expect.poll(async () => (await fixtureState(page)).warnings).toContain('revision_conflict');
  const state = await fixtureState(page);
  // Outgoing group stays selected; the latest capture is retained for retry.
  expect(state.currentGroup).toBe(GROUP_A);
  expect(state.binding?.threadGroupId).toBe(GROUP_A);
  expect(state.pending).not.toBeNull();
});

test('a content change during an in-flight switch is flushed to the outgoing group, never misfiled', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);
  await replaceFixtureTabs(page, [tab('ai/E1.md', 'E1.md')], `${VIEW}:ai/E1.md`);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toContain(GROUP_A);

  // Hold the switch PUT out of group A so a content change can occur mid-flight.
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { holdNextPut: () => void } }
  ).__worksurfaceFixture.holdNextPut());
  await page.locator(`[data-thread-group-id="${GROUP_B}"] .rv-chat-item-text`).click();
  await replaceFixtureTabs(page, [tab('ai/E2.md', 'E2.md')], `${VIEW}:ai/E2.md`);
  await page.waitForTimeout(100);
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { releasePut: () => void } }
  ).__worksurfaceFixture.releasePut());

  await waitForGroup(page, GROUP_B);
  await expect.poll(async () => {
    const entry = (await sentEntries(page))[GROUP_A];
    return entry ? (entry.content as { tabs: Array<{ path: string }> }).tabs.map((t) => t.path) : null;
  }).toEqual(['ai/E2.md']);

  // The newer outgoing capture was flushed under group A; the incoming group
  // did not inherit it and its entry is created only by a real change.
  const entries = await sentEntries(page);
  expect(entries[GROUP_B]).toBeUndefined();
  expect((await sentFrames(page)).filter((f) => f.type === 'state:worksurface_put'
    && f.threadGroupId === GROUP_B)).toHaveLength(0);
});

test('a content change during an outgoing switch-flush is never discarded or misfiled', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);
  await replaceFixtureTabs(page, [tab('ai/G0.md', 'G0.md')], `${VIEW}:ai/G0.md`);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toContain(GROUP_A);

  // Hold both the switch PUT and the switch-flush PUT it triggers.
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { holdPuts: (n: number) => void } }
  ).__worksurfaceFixture.holdPuts(2));
  await page.locator(`[data-thread-group-id="${GROUP_B}"] .rv-chat-item-text`).click();
  // C1 while the switch PUT is held (deferred persist intent).
  await replaceFixtureTabs(page, [tab('ai/G1.md', 'G1.md')], `${VIEW}:ai/G1.md`);
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { releaseOneHeldPut: () => void } }
  ).__worksurfaceFixture.releaseOneHeldPut()); // switch ack -> flush PUT (C1) now held

  // Outgoing group must still own the surface while its flush is unacknowledged.
  expect((await fixtureState(page)).currentGroup).toBe(GROUP_A);
  // C3 while the flush PUT is held.
  await replaceFixtureTabs(page, [tab('ai/G3.md', 'G3.md')], `${VIEW}:ai/G3.md`);
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { releaseOneHeldPut: () => void } }
  ).__worksurfaceFixture.releaseOneHeldPut()); // flush ack -> live C3 != C1 -> second flush

  await waitForGroup(page, GROUP_B);
  await expect.poll(async () => {
    const entry = (await sentEntries(page))[GROUP_A];
    return entry ? (entry.content as { tabs: Array<{ path: string }> }).tabs.map((t) => t.path) : null;
  }).toEqual(['ai/G3.md']);

  // The incoming group received no put and created no entry; only A was written.
  const entries = await sentEntries(page);
  expect(entries[GROUP_B]).toBeUndefined();
  const putsToB = (await sentFrames(page)).filter(
    (f) => f.type === 'state:worksurface_put' && f.threadGroupId === GROUP_B,
  );
  expect(putsToB).toHaveLength(0);
  // The final acknowledged outgoing capture is the latest change, not C1.
  expect((entries[GROUP_A].content as { tabs: Array<{ path: string }> }).tabs.map((t) => t.path))
    .toEqual(['ai/G3.md']);
});

test('a late read acknowledgement cannot overwrite the selected group or its CAS base', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);
  await replaceFixtureTabs(page, [tab('ai/F1.md', 'F1.md')], `${VIEW}:ai/F1.md`);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toContain(GROUP_A);

  await seedFixtureEntry(page, GROUP_B, {
    schemaVersion: 1,
    adapterId: VIEW,
    adapterVersion: 1,
    contentRevision: 'cr-b',
    placementRevision: 'pr-b',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: {
      tabs: [tab('ai/FB.md', 'FB.md')],
      activeTabId: `${VIEW}:ai/FB.md`,
      navigation: { stack: [], index: -1 },
      recents: [],
    },
    managedComponentPlacements: {},
  });

  // Hold group B's read response, then switch to B so its GET is in flight.
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { holdNextGet: () => void } }
  ).__worksurfaceFixture.holdNextGet());
  await page.locator(`[data-thread-group-id="${GROUP_B}"] .rv-chat-item-text`).click();
  await waitForGroup(page, GROUP_B);
  await expect.poll(async () => (await fixtureState(page)).binding?.threadGroupId).toBe(GROUP_B);
  const beforeTabs = (await fixtureActivity(page)).tabs.map((t) => t.path);
  expect(beforeTabs).not.toEqual(['ai/FB.md']);

  // A later selection lands before the stale read response.
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { forceBinding: (groupId: string) => void } }
  ).__worksurfaceFixture.forceBinding('group-c'));
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { releaseGet: () => void } }
  ).__worksurfaceFixture.releaseGet());
  await page.waitForTimeout(200);

  const state = await fixtureState(page);
  expect(state.binding?.threadGroupId).toBe('group-c');
  expect(state.binding?.contentRevision).toBe('forced-cr');
  // The stale read neither re-rendered group B's content nor overwrote the base.
  expect((await fixtureActivity(page)).tabs.map((t) => t.path)).toEqual(beforeTabs);
});

test('unsupported stored adapter data fails inertly with a classified warning', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);

  const before = [tab('ai/keep.md', 'keep.md')];
  await replaceFixtureTabs(page, before, `${VIEW}:ai/keep.md`);

  // Seed a newer stored schema version for group B, then select it.
  await seedFixtureEntry(page, GROUP_B, {
    schemaVersion: 99,
    adapterId: 'file-viewer',
    adapterVersion: 99,
    contentRevision: 'cr-x',
    placementRevision: 'pr-x',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: { tabs: [{ path: 'ai/forged.md' }], activeTabId: null },
    managedComponentPlacements: {},
  });

  await page.locator(`[data-thread-group-id="${GROUP_B}"] .rv-chat-item-text`).click();
  await waitForGroup(page, GROUP_B);
  await expect.poll(async () => (await fixtureState(page)).warnings).toContain('unsupported_adapter_version');
  // Inert: the current content was preserved, not replaced by forged bytes.
  await expect.poll(async () => (await fixtureActivity(page)).tabs.map((t) => t.path)).toEqual(['ai/keep.md']);
});

test('restart/readback restores exact acknowledged content with no chat-state leakage', async ({ page }) => {
  await mountFixture(page);
  await waitForGroup(page, GROUP_A);

  const tabsA = [tab('ai/R1.md', 'R1.md'), tab('ai/R2.md', 'R2.md')];
  await replaceFixtureTabs(page, tabsA, `${VIEW}:ai/R2.md`);
  await expect.poll(async () => Object.keys(await sentEntries(page))).toContain(GROUP_A);

  const acknowledged = (await sentEntries(page))[GROUP_A] as Record<string, unknown>;
  const serialized = JSON.stringify(acknowledged);
  for (const forbidden of ['surfaceId', 'threadId', 'transcript', 'messages', 'draft', 'attachments', 'runtime']) {
    expect(serialized).not.toContain(forbidden);
  }

  // Remount over the same server entries: the acknowledged content returns.
  await page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { remount: () => void } }
  ).__worksurfaceFixture.remount());
  await expect(page.locator('#worksurface-host [data-threaded-chat]')).toHaveCount(1);
  await waitForGroup(page, GROUP_A);
  await expect.poll(async () => (await fixtureActivity(page)).tabs.map((t) => t.path))
    .toEqual(['ai/R1.md', 'ai/R2.md']);
  expect((await fixtureActivity(page)).activeTabId).toBe(`${VIEW}:ai/R2.md`);
  expect(JSON.stringify(await fixtureActivity(page))).not.toContain('surfaceId');
});

async function sentEntries(page: Page): Promise<Record<string, { content: unknown }>> {
  return page.evaluate(() => (
    window as unknown as { __worksurfaceFixture: { entries: () => never } }
  ).__worksurfaceFixture.entries());
}

test('built client boots the real app on the isolated server without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await expect(page.locator('.rv-connection-status').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

