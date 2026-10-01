import { expect, test } from '@playwright/test';
import { readSaveActionContext } from '../src/lib/save-action-context';
import { createFileConnectedOwnerPorts } from '../src/components/view-tabs/fileConnectedOwnerPorts';
import { setActiveFileConnectedRuntime } from '../src/components/view-tabs/fileConnectedTabs';
import type { ConnectedTabOwnerRuntime } from '../src/components/view-tabs/componentTabConnectedOwner';
import type { ComponentTabCollectionState } from '../src/components/view-tabs/componentTabTypes';
import { useFileStore } from '../src/state/fileStore';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import { useFileDataStore } from '../src/state/fileDataStore';
import type { FileSaveSucceededResponseV1 } from '../src/types/file-explorer';

const EPOCH_A = '123e4567-e89b-42d3-a456-426614174000';

function success(request: {
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
}): FileSaveSucceededResponseV1 {
  return {
    type: 'file_save_response', version: 1, success: true, outcome: 'succeeded',
    requestId: request.requestId,
    workspaceId: request.workspaceId,
    workspaceEpoch: request.workspaceEpoch,
    panel: request.panel,
    path: request.path,
    operationId: '123e4567-e89b-42d3-a456-426614174010',
    commandId: '123e4567-e89b-42d3-a456-426614174011',
    commandAcceptedEventId: '123e4567-e89b-42d3-a456-426614174012',
    resourceEventId: '123e4567-e89b-42d3-a456-426614174013',
    resourceId: '123e4567-e89b-42d3-a456-426614174014',
    fileVersionId: '123e4567-e89b-42d3-a456-426614174015',
    canonicalPath: request.path,
    commandFactState: 'admitted', resourceFactState: 'admitted', ledgerState: 'stored',
    provenanceState: 'complete', checkpointState: 'not_requested',
  };
}

function seed(messages: Array<Record<string, unknown>>): void {
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    value: { OPEN: 1 },
  });
  usePanelStore.setState({
    activeWorkspaceId: 'workspace-A',
    currentPanel: 'file-viewer',
    panelConfigs: [{ id: 'file-viewer', name: 'Files', icon: 'folder' }],
    ws: {
      readyState: 1,
      send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({
    activeWorkspaceId: 'workspace-A', workspaceEpoch: EPOCH_A, fileSaveProtocolVersion: 1,
  });
  useFileStore.setState({
    viewMode: 'tree',
    tabs: [],
    activeTabId: null,
    activeTabPath: null,
    expandedFolders: new Set(),
    showHiddenFolders: false,
  });
  useFileDataStore.setState({ workspaceId: null });
  useFileDataStore.getState().clearAll();
  useFileDataStore.getState().beginWorkspaceGeneration('workspace-A');
}

function hydrateOneFileTab(): void {
  useFileStore.setState({
    tabs: [{
      id: 'tab-file-1',
      kind: 'file',
      file: { name: 'note.md', path: 'note.md', type: 'file', extension: 'md' },
    }],
    activeTabId: 'tab-file-1',
  });
}

function mountRealFileOwner(workspaceId: string): void {
  const ports = createFileConnectedOwnerPorts({ workspaceId });
  setActiveFileConnectedRuntime(
    { viewId: ports.viewId, readCollection: ports.readCollection } as unknown as ConnectedTabOwnerRuntime,
    workspaceId,
  );
}

function mountRawOwner(collection: ComponentTabCollectionState): void {
  setActiveFileConnectedRuntime(
    { viewId: 'file-viewer', readCollection: () => collection } as unknown as ConnectedTabOwnerRuntime,
    'workspace-A',
  );
}

test.afterEach(() => {
  setActiveFileConnectedRuntime(null, null);
});

test('component-backed File tab populates the full context and the file_save wire message carries it', async () => {
  const messages: Array<Record<string, unknown>> = [];
  seed(messages);
  mountRealFileOwner('workspace-A');
  hydrateOneFileTab();

  const context = readSaveActionContext('file-viewer');
  expect(context).toMatchObject({
    workspaceId: 'workspace-A',
    viewId: 'file-viewer',
    tabId: 'tab-file-1',
    componentTypeId: 'file.document',
    presenterId: 'file.document',
    targetKey: 'file:doc:note.md',
  });
  expect(typeof context?.componentInstanceId).toBe('string');
  expect((context?.componentInstanceId ?? '').length).toBeGreaterThan(0);

  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  const request = messages.at(-1)! as unknown as {
    requestId: string; reportedUiContext?: Record<string, unknown>;
  };
  expect(request.reportedUiContext).toMatchObject({
    workspaceId: 'workspace-A',
    viewId: 'file-viewer',
    tabId: 'tab-file-1',
    componentTypeId: 'file.document',
    presenterId: 'file.document',
    targetKey: 'file:doc:note.md',
  });
  expect(typeof request.reportedUiContext?.componentInstanceId).toBe('string');
  expect(useFileDataStore.getState().handleSaveResponseV1(success(request))).toBe(true);
  await completion;
});

test('context omits tab fields when absent and omits entirely for an unregistered view', async () => {
  const messages: Array<Record<string, unknown>> = [];
  seed(messages);

  // Registered view with no connected owner and no active component tab: the
  // required workspace/view pair survives, component fields are omitted.
  expect(readSaveActionContext('file-viewer')).toEqual({
    workspaceId: 'workspace-A', viewId: 'file-viewer',
  });

  // Unknown/legacy panel: no invented viewId, whole context omitted.
  expect(readSaveActionContext('legacy-custom-panel')).toBeUndefined();
  const completion = useFileDataStore.getState().saveFile('legacy-custom-panel', 'x.md', 'body', 'manual');
  const request = messages.at(-1)! as unknown as { requestId: string };
  expect(messages.at(-1)).not.toHaveProperty('reportedUiContext');
  expect(useFileDataStore.getState().handleSaveResponseV1(success({
    ...request, workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A,
    panel: 'legacy-custom-panel', path: 'x.md',
  }))).toBe(true);
  await completion;

  // No active workspace: whole context omitted (never guessed).
  useWorkspaceStore.setState({ activeWorkspaceId: null });
  expect(readSaveActionContext('file-viewer')).toBeUndefined();
});

test('stale owner identity omits tab fields and a throwing owner read cannot flail the save', async () => {
  const messages: Array<Record<string, unknown>> = [];
  seed(messages);

  // Owner registered for another workspace is stale: no tab fields.
  mountRealFileOwner('workspace-B');
  hydrateOneFileTab();
  expect(readSaveActionContext('file-viewer')).toEqual({
    workspaceId: 'workspace-A', viewId: 'file-viewer',
  });

  // A throwing owner read is contained: whole context omitted, save unchanged.
  setActiveFileConnectedRuntime(
    {
      viewId: 'file-viewer',
      readCollection: () => { throw new Error('owner unavailable'); },
    } as unknown as ConnectedTabOwnerRuntime,
    'workspace-A',
  );
  expect(readSaveActionContext('file-viewer')).toBeUndefined();

  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  const request = messages.at(-1)! as unknown as { requestId: string };
  expect(messages.at(-1)).not.toHaveProperty('reportedUiContext');
  expect(useFileDataStore.getState().handleSaveResponseV1(success({
    ...request, workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A,
    panel: 'file-viewer', path: 'note.md',
  }))).toBe(true);
  await completion;
});

test('over-cap identifiers are dropped with the fixed cap rule and boundary values are kept', () => {
  seed([]);
  const longTabId = 't'.repeat(200);
  const longType = 'c'.repeat(200);
  const longTarget = 'k'.repeat(600);
  mountRawOwner({
    tabs: [{
      tabId: longTabId,
      content: {
        kind: 'component',
        revision: 1,
        component: {
          schemaVersion: 1,
          componentTypeId: longType,
          componentInstanceId: 'ci-1',
          input: {},
          targetKey: longTarget,
        },
      },
    }],
    activeTabId: longTabId,
    reservations: [],
  });
  expect(readSaveActionContext('file-viewer')).toEqual({
    workspaceId: 'workspace-A', viewId: 'file-viewer', componentInstanceId: 'ci-1',
  });

  const id128 = 'a'.repeat(128);
  const target512 = 'b'.repeat(512);
  mountRawOwner({
    tabs: [{
      tabId: 'tab-1',
      content: {
        kind: 'component',
        revision: 1,
        component: {
          schemaVersion: 1,
          componentTypeId: 'file.document',
          componentInstanceId: id128,
          input: {},
          targetKey: target512,
        },
      },
    }],
    activeTabId: 'tab-1',
    reservations: [],
  });
  expect(readSaveActionContext('file-viewer')).toEqual({
    workspaceId: 'workspace-A',
    viewId: 'file-viewer',
    tabId: 'tab-1',
    componentTypeId: 'file.document',
    componentInstanceId: id128,
    presenterId: 'file.document',
    targetKey: target512,
  });
});

test('context reads mutate no store and emit no view-state message', async () => {
  const messages: Array<Record<string, unknown>> = [];
  seed(messages);
  mountRealFileOwner('workspace-A');
  hydrateOneFileTab();

  const panelState = usePanelStore.getState();
  const viewStatesBefore = JSON.stringify(panelState.viewStates);
  const tabsBefore = useFileStore.getState().tabs;
  const workspaceBefore = JSON.stringify(useWorkspaceStore.getState());
  expect(readSaveActionContext('file-viewer')).toBeDefined();
  expect(usePanelStore.getState()).toBe(panelState);
  expect(JSON.stringify(usePanelStore.getState().viewStates)).toBe(viewStatesBefore);
  expect(useFileStore.getState().tabs).toBe(tabsBefore);
  expect(JSON.stringify(useWorkspaceStore.getState())).toBe(workspaceBefore);

  useFileDataStore.getState().setDirty('file-viewer', 'note.md', true);
  const completion = useFileDataStore.getState().saveFile('file-viewer', 'note.md', 'body', 'manual');
  expect(messages).toHaveLength(1);
  expect(messages[0].type).toBe('file_save');
  expect(messages.some((message) => message.type === 'state:set')).toBe(false);
  expect(JSON.stringify(usePanelStore.getState().viewStates)).toBe(viewStatesBefore);
  expect(useFileStore.getState().tabs).toBe(tabsBefore);

  const request = messages[0] as unknown as { requestId: string };
  expect(useFileDataStore.getState().handleSaveResponseV1(success({
    ...request, workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A,
    panel: 'file-viewer', path: 'note.md',
  }))).toBe(true);
  await completion;
});
