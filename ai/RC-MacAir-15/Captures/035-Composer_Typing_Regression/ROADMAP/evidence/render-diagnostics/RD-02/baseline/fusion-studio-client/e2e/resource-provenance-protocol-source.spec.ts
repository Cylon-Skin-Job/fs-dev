import { expect, test } from '@playwright/test';
import { usePanelStore } from '../src/state/panelStore';
import { useWorkspaceStore } from '../src/state/workspaceStore';
import {
  handleResourceProvenanceResponse,
  queryResourceProvenance,
  retirePendingResourceProvenanceQueries,
} from '../src/lib/ws/resource-provenance-protocol';

const A1 = '123e4567-e89b-42d3-a456-426614174000';
const A2 = '123e4567-e89b-42d3-a456-426614174001';

function setup(messages: Array<Record<string, unknown>>) {
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: { OPEN: 1 } });
  usePanelStore.setState({
    ws: {
      readyState: 1,
      send(value: string) { messages.push(JSON.parse(value) as Record<string, unknown>); },
    } as unknown as WebSocket,
  });
  useWorkspaceStore.setState({
    activeWorkspaceId: 'workspace-A',
    workspaceEpoch: A1,
    resourceProvenanceProtocolVersion: 1,
  });
  retirePendingResourceProvenanceQueries();
}

test('query sender captures the atomic workspace pair and resolves only an exact current response', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);
  const completion = queryResourceProvenance({ panel: 'file-viewer', path: 'docs/a.md', limit: 25 });
  const request = messages[0];
  expect(request).toMatchObject({
    type: 'resource:provenance:query', version: 1, workspaceId: 'workspace-A',
    workspaceEpoch: A1, panel: 'file-viewer', path: 'docs/a.md', limit: 25,
  });
  expect(handleResourceProvenanceResponse({
    type: 'resource:provenance:result', version: 1, requestId: request.requestId,
    workspaceId: 'workspace-A', workspaceEpoch: A1, items: [],
  })).toBe(true);
  await expect(completion).resolves.toEqual([]);
});

test('A to B to A stale replies cannot settle and binding retirement rejects the pending query', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);
  const completion = queryResourceProvenance({ fileName: 'a.md' });
  const observed = completion.catch((error: unknown) => error);
  const request = messages[0];
  useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-A', workspaceEpoch: A2 });
  expect(handleResourceProvenanceResponse({
    type: 'resource:provenance:result', version: 1, requestId: request.requestId,
    workspaceId: 'workspace-A', workspaceEpoch: A1, items: [],
  })).toBe(true);
  retirePendingResourceProvenanceQueries();
  await expect(observed).resolves.toBeInstanceOf(Error);
});

test('closed response guard rejects raw/unknown snapshot fields and invalid discriminants', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);
  const completion = queryResourceProvenance({});
  const observed = completion.catch((error: unknown) => error);
  const request = messages[0];
  const invalid = {
    type: 'resource:provenance:result', version: 1, requestId: request.requestId,
    workspaceId: 'workspace-A', workspaceEpoch: A1,
    items: [{ snapshot: { kind: 'absent', byteLength: 0, capturedAt: 1, bytes: 'secret' } }],
  };
  expect(handleResourceProvenanceResponse(invalid)).toBe(false);
  retirePendingResourceProvenanceQueries();
  await expect(observed).resolves.toBeInstanceOf(Error);
});

test('query sender requires the active bind to advertise provenance v1 before registering or sending', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);
  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', A1, 1, null);

  await expect(queryResourceProvenance({ fileName: 'a.md' })).rejects.toThrow(
    'not supported by this server',
  );
  expect(messages).toEqual([]);

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', A1, 1, 1);
  const completion = queryResourceProvenance({ fileName: 'a.md' });
  expect(messages).toHaveLength(1);
  retirePendingResourceProvenanceQueries();
  await expect(completion).rejects.toThrow('workspace changed');
});

test('workspace switch and reconnect replace the provenance advertisement with the new bind', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-B', A2, 1, null);
  await expect(queryResourceProvenance({})).rejects.toThrow('not supported by this server');
  expect(messages).toEqual([]);

  useWorkspaceStore.getState().beginInit();
  expect(useWorkspaceStore.getState().resourceProvenanceProtocolVersion).toBeNull();
  await expect(queryResourceProvenance({})).rejects.toThrow('workspace is not available');
  expect(messages).toEqual([]);

  useWorkspaceStore.getState().applyWorkspaceBinding('workspace-A', A2, 1, 1);
  const completion = queryResourceProvenance({});
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ workspaceId: 'workspace-A', workspaceEpoch: A2 });
  retirePendingResourceProvenanceQueries();
  await expect(completion).rejects.toThrow('workspace changed');
});

function contextBearingItem(context: unknown): Record<string, unknown> {
  return {
    eventId: A2,
    eventType: 'resource.mutated',
    occurredAt: 1_800_000_000_000,
    acceptedAt: 1_800_000_000_001,
    operationId: '123e4567-e89b-42d3-a456-426614174010',
    commandId: '123e4567-e89b-42d3-a456-426614174011',
    commandAcceptedEventId: '123e4567-e89b-42d3-a456-426614174012',
    resourceId: '123e4567-e89b-42d3-a456-426614174013',
    fileVersionId: '123e4567-e89b-42d3-a456-426614174014',
    mutationKind: 'modify',
    canonicalPath: 'target/live.txt',
    ingress: { panel: 'file-viewer', path: 'target/live.txt' },
    origin: {
      kind: 'local_client',
      assurance: 'transport_only',
      connectionId: 'connection-1',
      reportedUiContext: context,
    },
    snapshot: { kind: 'absent', byteLength: 0, capturedAt: 1_800_000_000_002 },
  };
}

test('context-bearing durable items are accepted with the bounded snapshot preserved', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);
  const completion = queryResourceProvenance({});
  const request = messages[0];
  const context = {
    workspaceId: 'workspace-A',
    viewId: 'file-viewer',
    viewInstanceId: 'mount-1',
    tabId: 'tab-file-1',
    componentTypeId: 'file.document',
    componentInstanceId: 'component-instance-1',
    presenterId: 'file.document',
    targetKey: 'file:doc:target/live.txt',
  };
  expect(handleResourceProvenanceResponse({
    type: 'resource:provenance:result', version: 1, requestId: request.requestId,
    workspaceId: 'workspace-A', workspaceEpoch: A1, items: [contextBearingItem(context)],
  })).toBe(true);
  const items = await completion;
  expect(items).toHaveLength(1);
  expect(items[0].origin.reportedUiContext).toEqual(context);

  // The accepted prior shape (no context) stays valid and simply omits the key.
  const bareCompletion = queryResourceProvenance({});
  const bareRequest = messages.at(-1)!;
  const bareItem = contextBearingItem(undefined);
  delete (bareItem.origin as Record<string, unknown>).reportedUiContext;
  expect(handleResourceProvenanceResponse({
    type: 'resource:provenance:result', version: 1, requestId: bareRequest.requestId,
    workspaceId: 'workspace-A', workspaceEpoch: A1, items: [bareItem],
  })).toBe(true);
  await expect(bareCompletion).resolves.toHaveLength(1);
});

test('context-bearing items fail closed on missing required identities, unknown fields, or over-cap values', async () => {
  const messages: Array<Record<string, unknown>> = [];
  setup(messages);

  const rejectedContexts: unknown[] = [
    { viewId: 'file-viewer', secret: 'not-allowed' },
    { viewId: 'v'.repeat(129), workspaceId: 'workspace-A' },
    { viewId: 'file-viewer', workspaceId: 'w'.repeat(129) },
    { viewId: 'file-viewer', workspaceId: 'workspace-A', targetKey: 'k'.repeat(513) },
    // Canonical `ComponentActionContext` requires workspaceId and viewId.
    { viewId: 'file-viewer' },
    { workspaceId: 'workspace-A' },
    { tabId: 'tab-1' },
    {},
  ];
  for (const context of rejectedContexts) {
    const completion = queryResourceProvenance({});
    const observed = completion.catch((error: unknown) => error);
    const request = messages.at(-1)!;
    expect(handleResourceProvenanceResponse({
      type: 'resource:provenance:result', version: 1, requestId: request.requestId,
      workspaceId: 'workspace-A', workspaceEpoch: A1, items: [contextBearingItem(context)],
    })).toBe(false);
    retirePendingResourceProvenanceQueries();
    await expect(observed).resolves.toBeInstanceOf(Error);
  }
});
