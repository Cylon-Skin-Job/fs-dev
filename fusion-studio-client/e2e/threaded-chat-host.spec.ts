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

/** Transport adapter for this projection fixture; real send admission still runs. */
async function installFixtureTransport(socket: WebSocket) {
  const { installProductSendCapability, retireProductSendCapability } = await import('../src/lib/ws/product-send');
  const binding = { workspaceId: WORKSPACE, workspaceEpoch: 'fixture-epoch', bindingRevision: 1, bindingSerial: 1 };
  const capability = {
    socket, generation: 'threaded-fixture', isAuthenticated: () => true,
    captureBinding: (workspaceId: string) => workspaceId === WORKSPACE ? binding : null,
    isBindingCurrent: (captured: typeof binding) => captured === binding,
    sendProductResult: (serialized: string, _policy: unknown, stillCurrent: () => boolean) => {
      if (!stillCurrent()) return { status: 'not_enqueued', reason: 'stale_binding' } as const;
      socket.send(serialized);
      return { status: 'enqueued', destination: 'socket' } as const;
    },
  };
  installProductSendCapability(capability);
  return () => retireProductSendCapability(capability);
}

test('threadId-only historical commands keep the canonical server fallback', async () => {
  const store = await freshStore();
  const sent: Array<Record<string, unknown>> = [];
  store.setState({ ws: {
    readyState: 1,
    send: (raw: string) => { sent.push(JSON.parse(raw) as Record<string, unknown>); },
  } as WebSocket });
  const retireTransport = await installFixtureTransport(store.getState().ws!);
  try {
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
  } finally { retireTransport(); }
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

test('ordinary New Chat selects the accepted view group without rewriting Legacy or content state', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  const contentState = { docViewerMode: 'active', currentThreadId: 'legacy-selected' };
  store.setState({ currentPanel: VIEW_B, currentThreadId: 'legacy-selected',
    viewStates: { [VIEW_B]: contentState } } as never);
  const oldRow = projection({ groupId: GROUP_A, threadId: THREAD_A, viewId: VIEW_A, name: 'Old' });
  const newRow = projection({ groupId: 'new-group', threadId: 'new-thread', viewId: VIEW_A, name: 'New' });
  store.getState().setThreadGroupPopulation(WORKSPACE, VIEW_A, [oldRow]);
  store.getState().setCurrentThreadGroupId(WORKSPACE, VIEW_A, GROUP_A);
  store.getState().setCurrentThreadGroupId(WORKSPACE, VIEW_B, GROUP_B);

  // The production rail/header emits an uncorrelated New Chat command. Its
  // accepted create arrives before the refreshed list and automatic open.
  handleThreadMessage({ type: 'thread:created', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: newRow.threadGroupId, threadId: newRow.threadId, thread: newRow.entry } as never);
  expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, VIEW_A)).toBe(GROUP_A);
  handleThreadMessage({ type: 'thread:list', viewId: VIEW_A, threads: [newRow, oldRow] } as never);
  handleThreadMessage({ type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: newRow.threadGroupId, threadId: newRow.threadId, thread: newRow.entry,
    exchanges: [] } as never);

  expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, VIEW_A)).toBe('new-group');
  expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, VIEW_B)).toBe(GROUP_B);
  expect(store.getState().currentThreadId).toBe('legacy-selected');
  expect(store.getState().viewStates[VIEW_B]).toBe(contentState);
  expect(store.getState().pendingThreadOpens).toEqual([]);
});

test('New Chat in Capture keeps the outgoing group until its content save is acknowledged', async () => {
  const store = await freshStore();
  const { handleThreadMessage, slice } = await loadHandlers();
  const controller = await import('../src/lib/worksurface/worksurfaceController');
  const { getWorksurfaceBinding } = await import('../src/state/slices/worksurfaceSlice');
  const viewId = 'capture-viewer';
  const frames: Array<Record<string, unknown>> = [];
  const socket = { readyState: 1, send: (raw: string) => frames.push(JSON.parse(raw)) } as WebSocket;
  store.setState({ ws: socket, worksurfaceBindings: {}, worksurfacePendingCaptures: {},
    worksurfaceConflicts: {}, viewStates: { [viewId]: { docViewerMode: 'active' } } } as never);
  controller.resetWorksurfaceController();
  const retireTransport = await installFixtureTransport(socket);
  try {
    const oldRow = projection({ groupId: GROUP_A, threadId: THREAD_A, viewId, name: 'Old' });
    const newRow = projection({ groupId: 'new-group', threadId: 'new-thread', viewId, name: 'New' });
    store.getState().setThreadGroupPopulation(WORKSPACE, viewId, [oldRow]);
    store.getState().setCurrentThreadGroupId(WORKSPACE, viewId, GROUP_A);
    controller.bindViewWorksurface(WORKSPACE, viewId, GROUP_A, viewId, 1, 'old-revision', null);
    handleThreadMessage({ type: 'thread:created', workspaceId: WORKSPACE, viewId,
      threadGroupId: newRow.threadGroupId, threadId: newRow.threadId, thread: newRow.entry } as never);
    const opened = { type: 'thread:opened', workspaceId: WORKSPACE, viewId,
      threadGroupId: newRow.threadGroupId, threadId: newRow.threadId, thread: newRow.entry, exchanges: [] };
    handleThreadMessage(opened as never);
    expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, viewId)).toBe(GROUP_A);
    expect(getWorksurfaceBinding(store.getState(), WORKSPACE, viewId)?.threadGroupId).toBe(GROUP_A);
    const put = frames.find((frame) => frame.type === 'state:worksurface_put');
    expect(put).toMatchObject({ viewId, threadGroupId: GROUP_A, expectedContentRevision: 'old-revision' });
    expect(frames.some((frame) => frame.type === 'state:set')).toBe(false);
    controller.handleWorksurfaceResultFrame({ type: 'state:worksurface_result', workspaceId: WORKSPACE,
      viewId, threadGroupId: GROUP_A, requestId: put!.requestId as string,
      lane: 'content', contentRevision: 'saved-revision', placementRevision: null });
    expect(slice.getCurrentThreadGroupId(store.getState(), WORKSPACE, viewId)).toBe('new-group');
    expect(getWorksurfaceBinding(store.getState(), WORKSPACE, viewId)?.threadGroupId).toBe('new-group');
    expect(frames).toContainEqual({ type: 'thread:open', threadGroupId: 'new-group' });
    expect(frames).toContainEqual(expect.objectContaining({ type: 'state:worksurface_get', threadGroupId: 'new-group' }));
    handleThreadMessage(opened as never);
    expect(store.getState().pendingThreadOpens).toEqual([]);
  } finally {
    retireTransport();
    controller.resetWorksurfaceController();
    store.setState({ worksurfaceBindings: {}, worksurfacePendingCaptures: {}, worksurfaceConflicts: {} });
  }
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
    const productSendPath = path.resolve('src/lib/ws/product-send.ts');
    const screenshotPath = path.resolve('src/screenshots/chatScreenshotCapture.ts');
    const consumerPath = path.resolve('src/lib/chat-action-controller.ts');
    const attachmentPath = path.resolve('src/state/chatFileLinkStore.ts');
    const componentMountPath = path.resolve('src/components/chat/ChatSurfaceComponentMount.tsx');
    const toastPath = path.resolve('src/lib/toast.ts');
    const workspacePanelPath = path.resolve('src/components/WorkspacePanel.tsx');
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const registrationPath = path.resolve('src/components/chat/chatComponentRegistration.tsx');
    const resolverPath = path.resolve('src/components/view-tabs/componentTabResolver.ts');
    const virtualAdapters = '\0virtual:threaded-screenshot-workspace-adapters';
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};
      import { useWorkspaceStore } from ${JSON.stringify(workspaceStorePath)};
      import { ViewChatHost } from ${JSON.stringify(hostPath)};
      import { handleThreadMessage } from ${JSON.stringify(handlersPath)};
      import { installProductSendCapability } from ${JSON.stringify(productSendPath)};
      import { captureAndAttachScreenshot } from ${JSON.stringify(screenshotPath)};
      import { installChatActionConsumer } from ${JSON.stringify(consumerPath)};
      import { useChatFileLinkStore } from ${JSON.stringify(attachmentPath)};
      import { ChatSurfaceComponentMount } from ${JSON.stringify(componentMountPath)};
      import { registerToastSetter } from ${JSON.stringify(toastPath)};
      import { WorkspacePanel } from ${JSON.stringify(workspacePanelPath)};

      var WS = ${JSON.stringify(WORKSPACE)};
      var VIEW_A = ${JSON.stringify(VIEW_A)};
      var VIEW_B = ${JSON.stringify(VIEW_B)};
      var sent = [];
      var captures = 0;
      var finishCapture = null;
      var toasts = [];
      window.electronAPI = { capturePage: function () {
        captures += 1;
        return new Promise(function (resolve) { finishCapture = resolve; });
      } };
      registerToastSetter(function (message) { toasts.push(message); });
      useChatFileLinkStore.setState({ pendingAttachmentsByOwner: {} });
      var fakeWs = new EventTarget();
      Object.assign(fakeWs, {
        readyState: 1,
        send: function (data) { try { sent.push(JSON.parse(data)); } catch (e) {} },
        close: function () {},
      });
      // This isolated host fixture has no ws-client connection lifecycle.
      // Supply its transport capability instead of bypassing product-send.
      var binding = { workspaceId: WS, workspaceEpoch: 'fixture-epoch', bindingRevision: 1, bindingSerial: 1 };
      installProductSendCapability({ socket: fakeWs, generation: 'threaded-fixture',
        isAuthenticated: function () { return true; },
        captureBinding: function (id) { return id === WS ? binding : null; },
        isBindingCurrent: function (captured) { return captured === binding; },
        sendProductResult: function (serialized, policy, stillCurrent) {
          if (!stillCurrent()) return { status: 'not_enqueued', reason: 'stale_binding' };
          fakeWs.send(serialized);
          return { status: 'enqueued', destination: 'socket' };
        },
      });

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
        currentPanel: VIEW_A,
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
        worksurfaceEntries: {},
      });
      useWorkspaceStore.setState({ hasReceivedInit: true, activeWorkspaceId: WS, workspaceEpoch: 'fixture-epoch', bindingSerial: 1, bindingRevision: 1 });
      installChatActionConsumer();

      function seedComponentPlacement(host, threadId) {
        usePanelStore.setState(state => ({ projectChats: { ...state.projectChats, [threadId]: { messages: [], currentTurn: null, pendingTurnEnd: false, segments: [], lastReleasedSegmentCount: 0, pendingSavedExchanges: {}, pendingExchangeSaveTurnId: null, activity: null } } }));
        var descriptor = { schemaVersion: 1, componentTypeId: 'fusion.chat-surface',
          componentInstanceId: 'screenshot-component', input: {
            workspaceId: WS, viewId: VIEW_A, threadGroupId: ${JSON.stringify(GROUP_A)},
            threadId: threadId, host: host,
          } };
        usePanelStore.getState().setWorksurfaceEntry(WS, VIEW_A, ${JSON.stringify(GROUP_A)}, {
          schemaVersion: 1, adapterId: 'fixture', adapterVersion: 1, contentRevision: 'c1',
          placementRevision: 'p1', updatedAt: '2026-01-01T00:00:00.000Z', content: null,
          managedComponentPlacements: { 'screenshot-side': {
            placementId: 'screenshot-side', disposition: 'open',
            updatedAt: '2026-01-01T00:00:00.000Z', descriptor: descriptor,
          } },
        });
        return descriptor;
      }

      function Fixture() {
        var [aActive, setAActive] = React.useState(true);
        var [aMounted, setAMounted] = React.useState(true);
        var [aView, setAView] = React.useState(VIEW_A);
        var [component, setComponent] = React.useState(null);
        var [workspaceComponent, setWorkspaceComponent] = React.useState(false);
        var currentPanel = usePanelStore(function (state) { return state.currentPanel; });
        React.useEffect(function () {
          window.__threadedFixture = {
            deliver: function (msg) { return handleThreadMessage(msg); },
            sentRaw: function () { return sent.slice(); },
            setAActive: setAActive,
            setAMounted: setAMounted,
            setAView: setAView,
            setState: function (partial) { usePanelStore.setState(partial); },
            setCurrentPanel: function (panel) { usePanelStore.getState().setCurrentPanel(panel); },
            finishCapture: function () { if (finishCapture) finishCapture('fixture-png-base64'); },
            saved: function (requestId, savedPath) {
              fakeWs.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({
                type: 'screenshot:file-captured', requestId: requestId, savedPath: savedPath,
              }) }));
            },
            globalCapture: function () { void captureAndAttachScreenshot(); },
            screenshotState: function () { return {
              captures: captures, toasts: toasts.slice(),
              requests: sent.filter(function (frame) { return frame.type === 'screenshot:file-capture'; }),
              attachments: useChatFileLinkStore.getState().pendingAttachmentsByOwner,
            }; },
            seedComponent: function (host, threadId) {
              setComponent(seedComponentPlacement(host, threadId));
            },
            seedWorkspaceComponent: function (host, threadId) {
              window.__threadedWorkspaceDescriptor = seedComponentPlacement(host, threadId);
              setWorkspaceComponent(true);
            },
            closeComponent: function () {
              var entry = usePanelStore.getState().worksurfaceEntries[WS + '::' + VIEW_A + '::' + ${JSON.stringify(GROUP_A)}];
              var record = entry.managedComponentPlacements['screenshot-side'];
              usePanelStore.getState().setWorksurfaceEntry(WS, VIEW_A, ${JSON.stringify(GROUP_A)},
                Object.assign({}, entry, { managedComponentPlacements: {
                  'screenshot-side': Object.assign({}, record, { disposition: 'closed' }),
                } }));
            },
            unmountComponent: function () { setComponent(null); },
            aActive: aActive,
            storeState: function () { return JSON.stringify(usePanelStore.getState()); },
          };
        }, [aActive, aMounted, aView, component, workspaceComponent]);
        return React.createElement('div', null,
          React.createElement('div', { id: 'host-a' },
            aMounted ? React.createElement(ViewChatHost, { panel: 'fixture-a', workspaceId: WS, viewId: aView, isActive: aActive }) : null),
          React.createElement('div', { id: 'host-b' },
            React.createElement(ViewChatHost, { panel: 'fixture-b', workspaceId: WS, viewId: VIEW_B, isActive: !aActive })),
          React.createElement('div', { id: 'host-component' },
            component ? React.createElement(ChatSurfaceComponentMount, { descriptor: component }) : null),
          React.createElement('div', { id: 'host-workspace-component' },
            workspaceComponent ? React.createElement(WorkspacePanel, {
              panelId: VIEW_A, isActive: currentPanel === VIEW_A,
            }) : null),
        );
      }

      createRoot(document.querySelector('#root')).render(React.createElement(Fixture));
    `;
    // Control only the tab adapter. Retention/activity is the real
    // WorkspacePanel -> ContentArea -> ViewTabBar -> component resolver path.
    const adapterSource = `
      import { createFirstPartyComponentResolver } from ${JSON.stringify(resolverPath)};
      import { chatConnectedRegistrations } from ${JSON.stringify(registrationPath)};
      var resolve = createFirstPartyComponentResolver(chatConnectedRegistrations());
      export function useViewTabAdapter(panelId) {
        var descriptor = window.__threadedWorkspaceDescriptor;
        if (panelId !== ${JSON.stringify(VIEW_A)} || !descriptor) return null;
        var tabId = 'retained-screenshot-component';
        return { panelId: panelId, label: 'Retained chat',
          tabs: [{ id: tabId, label: 'Screenshot chat', icon: 'chat', closable: true }],
          activeId: tabId, tabPanelTabIndex: -1, onActivate: function () {}, onClose: function () {},
          content: { active: { tabId: tabId,
            content: { kind: 'component', revision: 1, component: descriptor } },
            reservation: null, resolve: resolve, retryLauncher: function () {}, cancelLauncher: function () {} },
        };
      }
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'threaded-chat-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === virtualEntry) return resolvedEntry;
          if (id.includes('viewTabAdapters') && importer?.split('?')[0] === viewTabBarPath) return virtualAdapters;
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return source;
          if (id === virtualAdapters) return adapterSource;
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

test('the rail New Chat button replaces the selected chat after accepted create and open', async ({ page }) => {
  await mountFixture(page);
  await deliver(page, { type: 'thread:list', viewId: VIEW_A, threads: [PROJ_A] });
  await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: GROUP_A, threadId: THREAD_A, thread: PROJ_A.entry, exchanges: [] });
  await expect(page.locator('#host-a [data-selected="true"]')).toHaveAttribute('data-thread-group-id', GROUP_A);
  await page.locator('#host-a .rv-new-chat-btn').click();
  const frames = await page.evaluate(() => (window as unknown as {
    __threadedFixture: { sentRaw: () => Array<Record<string, unknown>> };
  }).__threadedFixture.sentRaw());
  expect(frames.find((frame) => frame.type === 'thread:open-assistant'))
    .toMatchObject({ type: 'thread:open-assistant', viewId: VIEW_A });
  const newRow = projection({ groupId: 'new-group', threadId: 'new-thread', viewId: VIEW_A, name: 'New' });
  await deliver(page, { type: 'thread:created', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: newRow.threadGroupId, threadId: newRow.threadId, thread: newRow.entry });
  await expect(page.locator('#host-a [data-selected="true"]')).toHaveAttribute('data-thread-group-id', GROUP_A);
  await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: newRow.threadGroupId, threadId: newRow.threadId, thread: newRow.entry, exchanges: [] });
  await expect(page.locator('#host-a [data-selected="true"]')).toHaveAttribute('data-thread-group-id', 'new-group');
  await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'new-thread');
  await expect(page.locator('#host-a textarea')).toBeEnabled();
  await expect(page.locator('#host-b .rv-chat-area')).not.toHaveAttribute('data-chat-thread-id', 'new-thread');
});

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

// Direct screenshot preservation over the real host/accepted New Chat/composer
// route. Only Electron capture and save delivery are controlled dependencies.
interface ScreenshotFixtureState {
  captures: number;
  toasts: string[];
  requests: Array<{ requestId: string; workspaceId: string; dataUrl: string }>;
  attachments: Record<string, { attachments: Array<{ path: string; relativePath: string }> }>;
}

async function screenshotFixtureCall(page: Page, method: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(([name, params]) => {
    const fixture = (window as unknown as {
      __threadedFixture: Record<string, (...values: unknown[]) => unknown>;
    }).__threadedFixture;
    return fixture[name](...params);
  }, [method, args] as [string, unknown[]]);
}

async function screenshotState(page: Page): Promise<ScreenshotFixtureState> {
  return await screenshotFixtureCall(page, 'screenshotState') as ScreenshotFixtureState;
}

async function acceptedNewChat(page: Page, legacyThreadId: string | null = null): Promise<void> {
  await mountFixture(page);
  await screenshotFixtureCall(page, 'setState', { currentThreadId: legacyThreadId });
  await deliver(page, { type: 'thread:list', viewId: VIEW_A, threads: [PROJ_A] });
  await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: GROUP_A, threadId: THREAD_A, thread: PROJ_A.entry, exchanges: [] });
  await page.locator('#host-a .rv-new-chat-btn').click();
  const row = projection({ groupId: 'screenshot-new-group', threadId: 'screenshot-new-thread',
    viewId: VIEW_A, name: 'Screenshot New Chat' });
  await deliver(page, { type: 'thread:created', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: row.threadGroupId, threadId: row.threadId, thread: row.entry });
  await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: row.threadGroupId, threadId: row.threadId, thread: row.entry, exchanges: [] });
  await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-thread-id', row.threadId);
  await expect(page.locator('#host-a textarea')).toBeEnabled();
  const state = JSON.parse(await screenshotFixtureCall(page, 'storeState') as string);
  expect(state.currentThreadId).toBe(legacyThreadId);
}

async function clickComposerScreenshot(page: Page, host = '#host-a'): Promise<void> {
  await page.locator(`${host} .rv-chat-composer-add-trigger`).click();
  await page.locator(host).getByRole('menuitem', { name: 'Take screenshot', exact: true }).click();
  await expect.poll(async () => (await screenshotState(page)).captures).toBe(1);
}

async function finishScreenshotCapture(page: Page): Promise<string> {
  await screenshotFixtureCall(page, 'finishCapture');
  await expect.poll(async () => (await screenshotState(page)).requests.length).toBe(1);
  return (await screenshotState(page)).requests[0].requestId;
}

async function expectExactScreenshotAttachment(page: Page, threadId: string): Promise<void> {
  const owner = JSON.stringify([WORKSPACE, threadId]);
  await expect.poll(async () => Object.keys((await screenshotState(page)).attachments)).toEqual([owner]);
  const state = await screenshotState(page);
  expect(state.requests[0]).toMatchObject({ workspaceId: WORKSPACE,
    dataUrl: 'data:image/png;base64,fixture-png-base64' });
  expect(state.attachments[owner].attachments).toMatchObject([{ path: '/scratch/ai/Test/Data/Screenshots/exact.png',
    relativePath: 'Data/Screenshots/exact.png' }]);
  expect(state.toasts.at(-1)).toBe('Screenshot attached to chat.');
}

for (const legacyThreadId of [null, 'older-legacy-thread']) {
  test(`New Chat composer screenshot uses its exact view owner with Legacy ${legacyThreadId}`, async ({ page }) => {
    await acceptedNewChat(page, legacyThreadId);
    await clickComposerScreenshot(page);
    // An accepted update in another view cannot steal the screenshot owner.
    await deliver(page, { type: 'thread:list', viewId: VIEW_B, threads: [PROJ_B] });
    await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_B,
      threadGroupId: GROUP_B, threadId: THREAD_B, thread: PROJ_B.entry, exchanges: [] });
    const requestId = await finishScreenshotCapture(page);
    await screenshotFixtureCall(page, 'saved', 'wrong-request', '/wrong.png');
    expect((await screenshotState(page)).attachments).toEqual({});
    await screenshotFixtureCall(page, 'saved', requestId, '/scratch/ai/Test/Data/Screenshots/exact.png');
    await expectExactScreenshotAttachment(page, 'screenshot-new-thread');
    await expect(page.locator('#host-a .rv-chat-attachments-strip')).toContainText('exact.png');
    await expect(page.locator('#host-b .rv-chat-attachment-pill')).toHaveCount(0);
  });

  test(`header screenshot captures activated Main New Chat with Legacy ${legacyThreadId}`, async ({ page }) => {
    await acceptedNewChat(page, legacyThreadId);
    await page.locator('#host-a textarea').click();
    await screenshotFixtureCall(page, 'globalCapture');
    await expect.poll(async () => (await screenshotState(page)).captures).toBe(1);
    const requestId = await finishScreenshotCapture(page);
    await screenshotFixtureCall(page, 'saved', requestId, '/scratch/ai/Test/Data/Screenshots/exact.png');
    await expectExactScreenshotAttachment(page, 'screenshot-new-thread');
  });
}

for (const phase of ['capture', 'save'] as const) {
  for (const change of ['thread', 'workspace', 'view', 'unmount'] as const) {
    test(`composer screenshot cancels on actual ${change} owner change during ${phase}`, async ({ page }) => {
      await acceptedNewChat(page, 'older-legacy-thread');
      await clickComposerScreenshot(page);
      const requestId = phase === 'save' ? await finishScreenshotCapture(page) : null;
      if (change === 'thread') {
        await page.locator(`#host-a .rv-chat-item[data-thread-group-id="${GROUP_A}"]`).locator('.rv-chat-item-text').click();
        await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
          threadGroupId: GROUP_A, threadId: THREAD_A, thread: PROJ_A.entry, exchanges: [] });
        await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-thread-id', THREAD_A);
        // Returning to the old session must not revive its old capture token.
        await page.locator('#host-a .rv-chat-item[data-thread-group-id="screenshot-new-group"]').locator('.rv-chat-item-text').click();
        await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
          threadGroupId: 'screenshot-new-group', threadId: 'screenshot-new-thread',
          thread: PROJ_A.entry, exchanges: [] });
        await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-thread-id', 'screenshot-new-thread');
      } else if (change === 'workspace') {
        await screenshotFixtureCall(page, 'setState', { activeWorkspaceId: 'other-workspace' });
      } else if (change === 'view') {
        await screenshotFixtureCall(page, 'setAView', 'other-owning-view');
        await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-view-id', 'other-owning-view');
      } else {
        await screenshotFixtureCall(page, 'setAMounted', false);
        await expect(page.locator('#host-a .rv-chat-area')).toHaveCount(0);
      }
      if (requestId) await screenshotFixtureCall(page, 'saved', requestId, '/scratch/ai/Test/Data/Screenshots/exact.png');
      else await screenshotFixtureCall(page, 'finishCapture');
      await expect.poll(async () => (await screenshotState(page)).toasts.at(-1))
        .toBe('Screenshot was not attached because the chat changed.');
      const state = await screenshotState(page);
      expect(state.attachments).toEqual({});
      expect(state.requests).toHaveLength(phase === 'save' ? 1 : 0);
    });
  }
}

for (const phase of ['capture', 'save'] as const) {
  test(`qualified header screenshot preserves retained owner after view focus switch during ${phase}`, async ({ page }) => {
    await acceptedNewChat(page);
    await page.locator('#host-a textarea').click();
    await screenshotFixtureCall(page, 'globalCapture');
    await expect.poll(async () => (await screenshotState(page)).captures).toBe(1);
    const requestId = phase === 'save' ? await finishScreenshotCapture(page) : null;
    await screenshotFixtureCall(page, 'setState', { currentPanel: VIEW_B });
    const id = requestId ?? await finishScreenshotCapture(page);
    await screenshotFixtureCall(page, 'saved', id, '/scratch/ai/Test/Data/Screenshots/exact.png');
    await expectExactScreenshotAttachment(page, 'screenshot-new-thread');
  });
}

test('header screenshot denies stale Legacy without an active mounted destination', async ({ page }) => {
  await mountFixture(page);
  await screenshotFixtureCall(page, 'setState', { currentThreadId: 'legacy-fallback' });
  await screenshotFixtureCall(page, 'globalCapture');
  const state = await screenshotState(page);
  expect(state.captures).toBe(0);
  expect(state.requests).toEqual([]);
  expect(state.attachments).toEqual({});
});

test('Side composer screenshot preserves its placement owner when Main selection changes', async ({ page }) => {
  await acceptedNewChat(page, 'older-legacy-thread');
  await screenshotFixtureCall(page, 'seedComponent', 'side-tab', 'screenshot-side-thread');
  await expect(page.locator('#host-component .rv-chat-area')).toHaveAttribute('data-chat-host', 'side-tab');
  await clickComposerScreenshot(page, '#host-component');
  await page.locator(`#host-a .rv-chat-item[data-thread-group-id="${GROUP_A}"]`).locator('.rv-chat-item-text').click();
  await deliver(page, { type: 'thread:opened', workspaceId: WORKSPACE, viewId: VIEW_A,
    threadGroupId: GROUP_A, threadId: THREAD_A, thread: PROJ_A.entry, exchanges: [] });
  await expect(page.locator('#host-a .rv-chat-area')).toHaveAttribute('data-chat-thread-id', THREAD_A);
  const requestId = await finishScreenshotCapture(page);
  await screenshotFixtureCall(page, 'saved', requestId, '/scratch/ai/Test/Data/Screenshots/exact.png');
  await expectExactScreenshotAttachment(page, 'screenshot-side-thread');
  await expect(page.locator('#host-component .rv-chat-attachments-strip')).toContainText('exact.png');
  await expect(page.locator('#host-a .rv-chat-attachment-pill')).toHaveCount(0);
});

for (const phase of ['capture', 'save'] as const) {
  for (const change of ['placement-close', 'unmount'] as const) {
    test(`Side composer screenshot cancels ${change} during ${phase}`, async ({ page }) => {
      await acceptedNewChat(page);
      await screenshotFixtureCall(page, 'seedComponent', 'side-tab', 'screenshot-side-thread');
      await expect(page.locator('#host-component .rv-chat-area')).toHaveAttribute('data-chat-host', 'side-tab');
      await clickComposerScreenshot(page, '#host-component');
      const requestId = phase === 'save' ? await finishScreenshotCapture(page) : null;
      await screenshotFixtureCall(page, change === 'placement-close' ? 'closeComponent' : 'unmountComponent');
      await expect(page.locator('#host-component .rv-chat-area')).toHaveCount(0);
      if (requestId) await screenshotFixtureCall(page, 'saved', requestId, '/scratch/ai/Test/Data/Screenshots/exact.png');
      else await screenshotFixtureCall(page, 'finishCapture');
      await expect.poll(async () => (await screenshotState(page)).toasts.at(-1))
        .toBe('Screenshot was not attached because the chat changed.');
      expect((await screenshotState(page)).attachments).toEqual({});
    });
  }
}

test('an explicit Main component screenshot uses its hydrated session independently of the rail', async ({ page }) => {
  await acceptedNewChat(page);
  await screenshotFixtureCall(page, 'seedComponent', 'main', THREAD_A);
  await expect(page.locator('#host-component .rv-chat-area')).toHaveAttribute('data-chat-thread-id', THREAD_A);
  await clickComposerScreenshot(page, '#host-component');
  const requestId = await finishScreenshotCapture(page);
  await screenshotFixtureCall(page, 'saved', requestId, '/scratch/ai/Test/Data/Screenshots/exact.png');
  await expectExactScreenshotAttachment(page, THREAD_A);
});

for (const host of ['main', 'side-tab'] as const) {
  for (const phase of ['capture', 'save'] as const) {
    for (const returnsToView of [false, true]) {
      test(`retained ${host} component screenshot survives retained active panel switch during ${phase}${returnsToView ? ' after return' : ''}`, async ({ page }) => {
        await acceptedNewChat(page);
        await screenshotFixtureCall(page, 'seedWorkspaceComponent', host,
          host === 'main' ? THREAD_A : 'screenshot-side-thread');
        const owningPanel = page.locator('#host-workspace-component [data-panel]');
        const component = page.locator('#host-workspace-component .rv-content-area .rv-chat-area');
        await expect(component).toHaveAttribute('data-chat-host', host);
        const surfaceId = await component.getAttribute('data-surface-id');
        expect(surfaceId).toBeTruthy();
        await clickComposerScreenshot(page, '#host-workspace-component .rv-content-area');
        const requestId = phase === 'save' ? await finishScreenshotCapture(page) : null;

        // Only the actual shell selection changes. WorkspacePanel retains the
        // ContentArea and component instance; its placement remains open.
        await screenshotFixtureCall(page, 'setCurrentPanel', VIEW_B);
        await expect(owningPanel).not.toHaveClass(/\bactive\b/);
        await expect(component).toHaveAttribute('data-surface-id', surfaceId!);
        let state = JSON.parse(await screenshotFixtureCall(page, 'storeState') as string);
        expect(state.worksurfaceEntries[`${WORKSPACE}::${VIEW_A}::${GROUP_A}`]
          .managedComponentPlacements['screenshot-side'].disposition).toBe('open');
        if (returnsToView) {
          await screenshotFixtureCall(page, 'setCurrentPanel', VIEW_A);
          await expect(owningPanel).toHaveClass(/\bactive\b/);
          await expect(component).toHaveAttribute('data-surface-id', surfaceId!);
        }

        const id = requestId ?? await finishScreenshotCapture(page);
        await screenshotFixtureCall(page, 'saved', id, '/scratch/ai/Test/Data/Screenshots/exact.png');
        await expectExactScreenshotAttachment(page, host === 'main' ? THREAD_A : 'screenshot-side-thread');
        expect((await screenshotState(page)).requests).toHaveLength(1);
        state = JSON.parse(await screenshotFixtureCall(page, 'storeState') as string);
        expect(state.worksurfaceEntries[`${WORKSPACE}::${VIEW_A}::${GROUP_A}`]
          .managedComponentPlacements['screenshot-side'].disposition).toBe('open');
      });
    }
  }
}
