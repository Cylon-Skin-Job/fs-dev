import { expect, test } from '@playwright/test';
import { handleThreadMessage } from '../src/lib/ws/thread-handlers';
import { usePanelStore } from '../src/state/panelStore';
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

test('historical null-view lists remain readable without selecting or opening a hidden session', () => {
  const sent: WebSocketMessage[] = [];
  const ws = {
    readyState: WebSocket.OPEN,
    send(raw: string) {
      sent.push(JSON.parse(raw) as WebSocketMessage);
    },
  } as WebSocket;

  usePanelStore.setState({
    ws,
    activeWorkspaceId: 'workspace-bootstrap-order',
    threads: [],
    currentThreadId: null,
    chatActive: false,
    contextUsage: 0,
    projectChats: {},
    viewStates: {},
    currentPanel: 'file-viewer',
  });
  expect(handleThreadMessage({ type: 'thread:list', viewId: null, threads: [thread] })).toBe(true);
  expect(usePanelStore.getState().threads).toEqual([thread]);
  expect(usePanelStore.getState().currentThreadId).toBeNull();
  expect(sent.some((message) => message.type === 'thread:open')).toBe(false);

  expect(handleThreadMessage({ type: 'thread:list', viewId: null, threads: [thread] })).toBe(true);
  expect(usePanelStore.getState().currentThreadId).toBeNull();
  expect(sent.filter((message) => message.type === 'thread:open')).toEqual([]);
});
