/**
 * @module e2e/threaded-chat-host.spec
 * @role SPEC-02 Slice 02B gate: composite `{workspaceId, viewId}` populations,
 *       `ThreadRail`/`ThreadedChat` composition, qualified request ownership,
 *       hidden-inactive-panel discipline, late-response correlation, and
 *       restart/readback.
 *
 * Proof strategy:
 *  - source sweeps for the portable rail boundary, the dead un-gated
 *    `ThreadJumpDropdown` removal, and the per-request open correlation;
 *  - the real store + WebSocket handler path for qualified list/open responses
 *    and independent view populations;
 *  - a real Vite-rendered fixture mounting two actual `ViewChatHost` hosts in
 *    two registered views over one workspace, driven by the real handler.
 *
 * No owner workspace, dev database, or port 3001 is used. The isolated config
 * (port 3316, /tmp profile) is only needed for the app-boot lane and is never
 * touched by the rendered fixture.
 */

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.resolve(ROOT, relative), 'utf8');
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /^\s*import\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) specs.push(match[1]);
  return specs;
}

// ── Constants ───────────────────────────────────────────────────────────────

const WORKSPACE = 'threaded-workspace';
const VIEW_A = 'view-alpha';
const VIEW_B = 'view-beta';
const GROUP_A = 'group-alpha';
const GROUP_B = 'group-beta';
const THREAD_A = 'thread-alpha';
const THREAD_B = 'thread-beta';

function projection({
  groupId,
  threadId,
  viewId,
  name,
}: {
  groupId: string;
  threadId: string;
  viewId: string | null;
  name: string;
}) {
  return {
    // Top-level `threadId` makes this a valid mapped row for direct population
    // seeding as well as a server projection for `thread:list`.
    threadId,
    threadGroupId: groupId,
    workspaceId: WORKSPACE,
    viewId,
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

// ── Portable boundary source sweeps ─────────────────────────────────────────

test('ThreadRail is a portable population/menu boundary with no store or socket access', () => {
  const rail = readSource('src/components/chat/ThreadRail.tsx');
  const specs = importSpecifiers(rail);
  const forbidden = [
    'state/panelStore',
    'state/slices',
    'lib/ws',
    'useSidebar',
    'useChatSessionHost',
    'useViewChatHost',
    'chatFileLinkStore',
    'chatComposerDraftStore',
    'services',
    'node:fs',
    'filesystem',
    'tab',
  ];
  for (const spec of specs) {
    for (const token of forbidden) {
      expect(spec, `ThreadRail must not import ${spec}`).not.toContain(token);
    }
  }
  expect(rail).toContain('selectedThreadGroupId');
  expect(rail).toContain('onOpenThread');
  expect(rail).toContain('data-selected');
  expect(rail).toContain('threadGroupId');
  const rowMenu = readSource('src/components/chat/ThreadRailRowMenu.tsx');
  expect(rail).toContain('ThreadRailRowMenu');
  expect(rowMenu).toContain('more_vert');
  expect(rowMenu).toContain('openMenuTree');
  expect(rail).not.toContain("type: 'thread:list'");
  expect(rail).not.toContain("type: 'thread:open'");
});

test('ThreadedChat composes exactly one ThreadRail with one ChatSurface', () => {
  const threaded = readSource('src/components/chat/ThreadedChat.tsx');
  const specs = importSpecifiers(threaded);
  expect(specs).toContain('./ThreadRail');
  expect(specs).toContain('./ChatSurface');
  expect(threaded).toContain('<ThreadRail');
  expect(threaded).toContain('<ChatSurface');
});

test('the connected view host owns qualified list/open correlation and never touches the Legacy store', () => {
  const host = readSource('src/components/chat/useViewChatHost.ts');
  expect(host).toContain("type: 'thread:list', viewId");
  expect(host).toContain('requestThreadOpen');
  expect(host).toContain('threadOpenRequest');
  expect(host).toContain('getThreadGroupPopulation');
  expect(host).toContain('getCurrentThreadGroupId');
  // A view host resolves its session through the shared ChatSurface machinery.
  expect(host).toContain('useChatSessionHost');
  // It must not write the workspace-global current selection.
  expect(host).not.toContain('setCurrentThreadId');
});

test('the dead un-gated ThreadJumpDropdown is removed', () => {
  expect(fs.existsSync(path.resolve(ROOT, 'src/components/ThreadJumpDropdown.tsx'))).toBe(false);
  const sources = [
    'src/components/App.tsx',
    'src/components/Sidebar.tsx',
    'src/components/chat/ThreadRail.tsx',
  ].map(readSource).join('\n');
  expect(sources).not.toContain('ThreadJumpDropdown');
});

test('open-request correlation is per-request/per-population, not a single slot', () => {
  const slice = readSource('src/state/slices/chatSurfaceSlice.ts');
  expect(slice).toContain('pendingThreadOpens');
  expect(slice).toContain('PendingThreadOpenRequest');
  expect(slice).toContain('matchesPendingThreadOpen');
  expect(slice).not.toMatch(/pendingThreadOpen:\s*PendingThreadOpen\s*\|\s*null/);
});

test('thread:list fills only the echoed view population and keeps Legacy explicit', () => {
  const handlers = readSource('src/lib/ws/thread-handlers.ts');
  expect(handlers).toContain('setThreadGroupPopulation');
  expect(handlers).toContain('responseViewId');
  expect(handlers).toContain('responseViewId === null');
  // The Legacy backing store is only mirrored for the null-view response.
  expect(handlers.indexOf('store.setThreads(scoped)')).toBeGreaterThan(
    handlers.indexOf('responseViewId === null'),
  );
});

// ── Store + handler lane (real public path) ─────────────────────────────────

async function freshStore() {
  const { usePanelStore } = await import('../src/state/panelStore');
  usePanelStore.setState({
    activeWorkspaceId: WORKSPACE,
    currentThreadId: null,
    chatActive: false,
    ws: null,
    threads: [],
    projectChats: {},
    threadGroupsByWorkspaceAndView: {},
    currentThreadGroupIdByWorkspaceAndView: {},
    legacyThreadGroupsByWorkspaceId: {},
    currentLegacyThreadGroupIdByWorkspaceId: {},
    pendingThreadOpens: [],
    contextUsageByThread: {},
    tokenUsageByThread: {},
    wireReadyByThread: {},
    harnessSelectionByThread: {},
  } as never);
  return usePanelStore;
}

test('threadId-only historical commands keep the canonical server fallback', async () => {
  const store = await freshStore();
  const sent: Array<Record<string, unknown>> = [];
  store.setState({ ws: {
    readyState: 1,
    send: (raw: string) => { sent.push(JSON.parse(raw) as Record<string, unknown>); },
  } as WebSocket });
  const commands = await import('../src/lib/chat/thread-group-command-controller');
  const address = { workspaceId: WORKSPACE, threadGroupId: '', threadId: THREAD_A };
  expect(commands.renameGroup(address, ' Historical ')).toBe(true);
  expect(commands.copyGroupLink(address)).toBe(true);
  expect(commands.viewGroupMarkdown(address)).toBe(true);
  expect(commands.selectGroupModel(address, { modelId: 'portable-model', variant: null })).toBe(true);
  expect(commands.deleteGroup(address)).toBe(true);
  expect(sent.map((frame) => frame.action)).toEqual([
    'rename', 'copy_link', 'view_markdown', 'set_harness_selection', 'delete',
  ]);
  for (const frame of sent) {
    expect(frame).toMatchObject({ type: 'thread:action', threadId: THREAD_A });
    expect(frame).not.toHaveProperty('threadGroupId');
    expect(typeof frame.requestId).toBe('string');
  }
  expect(sent[0]).toHaveProperty('name', 'Historical');
  expect(sent[3]).toMatchObject({ model: 'portable-model', variant: null });
});

async function loadHandlers() {
  const { handleThreadMessage } = await import('../src/lib/ws/thread-handlers');
  const slice = await import('../src/state/slices/chatSurfaceSlice');
  return { handleThreadMessage, slice };
}

test('thread:list fills only its echoed {workspaceId, viewId} population', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();

  // Same display name in both views proves the key cannot be the label.
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_A,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Alpha' })],
  } as never);
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_B,
    threads: [projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: VIEW_B, name: 'Alpha' })],
  } as never);

  const state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A).map((r) => r.threadGroupId))
    .toEqual([GROUP_A]);
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_B).map((r) => r.threadGroupId))
    .toEqual([GROUP_B]);
  // Legacy population and backing store are untouched by view responses.
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, null)).toEqual([]);
  expect(state.threads).toEqual([]);
  expect(state.currentThreadId).toBeNull();
});

test('a late list/open for view B cannot fill or select view A', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  store.getState().setThreadGroupPopulation(
    WORKSPACE,
    VIEW_A,
    [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Alpha' })],
  );
  store.getState().setCurrentThreadGroupId(WORKSPACE, VIEW_A, GROUP_A);
  store.getState().requestThreadOpen({
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
  });

  // Late list for B with a same-named group and a late open for B.
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_B,
    threads: [projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: VIEW_B, name: 'Alpha' })],
  } as never);
  handleThreadMessage({
    type: 'thread:opened',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    thread: { name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active' },
    exchanges: [],
  } as never);

  const state = store.getState();
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_A)).toBe(GROUP_A);
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A).map((r) => r.threadGroupId))
    .toEqual([GROUP_A]);
  // A view response never steals the global Legacy selection.
  expect(state.currentThreadId).toBeNull();
});

test('thread:opened updates only its own population selection and retires its request', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  store.getState().requestThreadOpen({
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
  });

  handleThreadMessage({
    type: 'thread:opened',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    thread: { name: 'Beta', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active' },
    exchanges: [],
  } as never);

  const state = store.getState();
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_B)).toBe(GROUP_B);
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_A)).toBeNull();
  expect(state.currentThreadId).toBeNull();
  expect(state.pendingThreadOpens).toEqual([]);
});

test('Legacy viewId:null is explicit and never borrows a view population', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  store.getState().setThreadGroupPopulation(
    WORKSPACE,
    VIEW_A,
    [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Alpha' })],
  );

  handleThreadMessage({
    type: 'thread:list',
    viewId: null,
    threads: [projection({ groupId: 'legacy-group', threadId: 'legacy-thread', viewId: null, name: 'Legacy' })],
  } as never);

  const state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, null).map((r) => r.threadGroupId))
    .toEqual(['legacy-group']);
  // Legacy backing store mirrors the null-view population exactly.
  expect(state.threads.map((r) => r.threadGroupId)).toEqual(['legacy-group']);
  // The view population is unchanged and does not leak into Legacy.
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A).map((r) => r.threadGroupId))
    .toEqual([GROUP_A]);
});

test('restart/readback restores keyed populations and selections through the handler path', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();

  // Pre-restart populated/selected state.
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_A,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'A' })],
  } as never);
  store.getState().setCurrentThreadGroupId(WORKSPACE, VIEW_A, GROUP_A);

  // Simulated reload: fresh renderer store, then the real list + open readback.
  store.setState({
    threadGroupsByWorkspaceAndView: {},
    currentThreadGroupIdByWorkspaceAndView: {},
    legacyThreadGroupsByWorkspaceId: {},
    currentLegacyThreadGroupIdByWorkspaceId: {},
    pendingThreadOpens: [],
    threads: [],
    currentThreadId: null,
  } as never);

  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_A,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'A' })],
  } as never);
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_B,
    threads: [projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: VIEW_B, name: 'B' })],
  } as never);
  store.getState().requestThreadOpen({
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
  });
  handleThreadMessage({
    type: 'thread:opened',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    thread: { name: 'A', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active' },
    exchanges: [],
  } as never);
  handleThreadMessage({
    type: 'thread:opened',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    thread: { name: 'B', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active' },
    exchanges: [],
  } as never);

  const state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A).map((r) => r.threadGroupId))
    .toEqual([GROUP_A]);
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_B).map((r) => r.threadGroupId))
    .toEqual([GROUP_B]);
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_A)).toBe(GROUP_A);
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_B)).toBe(GROUP_B);
});

test('accepted rename updates the composite Legacy and view populations, not only threads', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();

  // The same exact session is represented in the Legacy population and in a
  // view population (defensive: the rename must reach every population that
  // contains the thread, not just the one the ack addressed).
  handleThreadMessage({
    type: 'thread:list',
    viewId: null,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: null, name: 'Old' })],
  } as never);
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_A,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Old' })],
  } as never);
  expect(slice.getThreadGroupPopulation(store.getState(), WORKSPACE, null)[0].entry.name).toBe('Old');

  handleThreadMessage({
    type: 'thread:action:completed',
    action: 'rename',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    requestId: 'r1',
    name: 'Renamed',
  } as never);

  const state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, null)[0].entry.name).toBe('Renamed');
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A)[0].entry.name).toBe('Renamed');
  expect(state.threads.find((t) => t.threadId === THREAD_A)?.entry.name).toBe('Renamed');
});

test('accepted delete removes the row and clears the qualified selection', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  store.getState().setThreadGroupPopulation(
    WORKSPACE,
    VIEW_A,
    [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Alpha' })],
  );
  store.getState().setCurrentThreadGroupId(WORKSPACE, VIEW_A, GROUP_A);
  expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, VIEW_A)).toBe(GROUP_A);

  handleThreadMessage({
    type: 'thread:action:completed',
    action: 'delete',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    requestId: 'd1',
  } as never);

  const state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A)).toEqual([]);
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_A)).toBeNull();

  // Legacy selection is cleared too when the deleted session was selected.
  store.getState().setThreadGroupPopulation(
    WORKSPACE,
    null,
    [projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: null, name: 'Legacy' })],
  );
  store.getState().setCurrentThreadGroupId(WORKSPACE, null, GROUP_B);
  store.getState().setCurrentThreadId(THREAD_B);
  expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, null)).toBe(GROUP_B);
  handleThreadMessage({
    type: 'thread:action:completed',
    action: 'delete',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    workspaceId: WORKSPACE,
    viewId: null,
    requestId: 'd2',
  } as never);
  const after = store.getState();
  expect(slice.getThreadGroupPopulation(after, WORKSPACE, null)).toEqual([]);
  expect(slice.getCurrentThreadGroupId(after, WORKSPACE, null)).toBeNull();
  expect(after.currentThreadId).toBeNull();
  expect(after.threads).toEqual([]);
});

test('a row mutation acked for one population never mutates an unrelated population', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_A,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Alpha' })],
  } as never);
  handleThreadMessage({
    type: 'thread:list',
    viewId: VIEW_B,
    threads: [projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: VIEW_B, name: 'Beta' })],
  } as never);
  store.getState().setCurrentThreadGroupId(WORKSPACE, VIEW_B, GROUP_B);

  handleThreadMessage({
    type: 'thread:action:completed',
    action: 'rename',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    requestId: 'r2',
    name: 'Renamed-A',
  } as never);

  let state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A)[0].entry.name).toBe('Renamed-A');
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_B)[0].entry.name).toBe('Beta');

  handleThreadMessage({
    type: 'thread:action:completed',
    action: 'delete',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    requestId: 'd3',
  } as never);

  state = store.getState();
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_A)).toEqual([]);
  expect(slice.getThreadGroupPopulation(state, WORKSPACE, VIEW_B).map((r) => r.threadGroupId))
    .toEqual([GROUP_B]);
  // B's selection is untouched by A's delete.
  expect(slice.getCurrentThreadGroupId(state, WORKSPACE, VIEW_B)).toBe(GROUP_B);
});

test('accepted create inserts into an initialized Legacy population without double-adding', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  handleThreadMessage({
    type: 'thread:list',
    viewId: null,
    threads: [projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: null, name: 'A' })],
  } as never);

  const created = {
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    entry: {
      name: 'B',
      createdAt: '2026-01-02T00:00:00.000Z',
      messageCount: 0,
      status: 'active' as const,
      viewId: null,
    },
  };
  store.getState().addThread(created);
  expect(slice.getThreadGroupPopulation(store.getState(), WORKSPACE, null).map((r) => r.threadGroupId))
    .toEqual([GROUP_B, GROUP_A]);

  // The follow-up list must not double-add.
  handleThreadMessage({
    type: 'thread:list',
    viewId: null,
    threads: [
      projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: null, name: 'B' }),
      projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: null, name: 'A' }),
    ],
  } as never);
  expect(slice.getThreadGroupPopulation(store.getState(), WORKSPACE, null).map((r) => r.threadId))
    .toEqual([THREAD_B, THREAD_A]);
});

// ── Rendered fixture (two real view hosts, real handler) ────────────────────

const bundles = new Map<string, Promise<string>>();

async function buildThreadedHarness(): Promise<string> {
  const existing = bundles.get('fixture');
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:threaded-chat-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const panelStorePath = path.resolve('src/state/panelStore.ts');
    const workspaceStorePath = path.resolve('src/state/workspaceStore.ts');
    const hostPath = path.resolve('src/components/chat/ViewChatHost.tsx');
    const handlersPath = path.resolve('src/lib/ws/thread-handlers.ts');
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};
      import { useWorkspaceStore } from ${JSON.stringify(workspaceStorePath)};
      import { ViewChatHost } from ${JSON.stringify(hostPath)};
      import { handleThreadMessage } from ${JSON.stringify(handlersPath)};

      var WS = ${JSON.stringify(WORKSPACE)};
      var VIEW_A = ${JSON.stringify(VIEW_A)};
      var VIEW_B = ${JSON.stringify(VIEW_B)};
      var sent = [];
      var fakeWs = {
        readyState: 1,
        send: function (data) { try { sent.push(JSON.parse(data)); } catch (e) {} },
        addEventListener: function () {},
        removeEventListener: function () {},
        close: function () {},
      };

      function emptyState(label, surface) {
        return {
          messages: [{ id: label + '-u1', type: 'user', content: label, timestamp: 1 }],
          currentTurn: null,
          pendingTurnEnd: false,
          pendingPromptAcceptance: null,
          retryPromptDraft: null,
          pendingMessage: null,
          segments: [],
          lastReleasedSegmentCount: 0,
          activity: null,
        };
      }

      usePanelStore.setState({
        activeWorkspaceId: WS,
        currentThreadId: null,
        chatActive: false,
        ws: fakeWs,
        threads: [],
        threadGroupsByWorkspaceAndView: {},
        currentThreadGroupIdByWorkspaceAndView: {},
        legacyThreadGroupsByWorkspaceId: {},
        currentLegacyThreadGroupIdByWorkspaceId: {},
        pendingThreadOpens: [],
        projectChats: {
          ${JSON.stringify(THREAD_A)}: emptyState('A-TRUTH'),
          ${JSON.stringify(THREAD_B)}: emptyState('B-TRUTH'),
        },
        contextUsageByThread: {},
        tokenUsageByThread: {},
        wireReadyByThread: {},
        harnessSelectionByThread: {},
        viewStates: {},
      });
      useWorkspaceStore.setState({ hasReceivedInit: true });

      function Fixture() {
        var [aActive, setAActive] = React.useState(true);
        React.useEffect(function () {
          window.__threadedFixture = {
            deliver: function (msg) { return handleThreadMessage(msg); },
            sentRaw: function () { return sent.slice(); },
            setAActive: setAActive,
            aActive: aActive,
            storeState: function () { return JSON.stringify(usePanelStore.getState()); },
          };
        }, [aActive]);
        return React.createElement('div', null,
          React.createElement('div', { id: 'host-a' },
            React.createElement(ViewChatHost, { panel: 'fixture-a', workspaceId: WS, viewId: VIEW_A, isActive: aActive })),
          React.createElement('div', { id: 'host-b' },
            React.createElement(ViewChatHost, { panel: 'fixture-b', workspaceId: WS, viewId: VIEW_B, isActive: !aActive })),
        );
      }

      createRoot(document.querySelector('#root')).render(React.createElement(Fixture));
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'threaded-chat-harness',
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
          output: { format: 'iife', name: 'ThreadedChatHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Threaded chat harness did not build.');
    return chunk.code;
  })();
  bundles.set('fixture', bundle);
  return bundle;
}

async function mountFixture(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await buildThreadedHarness() });
  try {
    await expect(page.locator('[data-threaded-chat]')).toHaveCount(2);
  } catch (error) {
    if (errors.length > 0) throw new Error(errors.join('\n'));
    throw error;
  }
}

async function deliver(page: Page, message: unknown): Promise<void> {
  await page.evaluate((msg) => (
    window as unknown as { __threadedFixture: { deliver: (m: unknown) => void } }
  ).__threadedFixture.deliver(msg), message);
}

const PROJ_A = projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Alpha' });
const PROJ_B = projection({ groupId: GROUP_B, threadId: THREAD_B, viewId: VIEW_B, name: 'Beta' });

test('two view-bound hosts restore independent selected rows and transcripts', async ({ page }) => {
  await mountFixture(page);

  await deliver(page, { type: 'thread:list', viewId: VIEW_A, threads: [PROJ_A] });
  await deliver(page, { type: 'thread:list', viewId: VIEW_B, threads: [PROJ_B] });
  await deliver(page, {
    type: 'thread:opened',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    thread: { name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
    history: [{ role: 'user', content: 'A-TRUTH' }],
    exchanges: [],
  });
  await deliver(page, {
    type: 'thread:opened',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    thread: { name: 'Beta', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
    history: [{ role: 'user', content: 'B-TRUTH' }],
    exchanges: [],
  });

  // Independent selected rows.
  await expect(page.locator('#host-a [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', GROUP_A);
  await expect(page.locator('#host-b [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', GROUP_B);

  // Independent session truth and explicit view binding.
  await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-view-id', VIEW_A);
  await expect(page.locator('#host-b .rv-chat-area')).toHaveAttribute('data-chat-view-id', VIEW_B);
  await expect(page.locator('#host-a .rv-chat-messages')).toContainText('A-TRUTH');
  await expect(page.locator('#host-b .rv-chat-messages')).toContainText('B-TRUTH');
  await expect(page.locator('#host-a .rv-chat-messages')).not.toContainText('B-TRUTH');
});

test('rendered hosts isolate a late list/open for view B from view A', async ({ page }) => {
  await mountFixture(page);
  await deliver(page, { type: 'thread:list', viewId: VIEW_A, threads: [PROJ_A] });
  await deliver(page, { type: 'thread:list', viewId: VIEW_B, threads: [PROJ_B] });
  await deliver(page, {
    type: 'thread:opened',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    thread: { name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
    exchanges: [],
  });
  await expect(page.locator('#host-a [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', GROUP_A);

  // A late response for B (same display name) must not alter A.
  await deliver(page, {
    type: 'thread:list',
    viewId: VIEW_B,
    threads: [projection({ groupId: 'group-beta-2', threadId: 'thread-beta-2', viewId: VIEW_B, name: 'Alpha' })],
  });
  await deliver(page, {
    type: 'thread:opened',
    threadId: 'thread-beta-2',
    threadGroupId: 'group-beta-2',
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    thread: { name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active' },
    exchanges: [],
  });

  await expect(page.locator('#host-a [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', GROUP_A);
  await expect(page.locator('#host-a [data-thread-group-id]')).toHaveCount(1);
  await expect(page.locator('#host-b [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', 'group-beta-2');
});

test('hidden inactive panels issue no list request and do not steal selection', async ({ page }) => {
  await mountFixture(page);

  const sentAtBoot = await page.evaluate(() => (
    window as unknown as { __threadedFixture: { sentRaw: () => Array<{ type: string; viewId?: unknown }> } }
  ).__threadedFixture.sentRaw());
  const listRequests = sentAtBoot.filter((m) => m.type === 'thread:list');
  expect(listRequests).toHaveLength(1);
  expect(listRequests[0].viewId).toBe(VIEW_A);

  // Toggle B active: only B issues its own qualified request.
  await page.evaluate(() => (
    window as unknown as { __threadedFixture: { setAActive: (v: boolean) => void } }
  ).__threadedFixture.setAActive(false));
  await page.waitForTimeout(100);
  const sentAfter = await page.evaluate(() => (
    window as unknown as { __threadedFixture: { sentRaw: () => Array<{ type: string; viewId?: unknown }> } }
  ).__threadedFixture.sentRaw());
  const bRequests = sentAfter.filter((m) => m.type === 'thread:list' && m.viewId === VIEW_B);
  expect(bRequests).toHaveLength(1);
  // A did not issue a duplicate request.
  const aRequests = sentAfter.filter((m) => m.type === 'thread:list' && m.viewId === VIEW_A);
  expect(aRequests).toHaveLength(1);

  // Selecting in B still cannot change A's rendered selection.
  await deliver(page, { type: 'thread:list', viewId: VIEW_A, threads: [PROJ_A] });
  await deliver(page, { type: 'thread:list', viewId: VIEW_B, threads: [PROJ_B] });
  await deliver(page, {
    type: 'thread:opened',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    workspaceId: WORKSPACE,
    viewId: VIEW_A,
    thread: { name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
    exchanges: [],
  });
  await deliver(page, {
    type: 'thread:opened',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    workspaceId: WORKSPACE,
    viewId: VIEW_B,
    thread: { name: 'Beta', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
    exchanges: [],
  });
  await expect(page.locator('#host-a [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', GROUP_A);
  await expect(page.locator('#host-b [data-selected="true"]'))
    .toHaveAttribute('data-thread-group-id', GROUP_B);
});

test('ThreadRail rows emit canonical thread:open and thread:action intents', async ({ page }) => {
  await mountFixture(page);
  await deliver(page, { type: 'thread:list', viewId: VIEW_A, threads: [PROJ_A] });
  await page.evaluate(() => {
    (window as unknown as { confirm: () => boolean }).confirm = () => true;
  });

  // Row open: canonical group open with no surfaceId. Click the row label so
  // the intent is the row open, not the right-edge kebab.
  await page.locator('#host-a .rv-chat-item-text', { hasText: 'Alpha' }).click();
  const afterOpen = await page.evaluate(() => (
    window as unknown as { __threadedFixture: { sentRaw: () => Array<Record<string, unknown>> } }
  ).__threadedFixture.sentRaw());
  const openFrame = afterOpen.find((m) => m.type === 'thread:open');
  expect(openFrame).toMatchObject({ type: 'thread:open', threadGroupId: GROUP_A });
  expect(JSON.stringify(openFrame)).not.toContain('surfaceId');

  // Kebab menu -> Copy Link and Delete are canonical thread:action intents.
  await page.locator('#host-a .rv-thread-menu-btn').first().click();
  await page.getByRole('menu', { name: 'Thread options' }).getByRole('menuitem', { name: 'Copy Link' }).click();
  await page.locator('#host-a .rv-thread-menu-btn').first().click();
  await page.getByRole('menu', { name: 'Thread options' }).getByRole('menuitem', { name: 'Delete' }).click();

  const sent = await page.evaluate(() => (
    window as unknown as { __threadedFixture: { sentRaw: () => Array<Record<string, unknown>> } }
  ).__threadedFixture.sentRaw());
  const copy = sent.find((m) => m.type === 'thread:action' && m.action === 'copy_link');
  const remove = sent.find((m) => m.type === 'thread:action' && m.action === 'delete');
  expect(copy).toMatchObject({ threadGroupId: GROUP_A, threadId: THREAD_A });
  expect(remove).toMatchObject({ threadGroupId: GROUP_A, threadId: THREAD_A });
  expect(JSON.stringify(copy)).not.toContain('surfaceId');
  expect(JSON.stringify(remove)).not.toContain('surfaceId');
});

test('built client boots the real app on the isolated server without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await expect(page.locator('.rv-connection-status').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
