/**
 * @module e2e/chat-surface-identity.spec
 * @role SPEC-02 Slice 02A gate: explicit chat mount identity, portable
 *       boundary, per-thread session state, per-surface mounted UI state,
 *       late-response discipline, and model pending/acknowledgement.
 *
 * Proof strategy:
 *  - source sweeps for the portable boundary import surface and for the
 *    absence of `surfaceId` in descriptors/action envelopes;
 *  - a real Vite-rendered fixture mounting the actual `ChatSessionHost` +
 *    `ChatSurface` twice over one session;
 *  - the real store + WebSocket handler path for late frames, usage
 *    isolation, and model selection acknowledgement/rejection/hydration.
 *
 * No owner workspace, dev database, or port 3001 is used. The isolated
 * config (port 3316, /tmp profile) is only needed for the source/handler
 * lanes and never touched by the rendered fixture.
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

// ── Portable boundary import surface ────────────────────────────────────────

test('ChatSurface explicitly consumes an identity/model/actions contract', () => {
  const surface = readSource('src/components/chat/ChatSurface.tsx');
  const contract = readSource('src/components/chat/chatSurfaceContract.ts');

  expect(surface).toContain('ChatSurfaceProps');
  expect(surface).toContain('ChatSurfaceRefs');
  for (const field of ['threadGroupId', 'threadId', 'surfaceId', 'host']) {
    expect(surface).toContain(field);
  }
  expect(surface).toContain('onToggleThreads');
  expect(contract).toContain('interface ChatMountIdentity');
  for (const field of ['workspaceId', 'viewId', 'threadGroupId', 'threadId', 'surfaceId', 'host']) {
    expect(contract).toContain(field);
  }
  expect(contract).toContain("'main' | 'side-tab'");
});

test('ChatSurface module imports no app store, socket, controller, service, filesystem, or tab owner', () => {
  const specs = importSpecifiers(readSource('src/components/chat/ChatSurface.tsx'));
  const forbidden = [
    'state/panelStore',
    'state/slices',
    'lib/ws',
    'useChatSessionHost',
    'chatFileLinkStore',
    'chatComposerDraftStore',
    'thread-runtime',
    'process-manager',
    'services',
    'node:fs',
    'filesystem',
    'tab',
  ];
  for (const spec of specs) {
    for (const token of forbidden) {
      expect(spec, `ChatSurface must not import ${spec}`).not.toContain(token);
    }
  }
  // Descendants are connected per CHAT-RD-014; the surface itself is portable.
  expect(specs).toContain('./chatSurfaceContract');
});

test('surfaceId never enters canonical action envelopes, results, or fan-out', () => {
  const rows = readSource('src/lib/ws/threadGroupRows.ts');
  const handlers = readSource('src/lib/ws/thread-handlers.ts');
  const stream = readSource('src/lib/ws/stream-handlers.ts');
  expect(rows).not.toContain('surfaceId');
  expect(handlers).not.toContain('surfaceId');
  expect(stream).not.toContain('surfaceId');
  // The portable contract is the only place that mints it.
  expect(readSource('src/components/chat/chatSurfaceContract.ts')).toContain('mintChatSurfaceId');
});

// ── Store + handler lane (real public path) ─────────────────────────────────

const THREAD_A = 'surface-identity-a';
const THREAD_B = 'surface-identity-b';
const GROUP_A = 'surface-group-a';
const GROUP_B = 'surface-group-b';
const WORKSPACE = 'surface-workspace';

function emptyPanelState(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    currentTurn: null,
    pendingTurnEnd: false,
    pendingPromptAcceptance: null,
    retryPromptDraft: null,
    pendingMessage: null,
    segments: [],
    lastReleasedSegmentCount: 0,
    todoDrawer: undefined,
    pendingSavedExchanges: {},
    pendingExchangeSaveTurnId: null,
    activity: null,
    ...overrides,
  };
}

async function seedStore() {
  const { usePanelStore } = await import('../src/state/panelStore');
  usePanelStore.setState({
    activeWorkspaceId: WORKSPACE,
    currentThreadId: THREAD_A,
    chatActive: true,
    ws: null,
    threads: [
      {
        threadId: THREAD_A,
        threadGroupId: GROUP_A,
        viewId: null,
        entry: {
          name: 'A',
          createdAt: '2026-01-01T00:00:00.000Z',
          messageCount: 0,
          status: 'active',
        },
      },
      {
        threadId: THREAD_B,
        threadGroupId: GROUP_B,
        viewId: null,
        entry: {
          name: 'B',
          createdAt: '2026-01-01T00:00:00.000Z',
          messageCount: 0,
          status: 'active',
        },
      },
    ],
    projectChats: {},
    contextUsageByThread: {},
    tokenUsageByThread: {},
    wireReadyByThread: {},
    harnessSelectionByThread: {},
    threadGroupsByWorkspaceAndView: {},
    currentThreadGroupIdByWorkspaceAndView: {},
    legacyThreadGroupsByWorkspaceId: {},
    currentLegacyThreadGroupIdByWorkspaceId: {},
    pendingThreadOpens: [],
  } as never);
  return usePanelStore;
}

test('late thread:opened and usage for thread B cannot mutate thread A displayed state', async () => {
  const usePanelStore = await seedStore();
  const { handleThreadMessage } = await import('../src/lib/ws/thread-handlers');
  usePanelStore.setState({
    projectChats: {
      [THREAD_A]: emptyPanelState({ messages: [{ id: 'a1', type: 'user', content: 'A-ONLY', timestamp: 1 }] }),
      [THREAD_B]: emptyPanelState(),
    },
    contextUsageByThread: { [THREAD_A]: 0.5 },
    // The workspace-global mirror currently reflects the selected session A.
    contextUsage: 0.5,
  } as never);
  // Record the correlated open for A's explicit Legacy population.
  usePanelStore.getState().requestThreadOpen({
    workspaceId: WORKSPACE,
    viewId: null,
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
  });

  // A late passive open for B must not steal A's visible selection; it still
  // hydrates B's own slot and usage exactly.
  expect(handleThreadMessage({
    type: 'thread:opened',
    threadId: THREAD_B,
    threadGroupId: GROUP_B,
    thread: { name: 'B', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active' },
    exchanges: [],
    contextUsage: 0.9,
  } as never)).toBe(true);

  const state = usePanelStore.getState();
  expect(state.currentThreadId).toBe(THREAD_A);
  expect(state.contextUsageByThread[THREAD_B]).toBe(0.9);
  expect(state.contextUsageByThread[THREAD_A]).toBe(0.5);
  // Global mirror still reflects exactly the selected session (A), never the
  // late frame for B.
  expect(state.contextUsage).toBe(0.5);
  expect(state.contextUsage).not.toBe(0.9);
  expect(state.projectChats[THREAD_A].messages.map((m) => m.content)).toContain('A-ONLY');
});

test('model selection is pending by exact thread, promoted by exact ack, and rejection restores the prior value', async () => {
  const usePanelStore = await seedStore();
  const { handleThreadMessage } = await import('../src/lib/ws/thread-handlers');
  const { threadActionSetHarnessSelection } = await import('../src/lib/ws/threadGroupRows');
  const { acknowledgedHarnessConfigForThread, selectionForThread } = await import('../src/state/slices/chatSurfaceSlice');

  usePanelStore.getState().hydrateHarnessSelection(THREAD_A, { model: 'm1', variant: 'high' }, 'opencode');
  expect(selectionForThread(usePanelStore.getState(), THREAD_A).acknowledged).toMatchObject({ model: 'm1', variant: 'high' });

  // Optimistic change: envelope carries only portable model/variant.
  const request = threadActionSetHarnessSelection({ threadGroupId: GROUP_A, threadId: THREAD_A, model: 'm2', variant: 'low' });
  expect(Object.keys(request).sort()).toEqual(['action', 'model', 'requestId', 'threadGroupId', 'threadId', 'type', 'variant']);
  expect(request).not.toHaveProperty('surfaceId');
  expect(request).not.toHaveProperty('harnessId');
  usePanelStore.getState().beginHarnessSelection(THREAD_A, { modelId: 'm2', variant: 'low', requestId: request.requestId });
  expect(selectionForThread(usePanelStore.getState(), THREAD_A).pending?.requestId).toBe(request.requestId);
  // Pending is not Send authority.
  expect(acknowledgedHarnessConfigForThread(usePanelStore.getState(), THREAD_A)).toEqual({ model: 'm1', variant: 'high' });

  // Exact-session acknowledgement promotes to acknowledged.
  handleThreadMessage({
    type: 'thread:action:completed',
    action: 'set_harness_selection',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    requestId: request.requestId,
    model: 'm2',
    variant: 'low',
    harnessId: 'opencode',
  } as never);
  let selection = selectionForThread(usePanelStore.getState(), THREAD_A);
  expect(selection.pending).toBeNull();
  expect(selection.acknowledged).toMatchObject({ model: 'm2', variant: 'low' });

  // Rejection restores the prior acknowledged value.
  const rejected = threadActionSetHarnessSelection({ threadGroupId: GROUP_A, threadId: THREAD_A, model: 'm3', variant: 'high' });
  usePanelStore.getState().beginHarnessSelection(THREAD_A, { modelId: 'm3', variant: 'high', requestId: rejected.requestId });
  handleThreadMessage({
    type: 'thread:action:error',
    action: 'set_harness_selection',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    requestId: rejected.requestId,
    code: 'invalid_selection',
  } as never);
  selection = selectionForThread(usePanelStore.getState(), THREAD_A);
  expect(selection.pending).toBeNull();
  expect(selection.acknowledged).toMatchObject({ model: 'm2', variant: 'low' });
  expect(acknowledgedHarnessConfigForThread(usePanelStore.getState(), THREAD_A)).toEqual({ model: 'm2', variant: 'low' });

  // Reopen hydrates the server-owned acknowledged value from entry.harnessConfig.
  handleThreadMessage({
    type: 'thread:opened',
    threadId: THREAD_A,
    threadGroupId: GROUP_A,
    thread: {
      name: 'A',
      createdAt: '2026-01-01T00:00:00.000Z',
      messageCount: 0,
      status: 'active',
      harnessId: 'opencode',
      harnessConfig: { model: 'm3', variant: null },
    },
    exchanges: [],
  } as never);
  selection = selectionForThread(usePanelStore.getState(), THREAD_A);
  expect(selection.acknowledged).toMatchObject({ model: 'm3', variant: null });
  expect(acknowledgedHarnessConfigForThread(usePanelStore.getState(), THREAD_A)).toEqual({ model: 'm3', variant: null });
});

test('passive thread:open request carries the group identity and never warms', async () => {
  const { threadOpenRequest, threadActionSetHarnessSelection, threadActionRename } = await import('../src/lib/ws/threadGroupRows');
  expect(threadOpenRequest(GROUP_A, THREAD_A)).toEqual({ type: 'thread:open', threadGroupId: GROUP_A });
  for (const envelope of [
    threadActionRename({ threadGroupId: GROUP_A, threadId: THREAD_A, name: 'x' }),
    threadActionSetHarnessSelection({ threadGroupId: GROUP_A, threadId: THREAD_A, model: 'm', variant: null }),
  ]) {
    expect(JSON.stringify(envelope)).not.toContain('surfaceId');
    expect(envelope.type).toBe('thread:action');
  }
});

// ── Rendered fixture (real host + real surface) ─────────────────────────────

const bundles = new Map<string, Promise<string>>();

async function buildChatSurfaceHarness(): Promise<string> {
  const existing = bundles.get('fixture');
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:chat-surface-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const panelStorePath = path.resolve('src/state/panelStore.ts');
    const hostPath = path.resolve('src/components/chat/ChatSessionHost.tsx');
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};
      import { ChatSessionHost } from ${JSON.stringify(hostPath)};

      const SHARED = 'fixture-shared-thread';
      const GROUP = 'fixture-group';
      usePanelStore.setState({
        activeWorkspaceId: 'fixture-workspace',
        currentThreadId: SHARED,
        chatActive: true,
        ws: null,
        threads: [{
          threadId: SHARED,
          threadGroupId: GROUP,
          viewId: null,
          entry: { name: 'Shared', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
        }],
        projectChats: {
          [SHARED]: {
            messages: [{ id: 'u1', type: 'user', content: 'SHARED-TRUTH', timestamp: 1 }],
            currentTurn: null,
            pendingTurnEnd: false,
            pendingPromptAcceptance: null,
            retryPromptDraft: null,
            pendingMessage: null,
            segments: [],
            lastReleasedSegmentCount: 0,
            activity: null,
          },
        },
        contextUsageByThread: {},
        tokenUsageByThread: {},
        wireReadyByThread: {},
        harnessSelectionByThread: {},
        threadGroupsByWorkspaceAndView: {},
        currentThreadGroupIdByWorkspaceAndView: {},
        legacyThreadGroupsByWorkspaceId: {},
        currentLegacyThreadGroupIdByWorkspaceId: {},
        pendingThreadOpens: [],
        viewStates: {},
      });

      function Fixture() {
        const [collapsed, setCollapsed] = React.useState(false);
        React.useEffect(() => {
          window.__chatSurfaceFixture = {
            toggleCollapse: () => setCollapsed((value) => !value),
            collapsed,
            storeState: () => JSON.stringify(usePanelStore.getState()),
          };
        }, [collapsed]);
        return React.createElement('div', null,
          React.createElement('div', { id: 'mount-a' },
            React.createElement(ChatSessionHost, { panel: 'fixture', workspaceId: 'fixture-workspace', viewId: 'file-viewer', threadGroupId: GROUP, threadId: SHARED, host: 'main', collapsed })),
          React.createElement('div', { id: 'mount-b' },
            React.createElement(ChatSessionHost, { panel: 'fixture', workspaceId: 'fixture-workspace', viewId: 'file-viewer', threadGroupId: GROUP, threadId: SHARED, host: 'main', collapsed })),
        );
      }

      createRoot(document.querySelector('#root')).render(React.createElement(Fixture));
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'chat-surface-harness',
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
          output: { format: 'iife', name: 'ChatSurfaceHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Chat surface harness did not build.');
    return chunk.code;
  })();
  bundles.set('fixture', bundle);
  return bundle;
}

async function mountFixture(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await buildChatSurfaceHarness() });
  try {
    await expect(page.locator('.rv-chat-area[data-surface-id]')).toHaveCount(2);
  } catch (error) {
    if (errors.length > 0) throw new Error(errors.join('\n'));
    throw error;
  }
}

interface MountIdentity {
  surfaceId: string | null;
  chatMoreId: string | null;
  host: string | null;
}

async function mountIdentity(page: Page, selector: string): Promise<MountIdentity> {
  return page.locator(selector).evaluate((root) => {
    const surface = (root.querySelector('[data-chat-host]')
      ?? root.querySelector('[data-surface-id]')) as HTMLElement | null;
    const more = root.querySelector('.rv-chat-header [aria-label="More options"]') as HTMLElement | null;
    return {
      surfaceId: surface?.getAttribute('data-surface-id') ?? null,
      chatMoreId: more?.getAttribute('id') ?? null,
      host: surface?.getAttribute('data-chat-host') ?? null,
    };
  });
}

test('two mounts of one session share session truth but keep DOM/menu/focus state separate', async ({ page }) => {
  await mountFixture(page);

  const a = await mountIdentity(page, '#mount-a');
  const b = await mountIdentity(page, '#mount-b');
  expect(a.surfaceId).toMatch(/^chat-surface:main:/);
  expect(b.surfaceId).toMatch(/^chat-surface:main:/);
  expect(a.surfaceId).not.toBe(b.surfaceId);
  expect(a.chatMoreId).not.toBe(b.chatMoreId);
  expect(a.chatMoreId).toContain(a.surfaceId!.replace(/[^A-Za-z0-9_-]/g, '-'));
  expect(b.chatMoreId).toContain(b.surfaceId!.replace(/[^A-Za-z0-9_-]/g, '-'));

  // Shared session truth: both mounts render the same transcript.
  await expect(page.locator('#mount-a .rv-chat-messages')).toContainText('SHARED-TRUTH');
  await expect(page.locator('#mount-b .rv-chat-messages')).toContainText('SHARED-TRUTH');
  await expect(page.locator('#mount-a .rv-message-user-content')).toHaveText('SHARED-TRUTH');
  await expect(page.locator('#mount-b .rv-message-user-content')).toHaveText('SHARED-TRUTH');

  // Mounted menu state is per-surface: opening mount A leaves mount B closed.
  const moreA = page.locator('#mount-a').getByRole('button', { name: 'More options' });
  const moreB = page.locator('#mount-b').getByRole('button', { name: 'More options' });
  await expect(moreA).toHaveAttribute('aria-expanded', 'false');
  await expect(moreB).toHaveAttribute('aria-expanded', 'false');
  await moreA.focus();
  await moreA.click();
  await expect(moreA).toHaveAttribute('aria-expanded', 'true');
  await expect(moreB).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('menu', { name: 'Chat options' })).toHaveCount(1);
  expect(await moreB.evaluate((el) => document.activeElement === el)).toBe(false);
});

test('surfaceId is minted at mount, never persisted, and collapse/expand preserves it', async ({ page }) => {
  await mountFixture(page);
  const before = await mountIdentity(page, '#mount-a');
  expect(before.surfaceId).toBeTruthy();

  // Never persisted: the app store never carries a transient surface id.
  const serialized = await page.evaluate(() => (
    (window as unknown as { __chatSurfaceFixture: { storeState: () => string } })
      .__chatSurfaceFixture.storeState()
  ));
  expect(serialized).toContain('SHARED-TRUTH');
  expect(serialized).not.toContain('chat-surface:');

  await page.evaluate(() => (window as unknown as { __chatSurfaceFixture: { toggleCollapse: () => void } }).__chatSurfaceFixture.toggleCollapse());
  await expect(page.locator('#mount-a [data-surface-id]')).toBeVisible();
  const after = await mountIdentity(page, '#mount-a');
  expect(after.surfaceId).toBe(before.surfaceId);

  await page.evaluate(() => (window as unknown as { __chatSurfaceFixture: { toggleCollapse: () => void } }).__chatSurfaceFixture.toggleCollapse());
  const restored = await mountIdentity(page, '#mount-a');
  expect(restored.surfaceId).toBe(before.surfaceId);
  await expect(page.locator('#mount-a .rv-chat-messages')).toContainText('SHARED-TRUTH');
});

test('contract mints distinct transient surface ids per runtime mount generation', async () => {
  const { mintChatSurfaceId, nextChatSurfaceMountGeneration } = await import('../src/components/chat/chatSurfaceContract');
  const first = mintChatSurfaceId('main', nextChatSurfaceMountGeneration());
  const second = mintChatSurfaceId('main', nextChatSurfaceMountGeneration());
  const third = mintChatSurfaceId('main', nextChatSurfaceMountGeneration());
  expect(new Set([first, second, third]).size).toBe(3);
  expect(first).toContain('chat-surface:main:');
  expect(third).toContain('chat-surface:main:');
});

test('built client boots the real app on the isolated server without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await expect(page.locator('.rv-connection-status').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
