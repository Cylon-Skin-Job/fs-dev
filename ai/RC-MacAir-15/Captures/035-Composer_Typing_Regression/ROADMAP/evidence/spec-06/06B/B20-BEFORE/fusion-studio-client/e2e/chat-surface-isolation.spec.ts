/**
 * @module e2e/chat-surface-isolation.spec
 * @role SPEC-02 Slice 02C gate: two simultaneously mounted explicit chat
 *       surfaces stay isolated across Send, live stream, Stop, model/variant,
 *       usage/readiness, drafts/attachments, menus/focus, and Chat/Threads
 *       visibility.
 *
 * Proof strategy:
 *  - a real Vite-rendered fixture mounting the actual `ChatSessionHost` +
 *    `ChatSurface` twice over two distinct explicit sessions and hosts;
 *  - the real store + WebSocket handler frames (`handleThreadMessage`,
 *    `handleStreamMessage`) with an injected OPEN fake socket capturing
 *    outbound frames.
 *
 * No owner workspace, dev database, or port 3001 is used. The isolated config
 * (port 3316, /tmp profile) is only needed for the app-boot lane and is never
 * touched by the rendered fixture.
 */

import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';

const WS_ID = 'isolation-workspace';
const GROUP_A = 'isolation-group-a';
const GROUP_B = 'isolation-group-b';
const GROUP_C = 'isolation-group-c';
const THREAD_A = 'isolation-thread-a';
const THREAD_B = 'isolation-thread-b';
const THREAD_C = 'isolation-thread-c';

const bundles = new Map<string, Promise<string>>();

async function buildHarness(): Promise<string> {
  const existing = bundles.get('fixture');
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:chat-surface-isolation-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const panelStorePath = path.resolve('src/state/panelStore.ts');
    const draftStorePath = path.resolve('src/state/chatComposerDraftStore.ts');
    const attachmentStorePath = path.resolve('src/state/chatFileLinkStore.ts');
    const hostPath = path.resolve('src/components/chat/ChatSessionHost.tsx');
    const surfacePath = path.resolve('src/components/chat/ChatSurface.tsx');
    const composerPath = path.resolve('src/components/chat/ConnectedChatComposer.tsx');
    const historyPath = path.resolve('src/components/chat/ConnectedChatHistory.tsx');
    const connectedHeaderPath = path.resolve('src/components/chat/ConnectedChatHeader.tsx');
    const messageListPath = path.resolve('src/components/MessageList.tsx');
    const instantRendererPath = path.resolve('src/components/InstantSegmentRenderer.tsx');
    const headerPath = path.resolve('src/components/chat/ChatAreaHeader.tsx');
    const railPath = path.resolve('src/components/chat/ThreadRail.tsx');
    const contentAreaPath = path.resolve('src/components/ContentArea.tsx');
    const textFormatterPath = path.resolve('src/lib/text/index.ts');
    const threadHandlersPath = path.resolve('src/lib/ws/thread-handlers.ts');
    const streamHandlersPath = path.resolve('src/lib/ws/stream-handlers.ts');
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};
      import { useChatComposerDraftStore } from ${JSON.stringify(draftStorePath)};
      import { useChatFileLinkStore } from ${JSON.stringify(attachmentStorePath)};
      import { ChatSessionHost } from ${JSON.stringify(hostPath)};
      import { handleThreadMessage } from ${JSON.stringify(threadHandlersPath)};
      import { handleStreamMessage } from ${JSON.stringify(streamHandlersPath)};

      var WS_ID = ${JSON.stringify(WS_ID)};
      var GROUP_A = ${JSON.stringify(GROUP_A)};
      var GROUP_B = ${JSON.stringify(GROUP_B)};
      var GROUP_C = ${JSON.stringify(GROUP_C)};
      var THREAD_A = ${JSON.stringify(THREAD_A)};
      var THREAD_B = ${JSON.stringify(THREAD_B)};
      var THREAD_C = ${JSON.stringify(THREAD_C)};

      var sent = [];
      var renderProbe = { components: {}, formatters: {} };
      window.__fusionChatArchitectureProbe = function (kind, name) {
        var target = kind === 'formatter' ? renderProbe.formatters : renderProbe.components;
        target[name] = (target[name] || 0) + 1;
      };
      var fakeWs = {
        readyState: 1,
        send: function (data) { try { sent.push(JSON.parse(data)); } catch (e) {} },
        addEventListener: function () {},
        removeEventListener: function () {},
        close: function () {},
      };

      function row(threadId, threadGroupId, name, model, variant) {
        return {
          threadId: threadId,
          threadGroupId: threadGroupId,
          workspaceId: WS_ID,
          viewId: null,
          entry: {
            name: name,
            createdAt: '2026-01-01T00:00:00.000Z',
            messageCount: 1,
            status: 'active',
            harnessId: 'opencode',
            harnessConfig: { model: model, variant: variant },
          },
        };
      }

      function emptyChat() {
        return {
          messages: [],
          currentTurn: null,
          pendingTurnEnd: false,
          pendingPromptAcceptance: null,
          retryPromptDraft: null,
          pendingMessage: null,
          segments: [],
          lastReleasedSegmentCount: 0,
          pendingSavedExchanges: {},
          pendingExchangeSaveTurnId: null,
          todoDrawer: undefined,
          activity: null,
        };
      }

      usePanelStore.setState({
        activeWorkspaceId: WS_ID,
        currentThreadId: null,
        chatActive: true,
        ws: fakeWs,
        threads: [row(THREAD_A, GROUP_A, 'Alpha', 'mA', 'high'), row(THREAD_B, GROUP_B, 'Beta', 'mB', 'low'), row(THREAD_C, GROUP_C, 'Gamma', 'mC', 'medium')],
        threadGroupsByWorkspaceAndView: {},
        currentThreadGroupIdByWorkspaceAndView: {},
        legacyThreadGroupsByWorkspaceId: { [WS_ID]: [row(THREAD_A, GROUP_A, 'Alpha', 'mA', 'high'), row(THREAD_B, GROUP_B, 'Beta', 'mB', 'low')] },
        currentLegacyThreadGroupIdByWorkspaceId: {},
        pendingThreadOpens: [],
        projectChats: { [THREAD_A]: emptyChat(), [THREAD_B]: emptyChat() },
        contextUsageByThread: {},
        tokenUsageByThread: {},
        wireReadyByThread: {},
        harnessSelectionByThread: {
          [THREAD_A]: { acknowledged: { model: 'mA', variant: 'high', harnessId: 'opencode' }, pending: null },
          [THREAD_B]: { acknowledged: { model: 'mB', variant: 'low', harnessId: 'opencode' }, pending: null },
        },
        viewStates: {},
      });

      function Fixture() {
        var [collapsedA, setCollapsedA] = React.useState(false);
        var [sidebarA, setSidebarA] = React.useState(false);
        var [contentA, setContentA] = React.useState(false);
        var [sameSession, setSameSession] = React.useState(false);
        React.useEffect(function () {
          window.__chatSurfaceIsolation = {
            deliver: function (msg) { return handleThreadMessage(msg); },
            deliverStream: function (msg) { return handleStreamMessage(msg); },
            sentRaw: function () { return sent.slice(); },
            resetRenderProbe: function () { renderProbe = { components: {}, formatters: {} }; },
            renderProbe: function () { return JSON.stringify(renderProbe); },
            storeState: function () { return JSON.stringify(usePanelStore.getState()); },
            replaceUnrelatedThread: function (name) {
              var state = usePanelStore.getState();
              usePanelStore.setState({ threads: state.threads.map(function (thread) {
                return thread.threadId === THREAD_C
                  ? Object.assign({}, thread, { entry: Object.assign({}, thread.entry, { name: name }) })
                  : thread;
              }) });
            },
            setConnectingForSurface: function (surfaceId, harnessId) {
              usePanelStore.getState().setConnectingHarnessForSurface(surfaceId, harnessId);
            },
            clearConnectingForSurface: function (surfaceId) {
              usePanelStore.getState().clearConnectingHarnessForSurface(surfaceId);
            },
            setGlobalConnecting: function (harnessId) {
              usePanelStore.getState().setConnectingHarnessId(harnessId);
            },
            setDraft: function (workspaceId, threadId, text) {
              useChatComposerDraftStore.getState().setDraft(workspaceId, threadId, text);
            },
            seedCompletedHistory: function (threadId) {
              var state = usePanelStore.getState();
              var chat = state.projectChats[threadId];
              usePanelStore.setState({ projectChats: Object.assign({}, state.projectChats, {
                [threadId]: Object.assign({}, chat, { messages: [
                  { id: 'history-user', type: 'user', content: 'fixture question', timestamp: 1 },
                  { id: 'history-assistant', type: 'assistant', content: 'fixture answer', timestamp: 2,
                    segments: [{ type: 'text', content: '**fixture answer**', complete: true }] },
                ] })
              }) });
            },
            seedCompletedHistoryPair: function (threadId) {
              var store = usePanelStore.getState();
              store.clearChat(threadId);
              store.addMessage(threadId, { id: 'history-user-1', type: 'user', content: 'first question', timestamp: 1 });
              store.addMessage(threadId, { id: 'history-assistant-1', type: 'assistant', content: 'first answer', timestamp: 2,
                exchangeId: 101, exchangeSeq: 1, metadata: {},
                segments: [{ type: 'text', content: 'FIRST **ANSWER** [history link](https://example.test/history)', complete: true }] });
              store.addMessage(threadId, { id: 'history-user-2', type: 'user', content: 'second question', timestamp: 3 });
              store.addMessage(threadId, { id: 'history-assistant-2', type: 'assistant', content: '', timestamp: 4,
                exchangeId: 102, exchangeSeq: 2, metadata: { bookmark: { type: 'star' } },
                segments: [{ type: 'read', content: 'TOOL HISTORY OUTPUT', toolCallId: 'history-tool',
                  toolArgs: { path: 'history.txt' }, complete: true }] });
            },
            updateHistoryMetadata: function (threadId, exchangeId, metadata) {
              usePanelStore.getState().updateMessageMetadata(threadId, exchangeId, metadata);
            },
            historyRevisions: function (threadId) {
              return (usePanelStore.getState().projectChats[threadId]?.messages || [])
                .filter(function (message) { return message.type === 'assistant'; })
                .map(function (message) { return { id: message.id, contentRevision: message.contentRevision,
                  metadataRevision: message.metadataRevision }; });
            },
            addAttachment: function (workspaceId, threadId, attachment) {
              useChatFileLinkStore.getState().addPendingAttachment(workspaceId, threadId, attachment);
            },
            upsertAutocompleteCandidate: function (candidate) {
              useChatFileLinkStore.getState().upsertAutocompleteCandidate(candidate);
            },
            removeAttachment: function (workspaceId, threadId, id) {
              useChatFileLinkStore.getState().removePendingAttachment(workspaceId, threadId, id);
            },
            drafts: function () { return JSON.stringify(useChatComposerDraftStore.getState().draftsByOwner); },
            attachments: function () { return JSON.stringify(useChatFileLinkStore.getState().pendingAttachmentsByOwner); },
            beginSelection: function (threadId, pending) {
              usePanelStore.getState().beginHarnessSelection(threadId, pending);
            },
            selection: function (threadId) {
              return JSON.stringify(usePanelStore.getState().harnessSelectionByThread[threadId] || null);
            },
            toggleCollapsedA: function () { setCollapsedA(function (v) { return !v; }); },
            setSidebarA: setSidebarA,
            setContentA: setContentA,
            setSameSession: setSameSession,
          };
        }, [collapsedA, sidebarA, contentA, sameSession]);
        return React.createElement('div', null,
          React.createElement('div', { id: 'mount-a' },
            React.createElement(ChatSessionHost, {
              panel: 'isolation-a',
              workspaceId: WS_ID,
              threadId: THREAD_A,
              host: 'main',
              viewId: 'file-viewer',
              threadGroupId: GROUP_A,
              threadName: 'Alpha',
              collapsed: collapsedA,
              sidebarCollapsed: sidebarA,
              contentCollapsed: contentA,
            })),
          React.createElement('div', { id: 'mount-b' },
            React.createElement(ChatSessionHost, {
              panel: 'isolation-b',
              workspaceId: WS_ID,
              viewId: 'wiki-viewer',
              threadGroupId: sameSession ? GROUP_A : GROUP_B,
              threadId: sameSession ? THREAD_A : THREAD_B,
              threadName: sameSession ? 'Alpha' : 'Beta',
              host: 'main',
            })),
        );
      }

      createRoot(document.querySelector('#root')).render(React.createElement(Fixture));
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'chat-surface-isolation-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === virtualEntry) return resolvedEntry;
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return source;
          return null;
        },
        transform(code, id) {
          const target = new Map([
            [surfacePath, ['}: ChatSurfaceComponentProps) {', 'component', 'ChatSurface']],
            [composerPath, ['}: ConnectedChatComposerProps) {', 'component', 'ConnectedChatComposer']],
            [historyPath, ['}: ConnectedChatHistoryProps) {', 'component', 'ConnectedChatHistory']],
            [connectedHeaderPath, ['}: ConnectedChatHeaderProps) {', 'component', 'ConnectedChatHeader']],
            [messageListPath, ['}: MessageListProps) {', 'component', 'MessageList']],
            [instantRendererPath, ['export function InstantSegmentRenderer({ segments }: InstantSegmentRendererProps) {', 'component', 'InstantSegmentRenderer']],
            [headerPath, ['}: ChatAreaHeaderProps) {', 'component', 'ChatAreaHeader']],
            [railPath, ['export function ThreadRail(props: ThreadRailProps) {', 'component', 'ThreadRail']],
            [contentAreaPath, ['export const ContentArea: React.FC<ContentAreaProps> = ({ panel }) => {', 'component', 'ContentArea']],
            [textFormatterPath, ['export function renderTextInstant(content: string): string {', 'formatter', 'renderTextInstant']],
          ]).get(id) as [string, string, string] | undefined;
          if (!target) return null;
          const [marker, kind, name] = target;
          if (code.split(marker).length !== 2) {
            throw new Error(`render probe expected one ${name} marker in ${id}`);
          }
          return code.replace(marker, `${marker}\n  globalThis.__fusionChatArchitectureProbe?.(${JSON.stringify(kind)}, ${JSON.stringify(name)});`);
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'ChatSurfaceIsolationHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Chat surface isolation harness did not build.');
    return chunk.code;
  })();
  bundles.set('fixture', bundle);
  return bundle;
}

async function mountFixture(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await buildHarness() });
  try {
    await expect(page.locator('.rv-chat-area[data-surface-id]')).toHaveCount(2);
  } catch (error) {
    if (errors.length > 0) throw new Error(errors.join('\n'));
    throw error;
  }
}

async function deliver(page: Page, message: unknown): Promise<void> {
  await page.evaluate((msg) => (
    window as unknown as { __chatSurfaceIsolation: { deliver: (m: unknown) => void } }
  ).__chatSurfaceIsolation.deliver(msg), message);
}

async function deliverStream(page: Page, message: unknown): Promise<void> {
  await page.evaluate((msg) => (
    window as unknown as { __chatSurfaceIsolation: { deliverStream: (m: unknown) => void } }
  ).__chatSurfaceIsolation.deliverStream(msg), message);
}

async function sentFrames(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { sentRaw: () => Array<Record<string, unknown>> } }
  ).__chatSurfaceIsolation.sentRaw());
}

async function storeState(page: Page): Promise<Record<string, any>> {
  return page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { storeState: () => string } })
      .__chatSurfaceIsolation.storeState(),
  ));
}

async function surfaceIds(page: Page): Promise<{ a: string; b: string }> {
  return page.evaluate(() => ({
    a: document.querySelector('#mount-a [data-surface-id]')?.getAttribute('data-surface-id') ?? '',
    b: document.querySelector('#mount-b [data-surface-id]')?.getAttribute('data-surface-id') ?? '',
  }));
}

test('two simultaneously mounted explicit surfaces have distinct transient surfaceIds and hosts', async ({ page }) => {
  await mountFixture(page);
  const ids = await surfaceIds(page);
  expect(ids.a).toMatch(/^chat-surface:main:/);
  expect(ids.b).toMatch(/^chat-surface:main:/);
  expect(ids.a).not.toBe(ids.b);
  await expect(page.locator('#mount-a .rv-chat-area')).toHaveAttribute('data-chat-thread-id', THREAD_A);
  await expect(page.locator('#mount-b .rv-chat-area')).toHaveAttribute('data-chat-thread-id', THREAD_B);
  const serialized = JSON.stringify(await storeState(page));
  expect(serialized).not.toContain('chat-surface:');
});

test('Send in each surface emits a prompt frame with its exact threadId and acknowledged model snapshot', async ({ page }) => {
  await mountFixture(page);

  await page.locator('#mount-a textarea.rv-chat-input').fill('MSG-A');
  await page.locator('#mount-a textarea.rv-chat-input').press('Enter');
  await page.locator('#mount-b textarea.rv-chat-input').fill('MSG-B');
  await page.locator('#mount-b textarea.rv-chat-input').press('Enter');

  const frames = await sentFrames(page);
  const promptA = frames.find((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A);
  const promptB = frames.find((frame) => frame.type === 'prompt' && frame.threadId === THREAD_B);
  expect(promptA).toMatchObject({
    type: 'prompt',
    threadId: THREAD_A,
    user_input: 'MSG-A',
    harnessConfig: { model: 'mA', variant: 'high' },
  });
  expect(promptB).toMatchObject({
    type: 'prompt',
    threadId: THREAD_B,
    user_input: 'MSG-B',
    harnessConfig: { model: 'mB', variant: 'low' },
  });
  expect(promptA?.harnessConfig).not.toEqual(promptB?.harnessConfig);
  expect(JSON.stringify(frames)).not.toContain('surfaceId');
});

test('two mounts of one session share one pending attempt and one accepted bubble', async ({ page }) => {
  await mountFixture(page);
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    setSameSession: (same: boolean) => void,
  } }).__chatSurfaceIsolation.setSameSession(true));
  await expect(page.locator('#mount-b .rv-chat-area')).toHaveAttribute('data-chat-thread-id', THREAD_A);
  await page.locator('#mount-a textarea.rv-chat-input').fill('SHARED-ATTEMPT');
  await page.evaluate((workspaceId) => (window as unknown as { __chatSurfaceIsolation: {
    addAttachment: (workspaceId: string, threadId: string, attachment: unknown) => void,
  } }).__chatSurfaceIsolation.addAttachment(workspaceId, 'isolation-thread-a',
    { id: 'same-file-stable-id', kind: 'file', path: 'a.md', name: 'a.md' }), WS_ID);
  await expect(page.locator('#mount-b textarea.rv-chat-input')).toHaveValue('SHARED-ATTEMPT');
  await page.locator('#mount-a textarea.rv-chat-input').press('Enter');
  await expect(page.locator('#mount-b textarea.rv-chat-input')).toBeDisabled();
  const prompts = (await sentFrames(page)).filter((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A);
  expect(prompts).toHaveLength(1);
  expect(prompts[0].requestId).toMatch(/^[a-f0-9]{32}$/);
  await deliver(page, { type: 'message:sent', workspaceId: WS_ID, threadId: THREAD_A,
    requestId: prompts[0].requestId, turnId: 'shared-turn-1', content: 'SHARED-ATTEMPT' });
  await expect(page.locator('#mount-a .rv-message-user')).toHaveCount(1);
  await expect(page.locator('#mount-b .rv-message-user')).toHaveCount(1);
  await page.evaluate((workspaceId) => (window as unknown as { __chatSurfaceIsolation: {
    addAttachment: (workspaceId: string, threadId: string, attachment: unknown) => void,
  } }).__chatSurfaceIsolation.addAttachment(workspaceId, 'isolation-thread-a',
    { id: 'same-file-stable-id', kind: 'file', path: 'a.md', name: 'a.md' }), WS_ID);
  await deliver(page, { type: 'message:sent', workspaceId: WS_ID, threadId: THREAD_A,
    requestId: prompts[0].requestId, turnId: 'shared-turn-1', content: 'SHARED-ATTEMPT' });
  await expect(page.locator('#mount-a .rv-message-user')).toHaveCount(1);
  await expect(page.locator('#mount-a textarea.rv-chat-input')).toHaveValue('');
  await expect(page.locator('#mount-b textarea.rv-chat-input')).toHaveValue('');
  const pending = await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    attachments: () => string,
  } }).__chatSurfaceIsolation.attachments());
  expect(pending).toContain('same-file-stable-id');
});

test('ACK cleanup preserves a stable-ID attachment removed and readded while pending', async ({ page }) => {
  await mountFixture(page);
  const attachment = { id: 'saved-screenshot-stable-id', kind: 'file', path: 'same.png', name: 'same.png' };
  await page.evaluate(({ workspaceId, attachment }) => (window as unknown as { __chatSurfaceIsolation: {
    addAttachment: (workspaceId: string, threadId: string, attachment: unknown) => void,
  } }).__chatSurfaceIsolation.addAttachment(workspaceId, 'isolation-thread-a', attachment),
  { workspaceId: WS_ID, attachment });
  await page.locator('#mount-a textarea.rv-chat-input').fill('ATTACHMENT-SNAPSHOT');
  await page.locator('#mount-a textarea.rv-chat-input').press('Enter');
  const prompt = (await sentFrames(page)).find((frame) => frame.type === 'prompt' && frame.threadId === THREAD_A);
  expect(prompt?.attachments).toHaveLength(1);
  await page.evaluate(({ workspaceId, attachment }) => {
    const api = (window as unknown as { __chatSurfaceIsolation: {
      removeAttachment: (workspaceId: string, threadId: string, id: string) => void,
      addAttachment: (workspaceId: string, threadId: string, attachment: unknown) => void,
    } }).__chatSurfaceIsolation;
    api.removeAttachment(workspaceId, 'isolation-thread-a', attachment.id);
    api.addAttachment(workspaceId, 'isolation-thread-a', attachment);
  }, { workspaceId: WS_ID, attachment });
  await deliver(page, { type: 'message:sent', workspaceId: WS_ID, threadId: THREAD_A,
    requestId: prompt?.requestId, turnId: 'attachment-turn-1', content: 'ATTACHMENT-SNAPSHOT' });
  const pending = await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    attachments: () => string,
  } }).__chatSurfaceIsolation.attachments());
  expect(pending).toContain('saved-screenshot-stable-id');
  await expect(page.locator('#mount-a .rv-message-user')).toHaveCount(1);
});

test('interleaved live frames for both threads render only their own content, thinking, tools, usage, Todos, errors, and saved turns', async ({ page }) => {
  await mountFixture(page);

  for (const [threadId, turnId] of [[THREAD_A, 'turn-a'], [THREAD_B, 'turn-b']] as const) {
    await deliverStream(page, { type: 'turn_begin', threadId, turnId, streamSeq: 1 });
  }
  await deliverStream(page, { type: 'content', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 2, text: 'CONTENT-A-ONLY' });
  await deliverStream(page, { type: 'content', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 2, text: 'CONTENT-B-ONLY' });
  await deliverStream(page, { type: 'thinking', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 3, text: 'THINK-A-ONLY' });
  await deliverStream(page, { type: 'thinking', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 3, text: 'THINK-B-ONLY' });
  await deliverStream(page, { type: 'tool_call', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 4, toolCallId: 'tool-a', toolName: 'bash', toolArgs: { command: 'TOOL-A-ONLY' } });
  await deliverStream(page, { type: 'tool_call', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 4, toolCallId: 'tool-b', toolName: 'bash', toolArgs: { command: 'TOOL-B-ONLY' } });
  await deliverStream(page, { type: 'step_begin', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 5, identity: 'step-a', startedAt: 1000, activityRevision: 1 });
  await deliverStream(page, { type: 'step_begin', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 5, identity: 'step-b', startedAt: 1000, activityRevision: 1 });

  // Todo state rides the real per-thread todo tool path (tool_call +
  // tool_call_args -> setTodoDrawer on that exact thread's chat slot).
  await deliverStream(page, { type: 'tool_call', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 6, toolCallId: 'todo-a1', toolName: 'todo' });
  await deliverStream(page, { type: 'tool_call', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 6, toolCallId: 'todo-b1', toolName: 'todo' });
  await deliverStream(page, {
    type: 'tool_call_args', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 7, toolCallId: 'todo-a1',
    argsChunk: JSON.stringify({ todos: [{ content: 'TODO-A-ONLY', status: 'in_progress' }] }),
  });
  await deliverStream(page, {
    type: 'tool_call_args', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 7, toolCallId: 'todo-b1',
    argsChunk: JSON.stringify({ todos: [{ content: 'TODO-B-ONLY', status: 'in_progress' }] }),
  });
  // A second todo update for A only (B stays on its first value for now).
  await deliverStream(page, { type: 'tool_call', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 8, toolCallId: 'todo-a2', toolName: 'todo' });
  await deliverStream(page, {
    type: 'tool_call_args', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 9, toolCallId: 'todo-a2',
    argsChunk: JSON.stringify({ todos: [{ content: 'TODO-A-UPDATED', status: 'completed' }] }),
  });
  await deliverStream(page, { type: 'status_update', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 10, contextUsage: 0.11 });

  // A has updated its Todo twice; B's rendered Todo state must be untouched.
  await page.locator('#mount-b .rv-todo-drawer-handle').dispatchEvent('click');
  await page.locator('#mount-b .rv-todo-drawer-list').waitFor({ timeout: 10_000 });
  await expect(page.locator('#mount-b .rv-todo-drawer-item-text')).toHaveText(['TODO-B-ONLY']);
  await expect(page.locator('#mount-b .rv-todo-drawer')).not.toContainText('TODO-A-UPDATED');
  await expect(page.locator('#mount-b .rv-todo-drawer')).not.toContainText('TODO-A-ONLY');

  // B advances its own sequence with its second todo update.
  await deliverStream(page, { type: 'tool_call', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 8, toolCallId: 'todo-b2', toolName: 'todo' });
  await deliverStream(page, {
    type: 'tool_call_args', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 9, toolCallId: 'todo-b2',
    argsChunk: JSON.stringify({ todos: [{ content: 'TODO-B-UPDATED', status: 'completed' }] }),
  });
  await deliverStream(page, { type: 'status_update', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 10, contextUsage: 0.22 });

  await deliverStream(page, {
    type: 'turn_end', threadId: THREAD_A, turnId: 'turn-a', streamSeq: 11, partial: true, reason: 'error',
    terminalError: {
      kind: 'runtime',
      code: 'MODEL_TIMEOUT',
      message: 'The model response timed out before it completed.',
      recoverable: true,
    },
  });
  await deliverStream(page, { type: 'turn_end', threadId: THREAD_B, turnId: 'turn-b', streamSeq: 11, partial: true, reason: 'interrupted' });
  await deliverStream(page, { type: 'chat-turn:saved', threadId: THREAD_A, turnId: 'turn-a', exchangeId: 1001, seq: 1, ts: 1, metadata: {} });
  await deliverStream(page, { type: 'chat-turn:saved', threadId: THREAD_B, turnId: 'turn-b', exchangeId: 2002, seq: 1, ts: 1, metadata: {} });

  // Content isolation through the rendered DOM.
  await expect(page.locator('#mount-a .rv-chat-messages')).toContainText('CONTENT-A-ONLY');
  await expect(page.locator('#mount-a .rv-chat-messages')).not.toContainText('CONTENT-B-ONLY');
  await expect(page.locator('#mount-b .rv-chat-messages')).toContainText('CONTENT-B-ONLY');
  await expect(page.locator('#mount-b .rv-chat-messages')).not.toContainText('CONTENT-A-ONLY');

  // Error isolation: only A's terminal error renders.
  await expect(page.locator('#mount-a .rv-chat-turn-error')).toHaveAttribute('data-error-code', 'MODEL_TIMEOUT');
  await expect(page.locator('#mount-b .rv-chat-turn-error')).toHaveCount(0);

  // Todo isolation through the rendered DOM: each surface shows only its own
  // thread's final Todo state, and no marker crosses over. (`dispatchEvent`
  // toggles the handle directly: an expanded drawer is viewport-positioned and
  // can overlay a sibling mount's handle.)
  await page.locator('#mount-a .rv-todo-drawer-handle').dispatchEvent('click');
  await page.locator('#mount-a .rv-todo-drawer-list').waitFor({ timeout: 10_000 });
  await expect(page.locator('#mount-a .rv-todo-drawer-item-text')).toHaveText(['TODO-A-UPDATED']);
  await expect(page.locator('#mount-a .rv-todo-drawer')).not.toContainText('TODO-A-ONLY');
  await expect(page.locator('#mount-a .rv-todo-drawer')).not.toContainText('TODO-B-UPDATED');
  await expect(page.locator('#mount-b .rv-todo-drawer-item-text')).toHaveText(['TODO-B-UPDATED']);
  await expect(page.locator('#mount-b .rv-todo-drawer')).not.toContainText('TODO-A-UPDATED');

  // Per-thread thinking/tool/saved-turn isolation through the real store path.
  const state = await storeState(page);
  const aMessages = JSON.stringify(state.projectChats[THREAD_A].messages);
  const bMessages = JSON.stringify(state.projectChats[THREAD_B].messages);
  expect(aMessages).toContain('THINK-A-ONLY');
  expect(aMessages).toContain('TOOL-A-ONLY');
  expect(aMessages).not.toContain('THINK-B-ONLY');
  expect(aMessages).not.toContain('TOOL-B-ONLY');
  expect(bMessages).toContain('THINK-B-ONLY');
  expect(bMessages).toContain('TOOL-B-ONLY');
  expect(bMessages).not.toContain('THINK-A-ONLY');
  expect(bMessages).not.toContain('TOOL-A-ONLY');
  expect(state.projectChats[THREAD_A].messages.at(-1).exchangeId).toBe(1001);
  expect(state.projectChats[THREAD_B].messages.at(-1).exchangeId).toBe(2002);

  // Todo store isolation: exact per-thread slots, no crossover.
  expect(state.projectChats[THREAD_A].todoDrawer.items.map((item: { content: string }) => item.content))
    .toEqual(['TODO-A-UPDATED']);
  expect(state.projectChats[THREAD_B].todoDrawer.items.map((item: { content: string }) => item.content))
    .toEqual(['TODO-B-UPDATED']);
  expect(aMessages).toContain('TODO-A-UPDATED');
  expect(aMessages).not.toContain('TODO-B-UPDATED');
  expect(bMessages).toContain('TODO-B-UPDATED');
  expect(bMessages).not.toContain('TODO-A-UPDATED');

  // Usage isolation: per-thread values never overwrite the other surface.
  expect(state.contextUsageByThread[THREAD_A]).toBeCloseTo(0.11, 6);
  expect(state.contextUsageByThread[THREAD_B]).toBeCloseTo(0.22, 6);
  await expect(page.locator('#mount-a .rv-chat-composer-context-trigger')).toHaveAttribute('aria-label', 'Context usage: 11%');
  await expect(page.locator('#mount-b .rv-chat-composer-context-trigger')).toHaveAttribute('aria-label', 'Context usage: 22%');
});

test('Stop targets one active session and leaves the other session untouched', async ({ page }) => {
  await mountFixture(page);
  await deliverStream(page, { type: 'turn_begin', threadId: THREAD_A, turnId: 'turn-stop-a', streamSeq: 1 });

  await expect(page.locator('#mount-a .rv-stop-btn')).toBeVisible();
  await expect(page.locator('#mount-b .rv-stop-btn')).toHaveCount(0);

  await page.locator('#mount-a .rv-stop-btn').click();
  const frames = await sentFrames(page);
  const stop = frames.find((frame) => frame.type === 'turn:stop');
  expect(stop).toMatchObject({ type: 'turn:stop', threadId: THREAD_A });

  const state = await storeState(page);
  // B's turn state is untouched by A's Stop.
  expect(state.projectChats[THREAD_B].currentTurn).toBeNull();
  expect(state.projectChats[THREAD_A].currentTurn?.id).toBe('turn-stop-a');
});

test('usage/readiness are per-thread and a wire_ready for one session never marks the other', async ({ page }) => {
  await mountFixture(page);
  await deliverStream(page, { type: 'turn_begin', threadId: THREAD_A, turnId: 'turn-usage-a', streamSeq: 1 });
  await deliverStream(page, { type: 'status_update', threadId: THREAD_A, turnId: 'turn-usage-a', streamSeq: 2, contextUsage: 0.31 });
  await deliver(page, { type: 'wire_ready', threadId: THREAD_A });

  let state = await storeState(page);
  expect(state.contextUsageByThread[THREAD_A]).toBeCloseTo(0.31, 6);
  expect(state.contextUsageByThread[THREAD_B] ?? 0).toBe(0);
  expect(state.wireReadyByThread[THREAD_A]).toBe(true);
  expect(state.wireReadyByThread[THREAD_B] ?? false).toBe(false);

  await deliverStream(page, { type: 'turn_begin', threadId: THREAD_B, turnId: 'turn-usage-b', streamSeq: 1 });
  await deliverStream(page, { type: 'status_update', threadId: THREAD_B, turnId: 'turn-usage-b', streamSeq: 2, contextUsage: 0.62 });
  await deliver(page, { type: 'wire_ready', threadId: THREAD_B });
  state = await storeState(page);
  expect(state.contextUsageByThread[THREAD_A]).toBeCloseTo(0.31, 6);
  expect(state.contextUsageByThread[THREAD_B]).toBeCloseTo(0.62, 6);
  expect(state.wireReadyByThread[THREAD_A]).toBe(true);
  expect(state.wireReadyByThread[THREAD_B]).toBe(true);
});

test('model/variant pending, acknowledgement, rejection, and hydration stay per thread', async ({ page }) => {
  await mountFixture(page);

  await page.evaluate((threadId) => {
    (window as unknown as {
      __chatSurfaceIsolation: {
        beginSelection: (id: string, pending: { modelId: string; variant: string; requestId: string }) => void;
      };
    }).__chatSurfaceIsolation.beginSelection(threadId, { modelId: 'mPending', variant: 'low', requestId: 'r-pending' });
  }, THREAD_A);

  // Pending is per-surface DOM state: A busy, B untouched.
  await expect(page.locator('#mount-a .rv-chat-composer-model')).toHaveAttribute('data-model-pending', 'true');
  await expect(page.locator('#mount-b .rv-chat-composer-model')).toHaveAttribute('data-model-pending', 'false');

  // Exact-session acknowledgement promotes A only.
  await deliver(page, {
    type: 'thread:action:completed', action: 'set_harness_selection',
    threadId: THREAD_A, threadGroupId: GROUP_A, requestId: 'r-pending', model: 'mA2', variant: 'medium', harnessId: 'opencode',
  });
  let state = await storeState(page);
  expect(state.harnessSelectionByThread[THREAD_A]).toMatchObject({
    acknowledged: { model: 'mA2', variant: 'medium' }, pending: null,
  });
  expect(state.harnessSelectionByThread[THREAD_B].acknowledged).toMatchObject({ model: 'mB', variant: 'low' });
  await expect(page.locator('#mount-a .rv-chat-composer-model')).toHaveAttribute('data-model-pending', 'false');
  await expect(page.locator('#mount-b .rv-chat-composer-model')).toHaveAttribute('data-model-pending', 'false');

  // Rejection restores A's prior acknowledged value; B stays independent.
  await page.evaluate((threadId) => {
    (window as unknown as {
      __chatSurfaceIsolation: {
        beginSelection: (id: string, pending: { modelId: string; variant: string; requestId: string }) => void;
      };
    }).__chatSurfaceIsolation.beginSelection(threadId, { modelId: 'mRejected', variant: 'high', requestId: 'r-rejected' });
  }, THREAD_A);
  await deliver(page, {
    type: 'thread:action:error', action: 'set_harness_selection',
    threadId: THREAD_A, threadGroupId: GROUP_A, requestId: 'r-rejected', code: 'invalid_selection',
  });
  state = await storeState(page);
  expect(state.harnessSelectionByThread[THREAD_A]).toMatchObject({
    acknowledged: { model: 'mA2', variant: 'medium' }, pending: null,
  });

  // Reopen/hydration for B only.
  await deliver(page, {
    type: 'thread:opened', threadId: THREAD_B, threadGroupId: GROUP_B,
    thread: { name: 'Beta', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 0, status: 'active', harnessId: 'opencode', harnessConfig: { model: 'mB2', variant: null } },
    exchanges: [],
  });
  state = await storeState(page);
  expect(state.harnessSelectionByThread[THREAD_B].acknowledged).toMatchObject({ model: 'mB2', variant: null });
  expect(state.harnessSelectionByThread[THREAD_A].acknowledged).toMatchObject({ model: 'mA2', variant: 'medium' });
});

test('drafts and attachments remain per workspace/thread owner stores and never cross surfaces', async ({ page }) => {
  await mountFixture(page);
  await page.evaluate((wsId) => {
    const api = (window as unknown as {
      __chatSurfaceIsolation: {
        setDraft: (workspaceId: string, threadId: string, text: string) => void;
        addAttachment: (workspaceId: string, threadId: string, attachment: unknown) => void;
      };
    }).__chatSurfaceIsolation;
    api.setDraft(wsId, 'isolation-thread-a', 'DRAFT-A');
    api.setDraft(wsId, 'isolation-thread-b', 'DRAFT-B');
    api.addAttachment(wsId, 'isolation-thread-a', { id: 'att-a', kind: 'file', path: 'a.md', name: 'a.md' });
    api.addAttachment(wsId, 'isolation-thread-b', { id: 'att-b', kind: 'file', path: 'b.md', name: 'b.md' });
  }, WS_ID);

  const drafts = JSON.parse(await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { drafts: () => string } }
  ).__chatSurfaceIsolation.drafts())) as Record<string, string>;
  const attachments = await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { attachments: () => string } }
  ).__chatSurfaceIsolation.attachments());

  const draftAKey = Object.keys(drafts).find((key) => key.includes(THREAD_A));
  const draftBKey = Object.keys(drafts).find((key) => key.includes(THREAD_B));
  expect(draftAKey).toBeTruthy();
  expect(draftBKey).toBeTruthy();
  expect(drafts[draftAKey!]).toBe('DRAFT-A');
  expect(drafts[draftBKey!]).toBe('DRAFT-B');
  expect(drafts[draftAKey!]).not.toBe(drafts[draftBKey!]);

  expect(attachments).toContain('att-a');
  expect(attachments).toContain('att-b');
  expect(attachments).toContain(THREAD_A);
  expect(attachments).toContain(THREAD_B);
});

test('duplicate mounts preserve exact draft input semantics while other sessions stay isolated', async ({ page }) => {
  await mountFixture(page);
  const inputA = page.locator('#mount-a textarea.rv-chat-input');
  const inputB = page.locator('#mount-b textarea.rv-chat-input');

  await inputA.fill('A-only');
  await expect(inputB).toHaveValue('');
  await inputB.fill('B-only');
  await expect(inputA).toHaveValue('A-only');

  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    setSameSession: (same: boolean) => void,
  } }).__chatSurfaceIsolation.setSameSession(true));
  await expect(inputB).toHaveValue('A-only');

  await inputA.fill('alpha omega');
  await inputA.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(6, 11));
  await inputA.focus();
  await page.keyboard.type('BETA');
  await expect(inputA).toHaveValue('alpha BETA');
  await expect(inputB).toHaveValue('alpha BETA');
  expect(await inputA.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd]))
    .toEqual([10, 10]);

  const insertByInputType = async (text: string, inputType: string, composition = false) => {
    await inputA.evaluate((node: HTMLTextAreaElement, { text, inputType, composition }) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      const next = `${node.value}${text}`;
      if (composition) node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: text }));
      setter?.call(node, next);
      node.setSelectionRange(next.length, next.length);
      node.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: text,
        inputType,
        isComposing: composition,
      }));
      if (composition) node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
    }, { text, inputType, composition });
  };

  await insertByInputType(' 文', 'insertCompositionText', true);
  await insertByInputType(' PASTE', 'insertFromPaste');
  await insertByInputType(' DROP', 'insertFromDrop');
  await inputA.focus();
  await page.keyboard.insertText(' 😀');
  await expect(inputB).toHaveValue('alpha BETA 文 PASTE DROP 😀');

  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    upsertAutocompleteCandidate: (candidate: unknown) => void,
  } }).__chatSurfaceIsolation.upsertAutocompleteCandidate({
    id: 'open-tab:/tmp/notes.ts',
    label: 'notes.ts',
    path: '/tmp/notes.ts',
    basename: 'notes.ts',
    source: 'open-tab',
    openedAt: 1,
  }));
  await inputA.fill('open notes');
  await expect(page.locator('#mount-a .rv-chat-autocomplete-ghost')).toBeVisible();
  await inputA.press('Tab');
  await expect(inputA).toHaveValue('open notes.ts ');
  await expect(inputB).toHaveValue('open notes.ts ');

  const multiline = Array.from({ length: 14 }, (_, index) => `line-${index}`).join('\n');
  await inputA.fill(multiline);
  const resize = await inputA.evaluate((node: HTMLTextAreaElement) => ({
    height: Number.parseFloat(node.style.height),
    overflowY: node.style.overflowY,
    exact: node.value,
  }));
  expect(resize.exact).toBe(multiline);
  expect(resize.height).toBeGreaterThanOrEqual(42);
  expect(['auto', 'hidden']).toContain(resize.overflowY);

  await page.evaluate(({ workspaceId, threadId }) => (window as unknown as { __chatSurfaceIsolation: {
    addAttachment: (workspaceId: string, threadId: string, attachment: unknown) => void,
  } }).__chatSurfaceIsolation.addAttachment(workspaceId, threadId,
    { id: 'shared-drop-file', kind: 'file', path: 'drop.md', label: 'drop.md' }),
  { workspaceId: WS_ID, threadId: THREAD_A });
  await expect(page.locator('#mount-a .rv-chat-attachment-pill')).toHaveCount(1);
  await expect(page.locator('#mount-b .rv-chat-attachment-pill')).toHaveCount(1);
});

test('draft-only updates render the exact composer leaf without history, formatter, or header work', async ({ page }) => {
  await mountFixture(page);
  await page.evaluate((threadId) => {
    const fixture = (window as unknown as { __chatSurfaceIsolation: {
      seedCompletedHistory: (id: string) => void;
      resetRenderProbe: () => void;
    } }).__chatSurfaceIsolation;
    fixture.seedCompletedHistory(threadId);
  }, THREAD_A);
  await expect(page.locator('#mount-a .rv-message')).toHaveCount(2);
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    resetRenderProbe: () => void;
  } }).__chatSurfaceIsolation.resetRenderProbe());

  const exact = 'draft stays local byte-for-byte 😀';
  await page.locator('#mount-a textarea.rv-chat-input').fill(exact);
  await expect(page.locator('#mount-a textarea.rv-chat-input')).toHaveValue(exact);
  const probe = await page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { renderProbe: () => string } })
      .__chatSurfaceIsolation.renderProbe(),
  )) as { components: Record<string, number>; formatters: Record<string, number> };
  expect(probe.components.ConnectedChatComposer).toBeGreaterThan(0);
  expect(probe.components.ConnectedChatHistory ?? 0).toBe(0);
  expect(probe.components.MessageList ?? 0).toBe(0);
  expect(probe.components.InstantSegmentRenderer ?? 0).toBe(0);
  expect(probe.components.ChatAreaHeader ?? 0).toBe(0);
  expect(Object.values(probe.formatters).reduce((sum, count) => sum + count, 0)).toBe(0);
});

test('20fps live frontier keeps completed formatting quiet and preserves public history UI state', async ({ page }) => {
  await mountFixture(page);
  await page.evaluate((threadId) => (window as unknown as { __chatSurfaceIsolation: {
    seedCompletedHistoryPair: (id: string) => void;
  } }).__chatSurfaceIsolation.seedCompletedHistoryPair(threadId), THREAD_A);
  const mount = page.locator('#mount-a');
  await expect(mount.locator('.rv-message')).toHaveCount(4);
  const tool = mount.locator('.rv-tool-header-btn').first();
  await tool.click();
  await expect(tool).toHaveAttribute('data-expanded', 'true');
  await expect(mount.getByRole('button', { name: 'Starred' })).toHaveCount(1);
  await expect(mount.locator('a[href="https://example.test/history"]')).toHaveCount(1);

  const before = await page.evaluate(() => {
    const root = document.querySelector('#mount-a');
    const text = root?.querySelector('.rv-message-assistant-content')?.firstChild;
    const selection = window.getSelection();
    if (text && selection) {
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const viewport = root?.querySelector<HTMLElement>('.rv-chat-scroll-viewport');
    if (viewport) viewport.scrollTop = 7;
    (window as any).__historyStableNodes = Array.from(root?.querySelectorAll('.rv-message') ?? []);
    return { selection: selection?.toString() ?? '', scrollTop: viewport?.scrollTop ?? null };
  });
  expect(before.selection).toContain('FIRST ANSWER');
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    resetRenderProbe: () => void;
  } }).__chatSurfaceIsolation.resetRenderProbe());

  await deliverStream(page, { type: 'turn_begin', threadId: THREAD_A, turnId: 'turn-20fps', streamSeq: 1 });
  for (let index = 0; index < 20; index += 1) {
    await deliverStream(page, {
      type: 'content', threadId: THREAD_A, turnId: 'turn-20fps', streamSeq: index + 2,
      activityRevision: index + 1, text: `frame-${index} `,
    });
    await page.waitForTimeout(50);
  }

  const probe = await page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { renderProbe: () => string } })
      .__chatSurfaceIsolation.renderProbe(),
  )) as { components: Record<string, number>; formatters: Record<string, number> };
  expect(probe.components.MessageList).toBeGreaterThan(0);
  expect(probe.components.InstantSegmentRenderer ?? 0).toBe(0);
  expect(probe.formatters.renderTextInstant ?? 0).toBe(0);
  await expect(tool).toHaveAttribute('data-expanded', 'true');
  await expect(mount.locator('a[href="https://example.test/history"]')).toHaveCount(1);
  await expect(mount.getByRole('button', { name: 'Starred' })).toHaveCount(1);
  const after = await page.evaluate(() => {
    const root = document.querySelector('#mount-a');
    const current = Array.from(root?.querySelectorAll('.rv-message') ?? []);
    const stable = (window as any).__historyStableNodes as Element[];
    return {
      sameNodes: stable.every((node, index) => current[index] === node),
      selection: window.getSelection()?.toString() ?? '',
      scrollTop: root?.querySelector<HTMLElement>('.rv-chat-scroll-viewport')?.scrollTop ?? null,
    };
  });
  expect(after).toEqual({ sameNodes: true, selection: before.selection, scrollTop: before.scrollTop });
});

test('metadata invalidation is scoped while hydration/content replacement cannot reuse stale formatting', async ({ page }) => {
  await mountFixture(page);
  await page.evaluate((threadId) => (window as unknown as { __chatSurfaceIsolation: {
    seedCompletedHistoryPair: (id: string) => void;
  } }).__chatSurfaceIsolation.seedCompletedHistoryPair(threadId), THREAD_A);
  const revisionsBefore = await page.evaluate((threadId) => (
    window as unknown as { __chatSurfaceIsolation: { historyRevisions: (id: string) => unknown } }
  ).__chatSurfaceIsolation.historyRevisions(threadId), THREAD_A) as Array<Record<string, string>>;
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    resetRenderProbe: () => void;
  } }).__chatSurfaceIsolation.resetRenderProbe());
  await page.evaluate(({ threadId, exchangeId }) => (
    window as unknown as { __chatSurfaceIsolation: {
      updateHistoryMetadata: (id: string, exchange: number, metadata: unknown) => void;
    } }
  ).__chatSurfaceIsolation.updateHistoryMetadata(threadId, exchangeId, {
    bookmark: { type: 'heart' }, note: { body: 'scoped note' },
  }), { threadId: THREAD_A, exchangeId: 101 });
  await expect(page.locator('#mount-a').getByRole('button', { name: 'Liked' })).toHaveCount(1);
  await expect(page.locator('#mount-a').getByRole('button', { name: 'Starred' })).toHaveCount(1);
  const revisionsAfter = await page.evaluate((threadId) => (
    window as unknown as { __chatSurfaceIsolation: { historyRevisions: (id: string) => unknown } }
  ).__chatSurfaceIsolation.historyRevisions(threadId), THREAD_A) as Array<Record<string, string>>;
  expect(revisionsAfter[0].contentRevision).toBe(revisionsBefore[0].contentRevision);
  expect(revisionsAfter[0].metadataRevision).not.toBe(revisionsBefore[0].metadataRevision);
  expect(revisionsAfter[1]).toEqual(revisionsBefore[1]);
  let probe = await page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { renderProbe: () => string } })
      .__chatSurfaceIsolation.renderProbe(),
  )) as { components: Record<string, number>; formatters: Record<string, number> };
  expect(probe.components.InstantSegmentRenderer).toBe(1);
  expect(probe.formatters.renderTextInstant ?? 0).toBe(0);

  const tool = page.locator('#mount-a .rv-tool-header-btn').first();
  await tool.click();
  await expect(tool).toHaveAttribute('data-expanded', 'true');
  await page.evaluate(() => {
    (window as any).__historyToolDerivedNode = document.querySelector('#mount-a .rv-tool-content-body');
    (window as unknown as { __chatSurfaceIsolation: { resetRenderProbe: () => void } })
      .__chatSurfaceIsolation.resetRenderProbe();
  });
  await page.evaluate(({ threadId, exchangeId }) => (
    window as unknown as { __chatSurfaceIsolation: {
      updateHistoryMetadata: (id: string, exchange: number, metadata: unknown) => void;
    } }
  ).__chatSurfaceIsolation.updateHistoryMetadata(threadId, exchangeId, {
    bookmark: { type: 'flag' }, note: { body: 'tool row note' },
  }), { threadId: THREAD_A, exchangeId: 102 });
  await expect(tool).toHaveAttribute('data-expanded', 'true');
  expect(await page.evaluate(() => (
    (window as any).__historyToolDerivedNode === document.querySelector('#mount-a .rv-tool-content-body')
  ))).toBe(true);
  probe = await page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { renderProbe: () => string } })
      .__chatSurfaceIsolation.renderProbe(),
  )) as { components: Record<string, number>; formatters: Record<string, number> };
  expect(probe.components.InstantSegmentRenderer).toBe(1);
  expect(probe.formatters.renderTextInstant ?? 0).toBe(0);

  const opened = (text: string, bookmark: string) => ({
    type: 'thread:opened', threadId: THREAD_A, threadGroupId: GROUP_A, workspaceId: WS_ID, viewId: null,
    thread: { name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1,
      status: 'active', harnessId: 'opencode', harnessConfig: {} },
    exchanges: [{ exchangeId: 101, seq: 1, ts: 10, user: 'rehydrated question',
      assistant: { parts: [{ type: 'text', content: text }] }, metadata: { bookmark: { type: bookmark } } }],
  });
  await deliver(page, opened('HYDRATED FIRST CONTENT', 'flag'));
  await expect(page.locator('#mount-a .rv-chat-messages')).toContainText('HYDRATED FIRST CONTENT');
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    resetRenderProbe: () => void;
  } }).__chatSurfaceIsolation.resetRenderProbe());
  await deliver(page, opened('HYDRATED EDITED CONTENT', 'heart'));
  await expect(page.locator('#mount-a .rv-chat-messages')).toContainText('HYDRATED EDITED CONTENT');
  await expect(page.locator('#mount-a .rv-chat-messages')).not.toContainText('HYDRATED FIRST CONTENT');
  await expect(page.locator('#mount-a').getByRole('button', { name: 'Liked' })).toHaveCount(1);
  probe = await page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { renderProbe: () => string } })
      .__chatSurfaceIsolation.renderProbe(),
  )) as { components: Record<string, number>; formatters: Record<string, number> };
  expect(probe.formatters.renderTextInstant).toBeGreaterThan(0);
  expect(await page.locator('#mount-a .rv-message').count()).toBe(2);
});

test('replacing an unrelated thread row does not reproject the target parent or leaves', async ({ page }) => {
  await mountFixture(page);
  expect((await storeState(page)).threads.find((thread: { threadId: string }) => (
    thread.threadId === THREAD_A
  ))?.entry?.name).toBe('Alpha');
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    resetRenderProbe: () => void;
    replaceUnrelatedThread: (name: string) => void;
  } }).__chatSurfaceIsolation.resetRenderProbe());
  await page.evaluate(() => (window as unknown as { __chatSurfaceIsolation: {
    replaceUnrelatedThread: (name: string) => void;
  } }).__chatSurfaceIsolation.replaceUnrelatedThread('Gamma replaced'));
  await page.waitForTimeout(50);

  expect((await storeState(page)).threads.find((thread: { threadId: string }) => (
    thread.threadId === THREAD_A
  ))?.entry?.name).toBe('Alpha');
  const probe = await page.evaluate(() => JSON.parse(
    (window as unknown as { __chatSurfaceIsolation: { renderProbe: () => string } })
      .__chatSurfaceIsolation.renderProbe(),
  )) as { components: Record<string, number>; formatters: Record<string, number> };
  for (const name of [
    'ChatSurface',
    'ConnectedChatHeader',
    'ConnectedChatHistory',
    'ChatAreaHeader',
    'MessageList',
    'InstantSegmentRenderer',
  ]) {
    expect(probe.components[name] ?? 0, `${name} should stay local`).toBe(0);
  }
  expect(Object.values(probe.formatters).reduce((sum, count) => sum + count, 0)).toBe(0);
});


test('collapsed header New Chat and Rename keep the explicit view/group address', async ({ page }) => {
  await mountFixture(page);
  await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { setSidebarA: (v: boolean) => void } }
  ).__chatSurfaceIsolation.setSidebarA(true));
  await page.locator('#mount-a').getByRole('button', { name: 'New chat' }).click();
  const create = (await sentFrames(page)).find((frame) => frame.type === 'thread:open-assistant');
  expect(create).toMatchObject({ type: 'thread:open-assistant', viewId: 'file-viewer' });

  await page.evaluate(() => {
    (window as unknown as { prompt: (message: string, value?: string) => string }).prompt = (_message, value) => {
      (window as unknown as { __renameDefault: string | undefined }).__renameDefault = value;
      return 'Renamed Header';
    };
  });
  await page.locator('#mount-a').getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menu', { name: 'Chat options' }).getByRole('menuitem', { name: 'Rename' }).click();
  const rename = (await sentFrames(page)).find((frame) => frame.type === 'thread:action' && frame.action === 'rename');
  expect(rename).toMatchObject({ action: 'rename', threadGroupId: GROUP_A, threadId: THREAD_A, name: 'Renamed Header' });
  expect(await page.evaluate(() => (window as unknown as { __renameDefault: string }).__renameDefault)).toBe('Alpha');
});

test('opening a menu on surface A leaves surface B DOM/menu/focus untouched', async ({ page }) => {
  await mountFixture(page);
  const moreA = page.locator('#mount-a').getByRole('button', { name: 'More options' });
  const moreB = page.locator('#mount-b').getByRole('button', { name: 'More options' });
  await expect(moreA).toHaveAttribute('aria-expanded', 'false');
  await expect(moreB).toHaveAttribute('aria-expanded', 'false');
  await moreA.click();
  await expect(moreA).toHaveAttribute('aria-expanded', 'true');
  await expect(moreB).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('menu', { name: 'Chat options' })).toHaveCount(1);

  const ids = await surfaceIds(page);
  const moreId = await moreA.getAttribute('id');
  expect(moreId).toContain(ids.a.replace(/[^A-Za-z0-9_-]/g, '-'));

  // Per-mount model menus are keyed by their own thread identity.
  await expect(page.locator('#mount-a .rv-chat-composer-model')).toHaveAttribute('data-thread-id', THREAD_A);
  await expect(page.locator('#mount-b .rv-chat-composer-model')).toHaveAttribute('data-thread-id', THREAD_B);
});

test('Chat/Threads collapse and content collapse/expand preserve both surface identities and state', async ({ page }) => {
  await mountFixture(page);
  const before = await surfaceIds(page);

  await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { toggleCollapsedA: () => void } }
  ).__chatSurfaceIsolation.toggleCollapsedA());
  await expect(page.locator('#mount-a [data-surface-id]')).toBeVisible();
  let ids = await surfaceIds(page);
  expect(ids.a).toBe(before.a);

  await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { setSidebarA: (v: boolean) => void } }
  ).__chatSurfaceIsolation.setSidebarA(true));
  await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { setContentA: (v: boolean) => void } }
  ).__chatSurfaceIsolation.setContentA(true));
  await expect(page.locator('#mount-a .rv-chat-area')).toBeVisible();
  ids = await surfaceIds(page);
  expect(ids.a).toBe(before.a);
  expect(ids.b).toBe(before.b);

  await page.evaluate(() => (
    window as unknown as { __chatSurfaceIsolation: { toggleCollapsedA: () => void } }
  ).__chatSurfaceIsolation.toggleCollapsedA());
  ids = await surfaceIds(page);
  expect(ids.a).toBe(before.a);
  // No chat identity was cleared, reassigned, or persisted by shell visibility.
  const state = await storeState(page);
  expect(state.currentThreadId).toBeNull();
  const serialized = JSON.stringify(state);
  expect(serialized).not.toContain('chat-surface:');
});

test('the pending-new-thread connecting state is surface-owned and never leaks to another mount', async ({ page }) => {
  await mountFixture(page);
  const ids = await surfaceIds(page);

  await page.evaluate((surfaceId) => {
    const api = (window as unknown as {
      __chatSurfaceIsolation: {
        setGlobalConnecting: (harnessId: string) => void;
        setConnectingForSurface: (surfaceId: string, harnessId: string) => void;
      };
    }).__chatSurfaceIsolation;
    // A global pending-connecting state alone never surfaces on an explicit mount.
    api.setGlobalConnecting('opencode');
    api.setConnectingForSurface(surfaceId, 'opencode');
  }, ids.a);

  await expect(page.locator('#mount-a .rv-connecting-overlay')).toHaveCount(1);
  await expect(page.locator('#mount-b .rv-connecting-overlay')).toHaveCount(0);

  await page.evaluate((surfaceId) => {
    (window as unknown as {
      __chatSurfaceIsolation: { clearConnectingForSurface: (id: string) => void };
    }).__chatSurfaceIsolation.clearConnectingForSurface(surfaceId);
  }, ids.a);
  await expect(page.locator('#mount-a .rv-connecting-overlay')).toHaveCount(0);
  await expect(page.locator('#mount-b .rv-connecting-overlay')).toHaveCount(0);
});

test('built client boots the real app on the isolated server without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await expect(page.locator('.rv-connection-status').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
