import { expect, test } from '@playwright/test';
import { handleThreadMessage } from '../src/lib/ws/thread-handlers';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import type { Thread, WebSocketMessage } from '../src/types';

const thread: Thread = {
  threadId: 'thread-bootstrap-order',
  entry: {
    name: 'Bootstrap ordering',
    createdAt: '2026-08-17T00:00:00.000Z',
    messageCount: 1,
    status: 'active',
  },
};

test('thread lists wait for workspace initialization before opening and restoring usage', () => {
  const sent: WebSocketMessage[] = [];
  const ws = {
    readyState: WebSocket.OPEN,
    send(raw: string) {
      sent.push(JSON.parse(raw) as WebSocketMessage);
    },
  } as WebSocket;

  usePanelStore.setState({
    ws,
    threads: [],
    currentThreadId: null,
    chatActive: false,
    contextUsage: 0,
    projectChats: {},
    viewStates: {},
    currentPanel: 'file-viewer',
  });
  useWorkspaceStore.setState({ hasReceivedInit: false });

  expect(handleThreadMessage({ type: 'thread:list', threads: [thread] })).toBe(true);
  expect(usePanelStore.getState().threads).toEqual([thread]);
  expect(usePanelStore.getState().currentThreadId).toBeNull();
  expect(sent.some((message) => message.type === 'thread:open')).toBe(false);

  useWorkspaceStore.getState().markInit();
  expect(handleThreadMessage({ type: 'thread:list', threads: [thread] })).toBe(true);
  expect(usePanelStore.getState().currentThreadId).toBe(thread.threadId);
  expect(sent.filter((message) => message.type === 'thread:open')).toEqual([
    { type: 'thread:open', threadId: thread.threadId },
  ]);

  expect(handleThreadMessage({
    type: 'thread:opened',
    threadId: thread.threadId,
    thread: thread.entry,
    exchanges: [],
    contextUsage: 0.25,
  })).toBe(true);
  expect(usePanelStore.getState().chatActive).toBe(true);
  expect(usePanelStore.getState().contextUsage).toBe(0.25);

  useWorkspaceStore.getState().beginInit();
  expect(useWorkspaceStore.getState().hasReceivedInit).toBe(false);
});
