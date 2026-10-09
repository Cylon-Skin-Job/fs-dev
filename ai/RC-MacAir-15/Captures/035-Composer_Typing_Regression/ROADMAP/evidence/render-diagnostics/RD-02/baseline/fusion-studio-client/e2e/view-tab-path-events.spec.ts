import { expect, test } from '@playwright/test';
import { emptyCaptureTabUi } from '../src/components/view-tabs/captureTabDomain';
import {
  getCaptureHandoffStatus,
  openDocumentInCaptureTabs,
} from '../src/components/view-tabs/captureTabsController';
import { handleFileMessage } from '../src/lib/ws/file-handlers';
import { usePanelStore } from '../src/state/panelStore';
import { DEFAULT_VIEW_UI_STATE } from '../src/state/slices/viewSlice';
import type { DocViewerTab, WebSocketMessage } from '../src/types';

class ControlledAckSocket extends EventTarget {
  readonly readyState = WebSocket.OPEN;
  readonly sent: Array<{
    type: string;
    view: string;
    state: Record<string, unknown>;
    clientMutationId: number;
  }> = [];

  send(payload: string) {
    this.sent.push(JSON.parse(payload) as ControlledAckSocket['sent'][number]);
  }

  respond(index: number, type: 'state:result' | 'state:error') {
    const request = this.sent[index];
    if (!request) throw new Error(`No request at index ${index}`);
    this.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type,
        view: request.view,
        clientMutationId: request.clientMutationId,
        ...(type === 'state:error' ? { message: 'injected failure' } : {}),
      }),
    }));
  }
}

function documentTab(id: string, path: string): DocViewerTab {
  const name = path.split('/').at(-1)!;
  return {
    id,
    kind: 'doc',
    path,
    name,
    extension: name.split('.').at(-1) ?? '',
    ui: {
      ...emptyCaptureTabUi(),
      lastOpenedPath: path,
      byMode: {
        active: { selectedPath: path, gridScroll: 10, docScroll: 20 },
        archive: { selectedPath: path, gridScroll: 30, docScroll: 40 },
      },
    },
  };
}

const captureTab: DocViewerTab = {
  id: 'capture',
  kind: 'capture',
  ui: emptyCaptureTabUi('recent'),
};

function fileEvent(message: Record<string, unknown>) {
  return handleFileMessage(message as unknown as WebSocketMessage);
}

function installBrowserGlobals() {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const cssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { querySelector: () => ({ focus: () => undefined }) },
  });
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { escape: (value: string) => value },
  });
  return () => {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else Reflect.deleteProperty(globalThis, 'window');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
    if (cssDescriptor) Object.defineProperty(globalThis, 'CSS', cssDescriptor);
    else Reflect.deleteProperty(globalThis, 'CSS');
  };
}

test.describe.serial('Capture tab public file-event ownership', () => {
  const originalWs = usePanelStore.getState().ws;
  const originalViewStates = usePanelStore.getState().viewStates;
  const restoreBrowserGlobals = installBrowserGlobals();

  test.afterAll(() => {
    usePanelStore.setState({ ws: originalWs, viewStates: originalViewStates });
    restoreBrowserGlobals();
  });

  test('folder rename rewrites descendants and collision-remaps the active tab id', () => {
    const socket = new ControlledAckSocket();
    const first = documentTab('first', '001-Captures/folder/a.md');
    const second = documentTab('second', '001-Captures/folder/sub/b.md');
    usePanelStore.setState((state) => ({
      ws: socket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [first, second, captureTab],
          docViewerActiveTabId: second.id,
          docViewerMode: 'active',
          docViewerActiveSelectedPath: second.path,
          docViewerLastOpenedPath: second.path,
        },
      },
    }));

    expect(fileEvent({
      type: 'file:renamed',
      sourcePanel: 'capture-viewer',
      sourcePath: '001-Captures/folder',
      targetPanel: 'capture-viewer',
      targetPath: '001-Captures/renamed',
      newName: 'renamed',
      sourceIsDirectory: true,
    })).toBe(true);
    let state = usePanelStore.getState().viewStates['capture-viewer'];
    expect(state.docViewerTabs?.filter((tab) => tab.kind === 'doc').map((tab) => tab.path)).toEqual([
      '001-Captures/renamed/a.md',
      '001-Captures/renamed/sub/b.md',
    ]);
    expect(state.docViewerTabs?.[1].ui).toMatchObject({
      lastOpenedPath: '001-Captures/renamed/sub/b.md',
      byMode: { active: { selectedPath: '001-Captures/renamed/sub/b.md' } },
    });

    expect(fileEvent({
      type: 'file:renamed',
      sourcePanel: 'capture-viewer',
      sourcePath: '001-Captures/renamed/sub/b.md',
      targetPanel: 'capture-viewer',
      targetPath: '001-Captures/renamed/a.md',
      newName: 'a.md',
    })).toBe(true);
    state = usePanelStore.getState().viewStates['capture-viewer'];
    expect(state.docViewerTabs?.map((tab) => tab.id)).toEqual(['first', 'capture']);
    expect(state.docViewerActiveTabId).toBe('first');
    expect(socket.sent.at(-1)?.state).toMatchObject({
      docViewerActiveTabId: 'first',
      docViewerTabs: [{ id: 'first', path: '001-Captures/renamed/a.md' }, { id: 'capture' }],
    });
  });

  test('delete leaves a hidden durable document survivor', () => {
    const socket = new ControlledAckSocket();
    const first = documentTab('first', '001-Captures/a.md');
    const second = documentTab('second', '001-Captures/b.md');
    usePanelStore.setState((state) => ({
      ws: socket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [first, second],
          docViewerActiveTabId: first.id,
          docViewerActiveSelectedPath: first.path,
        },
      },
    }));

    expect(fileEvent({
      type: 'file:deleted',
      sourcePanel: 'capture-viewer',
      sourcePath: first.path,
      sourceIsDirectory: false,
    })).toBe(true);
    expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
      docViewerTabs: [{ id: second.id, path: second.path }],
      docViewerActiveTabId: second.id,
      docViewerFullPage: true,
    });
    expect(getCaptureHandoffStatus()).toBe('idle');
  });

  test('delete or move-out of the sole document acknowledges cleaned classic globals', async () => {
    const events = [
      {
        type: 'file:deleted',
        sourcePanel: 'capture-viewer',
        sourcePath: '001-Captures/only.md',
        sourceIsDirectory: false,
      },
      {
        type: 'file:moved',
        sourcePanel: 'capture-viewer',
        sourcePath: '001-Captures/only.md',
        targetPanel: 'file-viewer',
        targetPath: 'moved/only.md',
        sourceIsDirectory: false,
      },
    ];

    for (const event of events) {
      const socket = new ControlledAckSocket();
      const only = documentTab('only', '001-Captures/only.md');
      usePanelStore.setState((state) => ({
        ws: socket as unknown as WebSocket,
        viewStates: {
          ...state.viewStates,
          'capture-viewer': {
            ...DEFAULT_VIEW_UI_STATE,
            docViewerTabs: [only],
            docViewerActiveTabId: only.id,
            docViewerActiveSelectedPath: only.path,
            docViewerArchiveSelectedPath: only.path,
            docViewerLastOpenedPath: only.path,
            docViewerFullPage: true,
          },
        },
      }));

      expect(fileEvent(event)).toBe(true);
      expect(getCaptureHandoffStatus()).toBe('pending');
      expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([only]);
      expect(socket.sent).toHaveLength(1);
      expect(socket.sent[0].state).toMatchObject({
        docViewerActiveSelectedPath: null,
        docViewerArchiveSelectedPath: null,
        docViewerLastOpenedPath: null,
      });

      socket.respond(0, 'state:result');
      await expect.poll(() => socket.sent.length).toBe(2);
      expect(socket.sent[1].state).toEqual({ docViewerTabs: [], docViewerActiveTabId: null });
      socket.respond(1, 'state:result');
      await expect.poll(() => getCaptureHandoffStatus()).toBe('idle');
      expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
        docViewerTabs: [],
        docViewerActiveTabId: null,
        docViewerActiveSelectedPath: null,
        docViewerArchiveSelectedPath: null,
        docViewerLastOpenedPath: null,
        docViewerFullPage: false,
      });
    }
  });

  test('move out stages and acknowledges the CAPTURE survivor before classic handoff', async () => {
    const originalConsoleError = console.error;
    console.error = () => undefined;
    const socket = new ControlledAckSocket();
    const first = documentTab('first', '001-Captures/folder/a.md');
    const second = documentTab('second', '001-Captures/folder/sub/b.md');
    usePanelStore.setState((state) => ({
      ws: socket as unknown as WebSocket,
      viewStates: {
        ...state.viewStates,
        'capture-viewer': {
          ...DEFAULT_VIEW_UI_STATE,
          docViewerTabs: [first, second, captureTab],
          docViewerActiveTabId: first.id,
          docViewerActiveSelectedPath: first.path,
        },
      },
    }));

    try {
      expect(fileEvent({
        type: 'file:moved',
        sourcePanel: 'capture-viewer',
        sourcePath: '001-Captures/folder',
        targetPanel: 'file-viewer',
        targetPath: 'moved/folder',
        sourceIsDirectory: true,
      })).toBe(true);
      expect(getCaptureHandoffStatus()).toBe('pending');
      expect(usePanelStore.getState().viewStates['capture-viewer']).toMatchObject({
        docViewerTabs: [{ id: captureTab.id, kind: 'capture' }],
        docViewerActiveTabId: captureTab.id,
        docViewerFullPage: false,
      });
      expect(socket.sent).toHaveLength(1);
      expect(socket.sent[0].state).toEqual({
        docViewerTabs: [captureTab],
        docViewerActiveTabId: captureTab.id,
      });

      socket.respond(0, 'state:error');
      await expect.poll(() => getCaptureHandoffStatus()).toBe('failed');
      expect(socket.sent).toHaveLength(1);
      expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([captureTab]);

      expect(openDocumentInCaptureTabs({
        folder: '001-Captures',
        path: '001-Captures/recovery.md',
        name: 'recovery.md',
      })).toBe(true);
      expect(getCaptureHandoffStatus()).toBe('idle');

      usePanelStore.setState((state) => ({
        viewStates: {
          ...state.viewStates,
          'capture-viewer': {
            ...DEFAULT_VIEW_UI_STATE,
            docViewerTabs: [first, second, captureTab],
            docViewerActiveTabId: first.id,
            docViewerActiveSelectedPath: first.path,
          },
        },
      }));
      fileEvent({
        type: 'file:moved',
        sourcePanel: 'capture-viewer',
        sourcePath: '001-Captures/folder',
        targetPanel: 'file-viewer',
        targetPath: 'moved-again/folder',
        sourceIsDirectory: true,
      });
      const stageIndex = socket.sent.length - 1;
      socket.respond(stageIndex, 'state:result');
      await expect.poll(() => socket.sent.length).toBe(stageIndex + 2);
      socket.respond(stageIndex + 1, 'state:result');
      await expect.poll(() => socket.sent.length).toBe(stageIndex + 3);
      socket.respond(stageIndex + 2, 'state:result');
      await expect.poll(() => getCaptureHandoffStatus()).toBe('idle');
      expect(usePanelStore.getState().viewStates['capture-viewer'].docViewerTabs).toEqual([]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
