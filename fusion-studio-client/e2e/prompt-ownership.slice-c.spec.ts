import { expect, test } from '@playwright/test';
import type { ChatLinkAttachment } from '../src/lib/chat-file-links/file-link-types';
import { selectThread, startWaSession } from './support/working-activity-scenario';
import { NAME_A, THREAD_A as FIXTURE_A, THREAD_B as FIXTURE_B } from './support/working-activity-wire';

const THREAD_A = 'prompt-owner-a';
const THREAD_B = 'prompt-owner-b';
const WORKSPACE_A = 'workspace-owner-a';

const ATTACHMENT: ChatLinkAttachment = {
  id: 'shared-path-id',
  kind: 'file',
  label: 'owner.txt',
  path: '/owner.txt',
  sourceName: 'owner.txt',
};

test('Slice C: identical attachment IDs remain isolated by workspace and thread owner', async () => {
  const { chatAttachmentOwnerKey, useChatFileLinkStore } = await import(
    '../src/state/chatFileLinkStore'
  );
  useChatFileLinkStore.setState({ pendingAttachmentsByOwner: {} });
  const store = useChatFileLinkStore.getState();
  store.addPendingAttachment(WORKSPACE_A, THREAD_A, ATTACHMENT);
  store.addPendingAttachment(WORKSPACE_A, THREAD_B, ATTACHMENT);
  store.removePendingAttachments(WORKSPACE_A, THREAD_A, [ATTACHMENT.id]);

  const state = useChatFileLinkStore.getState().pendingAttachmentsByOwner;
  expect(state[chatAttachmentOwnerKey(WORKSPACE_A, THREAD_A)]?.attachments).toEqual([]);
  expect(state[chatAttachmentOwnerKey(WORKSPACE_A, THREAD_B)]?.attachments).toEqual([ATTACHMENT]);
});

test('Slice C: valid ownerless message:sent commits, stale deleted ownership does not recreate state', async () => {
  if (!('window' in globalThis)) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: new EventTarget(),
    });
  }
  const { usePanelStore } = await import('../src/state/panelStore');
  const { handleThreadMessage } = await import('../src/lib/ws/thread-handlers');
  const thread = {
    threadId: THREAD_A,
    entry: {
      name: 'Owned thread',
      createdAt: '2026-08-28T00:00:00.000Z',
      messageCount: 0,
      status: 'active' as const,
    },
  };
  usePanelStore.setState({
    activeWorkspaceId: WORKSPACE_A,
    threads: [thread],
    currentThreadId: THREAD_A,
    projectChats: {},
    secondary: null,
  });

  handleThreadMessage({ type: 'message:sent', threadId: THREAD_A, content: 'VALID' } as never);
  expect(usePanelStore.getState().projectChats[THREAD_A]?.messages.at(-1)?.content).toBe('VALID');

  usePanelStore.getState().removeThread(THREAD_A);
  handleThreadMessage({ type: 'message:sent', threadId: THREAD_A, content: 'STALE' } as never);
  expect(usePanelStore.getState().projectChats[THREAD_A]).toBeUndefined();
  expect(usePanelStore.getState().threads).toEqual([]);

  usePanelStore.setState({ activeWorkspaceId: WORKSPACE_A, threads: [thread], currentThreadId: THREAD_A });
  usePanelStore.getState().activateWorkspace('workspace-owner-b');
  handleThreadMessage({ type: 'message:sent', threadId: THREAD_A, content: 'CROSS-WORKSPACE' } as never);
  expect(usePanelStore.getState().projectChats[THREAD_A]).toBeUndefined();
});

test('Slice C: workspace activation evicts only the departed workspace attachment owners', async () => {
  const { chatAttachmentOwnerKey, useChatFileLinkStore } = await import(
    '../src/state/chatFileLinkStore'
  );
  const { usePanelStore } = await import('../src/state/panelStore');
  useChatFileLinkStore.setState({ pendingAttachmentsByOwner: {} });
  const store = useChatFileLinkStore.getState();
  store.addPendingAttachment(WORKSPACE_A, THREAD_A, ATTACHMENT);
  store.addPendingAttachment('workspace-owner-b', THREAD_B, ATTACHMENT);
  usePanelStore.setState({ activeWorkspaceId: WORKSPACE_A });
  usePanelStore.getState().activateWorkspace('workspace-owner-b');

  const state = useChatFileLinkStore.getState().pendingAttachmentsByOwner;
  expect(state[chatAttachmentOwnerKey(WORKSPACE_A, THREAD_A)]).toBeUndefined();
  expect(state[chatAttachmentOwnerKey('workspace-owner-b', THREAD_B)]?.attachments).toEqual([ATTACHMENT]);
});

test('Slice C: composer drafts swap immediately by thread and preserve pending retry ownership', async ({ browser }) => {
  const { fx, page } = await startWaSession(browser);
  const textarea = page.locator('section textarea').first();
  await textarea.fill('A-OWNED-DRAFT');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  await selectThread(fx, page, 'b');
  await expect(textarea).toHaveValue('');
  await textarea.fill('B-OWNED-DRAFT');
  await page.locator(`.rv-chat-item:has-text("${NAME_A}") >> visible=true`).first().click();
  await expect(textarea).toHaveValue('A-OWNED-DRAFT');
  await expect(textarea).toBeDisabled();
  await selectThread(fx, page, 'b');
  await expect(textarea).toHaveValue('B-OWNED-DRAFT');
  fx.push({ type: 'error', threadId: FIXTURE_A, error: 'Prompt failed' });
  await expect(textarea).toHaveValue('B-OWNED-DRAFT');
  await selectThread(fx, page, 'a');
  await expect(textarea).toBeEnabled();
  await expect(textarea).toHaveValue('A-OWNED-DRAFT');
  await selectThread(fx, page, 'b');
  await expect(textarea).toHaveValue('B-OWNED-DRAFT');
  expect(fx.sentFrames().filter((frame) => frame.type === 'prompt' && frame.threadId === FIXTURE_B)).toHaveLength(0);
  await selectThread(fx, page, 'a');
  await page.getByRole('button', { name: 'Send message', exact: true }).first().click();
  await selectThread(fx, page, 'b');
  fx.push({ type: 'message:sent', threadId: FIXTURE_A, content: 'A-OWNED-DRAFT' });
  await expect(textarea).toHaveValue('B-OWNED-DRAFT');
  await selectThread(fx, page, 'a');
  await expect(textarea).toHaveValue('');
});

test('Slice C: deferred screenshot cancels when its workspace and thread owner changes', async () => {
  let finishCapture: (value: string) => void = () => undefined;
  const capture = new Promise<string>((resolve) => { finishCapture = resolve; });
  const fakeWindow = new EventTarget() as Window & typeof globalThis;
  Object.assign(fakeWindow, {
    electronAPI: { capturePage: () => capture },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  if (!('WebSocket' in globalThis)) {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: { OPEN: 1 } });
  }
  const { usePanelStore } = await import('../src/state/panelStore');
  const { useChatFileLinkStore } = await import('../src/state/chatFileLinkStore');
  const { captureAndAttachScreenshot } = await import('../src/screenshots/chatScreenshotCapture');
  const { registerToastSetter, unregisterToastSetter } = await import('../src/lib/toast');
  useChatFileLinkStore.setState({ pendingAttachmentsByOwner: {} });
  usePanelStore.setState({
    activeWorkspaceId: WORKSPACE_A,
    currentThreadId: THREAD_A,
    threads: [],
    ws: { readyState: WebSocket.OPEN } as WebSocket,
  });
  let toast = '';
  registerToastSetter((message) => { toast = message; });
  const result = captureAndAttachScreenshot({ workspaceId: WORKSPACE_A, threadId: THREAD_A, surface: 'primary' });
  usePanelStore.setState({ activeWorkspaceId: 'workspace-owner-b', currentThreadId: THREAD_B });
  finishCapture('captured-base64');
  await expect(result).resolves.toBeNull();
  expect(useChatFileLinkStore.getState().pendingAttachmentsByOwner).toEqual({});
  expect(toast).toBe('Screenshot was not attached because the chat changed.');
  unregisterToastSetter();
});
