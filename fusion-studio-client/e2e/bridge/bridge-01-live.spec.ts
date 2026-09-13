import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { readSaveActionContext } from '../../src/lib/save-action-context';
import { createFileConnectedOwnerPorts } from '../../src/components/view-tabs/fileConnectedOwnerPorts';
import { setActiveFileConnectedRuntime } from '../../src/components/view-tabs/fileConnectedTabs';
import type { ConnectedTabOwnerRuntime } from '../../src/components/view-tabs/componentTabConnectedOwner';
import {
  handleResourceProvenanceResponse,
  queryResourceProvenance,
} from '../../src/lib/ws/resource-provenance-protocol';
import { useFileStore } from '../../src/state/fileStore';
import { usePanelStore } from '../../src/state/panelStore';
import { useWorkspaceStore } from '../../src/state/workspaceStore';
import { useFileDataStore } from '../../src/state/fileDataStore';
import type { FileSaveResponseV1 } from '../../src/types/file-explorer';

/**
 * BRIDGE-01 SPEC-01 slice 01C integration proof.
 *
 * This spec drives the REAL client modules exactly as the accepted 01A source
 * spec does (`fileDataStore.saveFile` -> `readSaveActionContext` ->
 * `createFileSaveRequestV1`) but points the store's real WebSocket at the REAL
 * 01B server process. The exact JSON bytes the renderer emits cross a real
 * socket and are persisted through server validation. The spec then proves the
 * durable fact snapshot survives tab close / view switch and a same-database
 * server restart.
 *
 * The File view is read-only in the product, so a real UI save is not reachable
 * from the browser surface; this is the strongest feasible reachable proof and
 * is stated as such in the slice report.
 */

type WireMessage = Record<string, unknown> & { type: string };

const phase = process.env.FUSION_BRIDGE_TEST_PHASE;
const port = Number(process.env.PORT);
const appData = process.env.FUSION_APP_USER_DATA!;
const output = process.env.FUSION_PROVENANCE_TEST_OUTPUT!;
const workspaces = JSON.parse(process.env.FUSION_PROVENANCE_TEST_WORKSPACES || '[]') as Array<{
  id: string;
  label: string;
  repoPath: string;
}>;

const VIEW_RELATIVE = path.join('ai', 'Test-Provenance', 'System', 'Views', '001-file-viewer', 'state', 'state.json');
const SAVED_PATH = 'target/live.txt';

function parseMessage(event: Event): WireMessage | null {
  try { return JSON.parse(String((event as MessageEvent).data)) as WireMessage; } catch { return null; }
}

async function waitForMessage(
  messages: WireMessage[],
  predicate: (message: WireMessage) => boolean,
  after = 0,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = messages.slice(after).find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for a bridge live-proof message.');
}

interface WireSocket {
  socket: WebSocket;
  messages: WireMessage[];
  pair: { workspaceId: string; workspaceEpoch: string };
}

async function openSocket(): Promise<WireSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages: WireMessage[] = [];
  socket.addEventListener('message', (event) => {
    const message = parseMessage(event);
    if (message) messages.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('Bridge fixture WebSocket failed to open.')), { once: true });
  });
  const init = await waitForMessage(messages, (message) => message.type === 'workspace:init');
  expect(typeof init.workspaceId).toBe('string');
  expect(typeof init.workspaceEpoch).toBe('string');
  return {
    socket,
    messages,
    pair: { workspaceId: init.workspaceId as string, workspaceEpoch: init.workspaceEpoch as string },
  };
}

async function sendAndWait(
  wire: WireSocket,
  message: WireMessage,
  predicate: (message: WireMessage) => boolean,
) {
  const after = wire.messages.length;
  wire.socket.send(JSON.stringify(message));
  return waitForMessage(wire.messages, predicate, after);
}

async function queryByOperation(wire: WireSocket, operationId: string) {
  return sendAndWait(wire, {
    type: 'resource:provenance:query', version: 1, requestId: `bridge-query-${operationId}`,
    ...wire.pair, operationId, limit: 10,
  }, (message) => message.type === 'resource:provenance:result' && message.requestId === `bridge-query-${operationId}`);
}

async function queryByTab(wire: WireSocket, tabId: string) {
  return sendAndWait(wire, {
    type: 'resource:provenance:query', version: 1, requestId: `bridge-query-tab-${tabId}`,
    ...wire.pair, panel: 'file-viewer', tabId, limit: 10,
  }, (message) => message.type === 'resource:provenance:result' && message.requestId === `bridge-query-tab-${tabId}`);
}

function viewStatePath(workspaceId: string): string {
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
  if (!workspace) throw new Error('The active bridge workspace is not in the manifest.');
  return path.join(workspace.repoPath, VIEW_RELATIVE);
}

function hashState(workspaceId: string): string {
  return createHash('sha256').update(fs.readFileSync(viewStatePath(workspaceId))).digest('hex');
}

function commandFactEvidence(operationId: string) {
  const require = createRequire(import.meta.url);
  const Database = require('../../../fusion-studio-server/node_modules/better-sqlite3');
  const {
    commandBodyFromRow,
    durableHash,
  } = require('../../../fusion-studio-server/lib/file-mutations/fact-reservation-bindings.js') as {
    commandBodyFromRow: (row: Record<string, unknown>) => {
      origin: { reportedUiContext?: Record<string, unknown> };
    };
    durableHash: (input: {
      schemaKey: string;
      eventId: string;
      occurredAt: number;
      workspaceId: string;
      operationId: string;
      body: unknown;
    }) => string;
  };
  const db = new Database(path.join(appData, 'server-data', 'fusion.db'), { readonly: true });
  try {
    const row = db.prepare('SELECT * FROM file_operations WHERE operation_id = ?').get(operationId) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error('The durable operation row behind the accepted command fact is absent.');
    const body = commandBodyFromRow(row);
    const recomputedBinding = durableHash({
      schemaKey: 'file.command_accepted',
      eventId: row.command_accepted_event_id as string,
      occurredAt: row.accepted_at as number,
      workspaceId: row.workspace_id as string,
      operationId: row.operation_id as string,
      body,
    });
    return {
      context: body.origin.reportedUiContext,
      commandAcceptedEventId: row.command_accepted_event_id as string,
      durableBindingMatches: recomputedBinding === row.command_reservation_sha256,
      rowContext: {
        reported_view_id: row.reported_view_id,
        reported_view_instance_id: row.reported_view_instance_id,
        reported_tab_id: row.reported_tab_id,
        reported_component_type_id: row.reported_component_type_id,
        reported_component_instance_id: row.reported_component_instance_id,
        reported_presenter_id: row.reported_presenter_id,
        reported_target_key: row.reported_target_key,
      },
    };
  } finally {
    db.close();
  }
}

function writeEvidence(name: string, value: unknown): void {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedClientStores(pair: { workspaceId: string; workspaceEpoch: string }, ws: WebSocket): void {
  usePanelStore.setState({
    activeWorkspaceId: pair.workspaceId,
    currentPanel: 'file-viewer',
    panelConfigs: [{ id: 'file-viewer', name: 'Files', icon: 'folder' }],
    ws,
  });
  useWorkspaceStore.setState({
    activeWorkspaceId: pair.workspaceId,
    workspaceEpoch: pair.workspaceEpoch,
    fileSaveProtocolVersion: 1,
    resourceProvenanceProtocolVersion: 1,
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
  useFileDataStore.getState().beginWorkspaceGeneration(pair.workspaceId);
}

function mountRealFileOwner(workspaceId: string): void {
  const ports = createFileConnectedOwnerPorts({ workspaceId });
  setActiveFileConnectedRuntime(
    { viewId: ports.viewId, readCollection: ports.readCollection } as unknown as ConnectedTabOwnerRuntime,
    workspaceId,
  );
}

function hydrateComponentBackedTab(): void {
  useFileStore.setState({
    tabs: [{
      id: 'bridge-tab-1',
      kind: 'file',
      file: { name: 'live.txt', path: SAVED_PATH, type: 'file', extension: 'txt' },
    }],
    activeTabId: 'bridge-tab-1',
  });
}

test.afterEach(() => {
  setActiveFileConnectedRuntime(null, null);
});

test('save in a tabbed view carries the snapshot to the durable fact and survives close/switch', async () => {
  test.skip(phase !== 'bridge-01-save');
  const app = await openSocket();
  const fixture = await openSocket();
  try {
    seedClientStores(app.pair, app.socket);
    mountRealFileOwner(app.pair.workspaceId);
    hydrateComponentBackedTab();

    const context = readSaveActionContext('file-viewer');
    expect(context).toMatchObject({
      workspaceId: app.pair.workspaceId,
      viewId: 'file-viewer',
      tabId: 'bridge-tab-1',
      componentTypeId: 'file.document',
      presenterId: 'file.document',
      targetKey: 'file:doc:target/live.txt',
    });
    expect(typeof context?.componentInstanceId).toBe('string');
    if (!context) throw new Error('The real adapter produced no context.');
    const stateHashBefore = hashState(app.pair.workspaceId);

    // Capture the exact bytes the renderer emits, then let them cross the real
    // socket to the real server.
    const sentFrames: string[] = [];
    const nativeSend = app.socket.send.bind(app.socket);
    (app.socket as unknown as { send: (data: string) => void }).send = (data: string) => {
      sentFrames.push(String(data));
      nativeSend(data);
    };

    useFileDataStore.getState().setDirty('file-viewer', SAVED_PATH, true);
    const completion = useFileDataStore.getState().saveFile(
      'file-viewer', SAVED_PATH, 'bridge proof content Ω\n', 'manual',
    );
    const requestFrame = sentFrames.find((frame) => (JSON.parse(frame) as WireMessage).type === 'file_save');
    if (!requestFrame) throw new Error('The renderer emitted no file_save frame.');
    const emittedRequest = JSON.parse(requestFrame) as WireMessage;
    expect(emittedRequest).toMatchObject({
      type: 'file_save',
      version: 1,
      workspaceId: app.pair.workspaceId,
      workspaceEpoch: app.pair.workspaceEpoch,
      panel: 'file-viewer',
      path: SAVED_PATH,
      reportedUiContext: context,
    });

    const response = await waitForMessage(app.messages, (message) => (
      message.type === 'file_save_response'
      && message.requestId === emittedRequest.requestId
    )) as unknown as FileSaveResponseV1;
    expect(response).toMatchObject({
      success: true,
      outcome: 'succeeded',
      workspaceId: app.pair.workspaceId,
      workspaceEpoch: app.pair.workspaceEpoch,
      panel: 'file-viewer',
      path: SAVED_PATH,
      canonicalPath: SAVED_PATH,
      provenanceState: 'complete',
    });
    expect(useFileDataStore.getState().handleSaveResponseV1(response)).toBe(true);
    await completion;

    // Leg 2: durable resource.mutated@1 fact via the public query route.
    const query = await queryByOperation(fixture, response.operationId);
    expect(query.workspaceId).toBe(fixture.pair.workspaceId);
    const items = query.items as WireMessage[];
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toMatchObject({
      eventId: response.resourceEventId,
      operationId: response.operationId,
      commandId: response.commandId,
      commandAcceptedEventId: response.commandAcceptedEventId,
      resourceId: response.resourceId,
      canonicalPath: SAVED_PATH,
    });
    const durableContext = (item.origin as WireMessage).reportedUiContext;
    expect(durableContext).toEqual(context);

    // The same context is queryable by its tab coordinate.
    const tabQuery = await queryByTab(fixture, context.tabId!);
    expect((tabQuery.items as WireMessage[]).map((entry) => entry.eventId)).toEqual([response.resourceEventId]);

    // Reconciliation leg: the real client query sender emits the exact query
    // bytes and the real client validator accepts the real server result.
    const clientQueryCompletion = queryResourceProvenance({ operationId: response.operationId });
    const clientQueryFrame = [...sentFrames]
      .map((frame) => JSON.parse(frame) as WireMessage)
      .reverse()
      .find((frame) => frame.type === 'resource:provenance:query');
    if (!clientQueryFrame) throw new Error('The client query sender emitted no frame.');
    const clientQueryResponse = await waitForMessage(app.messages, (message) => (
      message.type === 'resource:provenance:result' && message.requestId === clientQueryFrame.requestId
    ));
    expect(handleResourceProvenanceResponse(clientQueryResponse)).toBe(true);
    const clientItems = await clientQueryCompletion;
    expect(clientItems).toHaveLength(1);
    expect(clientItems[0].origin.reportedUiContext).toEqual(context);

    // Leg 2b: the matching file.command_accepted@1 fact carries it too. The
    // fact body is reconstructed from its durable operation row through the real
    // server module, and its reservation binding hash is re-verified.
    const commandFact = commandFactEvidence(response.operationId);
    expect(commandFact.commandAcceptedEventId).toBe(response.commandAcceptedEventId);
    expect(commandFact.context).toEqual(context);
    expect(commandFact.durableBindingMatches).toBe(true);

    // Leg 3: close the tab and switch the view in the live client surface. The
    // adapter can no longer see the tab, but the durable snapshot is unchanged.
    useFileStore.setState({ tabs: [], activeTabId: null });
    usePanelStore.setState({ currentPanel: 'office-viewer' });
    expect(readSaveActionContext('file-viewer')).toEqual({
      workspaceId: app.pair.workspaceId,
      viewId: 'file-viewer',
    });
    const afterClose = await queryByOperation(fixture, response.operationId);
    expect(((afterClose.items as WireMessage[])[0].origin as WireMessage).reportedUiContext).toEqual(context);
    const afterCloseByTab = await queryByTab(fixture, context.tabId!);
    expect((afterCloseByTab.items as WireMessage[]).length).toBe(1);

    // Leg 5: the feature writes nothing back to the view capsule.
    const stateHashAfterClose = hashState(app.pair.workspaceId);
    expect(stateHashAfterClose).toBe(stateHashBefore);

    writeEvidence('bridge-01-save.json', {
      phase,
      workspaceId: app.pair.workspaceId,
      canonicalPath: SAVED_PATH,
      operationId: response.operationId,
      commandAcceptedEventId: response.commandAcceptedEventId,
      resourceEventId: response.resourceEventId,
      emittedRequest,
      emittedContext: context,
      durableContext,
      clientValidatedContext: clientItems[0].origin.reportedUiContext,
      commandFact: {
        commandAcceptedEventId: commandFact.commandAcceptedEventId,
        context: commandFact.context,
        durableBindingMatches: commandFact.durableBindingMatches,
        rowContext: commandFact.rowContext,
      },
      contextAfterCloseSwitch: ((afterClose.items as WireMessage[])[0].origin as WireMessage).reportedUiContext,
      adapterAfterCloseSwitch: readSaveActionContext('file-viewer'),
      stateHashBefore,
      stateHashAfterClose,
    });
  } finally {
    app.socket.close();
    fixture.socket.close();
  }
});

test('same-database restart returns the identical context snapshot', async () => {
  test.skip(phase !== 'bridge-01-restart');
  const saved = JSON.parse(fs.readFileSync(path.join(output, 'bridge-01-save.json'), 'utf8')) as {
    workspaceId: string;
    operationId: string;
    commandAcceptedEventId: string;
    emittedContext: Record<string, unknown>;
    stateHashBefore: string;
  };
  const fixture = await openSocket();
  try {
    const query = await queryByOperation(fixture, saved.operationId);
    const item = (query.items as WireMessage[])[0];
    expect(item).toBeDefined();
    const durableContext = (item.origin as WireMessage).reportedUiContext;
    expect(durableContext).toEqual(saved.emittedContext);
    const commandFact = commandFactEvidence(saved.operationId);
    expect(commandFact.context).toEqual(saved.emittedContext);
    expect(commandFact.durableBindingMatches).toBe(true);
    const stateHashAfterRestart = hashState(saved.workspaceId);

    writeEvidence('bridge-01-restart.json', {
      phase,
      workspaceId: fixture.pair.workspaceId,
      durableContext,
      commandFact: {
        commandAcceptedEventId: commandFact.commandAcceptedEventId,
        context: commandFact.context,
        durableBindingMatches: commandFact.durableBindingMatches,
        rowContext: commandFact.rowContext,
      },
      stateHashAfterRestart,
    });
  } finally {
    fixture.socket.close();
  }
});
